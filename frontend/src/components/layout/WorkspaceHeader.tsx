"use client";
import { useI18n } from '../../i18n/I18nProvider';

import ThemeSwitcher from './ThemeSwitcher';
import LanguageSwitcher from './LanguageSwitcher';
import { localizedPath, withoutLocale } from '../../i18n/config';
import { useEffect, useState, type ReactNode } from 'react';
import NavigationLink from './NavigationLink';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { BookOpen, CircleHelp, MessageSquare, ShieldCheck, Sparkles, Swords, TrendingUp, X } from 'lucide-react';
import { useWorkspaceContext } from '../../providers/AppProviders';

const navigation = [
  { id: 'chat', path: '/chat', label: '챗봇', icon: MessageSquare },
  { id: 'pokedex', path: '/pokedex', label: '도감', icon: BookOpen },
  { id: 'meta', path: '/meta', label: '메타 순위', icon: TrendingUp },
  { id: 'pobti', path: '/pobti', label: '포BTI', icon: Sparkles },
  { id: 'scenario', path: '/scenario', label: '6:6 시나리오', icon: Swords },
] as const;
export default function WorkspaceHeader({ collection }: { collection?: ReactNode }) {
  const { locale, t: translate } = useI18n();
  const pathname = withoutLocale(usePathname());
  const [pokedexLocation, setPokedexLocation] = useState('/pokedex');
  useEffect(() => {
    if (pathname.split('/')[1] === 'pokedex') setPokedexLocation(`${pathname}${window.location.search}`);
  }, [pathname]);
  const view = pathname.split('/')[1];
  const [showHelp, setShowHelp] = useState(false);
  const w = useWorkspaceContext();
  const ready = Boolean(w.status.data?.ready);
  return <>
      <header className="site-header bg-surface border-b border-line sticky top-0 z-20">
        <div className="header-inner min-h-14 [padding:0_16px] flex items-center gap-6 screen-900:gap-4 screen-780:min-h-auto screen-780:flex-wrap screen-780:gap-0 screen-header:flex-wrap screen-header:gap-0">
          <NavigationLink prefetch={false} href={localizedPath(locale)} className="brand flex items-center gap-[9px] text-[23px] font-extrabold tracking-[-1px] no-underline text-ink screen-780:h-10.5 screen-780:text-[21px] screen-header:h-12" aria-label={translate("PokeSettle 홈")}>
            <Image src="/logo.svg" alt="" width={36} height={36} className="brand-logo block w-9 h-9 shrink-0 object-contain" unoptimized />
            PokeSettle<span className="brand-tag py-0.5 px-1 bg-highlight text-highlight-ink text-[10px] tracking-[.5px] font-semibold rounded-[4px]">BETA</span>
          </NavigationLink>
          <nav className="primary-nav flex items-stretch gap-2 [align-self:stretch] m-0 [&_a]:flex [&_a]:items-center [&_a]:justify-center [&_a]:gap-2 [&_a]:[padding:0_15px] [&_a]:text-muted [&_a]:text-[14px] [&_a]:font-semibold [&_a]:no-underline [&_a]:[border-bottom:3px_solid_transparent] [&_a]:[border-top:3px_solid_transparent] [&_a]:whitespace-nowrap [&_a:hover]:text-accent [&_a:hover]:bg-accent-hover [&_a[aria-current=page]]:[border-bottom-color:var(--color-accent)] [&_a[aria-current=page]]:text-accent [&_a[aria-current=page]]:bg-accent-hover screen-900:gap-1 screen-780:[order:3] screen-780:w-full screen-780:min-w-0 screen-780:overflow-x-auto screen-780:gap-1 screen-780:h-12 screen-780:[&_a]:flex-1 screen-780:[&_a]:[padding:0_6px] screen-780:[&_a]:text-[14px] screen-780:[&_a]:gap-1.5  screen-360:[&_a_svg]:hidden screen-header:[order:3] screen-header:w-full screen-header:h-12 screen-header:[&_a]:flex-1 screen-header:[&_a]:px-2 screen-header:[&_a]:gap-[5px] screen-540:overflow-x-auto screen-540:gap-0 screen-540:[&_a]:[flex:1_0_auto] screen-540:[&_a]:px-2 screen-540:[&_a]:text-[12px] screen-540:[&_a_svg]:hidden" aria-label={translate("주 메뉴")}>
            {navigation.map(({ id, path, label, icon: Icon }) => (
              <NavigationLink key={id} href={localizedPath(locale, id === 'pokedex' ? pokedexLocation : path)} aria-current={view === id ? 'page' : undefined}>
                <Icon size={17} strokeWidth={1.8} /><span>{translate(label)}</span>
              </NavigationLink>
            ))}
          </nav>
          <div className="header-actions flex items-center gap-2 ml-auto screen-780:gap-1">
            {collection}
            <ThemeSwitcher />
            <LanguageSwitcher />
            <button className="help-button grid place-items-center p-2 rounded-[8px] text-muted hover:bg-accent-hover hover:text-accent" aria-label={translate("이용 안내")} aria-expanded={showHelp} onClick={() => setShowHelp(value => !value)}>
              <CircleHelp size={19} />
            </button>
          </div>
        </div>
      </header>
<div className="workspace-main [width:min(100%,_1224px)] [padding:0_32px_56px] [margin:0_auto] flex-1 screen-780:[padding:0_20px_32px] screen-540:[padding:0_14px_28px] [&:empty]:hidden [&:has(>_[data-testid='chat-page'])]:[width:min(100%,_1400px)] [&:has(>_[data-testid='chat-page'])]:py-6 [&:has(>_[data-testid='chat-page'])]:px-8 [&:has(>_[data-testid='chat-page'])]:min-h-0 [&:has(>_[data-testid='chat-page'])]:flex [&:has(>_[data-testid='chat-page'])]:overflow-hidden [&:has(>_[data-testid='chat-page'])]:flex-col screen-780:[&:has(>_[data-testid='chat-page'])]:py-3 screen-780:[&:has(>_[data-testid='chat-page'])]:px-3.5 [&:has(>_[data-testid='chat-page'])_>_.source-language-note]:shrink-0 [&:has(>_[data-testid='chat-page'])_>_.source-language-note]:m-0 [&:has(>_[data-testid='chat-page'])_>_.source-language-note]:py-1.5 [&:has(>_[data-testid='chat-page'])_>_.source-language-note]:px-4 [&:has(>_[data-testid='chat-page'])_>_.source-language-note]:border-b [&:has(>_[data-testid='chat-page'])_>_.source-language-note]:border-line [&:has(>_.pobti-page)]:flex [&:has(>_.pobti-page)]:flex-col [&:has(>_.pobti-page)]:justify-center [&:has(>_.pobti-page)]:py-8 [&:has(.pokedex-layout)]:flex [&:has(.pokedex-layout)]:flex-col [&:has(.metagame-page)]:flex [&:has(.metagame-page)]:flex-col [&_>_.source-language-note:last-child]:[margin:16px_0_0] [&_>_.source-language-note:last-child]:text-[12px] screen-540:[&:has(>_.pobti-page)]:py-6 workspace-notices [&.workspace-notices]:[flex:none] [&.workspace-notices]:pb-0 [&.workspace-notices]:pt-5">
        {showHelp && (
          <section className="notice flex items-center gap-3 py-3.75 px-4.5 mb-5 bg-warning-soft [border:1px_solid_var(--color-warning-line)] rounded-[10px] text-[14px] text-warning leading-[1.8] [&_button]:ml-auto [&_button]:whitespace-nowrap [&_button]:font-semibold screen-540:p-3 screen-540:text-[14px] screen-540:gap-[9px] help-notice [&.help-notice]:items-start [&.help-notice]:bg-accent-hover [&.help-notice]:border-accent-soft [&.help-notice]:text-accent [&.help-notice]:[&_h2]:font-bold [&.help-notice]:[&_h2]:mb-[3px]" aria-label={translate("이용 안내")}>
            <ShieldCheck size={20} />
            <div>
              <h2>{translate("출처를 확인하며 읽어 주세요.")}</h2>
              <p>{translate("챗봇에서는 배틀 상황을 질문하고, 도감에서는 포켓몬 정보를 살펴보세요. 6:6 시나리오에서는 팀을 구성하고 비교할 수 있어요. 일반 도감 정보는 Champions 사용 가능 여부를 보장하지 않아요. 대화 기록은 현재 브라우저의 세션에 연결되며, 쿠키가 만료되거나 삭제되면 다시 접근할 수 없어요.")}</p>
            </div>
            <button aria-label={translate("이용 안내 닫기")} onClick={() => setShowHelp(false)}><X size={18} /></button>
          </section>
        )}
        {((view === 'chat' || view === 'scenario') && (w.status.error || w.session.error)) && (
          <div className="notice flex items-center gap-3 py-3.75 px-4.5 mb-5 bg-warning-soft [border:1px_solid_var(--color-warning-line)] rounded-[10px] text-[14px] text-warning leading-[1.8] [&_button]:ml-auto [&_button]:whitespace-nowrap [&_button]:font-semibold screen-540:p-3 screen-540:text-[14px] screen-540:gap-[9px]" role="alert">
            <CircleHelp size={18} /><span>{w.status.error?.message ?? w.session.error?.message}</span>
            <button onClick={w.refresh}>{translate("다시 연결")}</button>
          </div>
        )}
        {w.status.data && !ready && pathname === '/chat' && (
          <div className="notice flex items-center gap-3 py-3.75 px-4.5 mb-5 bg-warning-soft [border:1px_solid_var(--color-warning-line)] rounded-[10px] text-[14px] text-warning leading-[1.8] [&_button]:ml-auto [&_button]:whitespace-nowrap [&_button]:font-semibold screen-540:p-3 screen-540:text-[14px] screen-540:gap-[9px]" role="alert">
            <CircleHelp size={18} />
            <div>
              <strong>{w.status.data.missing.includes('INDEX_NOT_READY') ? translate("도감 색인이 준비되지 않았어요.") : translate("답변 모델 연결 설정이 필요해요.")}</strong>
              <p>{translate("도감 기본 질문과 정보 조회는 계속 이용할 수 있어요. 전략 답변은 서비스 준비 후 이용해 주세요.")}</p>
            </div>
            <button onClick={w.refresh}>{translate("다시 확인")}</button>
          </div>
        )}

</div></>;
}
