from uuid import uuid4

from backend.app.battle.conversation import BattleUpdate, evaluate_state, merge_state
from backend.app.catalog import Catalog
from backend.app.core.config import ROOT
from backend.app.schemas import ChatRequest


def test_followup_state_merges_and_type_change_does_not_grant_moves():
    catalog = Catalog(ROOT / "data/pokemon.json")
    first = merge_state(
        {},
        BattleUpdate(relevant=True, own_id="pokemon:3", opponent_id="pokemon:6"),
        {"pokemon:3", "pokemon:6"},
        catalog,
    )
    result = evaluate_state(first, catalog, ROOT / "data")
    assert result["recommendation"] == "consider_switch_first"
    assert {x["type"]: x["multiplier"] for x in result["defense"]} == {"fire": 2, "flying": 2}
    assert all(item["basis"] == "if_available" for item in result["attacks"])
    assert result["probability"] is None
    second = merge_state(
        first, BattleUpdate(relevant=True, requested_defensive_type="water"), set(), catalog
    )
    comparison = evaluate_state(second, catalog, ROOT / "data")
    assert comparison["state"]["opponent_id"] == "pokemon:6"
    assert comparison["type_change"]["status"] == "hypothetical_only_not_applied"
    assert {x["type"]: x["multiplier"] for x in comparison["type_change"]["defense"]} == {
        "fire": 0.5,
        "flying": 1,
    }
    assert all(item["type"] != "water" for item in comparison["attacks"])
    assert "own_attack_types" not in comparison["state"]
    assert comparison["recommendation"] == "consider_switch_first"
    third = merge_state(
        second, BattleUpdate(relevant=True, own_attack_types=["water"]), set(), catalog
    )
    assert evaluate_state(third, catalog, ROOT / "data")["attacks"][0]["multiplier"] == 2


def test_corrections_replacement_reset_and_unknown_ids():
    catalog = Catalog(ROOT / "data/pokemon.json")
    previous = {
        "own_id": "pokemon:3",
        "opponent_id": "pokemon:6",
        "own_hp_percent": 30,
        "own_attack_types": ["grass"],
        "own_item": "user item",
    }
    corrected = merge_state(
        previous, BattleUpdate(relevant=True, clear_fields=["own_hp_percent"]), set(), catalog
    )
    assert "own_hp_percent" not in corrected and corrected["own_id"] == "pokemon:3"
    replacement = merge_state(
        previous, BattleUpdate(relevant=True, own_id="pokemon:9"), {"pokemon:9"}, catalog
    )
    assert (
        replacement["own_id"] == "pokemon:9"
        and "own_attack_types" not in replacement
        and "own_item" not in replacement
    )
    invalid = merge_state(
        previous, BattleUpdate(relevant=True, own_id="pokemon:999999"), set(), catalog
    )
    assert invalid == previous
    assert merge_state(previous, BattleUpdate(relevant=True, reset=True), set(), catalog) == {}
    blocked = evaluate_state({**previous, "switch_blocked": True}, catalog, ROOT / "data")
    assert blocked["recommendation"] == "compare_attacks_switch_blocked"


