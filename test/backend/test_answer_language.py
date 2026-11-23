from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from backend.app.catalog import Catalog
from backend.app.core.errors import ServiceError
from backend.app.core.usage import active_usage
from backend.app.main import create_app
from backend.app.rag.graph import build_graph
from backend.app.rag.streaming import active_answer_preview
from backend.app.schemas import ChatRequest, Generation
from backend.app.services.answer_language import LocalizedAnswer, localize_answer
from backend.app.services.chat_scope import LANGUAGE_REFUSAL, ChatScope
from backend.app.services.topics import mentioned_pokemon
from test.backend.conftest import wait_for_job


def test_unsupported_language_stops_before_collection_and_state_changes(setup, monkeypatch):
    # Use a fresh, owned conversation with existing topic and battle state.
    owner = setup.store.new_session()
    cid = setup.store.conversation(owner, "pokemon:1", None)
    setup.store.put("chat_topic", cid, "pokemon:2")
    battle = {"own_id": "pokemon:1", "opponent_id": "pokemon:2"}
    setup.store.put("battle_state", cid, battle)
    calls = []

    def invoke(purpose, *args):
        calls.append(purpose)
        return ChatScope(in_scope=True, language="unsupported")

    monkeypatch.setattr(setup.model, "invoke", invoke)
    monkeypatch.setattr(setup.service, "collect", lambda *args: pytest.fail("collection must not run"))
    result = setup.service.chat(ChatRequest(
        pokemon_id="pokemon:1", question="¿De qué tipo es Pikachu?",
        conversation_id=cid, client_request_id=uuid4(),
    ), owner)
    assert result["answer"] == LANGUAGE_REFUSAL
    assert result["answer_status"] == "abstained"
    assert calls == ["chat_scope"]
    assert setup.store.get("chat_topic", cid) == "pokemon:2"
    assert setup.store.get("battle_state", cid) == battle
    assert setup.store.history(cid)[-1]["content"]["answer"] == LANGUAGE_REFUSAL


def test_generation_uses_classified_language_instead_of_question_script(setup, monkeypatch):
    def invoke(purpose, prompt, payload, schema):
        assert purpose == "generate"
        assert "Response language: English." in prompt
        return Generation(answer_status="answered", claims=[{
            "text": "It is a test type.", "evidence_ids": [payload["evidence"][0]["evidence_id"]],
        }], assumptions=[], unknowns=[])

    monkeypatch.setattr(setup.model, "invoke", invoke)
    result = build_graph(setup.vectors, setup.model).invoke({
        "pokemon_id": "pokemon:1", "question": "What type is 테스트1?",
        "response_language": "en",
    })["result"]
    assert "It is a test type." in result["answer"]


def test_foreign_question_localizes_before_saving_and_suppresses_unchecked_preview(setup, monkeypatch):
    original_invoke = setup.model.invoke
    calls = []

    def invoke(purpose, prompt, payload, schema):
        calls.append(purpose)
        if purpose == "chat_scope":
            return ChatScope(in_scope=True, language="en")
        if purpose == "generate":
            assert "Response language: English." in prompt
            assert active_answer_preview.get() is None
            return Generation(answer_status="answered", claims=[{
                "text": "물 타입입니다.", "evidence_ids": [payload["evidence"][0]["evidence_id"]],
            }], assumptions=[], unknowns=[])
        if purpose == "localize_answer":
            return LocalizedAnswer(texts=[text.replace("물 타입입니다.", "It is a Water type.") for text in payload["texts"]])
        return original_invoke(purpose, prompt, payload, schema)

    monkeypatch.setattr(setup.model, "invoke", invoke)
    previews = []
    token = active_answer_preview.set(previews.append)
    try:
        result = setup.service.chat(ChatRequest(
            pokemon_id="pokemon:1", question="Explain a safe strategy for 테스트1.",
            client_request_id=uuid4(),
        ), setup.store.new_session())
        assert active_answer_preview.get() == previews.append
    finally:
        active_answer_preview.reset(token)
    assert "It is a Water type." in result["answer"]
    assert "물 타입" not in result["answer"]
    assert previews == []
    assert calls.count("chat_scope") == calls.count("localize_answer") == 1
    assert setup.store.history(result["conversation_id"])[-1]["content"]["answer"] == result["answer"]


