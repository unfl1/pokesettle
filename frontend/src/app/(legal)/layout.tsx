import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import LegalLinks from '../../components/legal/LegalLinks';
import { siteUrl } from '../../i18n/metadata';
import { pretendard } from '../fonts';
import '../pretendard-subsets.css';
import '../../globals.css';

export const viewport: Viewport = { themeColor: '#0057ff' };
export const metadata: Metadata = { metadataBase: new URL(siteUrl) };

export default function LegalLayout({ children }: { children: ReactNode }) {
  return <html lang="ko" className={`${pretendard.variable} font-sans text-ink bg-surface`} style={{ scrollbarGutter: 'stable' }}>
    <body>
      <div className="legal-shell">
        <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
        <header className="legal-header">
          <div className="legal-header-brand"><a href="/ko" className="brand" aria-label="PokeSettle 홈">PokeSettle</a><span className="legal-header-note">서비스 안내</span></div>
          <a href="/ko">홈으로</a>
        </header>
        <main id="main-content" tabIndex={-1}>{children}</main>
        <footer className="legal-footer">
          <LegalLinks />
          <p>PokeSettle은 영리 목적 없이 운영하는 비공식 팬 프로젝트이며, Pokémon 공식 서비스가 아닙니다.</p>
          <p>포켓몬 및 관련 캐릭터·이미지의 권리는 각 권리자에게 있습니다. ©2019 Pokémon. ©1995-2019 Nintendo/Creatures Inc. /GAME FREAK inc.</p>
        </footer>
      </div>
    </body>
  </html>;
}
