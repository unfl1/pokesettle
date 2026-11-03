import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import LegalLinks from '../../components/legal/LegalLinks';
import { siteUrl } from '../../i18n/metadata';
import { pretendard } from '../fonts';
import { documentClasses } from '../../styles/document';
import '../../globals.css';

export const viewport: Viewport = { themeColor: '#0057ff' };
export const metadata: Metadata = { metadataBase: new URL(siteUrl) };

export default function LegalLayout({ children }: { children: ReactNode }) {
  return <html lang="ko" className={`${pretendard.variable} ${documentClasses}`}>
    <body className="m-0 min-w-80">
      <div className="legal-shell min-h-[100dvh] flex flex-col [&_>_main]:flex-1">
        <a className="skip-link fixed left-4 top-[-80px] z-50 py-3 px-4.5 bg-white text-accent border border-line rounded-[8px] [&:focus]:top-3" href="#main-content">본문으로 건너뛰기</a>
        <header className="legal-header flex items-center justify-between gap-4 [width:min(1120px,_100%)] [margin:0_auto] p-6 [border-bottom:1px_solid_#e1e4e8] [&_>_a:last-child]:text-[13px] [&_>_a:last-child:hover]:text-[#0057ff] screen-760:p-5">
          <div className="legal-header-brand flex items-center gap-3.5"><a href="/ko" className="brand flex items-center gap-[9px] text-[23px] font-extrabold tracking-[-1px] no-underline text-ink screen-780:h-10.5 screen-780:text-[21px] screen-header:h-12" aria-label="PokeSettle 홈">PokeSettle</a><span className="legal-header-note text-[12px] font-medium text-muted screen-760:hidden">서비스 안내</span></div>
          <a href="/ko">홈으로</a>
        </header>
        <main id="main-content" tabIndex={-1}>{children}</main>
        <footer className="legal-footer p-6 [border-top:1px_solid_#e1e4e8] text-center text-[12px] text-[#64748b] leading-[1.8]">
          <LegalLinks />
          <p>PokeSettle은 영리 목적 없이 운영하는 비공식 팬 프로젝트이며, Pokémon 공식 서비스가 아닙니다.</p>
          <p>포켓몬 및 관련 캐릭터·이미지의 권리는 각 권리자에게 있습니다. ©2019 Pokémon. ©1995-2019 Nintendo/Creatures Inc. /GAME FREAK inc.</p>
        </footer>
      </div>
    </body>
  </html>;
}
