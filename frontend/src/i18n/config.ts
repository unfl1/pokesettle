export const localeRegistry = {
  ko: { label: '한국어', htmlLang: 'ko', openGraphLocale: 'ko_KR' },
  en: { label: 'English', htmlLang: 'en', openGraphLocale: 'en_US' },
  ja: { label: '日本語', htmlLang: 'ja', openGraphLocale: 'ja_JP' },
  zh: { label: '简体中文', htmlLang: 'zh-Hans', openGraphLocale: 'zh_CN' },
} as const;
export type Locale = keyof typeof localeRegistry;
export const locales = Object.keys(localeRegistry) as Locale[];
export const defaultLocale: Locale = 'ko';
export const featurePaths = ['', '/chat', '/pokedex', '/meta', '/scenario'] as const;
export function isLocale(value: string): value is Locale {
  return Object.hasOwn(localeRegistry, value);
}
export function localizedPath(locale: Locale, path = '') {
  return `/${locale}${path === '/' ? '' : path}`;
}
export function withoutLocale(path: string) {
  const segment = path.split('/')[1];
  return isLocale(segment) ? path.slice(segment.length + 1) || '/' : path;
}
