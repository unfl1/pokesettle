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
export interface SelectionPlan {
  pokemonIds: string[];
  leadId: string;
  leadReason: string;
  members: { pokemonId: string; attackAssumed: boolean; attackTargets: string[]; resistTargets: string[] }[];
  matchups: {
    opponentId: string; attackerId: string | null; attackType: string | null;
    attackMultiplier: number | null; attackAssumed: boolean;
    incomingTypes: string[]; incomingAssumed: boolean;
    pivotId: string | null; pivotMultiplier: number | null;
    leadAction: 'attack' | 'switch' | 'caution'; leadAttackType: string | null;
    leadAttackMultiplier: number | null; leadIncomingMultiplier: number | null;
  }[];
  uncoveredOpponentIds: string[];
  noResistOpponentIds: string[];
}
export interface SelectionResult extends Context {
  recommendation?: SelectionPlan;
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
