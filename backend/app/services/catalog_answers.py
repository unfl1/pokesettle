"""Conservative, model-free routing for explicit catalog-field questions."""

import re

from backend.app.catalog import metadata_text
from backend.app.pokemon_names import normalize_pokemon_names
from backend.app.rag.graph import render_answer
from backend.app.schemas import Generation
from backend.app.services.topics import mentioned_pokemon

FIELDS = {
    "types": r"타입|속성|types?",
    "stats": r"종족값|기본\s*능력치|base\s*stats?",
    "abilities": r"특성(?:\s*이름)?|abilities|ability",
    "moves": r"기술\s*목록|배우는\s*기술|배울\s*수\s*있는\s*기술|moves?",
    "description": r"도감\s*설명|도감\s*소개|생태|description",
    "all": r"기본\s*정보|기본\s*특징|도감\s*정보",
}


def catalog_question(catalog, selected_id, question):
    ids = mentioned_pokemon(catalog, question)
    if len(ids) > 1:
        return None
    pokemon = catalog.get(ids[0] if ids else selected_id)
    text = normalize_pokemon_names(catalog, question).casefold()
    text = re.sub(r"(?:이|선택한)\s*포켓몬|출처와\s*함께|근거와\s*함께", "", text)
    for name in (pokemon.name_ko, pokemon.name_en):
        if name:
            text = re.sub(re.escape(name.casefold()), "", text)
    fields = {key for key, pattern in FIELDS.items() if re.search(pattern, text, re.I)}
    if not fields:
        return None
    for pattern in FIELDS.values():
        text = re.sub(pattern, "", text, flags=re.I)
    text = re.sub(
        r"알려\s*줘(?:요)?|알려\s*주세요|보여\s*줘(?:요)?|뭐(?:야|예요|에요|지)?|무엇(?:인가요|이야)?|어떻게\s*돼|궁금해(?:요)?|설명해\s*줘|please|tell\s*me|what\s*(?:is|are)|the|and",
        "",
        text,
        flags=re.I,
    )
    # Only field names, simple particles and polite request forms may remain.
    text = re.sub(r"[\s.,?!·/]|의|은|는|이|가|을|를|과|와|좀", "", text)
    if text:
        return None  # Strategy, comparisons and unrecognized requests stay on RAG.
    return pokemon, fields


def catalog_navigation(catalog, selected_id, question):
    """Only complete lookup requests bypass the model gate; mixed tasks stay gated."""
    ids = mentioned_pokemon(catalog, question)
    if len(ids) > 1:
        return None
    pokemon = catalog.get(ids[0] if ids else selected_id) if ids or selected_id else None
    text = normalize_pokemon_names(catalog, question).casefold().strip()
    if ids:
        for name in (pokemon.name_ko, pokemon.name_en):
            if name:
                text = text.replace(name.casefold(), "")
        if re.fullmatch(
            r"[\s은는이가]*(?:(?:무슨|어떤)\s*포켓몬(?:이야|인가요|이니|인지|이죠)?|뭐(?:야|예요|에요|지)|누구(?:야|예요)|에\s*대해\s*알려\s*줘)[\s?.!]*",
            text,
        ):
            return navigation_result(pokemon)
    # No invented move list: link to the registered learnset and its type filter.
    types = {
        "노말": "normal",
        "불꽃": "fire",
        "물": "water",
        "전기": "electric",
        "풀": "grass",
        "얼음": "ice",
        "격투": "fighting",
        "독": "poison",
        "땅": "ground",
        "비행": "flying",
        "에스퍼": "psychic",
        "벌레": "bug",
        "바위": "rock",
        "고스트": "ghost",
        "드래곤": "dragon",
        "악": "dark",
        "강철": "steel",
        "페어리": "fairy",
    }
    match = re.fullmatch(
        r"[\s은는이가의]*(?P<type>"
        + "|".join(types)
        + r")?\s*(?:타입\s*)?기술(?:은|는|이|을|의)?\s*(?:뭐가\s*있어(?:요)?|무엇이\s*있나요|목록(?:을)?\s*(?:알려\s*줘(?:요)?|보여\s*줘(?:요)?)?|알려\s*줘(?:요)?)[\s?.!]*",
        text,
    )
    if match:
        return navigation_result(pokemon, types.get(match["type"]), moves=True)
    return None


