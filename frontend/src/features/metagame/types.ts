import type { PokemonImages, PokemonSummary } from '../pokemon/types';

type Entry = { names?: PokemonSummary['names']; name: string; nameKo: string | null; rank: number; percentage: number | null };
export type MetaPokemon = {
  nameEn: string; nameKo: string | null; pokemonId: string | null; rank: number;
  images: PokemonImages | null; names?: PokemonSummary['names']; slugs?: PokemonSummary['slugs'];
  groups: { category: string; items: Entry[] }[];
};
export type SinglesMeta = {
  items: MetaPokemon[]; season: string; dataDate: string;
  collectedAt: string; providerGeneratedAt: string | null; stale: boolean;
  sourceUrl: string; termsUrl: string; attribution: string;
  nameSources: { url: string; collectedAt: string; contentHash: string }[];
  nameLicenceUrl: string | null;
};
