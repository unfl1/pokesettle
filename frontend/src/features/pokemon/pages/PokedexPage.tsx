"use client";
import { useI18n } from '../../../i18n/I18nProvider';

import { useWorkspaceContext } from "../../../providers/AppProviders";
import Link from 'next/link';
import { idFromSegment, pokemonName, pokemonPath } from '../routing';
import type { Page } from '../../../types/api';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowRight, ChevronRight, CircleHelp, LoaderCircle, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { pokemonApi } from '../api';
import { TypeBadge } from '../components/TypeBadge';
import PokemonImage from '../components/PokemonImage';
import type { PokemonSummary } from '../types';

export default function PokedexPage({ initialPage, children }: { initialPage: Page<PokemonSummary> | null; children: ReactNode }) {
  const { locale, t: translate } = useI18n();
  const workspace = useWorkspaceContext();
  const ready = Boolean(workspace.status.data?.ready);
  const sessionReady = workspace.session.isSuccess;
  const routeId = idFromSegment(decodeURIComponent(usePathname().split('/').at(-1) ?? ''));
  const pokemonId = routeId ?? 'pokemon:25';
  const Heading = routeId ? 'h2' : 'h1';
  const [mode, setMode] = useState<'name' | 'conditions'>('name');
  const [name, setName] = useState('');
  const [condition, setCondition] = useState('');
  const [submittedCondition, setSubmittedCondition] = useState<string | null>(
    null,
  );
  const list = useInfiniteQuery({
    queryKey: ['catalog-pages', name.trim()],
    initialData: !name.trim() && initialPage ? { pages: [initialPage], pageParams: [initialPage.offset ?? 0] } : undefined,
    staleTime: 60_000,
    queryFn: ({ pageParam }) => pokemonApi.pokemon(name.trim(), pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => {
      const next = (last.offset ?? 0) + last.items.length;
      return next < last.total && last.items.length ? next : undefined;
    },
  });
  const discovery = useInfiniteQuery({
    queryKey: [
      'discovery-pages',
      submittedCondition,

    ],
    queryFn: ({ pageParam }) => pokemonApi.discover(submittedCondition!, pageParam),
    initialPageParam: 0,
    enabled:
      submittedCondition !== null && sessionReady && ready,
    getNextPageParam: (last) => {
      const next = (last.offset ?? 0) + last.items.length;
      return next < last.total && last.items.length ? next : undefined;
    },
    retry: false,
  });
  const isDiscovery = mode === 'conditions' && submittedCondition !== null;
  const activeList = isDiscovery ? discovery : list;
  const discoveryResult = discovery.data?.pages[0];
  const results = activeList.data?.pages.flatMap((page) => page.items) ?? [];
  const total = activeList.data?.pages[0]?.total ?? 0;
  const listError = activeList.error?.message;
  function searchConditions() {
    if (!condition.trim()) return;
    if (submittedCondition === condition.trim()) void discovery.refetch();
    else setSubmittedCondition(condition.trim());
  }


  return (<>
    <section className="page-intro"><Heading>{translate('도감')}</Heading><p>{translate('포켓몬의 타입·특성·종족값과 기술을 확인하세요.')}</p></section>
    <div className="pokedex-layout">
      <section
        className="border border-line rounded-[12px] bg-surface overflow-hidden"
        aria-label={translate("포켓몬 탐색")}
      >
        <div className="px-[19px] pt-[21px] pb-[17px] flex justify-between items-center max-tablet:px-[17px] max-tablet:py-4 [&_h2]:text-[14px] [&_h2]:font-semibold [&_svg]:text-muted max-tablet:[&>svg]:hidden">
          <div>
            <h2>{translate("포켓몬 찾기")}</h2>
          </div>
          <Search size={19} />
        </div>
        <div
          id="catalog-controls"
          className="catalog-controls"
        >
          <div
            className="p-[3px] mx-4 border border-line gap-[3px] flex mt-0 mb-[15px] bg-canvas rounded-[7px] max-tablet:mb-2.5 [&_button]:px-[3px] [&_button]:py-2 [&_button]:gap-1.5 [&_button]:flex-1 [&_button]:flex [&_button]:items-center [&_button]:justify-center [&_button]:text-[14px] [&_button]:text-muted [&_button]:rounded-[4px] [&_[data-selected=true]]:bg-surface [&_[data-selected=true]]:text-ink"
            role="group"
            aria-label={translate("검색 방식")}
          >
            <button
              data-selected={mode === 'name'}
              onClick={() => { setMode('name'); workspace.enableDiscovery(false); }}
            >
              <Search size={13} />
               {translate("이름 검색")} </button>
            <button
              data-selected={mode === 'conditions'}
              onClick={() => { setMode('conditions'); workspace.enableDiscovery(); }}
            >
              <Sparkles size={13} />
               {translate("조건으로 찾기")} </button>
          </div>
          {mode === 'name' ? (
            <div className="p-2.5 mx-4 my-0 border border-line gap-2 flex items-center bg-canvas rounded-[7px] text-muted [&_input]:border-0 [&_input]:border-[currentColor] [&_input]:w-full [&_input]:bg-[transparent] [&_input]:outline-none [&_input]:text-[14px] [&_input]:min-w-0 [&_input]:text-ink">
              <Search size={16} />
              <label className="sr-only" htmlFor="pokemon-name">
                 {translate("포켓몬 이름 검색")} </label>
              <input
                id="pokemon-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={translate("이름을 입력하세요")}
                maxLength={200}
              />
            </div>
          ) : (
            <form
              className="mx-4 my-0 [&_textarea]:p-2.5 [&_textarea]:border [&_textarea]:border-line [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:bg-canvas [&_textarea]:rounded-[6px] [&_textarea]:text-ink [&_textarea]:text-[14px] [&_textarea]:leading-[1.7] [&_button]:px-0 [&_button]:py-[11px] [&_button]:gap-[7px] [&_button]:w-full [&_button]:flex [&_button]:items-center [&_button]:text-[14px] [&_button]:text-ink [&_button_svg:last-child]:ml-auto"
              onSubmit={(e) => {
                e.preventDefault();
                if (condition.trim()) searchConditions();
              }}
            >
              <label className="sr-only" htmlFor="pokemon-condition">
                 {translate("자연어 검색 조건")} </label>
              <textarea
                id="pokemon-condition"
                rows={3}
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                placeholder={translate("예: 전기 타입이고 스피드 종족값이 90 이상")}
                maxLength={2000}
              />
              <button
                type="submit"
                disabled={
                  !condition.trim() ||
                  discovery.isFetching ||
                  !ready ||
                  !sessionReady
                }
              >
                {discovery.isFetching ? (
                  <LoaderCircle
                    size={14}
                    className="animate-loading motion-reduce:animate-none"
                  />
                ) : (
                  <SlidersHorizontal size={14} />
                )}
                {discovery.isFetching
                  ? translate("조건을 확인하고 있어요")
                  : translate("조건에 맞는 포켓몬 찾기")}
                <ArrowRight size={14} />
              </button>
            </form>
          )}
          {isDiscovery && discoveryResult && (
            <div
              className="p-[11px] mx-4 my-3 border border-accent/16 bg-accent/2 rounded-[6px] text-[14px] leading-[1.8] text-muted [&_p]:mt-[5px] [&_small]:text-[14px] [&_small]:text-muted"
              role="status"
            >
              <span className="gap-1.5 text-[14px] tracking-[0.7px] text-muted flex items-center">
                {discoveryResult!.status === 'needs_clarification'
                  ? translate("조건 확인이 필요해요")
                  : translate("해석한 조건")}
              </span>
              <p>{discoveryResult!.interpretation}</p>
              {discoveryResult!.unknownConditions.map((text, i) => (
                <p key={i}>{text}</p>
              ))}
              {discoveryResult!.excludedUnknownCount > 0 && (
                <small>
                   {translate('미확인 속성이 있는 {count}종을 확정 결과에서 제외했습니다.', { count: discoveryResult!.excludedUnknownCount })} </small>
              )}
            </div>
          )}
          {listError && (
            <div
              className="[&_button]:gap-[5px] [&_button]:text-[14px] [&_button]:text-ink [&_button]:flex [&_button]:items-center [&_button]:ml-auto [&_button]:whitespace-nowrap p-[11px] mx-4 my-3 border border-warning-line bg-warning-soft rounded-[6px] text-[14px] leading-[1.8] text-warning"
              role="alert"
            >
              <CircleHelp size={16} />
              <p>{listError}</p>
              <button
                onClick={() =>
                  mode === 'name'
                    ? void list.refetch()
                    : void discovery.refetch()
                }
              >
                 {translate("다시 시도")} </button>
            </div>
          )}
          <div className="px-4.5 flex items-center justify-between pt-5 pb-2.5 text-[14px] text-muted max-tablet:pt-3 [&_span:last-child]:gap-[7px] [&_span:last-child]:flex [&_span:last-child]:items-center">
            <span>
              {isDiscovery
                ? translate("조건 검색 결과")
                : name
                  ? translate("이름 검색 결과")
                  : translate("전체 도감")}
            </span>
            <span>
              {translate('{count}개 항목', { count: total })} <ArrowDown size={10} />
            </span>
          </div>
          <div
            className="px-2 h-[560px] overflow-auto pt-0 pb-2.5 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] max-tablet:h-70 max-tablet:grid max-tablet:grid-cols-1 max-tablet:[align-content:start] max-tablet:gap-y-0 max-tablet:gap-x-1"
            aria-label={translate("포켓몬 목록")}
            aria-busy={activeList.isFetching}
          >
            {activeList.isPending ? (
              <div
                className="px-2.5 py-7.5 gap-[13px] text-center text-muted text-[14px] flex items-center flex-col"
                role="status"
              >
                <LoaderCircle
                  size={18}
                  className="animate-loading motion-reduce:animate-none"
                />
                 {translate("도감을 불러오고 있어요.")} </div>
            ) : !results.length ? (
              <div className="px-2.5 py-7.5 gap-[13px] text-center text-muted text-[14px] flex items-center flex-col [&_strong]:text-[14px] [&_strong]:font-medium [&_p]:text-[14px] [&_p]:leading-[1.9]">
                <Search size={25} />
                <strong>
                  {discoveryResult?.status === 'needs_clarification'
                    ? translate("조건을 조금 더 알려 주세요.")
                    : translate("일치하는 포켓몬이 없어요.")}
                </strong>
                <p>
                   {translate("이름이나 조건을 바꿔 보세요.")} </p>
              </div>
            ) : (
              results.map((p) => (
                <Link prefetch={false}
                  className="px-2.5 py-[13px] border border-[transparent] gap-[7px] flex items-center w-full text-left rounded-[7px] mb-[3px] min-h-16 max-phone:px-[5px] max-phone:py-2.5 max-phone:gap-[5px] [&:hover:not([data-selected=true])]:bg-canvas data-[selected=true]:border-accent/28 data-[selected=true]:bg-accent/4 [&>svg]:text-muted [&>svg]:w-[11px] max-phone:[&>svg]:hidden [&[data-selected=true]>svg]:text-accent group"
                  key={p.pokemonId}
                  href={pokemonPath(p, locale)}
                  aria-label={translate('{name} 선택', { name: pokemonName(p, locale) })}
                  aria-current={p.pokemonId === pokemonId ? 'page' : undefined}
                  data-selected={p.pokemonId === pokemonId}
                >
                  <span className="text-[14px] tabular-nums text-muted max-phone:hidden group-data-[selected=true]:text-accent">
                    {String(
                      p.speciesId ?? p.pokemonId.split(':').at(-1),
                    ).padStart(3, '0')}
                  </span>
                  <PokemonImage
                    key={p.pokemonId}
                    pokemon={p}
                    size="small"
                  />
                  <span className="min-w-0 [&_strong]:block [&_strong]:text-[14px] [&_strong]:font-medium [&_strong]:wrap-anywhere max-phone:[&_strong]:text-[14px] [&_small]:block [&_small]:text-[14px] [&_small]:text-muted [&_small]:mt-[3px] [&_small]:wrap-anywhere max-phone:[&_small]:text-[14px]">
                    <strong>{pokemonName(p, locale)}</strong>
                    <small>{p.nameEn}</small>
                  </span>
                  <span className="gap-1 ml-auto flex flex-col items-end max-phone:gap-[3px] max-phone:[&>span]:px-1 max-phone:[&>span]:py-0.5 max-phone:[&>span]:text-[14px]">
                    {p.types.map((t) => (
                      <TypeBadge type={t} key={t} />
                    ))}
                  </span>
                  <ChevronRight size={14} />
                </Link>
              ))
            )}
            {activeList.hasNextPage && (
              <button
                className="p-[13px] border border-accent/19 block w-full text-[14px] text-accent rounded-[6px] mt-2 max-tablet:col-[1/-1]"
                onClick={() => void activeList.fetchNextPage()}
                disabled={activeList.isFetchingNextPage}
              >
                {activeList.isFetchingNextPage
                  ? translate("더 불러오는 중…")
                  : translate('더 보기 ({loaded} / {total})', { loaded: results.length, total })}
              </button>
            )}
          </div>
        </div>
      </section>
      <div className="pokedex-detail">{children}</div>
    </div>
  </>);
}
