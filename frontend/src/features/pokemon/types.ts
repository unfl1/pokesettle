import type { Page } from '../../types/api';

export interface PokemonImages {
  artworkUrl: string | null;
  spriteUrl: string | null;
  sourceUrl: string;
  rightsNotice: string;
  checkedAt: string;
  availability: 'checked_on_display';
}
export interface PokemonSummary {
  speciesId?: number;
  isDefault?: boolean;
  formIdentifier?: string | null;
  images?: PokemonImages | null;
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
export interface DiscoveryResult
  extends Page<PokemonSummary & { baseStats: Record<StatName, number> }> {
  status: 'matched' | 'no_results' | 'needs_clarification';
  interpretation: string;
  unknownConditions: string[];
  excludedUnknownCount: number;
  interpretedFilters: { field: string; operator: string; value: string }[];
}
