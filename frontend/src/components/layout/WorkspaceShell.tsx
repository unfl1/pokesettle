import 'server-only';
import { getI18n } from '../../i18n/server';
import type { ReactNode } from 'react';
import WorkspaceHeader from './WorkspaceHeader';
import LegalLinks from '../legal/LegalLinks';

export default async function WorkspaceShell({ children, collection }: { children: ReactNode; collection?: ReactNode }) {
  const { locale, t: translate } = await getI18n();
  return <div className="app-shell min-h-[100dvh] flex flex-col bg-workspace [&:has([data-testid='chat-page'])]:h-[100dvh] [&:has([data-testid='chat-page'])]:min-h-0 [&:has([data-testid='chat-page'])]:overflow-hidden [&:has([data-testid='chat-page'])_>_.site-header]:shrink-0 [&:has([data-testid='chat-page'])_>_.site-footer]:shrink-0 [&:has([data-testid='chat-page'])_>_.workspace-notices]:max-h-[25dvh] [&:has([data-testid='chat-page'])_>_.workspace-notices]:overflow-auto [&:has([data-testid='chat-page'])_>_.workspace-notices]:overscroll-contain [&:has(.pobti-page)]:bg-surface">
    <a className="skip-link fixed left-4 top-[-80px] z-50 py-3 px-4.5 bg-surface text-accent border border-line rounded-[8px] [&:focus]:top-3" href="#main-content">{translate("본문으로 건너뛰기")}</a>
    <WorkspaceHeader collection={collection} />
    <main id="main-content" tabIndex={-1} className="workspace-main [width:min(100%,_1224px)] [padding:0_32px_56px] [margin:0_auto] flex-1 screen-780:[padding:0_20px_32px] screen-540:[padding:0_14px_28px] [&:empty]:hidden [&:has(>_[data-testid='chat-page'])]:[width:min(100%,_1400px)] [&:has(>_[data-testid='chat-page'])]:py-6 [&:has(>_[data-testid='chat-page'])]:px-8 [&:has(>_[data-testid='chat-page'])]:min-h-0 [&:has(>_[data-testid='chat-page'])]:flex [&:has(>_[data-testid='chat-page'])]:overflow-hidden [&:has(>_[data-testid='chat-page'])]:flex-col screen-780:[&:has(>_[data-testid='chat-page'])]:py-3 screen-780:[&:has(>_[data-testid='chat-page'])]:px-3.5 [&:has(>_[data-testid='chat-page'])_>_.source-language-note]:shrink-0 [&:has(>_[data-testid='chat-page'])_>_.source-language-note]:m-0 [&:has(>_[data-testid='chat-page'])_>_.source-language-note]:py-1.5 [&:has(>_[data-testid='chat-page'])_>_.source-language-note]:px-4 [&:has(>_[data-testid='chat-page'])_>_.source-language-note]:border-b [&:has(>_[data-testid='chat-page'])_>_.source-language-note]:border-line [&:has(>_.pobti-page)]:flex [&:has(>_.pobti-page)]:flex-col [&:has(>_.pobti-page)]:justify-center [&:has(>_.pobti-page)]:py-8 [&:has(.pokedex-layout)]:flex [&:has(.pokedex-layout)]:flex-col [&:has(.metagame-page)]:flex [&:has(.metagame-page)]:flex-col [&_>_.source-language-note:last-child]:[margin:16px_0_0] [&_>_.source-language-note:last-child]:text-[12px] screen-540:[&:has(>_.pobti-page)]:py-6">{children}</main>
    <footer className="site-footer min-h-[57px] flex flex-col items-center justify-center py-1 px-4 border-t border-line text-muted text-center text-[11px] leading-[15px] bg-surface wrap-anywhere [&_p]:m-0 screen-780:min-h-[91px]" aria-label={translate("저작권 및 운영 안내")}>
      <LegalLinks locale={locale} />
      <p>{translate("PokeSettle은 영리 목적 없이 운영하는 비공식 팬 프로젝트이며, Pokémon 공식 서비스가 아닙니다.")}</p>
      <p>{translate("포켓몬 및 관련 캐릭터·이미지의 권리는 각 권리자에게 있습니다. ©2019 Pokémon. ©1995-2019 Nintendo/Creatures Inc. /GAME FREAK inc.")}</p>
    </footer>
  </div>;
}
