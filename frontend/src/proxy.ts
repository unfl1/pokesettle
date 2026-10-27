import { NextRequest, NextResponse } from 'next/server';
import { defaultLocale, featurePaths, isLocale, localizedPath } from './i18n/config';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isLocale(pathname.split('/')[1])) return NextResponse.next();
  // Redirect only known legacy routes; invalid locales and unknown paths stay 404.
  if (!featurePaths.some(path => (path || '/') === pathname)) return NextResponse.next();
  const destination = request.nextUrl.clone();
  destination.pathname = localizedPath(defaultLocale, pathname);
  return NextResponse.redirect(destination, 308);
}
export const config = {
  matcher: ['/((?!api(?:/|$)|_next(?:/|$)|images(?:/|$)|fonts(?:/|$)|.*\\..*).*)'],
};
