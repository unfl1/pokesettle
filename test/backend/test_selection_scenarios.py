from uuid import uuid4

import pytest

from backend.app.battle.conversation import BattleUpdate, coach_fallback, evaluate_state
from backend.app.battle.engine import BattleEngine
from backend.app.battle.models import TeamAnalysis, TeamMember
from backend.app.catalog import Catalog
from backend.app.core.config import ROOT
from backend.app.schemas import ChatRequest, Generation
from backend.app.services.chat_scope import ChatScope

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
    assert "조합을 추천" in answer.claims[0].text and "선봉으로는" in answer.claims[0].text
    assert "자기 타입 공격을 가정했어요" in answer.claims[-1].text
    assert all("다만," not in claim.text for claim in answer.claims)
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
        if purpose == "chat_scope":
            return ChatScope(in_scope=True)
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
    assert "조합을 추천" in result["answer"]
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
    assert "조합을 추천" in result["answer"]


def test_selection_action_first_and_sources_last():
    from backend.app.rag.graph import render_answer

    catalog = Catalog(ROOT / "data/pokemon.json")
    context = evaluate_state({"selection_requested": True, "own_team_ids": OWN,
                              "opponent_team_ids": ENEMY}, catalog, ROOT / "data")
    evidence = [{"source_type": "calculation", "evidence_id": "calc", "number": 1,
                 "text": "synthetic selection", "game": "generic", "verification_status": "assumed"}]
    answer = coach_fallback(context, evidence)
    assert not answer.claims[0].text.startswith("타입 상성만")
    assert "조합을 추천" in answer.claims[0].text
    assert "약점" in answer.claims[1].text
    rendered = render_answer(answer, evidence, None)
    assert rendered["answer"].endswith("[근거 1]")
    assert rendered["answer"].count("[근거 1]") == 1
    assert "자기 타입 공격을 가정했어요" in answer.claims[-1].text
    assert all("다만," not in claim.text for claim in answer.claims)


def test_selection_explains_each_member_concisely_without_inferred_moves():
    catalog = Catalog(ROOT / "data/pokemon.json")
    context = evaluate_state(
        {
            "selection_requested": True,
            "own_team_ids": [f"pokemon:{pid}" for pid in (6, 3, 9, 26, 778, 359)],
            "opponent_team_ids": [f"pokemon:{pid}" for pid in (908, 658, 26, 778, 149, 730)],
        },
        catalog,
        ROOT / "data",
    )
    selection = context["selection"]
    best = selection["candidates"][0]
    assert best["pokemon_ids"] == ["pokemon:6", "pokemon:3", "pokemon:778"]
    assert best["lead_id"] == "pokemon:3"
    assert best["components"] == {
        "covered_opponents": 5,
        "resisted_scenarios": 2,
        "shared_weakness_penalty": 0,
        "score": 12,
    }
    answer = coach_fallback(context, [{"source_type": "calculation", "evidence_id": "calc"}])
    text = "\n".join(claim.text for claim in answer.claims)
    assert "리자몽: 마스카나에게 불꽃 타입 공격" in text
    assert "이상해꽃: 마스카나에게 독 타입 공격" in text
    assert "개굴닌자에게 풀 타입 공격" in text
    assert "누리레느에게 풀 타입 공격" in text
    assert "따라큐에게 고스트 타입 공격" in text
    assert "망나뇽에게 페어리 타입 공격" in text
    assert "라이츄, 누리레느의 가정 공격 타입을 모두 반감·무효" in text
    for removed in ("감점", "점수", "동점", "×2", "5마리", "지진"):
        assert removed not in text
    assert len(answer.claims) == 5
    assert all(claim.evidence_ids == ["calc"] for claim in answer.claims)


