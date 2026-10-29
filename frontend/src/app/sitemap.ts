import { routeEntries, pokemonAlternates } from '../features/pokemon/route-index.server';
import { pokemonPath } from '../features/pokemon/routing';
import type { MetadataRoute } from 'next';
import { featurePaths, locales, localizedPath } from '../i18n/config';
import { languageAlternates, siteUrl } from '../i18n/metadata';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = featurePaths.flatMap(path => locales.map(locale => ({
    url: new URL(localizedPath(locale, path), siteUrl).href,
    alternates: { languages: languageAlternates(path) },
  })));
  return [...pages, ...routeEntries.flatMap(entry => locales.map(locale => ({ url: new URL(pokemonPath(entry, locale), siteUrl).href, alternates: { languages: pokemonAlternates(entry) } })))];
}
