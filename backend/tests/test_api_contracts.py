"""Guard HTTP contracts, response validation, and shared session enforcement."""

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from backend.app.api.dependencies import get_session, get_store
from backend.app.api.schemas import ErrorResponse
from backend.app.main import create_app
from backend.tests.conftest import wait_for_job


def test_openapi_describes_all_success_bodies_status_codes_and_safe_errors():
    spec = create_app().openapi()
    operations = [
        (path, method, operation)
        for path, item in spec["paths"].items()
        for method, operation in item.items()
        if method in {"get", "post", "put", "delete"}
    ]
    assert len(operations) == 26
    created = {"/api/teams", "/api/conversations"}
    accepted = {"/api/chat", "/api/documents/collect", "/api/pokemon/{pokemon_id}/guide"}
    for path, method, operation in operations:
        status = (
            "204"
            if method == "delete"
            else (
                "201"
                if method == "post" and path in created
                else "202"
                if method == "post" and path in accepted
                else "200"
            )
        )
        success = operation["responses"][status]
        assert operation["tags"]
        assert {code for code in operation["responses"] if code.startswith("2")} == {status}
        if status == "204":
            assert "content" not in success
        else:
            model = success["content"]["application/json"]["schema"]
            envelope = spec["components"]["schemas"][model["$ref"].split("/")[-1]]
            assert set(envelope["properties"]) == {"data", "requestId", "warnings"}
            assert "$ref" in envelope["properties"]["data"]
        for code in ("403", "405", "422", "500"):
            assert operation["responses"][code]["content"]["application/json"]["schema"] == {
                "$ref": "#/components/schemas/ErrorResponse"
            }
    parameters = spec["paths"]["/api/teams"]["get"]["parameters"]
    assert any(p["in"] == "cookie" and p["name"] == "pokecoach_session" for p in parameters)


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/teams"),
        ("post", "/api/teams"),
        ("get", "/api/teams/unknown"),
        ("put", "/api/teams/unknown"),
        ("delete", "/api/teams/unknown"),
        ("post", "/api/teams/analyze"),
        ("post", "/api/teams/select"),
        ("get", "/api/conversations"),
        ("post", "/api/conversations"),
        ("get", "/api/conversations/unknown/messages"),
        ("delete", "/api/conversations/unknown"),
        ("post", "/api/chat"),
        ("post", "/api/documents/collect"),
        ("get", "/api/jobs/unknown"),
        ("post", "/api/pokemon/search"),
        ("post", "/api/pokemon/pokemon:1/guide"),
        ("get", "/api/battle/damage/moves/pokemon:1"),
        ("post", "/api/battle/damage"),
        ("post", "/api/battle/analyze"),
        ("post", "/api/battle/recommend"),
    ],
)
def test_every_private_operation_uses_session_dependency(method, path):
    app = create_app()
    # No DB/model/calculator: authentication must stop the request first.
    app.dependency_overrides[get_store] = lambda: SimpleNamespace(session_valid=lambda _: False)
    client = TestClient(app)
    response = client.request(method, path, json={})
    assert response.status_code == 401
    assert ErrorResponse.model_validate(response.json()).error.code == "SESSION_REQUIRED"


def test_invalid_response_is_rejected_without_exposing_internal_values():
    app = create_app()
    app.dependency_overrides[get_session] = lambda: "synthetic-session"
    app.dependency_overrides[get_store] = lambda: SimpleNamespace(
        teams=lambda _: {"items": [{"team_id": "PRIVATE_INTERNAL_VALUE"}], "total": 1}
    )
    response = TestClient(app, raise_server_exceptions=False).get("/api/teams")
    assert response.status_code == 500
    assert ErrorResponse.model_validate(response.json()).error.code == "INTERNAL_ERROR"
    assert "PRIVATE_INTERNAL_VALUE" not in response.text
    assert "validation" not in response.text.lower()


def test_runtime_cookie_job_location_and_bodyless_delete_keep_their_contract(setup):
    with TestClient(create_app(setup.settings, service=setup.service)) as client:
        session = client.post("/api/session")
        assert session.status_code == 200
        assert session.json()["data"] == {"active": True}
        assert "HttpOnly" in session.headers["set-cookie"]
        assert "SameSite=lax" in session.headers["set-cookie"]
        cookie = client.cookies.get("pokecoach_session")
        client.post("/api/session")
        assert client.cookies.get("pokecoach_session") == cookie
        team = client.post("/api/teams", json={"name": "계약 검증", "members": []})
        assert team.status_code == 201
        assert team.json()["data"]["members"] == []
        deleted = client.delete(f"/api/teams/{team.json()['data']['teamId']}")
        assert deleted.status_code == 204
        assert deleted.content == b""
        job = client.post(
            "/api/documents/collect",
            json={
                "pokemonId": "pokemon:1",
                "question": "설명",
                "clientRequestId": str(uuid4()),
            },
        )
        assert job.status_code == 202
        assert job.headers["location"] == job.json()["data"]["statusUrl"]
        result = wait_for_job(client, job.headers["location"])
        assert result.status_code == 200
        assert result.json()["data"]["status"] == "completed"
        for response in (session, team, job, result):
            assert set(response.json()) == {"data", "requestId", "warnings"}
            assert response.json()["requestId"] == response.headers["x-request-id"]


def test_documented_error_envelope_matches_validation_origin_and_http_errors(setup):
    with TestClient(create_app(setup.settings, service=setup.service)) as client:
        client.post("/api/session")
        invalid = client.post("/api/teams", json={"name": "", "members": []})
        forbidden = client.post("/api/teams", headers={"Origin": "https://untrusted.example"})
        wrong_method = client.patch("/api/teams")
        missing = client.get("/api/not-a-route")
        for response, status in (
            (invalid, 422),
            (forbidden, 403),
            (wrong_method, 405),
            (missing, 404),
        ):
            assert response.status_code == status
            ErrorResponse.model_validate(response.json())
        assert invalid.json()["error"]["details"][0]["field"] == "body.name"
        assert "GET" in wrong_method.headers["allow"] or "POST" in wrong_method.headers["allow"]
