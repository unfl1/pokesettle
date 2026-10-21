"""Download baseline metadata and per-species documents, without an LLM or invented facts."""

import argparse
import csv
import io
import json

from backend.config import Settings
from backend.data_preparation.pokeapi import LICENCE_URL, PokeApiSource
from backend.http_client import SourceClient
from backend.models import Pokemon
from backend.storage import Store

CSV_ROOT = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv"


def prepare(settings, count=100):
    if not 100 <= count <= 1025:
        raise ValueError("기본 포켓몬 수는 100~1025 범위로 지정하세요.")
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    (settings.data_dir / "documents").mkdir(exist_ok=True)
    store = Store(settings.runtime_dir / "state.sqlite3")
    client = SourceClient(settings, store)
    tables, sources = {}, []
    for name in [
        "pokemon",
        "pokemon_stats",
        "pokemon_types",
        "types",
        "pokemon_abilities",
        "abilities",
        "pokemon_species_names",
    ]:
        snapshot = client.fetch(f"{CSV_ROOT}/{name}.csv", expect_json=False)
        tables[name] = list(csv.DictReader(io.StringIO(snapshot["body"])))
        sources.append(
            {
                "source_id": f"pokeapi-csv:{name}",
                "source_url": snapshot["url"],
                "collected_at": snapshot["collected_at"],
                "content_hash": snapshot["content_hash"],
                "licence_url": LICENCE_URL,
                "scope": "generic",
                "transformation_notes": "CSV rows normalized; images and sprites excluded",
            }
        )
    names = {
        (int(r["pokemon_species_id"]), int(r["local_language_id"])): r["name"]
        for r in tables["pokemon_species_names"]
    }
    types = {r["id"]: r["identifier"] for r in tables["types"]}
    abilities = {r["id"]: r["identifier"] for r in tables["abilities"]}
    stat_names = {
        "1": "hp",
        "2": "attack",
        "3": "defense",
        "4": "sp_attack",
        "5": "sp_defense",
        "6": "speed",
    }
    source = PokeApiSource(client)
    records, documents = [], []
    for row in tables["pokemon"]:
        species_id = int(row["species_id"])
        if row["is_default"] != "1" or species_id > count:
            continue
        identifier = row["id"]
        stats = {
            stat_names[s["stat_id"]]: int(s["base_stat"])
            for s in tables["pokemon_stats"]
            if s["pokemon_id"] == identifier
        }
        provenance = {
            name: {
                "source_ids": [f"pokeapi-csv:{table}"],
                "verification_status": "verified",
                "scope": "generic PokéAPI baseline; Champions applicability unknown",
                "verified_at": next(
                    s["collected_at"] for s in sources if s["source_id"] == f"pokeapi-csv:{table}"
                ),
            }
            for name, table in [
                ("names", "pokemon_species_names"),
                ("types", "pokemon_types"),
                ("base_stats", "pokemon_stats"),
                ("abilities", "pokemon_abilities"),
            ]
        }
        pokemon = Pokemon(
            pokemon_id=f"pokemon:{species_id}",
            species_id=species_id,
            name_ko=names.get((species_id, 3)),
            name_en=names.get((species_id, 9), row["identifier"]),
            types=[
                types[r["type_id"]]
                for r in tables["pokemon_types"]
                if r["pokemon_id"] == identifier
            ],
            base_stats=stats,
            abilities=[
                abilities[r["ability_id"]]
                for r in tables["pokemon_abilities"]
                if r["pokemon_id"] == identifier
            ],
            source_url=f"https://pokeapi.co/api/v2/pokemon/{identifier}/",
            collected_at=sources[0]["collected_at"],
            field_provenance=provenance,
        )
        own = source.subject(pokemon)
        if own is None:
            raise ValueError(f"자체 문서 없음: {pokemon.pokemon_id}")
        document = source.fetch_document(own)
        if document is None:
            raise ValueError(f"자체 문서 본문 없음: {pokemon.pokemon_id}")
        documents.append(
            {"pokemon_id": pokemon.pokemon_id, "document": document.model_dump(mode="json")}
        )
        records.append(pokemon.model_dump())
        print(f"자료 준비 {len(records)}/{count}: {pokemon.name_ko or pokemon.name_en}", flush=True)
    if len(records) < count or len({r["species_id"] for r in records}) != len(records):
        raise ValueError("고유 기본 항목 수 부족")
    # Publish complete snapshots only; HTTP cache already preserves partial progress.
    for path, value in [
        (settings.data_dir / "pokemon.json", records),
        (settings.data_dir / "documents" / "species.json", documents),
        (settings.data_dir / "sources.json", sources),
    ]:
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
        temporary.replace(path)
    print(
        json.dumps(
            {
                "metadata_count": len(records),
                "subject_documents": len(documents),
                "network_calls": client.network_calls,
                "cache_hits": client.cache_hits,
            }
        )
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--count", type=int, default=100)
    args = parser.parse_args()
    prepare(Settings.from_env(), args.count)
