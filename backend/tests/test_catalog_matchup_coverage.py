"""Catalog-wide recognition and cross-generation battle-state regression coverage."""

from collections import Counter

import pytest

from backend.app.battle.conversation import (
    BattleUpdate,
    evaluate_state,
    merge_state,
    resolve_named_opponent,
)
from backend.app.catalog import Catalog
from backend.app.core.config import ROOT
from backend.app.services.topics import mentioned_pokemon


@pytest.fixture(scope="module")
def catalog():
    return Catalog(ROOT / "data/pokemon.json")


def test_every_catalog_name_resolves_without_generation_or_form_bias(catalog):
    counts = Counter(p.name_ko for p in catalog.items.values())
    for pokemon in catalog.items.values():
        names = [pokemon.name_en]
        if counts[pokemon.name_ko] == 1:
            names.append(pokemon.name_ko)
        for name in names:
            for phrase in (f"상대가 {name}야", f"상대 선봉은 {name}야", f"상대는 {name}인데 어케해?"):
                result = resolve_named_opponent(phrase, {"opponent_id": "pokemon:25"}, catalog)
                assert result.get("opponent_id") == pokemon.pokemon_id, (phrase, result)


def test_duplicate_localized_form_names_require_clarification(catalog):
    counts = Counter(p.name_ko for p in catalog.items.values())
    for name, count in counts.items():
        if count < 2:
            continue
        state = resolve_named_opponent(
            f"상대 선봉은 {name}야", {"opponent_id": "pokemon:25", "opponent_moves": ["번개"]}, catalog
        )
        assert "opponent_id" not in state
        assert "opponent_moves" not in state
        assert state["unresolved_opponent"] == {"input": name, "suggestion": None}


def test_every_default_species_is_available_as_a_chat_candidate(catalog):
    for pokemon in catalog.items.values():
        if pokemon.is_default:
            question = f"내 선봉은 {pokemon.name_ko}이고 상대 선봉은 피카츄야. 어떻게 해?"
            assert pokemon.pokemon_id in mentioned_pokemon(catalog, question, limit=16), question


# One representative per generation; both side roles are crossed, not only old -> new.
REPRESENTATIVES = [25, 197, 282, 445, 635, 658, 724, 823, 908]


@pytest.mark.parametrize("own", REPRESENTATIVES)
@pytest.mark.parametrize("enemy", REPRESENTATIVES)
def test_cross_generation_state_changes_do_not_reuse_previous_species_inputs(catalog, own, enemy):
    own_id, enemy_id = f"pokemon:{own}", f"pokemon:{enemy}"
    previous = {
        "own_id": "pokemon:3", "own_moves": ["솔라빔"], "own_hp_percent": 15,
        "opponent_id": "pokemon:130", "opponent_moves": ["폭포오르기"], "opponent_hp_percent": 80,
    }
    state = merge_state(previous, BattleUpdate(relevant=True, own_id=own_id), {own_id}, catalog)
    state = resolve_named_opponent(f"상대 선봉은 {catalog.get(enemy_id).name_ko}인데 어케해?", state, catalog)
    assert state["own_id"] == own_id and state["opponent_id"] == enemy_id
    assert not any(key in state for key in ("own_moves", "opponent_moves", "own_hp_percent", "opponent_hp_percent"))
    context = evaluate_state(state, catalog, ROOT / "data")
    assert context["own_name"] == catalog.get(own_id).name_ko
    assert context["opponent_name"] == catalog.get(enemy_id).name_ko
    assert {row["type"] for row in context["attacks"]} == set(catalog.get(own_id).types)
    assert context["probability"] is None


def test_chat_pipeline_crosses_all_generations_and_overrides_stale_model_opponents(setup, monkeypatch):
    from dataclasses import replace
    from uuid import uuid4

    from backend.app.schemas import ChatRequest, Generation

    catalog = Catalog(ROOT / "data/pokemon.json")
    setup.service.catalog = catalog
    setup.service.settings = replace(setup.settings, data_dir=ROOT / "data")
    setup.vectors.upsert_metadata([catalog.get(f"pokemon:{pid}") for pid in REPRESENTATIVES])
    current = {}

    def invoke(purpose, prompt, payload, schema):
        if purpose == "battle_state":
            # Simulate a model retaining the previous opponent despite an explicit new name.
            return BattleUpdate(relevant=True, own_id=current["own"], opponent_id=current["stale"])
        return Generation(answer_status="abstained", claims=[], assumptions=[], unknowns=[])

    monkeypatch.setattr(setup.model, "invoke", invoke)
    monkeypatch.setattr(setup.service, "collect", lambda *args: {"queries": [], "source": "test"})
    session = setup.store.new_session()
    cid = None
    stale = "pokemon:25"
    for index, number in enumerate(REPRESENTATIVES):
        own = f"pokemon:{number}"
        enemy = f"pokemon:{REPRESENTATIVES[(index + 4) % 9]}"
        current.update(own=own, stale=stale)
        question = f"내 선봉은 {catalog.get(own).name_ko}이고 상대 선봉은 {catalog.get(enemy).name_ko}인데 어떻게 해?"
        result = setup.service.chat(
            ChatRequest(question=question, conversation_id=cid, client_request_id=uuid4()), session
        )
        cid = result["conversation_id"]
        state = result["battle_context"]["state"]
        assert state["own_id"] == own and state["opponent_id"] == enemy
        assert result["battle_context"]["scope"] == "generic_type_scenario"
        assert result["citations"]
        stale = enemy