def test_selection_member_settings_are_grounded_merged_and_used_for_actual_move_types():
    from backend.app.battle.conversation import grounded_update, merge_state

    catalog = Catalog(ROOT / "data/pokemon.json")
    previous = {
        "selection_requested": True,
        "own_team_ids": [f"pokemon:{pid}" for pid in (6, 3, 9, 26, 778, 359)],
        "opponent_team_ids": [f"pokemon:{pid}" for pid in (908, 658, 26, 778, 149, 730)],
    }
    question = "이상해꽃은 지진을 쓰고 특성은 심록, 도구는 먹다남은음식이야."
    update = grounded_update(BattleUpdate(
        relevant=True,
        own_team_members=[{
            "pokemon_id": "pokemon:3", "moves": ["지진", "화염방사"],
            "ability": "심록", "item": "먹다남은음식", "quote": question,
        }, {
            "pokemon_id": "pokemon:6", "moves": ["지진"], "quote": question,
        }],
    ), question, previous, catalog)
    assert len(update.own_team_members) == 1
    assert update.own_team_members[0].moves == ["지진"]
    ids = set(previous["own_team_ids"] + previous["opponent_team_ids"])
    state = merge_state(previous, update, ids, catalog)
    context = evaluate_state(state, catalog, ROOT / "data")
    selection = context["selection"]
    detail = selection["member_details"]["pokemon:3"]
    assert detail["ability"] == "심록" and detail["item"] == "먹다남은음식"
    raichu = next(m for m in detail["matchups"] if m["opponent_id"] == "pokemon:26")
    assert raichu["attack_type"] == "ground" and raichu["multiplier"] == 2
    assert raichu["move_name"] == "지진"
    dragonite = next(m for m in detail["matchups"] if m["opponent_id"] == "pokemon:149")
    assert dragonite["multiplier"] == 0
    answer = coach_fallback(context, [{"source_type": "calculation", "evidence_id": "calc"}])
    text = "\n".join(claim.text for claim in answer.claims)
    assert "심록" in text and "먹다남은음식" in text
    assert "특성·도구·기술 효과와 스피드·피해량은 이 상성 계산에 반영하지 않았어요" in text
    assert "알려주시면" not in text

    followup = "이상해꽃 도구는 생명의구슬이야."
    patch = grounded_update(BattleUpdate(relevant=True, own_team_members=[{
        "pokemon_id": "pokemon:3", "item": "생명의구슬", "quote": followup,
    }]), followup, state, catalog)
    merged = merge_state(state, patch, ids, catalog)
    member = merged["own_team_members"][0]
    assert member["moves"] == ["지진"] and member["ability"] == "심록"
    assert member["item"] == "생명의구슬"


def test_selection_setting_rejects_invented_quotes_and_drops_removed_roster_members():
    from backend.app.battle.conversation import grounded_update, merge_state

    catalog = Catalog(ROOT / "data/pokemon.json")
    previous = {"own_team_ids": OWN, "opponent_team_ids": ENEMY,
                "own_team_members": [{"pokemon_id": "pokemon:3", "moves": ["지진"]}]}
    update = grounded_update(BattleUpdate(relevant=True, own_team_members=[{
        "pokemon_id": "pokemon:3", "ability": "심록", "quote": "이상해꽃은 심록이야",
    }]), "3마리 다시 추천해줘", previous, catalog)
    assert update.own_team_members is None
    new_roster = [pid for pid in OWN if pid != "pokemon:3"] + ["pokemon:359"]
    merged = merge_state(previous, BattleUpdate(relevant=True, own_team_ids=new_roster),
                         set(new_roster + ENEMY), catalog)
    assert merged["own_team_members"] == []


