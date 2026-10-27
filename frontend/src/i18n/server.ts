import { lang } from 'next/root-params';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from './config';
import { createTranslator } from './translate';

const dictionaries = {
  ko: () => import('./dictionaries/ko.json').then(module => module.default),
  en: () => import('./dictionaries/en.json').then(module => module.default),
  ja: () => import('./dictionaries/ja.json').then(module => module.default),
  zh: () => import('./dictionaries/zh.json').then(module => module.default),
};
export async function getDictionary(locale: Locale) {
  return dictionaries[locale]();
}
export async function getI18n() {
  const locale = await lang();
  if (!isLocale(locale)) notFound();
  return { locale, t: createTranslator(await getDictionary(locale)) };
}
