import type { Metadata } from 'next';
import { defaultLocale, localeRegistry, locales, localizedPath, type Locale } from './config';
import { getI18n } from './server';

export const siteUrl = process.env.SITE_URL ?? 'https://www.chikorita.xyz';
export function languageAlternates(path: string) {
  return {
    ...Object.fromEntries(locales.map(locale => [localeRegistry[locale].htmlLang, new URL(localizedPath(locale, path), siteUrl).href])),
    'x-default': new URL(localizedPath(defaultLocale, path), siteUrl).href,
  };
}
export async function pageMetadata(path: string, titleKey: string, descriptionKey: string): Promise<Metadata> {
  const { locale, t } = await getI18n();
  const title = t(titleKey), description = t(descriptionKey);
  const url = localizedPath(locale, path);
  return {
    title: { absolute: `${title} | PokeTact` }, description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: {
      title, description, url, siteName: 'PokeTact', type: 'website',
      locale: localeRegistry[locale].openGraphLocale,
      alternateLocale: locales.filter((other: Locale) => other !== locale).map(other => localeRegistry[other].openGraphLocale),
    },
    twitter: { card: 'summary', title, description },
  };
}
