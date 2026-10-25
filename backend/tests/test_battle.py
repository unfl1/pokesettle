from itertools import combinations
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app.battle.engine import BattleEngine
from backend.app.battle.models import BattleInput, TeamAnalysis
from backend.app.core.errors import ServiceError
from backend.app.main import create_app
from backend.app.schemas import Pokemon
from backend.scripts.prepare_battle_data import build_chart
from backend.tests.conftest import record


@pytest.fixture
def battle_setup(setup):
    chart = Path(__file__).resolve().parents[2] / "data" / "type_chart.json"
    (setup.settings.data_dir / "type_chart.json").write_text(chart.read_text())
    rows = []
    for i, types in enumerate(
        [
            ["grass", "poison"],
            ["fire", "flying"],
            ["water"],
            ["electric"],
            ["ground"],
            ["normal"],
            ["ghost"],
        ],
        1,
    ):
        data = record(i)
        data["types"] = types
        rows.append(Pokemon(**data))
    mega = record(10002)
    mega.update(species_id=2, is_default=False, form_identifier="mega-x", types=["fire", "dragon"])
    rows.append(Pokemon(**mega))
    setup.catalog.items = {p.pokemon_id: p for p in rows}
    return setup


def member(i, **extra):
    return {"pokemon_id": f"pokemon:{i}", **extra}


def engine(setup):
    return BattleEngine(setup.catalog, setup.settings.data_dir)


def test_generic_type_chart_dual_types_and_immunity(battle_setup):
    e = engine(battle_setup)
    assert len(e.chart) == 18
    assert sum(len(v) for v in e.chart.values()) == 324
    assert e.multiplier("rock", ["fire", "flying"]) == 4
    assert e.multiplier("electric", ["ground", "water"]) == 0
    assert e.multiplier("normal", ["ghost"]) == 0
    assert e.multiplier("fire", ["water", "dragon"]) == 0.25
    assert e.multiplier("ghost", ["normal"]) == 0


def test_unknown_type_and_species_rejected(battle_setup):
    e = engine(battle_setup)
    for own, code in [
        ([member(2), member(10002)], "DUPLICATE_SPECIES"),
        ([member(999)], "POKEMON_NOT_FOUND"),
    ]:
        with pytest.raises(ServiceError) as error:
            e.team_analysis(TeamAnalysis(own=own, opponent=[member(3)]))
        assert error.value.code == code
    p = battle_setup.catalog.items["pokemon:1"]
    p.types = ["unverified-type"]
    with pytest.raises(ServiceError) as error:
        e.team_analysis(TeamAnalysis(own=[member(1)], opponent=[member(2)]))
    assert error.value.code == "UNSUPPORTED_TYPE"


def test_coverage_status_moves_and_assumption_boundary(battle_setup):
    e = engine(battle_setup)
    response = e.team_analysis(TeamAnalysis(own=[member(2)], opponent=[member(1)]))
    assert response["members"][0]["coverage"][0]["multiplier"] == 2
    assert any("技術" in t or "기술 미입력" in t for t in response["assumptions"])
    assert response["scope"] == "generic"
    assert response["regulation_id"] is None
    assert response["calculation"]["damage"] is None
    assert response["calculation"]["win_probability"] is None
    assert response["citations"]
    status = member(2, moves=[{"name": "회복 가정", "type": "normal", "category": "status"}])
    assert (
        e.team_analysis(TeamAnalysis(own=[status], opponent=[member(1)]))["members"][0]["coverage"][
            0
        ]["multiplier"]
        is None
    )


