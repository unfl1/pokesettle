import json
import os
import re
import shutil
import subprocess
from typing import Literal

from pydantic import Field, field_validator, model_validator

from backend.app.core.config import ROOT
from backend.app.core.errors import ServiceError
from backend.app.schemas import Model


class StatPoints(Model):
    hp: int = Field(ge=0, le=32, strict=True)
    attack: int = Field(ge=0, le=32, strict=True)
    defense: int = Field(ge=0, le=32, strict=True)
    sp_attack: int = Field(ge=0, le=32, strict=True)
    sp_defense: int = Field(ge=0, le=32, strict=True)
    speed: int = Field(ge=0, le=32, strict=True)

    @model_validator(mode="after")
    def validate_total(self):
        if sum(self.model_dump().values()) > 66:
            raise ValueError("능력 포인트 합계는 66 이하여야 합니다.")
        return self


class DamageMember(Model):
    pokemon_id: str = Field(min_length=1, max_length=80)
    stat_points: StatPoints
    alignment: Literal[
        "Adamant",
        "Bashful",
        "Bold",
        "Brave",
        "Calm",
        "Careful",
        "Docile",
        "Gentle",
        "Hardy",
        "Hasty",
        "Impish",
        "Jolly",
        "Lax",
        "Lonely",
        "Mild",
        "Modest",
        "Naive",
        "Naughty",
        "Quiet",
        "Quirky",
        "Rash",
        "Relaxed",
        "Sassy",
        "Serious",
        "Timid",
    ]


class DamageInput(Model):
    attacker: DamageMember
    defender: DamageMember
    move: str = Field(min_length=1, max_length=80)
    neutral_conditions: bool = Field(strict=True)
    defender_current_hp: int | None = Field(default=None, ge=1, strict=True)

    @field_validator("neutral_conditions")
    @classmethod
    def require_neutral_conditions(cls, value):
        if not value:
            raise ValueError("초기 계산은 특성·도구·상태·필드 효과 없는 조건만 지원")
        return value


SUPPORTED_MOVES = json.loads((ROOT / "backend/calculator/supported_moves.json").read_text())


def move_key(name):
    return re.sub(r"[^a-z0-9]", "", name.lower())


def damage_move_options(catalog, pokemon_id):
    profile = catalog.profile(pokemon_id)
    learnset = profile.get("learnset")
    result = {
        "pokemon_id": pokemon_id,
        "version_group": learnset.get("version_group") if learnset else None,
        "items": [],
        "sources": profile.get("learnset_sources", []),
        "champions_learnset_verified": False,
    }
    if not learnset:
        return result
    supported = {move_key(name) for name in SUPPORTED_MOVES}
    by_name = {move_key(m["name"]): m for m in catalog.move_details.values()}
    rows = {}
    for entry in learnset["moves"]:
        data = catalog.move_details.get(entry["name"]) or by_name.get(move_key(entry["name"]))
        if not data:
            continue
        name = data["name"]
        if name not in rows:
            reason = (
                None
                if move_key(name) in supported
                else (
                    "변화 기술은 직접 피해 계산 대상이 아닙니다."
                    if data.get("category") == "status"
                    else "이 기술의 특수 조건 또는 계산기 지원 여부는 아직 검증하지 않았습니다."
                )
            )
            rows[name] = {
                **data,
                "supported": reason is None,
                "unsupported_reason": reason,
                "methods": [],
            }
        if entry["method"] not in rows[name]["methods"]:
            rows[name]["methods"].append(entry["method"])
    result["items"] = sorted(
        rows.values(), key=lambda m: (m.get("type") or "", m.get("name_ko") or m["name"])
    )
    return result


