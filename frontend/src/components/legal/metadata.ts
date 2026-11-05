import type { Metadata } from 'next';
import { localeRegistry, localizedPath, type Locale } from '../../i18n/config';
import { languageAlternates } from '../../i18n/metadata';
import { getLegalTranslator } from './copy.server';

export async function legalMetadata(locale: Locale, document: 'terms' | 'privacy'): Promise<Metadata> {
  const t = await getLegalTranslator(locale);
  const path = `/${document}`;
  const title = t(document === 'terms' ? '이용약관 | PokeSettle' : '개인정보처리방침 | PokeSettle');
  const description = t(document === 'terms'
    ? 'PokeSettle의 이용 조건, AI 답변의 한계, 콘텐츠 권리와 문의 방법을 안내합니다.'
    : 'PokeSettle의 정보 처리 항목과 목적, 브라우저 저장소, 외부 서비스 및 이용자 권리를 안내합니다.');
  return {
    title, description,
    alternates: { canonical: localizedPath(locale, path), languages: languageAlternates(path) },
    openGraph: { title, description, url: localizedPath(locale, path), type: 'website', locale: localeRegistry[locale].openGraphLocale },
  };
}
