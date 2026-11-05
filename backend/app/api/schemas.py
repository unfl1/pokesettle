"""HTTP response contracts. Variable source snapshots and job results remain JSON objects."""

from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field, JsonValue
from pydantic.alias_generators import to_camel

from backend.app.battle.damage import DamageInput
from backend.app.battle.models import TeamMember
from backend.app.schemas import DiscoveryFilter, Pokemon, PokemonImages, Stats


class ResponseModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True, alias_generator=to_camel)


T = TypeVar("T")
JsonObject = dict[str, JsonValue]
JobStatus = Literal["queued", "running", "completed", "failed", "interrupted"]


class Envelope(ResponseModel, Generic[T]):
    data: T
    request_id: str
    warnings: list[str]


class ErrorDetail(ResponseModel):
    field: str
    code: str


class SafeError(ResponseModel):
    code: str
    message: str
    retryable: bool
    details: list[ErrorDetail]


class ErrorResponse(ResponseModel):
    error: SafeError
    request_id: str


class Items(ResponseModel, Generic[T]):
    items: list[T]
    total: int


class Page(Items[T], Generic[T]):
    limit: int
    offset: int


class RetrievalSettings(ResponseModel):
    search_mode: str
    top_k: int
    mmr_fetch_k: int
    mmr_lambda_mult: float


class StatusData(ResponseModel):
    ready: bool
    model_configured: bool
    metadata_count: int
    species_count: int
    alternate_variety_count: int
    document_chunk_count: int
    retrieval: RetrievalSettings
    missing: list[str]
    regulation_verification_status: Literal["unknown"]


class SessionData(ResponseModel):
    active: bool


class RegulationsData(ResponseModel):
    # Files are externally configured snapshots, not a fixed battle rules model.
    items: list[JsonObject]


class PokemonSummary(ResponseModel):
    pokemon_id: str
    species_id: int
    is_default: bool
    form_identifier: str | None
    images: PokemonImages | None
    name_ko: str | None
    name_en: str
    names: dict[str, str]
    slugs: dict[str, str]
    types: list[str]
    champions_eligibility_status: Literal["unknown", "eligible", "ineligible"]
    scope: str


class AbilityDetail(ResponseModel):
    name: str
    name_ko: str | None
    names: dict[str, str]


class Description(ResponseModel):
    text: str
    version: str


class MoveStatChange(ResponseModel):
    stat: str
    change: int


class MoveEffectText(ResponseModel):
    text: str
    version_group: str


class MoveEffectMeta(ResponseModel):
    category: str | None = None
    ailment: str | None = None
    ailment_chance: int | None = None
    flinch_chance: int | None = None
    healing: int | None = None
    drain: int | None = None
    crit_rate: int | None = None
    min_hits: int | None = None
    max_hits: int | None = None
    priority: int | None = None
    tags: list[str] = Field(default_factory=list)


class LearnsetMove(ResponseModel):
    pp: int | None = None
    stat_changes: list[MoveStatChange] | None = None
    stat_target: Literal["user", "target"] | None = None
    stat_chance: int | None = None
    effect_texts: dict[str, MoveEffectText] | None = None
    effect_meta: MoveEffectMeta | None = None
    name: str
    method: str
    level: int
    name_en: str | None
    type: str | None
    category: str | None
    power: int | None
    accuracy: int | None
    names: dict[str, str] | None


class Learnset(ResponseModel):
    version_group: str
    moves: list[LearnsetMove]


class TypeMultiplier(ResponseModel):
    type: str
    multiplier: float


class TypeDefense(ResponseModel):
    scope: Literal["generic"]
    version: str
    multipliers: list[TypeMultiplier]
    sources: list[JsonObject]


class PokemonDetail(Pokemon):
    type_defense: TypeDefense | None = None
    name_sources: list[JsonObject]
    name_licence_url: str | None
    ability_details: list[AbilityDetail]
    descriptions: dict[str, Description]
    localization_sources: list[JsonObject]
    localization_licence_url: str | None
    description_version: str | None = None
    learnset: Learnset | None
    learnset_sources: list[JsonObject]
    learnset_licence_url: str | None


class ConversationCreated(ResponseModel):
    conversation_id: str
    pokemon_id: str | None
    regulation_id: str | None


class ConversationData(ConversationCreated):
    title: str
    updated_at: str | None
    message_count: int


class MessageData(ResponseModel):
    message_id: str
    role: Literal["user", "assistant"]
    # Stored answers retain their feature-specific evidence and battle context.
    content: str | JsonObject
    created_at: str


class MessagesData(Page[MessageData]):
    conversation_id: str
    pokemon_id: str


class JobAccepted(ResponseModel):
    job_id: str
    status: JobStatus
    status_url: str


class JobData(ResponseModel):
    job_id: str
    status: JobStatus
    stage: str
    progress: float | None
    cache: JsonObject
    result: JsonObject | None
    error: SafeError | None
    created_at: str
    updated_at: str


class SavedTeam(ResponseModel):
    team_id: str
    name: str
    members: list[TeamMember]
    updated_at: str


class ConversationTarget(ResponseModel):
    pokemon_id: str


class DiscoveryItem(PokemonSummary):
    base_stats: Stats
    matched_conditions: list[DiscoveryFilter]
    supporting_evidence_ids: list[str]
    source_url: str
    conversation_target: ConversationTarget


class DiscoveryData(Page[DiscoveryItem]):
    status: Literal["needs_clarification", "matched", "no_results"]
    interpretation: str
    interpreted_filters: list[DiscoveryFilter]
    unknown_conditions: list[str]
    excluded_unknown_count: int
    completeness: Literal["complete_for_structured_filters"]
    scope: str