def test_selection_all_twenty_unique_subsets_and_stable_ties(battle_setup):
    body = TeamAnalysis(
        own=[member(i) for i in range(1, 7)], opponent=[member(i) for i in range(1, 7)]
    )
    e = engine(battle_setup)
    result = e.selection(body)
    assert result["candidate_count"] == 20
    actual = {tuple(c["pokemon_ids"]) for c in result["candidates"]}
    assert actual == set(combinations([f"pokemon:{i}" for i in range(1, 7)], 3))
    assert result == e.selection(body)
    assert result["score_kind"] == "heuristic_not_probability"
    assert [c["score"] for c in result["candidates"]] == sorted(
        (c["score"] for c in result["candidates"]), reverse=True
    )
    for c in result["candidates"]:
        assert c["lead_id"] in c["pokemon_ids"]
        parts = c["components"]
        assert (
            c["score"]
            == 2 * parts["covered_opponents"]
            + parts["resisted_scenarios"]
            - parts["shared_weakness_penalty"]
        )


def test_selection_needs_six_and_rejects_fainted_members(battle_setup):
    e = engine(battle_setup)
    with pytest.raises(ServiceError):
        e.selection(TeamAnalysis(own=[member(1)], opponent=[member(2)]))
    with pytest.raises(ServiceError):
        e.selection(
            TeamAnalysis(
                own=[member(i, hp_percent=0) for i in range(1, 7)],
                opponent=[member(i) for i in range(1, 7)],
            )
        )


def test_attack_switch_are_separate_not_a_certain_best_move(battle_setup):
    result = engine(battle_setup).battle(
        BattleInput(
            own=[
                member(2, moves=[{"name": "ほのお 仮定", "type": "fire"}]),
                member(5),
                member(3, hp_percent=0),
            ],
            opponent=[member(1)],
            opponent_attack_types=["electric"],
            switch_blocked=False,
        )
    )
    assert result["recommended_action"] is None
    assert result["recommendation_status"] == "insufficient_battle_information"
    attack = [a for a in result["options"] if a["kind"] == "attack"]
    switches = [a for a in result["options"] if a["kind"] == "switch"]
    assert attack[0]["multiplier"] == 2
    assert [(s["pokemon_id"], s["multiplier"]) for s in switches] == [("pokemon:5", 0)]
    assert all("probability" not in o for o in result["options"])


def test_trapped_fainted_and_invalid_active_states(battle_setup):
    e = engine(battle_setup)
    result = e.battle(
        BattleInput(
            own=[member(1, hp_percent=0), member(2)], opponent=[member(3)], switch_blocked=True
        )
    )
    assert result["options"] == []
    with pytest.raises(ServiceError):
        e.battle(BattleInput(own=[member(1)], opponent=[member(2)], own_active=3))
    with pytest.raises(ServiceError):
        e.battle(BattleInput(own=[member(1)], opponent=[member(2, hp_percent=0)]))


def test_mega_type_scenario_and_used_gate(battle_setup):
    e = engine(battle_setup)
    body = BattleInput(
        own=[member(2)],
        opponent=[member(3)],
        mega_target_id="pokemon:10002",
        mega_used=False,
        opponent_attack_types=["electric"],
    )
    result = e.battle(body)
    assert result["mega"]["status"] == "scenario_only"
    assert result["mega"]["type_comparison"] == [
        {"attack_type": "electric", "before": 2, "after": 0.5}
    ]
    assert result["recommended_action"] is None
    body.mega_used = True
    assert e.battle(body)["mega"]["type_comparison"] is None
    body.mega_used = False
    body.mega_target_id = "pokemon:1"
    with pytest.raises(ServiceError):
        e.battle(body)


def test_team_crud_isolated_by_session_survives_app_recreation(battle_setup):
    app = create_app(battle_setup.settings, service=battle_setup.service)
    owner, stranger = TestClient(app), TestClient(app)
    assert owner.get("/api/teams").status_code == 401
    owner.post("/api/session")
    stranger.post("/api/session")
    body = {"name": "<script>팀</script>", "members": [{"pokemonId": "pokemon:2"}]}
    response = owner.post("/api/teams", json=body)
    assert response.status_code == 201
    team_id = response.json()["data"]["teamId"]
    assert owner.get(f"/api/teams/{team_id}").json()["data"]["name"] == body["name"]
    assert stranger.get("/api/teams").json()["data"]["items"] == []
    for method, kwargs in [("get", {}), ("put", {"json": body}), ("delete", {})]:
        assert getattr(stranger, method)(f"/api/teams/{team_id}", **kwargs).status_code == 404
    body["name"] = "수정"
    assert owner.put(f"/api/teams/{team_id}", json=body).status_code == 200
    other = TestClient(create_app(battle_setup.settings, service=battle_setup.service))
    other.cookies.update(owner.cookies)
    assert other.get(f"/api/teams/{team_id}").json()["data"]["name"] == "수정"
    assert owner.delete(f"/api/teams/{team_id}").status_code == 204
    assert owner.get(f"/api/teams/{team_id}").status_code == 404


