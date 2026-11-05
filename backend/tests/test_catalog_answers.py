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
        assert data["catalogNavigation"]["pokemon"]["pokemonId"] == "pokemon:25"
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


@pytest.mark.parametrize("question,pokemon_id,move_type", [
    ("피카츄는 무슨 포켓몬이야?", "pokemon:25", None),
    ("피카츄는 뭐야?", "pokemon:25", None),
    ("불꽃기술은 뭐가 있어?", None, "fire"),
    ("피카츄 전기 기술 목록 알려줘", "pokemon:25", "electric"),
])
def test_catalog_navigation_without_model_is_saved(setup, monkeypatch, question, pokemon_id, move_type):
    from backend.app.schemas import ChatRequest
    setup.service.catalog = Catalog(ROOT / "data/pokemon.json")
    monkeypatch.setattr(setup.model, "invoke", lambda *args: pytest.fail("navigation must not invoke a model"))
    monkeypatch.setattr(setup.service, "collect", lambda *args: pytest.fail("navigation must not collect"))
    session_id = setup.store.new_session()
    result = setup.service.chat(ChatRequest(question=question, client_request_id=uuid4()), session_id)
    assert result["feature"] == "catalog_navigation"
    navigation = result["catalog_navigation"]
    assert (navigation["pokemon"]["pokemon_id"] if navigation["pokemon"] else None) == pokemon_id
    assert navigation["move_type"] == move_type
    if pokemon_id:
        followup = ChatRequest(question="이 포켓몬의 타입은?", conversation_id=result["conversation_id"], client_request_id=uuid4())
        # A named lookup retains the topic for subsequent questions.
        assert setup.service.chat_focus(followup, session_id) == pokemon_id
    assert setup.store.history(result["conversation_id"])[-1]["content"]["catalog_navigation"] == navigation


@pytest.mark.parametrize("question", [
    "피카츄는 뭐야? 그리고 파이썬 코드를 작성해줘",
    "불꽃 기술은 뭐가 있어? 그리고 노래 추천해줘",
    "피카츄 불꽃 기술 추천해줘",
    "피카츄와 갸라도스 중 누가 유리해?",
])
def test_navigation_does_not_bypass_scope_or_strategy(question):
    from backend.app.services.catalog_answers import catalog_navigation
    assert catalog_navigation(Catalog(ROOT / "data/pokemon.json"), None, question) is None


def test_navigation_api_works_without_model_and_does_not_consume_ai_quota(setup):
    setup.service.catalog = Catalog(ROOT / "data/pokemon.json")
    settings = replace(setup.settings, api_key="", chat_model="", usage_requests_per_minute=1)
    setup.model.fail = True
    with TestClient(create_app(settings, service=setup.service)) as client:
        client.post("/api/session")
        guard = client.app.state.usage
        lease = guard.begin(["occupied-session", "occupied-ip"])
        try:
            for question in ["피카츄는 뭐야?", "불꽃기술은 뭐가 있어?", "피카츄는 무슨 포켓몬이야?"]:
                response = client.post("/api/chat", json={"question": question, "clientRequestId": str(uuid4())})
                assert response.status_code == 202
                job = client.get(response.json()["data"]["statusUrl"]).json()["data"]
                assert job["status"] == "completed"
                assert job["result"]["catalogNavigation"]["section"] in {"profile", "moves"}
        finally:
            guard.finish(lease)
    assert setup.model.calls == []
