import { test, expect } from 'vitest';
import { locales } from '../../frontend/src/i18n/config';
import ko from '../../frontend/src/components/legal/dictionaries/ko.json';
import en from '../../frontend/src/components/legal/dictionaries/en.json';
import ja from '../../frontend/src/components/legal/dictionaries/ja.json';
import zh from '../../frontend/src/components/legal/dictionaries/zh.json';

test('legal dictionaries have complete translations and preserve literal identifiers', () => {
  const dictionaries: Record<string, Record<string, string>> = { ko, en, ja, zh };
  const keys = Object.keys(dictionaries.ko).sort();
  for (const locale of locales) {
    const dictionary = dictionaries[locale];
    expect(Object.keys(dictionary).sort()).toEqual(keys);
    expect(Object.values(dictionary).every((value) => value.length > 0)).toBe(true);
    for (const identifier of ['sessionStorage', 'localStorage', 'HttpOnly', 'OpenAI', 'Google Analytics']) {
      expect(Object.values(dictionary).join(' ')).toContain(identifier);
    }
  }
});
