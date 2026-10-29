import type { Locale } from '../../i18n/config';

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
export function pokemonSegment(pokemon: RoutePokemon, locale: Locale) {
  const match = /^pokemon:([1-9]\d*)$/.exec(pokemon.pokemonId);
  if (!match) throw new Error('Invalid Pokémon resource ID');
  const slug = pokemon.slugs?.[locale] ?? slugifyName(pokemonName(pokemon, locale));
  return `${slug}-${match[1]}`;
}
export function pokemonPath(pokemon: RoutePokemon, locale: Locale) {
  return `/${locale}/pokedex/${encodeURIComponent(pokemonSegment(pokemon, locale))}`;
}
export function idFromSegment(segment: string) {
  const match = /^.+-([1-9]\d*)$/.exec(segment.normalize('NFC'));
  return match ? `pokemon:${match[1]}` : null;
}

export function referenceName(entry: { names?: Partial<Record<Locale, string>>; nameKo?: string | null; nameEn?: string | null; name: string }, locale: Locale) {
  return entry.names?.[locale] ?? (locale === 'ko' ? entry.nameKo : null) ?? entry.names?.en ?? entry.nameEn ?? entry.name;
}
