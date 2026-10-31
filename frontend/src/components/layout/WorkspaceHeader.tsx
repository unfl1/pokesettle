"use client";
import { useI18n } from '../../i18n/I18nProvider';

import LanguageSwitcher from './LanguageSwitcher';
import { localizedPath, withoutLocale } from '../../i18n/config';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
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
  const params = useSearchParams();
  const search = params.size ? `?${params.toString()}` : '';
  const [pokedexLocation, setPokedexLocation] = useState('/pokedex');
  useEffect(() => { if (pathname.split('/')[1] === 'pokedex') setPokedexLocation(`${pathname}${search}`); }, [pathname, search]);
  const view = pathname.split('/')[1];
  const [showHelp, setShowHelp] = useState(false);
  const w = useWorkspaceContext();
  const ready = Boolean(w.status.data?.ready);
  return <>
      <header className="site-header">
        <div className="header-inner">
          <a href={localizedPath(locale)} className="brand" aria-label={translate("PokeSettle 홈")}>
            <Image src="/logo.png" alt="" width={36} height={36} className="brand-logo" priority />
            PokeSettle<span className="brand-tag">BETA</span>
          </a>
          <nav className="primary-nav" aria-label={translate("주 메뉴")}>
            {navigation.map(({ id, path, label, icon: Icon }) => (
              <Link prefetch={false} key={id} href={localizedPath(locale, id === 'pokedex' ? pokedexLocation : path)} aria-current={view === id ? 'page' : undefined}>
                <Icon size={17} strokeWidth={1.8} /><span>{translate(label)}</span>
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            {collection}
            <LanguageSwitcher />
            <button className="help-button" aria-label={translate("이용 안내")} aria-expanded={showHelp} onClick={() => setShowHelp(value => !value)}>
              <CircleHelp size={19} />
            </button>
          </div>
        </div>
      </header>
<div className="workspace-main workspace-notices">
        {showHelp && (
          <section className="notice help-notice" aria-label={translate("이용 안내")}>
            <ShieldCheck size={20} />
            <div>
              <h2>{translate("출처를 확인하며 읽어 주세요.")}</h2>
              <p>{translate("챗봇에서는 배틀 상황을 질문하고, 도감에서는 포켓몬 정보를 살펴보세요. 6:6 시나리오에서는 팀을 구성하고 비교할 수 있어요. 일반 도감 정보는 Champions 사용 가능 여부를 보장하지 않아요. 대화 기록은 현재 브라우저의 세션에 연결되며, 쿠키가 만료되거나 삭제되면 다시 접근할 수 없어요.")}</p>
            </div>
            <button aria-label={translate("이용 안내 닫기")} onClick={() => setShowHelp(false)}><X size={18} /></button>
          </section>
        )}
        {((view === 'chat' || view === 'scenario') && (w.status.error || w.session.error)) && (
          <div className="notice" role="alert">
            <CircleHelp size={18} /><span>{w.status.error?.message ?? w.session.error?.message}</span>
            <button onClick={w.refresh}>{translate("다시 연결")}</button>
          </div>
        )}
        {w.status.data && !ready && pathname === '/chat' && (
          <div className="notice" role="alert">
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
