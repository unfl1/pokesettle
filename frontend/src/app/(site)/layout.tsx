import { Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { AppProviders } from '../../providers/AppProviders';
import WorkspaceHeader from '../../components/layout/WorkspaceHeader';

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <AppProviders><div className="app-shell">
    <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
    <Suspense><WorkspaceHeader /></Suspense>
    <main id="main-content" tabIndex={-1} className="workspace-main">{children}</main>
    <footer className="site-footer">
      <Link href="/" className="footer-brand">PokeTact<span>포켓몬을 이해하는 더 나은 방법</span></Link>
      <span>비공식 포켓몬 전략 도우미 <ArrowUpRight size={12} /></span>
    </footer>
  </div></AppProviders>;
}