def test_api_validation_no_model_dependency_and_safe_errors(battle_setup):
    client = TestClient(create_app(battle_setup.settings, service=battle_setup.service))
    client.post("/api/session")
    calls = len(battle_setup.model.calls)
    body = {"own": [member(1)], "opponent": [member(2)]}
    assert (
        client.post("/api/teams/analyze", json=body).json()["data"]["calculation"]["status"]
        == "type_only"
    )
    for endpoint in ["/api/battle/analyze", "/api/battle/recommend"]:
        assert client.post(endpoint, json=body).status_code == 200
    assert len(battle_setup.model.calls) == calls
    for members in [
        [member(1)] * 2,
        [member(1)] * 7,
        [member(1, hpPercent=101)],
        [member(1, moves=[{"name": "x", "type": "made-up"}])],
    ]:
        assert (
            client.post("/api/teams", json={"name": "test", "members": members}).status_code == 422
        )
    assert client.post("/api/teams", json={"name": "  ", "members": []}).status_code == 422
    assert (
        client.put(
            "/api/teams/x", json={"name": "x"}, headers={"Origin": "https://bad.example"}
        ).status_code
        == 403
    )
    (battle_setup.settings.data_dir / "type_chart.json").unlink()
    assert (
        client.post("/api/teams/analyze", json=body).json()["error"]["code"]
        == "TYPE_CHART_NOT_READY"
    )


def test_bulk_chart_rejects_incomplete_relations():
    with pytest.raises(ValueError):
        build_chart([], [])
    with pytest.raises(ValueError):
        build_chart([{"id": str(i), "identifier": f"t{i}"} for i in range(1, 19)], [])


def test_opponent_fainted_selection_and_existing_mega_form(battle_setup):
    e = engine(battle_setup)
    with pytest.raises(ServiceError):
        e.selection(
            TeamAnalysis(
                own=[member(i) for i in range(1, 7)],
                opponent=[member(i, hp_percent=0) for i in range(1, 7)],
            )
        )
    response = e.battle(
        BattleInput(own=[member(10002)], opponent=[member(3)], mega_target_id="pokemon:10002")
    )
    assert response["mega"]["status"] == "already_mega_form"
    assert response["mega"]["type_comparison"] is None
    assert any("HP 미입력" in a for a in response["assumptions"])


def test_selection_plan_matches_calculated_candidates_and_type_evidence(battle_setup):
    e = engine(battle_setup)
    body = TeamAnalysis(
        own=[member(i) for i in range(1, 7)], opponent=[member(i) for i in range(1, 7)]
    )
    result = e.selection(body)
    plan = result["recommendation"]
    assert plan["pokemon_ids"] == result["candidates"][0]["pokemon_ids"]
    assert plan["lead_id"] == result["candidates"][0]["lead_id"]
    assert len(plan["matchups"]) == 6
    assert len(plan["members"]) == 3
    selected = set(plan["pokemon_ids"])
    for row in plan["matchups"]:
        enemy = battle_setup.catalog.get(row["opponent_id"])
        if row["attacker_id"]:
            assert row["attacker_id"] in selected
            assert row["attack_multiplier"] == e.multiplier(row["attack_type"], enemy.types)
        if row["pivot_id"]:
            assert row["pivot_id"] in selected - {plan["lead_id"]}
            assert row["pivot_multiplier"] <= 1
        if row["lead_action"] == "switch":
            assert row["lead_incoming_multiplier"] > 1
            assert row["pivot_id"]
    for role in plan["members"]:
        assert role["attack_assumed"] is True
        own_pokemon = battle_setup.catalog.get(role["pokemon_id"])
        for target in role["attack_targets"]:
            assert any(
                e.multiplier(t, battle_setup.catalog.get(target).types) > 1
                for t in own_pokemon.types
            )


