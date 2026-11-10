import { isPobtiType } from './features/pobti/model';
import { NextRequest, NextResponse } from 'next/server';
import routes from './generated/pokemon-routes.json';
import { idFromSegment, pokemonPath, pokemonSegment } from './features/pokemon/routing';
import { localeRegistry } from './i18n/config';
import { defaultLocale, featurePaths, isLocale, localeCookieMaxAge, localeCookieName, localizedPath, withoutLocale } from './i18n/config';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Overwrite viewer input: the server uses this only to select initial queries.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pokesettle-path', withoutLocale(pathname));
  const next = () => {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    if (['/chat', '/scenario'].includes(withoutLocale(pathname))) {
      response.headers.set('Cache-Control', 'private, no-store');
    }
    return response;
  };
  // CloudFront handles home language negotiation before the request reaches Next.js.
  if (pathname === '/' && ['GET', 'HEAD'].includes(request.method)) {
    const response = next();
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
  const prefix = pathname.split('/')[1];
  const prefixed = isLocale(prefix);
  const locale = prefixed ? prefix : defaultLocale;
  const path = withoutLocale(pathname);
  const pobtiResult = /^\/pobti\/([^/]+)$/.exec(path);
  const legacyType = path === '/pobti' ? request.nextUrl.searchParams.get('type') : null;
  const type = (pobtiResult?.[1] ?? legacyType)?.toUpperCase();
  if (type && isPobtiType(type)) {
    const canonical = localizedPath(locale, `/pobti/${type.toLowerCase()}`);
    if (pathname !== canonical || request.nextUrl.searchParams.has('type')) {
      const destination = request.nextUrl.clone();
      destination.pathname = canonical;
      destination.searchParams.delete('type');
      return NextResponse.redirect(destination, 308);
    }
  }
  const knownPath = ['/terms', '/privacy'].includes(path) || featurePaths.some(feature => (feature || '/') === path) || /^\/pokedex\/[^/]+$/.test(path) || !!pobtiResult;
  if (prefixed || knownPath) {
    const segments = path.split('/');
    const legacy = path === '/pokedex' && request.nextUrl.searchParams.has('pokemon');
    const detail = segments[1] === 'pokedex' && segments.length === 3;
    if (legacy || detail) {
      const values = request.nextUrl.searchParams.getAll('pokemon');
      let segment = '';
      try { segment = decodeURIComponent(segments[2] ?? ''); } catch { /* invalid encoding stays a 404 */ }
      const id = legacy ? values.length === 1 ? values[0] : null : idFromSegment(segment);
      const entry = routes.find(entry => entry.pokemonId === id);
      if (!entry) {
        const label = { ko: '포켓몬을 찾을 수 없습니다.', en: 'Pokémon not found.', ja: 'ポケモンが見つかりません。', zh: '未找到宝可梦。' }[locale];
        return new NextResponse(`<!doctype html><html lang="${localeRegistry[locale].htmlLang}"><head><meta name="robots" content="noindex"><title>${label}</title></head><body><h1>${label}</h1><a href="${localizedPath(locale, '/pokedex')}">Pokédex</a></body></html>`, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
      if (legacy || segment !== pokemonSegment(entry, locale) || prefix === defaultLocale) {
        const destination = request.nextUrl.clone();
        destination.pathname = pokemonPath(entry, locale);
        if (legacy) destination.searchParams.delete('pokemon');
        return NextResponse.redirect(destination, 308);
      }
    }
    if (!knownPath) return next();
    if (prefix === defaultLocale) {
      const destination = request.nextUrl.clone();
      destination.pathname = path;
      const response = NextResponse.redirect(destination, 308);
      if (path === '/') {
        // /en explicitly requests English even when its canonical URL has no prefix.
        response.cookies.set(localeCookieName, defaultLocale, {
          path: '/', maxAge: localeCookieMaxAge, sameSite: 'lax',
          secure: request.nextUrl.protocol === 'https:',
        });
        response.headers.set('Cache-Control', 'private, no-store');
      }
      return response;
    }
    return next();
  }
  return next();
}
export const config = {
  matcher: ['/((?!api(?:/|$)|_next(?:/|$)|images(?:/|$)|fonts(?:/|$)|.*\\..*).*)'],
};
