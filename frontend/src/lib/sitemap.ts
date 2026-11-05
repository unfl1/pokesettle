import 'server-only';
import { profiles } from '../features/pobti/model';
import { routeEntries, pokemonAlternates } from '../features/pokemon/route-index.server';
import { pokemonPath } from '../features/pokemon/routing';
import { featurePaths, localizedPath, type Locale } from '../i18n/config';
import { languageAlternates, siteUrl } from '../i18n/metadata';

function escapeXml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

export function sitemapResponse(xml: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${xml}`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}

export function localeSitemap(locale: Locale) {
  const entries: { url: string; languages: Record<string, string> }[] = [
    ...featurePaths.map(path => ({ url: new URL(localizedPath(locale, path), siteUrl).href, languages: languageAlternates(path) })),
    ...Object.keys(profiles).map(type => {
      const path = `/pobti/${type.toLowerCase()}`;
      return { url: new URL(localizedPath(locale, path), siteUrl).href, languages: languageAlternates(path) };
    }),
    ...routeEntries.map(entry => ({ url: new URL(pokemonPath(entry, locale), siteUrl).href, languages: pokemonAlternates(entry) })),
    ...['/terms', '/privacy'].map(path => ({ url: new URL(localizedPath(locale, path), siteUrl).href, languages: languageAlternates(path) })),
  ];
  return sitemapResponse(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries.map(({ url, languages }) => `<url><loc>${escapeXml(url)}</loc>${Object.entries(languages).map(([language, href]) => `<xhtml:link rel="alternate" hreflang="${escapeXml(language)}" href="${escapeXml(href)}"/>`).join('')}</url>`).join('')}</urlset>`);
}
