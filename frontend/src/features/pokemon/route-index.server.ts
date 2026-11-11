import 'server-only';
import rows from '../../generated/pokemon-routes.json';
import type { Locale } from '../../i18n/config';
import { defaultLocale, localeRegistry, locales } from '../../i18n/config';
import { siteUrl } from '../../i18n/metadata';
import { idFromSegment, pokemonPath, pokemonSegment } from './routing';

export type RouteEntry = { pokemonId: string; names: Partial<Record<Locale, string>>; slugs: Record<Locale, string> };
export const routeEntries = rows as RouteEntry[];
const byId = new Map(routeEntries.map(row => [row.pokemonId, row]));
const bySlug = new Map(routeEntries.map(row => [pokemonSegment(row), row]));
export function routeBySegment(segment: string) {
  try {
    const decoded = decodeURIComponent(segment).normalize('NFC');
    return bySlug.get(decoded) ?? byId.get(idFromSegment(decoded) ?? '');
  } catch {
    return undefined;
  }
}
export function routeById(id: string) { return byId.get(id); }
export function pokemonAlternates(entry: RouteEntry) {
  return {
    ...Object.fromEntries(locales.map(locale => [localeRegistry[locale].htmlLang, new URL(pokemonPath(entry, locale), siteUrl).href])),
    'x-default': new URL(pokemonPath(entry, defaultLocale), siteUrl).href,
  };
}
