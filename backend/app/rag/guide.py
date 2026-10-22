"""Verified-input fallback for the generic guide, never for strategy answers."""

from backend.app.catalog import metadata_text
from backend.app.rag.graph import render_answer
from backend.app.schemas import Generation


def metadata_guide(pokemon, evidence, regulation_id):
    # Only cite the selected form's indexed metadata if it matches the current catalog.
    metadata = next(
        (
            item
            for item in evidence
            if item.get("source_type") == "metadata"
            and item.get("pokemon_id") == pokemon.pokemon_id
            and item.get("text") == metadata_text(pokemon)
        ),
        None,
    )
    if metadata is None:
        return None
    eid = metadata["evidence_id"]
    stats = pokemon.base_stats
    facts = [
        f"일반 도감 타입: {', '.join(pokemon.types)}",
        f"일반 도감 종족값: HP {stats.hp}, 공격 {stats.attack}, 방어 {stats.defense}, "
        f"특수공격 {stats.sp_attack}, 특수방어 {stats.sp_defense}, 스피드 {stats.speed}",
    ]
    if pokemon.abilities:
        facts.append(f"일반 도감 특성 이름: {', '.join(pokemon.abilities)}")
    output = Generation(
        answer_status="partial",
        claims=[{"text": fact, "evidence_ids": [eid]} for fact in facts],
        assumptions=[],
        unknowns=[
            "가이드 인용 검증을 완료하지 못해 확인 가능한 도감 기본 정보만 표시합니다.",
            "특성 작용·운용 역할·추천 세트·Champions 적용 여부는 이 요약에서 확인하지 않았습니다.",
        ],
    )
    return render_answer(output, evidence, regulation_id)