def test_real_pipeline_persists_user_state_and_supplies_citable_calculation(setup, monkeypatch):
    # Real catalog and type rules, synthetic LLM/embedding only.
    from backend.app.schemas import Generation

    setup.service.catalog = Catalog(ROOT / "data/pokemon.json")
    setup.service.settings = __import__("dataclasses").replace(
        setup.settings, data_dir=ROOT / "data"
    )
    setup.vectors.upsert_metadata(
        [setup.service.catalog.get(pid) for pid in ["pokemon:3", "pokemon:6"]]
    )
    monkeypatch.setattr(setup.service, "collect", lambda *args: {"queries": []})
    updates = iter(
        [
            BattleUpdate(
                relevant=True,
                own_id="pokemon:3",
                opponent_id="pokemon:6",
                bench_ids=["pokemon:9"],
                opponent_moves=["flamethrower"],
            ),
            BattleUpdate(relevant=True, own_hp_percent=40, requested_defensive_type="water"),
            BattleUpdate(relevant=False),
        ]
    )
    from backend.tests.conftest import document

    setup.vectors.index_document("pokemon:3", document("poketact:strategy:test", "TEST ONLY: conditional strategy."))
    payloads = []

    def invoke(purpose, system, payload, schema):
        if purpose == "battle_state":
            update = next(updates)
            from backend.app.battle.conversation import InputEvidence

            update.input_evidence = [
                InputEvidence(field=key, quote=payload["question"])
                for key in update.model_dump(exclude_none=True)
            ]
            return update
        payloads.append(payload)
        evidence = next(e for e in payload["evidence"] if e.get("source_type") == "calculation")
        return Generation(
            answer_status="partial",
            claims=[
                {
                    "text": "일반 상성 가정에서 교체 후보를 우선 검토합니다.",
                    "evidence_ids": [evidence["evidence_id"]],
                }
            ],
            assumptions=["상대 타입 공격 가정"],
            unknowns=["교체 가능한 팀원을 알려주세요."],
        )

    monkeypatch.setattr(setup.model, "invoke", invoke)
    session = setup.store.new_session()

    def request(question, conversation_id=None):
        return ChatRequest(
            pokemon_id="pokemon:1",
            question=question,
            conversation_id=conversation_id,
            client_request_id=uuid4(),
        )

    first = setup.service.chat(
        request("내 선봉은 이상해꽃이고 상대는 리자몽, 교체 후보는 거북왕"), session
    )
    assert "거북왕 교체를 추천" in first["answer"]
    assert first["battle_context"]["switches"][0]["pokemon_id"] == "pokemon:9"
    cid = first["conversation_id"]
    assert first["battle_context"]["state"]["own_id"] == "pokemon:3"
    second = setup.service.chat(request("남은 HP 40%에 물 테라를 가지고 있어", cid), session)
    assert second["battle_context"]["state"]["opponent_id"] == "pokemon:6"
    assert setup.store.get("battle_state", cid)["own_hp_percent"] == 40
    import json

    reference = payloads[-1]["battle_context_from_user_inputs_and_type_tool"]["evidence_id"]
    calculation = next(item for item in payloads[-1]["evidence"] if item["evidence_id"] == reference)
    assert json.loads(calculation["text"])["state"]["own_id"] == "pokemon:3"
    assert second["citations"][0]["source_type"] == "calculation"
    assert len(payloads[-1]["evidence"]) <= setup.settings.top_k
    # A fresh conversation must not inherit any battle inputs.
    other = setup.store.conversation(session, "pokemon:1", None)
    assert setup.store.get("battle_state", other) is None


def test_abstained_model_can_still_explain_cited_type_calculation(setup):
    from types import SimpleNamespace

    from backend.app.rag.graph import build_graph
    from backend.app.schemas import Generation

    catalog = Catalog(ROOT / "data/pokemon.json")
    setup.vectors.upsert_metadata([catalog.get(pid) for pid in ["pokemon:3", "pokemon:6"]])
    context = evaluate_state(
        {"own_id": "pokemon:3", "opponent_id": "pokemon:6"}, catalog, ROOT / "data"
    )
    output = build_graph(
        setup.vectors,
        SimpleNamespace(
            invoke=lambda *args: Generation(
                answer_status="abstained", claims=[], assumptions=[], unknowns=["실전 전략 불명"]
            )
        ),
    ).invoke(
        {
            "pokemon_id": "pokemon:3",
            "context_pokemon_ids": ["pokemon:6"],
            "question": "교체해야 해?",
            "battle_context": context,
        }
    )["result"]
    assert output["answer_status"] == "partial"
    assert "교체하는 쪽을 추천해요" in output["answer"]
    assert output["citations"][0]["source_type"] == "calculation"
    assert output["facts"][0]["verification_status"] == "assumed"
    assert "70%" not in output["answer"]
    assert output["unknowns"] == []
    assert "다만," in output["answer"]


