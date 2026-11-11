"""Opt-in full catalog audit, including every ordered matchup's rendered action.

Default type-only coaching depends on ordered type lists, not species-specific
stats. Evaluate each type signature with the real evaluator, then render every
catalog pair with its real IDs/names. No mocked multipliers or generated facts.
Run with POKETACT_FULL_CATALOG_AUDIT=1.
"""

import os
from collections import Counter
from itertools import product

import pytest

from backend.app.battle.conversation import coach_fallback, evaluate_state
from backend.app.battle.engine import BattleEngine
from backend.app.battle.models import TeamAnalysis, TeamMember
from backend.app.catalog import Catalog
from backend.app.core.config import ROOT

pytestmark = pytest.mark.skipif(
    os.getenv("POKETACT_FULL_CATALOG_AUDIT") != "1",
    reason="전체 도감 추천 전수 검사: POKETACT_FULL_CATALOG_AUDIT=1 필요",
)
EVIDENCE = [{"source_type": "calculation", "evidence_id": "full-audit:type-chart"}]


def test_every_ordered_catalog_pair_has_action_reason_and_cautions():
    catalog = Catalog(ROOT / "data/pokemon.json")
    pokemon = list(catalog.items.values())
    signatures = {tuple(p.types): p for p in pokemon}
    contexts = {}
    for own_types, enemy_types in product(signatures, repeat=2):
        own, enemy = signatures[own_types], signatures[enemy_types]
        contexts[own_types, enemy_types] = evaluate_state(
            {"own_id": own.pokemon_id, "opponent_id": enemy.pokemon_id}, catalog, ROOT / "data"
        )
    checked = 0
    for own, enemy in product(pokemon, repeat=2):
        base = contexts[tuple(own.types), tuple(enemy.types)]
        context = {
            **base,
            "state": {"own_id": own.pokemon_id, "opponent_id": enemy.pokemon_id},
            "own_name": own.name_ko or own.name_en,
            "opponent_name": enemy.name_ko or enemy.name_en,
        }
        answer = coach_fallback(context, EVIDENCE)
        assert answer and len(answer.claims) >= 2, (own.pokemon_id, enemy.pokemon_id)
        first = answer.claims[0].text
        assert "공격" in first or "교체" in first
        assert "보유 기술과 교체 후보를 함께 비교해야" not in first
        assert all("다만,\n" not in claim.text for claim in answer.claims)
        assert all(c.evidence_ids == [EVIDENCE[0]["evidence_id"]] for c in answer.claims)
        assert context["probability"] is None
        best = max(a["multiplier"] for a in context["attacks"])
        incoming = max(d["multiplier"] for d in context["defense"])
        if best < 1 or (incoming > 1 and best <= 1):
            assert "교체" in first, (own.pokemon_id, enemy.pokemon_id, first)
        else:
            assert "공격" in first, (own.pokemon_id, enemy.pokemon_id, first)
        if any(a["multiplier"] == 0 for a in context["attacks"]):
            assert "통하지 않습니다" in "\n".join(c.text for c in answer.claims)
        checked += 1
    print(f"FULL_MATCHUPS catalog={len(pokemon)} signatures={len(signatures)} ordered_pairs={checked}")


def test_every_catalog_entry_participates_in_six_vs_six_on_both_sides():
    catalog = Catalog(ROOT / "data/pokemon.json")
    engine = BattleEngine(catalog, ROOT / "data")
    defaults = [p for p in catalog.items.values() if p.is_default]
    checked = 0
    for index, subject in enumerate(catalog.items.values()):
        companions = [
            defaults[(index + offset) % len(defaults)]
            for offset in range(12)
            if defaults[(index + offset) % len(defaults)].species_id != subject.species_id
        ]
        subject_team = [subject, *companions[:5]]
        other_team = companions[5:11]
        assert len(other_team) == 6
        for own, enemy in ((subject_team, other_team), (other_team, subject_team)):
            result = engine.selection(TeamAnalysis(
                own=[TeamMember(pokemon_id=p.pokemon_id) for p in own],
                opponent=[TeamMember(pokemon_id=p.pokemon_id) for p in enemy],
            ))
            candidates = result["candidates"]
            assert result["candidate_count"] == 20
            assert len({frozenset(c["pokemon_ids"]) for c in candidates}) == 20
            counts = Counter(pid for c in candidates for pid in c["pokemon_ids"])
            assert counts == {p.pokemon_id: 10 for p in own}
            assert all(c["lead_id"] in c["pokemon_ids"] for c in candidates)
            context = evaluate_state({
                "selection_requested": True,
                "own_team_ids": [p.pokemon_id for p in own],
                "opponent_team_ids": [p.pokemon_id for p in enemy],
            }, catalog, ROOT / "data")
            answer = coach_fallback(context, EVIDENCE)
            assert "조합을 추천" in answer.claims[0].text
            assert "선봉으로는" in answer.claims[0].text
            assert all("다만,\n" not in claim.text for claim in answer.claims)
            checked += 1
    print(f"FULL_SELECTION catalog={len(catalog.items)} six_vs_six_scenarios={checked}")