class BattleContext(ResponseModel):
    scope: str
    regulation_id: str | None
    facts: list[JsonObject]
    assumptions: list[str]
    unknowns: list[str]
    calculation: JsonObject
    citations: list[JsonObject]


class Coverage(ResponseModel):
    pokemon_id: str
    multiplier: float | None


class TypeMultiplier(ResponseModel):
    attack_type: str
    multiplier: float


class TeamCoverage(ResponseModel):
    pokemon_id: str
    coverage: list[Coverage]
    defense: list[TypeMultiplier]


class SharedWeakness(ResponseModel):
    attack_type: str
    weak_count: int
    resist_count: int


class TeamAnalysisData(BattleContext):
    members: list[TeamCoverage]
    shared_weaknesses: list[SharedWeakness]
    role_gaps: list[str]


class SelectionComponents(ResponseModel):
    covered_opponents: int
    resisted_scenarios: int
    shared_weakness_penalty: int
    score: int


class SelectionRole(ResponseModel):
    pokemon_id: str
    role: str


class SelectionCandidate(ResponseModel):
    pokemon_ids: list[str]
    lead_id: str
    components: SelectionComponents
    score: int
    roles: list[SelectionRole]
    mega_status: str


class SelectionMember(ResponseModel):
    pokemon_id: str
    attack_assumed: bool
    attack_targets: list[str]
    resist_targets: list[str]


class SelectionMatchup(ResponseModel):
    opponent_id: str
    attacker_id: str | None
    attack_type: str | None
    attack_multiplier: float | None
    attack_assumed: bool
    incoming_types: list[str]
    incoming_assumed: bool
    pivot_id: str | None
    pivot_multiplier: float | None
    lead_action: Literal["attack", "switch", "caution"]
    lead_attack_type: str | None
    lead_attack_multiplier: float | None
    lead_incoming_multiplier: float | None


class SelectionPlan(ResponseModel):
    pokemon_ids: list[str]
    lead_id: str
    members: list[SelectionMember]
    matchups: list[SelectionMatchup]
    uncovered_opponent_ids: list[str]
    no_resist_opponent_ids: list[str]
    lead_reason: str


class SelectionData(BattleContext):
    score_kind: Literal["heuristic_not_probability"]
    candidate_count: int
    recommendation: SelectionPlan
    candidates: list[SelectionCandidate]


class BattleOption(ResponseModel):
    kind: Literal["attack", "switch"]
    label: str
    pokemon_id: str
    multiplier: float | None
    reason: str
    risks: list[str]
    comparison_order: int | None = None


class TypeComparison(ResponseModel):
    attack_type: str
    before: float
    after: float


class MegaData(ResponseModel):
    status: str
    reason: str
    type_comparison: list[TypeComparison] | None


class BattleData(BattleContext):
    recommended_action: None
    recommendation_status: str
    options: list[BattleOption]
    mega: MegaData
    notice: str


class DamageMove(ResponseModel):
    name: str
    name_ko: str | None
    type: str | None
    category: str | None
    power: int | None
    accuracy: int | None
    names: dict[str, str]
    supported: bool
    unsupported_reason: str | None
    methods: list[str]


class DamageMovesData(ResponseModel):
    pokemon_id: str
    version_group: str | None
    items: list[DamageMove]
    sources: list[JsonObject]
    champions_learnset_verified: bool


class DamageEngine(ResponseModel):
    name: str
    version: str
    generation: int
    level: int


class DamageMoveResult(ResponseModel):
    name: str
    type: str
    category: str
    power: int


class DamageRolls(ResponseModel):
    minimum: int
    maximum: int
    rolls: list[int]
    defender_stats: Stats
    attacker_stats: Stats
    move: DamageMoveResult


class ConditionalKo(ResponseModel):
    current_hp: int
    maximum_hp: int
    hp_basis: Literal["provided", "full_hp_assumed"]
    qualifying_rolls: int
    total_rolls: int
    outcome: Literal["all", "none", "some"]
    scope: str


class DamageCalculation(ResponseModel):
    status: str
    damage: DamageRolls
    conditional_ko: ConditionalKo
    ko_probability: None
    win_probability: None


class LearnsetReference(ResponseModel):
    version_group: str
    move: str
    sources: list[JsonObject]
    champions_verified: bool


class DamageData(ResponseModel):
    scope: str
    verification_status: Literal["assumed"]
    in_game_verified: bool
    legality_verified: bool
    engine: DamageEngine
    inputs: DamageInput
    learnset_reference: LearnsetReference
    calculation: DamageCalculation
    assumptions: list[str]
    unknowns: list[str]
    citations: list[JsonObject]


class MetaEntry(ResponseModel):
    name: str
    rank: int
    percentage: float | None
    name_ko: str | None
    names: dict[str, str]


class MetaGroup(ResponseModel):
    category: str
    items: list[MetaEntry]


class MetaPokemon(ResponseModel):
    name_en: str
    name_ko: str | None
    pokemon_id: str | None
    names: dict[str, str]
    slugs: dict[str, str]
    images: PokemonImages | None
    rank: int
    groups: list[MetaGroup]


class SinglesMetaData(ResponseModel):
    items: list[MetaPokemon]
    season: str
    data_date: str
    provider_generated_at: str | None
    collected_at: str
    source_url: str
    terms_url: str
    attribution: str
    format: str
    regulation_id: str | None
    stale: bool
    limit: int
    name_sources: list[JsonObject]
    name_licence_url: str | None
