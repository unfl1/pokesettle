export interface PokemonSummary {
  pokemonId: string;
  nameKo: string | null;
  nameEn: string;
  types: string[];
  championsEligibilityStatus: 'unknown' | 'eligible' | 'ineligible';
  scope: string;
}
export type StatName =
  | 'hp'
  | 'attack'
  | 'defense'
  | 'spAttack'
  | 'spDefense'
  | 'speed';
export interface PokemonDetail extends PokemonSummary {
  speciesId: number;
  baseStats: Record<StatName, number>;
  abilities: string[];
  description: string | null;
  availableMoves: string[] | null;
  sourceUrl: string;
  collectedAt: string;
  fieldProvenance: Record<
    string,
    { verificationStatus: string; scope: string; sourceIds: string[] }
  >;
}
export interface Citation {
  evidenceId: string;
  number: number;
  title: string;
  sourceType: string;
  sourceUrl: string | null;
  collectedAt: string | null;
  game?: string;
  battleFormat?: string;
  licence?: string;
}
export interface GroundedResult {
  answerStatus: 'answered' | 'partial' | 'abstained';
  answer: string;
  citations: Citation[];
  citationNotice: string | null;
  assumptions: { text: string }[];
  unknowns: { field: string; reason: string }[];
  feature?: string;
  guideLimitations?: string[];
  conversationId?: string;
}
export interface Message {
  messageId: string;
  role: 'user' | 'assistant';
  content: string | GroundedResult;
  createdAt: string;
}
export interface Conversation {
  conversationId: string;
  pokemonId: string;
  title: string;
  messageCount: number;
  updatedAt: string | null;
}
export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
export interface Status {
  ready: boolean;
  modelConfigured: boolean;
  metadataCount: number;
  documentChunkCount: number;
  missing: string[];
}
export interface SafeError {
  code: string;
  message: string;
  retryable: boolean;
}
export interface Job {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'interrupted';
  stage: string;
  result: GroundedResult | null;
  error: SafeError | null;
}
export interface PendingJob {
  jobId: string;
  question: string;
  conversationId: string | null;
}
export interface DiscoveryResult
  extends Page<PokemonSummary & { baseStats: Record<StatName, number> }> {
  status: 'matched' | 'no_results' | 'needs_clarification';
  interpretation: string;
  unknownConditions: string[];
  excludedUnknownCount: number;
  interpretedFilters: { field: string; operator: string; value: string }[];
}
