'use client';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Locale } from './config';
import { createTranslator, type Dictionary } from './translate';

const I18nContext = createContext<{ locale: Locale; t: ReturnType<typeof createTranslator> } | null>(null);
export function I18nProvider({ locale, dictionary, children }: { locale: Locale; dictionary: Dictionary; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: createTranslator(dictionary) }), [locale, dictionary]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('I18nProvider is required');
  return value;
}