def test_pikachu_gyarados_product_and_action_first_output_rejects_model_two_times(setup):
    from types import SimpleNamespace

    from backend.app.rag.graph import build_graph
    from backend.app.schemas import Generation

    catalog = Catalog(ROOT / "data/pokemon.json")
    context = evaluate_state(
        {"own_id": "pokemon:25", "opponent_id": "pokemon:130"}, catalog, ROOT / "data"
    )
    attack = next(item for item in context["attacks"] if item["type"] == "electric")
    assert attack["multiplier"] == 4
    assert [f["multiplier"] for f in attack["factors"]] == [2, 2]
    assert attack["basis"] == "if_available"
    assert "own_attack_types" not in context["state"]
    assert context["recommendation"] == "consider_attack_if_available"
    setup.vectors.upsert_metadata([catalog.get(pid) for pid in ["pokemon:25", "pokemon:130"]])

    def wrong_model(*args):
        evidence = args[2]["evidence"]
        return Generation(
            answer_status="answered",
            claims=[
                {
                    "text": "전기 공격은 갸라도스에게 2배입니다.",
                    "evidence_ids": [evidence[0]["evidence_id"]],
                }
            ],
            assumptions=[],
            unknowns=[],
        )

    result = build_graph(setup.vectors, SimpleNamespace(invoke=wrong_model)).invoke(
        {
            "pokemon_id": "pokemon:25",
            "context_pokemon_ids": ["pokemon:130"],
            "question": "나 피카츄 냈는데 상대가 갸라도스야 뭐 하면 돼?",
            "battle_context": context,
        }
    )["result"]
    assert "4배 약점" in result["answer"]
    assert "전기 공격은 갸라도스에게 2배입니다" not in result["answer"]
    assert result["answer"].startswith("타입 상성만 보면 전기 타입 기술로 공격")
    assert "땅 타입" in result["answer"] and "교체에 주의" in result["answer"]
    assert result["citations"][0]["source_type"] == "calculation"


def test_named_moves_drive_types_and_switch_candidates_exclude_fainted():
    catalog = Catalog(ROOT / "data/pokemon.json")
    result = evaluate_state(
        {"own_id": "pokemon:25", "opponent_id": "pokemon:130", "own_moves": ["10만볼트"]},
        catalog,
        ROOT / "data",
    )
    assert result["attacks"][0]["type"] == "electric"
    assert result["attacks"][0]["multiplier"] == 4
    assert result["attacks"][0]["basis"] == "user_reported"
    assert result["known_moves"][0]["ownership"] == "user_reported"
    assert result["recommendation"] == "consider_attack_with_speed_and_hp_check"
    result = evaluate_state(
        {
            "own_id": "pokemon:3",
            "opponent_id": "pokemon:6",
            "opponent_moves": ["flamethrower"],
            "bench_ids": ["pokemon:9", "pokemon:1", "pokemon:134"],
            "bench_members": [{"pokemon_id": "pokemon:134", "hp_percent": 0}],
        },
        catalog,
        ROOT / "data",
    )
    assert result["preferred_switch_ids"] == ["pokemon:9"]
    assert result["switches"][0]["name"] == "거북왕"
    assert result["switches"][0]["worst_multiplier"] == 0.5
    assert len(result["switches"]) == 2
    assert result["probability"] is None


def test_status_and_unknown_moves_never_turn_into_invented_attack():
    catalog = Catalog(ROOT / "data/pokemon.json")
    result = evaluate_state(
        {"own_id": "pokemon:149", "opponent_id": "pokemon:6", "own_moves": ["용의춤", "없는기술"]},
        catalog,
        ROOT / "data",
    )
    assert result["attacks"] == []
    assert result["known_moves"][0]["category"] == "status"
    assert result["unresolved_moves"] == [{"side": "own", "name": "없는기술"}]
    assert any("없는기술" in question for question in result["questions"])


def test_rank_stages_clear_on_new_opponent_and_candidate_corrections():
    catalog = Catalog(ROOT / "data/pokemon.json")
    previous = {
        "own_id": "pokemon:3",
        "opponent_id": "pokemon:149",
        "opponent_attack_stage": 1,
        "opponent_speed_stage": 1,
        "opponent_moves": ["용의춤"],
        "bench_ids": ["pokemon:9"],
        "bench_members": [{"pokemon_id": "pokemon:9", "hp_percent": 0}],
    }
    updated = merge_state(
        previous,
        BattleUpdate(relevant=True, opponent_id="pokemon:6", bench_ids=["pokemon:9"]),
        {"pokemon:6", "pokemon:9"},
        catalog,
    )
    assert "opponent_attack_stage" not in updated
    assert "opponent_moves" not in updated
    assert "bench_members" not in updated


