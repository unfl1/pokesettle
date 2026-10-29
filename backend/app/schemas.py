from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator
from pydantic.alias_generators import to_camel


class Model(BaseModel):
    model_config = ConfigDict(
        extra="forbid", populate_by_name=True, alias_generator=to_camel, str_strip_whitespace=True
    )


class Provenance(Model):
    source_ids: list[str]
    verification_status: Literal["verified", "assumed", "unknown"]
    scope: str
    verified_at: str | None


class Stats(Model):
    hp: int = Field(gt=0)
    attack: int = Field(gt=0)
    defense: int = Field(gt=0)
    sp_attack: int = Field(gt=0)
    sp_defense: int = Field(gt=0)
    speed: int = Field(gt=0)


class PokemonImages(Model):
    artwork_url: HttpUrl | None = None
    sprite_url: HttpUrl | None = None
    source_url: HttpUrl
    rights_notice: str
    checked_at: str
    availability: Literal["checked_on_display"] = "checked_on_display"


class Pokemon(Model):
    pokemon_id: str
    species_id: int = Field(gt=0)
    is_default: bool = True
    form_identifier: str | None = None
    images: PokemonImages | None = None
    name_ko: str | None
    name_en: str
    names: dict[str, str] = Field(default_factory=dict)
    slugs: dict[str, str] = Field(default_factory=dict)
    types: list[str] = Field(min_length=1, max_length=2)
    base_stats: Stats
    abilities: list[str]
    available_moves: list[str] | None = None
    mega_forms: list[str] | None = None
    champions_eligibility_status: Literal["unknown", "eligible", "ineligible"] = "unknown"
    eligible_regulations: list[str] | None = None
    description: str | None = None
    source_url: str
    collected_at: str
    field_provenance: dict[str, Provenance]
    scope: str = "generic"


class Document(Model):
    document_id: str
    title: str
    source_url: HttpUrl
    source_type: Literal["api", "wiki", "web", "pdf", "curated"] = "api"
    body: str = Field(min_length=1)
    collected_at: str
    revision_id: str
    licence: str
    licence_url: str
    rights_status: Literal["approved", "pending", "blocked"] = "approved"
    game: str = "generic"
    battle_format: str = "generic"
    regulation_id: str = "unknown"
    verification_status: Literal["verified", "assumed", "unknown"] = "unknown"


class Candidate(Model):
    candidate_id: str
    title: str
    summary: str
    source_url: str
    resource: str
    resource_id: str
    is_subject_document: bool = False


class SearchQuery(Model):
    query: str = Field(min_length=1, max_length=100)
    language: Literal["en", "ko"]


class QueryPlan(Model):
    queries: list[SearchQuery] = Field(max_length=5)


class Decision(Model):
    candidate_id: str
    reason: str


class Selection(Model):
    selected_candidate_ids: list[str]
    decisions: list[Decision]


class Claim(Model):
    text: str = Field(min_length=1)
    evidence_ids: list[str] = Field(min_length=1)
    source_versions: list[str] = Field(
        default_factory=list,
        description="Actual original game version identifiers in the cited Description entries. For metadata, or when no explicit version applies, return []. Never put scope labels such as generic or unknown here.",
    )

    @field_validator("source_versions")
    @classmethod
    def normalize_empty_versions(cls, values):
        # Some structured providers encode an empty array as [""]. This denotes
        # absence; nonempty identifiers still undergo citation validation.
        return [value.strip() for value in values if value.strip()]


class Generation(Model):
    answer_status: Literal["answered", "partial", "abstained"]
    claims: list[Claim]
    assumptions: list[str]
    unknowns: list[str]


class BattleExplanation(Model):
    claims: list[Claim] = Field(max_length=2)


class ChatRequest(Model):
    pokemon_id: str | None = Field(default=None, min_length=1, max_length=80)
    question: str = Field(min_length=1, max_length=2000)
    regulation_id: str | None = Field(default=None, max_length=80)
    client_request_id: UUID
    conversation_id: str | None = Field(default=None, max_length=80)

    @field_validator("question")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("질문을 입력하세요.")
        return value.strip()


class CollectRequest(Model):
    pokemon_id: str = Field(min_length=1, max_length=80)
    question: str = Field(min_length=1, max_length=2000)
    regulation_id: str | None = Field(default=None, max_length=80)
    client_request_id: UUID


class ConversationRequest(Model):
    pokemon_id: str | None = Field(default=None, min_length=1, max_length=80)
    regulation_id: str | None = Field(default=None, max_length=80)


class GuideRequest(Model):
    regulation_id: str | None = Field(default=None, max_length=80)
    conversation_id: str | None = Field(default=None, max_length=80)
    client_request_id: UUID


class DiscoveryRequest(Model):
    query: str = Field(min_length=1, max_length=2000)
    regulation_id: str | None = Field(default=None, max_length=80)
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class DiscoveryFilter(Model):
    field: Literal[
        "name",
        "types",
        "abilities",
        "champions_eligibility_status",
        "base_stats.hp",
        "base_stats.attack",
        "base_stats.defense",
        "base_stats.sp_attack",
        "base_stats.sp_defense",
        "base_stats.speed",
    ]
    operator: Literal["eq", "contains", "gte", "lte", "gt", "lt"]
    value: str


class DiscoveryPlan(Model):
    filters: list[DiscoveryFilter]
    requires_clarification: bool
    unresolved_conditions: list[str]
    explanation: str
