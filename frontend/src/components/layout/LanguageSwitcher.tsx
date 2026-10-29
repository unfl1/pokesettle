'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { isLocale, localeRegistry, locales, localizedPath, withoutLocale } from '../../i18n/config';
import { useI18n } from '../../i18n/I18nProvider';

export default function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  return <label className="language-switcher">
    <span className="sr-only">{t('언어')}</span>
    <select value={locale} onChange={event => {
      const nextLocale = event.target.value;
      if (!isLocale(nextLocale)) return;
      const query = search.size ? `?${search.toString()}` : '';
      const alternate = withoutLocale(pathname).startsWith('/pokedex/')
        ? document.head.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${localeRegistry[nextLocale].htmlLang}"]`)?.href : null;
      const path = alternate ? new URL(alternate).pathname : localizedPath(nextLocale, withoutLocale(pathname));
      router.push(`${path}${query}${window.location.hash}`);
    }}>
      {locales.map(language => <option key={language} value={language} lang={localeRegistry[language].htmlLang}>{localeRegistry[language].label}</option>)}
    </select>
  </label>;
}
