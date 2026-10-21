from dataclasses import replace
from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.core.config import ROOT, Settings
from backend.app.main import create_app


def test_default_paths_still_resolve_to_repository_root():
    repository_root = Path(__file__).resolve().parents[2]
    assert ROOT == repository_root
    assert Settings().data_dir == repository_root / "data"
    assert Settings().runtime_dir == repository_root / "runtime"


def test_routers_use_each_app_settings_without_global_state(setup):
    unconfigured = replace(setup.settings, api_key="", chat_model="")
    with (
        TestClient(create_app(setup.settings, service=setup.service)) as ready,
        TestClient(create_app(unconfigured, service=setup.service)) as missing,
    ):
        assert ready.get("/api/status").json()["data"]["modelConfigured"] is True
        assert missing.get("/api/status").json()["data"]["modelConfigured"] is False
        assert ready.get("/api/status").json()["data"]["modelConfigured"] is True


def test_battle_session_checked_before_loading_type_chart(setup):
    # The fixture intentionally has no type chart.
    body = {"own": [{"pokemonId": "pokemon:1"}], "opponent": [{"pokemonId": "pokemon:2"}]}
    with TestClient(create_app(setup.settings, service=setup.service)) as client:
        for path in (
            "/api/teams/analyze",
            "/api/teams/select",
            "/api/battle/analyze",
            "/api/battle/recommend",
        ):
            response = client.post(path, json=body)
            assert response.status_code == 401
            assert response.json()["error"]["code"] == "SESSION_REQUIRED"
        client.post("/api/session")
        response = client.post("/api/battle/analyze", json=body)
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "TYPE_CHART_NOT_READY"