def navigation_result(pokemon=None, move_type=None, *, moves=False):
    if moves and pokemon is None:
        answer = "기술은 도감에서 포켓몬을 선택한 뒤 ‘배울 수 있는 기술’과 타입별 필터로 확인할 수 있어요. 포켓몬마다 배울 수 있는 기술이 달라요."
    elif moves:
        answer = "이 포켓몬의 도감에서 등록된 기술과 타입별 목록을 확인해 보세요."
    else:
        answer = "포켓몬의 기본 정보는 도감에서 확인할 수 있어요. 아래 링크에서 타입·특성·종족값과 설명을 살펴보세요."
    return {
        "answer_status": "answered",
        "answer": answer,
        "citations": [],
        "facts": [],
        "assumptions": [],
        "unknowns": [],
        "feature": "catalog_navigation",
        "answer_path": "catalog_navigation",
        "catalog_navigation": {
            "pokemon": {
                key: value
                for key, value in pokemon.model_dump().items()
                if key in {"pokemon_id", "name_ko", "name_en", "names", "slugs"}
            }
            if pokemon
            else None,
            "move_type": move_type,
            "section": "moves" if moves else "profile",
        },
    }


def answer_catalog(pokemon, fields, regulation_id=None):
    if "all" in fields:
        fields = {"types", "stats", "abilities", "description"}
    facts, unknowns = [], []
    if "types" in fields:
        labels = {
            "normal": "노말",
            "fire": "불꽃",
            "water": "물",
            "electric": "전기",
            "grass": "풀",
            "ice": "얼음",
            "fighting": "격투",
            "poison": "독",
            "ground": "땅",
            "flying": "비행",
            "psychic": "에스퍼",
            "bug": "벌레",
            "rock": "바위",
            "ghost": "고스트",
            "dragon": "드래곤",
            "dark": "악",
            "steel": "강철",
            "fairy": "페어리",
        }
        facts.append(
            f"{pokemon.name_ko or pokemon.name_en}의 도감상 타입은 {' / '.join(labels.get(t, t) for t in pokemon.types)} 타입이에요."
        )
    if "stats" in fields:
        stats = pokemon.base_stats
        facts.append(
            f"종족값은 HP {stats.hp}, 공격 {stats.attack}, 방어 {stats.defense}, 특수공격 {stats.sp_attack}, 특수방어 {stats.sp_defense}, 스피드 {stats.speed}예요."
        )
    if "abilities" in fields:
        if pokemon.abilities:
            facts.append(
                "도감에 등록된 특성은 "
                + ", ".join(pokemon.abilities)
                + "예요. 지금 사용 중인 개체의 특성인지는 별도로 확인해야 해요."
            )
        else:
            unknowns.append("현재 도감에는 특성 이름이 등록되어 있지 않아요.")
    if "description" in fields:
        if pokemon.description:
            facts.append("도감 설명: " + pokemon.description)
        else:
            unknowns.append("현재 도감에는 설명이 등록되어 있지 않아요.")
    if "moves" in fields:
        if pokemon.available_moves:
            facts.append("등록된 일반 기술 목록: " + ", ".join(pokemon.available_moves))
        else:
            unknowns.append(
                "현재 로컬 도감에는 배울 수 있는 기술 목록이 없어요. 실제로 보유한 기술이나 현행 게임에서 배울 수 있는 기술은 아직 확인할 수 없어요."
            )
    eid = f"catalog:{pokemon.pokemon_id}"
    evidence = [
        {
            "evidence_id": eid,
            "number": 1,
            "text": metadata_text(pokemon),
            "title": f"{pokemon.name_ko or pokemon.name_en} 도감 기본 정보",
            "source_type": "metadata",
            "source_url": pokemon.source_url,
            "collected_at": pokemon.collected_at,
            "game": "generic",
            "verification_status": "unknown",
        }
    ]
    generated = Generation(
        answer_status="partial" if facts and unknowns else "answered" if facts else "abstained",
        claims=[{"text": fact, "evidence_ids": [eid]} for fact in facts],
        assumptions=[],
        unknowns=unknowns,
    )
    result = render_answer(generated, evidence, regulation_id)
    if not facts:
        result["answer"] = "\n".join(unknowns)
    result.update(feature="catalog_reference", answer_path="catalog_direct")
    return result
