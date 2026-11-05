import { localizedPath, type Locale } from '../../i18n/config';

const labels = {
  ko: ['이용약관', '개인정보처리방침'],
  en: ['Terms of Use', 'Privacy Policy'],
  ja: ['利用規約', 'プライバシーポリシー'],
  zh: ['使用条款', '隐私政策'],
} as const;

export default function LegalLinks({ locale = 'ko' }: { locale?: Locale }) {
  return <nav className="legal-links flex flex-wrap justify-center [gap:6px_18px] [padding:6px_0] text-[12px] [&_a:hover]:underline [&_a:hover]:underline-offset-[3px]" aria-label={{ ko: '서비스 정책', en: 'Service policies', ja: 'サービスポリシー', zh: '服务政策' }[locale]}>
    {['/terms', '/privacy'].map((href, index) => <a key={href} href={localizedPath(locale, href)}>{labels[locale][index]}</a>)}
  </nav>;
}
