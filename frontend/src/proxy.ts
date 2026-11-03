import { NextRequest, NextResponse } from 'next/server';
import routes from './generated/pokemon-routes.json';
import { idFromSegment, pokemonPath, pokemonSegment } from './features/pokemon/routing';
import { localeRegistry } from './i18n/config';
import { defaultLocale, featurePaths, isLocale, localizedPath, withoutLocale } from './i18n/config';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const prefix = pathname.split('/')[1];
  const prefixed = isLocale(prefix);
  const locale = prefixed ? prefix : defaultLocale;
  const path = withoutLocale(pathname);
  const segments = path.split('/');
  const feature = featurePaths.some(value => (value || '/') === path);
  const detail = segments[1] === 'pokedex' && segments.length === 3;
  if (!feature && !detail) return NextResponse.next();
  const legacy = path === '/pokedex' && request.nextUrl.searchParams.has('pokemon');
  if (legacy || detail) {
    const values = request.nextUrl.searchParams.getAll('pokemon');
    let segment = '';
    try { segment = decodeURIComponent(segments[2] ?? ''); } catch { /* invalid encoding stays a 404 */ }
    const id = legacy ? values.length === 1 ? values[0] : null : idFromSegment(segment);
    const entry = routes.find(entry => entry.pokemonId === id);
    if (!entry) {
      const label = { ko: '포켓몬을 찾을 수 없습니다.', en: 'Pokémon not found.', ja: 'ポケモンが見つかりません。', zh: '未找到宝可梦。' }[locale];
      return new NextResponse(`<!doctype html><html lang="${localeRegistry[locale].htmlLang}"><head><meta name="robots" content="noindex"><title>${label}</title></head><body><h1>${label}</h1><a href="${localizedPath(locale, "/pokedex")}">Pokédex</a></body></html>`, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (legacy || segment !== pokemonSegment(entry, locale) || (prefixed && locale === defaultLocale)) {
      const destination = request.nextUrl.clone();
      destination.pathname = pokemonPath(entry, locale);
      if (legacy) destination.searchParams.delete('pokemon');
      return NextResponse.redirect(destination, 308);
    }
  }
  const destination = request.nextUrl.clone();
  if (prefixed && locale === defaultLocale) {
    destination.pathname = localizedPath(locale, path);
    return NextResponse.redirect(destination, 308);
  }
  return NextResponse.next();
}
export const config = {
  matcher: ['/((?!api(?:/|$)|_next(?:/|$)|images(?:/|$)|fonts(?:/|$)|.*\\..*).*)'],
};
