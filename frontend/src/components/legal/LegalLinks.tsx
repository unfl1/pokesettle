import type { Locale } from '../../i18n/config';

const labels = {
  ko: ['이용약관', '개인정보처리방침'],
  en: ['Terms (Korean)', 'Privacy (Korean)'],
  ja: ['利用規約（韓国語）', 'プライバシーポリシー（韓国語）'],
  zh: ['使用条款（韩语）', '隐私政策（韩语）'],
} as const;

export default function LegalLinks({ locale = 'ko' }: { locale?: Locale }) {
  return <nav className="legal-links" aria-label={{ ko: '서비스 정책', en: 'Service policies', ja: 'サービスポリシー', zh: '服务政策' }[locale]}>
    {['/terms', '/privacy'].map((href, index) => <a key={href} href={href}>{labels[locale][index]}</a>)}
  </nav>;
}
