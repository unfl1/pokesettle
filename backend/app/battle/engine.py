import json
from itertools import combinations
from math import prod
from pathlib import Path

from backend.app.core.errors import ServiceError


class BattleEngine:
    """Generic type-only scenarios, with no claims about Champions legality or damage."""

    def __init__(self, catalog, data_dir: Path):
        self.catalog = catalog
        path = data_dir / "type_chart.json"
        if not path.exists():
            raise ServiceError("TYPE_CHART_NOT_READY", "타입 상성 자료를 먼저 준비하세요.", 503)
        self.data = json.loads(path.read_text())
        self.chart = self.data["chart"]

    def validate_members(self, members):
        pokemon = [self.catalog.get(m.pokemon_id) for m in members]
        # Editor policy, not an unverified claim about a live regulation.
        if len({p.species_id for p in pokemon}) != len(pokemon):
            raise ServiceError(
                "DUPLICATE_SPECIES", "같은 종의 다른 폼을 포함해 한 종씩 입력하세요.", 422
            )
        if any(t not in self.chart for p in pokemon for t in p.types):
            raise ServiceError("UNSUPPORTED_TYPE", "지원하지 않는 타입 자료입니다.", 422)
        return pokemon

    def multiplier(self, attack, defenses):
        return prod(self.chart[attack][t] for t in defenses)

    def attack_types(self, member, pokemon):
        if member.moves:
            return list(dict.fromkeys(m.type for m in member.moves if m.category != "status"))
        return pokemon.types

    def context(self, members):
        pokemon = {m.pokemon_id: self.catalog.get(m.pokemon_id) for m in members}
        result = {
            "scope": "generic",
            "regulation_id": None,
            "facts": [
                {
                    "text": "수집된 일반 타입표와 도감 타입으로 계산",
                    "verification_status": "verified",
                    "scope": "generic",
                }
            ],
            "assumptions": [
                "입력한 폼·기술·HP·상태를 시나리오 입력으로 사용. 게임 내 보유·습득 여부 미검증"
            ],
            "unknowns": [
                "현재 Champions 레귤레이션·참가 적격성·아이템 및 기술 허용 여부 미확인",
                "특성·도구·필드·상태·능력치 변화·선공·기술 효과에 따른 결과 변화 미계산",
            ],
            "calculation": {
                "status": "type_only",
                "version": self.data["version"],
                "damage": None,
                "ko_probability": None,
                "win_probability": None,
            },
            "citations": [
                {"title": "PokéAPI 일반 타입 상성", **s, "scope": "generic"}
                for s in self.data["sources"]
            ]
            + [
                {
                    "title": f"{p.name_ko or p.name_en} 도감",
                    "source_url": p.source_url,
                    "collected_at": p.collected_at,
                    "scope": "generic",
                }
                for p in pokemon.values()
            ],
        }
        if any(m.hp_percent is None for m in members):
            result["assumptions"].append(
                "HP 미입력 멤버는 생존 가능 시나리오에 포함. 실제 생존·남은 HP는 미확인"
            )
        return result

    def team_analysis(self, body):
        own, opponent = self.validate_members(body.own), self.validate_members(body.opponent)
        rows = []
        for member, pokemon in zip(body.own, own):
            attacks = self.attack_types(member, pokemon)
            rows.append(
                {
                    "pokemon_id": pokemon.pokemon_id,
                    "coverage": [
                        {
                            "pokemon_id": enemy.pokemon_id,
                            "multiplier": max(
                                (self.multiplier(t, enemy.types) for t in attacks), default=None
                            ),
                        }
                        for enemy in opponent
                    ],
                    "defense": [
                        {"attack_type": t, "multiplier": self.multiplier(t, pokemon.types)}
                        for t in self.chart
                    ],
                }
            )
        weaknesses = [
            {
                "attack_type": t,
                "weak_count": sum(self.multiplier(t, p.types) > 1 for p in own),
                "resist_count": sum(self.multiplier(t, p.types) < 1 for p in own),
            }
            for t in self.chart
        ]
        context = self.context(body.own + body.opponent)
        if any(not m.moves for m in body.own):
            context["assumptions"].append(
                "기술 미입력 멤버의 공격 커버리지는 자신의 타입 공격을 보유한다고 가정"
            )
        return {
            **context,
            "members": rows,
            "shared_weaknesses": [r for r in weaknesses if r["weak_count"] >= 2],
            "role_gaps": ["회복·설치·제거·속도 제어 역할은 기술 효과 자료 부족으로 판정 유보"],
        }

    def selection(self, body):
        if len(body.own) != 6 or len(body.opponent) != 6:
            raise ServiceError(
                "SIX_MEMBERS_REQUIRED", "선출 비교에는 양쪽 팀을 각각 6마리 입력하세요.", 422
            )
        own, opponent = self.validate_members(body.own), self.validate_members(body.opponent)
        if any(m.hp_percent == 0 for m in body.own + body.opponent):
            raise ServiceError(
                "FAINTED_SELECTION", "선출 준비 팀에 쓰러진 멤버를 포함할 수 없습니다.", 422
            )
        enemy_types = [self.attack_types(m, p) for m, p in zip(body.opponent, opponent)]

        def components(indices):
            covered = sum(
                any(
                    self.multiplier(t, enemy.types) > 1
                    for i in indices
                    for t in self.attack_types(body.own[i], own[i])
                )
                for enemy in opponent
            )
            defended = sum(
                any(all(self.multiplier(t, own[i].types) < 1 for t in attacks) for i in indices)
                for attacks in enemy_types
                if attacks
            )
            shared = sum(
                max(0, sum(self.multiplier(t, own[i].types) > 1 for i in indices) - 1)
                for t in self.chart
            )
            return {
                "covered_opponents": covered,
                "resisted_scenarios": defended,
                "shared_weakness_penalty": shared,
                "score": 2 * covered + defended - shared,
            }

        candidates = []
        for indices in combinations(range(6), 3):
            parts = components(indices)
            lead = max(indices, key=lambda i: (components([i])["score"], -i))
            candidates.append(
                {
                    "pokemon_ids": [own[i].pokemon_id for i in indices],
                    "lead_id": own[lead].pokemon_id,
                    "components": parts,
                    "score": parts["score"],
                    "roles": [
                        {"pokemon_id": own[i].pokemon_id, "role": "타입 공격 커버·교체 대응 후보"}
                        for i in indices
                    ],
                    "mega_status": "폼 전환 가능 여부 및 비용 미확인",
                }
            )
        candidates.sort(key=lambda c: -c["score"])
        context = self.context(body.own + body.opponent)
        context["assumptions"] += [
            "6마리 중 3마리 선택을 준비 시나리오로 사용. 현재 랭크 규칙의 합법 판정 아님",
            "기술 미입력 시 해당 포켓몬 타입의 공격을 보유한다고 가정",
            "점수 = 약점 공략 상대 수×2 + 모든 가정 공격을 반감·무효화하는 대응 수 - 중복 약점 수. 동점은 입력 순서 유지",
            "선봉은 같은 척도의 단일 멤버 점수 기준. 행동 순서·역할 적합성은 미검증",
        ]
        return {
            **context,
            "score_kind": "heuristic_not_probability",
            "candidate_count": len(candidates),
            "candidates": candidates,
        }

    def battle(self, body):
        own, opponent = self.validate_members(body.own), self.validate_members(body.opponent)
        if body.own_active >= len(own) or body.opponent_active >= len(opponent):
            raise ServiceError("INVALID_ACTIVE_SLOT", "현재 포켓몬의 슬롯을 확인하세요.", 422)
        active, enemy = own[body.own_active], opponent[body.opponent_active]
        member, enemy_member = body.own[body.own_active], body.opponent[body.opponent_active]
        if enemy_member.hp_percent == 0:
            raise ServiceError("FAINTED_OPPONENT", "상대의 현재 포켓몬이 쓰러진 상태입니다.", 422)
        attacks = body.opponent_attack_types or self.attack_types(enemy_member, enemy)
        context = self.context(body.own + body.opponent)
        if not body.opponent_attack_types and not enemy_member.moves:
            context["assumptions"].append("상대 미공개 공격은 상대 포켓몬 타입의 공격으로 가정")
        options = []
        if member.hp_percent != 0:
            for move in member.moves:
                options.append(
                    {
                        "kind": "attack",
                        "label": move.name,
                        "pokemon_id": active.pokemon_id,
                        "multiplier": None
                        if move.category == "status"
                        else self.multiplier(move.type, enemy.types),
                        "reason": "변화 기술 효과 미계산"
                        if move.category == "status"
                        else "입력한 기술 타입과 상대 방어 타입의 일반 상성",
                        "risks": ["습득·적중·위력·선공·KO·상대 교체 및 특성 효과 미검증"],
                    }
                )
        if body.switch_blocked is not True:
            for i, (candidate, p) in enumerate(zip(body.own, own)):
                if i == body.own_active or candidate.hp_percent == 0:
                    continue
                worst = max((self.multiplier(t, p.types) for t in attacks), default=None)
                options.append(
                    {
                        "kind": "switch",
                        "label": p.name_ko or p.name_en,
                        "pokemon_id": p.pokemon_id,
                        "multiplier": worst,
                        "reason": "상대 입력·가정 공격 중 가장 불리한 타입 배율",
                        "risks": ["교체 가능 여부·진입 피해·특성·도구 및 실제 피해 미검증"],
                    }
                )
        if body.switch_blocked is None:
            context["unknowns"].append(
                "교체 봉쇄 상태 미입력. 교체 항목은 실행 가능 확정이 아닌 비교 시나리오"
            )
        mega = {
            "status": "unknown",
            "reason": "메가 사용 여부·전환 폼·현행 규칙 확인 필요",
            "type_comparison": None,
        }
        if body.mega_used is True:
            mega.update(
                status="already_used",
                reason="사용자가 이미 사용한 것으로 입력. 추가 메가 전환 후보 제외",
            )
        elif active.form_identifier and "mega" in active.form_identifier:
            mega.update(
                status="already_mega_form",
                reason="현재 도감 폼이 이미 메가 폼. 추가 전환 비교 제외",
            )
        elif body.mega_target_id:
            target = self.catalog.get(body.mega_target_id)
            if (
                target.species_id != active.species_id
                or not target.form_identifier
                or "mega" not in target.form_identifier
            ):
                raise ServiceError("INVALID_MEGA_FORM", "현재 종의 메가 폼을 선택하세요.", 422)
            if any(t not in self.chart for t in target.types):
                raise ServiceError("UNSUPPORTED_TYPE", "지원하지 않는 폼 타입입니다.", 422)
            if member.hp_percent == 0:
                mega.update(status="fainted", reason="현재 멤버가 쓰러진 상태. 전환 비교 제외")
            else:
                mega.update(
                    status="scenario_only",
                    reason="일반 도감의 전후 타입만 비교. 사용 가능·스톤·타이밍·변경 특성 및 현재 규칙 미검증",
                    type_comparison=[
                        {
                            "attack_type": t,
                            "before": self.multiplier(t, active.types),
                            "after": self.multiplier(t, target.types),
                        }
                        for t in attacks
                    ],
                )
                context["citations"].append(
                    {
                        "title": f"{target.name_ko or target.name_en} 폼",
                        "source_url": target.source_url,
                        "collected_at": target.collected_at,
                        "scope": "generic",
                    }
                )
        for kind in ["attack", "switch"]:
            group = [o for o in options if o["kind"] == kind and o["multiplier"] is not None]
            group.sort(key=lambda o: o["multiplier"], reverse=kind == "attack")
            for rank, option in enumerate(group, 1):
                option["comparison_order"] = rank
        return {
            **context,
            "recommended_action": None,
            "recommendation_status": "insufficient_battle_information",
            "options": options,
            "mega": mega,
            "notice": "공격은 높은 배율, 교체는 낮은 배율부터 별도 비교. 공격과 교체 사이의 우열·최선 행동은 타입만으로 확정하지 않음",
        }
