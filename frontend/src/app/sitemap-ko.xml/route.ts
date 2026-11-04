import { localeSitemap } from '../../lib/sitemap';

export const dynamic = 'force-static';
export function GET() {
  return localeSitemap('ko');
}
