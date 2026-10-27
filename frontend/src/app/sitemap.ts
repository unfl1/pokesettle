import type { MetadataRoute } from 'next';
import { featurePaths, locales, localizedPath } from '../i18n/config';
import { languageAlternates, siteUrl } from '../i18n/metadata';

export default function sitemap(): MetadataRoute.Sitemap {
  return featurePaths.flatMap(path => locales.map(locale => ({
    url: new URL(localizedPath(locale, path), siteUrl).href,
    alternates: { languages: languageAlternates(path) },
  })));
}