def test_chat_context_calls_reference_damage_engine_only_for_complete_neutral_inputs():
    from backend.app.core.config import Settings

    catalog = Catalog(ROOT / "data/pokemon.json")
    state = {"own_id": "pokemon:25", "opponent_id": "pokemon:130", "own_moves": ["10만볼트"]}
    assert evaluate_state(state, catalog, ROOT / "data")["damage_comparisons"] == []
    points = {"hp": 0, "attack": 0, "defense": 0, "sp_attack": 0, "sp_defense": 0, "speed": 0}
    scenario = {
        "attacker": {"pokemon_id": "pokemon:25", "stat_points": points, "alignment": "Hardy"},
        "defender": {"pokemon_id": "pokemon:130", "stat_points": points, "alignment": "Hardy"},
        "move": "Thunderbolt",
        "neutral_conditions": True,
    }
    result = evaluate_state(
        {**state, "damage_scenarios": [scenario]}, catalog, ROOT / "data", Settings()
    )
    assert len(result["damage_comparisons"]) == 1
    assert result["damage_comparisons"][0]["calculation"]["damage"]["minimum"] > 0
    blocked = evaluate_state(
        {**state, "opponent_attack_stage": 1, "damage_scenarios": [scenario]},
        catalog,
        ROOT / "data",
        Settings(),
    )
    assert blocked["damage_comparisons"] == []
    assert any("충돌" in a for a in blocked["assumptions"])


def test_bench_hp_followup_preserves_other_candidates_and_ties():
    catalog = Catalog(ROOT / "data/pokemon.json")
    previous = {
        "own_id": "pokemon:3",
        "opponent_id": "pokemon:6",
        "bench_ids": ["pokemon:9", "pokemon:134"],
        "bench_members": [
            {"pokemon_id": "pokemon:9", "hp_percent": 80},
            {"pokemon_id": "pokemon:134", "hp_percent": 50},
        ],
    }
    update = BattleUpdate.model_validate(
        {"relevant": True, "bench_members": [{"pokemon_id": "pokemon:9", "hp_percent": 0}]}
    )
    state = merge_state(previous, update, {"pokemon:9", "pokemon:134"}, catalog)
    result = evaluate_state(state, catalog, ROOT / "data")
    assert [s["pokemon_id"] for s in result["switches"]] == ["pokemon:134"]
    assert state["bench_members"][1]["hp_percent"] == 50


def test_real_model_errors_are_rejected_by_input_grounding():
    from backend.app.battle.conversation import grounded_update

    catalog = Catalog(ROOT / "data/pokemon.json")
    question = "나 피카츄 냈는데 상대가 갸라도스야. 10만볼트를 가지고 있어. 뭐 하면 돼?"
    update = BattleUpdate(
        own_hp_percent=100,
        opponent_moves=["10만볼트"],
        input_evidence=[
            {"field": "own_hp_percent", "quote": question},
            {"field": "opponent_moves", "quote": question},
        ],
    )
    grounded = grounded_update(update, question)
    assert grounded.own_hp_percent is None
    assert grounded.opponent_moves is None
    previous = {
        "own_id": "pokemon:3",
        "opponent_id": "pokemon:6",
        "bench_ids": ["pokemon:9", "pokemon:134"],
    }
    grounded = grounded_update(
        BattleUpdate(relevant=True, own_id="pokemon:134"),
        "거북왕은 지금 HP 0%야. 그럼 누구로 교체해?",
        previous,
        catalog,
    )
    assert grounded.own_id is None
    assert grounded.bench_members[0].pokemon_id == "pokemon:9"
    assert grounded.bench_members[0].hp_percent == 0


def test_input_evidence_accepts_wire_field_names():
    from backend.app.battle.conversation import grounded_update

    question = "10만볼트를 가지고 있어"
    update = BattleUpdate(
        own_moves=["10만볼트"], input_evidence=[{"field": "ownMoves", "quote": question}]
    )
    assert grounded_update(update, question).own_moves == ["10만볼트"]


def test_explicit_move_possession_and_bench_hp_have_separate_owners():
    from backend.app.battle.conversation import grounded_update

    catalog = Catalog(ROOT / "data/pokemon.json")
    update = grounded_update(
        BattleUpdate(), "나 피카츄 냈는데 상대가 갸라도스야. 10만볼트를 가지고 있어.", {}, catalog
    )
    assert update.own_moves == ["10만볼트"]
    assert update.opponent_moves is None
    question = "거북왕은 지금 HP 0%야. 그럼 누구로 교체해?"
    previous = {"own_id": "pokemon:3", "bench_ids": ["pokemon:9", "pokemon:134"]}
    update = grounded_update(
        BattleUpdate(
            own_hp_percent=0, input_evidence=[{"field": "ownHpPercent", "quote": question}]
        ),
        question,
        previous,
        catalog,
    )
    assert update.own_hp_percent is None
    assert update.bench_members[0].hp_percent == 0


