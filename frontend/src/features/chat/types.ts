import type { SafeError } from '../../types/api';

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
  licenceUrl?: string | null;
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
  battleContext?: {
    ownName?: string;
    opponentName?: string;
    scope: string;
    state: { ownHpPercent?: number; ownMoves?: string[]; ownAttackTypes?: string[]; requestedDefensiveType?: string };
    recommendation: string;
    switches?: { pokemonId: string; name: string; worstMultiplier: number; comparisonOrder: number; hpPercent: number | null; defense: {type: string; multiplier: number}[] }[];
    knownMoves?: {side: string; name: string; nameKo: string | null; type: string; category: string}[];
    damageComparisons?: {calculation: {damage: {minimum: number; maximum: number}}}[];
  };
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
