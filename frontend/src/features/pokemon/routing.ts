import { localizedPath, type Locale } from '../../i18n/config';

type RoutePokemon = {
  pokemonId: string;
  names?: Partial<Record<Locale, string>>;
  slugs?: Partial<Record<Locale, string>>;
  nameKo?: string | null;
  nameEn?: string;
};
export function slugifyName(name: string) {
  return name.normalize('NFC').toLowerCase().replaceAll('♀', '-female').replaceAll('♂', '-male')
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, '-').replace(/^-+|-+$/g, '');
}
export function pokemonName(pokemon: RoutePokemon, locale: Locale) {
  return pokemon.names?.[locale] ?? (locale === 'ko' ? pokemon.nameKo : null) ?? pokemon.names?.en ?? pokemon.nameEn ?? pokemon.pokemonId;
}
export function pokemonSegment(pokemon: RoutePokemon) {
  const name = pokemon.slugs?.en ?? pokemon.names?.en ?? pokemon.nameEn ?? pokemon.pokemonId;
  return slugifyName(name.normalize('NFKD').replace(/\p{M}/gu, ''));
}
export function pokemonPath(pokemon: RoutePokemon, locale: Locale) {
  return localizedPath(locale, `/pokedex/${encodeURIComponent(pokemonSegment(pokemon))}`);
}
export function idFromSegment(segment: string) {
  const match = /^.+-([1-9]\d*)$/.exec(segment.normalize('NFC'));
  return match ? `pokemon:${match[1]}` : null;
}

export function referenceName(entry: { names?: Partial<Record<Locale, string>>; nameKo?: string | null; nameEn?: string | null; name: string }, locale: Locale) {
  return entry.names?.[locale] ?? (locale === 'ko' ? entry.nameKo : null) ?? entry.names?.en ?? entry.nameEn ?? entry.name;
}
