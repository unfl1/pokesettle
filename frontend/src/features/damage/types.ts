import type { StatName } from '../pokemon/types';

export interface DamageMember {
  pokemonId: string;
  alignment: string;
  statPoints: Record<StatName, number>;
}
export interface DamageResult {
  engine: { name: string; version: string; level: number };
  calculation: {
    conditionalKo: {
      currentHp: number;
      maximumHp: number;
      hpBasis: 'provided' | 'full_hp_assumed';
      qualifyingRolls: number;
      totalRolls: number;
      outcome: 'all' | 'none' | 'some';
    };
    damage: {
      minimum: number;
      maximum: number;
      rolls: number[];
      defenderStats: Record<StatName, number>;
      move: { name: string; type: string; category: string; power: number };
    };
  };
  assumptions: string[];
  unknowns: string[];
  citations: { title: string; sourceUrl: string; version: string }[];
}

export interface DamageMoveOptions {
  pokemonId: string;
  versionGroup: string | null;
  championsLearnsetVerified: boolean;
  items: {
    name: string; nameKo: string | null; type: string | null;
    category: string | null; power: number | null; accuracy: number | null;
    methods: string[]; supported: boolean; unsupportedReason: string | null;
  }[];
}