def calculate_damage(body, catalog, settings):
    options = damage_move_options(catalog, body.attacker.pokemon_id)
    selected = next(
        (
            m
            for m in options["items"]
            if move_key(m["name"]) == move_key(body.move) or m.get("name_ko") == body.move
        ),
        None,
    )
    if not options["version_group"]:
        raise ServiceError(
            "DAMAGE_LEARNSET_NOT_READY", "공격자의 습득 기술 자료가 없어 계산할 수 없습니다.", 422
        )
    if selected is None:
        raise ServiceError(
            "DAMAGE_MOVE_NOT_LEARNED",
            "수집된 원본 게임 습득 기술에서 선택한 기술을 확인할 수 없습니다.",
            422,
        )
    if not selected["supported"]:
        raise ServiceError("DAMAGE_UNSUPPORTED_INPUT", selected["unsupported_reason"], 422)
    payload = body.model_dump()
    payload["move"] = move_key(selected["name"])
    for side in ("attacker", "defender"):
        member = getattr(body, side)
        payload[side]["name"] = catalog.get(member.pokemon_id).name_en
    executable = shutil.which(settings.damage_node_binary)
    if not executable:
        raise ServiceError(
            "DAMAGE_ENGINE_NOT_READY", "데미지 계산용 Node.js 설정을 확인하세요.", 503
        )
    try:
        process = subprocess.run(
            [executable, str(ROOT / "backend/calculator/calculate.cjs")],
            input=json.dumps(payload),
            text=True,
            capture_output=True,
            timeout=5,
            env={"PATH": os.defpath},
        )
    except subprocess.TimeoutExpired:
        raise ServiceError(
            "DAMAGE_ENGINE_TIMEOUT", "데미지 계산 시간이 초과되었습니다.", 504, True
        ) from None
    except OSError:
        raise ServiceError(
            "DAMAGE_ENGINE_NOT_READY", "데미지 계산기를 실행할 수 없습니다.", 503
        ) from None
    try:
        if process.returncode != 0:
            raise ValueError
        result = json.loads(process.stdout)
        if not result.get("ok"):
            if result.get("code") in {
                "UNSUPPORTED_MOVE",
                "UNSUPPORTED_SPECIES",
                "UNSUPPORTED_ALIGNMENT",
                "INVALID_STAT_POINTS",
            }:
                raise ServiceError(
                    "DAMAGE_UNSUPPORTED_INPUT", "지원하는 포켓몬·기술·육성 입력을 확인하세요.", 422
                )
            raise ValueError
        damage = result["result"]
        rolls = damage["rolls"]
        if len(rolls) != 16 or any(type(n) is not int or n < 0 for n in rolls):
            raise ValueError
        maximum_hp = damage["defender_stats"]["hp"]
        if type(maximum_hp) is not int or maximum_hp < 1:
            raise ValueError
        if damage["minimum"] != min(rolls) or damage["maximum"] != max(rolls):
            raise ValueError
    except (ValueError, TypeError, KeyError, AttributeError):
        raise ServiceError(
            "DAMAGE_ENGINE_NOT_READY", "계산기 설치·버전·응답 형식을 확인하세요.", 503
        ) from None
    current_hp = body.defender_current_hp if body.defender_current_hp is not None else maximum_hp
    if current_hp > maximum_hp:
        raise ServiceError(
            "DAMAGE_HP_OUT_OF_RANGE", "방어자 남은 HP가 계산된 최대 HP를 초과합니다.", 422
        )
    ko_count = sum(value >= current_hp for value in rolls)
    return {
        "scope": "champions_reference_scenario",
        "verification_status": "assumed",
        "in_game_verified": False,
        "legality_verified": False,
        "engine": {"name": "@smogon/calc", "version": "0.12.0", "generation": 0, "level": 50},
        "inputs": body.model_dump(),
        "learnset_reference": {
            "version_group": options["version_group"],
            "move": selected["name"],
            "sources": options["sources"],
            "champions_verified": False,
        },
        "calculation": {
            "status": "reference_scenario",
            "damage": damage,
            "conditional_ko": {
                "current_hp": current_hp,
                "maximum_hp": maximum_hp,
                "hp_basis": "provided"
                if body.defender_current_hp is not None
                else "full_hp_assumed",
                "qualifying_rolls": ko_count,
                "total_rolls": len(rolls),
                "outcome": "all" if ko_count == len(rolls) else "none" if ko_count == 0 else "some",
                "scope": "single_hit_reference_candidates",
            },
            "ko_probability": None,
            "win_probability": None,
        },
        "assumptions": [
            "참조 엔진 레벨 50·싱글·명중·단일 타격·비급소, 특성·도구·상태·날씨·필드·능력치 변화 효과 없음",
            "기술의 부가 효과·반동·이후 턴 변화는 계산 대상에서 제외",
            "조건부 KO는 피해 후보와 남은 HP의 정수 비교, 후보별 발생 확률·실제 게임 KO 확률 검증 아님",
        ],
        "unknowns": ["실제 게임 피해 대조·현행 레귤레이션 적격성·기술 습득 여부 미검증"],
        "citations": [
            {
                "title": "Smogon Champions reference implementation",
                "source_url": "https://github.com/smogon/damage-calc",
                "version": "0.12.0",
            }
        ],
    }
