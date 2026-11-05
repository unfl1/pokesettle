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
  names?: Partial<Record<import('../../i18n/config').Locale, string>>;
  slugs?: Partial<Record<import('../../i18n/config').Locale, string>>;
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
  typeDefense?: {
    scope: 'generic';
    version: string;
    multipliers: { type: string; multiplier: number }[];
    sources: { sourceUrl: string; collectedAt: string; licence?: string; licenceUrl?: string }[];
  } | null;
  speciesId: number;
  nameSources?: { sourceUrl: string; collectedAt: string; contentHash: string }[];
  nameLicenceUrl?: string | null;
  baseStats: Record<StatName, number>;
  abilities: string[];
  abilityDetails?: { name: string; nameKo: string | null; names?: PokemonSummary['names'] }[];
  descriptions?: Partial<Record<import('../../i18n/config').Locale, { text: string; version: string }>>;
  localizationSources?: { url: string; collectedAt: string; contentHash: string }[];
  localizationLicenceUrl?: string | null;
  description: string | null;
  descriptionVersion?: string;
  learnset?: { versionGroup: string; moves: { name: string; nameEn?: string | null; names?: PokemonSummary['names']; method: string; level: number; pp?: number | null; statChanges?: { stat: string; change: number }[] | null; statTarget?: 'user' | 'target' | null; statChance?: number | null; effectMeta?: { category?: string | null; ailment?: string | null; ailmentChance?: number | null; flinchChance?: number | null; healing?: number | null; drain?: number | null; critRate?: number | null; minHits?: number | null; maxHits?: number | null; priority?: number | null; tags?: string[] } | null; effectTexts?: Partial<Record<import('../../i18n/config').Locale, { text: string; versionGroup: string }>> | null; type?: string | null; category?: string | null; power?: number | null; accuracy?: number | null }[] } | null;
  learnsetSources?: { url: string; collectedAt: string; contentHash: string }[];
  learnsetLicenceUrl?: string | null;
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
