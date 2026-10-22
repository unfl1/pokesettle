from uuid import uuid4

import pytest

from backend.app.battle.conversation import BattleUpdate, coach_fallback, evaluate_state
from backend.app.battle.engine import BattleEngine
from backend.app.battle.models import TeamAnalysis, TeamMember
from backend.app.catalog import Catalog
from backend.app.core.config import ROOT
from backend.app.schemas import ChatRequest, Generation

OWN = ["pokemon:25", "pokemon:3", "pokemon:6", "pokemon:9", "pokemon:445", "pokemon:468"]
ENEMY = ["pokemon:149", "pokemon:130", "pokemon:911", "pokemon:908", "pokemon:473", "pokemon:212"]


def test_real_six_vs_six_checks_all_combinations_and_explains_three_with_lead():
    catalog = Catalog(ROOT / "data/pokemon.json")
    engine = BattleEngine(catalog, ROOT / "data")
    result = engine.selection(
        TeamAnalysis(
            own=[TeamMember(pokemon_id=pid) for pid in OWN],
            opponent=[TeamMember(pokemon_id=pid) for pid in ENEMY],
        )
    )
    assert result["candidate_count"] == 20
    assert len({frozenset(c["pokemon_ids"]) for c in result["candidates"]}) == 20
    assert all(
        len(c["pokemon_ids"]) == 3 and c["lead_id"] in c["pokemon_ids"]
        for c in result["candidates"]
    )
    assert result["score_kind"] == "heuristic_not_probability"
    context = evaluate_state(
        {"selection_requested": True, "own_team_ids": OWN, "opponent_team_ids": ENEMY},
        catalog,
        ROOT / "data",
    )
    answer = coach_fallback(context, [{"source_type": "calculation", "evidence_id": "calc"}])
    assert len(context["selection"]["candidates"]) == 3
    assert "선출을 추천" in answer.claims[0].text and "선봉 후보" in answer.claims[0].text
    assert answer.claims[-1].text.startswith("주의사항\n")
    assert context["probability"] is None


def test_missing_or_duplicate_entry_never_recommends_a_partial_or_illegal_roster():
    catalog = Catalog(ROOT / "data/pokemon.json")
    for own, opponent in [(OWN[:5], ENEMY), (OWN, ENEMY[:5]), ([OWN[0]] * 6, ENEMY)]:
        context = evaluate_state(
            {"selection_requested": True, "own_team_ids": own, "opponent_team_ids": opponent},
            catalog,
            ROOT / "data",
        )
        assert context["recommendation"] == "need_six_per_team"
        assert "selection" not in context
        assert context["questions"]


@pytest.mark.parametrize(
    "own,enemy,attack,expected",
    [
        ("pokemon:25", "pokemon:130", "electric", 4),
        ("pokemon:445", "pokemon:6", "ground", 0),
        ("pokemon:911", "pokemon:143", "ghost", 0),
        ("pokemon:908", "pokemon:911", "dark", 2),
        ("pokemon:6", "pokemon:212", "fire", 4),
        ("pokemon:9", "pokemon:445", "ice", 4),
    ],
)
def test_actual_species_attack_matchups(own, enemy, attack, expected):
    catalog = Catalog(ROOT / "data/pokemon.json")
    context = evaluate_state(
        {"own_id": own, "opponent_id": enemy, "own_attack_types": [attack]}, catalog, ROOT / "data"
    )
    assert context["attacks"][0]["multiplier"] == expected
    assert context["probability"] is None


def test_chat_selection_keeps_all_twelve_ids_and_persists_rosters(setup, monkeypatch):
    from dataclasses import replace

    catalog = Catalog(ROOT / "data/pokemon.json")
    setup.service.catalog = catalog
    setup.service.settings = replace(setup.settings, data_dir=ROOT / "data")
    other = ["pokemon:6", "pokemon:59", "pokemon:38", "pokemon:157", "pokemon:257", "pokemon:392"]
    setup.vectors.upsert_metadata(
        [catalog.get(pid) for pid in dict.fromkeys([*OWN, *ENEMY, *other])]
    )
    seen = []
    question = "내 팀은 피카츄 이상해꽃 리자몽 거북왕 한카리아스 토게키스, 상대 팀은 망나뇽 갸라도스 라우드본 마스카나 맘모꾸리 핫삼이야. 3마리 선출과 선봉 추천해줘"

    def invoke(purpose, prompt, payload, schema):
        if purpose == "battle_state":
            seen.append(payload)
            return BattleUpdate(
                own_team_ids=OWN,
                opponent_team_ids=ENEMY,
                relevant=True,
                input_evidence=[
                    {"field": "ownTeamIds", "quote": question},
                    {"field": "opponentTeamIds", "quote": question},
                ],
            )
        return Generation(answer_status="abstained", claims=[], assumptions=[], unknowns=["test"])

    monkeypatch.setattr(setup.model, "invoke", invoke)
    monkeypatch.setattr(
        setup.service,
        "collect",
        lambda *args: (_ for _ in ()).throw(
            AssertionError("selection must use prepared local index")
        ),
    )
    session = setup.store.new_session()
    result = setup.service.chat(ChatRequest(question=question, client_request_id=uuid4()), session)
    assert len(seen[0]["candidate_pokemon"]) == 12
    assert result["battle_context"]["selection"]["candidate_count"] == 20
    assert "선출을 추천" in result["answer"]
    assert setup.store.get("battle_state", result["conversation_id"])["opponent_team_ids"] == ENEMY

    followup = setup.service.chat(
        ChatRequest(
            question="상대 팀은 리자몽 윈디 나인테일 블레이범 번치코 초염몽이야. 내 팀은 그대로고 3마리 선출 다시 추천해줘",
            conversation_id=result["conversation_id"],
            client_request_id=uuid4(),
        ),
        session,
    )
    assert followup["battle_context"]["state"]["own_team_ids"] == OWN
    assert followup["battle_context"]["state"]["opponent_team_ids"] == other
    assert followup["collection"]["source"] == "prepared_local_index"


def test_selection_rejects_unsupported_model_species_commentary(setup):
    from types import SimpleNamespace

    from backend.app.rag.graph import build_graph

    catalog = Catalog(ROOT / "data/pokemon.json")
    setup.vectors.upsert_metadata([catalog.get(pid) for pid in OWN[:2]])
    context = evaluate_state(
        {"selection_requested": True, "own_team_ids": OWN, "opponent_team_ids": ENEMY},
        catalog,
        ROOT / "data",
    )

    def invoke(purpose, prompt, payload, schema):
        evidence = next(e for e in payload["evidence"] if e["source_type"] == "calculation")
        return Generation(
            answer_status="partial",
            claims=[
                {
                    "text": "리자몽은 불꽃 공격에 약합니다.",
                    "evidence_ids": [evidence["evidence_id"]],
                }
            ],
            assumptions=[],
            unknowns=[],
        )

    result = build_graph(setup.vectors, SimpleNamespace(invoke=invoke)).invoke(
        {"pokemon_id": OWN[0], "question": "3마리 선출 추천", "battle_context": context}
    )["result"]
    assert "리자몽은 불꽃 공격에 약합니다" not in result["answer"]
    assert "선출을 추천" in result["answer"]
