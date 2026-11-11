import { localizedPath, type Locale } from '../../i18n/config';
import { pokemonSegment } from '../pokemon/routing';
import type { MetaPokemon } from './types';

type MetaRoutePokemon = Parameters<typeof pokemonSegment>[0];
export function metagamePath(pokemon: MetaRoutePokemon, locale: Locale) {
  return localizedPath(locale, `/meta/${encodeURIComponent(pokemonSegment(pokemon))}`);
}
export function metagameSelectionPath(pokemon: MetaPokemon, locale: Locale) {
  return pokemon.pokemonId
    ? metagamePath({ ...pokemon, pokemonId: pokemon.pokemonId }, locale)
    : `${localizedPath(locale, '/meta')}?${new URLSearchParams({ pokemon: pokemon.nameEn })}`;
}
