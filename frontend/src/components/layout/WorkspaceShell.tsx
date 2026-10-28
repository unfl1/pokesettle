'use client';
import { useI18n } from '../../i18n/I18nProvider';
import { withoutLocale } from '../../i18n/config';
import { usePathname } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import WorkspaceHeader from './WorkspaceHeader';

export default function WorkspaceShell({ children }: { children: ReactNode }) {
  const { locale, t: translate } = useI18n();
  const pathname = withoutLocale(usePathname());
  if (pathname === '/') return children;
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">{translate("본문으로 건너뛰기")}</a>
    <Suspense><WorkspaceHeader /></Suspense>
    <main id="main-content" tabIndex={-1} className="workspace-main">{locale !== 'ko' && <p className="source-language-note">{translate('자료와 답변은 한국어 중심이며, 수집된 원문은 번역하지 않고 표시해요.')}</p>}{children}</main>
    <footer className="site-footer" aria-label={translate("저작권 및 운영 안내")}>
      <p>{translate("PokeSettle은 영리 목적 없이 운영하는 비공식 팬 프로젝트이며, Pokémon 공식 서비스가 아닙니다.")}</p>
      <p>{translate("포켓몬 및 관련 캐릭터·이미지의 권리는 각 권리자에게 있습니다. ©2019 Pokémon. ©1995-2019 Nintendo/Creatures Inc. /GAME FREAK inc.")}</p>
    </footer>
  </div>;
}
