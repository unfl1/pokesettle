from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from backend.discovery import discover
from backend.errors import ServiceError
from backend.main import create_app
from backend.models import ChatRequest, DiscoveryPlan, DiscoveryRequest


def chat(pokemon_id, conversation_id=None):
    return ChatRequest(
        pokemon_id=pokemon_id,
        question=f"{pokemon_id}의 특징",
        client_request_id=uuid4(),
        conversation_id=conversation_id,
    )


def plan(setup, filters, **changes):
    setup.model.discovery_plan = DiscoveryPlan(
        filters=filters,
        requires_clarification=False,
        unresolved_conditions=[],
        explanation="테스트 조건",
        **changes,
    )


def test_history_a_b_a_reload_pagination_and_ownership(setup):
    with TestClient(create_app(setup.settings, service=setup.service)) as client:
        assert client.get("/api/conversations?pokemonId=pokemon:1").status_code == 401
        client.post("/api/session")
        owner = client.cookies.get("pokecoach_session")
        a = setup.service.chat(chat("pokemon:1"), owner)["conversation_id"]
        b = setup.service.chat(chat("pokemon:2"), owner)["conversation_id"]
        setup.service.chat(chat("pokemon:1", a), owner)
        assert a != b
        listing = client.get("/api/conversations?pokemonId=pokemon:1").json()["data"]
        assert listing["total"] == 1
        assert listing["items"][0]["messageCount"] == 4
        messages = client.get(f"/api/conversations/{a}/messages?limit=2&offset=2").json()["data"]
        assert messages["total"] == 4
        assert [m["role"] for m in messages["items"]] == ["user", "assistant"]
        assert messages["items"][1]["content"]["citations"][0]["sourceUrl"].startswith("https://")
        fresh = client.post("/api/conversations", json={"pokemonId": "pokemon:1"}).json()["data"]
        assert fresh["conversationId"] != a
        assert (
            client.get(f"/api/conversations/{fresh['conversationId']}/messages").json()["data"][
                "total"
            ]
            == 0
        )
        assert (
            client.get("/api/conversations?pokemonId=pokemon:1&limit=1&offset=1").json()["data"][
                "items"
            ][0]["conversationId"]
            == a
        )
        client.cookies.set("pokecoach_session", setup.store.new_session())
        assert client.get(f"/api/conversations/{a}/messages").status_code == 404
        assert client.get("/api/conversations?pokemonId=pokemon:1").json()["data"]["total"] == 0
        client.cookies.set("pokecoach_session", owner)
        assert client.get(f"/api/conversations/{a}/messages").json()["data"]["total"] == 4


def test_guide_is_grounded_persisted_and_scope_checked(setup):
    with TestClient(create_app(setup.settings, service=setup.service)) as client:
        client.post("/api/session")
        body = {"clientRequestId": str(uuid4())}
        response = client.post("/api/pokemon/pokemon:1/guide", json=body)
        assert response.status_code == 202
        result = client.get(response.json()["data"]["statusUrl"]).json()["data"]["result"]
        assert result["feature"] == "pokemon_guide"
        assert result["guideScope"] == "generic_reference"
        assert result["citations"] and result["guideLimitations"]
        history = client.get(f"/api/conversations/{result['conversationId']}/messages").json()[
            "data"
        ]["items"]
        assert history[0]["content"] == "근거 기반 운용 가이드를 작성해 줘."
        generation_payload = next(
            payload for purpose, payload in setup.model.calls if purpose == "generate"
        )
        assert "추측하지 마세요" in generation_payload["question"]
        assert history[1]["content"]["feature"] == "pokemon_guide"
        assert (
            client.post("/api/pokemon/pokemon:1/guide", json=body).json()["data"]["jobId"]
            == response.json()["data"]["jobId"]
        )
        assert (
            client.post(
                "/api/pokemon/pokemon:2/guide",
                json={**body, "conversationId": result["conversationId"]},
            ).status_code
            == 409
        )


def test_discovery_checks_entire_catalog_exact_boundaries_and_paging(setup):
    for p in setup.catalog.items.values():
        p.types = ["electric"] if p.species_id % 2 == 0 else ["water"]
        p.base_stats.speed = p.species_id
    plan(
        setup,
        [
            {"field": "types", "operator": "eq", "value": "electric"},
            {"field": "base_stats.speed", "operator": "gte", "value": "90"},
        ],
    )
    result = discover(
        setup.service, DiscoveryRequest(query="전기 타입 스피드 종족값 90 이상", limit=2)
    )
    assert result["total"] == 6
    assert len(result["items"]) == 2
    assert all(
        p["base_stats"]["speed"] >= 90 and p["types"] == ["electric"] for p in result["items"]
    )
    assert result["items"][0]["supporting_evidence_ids"]
    assert (
        discover(setup.service, DiscoveryRequest(query="90 이상", offset=100))["status"]
        == "matched"
    )
    with TestClient(create_app(setup.settings, service=setup.service)) as client:
        assert client.post("/api/pokemon/search", json={"query": "90 이상"}).status_code == 401
        client.post("/api/session")
        data = client.post("/api/pokemon/search", json={"query": "90 이상"}).json()["data"]
        assert data["total"] == 6
        assert "spAttack" in data["items"][0]["baseStats"]


def test_discovery_vague_unsupported_unknown_and_empty(setup):
    result = discover(setup.service, DiscoveryRequest(query="빠르고 땅 무효인 포켓몬"))
    assert result["status"] == "needs_clarification" and result["items"] == []
    plan(setup, [{"field": "base_stats.speed", "operator": "gte", "value": "100"}])
    assert (
        discover(setup.service, DiscoveryRequest(query="빠른 포켓몬"))["status"]
        == "needs_clarification"
    )
    assert (
        discover(setup.service, DiscoveryRequest(query="스피드 100 이상"))["status"] == "no_results"
    )
    plan(setup, [{"field": "champions_eligibility_status", "operator": "eq", "value": "eligible"}])
    result = discover(setup.service, DiscoveryRequest(query="사용 가능"))
    assert result["items"] == [] and result["excluded_unknown_count"] == 100
    plan(
        setup,
        [{"field": "champions_eligibility_status", "operator": "contains", "value": "eligible"}],
    )
    with pytest.raises(ServiceError):
        discover(setup.service, DiscoveryRequest(query="사용 가능"))
    plan(setup, [{"field": "name", "operator": "contains", "value": ""}])
    with pytest.raises(ServiceError):
        discover(setup.service, DiscoveryRequest(query="이름"))


def test_discovery_failure_is_safe_and_extra_input_rejected(setup):
    with TestClient(
        create_app(setup.settings, service=setup.service), raise_server_exceptions=False
    ) as client:
        client.post("/api/session")
        assert (
            client.post(
                "/api/pokemon/search", json={"query": "전기", "apiKey": "private"}
            ).status_code
            == 422
        )
        setup.model.fail = True
        response = client.post("/api/pokemon/search", json={"query": "전기"})
        assert response.status_code == 500
        assert "SECRET_TEST_TOKEN" not in response.text
        assert "full prompt" not in response.text
