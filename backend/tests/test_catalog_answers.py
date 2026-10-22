from dataclasses import replace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from backend.app.catalog import Catalog
from backend.app.core.config import ROOT
from backend.app.main import create_app
from backend.app.services.catalog_answers import answer_catalog, catalog_question


@pytest.mark.parametrize(
    "question",
    [
        "피카츄 타입 뭐야?",
        "피카츄의 종족값 알려줘",
        "이 포켓몬의 타입과 특성 이름을 알려줘.",
        "이 포켓몬의 도감 설명을 출처와 함께 알려줘.",
    ],
)
def test_catalog_question_routes_explicit_field_requests(question):
    assert catalog_question(Catalog(ROOT / "data/pokemon.json"), "pokemon:25", question)


@pytest.mark.parametrize(
    "question",
    [
        "피카츄와 갸라도스 타입 상성 알려줘",
        "피카츄 타입이 유리한 이유?",
        "피카츄 특성 활용법 알려줘",
        "피카츄 어떻게 키워?",
        "피카츄 기술 추천해줘",
    ],
)
def test_catalog_route_does_not_swallow_strategy(question):
    assert catalog_question(Catalog(ROOT / "data/pokemon.json"), "pokemon:25", question) is None


def test_direct_catalog_without_model_or_vectors_persists_and_api_accepts(setup, monkeypatch):
    setup.service.catalog = Catalog(ROOT / "data/pokemon.json")
    settings = replace(setup.settings, api_key="", chat_model="")
    setup.model.fail = True
    setup.vectors.meta.delete(ids=setup.vectors.meta.get()["ids"])
    monkeypatch.setattr(
        setup.service, "collect", lambda *args: pytest.fail("도감 응답에서 문서 수집 호출")
    )
    with TestClient(create_app(settings, service=setup.service)) as client:
        client.post("/api/session")
        result = client.post(
            "/api/chat",
            json={
                "pokemonId": "pokemon:25",
                "question": "피카츄의 타입과 특성 이름을 알려줘.",
                "clientRequestId": str(uuid4()),
            },
        )
        assert result.status_code == 202
        data = client.get(result.json()["data"]["statusUrl"]).json()["data"]["result"]
        assert data["answerPath"] == "catalog_direct"
        assert "전기" in data["answer"] and "static" in data["answer"]
        history = client.get(f"/api/conversations/{data['conversationId']}/messages").json()[
            "data"
        ]["items"]
        assert len(history) == 2
        assert history[-1]["content"]["feature"] == "catalog_reference"
        rejected = client.post(
            "/api/chat",
            json={
                "pokemonId": "pokemon:25",
                "question": "피카츄 운용 방법",
                "clientRequestId": str(uuid4()),
            },
        )
        assert rejected.status_code == 503
    assert setup.model.calls == []


def test_missing_local_move_data_is_not_invented():
    pokemon = Catalog(ROOT / "data/pokemon.json").get("pokemon:25")
    result = answer_catalog(pokemon, {"moves"})
    assert result["answer_status"] == "abstained"
    assert "현재 로컬 도감" in result["answer"]
