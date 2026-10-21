import json

import pytest
from fastapi.testclient import TestClient

from backend.catalog import Catalog
from backend.discovery import discover
from backend.main import create_app
from backend.models import DiscoveryPlan, DiscoveryRequest, Pokemon
from backend.scripts.prepare_data import TABLES, build_snapshots
from backend.tests.conftest import record


def bulk_tables():
    tables = {name: [] for name in TABLES}
    for sid, identifier, default in [(1, 1, True), (1, 10001, False), (2048, 2048, True)]:
        tables["pokemon"].append(
            {
                "id": str(identifier),
                "species_id": str(sid),
                "identifier": f"test-{identifier}",
                "is_default": str(int(default)),
            }
        )
        for stat_id in range(1, 7):
            tables["pokemon_stats"].append(
                {
                    "pokemon_id": str(identifier),
                    "stat_id": str(stat_id),
                    "base_stat": str(50 + int(not default)),
                }
            )
        tables["pokemon_types"].append({"pokemon_id": str(identifier), "type_id": "1", "slot": "1"})
        tables["pokemon_abilities"].append({"pokemon_id": str(identifier), "ability_id": "1"})
        tables["pokemon_forms"].append(
            {
                "id": str(identifier),
                "pokemon_id": str(identifier),
                "is_default": "1",
                "form_identifier": "" if default else "alternate",
            }
        )
    for sid in [1, 2048]:
        for language in ["3", "9"]:
            tables["pokemon_species_names"].append(
                {
                    "pokemon_species_id": str(sid),
                    "local_language_id": language,
                    "name": f"name-{sid}",
                }
            )
        tables["pokemon_species_flavor_text"].append(
            {
                "species_id": str(sid),
                "language_id": "9",
                "version_id": "1",
                "flavor_text": f"TEST species {sid} original description.",
            }
        )
    tables["types"] = [{"id": "1", "identifier": "electric"}]
    tables["abilities"] = [{"id": "1", "identifier": "test-ability"}]
    tables["versions"] = [{"id": "1", "identifier": "test-version"}]
    tables["pokemon_form_names"] = [
        {
            "pokemon_form_id": "10001",
            "local_language_id": "3",
            "form_name": "테스트 폼",
            "pokemon_name": "",
        }
    ]
    sources = [
        {
            "source_id": f"pokeapi-csv:{name}",
            "source_url": f"https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/{name}.csv",
            "collected_at": "2026-10-21T00:00:00Z",
        }
        for name in TABLES
    ]
    return tables, sources


def test_bulk_keeps_all_species_independent_variety_stats_and_image_ids(tmp_path):
    tables, sources = bulk_tables()
    records, documents = build_snapshots(tables, sources)
    assert len(records) == len(documents) == 3
    assert {r["species_id"] for r in records} == {1, 2048}
    alternate = next(r for r in records if not r["is_default"])
    assert alternate["pokemon_id"] == "pokemon:10001" and alternate["species_id"] == 1
    assert alternate["base_stats"]["speed"] == 51
    assert alternate["images"]["artwork_url"].endswith("/10001.png")
    assert "테스트 폼" in alternate["name_ko"]
    assert all("test-version" in d["document"]["body"] for d in documents)
    assert documents[0]["document"]["source_url"].endswith("pokemon_species_flavor_text.csv")
    path = tmp_path / "pokemon.json"
    path.write_text(json.dumps(records))
    assert len(Catalog(path).items) == 3
    assert len(build_snapshots(tables, sources, count=1)[0]) == 2
    tables["pokemon_species_flavor_text"] = []
    with pytest.raises(ValueError, match="문서 없음"):
        build_snapshots(tables, sources)


def test_api_more_than_100_and_form_metadata(setup):
    for number in range(101, 206):
        setup.catalog.items[f"pokemon:{number}"] = Pokemon.model_validate(record(number))
    form = Pokemon.model_validate(
        {**record(10001), "species_id": 1, "is_default": False, "form_identifier": "test-alternate"}
    )
    setup.catalog.items[form.pokemon_id] = form
    with TestClient(create_app(setup.settings, service=setup.service)) as client:
        first = client.get("/api/pokemon?limit=100").json()["data"]
        second = client.get("/api/pokemon?limit=100&offset=100").json()["data"]
        last = client.get("/api/pokemon?limit=100&offset=200").json()["data"]
        assert first["total"] == 206 and len(second["items"]) == 100 and len(last["items"]) == 6
        assert {p["pokemonId"] for p in first["items"]}.isdisjoint(
            p["pokemonId"] for p in second["items"]
        )
        assert last["items"][-1]["speciesId"] == 1 and not last["items"][-1]["isDefault"]
        assert client.get("/api/status").json()["data"]["speciesCount"] == 205


def test_discovery_pagination_reuses_plan_and_refreshes_when_catalog_changes(setup):
    setup.model.discovery_plan = DiscoveryPlan(
        filters=[{"field": "types", "operator": "eq", "value": "test-type"}],
        requires_clarification=False,
        unresolved_conditions=[],
        explanation="테스트 타입",
    )
    query = DiscoveryRequest(query="테스트 타입", limit=60)
    first = discover(setup.service, query)
    second = discover(setup.service, query.model_copy(update={"offset": 60}))
    assert len(first["items"]) == 60 and len(second["items"]) == 40
    assert len([c for c in setup.model.calls if c[0] == "discovery"]) == 1
    setup.catalog.items["pokemon:101"] = Pokemon.model_validate(record(101))
    assert discover(setup.service, query)["total"] == 101
    assert len([c for c in setup.model.calls if c[0] == "discovery"]) == 2
