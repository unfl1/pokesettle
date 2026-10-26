import unicodedata
from collections import Counter
from dataclasses import replace
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from backend.app.battle.conversation import BattleUpdate, resolve_named_opponent
from backend.app.catalog import Catalog
from backend.app.core.config import ROOT
from backend.app.main import create_app
from backend.app.pokemon_names import normalize_pokemon_names
from backend.app.schemas import ChatRequest
from backend.app.services.catalog_answers import catalog_question
from backend.app.services.topics import mentioned_pokemon


@pytest.fixture(scope="module")
def catalog():
    return Catalog(ROOT / "data/pokemon.json")


@pytest.mark.parametrize("typed,canonical,pid", [
    ("피카추", "피카츄", "pokemon:25"),
    ("ㅍㅣzㅏ추", "피카츄", "pokemon:25"),
    ("ㅍㅣㅋㅏ츄", "피카츄", "pokemon:25"),
    ("볼카모스", "불카모스", "pokemon:637"),
    ("가라도수", "갸라도스", "pokemon:130"),
    ("ㅂㅜㄹㅋㅏㅁㅗㅅㅡ", "불카모스", "pokemon:637"),
])
def test_spelling_is_shared_by_topics_catalog_and_opponent(catalog, typed, canonical, pid):
    question = f"{typed}의 타입 뭐야?"
    assert normalize_pokemon_names(catalog, question) == f"{canonical}의 타입 뭐야?"
    assert mentioned_pokemon(catalog, question) == [pid]
    assert catalog_question(catalog, "pokemon:130", question)[0].pokemon_id == pid
    state = resolve_named_opponent(
        f"상대가 {typed}야", {"opponent_id": "pokemon:1", "opponent_moves": ["폭포오르기"]}, catalog
    )
    assert state["opponent_id"] == pid
    assert "opponent_moves" not in state


@pytest.mark.parametrize("text", [
    "피카츄", "불카모스", "뮤", "뮤츠", "모르는 이름", "타입 알려줘",
    "dragonite-like story", "메가 볼카모스", "메가볼카모스", "메가 리자몽",
    "피카츄 HP 50%이고 10만볼트를 가지고 있어", "피츄", "피카", "ㅍㅋㅊ",
])
def test_exact_names_short_inputs_and_unrelated_words_stay_unchanged(catalog, text):
    assert normalize_pokemon_names(catalog, text) == text


def test_ties_real_names_and_duplicate_forms_are_never_guessed():
    def make_catalog(names):
        return SimpleNamespace(items={str(i): SimpleNamespace(name_ko=name, pokemon_id=str(i)) for i, name in enumerate(names)})

    assert normalize_pokemon_names(make_catalog(["피카츄", "피카쿠"]), "피카추야") == "피카추야"
    assert normalize_pokemon_names(make_catalog(["피카츄", "피카츄"]), "피카추야") == "피카추야"
    assert normalize_pokemon_names(make_catalog(["피카츄", "피카추"]), "피카추야") == "피카추야"


@pytest.mark.parametrize("typed,expected", [("피카추", "피카츄"), ("ㅍㅣzㅏ추", "피카츄"), ("볼카모스", "불카모스")])
def test_typo_question_without_selected_id_uses_model_free_catalog(setup, catalog, typed, expected):
    setup.service.catalog = catalog
    setup.model.fail = True
    settings = replace(setup.settings, api_key="", chat_model="")
    with TestClient(create_app(settings, service=setup.service)) as client:
        client.post("/api/session")
        response = client.post("/api/chat", json={"question": f"{typed} 타입 뭐야?", "clientRequestId": str(uuid4())})
        assert response.status_code == 202
        job = client.get(response.json()["data"]["statusUrl"]).json()["data"]
        assert job["status"] == "completed"
        assert job["result"]["answerPath"] == "catalog_direct"
        assert expected in job["result"]["answer"]
    assert not setup.model.calls


def test_battle_interpretation_receives_repaired_names_but_stores_original_question(setup, catalog, monkeypatch):
    setup.service.catalog = catalog
    setup.service.settings = replace(setup.settings, data_dir=ROOT / "data")
    question = "내 선봉은 볼카모스이고 상대가 피카추야. 어떻게 해?"
    captured = []
    original = setup.model.invoke

    def invoke(purpose, prompt, payload, schema):
        if purpose == "battle_state":
            captured.append(payload)
            return BattleUpdate(relevant=True, own_id="pokemon:637", opponent_id="pokemon:25")
        return original(purpose, prompt, payload, schema)

    monkeypatch.setattr(setup.model, "invoke", invoke)
    for pid in ("pokemon:637", "pokemon:25"):
        setup.vectors.upsert_metadata([catalog.get(pid)])
    session = setup.store.new_session()
    result = setup.service.chat(ChatRequest(question=question, client_request_id=uuid4()), session)
    payload = captured[0]
    assert payload["question"] == question
    assert payload["question_with_normalized_pokemon_names"] == "내 선봉은 불카모스이고 상대가 피카츄야. 어떻게 해?"
    assert {p["pokemon_id"] for p in payload["candidate_pokemon"]} == {"pokemon:637", "pokemon:25"}
    assert result["battle_context"]["state"]["own_id"] == "pokemon:637"
    assert result["battle_context"]["state"]["opponent_id"] == "pokemon:25"
    assert setup.store.history(result["conversation_id"])[0]["content"] == question


