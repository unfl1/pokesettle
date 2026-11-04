import { locales } from '../../i18n/config';
import { siteUrl } from '../../i18n/metadata';
import { sitemapResponse } from '../../lib/sitemap';

export const dynamic = 'force-static';
export function GET() {
  return sitemapResponse(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locales.map(locale => `<sitemap><loc>${new URL(`/sitemap-${locale}.xml`, siteUrl).href.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</loc></sitemap>`).join('')}</sitemapindex>`);
}
