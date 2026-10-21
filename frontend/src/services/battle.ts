import { post, request } from './api';

export interface MoveInput {
  name: string;
  type: string;
  category: 'physical' | 'special' | 'status';
}
export interface TeamMember {
  pokemonId: string;
  moves: MoveInput[];
  hpPercent: number | null;
  item: string | null;
  ability: string | null;
}
export interface SavedTeam {
  teamId: string;
  name: string;
  members: TeamMember[];
  updatedAt: string;
}
export interface Context {
  scope: string;
  assumptions: string[];
  unknowns: string[];
  citations: {
    title: string;
    sourceUrl: string;
    collectedAt: string;
    scope: string;
  }[];
}
export interface TeamResult extends Context {
  members: {
    pokemonId: string;
    coverage: { pokemonId: string; multiplier: number | null }[];
  }[];
  sharedWeaknesses: {
    attackType: string;
    weakCount: number;
    resistCount: number;
  }[];
  roleGaps: string[];
}
export interface SelectionResult extends Context {
  candidateCount: number;
  candidates: {
    pokemonIds: string[];
    leadId: string;
    score: number;
    components: {
      coveredOpponents: number;
      resistedScenarios: number;
      sharedWeaknessPenalty: number;
    };
  }[];
}
export interface BattleResult extends Context {
  notice: string;
  options: {
    kind: 'attack' | 'switch';
    label: string;
    pokemonId: string;
    multiplier: number | null;
    reason: string;
    risks: string[];
    comparisonOrder?: number;
  }[];
  mega: {
    status: string;
    reason: string;
    typeComparison:
      | { attackType: string; before: number; after: number }[]
      | null;
  };
}
export const battleApi = {
  teams: () => request<{ items: SavedTeam[]; total: number }>('/teams'),
  save: (name: string, members: TeamMember[], id?: string) =>
    request<SavedTeam>(id ? `/teams/${id}` : '/teams', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify({ name, members }),
    }),
  remove: (id: string) => request<void>(`/teams/${id}`, { method: 'DELETE' }),
  analyze: <T>(path: string, payload: unknown) => post<T>(path, payload),
};
