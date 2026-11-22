import { localizedPath, type Locale } from '../../i18n/config';

const labels = {
  ko: ['이용약관', '개인정보처리방침', '문의하기'],
  en: ['Terms of Use', 'Privacy Policy', 'Contact'],
  ja: ['利用規約', 'プライバシーポリシー', 'お問い合わせ'],
  zh: ['使用条款', '隐私政策', '联系我们'],
} as const;

export default function LegalLinks({ locale = 'ko' }: { locale?: Locale }) {
  return <nav className="legal-links flex flex-wrap justify-center [gap:6px_18px] [padding:6px_0] text-[12px] [&_a:hover]:underline [&_a:hover]:underline-offset-[3px]" aria-label={{ ko: '서비스 정책', en: 'Service policies', ja: 'サービスポリシー', zh: '服务政策' }[locale]}>
    {['/terms', '/privacy'].map((href, index) => <a key={href} href={localizedPath(locale, href)}>{labels[locale][index]}</a>)}
    <a href="mailto:flxmaut10@gmail.com">{labels[locale][2]}</a>
  </nav>;
}
