from copy import deepcopy
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from backend.app.core.config import Settings
from backend.app.core.errors import ServiceError
from backend.app.main import create_app
from backend.app.services.metagame import MetagameService


@pytest.fixture
def meta():
    service = MetagameService()
    catalog = SimpleNamespace(items={
        "one": SimpleNamespace(name_en="Test-Mon", name_ko="합성 포켓몬", pokemon_id="one", images=None, names={"ko": "합성 포켓몬"}, slugs={"ko": "합성-포켓몬"})
    }, details={"move_details": [{"name": "test-move", "name_ko": "합성 기술"}]}, battle_names={})
    index = {"seasons": [
        {"season": "M1", "dates": ["01_10_2026"], "formats": ["Singles"]},
        {"season": "M2", "dates": ["24_10_2026"], "formats": ["Singles"]},
    ]}
    snapshot = {
        "season": "M2", "date": "24_10_2026", "format": "Singles",
        "generatedAt": "2026-10-24T00:00:00Z", "pokemon": {
            "Test-Mon": {"position": 2, "move": [["Test Move", 0, 1], ["Unknown", None, 2]], "ability": []},
            "Test-Mon-New-Form": {"position": 1, "held_item": [["Test Item", 100, 1]]},
            "No rank": {"move": [["Test Move", 10, 1]]},
        },
    }
    calls = []

    def fetch(path):
        calls.append(path)
        return deepcopy(index if path.endswith("index.json") else snapshot)

    service._fetch = fetch
    return SimpleNamespace(service=service, catalog=catalog, calls=calls, snapshot=snapshot)


def test_latest_singles_rank_and_localized_sets_without_form_guess(meta):
    result = meta.service.singles(meta.catalog)
    assert result["data_date"] == "2026-10-24"
    assert meta.calls[-1] == "/data/meta/M2/24_10_2026/Singles.json"
    assert result["regulation_id"] is None
    assert [row["rank"] for row in result["items"]] == [1, 2]
    assert result["items"][0]["pokemon_id"] is None
    moves = result["items"][1]["groups"][0]["items"]
    assert moves[0]["name_ko"] == "합성 기술"
    assert moves[0]["percentage"] == 0
    assert moves[1]["percentage"] is None
    assert "usage_rate" not in result["items"][0]


def test_cache_limit_and_no_mutation(meta):
    meta.service.singles(meta.catalog, 1)
    assert len(meta.service.singles(meta.catalog)["items"]) == 2
    assert len(meta.calls) == 2


def test_real_names_and_image_metadata_are_connected_without_changing_percentages(meta):
    from pathlib import Path

    from backend.app.catalog import Catalog

    catalog = Catalog(Path(__file__).resolve().parents[2] / "data/pokemon.json")
    meta.snapshot["pokemon"] = {"Garchomp": {"position": 1,
        "held_item": [["Choice Scarf", 21.8, 1], ["Garchompite Z", 37.3, 2], ["Unknown Item", None, 3]],
        "stat_alignment": [["Jolly", 42, "Speed", "Sp. Atk", 1]],
    }}
    result = meta.service.singles(catalog)
    pokemon = result["items"][0]
    assert pokemon["pokemon_id"] == "pokemon:445"
    assert pokemon["names"]["ja"] == "ガブリアス"
    assert pokemon["slugs"]["ko"] == "한카리아스"
    assert pokemon["images"]["sprite_url"].endswith("/445.png")
    groups = {group["category"]: group["items"] for group in pokemon["groups"]}
    assert [x["name_ko"] for x in groups["held_item"]] == ["구애스카프", "한카리아스나이트Z", None]
    assert groups["held_item"][0]["percentage"] == 21.8
    assert groups["stat_alignment"][0]["name_ko"] == "명랑"
    assert len(catalog.battle_names["stat_alignment"]) == 25
    assert len(result["name_sources"]) == 4
    assert result["name_licence_url"].endswith("LICENSE.md")


def test_failed_refresh_serves_bounded_stale_then_expires(meta):
    original = meta.service.singles(meta.catalog)
    meta.service.cached_at -= meta.service.ttl + 1

    def failure(path):
        meta.calls.append(path)
        raise ValueError("Provider failed")

    meta.service._fetch = failure
    stale = meta.service.singles(meta.catalog)
    assert stale["stale"] is True
    assert stale["collected_at"] == original["collected_at"]
    meta.service.singles(meta.catalog)
    assert len(meta.calls) == 3  # Failure cooldown prevents a request storm.
    meta.service.cached_at -= meta.service.max_age
    with pytest.raises(ServiceError) as error:
        meta.service.singles(meta.catalog)
    assert error.value.status == 503
    assert meta.service.cached is None


@pytest.mark.parametrize("change", [
    {"format": "Doubles"}, {"pokemon": {}}, {"date": "23_10_2026"},
])
def test_invalid_upstream_does_not_become_ranking(meta, change):
    meta.snapshot.update(change)
    with pytest.raises(ServiceError, match="메타 데이터를"):
        meta.service.singles(meta.catalog)


def test_route_contract_and_limit_validation(meta):
    app = create_app(Settings(), service=SimpleNamespace(catalog=meta.catalog))
    app.state.metagame = meta.service
    client = TestClient(app)
    response = client.get("/api/meta/singles?limit=1")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["dataDate"] == "2026-10-24"
    assert len(data["items"]) == 1
    assert data["sourceUrl"] == "https://championsbattledata.com"
    assert response.headers["Cache-Control"] == "no-store"
    assert client.get("/api/meta/singles?limit=31").status_code == 422
    assert client.get("/api/meta/singles?limit=0").status_code == 422


@pytest.mark.parametrize("status, chunks", [
    (302, [b"{}"]), (429, [b"{}"]), (200, [b"x" * 2_000_001]), (200, [b"not-json"]),
])
def test_provider_reads_reject_redirects_limits_and_bad_payload(monkeypatch, status, chunks):
    class Response:
        status_code = status

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def iter_content(self, size):
            return iter(chunks)

    def get(url, **kwargs):
        assert url == "https://championsbattledata.com/data/meta/index.json"
        assert kwargs["allow_redirects"] is False
        assert kwargs["timeout"] == (5, 15)
        return Response()

    monkeypatch.setattr("backend.app.services.metagame.requests.get", get)
    with pytest.raises(ValueError):
        MetagameService()._fetch("/data/meta/index.json")


def test_meta_returns_localized_reference_names_without_replacing_provider_identifiers(meta):
    meta.catalog.details["localization"] = {"move": {"test-move": {"en": "Test Move", "ja": "テスト技", "zh": "测试招式"}}}
    result = meta.service.singles(meta.catalog)
    entry = next(p for p in result["items"] if p["pokemon_id"] == "one")["groups"][0]["items"][0]
    assert entry["name"] == "Test Move"
    assert entry["names"]["ja"] == "テスト技"
