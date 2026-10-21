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


class Pokemon(Model):
    pokemon_id: str
    species_id: int = Field(gt=0)
    name_ko: str | None
    name_en: str
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


class Generation(Model):
    answer_status: Literal["answered", "partial", "abstained"]
    claims: list[Claim]
    assumptions: list[str]
    unknowns: list[str]


class ChatRequest(Model):
    pokemon_id: str = Field(min_length=1, max_length=80)
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