def test_selection_plan_does_not_invent_attacks_for_status_only_team(battle_setup):
    body = TeamAnalysis(
        own=[
            member(i, moves=[{"name": "변화 기술", "type": "normal", "category": "status"}])
            for i in range(1, 7)
        ],
        opponent=[member(i) for i in range(1, 7)],
    )
    plan = engine(battle_setup).selection(body)["recommendation"]
    assert all(not row["attack_targets"] and not row["attack_assumed"] for row in plan["members"])
    assert len(plan["uncovered_opponent_ids"]) == 6
    for row in plan["matchups"]:
        assert row["attacker_id"] is None
        assert row["attack_multiplier"] is None
        assert row["lead_action"] != "attack"


def test_selection_plan_respects_explicit_coverage_and_opponent_attacks(battle_setup):
    body = TeamAnalysis(
        own=[
            member(i, moves=[{"name": "입력 전기 기술", "type": "electric"}]) for i in range(1, 7)
        ],
        opponent=[
            member(i, moves=[{"name": "입력 불꽃 기술", "type": "fire"}]) for i in range(1, 7)
        ],
    )
    plan = engine(battle_setup).selection(body)["recommendation"]
    for row in plan["matchups"]:
        assert row["attack_type"] == "electric"
        assert row["incoming_types"] == ["fire"]
        assert not row["attack_assumed"] and not row["incoming_assumed"]
    assert "pokemon:5" in plan["uncovered_opponent_ids"]  # Ground immunity.


def test_selection_opening_switch_uses_only_selected_resisting_pivot(battle_setup):
    from backend.app.battle.selection_plan import build_selection_plan

    e = engine(battle_setup)
    body = TeamAnalysis(
        own=[member(i) for i in range(1, 7)], opponent=[member(i) for i in range(1, 7)]
    )
    body = TeamAnalysis(
        own=body.own,
        opponent=[
            member(i, moves=[{"name": "불꽃 공격", "type": "fire"}]) if i == 2 else member(i)
            for i in range(1, 7)
        ],
    )
    own = e.validate_members(body.own)
    opponent = e.validate_members(body.opponent)
    candidate = {"pokemon_ids": ["pokemon:1", "pokemon:3", "pokemon:6"], "lead_id": "pokemon:1"}
    plan = build_selection_plan(e, body, own, opponent, candidate)
    fire = next(m for m in plan["matchups"] if m["opponent_id"] == "pokemon:2")
    assert fire["lead_action"] == "switch"
    assert fire["pivot_id"] == "pokemon:3"
    assert fire["pivot_multiplier"] == 0.5
    assert fire["lead_incoming_multiplier"] == 2
    assert fire["attacker_id"] == "pokemon:3"
    assert fire["attack_multiplier"] == 2


def test_selection_switch_can_use_neutral_defense_with_super_effective_counter(battle_setup):
    from backend.app.battle.selection_plan import build_selection_plan

    e = engine(battle_setup)
    body = TeamAnalysis(
        own=[member(i) for i in range(1, 7)], opponent=[member(i) for i in range(1, 7)]
    )
    plan = build_selection_plan(
        e,
        body,
        e.validate_members(body.own),
        e.validate_members(body.opponent),
        {"pokemon_ids": ["pokemon:2", "pokemon:4", "pokemon:6"], "lead_id": "pokemon:2"},
    )
    water = next(m for m in plan["matchups"] if m["opponent_id"] == "pokemon:3")
    assert water["lead_action"] == "switch"
    assert water["pivot_id"] == "pokemon:4"
    assert water["pivot_multiplier"] == 1
    assert water["attack_multiplier"] == 2
