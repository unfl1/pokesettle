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
