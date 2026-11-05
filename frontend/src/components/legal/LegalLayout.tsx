import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import LegalLinks from './LegalLinks';
import LanguageSwitcher from '../layout/LanguageSwitcher';
import { I18nProvider } from '../../i18n/I18nProvider';
import { localizedPath, localeRegistry, type Locale } from '../../i18n/config';
import { getLegalTranslator } from './copy.server';
import { siteUrl } from '../../i18n/metadata';
import { pretendard } from '../../app/fonts';
import { documentClasses } from '../../styles/document';
import '../../globals.css';

export const viewport: Viewport = { themeColor: '#0057ff' };
export const metadata: Metadata = { metadataBase: new URL(siteUrl) };

export default async function LegalLayout({ children, locale }: { children: ReactNode; locale: Locale }) {
  const t = await getLegalTranslator(locale);
  return <html lang={localeRegistry[locale].htmlLang} className={`${pretendard.variable} ${documentClasses}`}>
    <body className="m-0 min-w-80">
      <div className="legal-shell min-h-[100dvh] flex flex-col [&_>_main]:flex-1">
        <a className="skip-link fixed left-4 top-[-80px] z-50 py-3 px-4.5 bg-white text-accent border border-line rounded-[8px] [&:focus]:top-3" href="#main-content">{t("본문으로 건너뛰기")}</a>
        <header className="legal-header flex items-center justify-between gap-4 [width:min(1120px,_100%)] [margin:0_auto] p-6 [border-bottom:1px_solid_#e1e4e8] [&_>_div:last-child_>_a]:text-[13px] [&_>_div:last-child_>_a:hover]:text-[#0057ff] screen-760:p-5">
          <div className="legal-header-brand flex items-center gap-3.5"><a href={localizedPath(locale)} className="brand flex items-center gap-[9px] text-[23px] font-extrabold tracking-[-1px] no-underline text-ink screen-780:h-10.5 screen-780:text-[21px] screen-header:h-12" aria-label={t('PokeSettle 홈')}>PokeSettle</a><span className="legal-header-note text-[12px] font-medium text-muted screen-760:hidden">{t("서비스 안내")}</span></div>
          <div className="flex flex-wrap items-center justify-end gap-4"><I18nProvider locale={locale} dictionary={{ 언어: t('언어') }}><LanguageSwitcher /></I18nProvider><a href={localizedPath(locale)}>{t("홈으로")}</a></div>
        </header>
        <main id="main-content" tabIndex={-1}>{children}</main>
        <footer className="legal-footer p-6 [border-top:1px_solid_#e1e4e8] text-center text-[12px] text-[#64748b] leading-[1.8]">
          <LegalLinks locale={locale} />
          <p>{t("PokeSettle은 영리 목적 없이 운영하는 비공식 팬 프로젝트이며, Pokémon 공식 서비스가 아닙니다.")}</p>
          <p>{t("포켓몬 및 관련 캐릭터·이미지의 권리는 각 권리자에게 있습니다. ©2019 Pokémon. ©1995-2019 Nintendo/Creatures Inc. /GAME FREAK inc.")}</p>
        </footer>
      </div>
    </body>
  </html>;
}
