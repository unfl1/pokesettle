import json
import os
import shutil
import subprocess
from dataclasses import replace
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.app.battle.damage import DamageInput, calculate_damage
from backend.app.catalog import Catalog
from backend.app.core.config import ROOT, Settings
from backend.app.core.errors import ServiceError
from backend.app.main import create_app


def request_body(**changes):
    def member(pid, points):
        return {
            "pokemonId": pid,
            "statPoints": {
                "hp": 0,
                "attack": 0,
                "defense": 0,
                "spAttack": points,
                "spDefense": 0,
                "speed": 0,
            },
            "alignment": "Hardy",
        }

    return {
        "attacker": member("pokemon:25", 32),
        "defender": member("pokemon:9", 0),
        "move": "Thunderbolt",
        "neutralConditions": True,
        **changes,
    }


@pytest.fixture(scope="module")
def actual_engine():
    executable = shutil.which(os.getenv("DAMAGE_NODE_BINARY", "node"))
    if not executable or not (ROOT / "backend/calculator/node_modules/@smogon/calc").exists():
        pytest.skip("실제 계산 통합 테스트: Node.js·backend/calculator 의존성 설치 필요")
    return Settings(damage_node_binary=executable), Catalog(ROOT / "data/pokemon.json")


@pytest.mark.parametrize("value", [-1, 33, 252, True, 1.5, "32"])
def test_stat_points_reject_mainline_evs_and_coercion(value):
    body = request_body()
    body["attacker"]["statPoints"]["spAttack"] = value
    with pytest.raises(ValidationError):
        DamageInput.model_validate(body)


def test_total_points_unknown_alignment_and_effects_are_not_silently_accepted():
    body = request_body()
    body["attacker"]["statPoints"].update(hp=32, attack=32)
    with pytest.raises(ValidationError, match="66"):
        DamageInput.model_validate(body)
    for field, value in [
        ("neutralConditions", False),
        ("neutralConditions", "true"),
        ("weather", "Sun"),
    ]:
        with pytest.raises(ValidationError):
            DamageInput.model_validate(request_body(**{field: value}))
    body = request_body()
    body["attacker"]["alignment"] = "invented-alignment"
    with pytest.raises(ValidationError):
        DamageInput.model_validate(body)
    body = request_body()
    body["defender"]["ability"] = "Disguise"
    with pytest.raises(ValidationError):
        DamageInput.model_validate(body)


def test_reference_damage_distribution_and_actual_stats(actual_engine):
    settings, catalog = actual_engine
    result = calculate_damage(DamageInput.model_validate(request_body()), catalog, settings)
    damage = result["calculation"]["damage"]
    # Pinned reference-package regression, not a claim about an independent game measurement.
    assert (damage["minimum"], damage["maximum"]) == (84, 102)
    assert len(damage["rolls"]) == 16
    assert damage["attacker_stats"]["sp_attack"] == 102
    assert damage["defender_stats"]["hp"] == 154
    assert result["engine"]["generation"] == 0
    assert result["engine"]["level"] == 50
    assert result["in_game_verified"] is result["legality_verified"] is False
    assert result["calculation"]["ko_probability"] is None
    assert result["calculation"]["win_probability"] is None


def test_immunity_and_increased_attack_scenario(actual_engine):
    settings, catalog = actual_engine
    base = request_body()
    base["attacker"]["statPoints"]["spAttack"] = 0
    low = calculate_damage(DamageInput.model_validate(base), catalog, settings)["calculation"][
        "damage"
    ]
    high = calculate_damage(DamageInput.model_validate(request_body()), catalog, settings)[
        "calculation"
    ]["damage"]
    assert high["minimum"] >= low["minimum"] and high["maximum"] >= low["maximum"]
    base["defender"]["pokemonId"] = "pokemon:445"
    immune = calculate_damage(DamageInput.model_validate(base), catalog, settings)["calculation"][
        "damage"
    ]
    assert immune["rolls"] == [0] * 16


def test_neutral_scenario_does_not_restore_default_levitate(actual_engine):
    settings, catalog = actual_engine
    body = request_body(move="Earthquake")
    body["attacker"]["pokemonId"] = "pokemon:445"
    body["defender"]["pokemonId"] = "pokemon:10009"
    result = calculate_damage(DamageInput.model_validate(body), catalog, settings)
    assert result["calculation"]["damage"]["minimum"] > 0
    assert any("특성" in assumption for assumption in result["assumptions"])


@pytest.mark.parametrize("move", ["Swords Dance", "Double Slap", "Flail", "invented move"])
def test_unsupported_status_multihit_or_variable_power_moves(actual_engine, move):
    settings, catalog = actual_engine
    with pytest.raises(ServiceError) as error:
        calculate_damage(DamageInput.model_validate(request_body(move=move)), catalog, settings)
    assert error.value.status == 422


def test_missing_runtime_is_safe_and_does_not_install_dependencies():
    body = DamageInput.model_validate(request_body())
    catalog = Catalog(ROOT / "data/pokemon.json")
    with pytest.raises(ServiceError) as error:
        calculate_damage(body, catalog, Settings(damage_node_binary="/nonexistent/node"))
    assert error.value.code == "DAMAGE_ENGINE_NOT_READY"


@pytest.mark.parametrize("failure", ["timeout", "stderr", "invalid_json", "invalid_rolls"])
def test_worker_errors_are_sanitized_and_secrets_not_forwarded(monkeypatch, failure):
    monkeypatch.setattr("backend.app.battle.damage.shutil.which", lambda _: "/fake/node")
    monkeypatch.setenv("OPENAI_API_KEY", "SECRET_TEST_VALUE")

    def run(args, **kwargs):
        assert kwargs["env"] == {"PATH": os.defpath}
        if failure == "timeout":
            raise subprocess.TimeoutExpired(args, 5, output="SECRET_TEST_VALUE")
        if failure == "invalid_rolls":
            stdout = json.dumps({"ok": True, "result": {"rolls": [-1] * 16}})
        else:
            stdout = "SECRET_TEST_VALUE"
        return SimpleNamespace(returncode=1 if failure == "stderr" else 0, stdout=stdout)

    monkeypatch.setattr("backend.app.battle.damage.subprocess.run", run)
    with pytest.raises(ServiceError) as error:
        calculate_damage(
            DamageInput.model_validate(request_body()),
            Catalog(ROOT / "data/pokemon.json"),
            Settings(),
        )
    assert "SECRET" not in str(error.value)


def test_api_auth_validation_and_no_model_or_vector_requirement(setup, actual_engine):
    settings, catalog = actual_engine
    setup.service.catalog = catalog
    no_model = replace(
        setup.settings, api_key="", chat_model="", damage_node_binary=settings.damage_node_binary
    )
    setup.vectors.meta.delete(ids=setup.vectors.meta.get()["ids"])
    with TestClient(create_app(no_model, service=setup.service)) as client:
        assert client.post("/api/battle/damage", json=request_body()).status_code == 401
        client.post("/api/session")
        response = client.post("/api/battle/damage", json=request_body())
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["inGameVerified"] is False
        assert data["calculation"]["damage"]["attackerStats"]["spAttack"] == 102
        assert data["calculation"]["koProbability"] is None
        assert (
            client.post("/api/battle/damage", json=request_body(terrain="Electric")).status_code
            == 422
        )
        assert (
            client.post("/api/battle/damage", json=request_body(move="Double Slap")).status_code
            == 422
        )
    assert setup.model.calls == []