def test_localization_preserves_calculations_citations_and_saves_only_after_validation():
    original = {
        "answer": "물/비행 타입이며 전기 공격에 4배입니다. [근거 1]",
        "assumptions": [{"text": "일반 상성 기준임"}],
        "unknowns": [{"reason": "기술 미확인"}],
        "calculation": {"outputs": {"multiplier": 4}},
        "citations": [{"evidence_id": "original-id", "title": "Original title"}],
    }
    translated = [
        "Water/Flying type; Electric attacks have a 4× multiplier. [근거 1]",
        "Assuming general type matchups.", "Moves are unknown.",
    ]
    model = SimpleNamespace(invoke=lambda *args: LocalizedAnswer(texts=translated))
    result = localize_answer(model, deepcopy(original), "en", SimpleNamespace(items={}))
    assert result["answer"] == translated[0]
    assert result["calculation"] == original["calculation"]
    assert result["citations"] == original["citations"]
    assert result["unknowns"][0]["reason"] == translated[2]

    for changed in [translated[:-1], [translated[0].replace("4×", "2×"), *translated[1:]], [translated[0].replace("근거 1", "근거 2"), *translated[1:]]]:
        failed = deepcopy(original)
        model = SimpleNamespace(invoke=lambda *args: LocalizedAnswer(texts=changed))
        with pytest.raises(ServiceError):
            localize_answer(model, failed, "en", SimpleNamespace(items={}))
        assert failed == original


def test_already_localized_answer_needs_no_second_call():
    result = {"answer": "Gyarados is Water/Flying. [근거 1]"}
    model = SimpleNamespace(invoke=lambda *args: pytest.fail("unnecessary translation"))
    assert localize_answer(model, result, "en", SimpleNamespace(items={})) is result


def test_english_navigation_uses_quota_and_input_language_on_korean_site(setup, monkeypatch):
    setup.service.catalog = Catalog(Path("data/pokemon.json"))
    calls = []

    def invoke(purpose, prompt, payload, schema):
        calls.append(purpose)
        assert active_usage.get() is not None and active_usage.get()[1] is not None
        if purpose == "chat_scope":
            return ChatScope(in_scope=True, language="en")
        assert purpose == "localize_answer"
        assert "Response language: English." in prompt
        return LocalizedAnswer(texts=["Open the Pokédex to view this Pokémon's basic information."])

    monkeypatch.setattr(setup.model, "invoke", invoke)
    with TestClient(create_app(setup.settings, service=setup.service)) as client:
        client.post("/api/session")
        client.cookies.set("pokesettle_locale", "ko")
        submitted = client.post("/api/chat", json={
            "pokemonId": "pokemon:25", "question": "Pikachu types",
            "clientRequestId": str(uuid4()),
        })
        assert submitted.status_code == 202
        job = wait_for_job(client, submitted.json()["data"]["statusUrl"]).json()["data"]
        assert job["status"] == "completed"
        assert job["result"]["answer"].startswith("Open the Pokédex")
    assert calls == ["chat_scope", "localize_answer"]


@pytest.mark.parametrize("question", [
    "ギャラドスでライチュウと対面しています。",
    "我的暴鲤龙面对雷丘。",
    "My 갸라도스 is facing 라이츄.",
])
def test_localized_species_names_resolve_to_same_catalog_ids(question):
    catalog = Catalog(Path("data/pokemon.json"))
    assert mentioned_pokemon(catalog, question) == ["pokemon:130", "pokemon:26"]