@pytest.mark.parametrize("document_id", ["poketact:strategy:synthetic", "pokeapi:move:89", "pokeapi:ability:65"])
def test_selection_details_enable_only_cited_supplement_and_keep_followup_last(monkeypatch, document_id):
    from types import SimpleNamespace

    from backend.app.rag.graph import build_graph

    catalog = Catalog(ROOT / "data/pokemon.json")
    context = evaluate_state({
        "selection_requested": True, "own_team_ids": OWN, "opponent_team_ids": ENEMY,
        "own_team_members": [{"pokemon_id": "pokemon:3", "moves": ["지진"], "ability": "심록"}],
    }, catalog, ROOT / "data")
    evidence = [
        {"evidence_id": "metadata", "source_type": "metadata", "text": "synthetic metadata",
         "document_id": "metadata", "game": "generic", "verification_status": "verified"},
        {"evidence_id": "strategy", "source_type": "strategy", "text": "TEST ONLY: conditional setting explanation. Name (ko): 지진 / 심록",
         "document_id": document_id, "pokemon_id": OWN[0],
         "game": "generic", "verification_status": "assumed"},
    ]
    monkeypatch.setattr("backend.app.rag.graph.retrieve", lambda *args: evidence)
    vectors = SimpleNamespace(
        settings=SimpleNamespace(top_k=6),
        docs=SimpleNamespace(get=lambda **kwargs: {"ids": [], "documents": [], "metadatas": []}),
    )
    calls = []

    def invoke(purpose, prompt, payload, schema):
        calls.append(payload)
        alias = next(e["evidence_id"] for e in payload["evidence"] if e["source_type"] == "strategy")
        return schema(claims=[{"text": "TEST ONLY: conditional setting explanation.", "evidence_ids": [alias]}])

    result = build_graph(vectors, SimpleNamespace(invoke=invoke)).invoke({
        "pokemon_id": OWN[0], "question": "이상해꽃 특성은 심록이야", "battle_context": context,
    })["result"]
    assert len(calls) == 1
    assert "TEST ONLY: conditional setting explanation." in result["answer"]
    assert result["answer"].index("TEST ONLY:") < result["answer"].index("이 상성 계산에 반영하지 않았어요")


def test_selection_settings_followup_keeps_selection_without_repeating_request(setup, monkeypatch):
    from dataclasses import replace

    catalog = Catalog(ROOT / "data/pokemon.json")
    setup.service.catalog = catalog
    setup.service.settings = replace(setup.settings, data_dir=ROOT / "data")
    setup.vectors.upsert_metadata([catalog.get(pid) for pid in dict.fromkeys(OWN + ENEMY)])
    first = "내 팀은 피카츄 이상해꽃 리자몽 거북왕 한카리아스 토게키스, 상대 팀은 망나뇽 갸라도스 라우드본 마스카나 맘모꾸리 핫삼이야. 3마리 추천해줘"
    followup = "이상해꽃의 공격 기술은 지진이고 특성은 심록이야"

    def invoke(purpose, prompt, payload, schema):
        if purpose == "chat_scope":
            return ChatScope(in_scope=True)
        if purpose == "battle_state" and payload["question"] == first:
            return BattleUpdate(relevant=True, own_team_ids=OWN, opponent_team_ids=ENEMY,
                                input_evidence=[{"field": "own_team_ids", "quote": first},
                                                {"field": "opponent_team_ids", "quote": first}])
        if purpose == "battle_state":
            return BattleUpdate(relevant=True, own_team_members=[{
                "pokemon_id": "pokemon:3", "moves": ["지진"], "ability": "심록", "quote": followup,
            }])
        return schema(claims=[])

    monkeypatch.setattr(setup.model, "invoke", invoke)
    session = setup.store.new_session()
    first_result = setup.service.chat(ChatRequest(question=first, client_request_id=uuid4()), session)
    result = setup.service.chat(ChatRequest(question=followup,
        conversation_id=first_result["conversation_id"], client_request_id=uuid4()), session)
    assert result["battle_context"]["scope"] == "generic_team_selection"
    assert result["battle_context"]["state"]["selection_requested"] is True
    detail = result["battle_context"]["selection"]["reported_settings"][0]
    assert detail["move_names"] == ["지진"] and detail["ability"] == "심록"
