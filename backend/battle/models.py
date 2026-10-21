from typing import Literal

from pydantic import Field, field_validator

from backend.models import Model

TypeName = Literal[
    "normal",
    "fire",
    "water",
    "electric",
    "grass",
    "ice",
    "fighting",
    "poison",
    "ground",
    "flying",
    "psychic",
    "bug",
    "rock",
    "ghost",
    "dragon",
    "dark",
    "steel",
    "fairy",
]


class MoveInput(Model):
    name: str = Field(min_length=1, max_length=80)
    type: TypeName
    category: Literal["physical", "special", "status"] = "physical"


class TeamMember(Model):
    pokemon_id: str = Field(min_length=1, max_length=80)
    moves: list[MoveInput] = Field(default_factory=list, max_length=4)
    hp_percent: float | None = Field(default=None, ge=0, le=100, allow_inf_nan=False)
    item: str | None = Field(default=None, max_length=80)
    ability: str | None = Field(default=None, max_length=80)


class TeamInput(Model):
    name: str = Field(min_length=1, max_length=80)
    members: list[TeamMember] = Field(default_factory=list, max_length=6)

    @field_validator("name")
    @classmethod
    def nonempty_name(cls, value):
        if not value:
            raise ValueError("팀 이름 필요")
        return value


class TeamAnalysis(Model):
    own: list[TeamMember] = Field(min_length=1, max_length=6)
    opponent: list[TeamMember] = Field(min_length=1, max_length=6)


class BattleInput(TeamAnalysis):
    own_active: int = Field(default=0, ge=0, le=5)
    opponent_active: int = Field(default=0, ge=0, le=5)
    opponent_attack_types: list[TypeName] = Field(default_factory=list, max_length=18)
    mega_used: bool | None = None
    mega_target_id: str | None = Field(default=None, max_length=80)
    switch_blocked: bool | None = None
