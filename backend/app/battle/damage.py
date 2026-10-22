import json
import os
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

    @field_validator("neutral_conditions")
    @classmethod
    def require_neutral_conditions(cls, value):
        if not value:
            raise ValueError("초기 계산은 특성·도구·상태·필드 효과 없는 조건만 지원")
        return value


def calculate_damage(body, catalog, settings):
    payload = body.model_dump()
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
        if damage["minimum"] != min(rolls) or damage["maximum"] != max(rolls):
            raise ValueError
    except (ValueError, TypeError, KeyError, AttributeError):
        raise ServiceError(
            "DAMAGE_ENGINE_NOT_READY", "계산기 설치·버전·응답 형식을 확인하세요.", 503
        ) from None
    return {
        "scope": "champions_reference_scenario",
        "verification_status": "assumed",
        "in_game_verified": False,
        "legality_verified": False,
        "engine": {"name": "@smogon/calc", "version": "0.12.0", "generation": 0, "level": 50},
        "inputs": body.model_dump(),
        "calculation": {
            "status": "reference_scenario",
            "damage": damage,
            "ko_probability": None,
            "win_probability": None,
        },
        "assumptions": [
            "참조 엔진 레벨 50·싱글·명중·단일 타격·비급소, 특성·도구·상태·날씨·필드·능력치 변화 효과 없음",
            "기술의 부가 효과·반동·이후 턴 변화는 계산 대상에서 제외",
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