@pytest.mark.parametrize("own,enemy,expected", [
    (445, 823, ["교체하는 쪽을 추천", "땅 공격은 통하지 않아요", "드래곤 공격은 0.5배로 반감"]),
    (823, 445, ["공격하는 쪽을 추천", "반감되지"]),
    (908, 445, ["풀 타입 기술이 있다면 공격", "반감되지"]),
    (25, 635, ["교체하는 쪽을 추천", "전기 공격은 0.5배로 반감"]),
])
def test_action_first_coaching_includes_resisted_and_immune_attacks(catalog, own, enemy, expected):
    from backend.app.battle.conversation import coach_fallback

    context = evaluate_state({"own_id": f"pokemon:{own}", "opponent_id": f"pokemon:{enemy}"}, catalog, ROOT / "data")
    answer = coach_fallback(context, [{"source_type": "calculation", "evidence_id": "calc"}])
    text = "\n".join(c.text for c in answer.claims)
    for fragment in expected:
        assert fragment in text
    assert "보유 기술과 교체 후보를 함께 비교해야" not in text
    assert "다만,\n" not in text
    if "공격하는 쪽을 추천" in answer.claims[0].text:
        assert "타입 기술이 있다면" in answer.claims[0].text


def test_explicit_coverage_move_replaces_conditional_switch_recommendation(catalog):
    from backend.app.battle.conversation import coach_fallback

    context = evaluate_state({"own_id": "pokemon:445", "opponent_id": "pokemon:823", "own_moves": ["불꽃엄니", "지진"]}, catalog, ROOT / "data")
    answer = coach_fallback(context, [{"source_type": "calculation", "evidence_id": "calc"}])
    assert "불꽃엄니로 공격" in answer.claims[0].text
    assert "땅 공격은 통하지 않아요" in "\n".join(c.text for c in answer.claims)
    assert "교체하는 쪽을 추천" not in answer.claims[0].text


def test_move_definition_cannot_add_ownership_or_override_matchup_advice(setup):
    from types import SimpleNamespace

    from backend.app.rag.graph import build_graph
    from backend.app.schemas import Generation
    from backend.tests.conftest import document

    catalog = Catalog(ROOT / "data/pokemon.json")
    setup.vectors.upsert_metadata([catalog.get("pokemon:25"), catalog.get("pokemon:635")])
    setup.vectors.index_document("pokemon:25", document("pokeapi:move:85", "TEST ONLY: thunderbolt move effect definition"))
    setup.vectors.index_document("pokemon:25", document("strategy:test", "TEST ONLY: consider opposing switches", source_type="curated"))
    context = evaluate_state({"own_id": "pokemon:25", "opponent_id": "pokemon:635"}, catalog, ROOT / "data")

    def invoke(purpose, prompt, payload, schema):
        evidence = {e["document_id"]: e["evidence_id"] for e in payload["evidence"]}
        return Generation(answer_status="answered", claims=[
            {"text": "피카츄가 가진 10만볼트는 상대에게 일반 피해를 줍니다.", "evidence_ids": [evidence["pokeapi:move:85"]]},
            {"text": "상대 교체를 고려해 공격 선택을 조정하세요.", "evidence_ids": [evidence["strategy:test"]]},
        ], assumptions=[], unknowns=[])

    result = build_graph(setup.vectors, SimpleNamespace(invoke=invoke)).invoke({
        "pokemon_id": "pokemon:25", "context_pokemon_ids": ["pokemon:635"], "question": "피카츄 대 삼삼드래", "battle_context": context,
    })["result"]
    assert "일반 피해" not in result["answer"]
    assert "전기 공격은 0.5배로 반감" in result["answer"]
    assert "상대 교체를 고려" in result["answer"]