def generated_spellings(name, kind):
    decomposed = unicodedata.normalize("NFD", name)
    vowels = [i for i, char in enumerate(decomposed) if "\u1161" <= char <= "\u1175"]
    consonants = [i for i, char in enumerate(decomposed) if "\u1100" <= char <= "\u1112"]
    if kind == "one_vowel":
        for i in vowels:
            replacement = "\u1165" if decomposed[i] != "\u1165" else "\u1161"
            yield unicodedata.normalize("NFC", decomposed[:i] + replacement + decomposed[i + 1:])
    elif kind == "two_vowels" and len(vowels) >= 4:
        chars = list(decomposed)
        for i in (vowels[0], vowels[-1]):
            chars[i] = "\u1165" if chars[i] != "\u1165" else "\u1161"
        yield unicodedata.normalize("NFC", "".join(chars))
    elif kind == "consonant":
        for i in dict.fromkeys([consonants[0], consonants[-1]]):
            replacement = "\u1100" if decomposed[i] != "\u1100" else "\u110f"
            yield unicodedata.normalize("NFC", decomposed[:i] + replacement + decomposed[i + 1:])
    elif kind == "syllable_delete" and len(name) >= 3:
        for i in range(len(name)):
            yield name[:i] + name[i + 1:]
    elif kind == "transpose":
        for i in range(len(name) - 1):
            if name[i] != name[i + 1]:
                yield name[:i] + name[i + 1] + name[i] + name[i + 2:]


@pytest.mark.parametrize("kind", ["one_vowel", "two_vowels", "consonant", "syllable_delete", "transpose"])
def test_catalog_wide_generated_typos_never_become_another_pokemon(catalog, kind):
    names = {p.name_ko for p in catalog.items.values() if p.name_ko}
    counts = Counter()
    for pokemon in catalog.items.values():
        if not pokemon.is_default or not pokemon.name_ko:
            continue
        for typed in generated_spellings(pokemon.name_ko, kind):
            counts["generated"] += 1
            for suffix in ("", "가", "인데"):
                text = typed + suffix
                repaired = normalize_pokemon_names(catalog, text)
                if typed in names:
                    assert repaired == text, (pokemon.name_ko, text, repaired)
                    counts["real_name_preserved"] += 1
                else:
                    # A held input is allowed; choosing another species is a failure.
                    assert repaired in {text, pokemon.name_ko + suffix}, (pokemon.name_ko, text, repaired)
                    counts["held" if repaired == text else "repaired"] += 1
    assert counts["generated"] > 0
    print(kind, dict(counts))


def test_every_exact_catalog_name_and_form_is_preserved(catalog):
    for pokemon in catalog.items.values():
        if pokemon.name_ko:
            for suffix in ("", "가", "야", "이고", "인데"):
                text = pokemon.name_ko + suffix
                assert normalize_pokemon_names(catalog, text) == text, text


def test_every_default_name_accepts_decomposed_and_compatibility_jamo(catalog):
    initial = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"
    vowel = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"
    final = "ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"
    table = {**{chr(0x1100 + i): char for i, char in enumerate(initial)},
             **{chr(0x1161 + i): char for i, char in enumerate(vowel)},
             **{chr(0x11A8 + i): char for i, char in enumerate(final)}}
    for pokemon in catalog.items.values():
        if pokemon.is_default and pokemon.name_ko:
            decomposed = unicodedata.normalize("NFD", pokemon.name_ko)
            compatibility = "".join(table.get(char, char) for char in decomposed)
            for typed in (decomposed, compatibility):
                assert normalize_pokemon_names(catalog, typed) == pokemon.name_ko, (pokemon.name_ko, typed)


@pytest.mark.parametrize("typed", ["파어리", "파이러", "니드리너", "슬리파", "라아티스", "티라오스", "나테일", "카리아스"])
def test_real_cross_species_conflicts_are_held(catalog, typed):
    assert normalize_pokemon_names(catalog, typed + "야") == typed + "야"


def test_closer_wrong_species_cannot_override_another_plausible_origin():
    catalog = SimpleNamespace(items={
        "intended": SimpleNamespace(name_ko="갸라도스", pokemon_id="intended"),
        "closer": SimpleNamespace(name_ko="가라도사", pokemon_id="closer"),
    })
    assert normalize_pokemon_names(catalog, "가라도수야") == "가라도수야"


def test_typo_overrides_model_confusing_gyarados_with_ariados(setup, catalog, monkeypatch):
    setup.service.catalog = catalog
    setup.service.settings = replace(setup.settings, data_dir=ROOT / "data")
    for pid in ("pokemon:25", "pokemon:130"):
        setup.vectors.upsert_metadata([catalog.get(pid)])
    session = setup.store.new_session()
    cid = setup.store.conversation(session, "pokemon:25", None)
    setup.store.put("battle_state", cid, {
        "own_id": "pokemon:25", "opponent_id": "pokemon:168",
        "opponent_hp_percent": 42, "opponent_moves": ["이전 입력 기술"],
    })
    original = setup.model.invoke

    def invoke(purpose, prompt, payload, schema):
        if purpose == "battle_state":
            return BattleUpdate(relevant=True, own_id="pokemon:25", opponent_id="pokemon:168")
        return original(purpose, prompt, payload, schema)

    monkeypatch.setattr(setup.model, "invoke", invoke)
    result = setup.service.chat(ChatRequest(
        question="내 피카츄 앞에 상대가 가라도수야. 어떻게 해?",
        conversation_id=cid, client_request_id=uuid4(),
    ), session)
    state = result["battle_context"]["state"]
    assert state["opponent_id"] == "pokemon:130"
    assert "opponent_hp_percent" not in state
    assert "opponent_moves" not in state
    assert setup.store.get("battle_state", cid)["opponent_id"] == "pokemon:130"
