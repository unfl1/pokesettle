"""Explain a calculated selection without inventing moves, damage, or strategy facts."""


def build_selection_plan(engine, body, own, opponent, candidate):
    selected = [i for i, p in enumerate(own) if p.pokemon_id in candidate["pokemon_ids"]]
    lead = next(i for i in selected if own[i].pokemon_id == candidate["lead_id"])

    def offense(i, enemy):
        attacks = engine.attack_types(body.own[i], own[i])
        if not attacks:
            return None, None
        attack = max(attacks, key=lambda t: engine.multiplier(t, enemy.types))
        return attack, engine.multiplier(attack, enemy.types)

    def defense(i, attacks):
        return max((engine.multiplier(t, own[i].types) for t in attacks), default=None)

    matchups = []
    for member, enemy in zip(body.opponent, opponent):
        attacks = engine.attack_types(member, enemy)
        attacker = max(
            selected,
            key=lambda i: (offense(i, enemy)[1] if offense(i, enemy)[1] is not None else -1, -i),
        )
        attack_type, attack_multiplier = offense(attacker, enemy)
        pivots = [i for i in selected if i != lead and attacks and defense(i, attacks) <= 1]
        pivot = (
            min(pivots, key=lambda i: (defense(i, attacks), -(offense(i, enemy)[1] or 0), i))
            if pivots
            else None
        )
        lead_attack_type, lead_attack = offense(lead, enemy)
        lead_defense = defense(lead, attacks)
        if lead_attack is not None and lead_attack > 1:
            action = "attack"
        elif lead_defense is not None and lead_defense > 1 and pivot is not None:
            action = "switch"
        elif (
            lead_attack is not None
            and lead_attack >= 1
            and (lead_defense is None or lead_defense <= 1)
        ):
            action = "attack"
        else:
            action = "caution"
        matchups.append(
            {
                "opponent_id": enemy.pokemon_id,
                "attacker_id": own[attacker].pokemon_id if attack_type else None,
                "attack_type": attack_type,
                "attack_multiplier": attack_multiplier,
                "attack_assumed": not body.own[attacker].moves,
                "incoming_types": attacks,
                "incoming_assumed": not member.moves,
                "pivot_id": own[pivot].pokemon_id if pivot is not None else None,
                "pivot_multiplier": defense(pivot, attacks) if pivot is not None else None,
                "lead_action": action,
                "lead_attack_type": lead_attack_type,
                "lead_attack_multiplier": lead_attack,
                "lead_incoming_multiplier": lead_defense,
            }
        )
    roles = []
    for i in selected:
        roles.append(
            {
                "pokemon_id": own[i].pokemon_id,
                "attack_assumed": not body.own[i].moves,
                "attack_targets": [
                    enemy.pokemon_id for enemy in opponent if (offense(i, enemy)[1] or 0) > 1
                ],
                "resist_targets": [
                    enemy.pokemon_id
                    for member, enemy in zip(body.opponent, opponent)
                    if (attacks := engine.attack_types(member, enemy)) and defense(i, attacks) < 1
                ],
            }
        )
    return {
        "pokemon_ids": candidate["pokemon_ids"],
        "lead_id": candidate["lead_id"],
        "members": roles,
        "matchups": matchups,
        "uncovered_opponent_ids": [
            m["opponent_id"] for m in matchups if (m["attack_multiplier"] or 0) <= 1
        ],
        "no_resist_opponent_ids": [
            enemy.pokemon_id
            for member, enemy in zip(body.opponent, opponent)
            if (attacks := engine.attack_types(member, enemy))
            and not any(defense(i, attacks) < 1 for i in selected)
        ],
        "lead_reason": "상대 6마리에 대한 약점 공략·반감 대응을 같은 점수로 비교한 단일 멤버 1위. 동점은 입력 순서 기준",
    }


def explain_selection(selection, names, type_labels):
    """Keep the default answer to three member reasons and one useful follow-up."""
    plan = selection["recommendation"]
    texts = []
    details = selection.get("member_details", {})
    for member in plan["members"]:
        pid = member["pokemon_id"]
        detail = details.get(pid, {})
        matchups = detail.get("matchups", [])
        attacks = [
            f"{names[m['opponent_id']]}에게 {m.get('move_name') or type_labels[m['attack_type']] + ' 타입 공격'}"
            for m in matchups if m["multiplier"] > 1
        ]
        if attacks:
            reason = ", ".join(attacks) + "으로 약점을 노릴 수 있어요."
        elif member["attack_targets"]:
            targets = ", ".join(names[enemy] for enemy in member["attack_targets"])
            reason = f"{targets}의 약점을 자기 타입 공격으로 노릴 수 있어요."
        else:
            reason = "공격으로 약점을 찌르기보다는 조합의 타입 보완 후보예요."
        if member["resist_targets"]:
            targets = ", ".join(names[enemy] for enemy in member["resist_targets"])
            reason += f" {targets}의 가정 공격 타입을 모두 반감·무효로 받을 수 있어요."
        texts.append(f"• {names[pid]}: {reason}")

    if selection.get("has_details"):
        provided = []
        for detail in selection.get("reported_settings", []):
            pid = detail["pokemon_id"]
            inputs = [*detail.get("move_names", [])]
            inputs += [detail[key] for key in ("ability", "item") if detail.get(key)]
            if inputs:
                provided.append(f"{'상대 ' if detail.get('side') == 'opponent' else ''}{names[pid]}: {', '.join(inputs)}")
        if provided:
            texts.append("알려주신 설정은 " + "; ".join(provided) + "으로 확인했어요.")
        unresolved = [name for detail in details.values() for name in detail.get("unresolved_moves", [])]
        if unresolved:
            texts.append(", ".join(dict.fromkeys(unresolved)) + "의 기술 타입은 자료에서 확인하지 못해 반영하지 않았어요.")
        texts.append(
            "확인된 기술은 공격 타입 비교에 반영했고, 기술 미공개 멤버는 자기 타입 공격을 가정했어요. "
            "특성·도구·기술 효과와 스피드·피해량은 이 상성 계산에 반영하지 않았어요."
        )
    else:
        texts.append(
            "기술 미공개 상태라 양쪽 모두 자기 타입 공격을 가정했어요. "
            "사용할 기술과 특성·도구를 알려주시면 이 타입 기준 후보에서 더 좁혀 볼 수 있어요. "
            "현재는 스피드·피해량·기술 효과를 계산하지 않은 추천이에요."
        )
    return texts
