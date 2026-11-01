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
        <header className="legal-header"><a href="/ko" aria-label="PokeSettle 홈">PokeSettle<span>서비스 안내</span></a><a href="/ko">홈으로</a></header>
        <main id="main-content" tabIndex={-1}>{children}</main>
        <footer className="legal-footer"><LegalLinks /><p>Pokémon의 권리는 각 권리자에게 있습니다. PokeSettle은 비공식 팬 프로젝트입니다.</p></footer>
      </div>
    </body>
  </html>;
}