def test_new_unknown_opponent_clears_old_pair_and_confirms_spelling():
    from backend.app.battle.conversation import resolve_named_opponent

    catalog = Catalog(ROOT / "data/pokemon.json")
    previous = {
        "own_id": "pokemon:908",
        "opponent_id": "pokemon:130",
        "opponent_moves": ["폭포오르기"],
        "opponent_hp_percent": 80,
    }
    state = resolve_named_opponent(
        "이번엔 내가 마스카나를 냈는데 상대가 라운드본이 나왔어 어케해?", previous, catalog
    )
    assert catalog.get(state["opponent_id"]).name_ko == "라우드본"
    assert "opponent_moves" not in state
    assert "opponent_hp_percent" not in state
    assert "unresolved_opponent" not in state
    # More distant spelling still requires explicit confirmation.
    pending = resolve_named_opponent("상대가 라우드본느느야", {}, catalog)
    assert pending["unresolved_opponent"]["suggestion"] == "라우드본"
    confirmed = resolve_named_opponent("ㅇㅇ", pending, catalog)
    assert catalog.get(confirmed["opponent_id"]).name_ko == "라우드본"
    assert "unresolved_opponent" not in confirmed
    exact = resolve_named_opponent(
        "상대가 라우드본이 나왔어", {"opponent_id": "pokemon:130"}, catalog
    )
    assert catalog.get(exact["opponent_id"]).name_ko == "라우드본"


def test_coach_answer_is_concise_and_all_type_names_are_korean():
    from backend.app.battle.conversation import coach_fallback

    catalog = Catalog(ROOT / "data/pokemon.json")
    context = evaluate_state(
        {"own_id": "pokemon:25", "opponent_id": "pokemon:130"}, catalog, ROOT / "data"
    )
    answer = coach_fallback(context, [{"evidence_id": "calc", "source_type": "calculation"}])
    assert len(answer.claims) <= 3
    assert len(answer.unknowns) == 0
    assert len(answer.assumptions) == 0
    assert "water" not in str(answer) and "flying" not in str(answer)


def test_unknown_new_opponent_is_saved_without_searching_old_opponent(setup, monkeypatch):
    from backend.app.battle.conversation import BattleUpdate

    catalog = Catalog(ROOT / "data/pokemon.json")
    setup.service.catalog = catalog
    session = setup.store.new_session()
    cid = setup.store.conversation(session, "pokemon:1", None)
    setup.store.put("battle_state", cid, {"own_id": "pokemon:25", "opponent_id": "pokemon:130"})
    monkeypatch.setattr(
        setup.model,
        "invoke",
        lambda *args: BattleUpdate(relevant=True, own_id="pokemon:908", opponent_id="pokemon:130"),
    )
    monkeypatch.setattr(
        setup.service,
        "collect",
        lambda *args: (_ for _ in ()).throw(AssertionError("must not search old opponent")),
    )
    question = "이번엔 내가 마스카나를 냈는데 상대가 라우드본느느가 나왔어 어케해?"
    result = setup.service.chat(
        ChatRequest(
            pokemon_id="pokemon:1",
            question=question,
            conversation_id=cid,
            client_request_id=uuid4(),
        ),
        session,
    )
    assert "라우드본" in result["answer"]
    assert "갸라도스" not in result["answer"]
    assert "opponent_id" not in setup.store.get("battle_state", cid)


def test_general_recommendation_precedes_cautions_without_routine_questions():
    from backend.app.battle.conversation import coach_fallback

    catalog = Catalog(ROOT / "data/pokemon.json")
    context = evaluate_state(
        {"own_id": "pokemon:25", "opponent_id": "pokemon:130", "own_moves": ["10만볼트"]},
        catalog,
        ROOT / "data",
    )
    answer = coach_fallback(context, [{"evidence_id": "calc", "source_type": "calculation"}])
    assert answer.claims[0].text == "타입 상성만 보면 10만볼트로 공격하는 쪽을 추천해요."
    assert "4배" in answer.claims[1].text
    assert answer.claims[-1].text.startswith("다만,\n")
    assert "땅 타입" in answer.claims[-1].text
    assert answer.unknowns == []
