import 'server-only';
import type { Locale } from '../../i18n/config';
import { createTranslator } from '../../i18n/translate';

const dictionaries = {
  ko: () => import('./dictionaries/ko.json'),
  en: () => import('./dictionaries/en.json'),
  ja: () => import('./dictionaries/ja.json'),
  zh: () => import('./dictionaries/zh.json'),
};
export async function getLegalTranslator(locale: Locale) {
  return createTranslator((await dictionaries[locale]()).default);
}
