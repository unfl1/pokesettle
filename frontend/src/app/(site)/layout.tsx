import { Suspense, type ReactNode } from 'react';
import WorkspaceHeader from '../../components/layout/WorkspaceHeader';

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
    <Suspense><WorkspaceHeader /></Suspense>
    <main id="main-content" tabIndex={-1} className="workspace-main">{children}</main>
    <footer className="site-footer" aria-label="저작권 및 운영 안내">
      <p>PokeTact는 영리 목적 없이 운영하는 비공식 팬 프로젝트이며, Pokémon 공식 서비스가 아닙니다.</p>
      <p>포켓몬 및 관련 캐릭터·이미지의 권리는 각 권리자에게 있습니다. ©2019 Pokémon. ©1995-2019 Nintendo/Creatures Inc. /GAME FREAK inc.</p>
    </footer>
  </div>;
}
