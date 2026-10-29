import { NextRequest, NextResponse } from 'next/server';
import routes from './generated/pokemon-routes.json';
import { idFromSegment, pokemonPath, pokemonSegment } from './features/pokemon/routing';
import { localeRegistry } from './i18n/config';
import { defaultLocale, featurePaths, isLocale, localizedPath } from './i18n/config';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const locale = pathname.split('/')[1];
  if (isLocale(locale)) {
    const segments = pathname.split('/');
    const legacy = pathname === `/${locale}/pokedex` && request.nextUrl.searchParams.has('pokemon');
    const detail = segments[2] === 'pokedex' && segments.length === 4;
    if (legacy || detail) {
      const values = request.nextUrl.searchParams.getAll('pokemon');
      let segment = '';
      try { segment = decodeURIComponent(segments[3] ?? ''); } catch { /* invalid encoding stays a 404 */ }
      const id = legacy ? values.length === 1 ? values[0] : null : idFromSegment(segment);
      const entry = routes.find(entry => entry.pokemonId === id);
      if (!entry) {
        const label = { ko: '포켓몬을 찾을 수 없습니다.', en: 'Pokémon not found.', ja: 'ポケモンが見つかりません。', zh: '未找到宝可梦。' }[locale];
        return new NextResponse(`<!doctype html><html lang="${localeRegistry[locale].htmlLang}"><head><meta name="robots" content="noindex"><title>${label}</title></head><body><h1>${label}</h1><a href="/${locale}/pokedex">Pokédex</a></body></html>`, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
      if (legacy || segment !== pokemonSegment(entry, locale)) {
        const destination = request.nextUrl.clone();
        destination.pathname = pokemonPath(entry, locale);
        if (legacy) destination.searchParams.delete('pokemon');
        return NextResponse.redirect(destination, 308);
      }
    }
    return NextResponse.next();
  }
  // Redirect only known legacy routes; invalid locales and unknown paths stay 404.
  if (!featurePaths.some(path => (path || '/') === pathname)) return NextResponse.next();
  const destination = request.nextUrl.clone();
  destination.pathname = localizedPath(defaultLocale, pathname);
  return NextResponse.redirect(destination, 308);
}
export const config = {
  matcher: ['/((?!api(?:/|$)|_next(?:/|$)|images(?:/|$)|fonts(?:/|$)|.*\\..*).*)'],
};
