from dataclasses import replace
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.app.main import create_app
from backend.app.schemas import ChatRequest


def request_body(**changes):
    return {
        "pokemonId": "pokemon:1",
        "question": "test question",
        "clientRequestId": str(uuid4()),
        **changes,
    }


def test_api_end_to_end_jobs_idempotency_and_camel_case(setup):
    with TestClient(create_app(setup.settings, service=setup.service)) as client:
        assert client.get("/api/status").json()["data"]["metadataCount"] == 100
        assert client.post("/api/chat", json=request_body()).status_code == 401
        session = client.post("/api/session")
        assert "HttpOnly" in session.headers["set-cookie"]
        body = request_body()
        response = client.post("/api/chat", json=body)
        assert response.status_code == 202
        job = client.get(response.json()["data"]["statusUrl"]).json()["data"]
        assert job["status"] == "completed", job
        assert job["result"]["citations"][0]["sourceType"] == "metadata"
        assert job["result"]["conversationId"]
        repeated = client.post("/api/chat", json=body)
        assert repeated.json()["data"]["jobId"] == response.json()["data"]["jobId"]
        assert client.post("/api/chat", json={**body, "question": "changed"}).status_code == 409
        assert client.get("/api/pokemon?type=test-type&limit=2").json()["data"]["total"] == 100
        assert client.get("/api/pokemon?unknownFilter=1").status_code == 422
        assert client.get("/api/pokemon/pokemon:1").json()["data"]["baseStats"]["spAttack"] == 50
        assert client.get("/api/regulations").status_code == 200


def test_api_keys_empty_index_input_origin_and_safe_errors(setup):
    settings = replace(setup.settings, api_key="", chat_model="")
    with TestClient(create_app(settings, service=setup.service)) as client:
        client.post("/api/session")
        assert (
            client.post("/api/chat", json=request_body()).json()["error"]["code"]
            == "MODEL_KEY_MISSING"
        )
        assert client.post("/api/chat", json=request_body(question="  ")).status_code == 422
        assert (
            client.post("/api/chat", json=request_body(apiKey="SECRET_TEST_TOKEN")).status_code
            == 422
        )
        assert (
            "SECRET_TEST_TOKEN"
            not in client.post("/api/chat", json=request_body(apiKey="SECRET_TEST_TOKEN")).text
        )
        assert (
            client.post("/api/session", headers={"Origin": "https://untrusted.example"}).status_code
            == 403
        )
        assert client.post("/api/chat", json=request_body(regulationId="bogus")).status_code == 422
        assert client.get("/api/pokemon/missing").status_code == 404
        assert client.post("/api/pokemon/search", json={}).status_code == 422
        setup.vectors.meta.delete(ids=setup.vectors.meta.get()["ids"])
        assert (
            client.post("/api/chat", json=request_body()).json()["error"]["code"]
            == "INDEX_NOT_READY"
        )


def test_job_failure_does_not_expose_raw_provider_error(setup):
    setup.model.fail = True
    with TestClient(create_app(setup.settings, service=setup.service)) as client:
        client.post("/api/session")
        response = client.post("/api/chat", json=request_body())
        job = client.get(response.json()["data"]["statusUrl"])
        assert job.json()["data"]["status"] == "failed"
        assert "SECRET_TEST_TOKEN" not in job.text
        assert "full prompt" not in job.text


def test_session_and_pokemon_conversation_isolation(setup):
    session_a, session_b = setup.store.new_session(), setup.store.new_session()
    first = setup.service.chat(ChatRequest(**request_body()), session_a)
    second = setup.service.chat(ChatRequest(**request_body(pokemonId="pokemon:2")), session_a)
    assert first["conversation_id"] != second["conversation_id"]
    with TestClient(create_app(setup.settings, service=setup.service)) as client:
        client.cookies.set("pokecoach_session", session_b)
        response = client.post(
            "/api/chat", json=request_body(conversationId=first["conversation_id"])
        )
        assert response.status_code == 404
        client.cookies.set("pokecoach_session", session_a)
        response = client.post(
            "/api/chat",
            json=request_body(pokemonId="pokemon:2", conversationId=first["conversation_id"]),
        )
        assert response.status_code == 409
        job_id, _ = setup.store.create_job(session_a, "collect", str(uuid4()), {})
        setup.store.update_job(job_id, status="running", stage="collecting")
        assert client.get(f"/api/jobs/{job_id}").json()["data"]["stage"] == "collecting"
        client.cookies.set("pokecoach_session", session_b)
        assert client.get(f"/api/jobs/{job_id}").status_code == 404
    setup.store.recover_jobs()
    assert setup.store.job(job_id, session_a)["status"] == "interrupted"
