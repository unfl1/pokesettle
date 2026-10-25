import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowRight, ChevronRight, CircleHelp, LoaderCircle, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { pokemonApi } from '../api';
import { PokemonProfile } from '../components/PokemonProfile';
import { TypeBadge } from '../components/TypeBadge';
import PokemonImage from '../components/PokemonImage';
import type { PokemonSummary } from '../types';

export default function PokedexPage({ active, ready, sessionReady, metadataCount }: {
  active: boolean;
  ready: boolean;
  sessionReady: boolean;
  metadataCount?: number;
}) {
  const [params, setParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState(params.get('pokemon') ?? 'pokemon:25');
  const pokemonId = params.get('pokemon') ?? selectedId;
  const selectedDetail = useQuery({
    queryKey: ['detail', pokemonId, metadataCount],
    queryFn: () => pokemonApi.detail(pokemonId),
    enabled: active,
  });
  const [mode, setMode] = useState<'name' | 'conditions'>('name');
  const [name, setName] = useState('');
  const [condition, setCondition] = useState('');
  const [submittedCondition, setSubmittedCondition] = useState<string | null>(
    null,
  );
  const list = useInfiniteQuery({
    queryKey: ['catalog-pages', name.trim(), metadataCount],
    queryFn: ({ pageParam }) => pokemonApi.pokemon(name.trim(), pageParam),
    initialPageParam: 0,
    enabled: active,
    getNextPageParam: (last) => {
      const next = (last.offset ?? 0) + last.items.length;
      return next < last.total && last.items.length ? next : undefined;
    },
  });
  const discovery = useInfiniteQuery({
    queryKey: [
      'discovery-pages',
      submittedCondition,
      metadataCount,
    ],
    queryFn: ({ pageParam }) => pokemonApi.discover(submittedCondition!, pageParam),
    initialPageParam: 0,
    enabled:
      active && submittedCondition !== null && sessionReady && ready,
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
  function choose(pokemon: PokemonSummary) {
    setSelectedId(pokemon.pokemonId);
    setParams({ pokemon: pokemon.pokemonId });
  }

  return (
    <div className="pokedex-layout">
      <section
        className="border border-line rounded-[12px] bg-surface overflow-hidden"
        aria-label="포켓몬 탐색"
      >
        <div className="px-[19px] pt-[21px] pb-[17px] flex justify-between items-center max-tablet:px-[17px] max-tablet:py-4 [&_h2]:text-[14px] [&_h2]:font-semibold [&_svg]:text-muted max-tablet:[&>svg]:hidden">
          <div>
            <h2>포켓몬 찾기</h2>
          </div>
          <Search size={19} />
        </div>
        <div
          id="catalog-controls"
          className="catalog-controls"
        >
          <div
            className="p-[3px] mx-4 border border-line gap-[3px] flex mt-0 mb-[15px] bg-canvas rounded-[7px] max-tablet:mb-2.5 [&_button]:px-[3px] [&_button]:py-2 [&_button]:gap-1.5 [&_button]:flex-1 [&_button]:flex [&_button]:items-center [&_button]:justify-center [&_button]:text-[11px] [&_button]:text-muted [&_button]:rounded-[4px] [&_[aria-pressed=true]]:bg-surface [&_[aria-pressed=true]]:text-ink"
            role="group"
            aria-label="검색 방식"
          >
            <button
              aria-pressed={mode === 'name'}
              onClick={() => setMode('name')}
            >
              <Search size={13} />
              이름 검색
            </button>
            <button
              aria-pressed={mode === 'conditions'}
              onClick={() => setMode('conditions')}
            >
              <Sparkles size={13} />
              조건으로 찾기
            </button>
          </div>
          {mode === 'name' ? (
            <div className="p-2.5 mx-4 my-0 border border-line gap-2 flex items-center bg-canvas rounded-[7px] text-muted [&_input]:border-0 [&_input]:border-[currentColor] [&_input]:w-full [&_input]:bg-[transparent] [&_input]:outline-none [&_input]:text-[12px] [&_input]:min-w-0 [&_input]:text-ink">
              <Search size={16} />
              <label className="sr-only" htmlFor="pokemon-name">
                포켓몬 이름 검색
              </label>
              <input
                id="pokemon-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={200}
              />
            </div>
          ) : (
            <form
              className="mx-4 my-0 [&_textarea]:p-2.5 [&_textarea]:border [&_textarea]:border-line [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:bg-canvas [&_textarea]:rounded-[6px] [&_textarea]:text-ink [&_textarea]:text-[12px] [&_textarea]:leading-[1.7] [&_button]:px-0 [&_button]:py-[11px] [&_button]:gap-[7px] [&_button]:w-full [&_button]:flex [&_button]:items-center [&_button]:text-[11px] [&_button]:text-ink [&_button_svg:last-child]:ml-auto"
              onSubmit={(e) => {
                e.preventDefault();
                if (condition.trim()) searchConditions();
              }}
            >
              <label className="sr-only" htmlFor="pokemon-condition">
                자연어 검색 조건
              </label>
              <textarea
                id="pokemon-condition"
                rows={3}
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                placeholder="예: 전기 타입이고 스피드 종족값이 90 이상"
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
                  ? '조건을 확인하고 있어요'
                  : '조건에 맞는 포켓몬 찾기'}
                <ArrowRight size={14} />
              </button>
            </form>
          )}
          {isDiscovery && discoveryResult && (
            <div
              className="p-[11px] mx-4 my-3 border border-accent/16 bg-accent/2 rounded-[6px] text-[11px] leading-[1.8] text-muted [&_p]:mt-[5px] [&_small]:text-[10px] [&_small]:text-muted"
              role="status"
            >
              <span className="gap-1.5 text-[10px] tracking-[0.7px] text-muted flex items-center">
                {discoveryResult!.status === 'needs_clarification'
                  ? '조건 확인이 필요해요'
                  : '해석한 조건'}
              </span>
              <p>{discoveryResult!.interpretation}</p>
              {discoveryResult!.unknownConditions.map((text, i) => (
                <p key={i}>{text}</p>
              ))}
              {discoveryResult!.excludedUnknownCount > 0 && (
                <small>
                  미확인 속성이 있는{' '}
                  {discoveryResult!.excludedUnknownCount}종을 확정
                  결과에서 제외했습니다.
                </small>
              )}
            </div>
          )}
          {listError && (
            <div
              className="[&_button]:gap-[5px] [&_button]:text-[11px] [&_button]:text-ink [&_button]:flex [&_button]:items-center [&_button]:ml-auto [&_button]:whitespace-nowrap p-[11px] mx-4 my-3 border border-warning-line bg-warning-soft rounded-[6px] text-[11px] leading-[1.8] text-warning"
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
                다시 시도
              </button>
            </div>
          )}
          <div className="px-4.5 flex items-center justify-between pt-5 pb-2.5 text-[10px] text-muted max-tablet:pt-3 [&_span:last-child]:gap-[7px] [&_span:last-child]:flex [&_span:last-child]:items-center">
            <span>
              {isDiscovery
                ? '조건 검색 결과'
                : name
                  ? '이름 검색 결과'
                  : '전체 도감'}
            </span>
            <span>
              {total}개 항목
              <ArrowDown size={10} />
            </span>
          </div>
          <div
            className="px-2 h-[560px] overflow-auto pt-0 pb-2.5 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] max-tablet:h-70 max-tablet:grid max-tablet:grid-cols-1 max-tablet:[align-content:start] max-tablet:gap-y-0 max-tablet:gap-x-1"
            aria-label="포켓몬 목록"
            aria-busy={activeList.isFetching}
          >
            {activeList.isPending ? (
              <div
                className="px-2.5 py-7.5 gap-[13px] text-center text-muted text-[12px] flex items-center flex-col"
                role="status"
              >
                <LoaderCircle
                  size={18}
                  className="animate-loading motion-reduce:animate-none"
                />
                도감을 불러오고 있어요.
              </div>
            ) : !results.length ? (
              <div className="px-2.5 py-7.5 gap-[13px] text-center text-muted text-[12px] flex items-center flex-col [&_strong]:text-[13px] [&_strong]:font-medium [&_p]:text-[11px] [&_p]:leading-[1.9]">
                <Search size={25} />
                <strong>
                  {discoveryResult?.status === 'needs_clarification'
                    ? '조건을 조금 더 알려 주세요.'
                    : '일치하는 포켓몬이 없어요.'}
                </strong>
                <p>
                  이름이나 조건을 바꿔 보세요.
                </p>
              </div>
            ) : (
              results.map((p) => (
                <button
                  className="px-2.5 py-[13px] border border-[transparent] gap-[7px] flex items-center w-full text-left rounded-[7px] mb-[3px] min-h-16 max-phone:px-[5px] max-phone:py-2.5 max-phone:gap-[5px] [&:hover:not([aria-pressed=true])]:bg-canvas aria-pressed:border-accent/28 aria-pressed:bg-accent/4 [&>svg]:text-muted [&>svg]:w-[11px] max-phone:[&>svg]:hidden [&[aria-pressed=true]>svg]:text-accent group"
                  key={p.pokemonId}
                  onClick={() => choose(p)}
                  aria-label={`${p.nameKo ?? p.nameEn} 선택`}
                  aria-pressed={p.pokemonId === pokemonId}
                >
                  <span className="text-[10px] tabular-nums text-muted max-phone:hidden group-aria-pressed:text-accent">
                    {String(
                      p.speciesId ?? p.pokemonId.split(':').at(-1),
                    ).padStart(3, '0')}
                  </span>
                  <PokemonImage
                    key={p.pokemonId}
                    pokemon={p}
                    size="small"
                  />
                  <span className="min-w-0 [&_strong]:block [&_strong]:text-[13px] [&_strong]:font-medium [&_strong]:wrap-anywhere max-phone:[&_strong]:text-[11px] [&_small]:block [&_small]:text-[10px] [&_small]:text-muted [&_small]:mt-[3px] [&_small]:wrap-anywhere max-phone:[&_small]:text-[10px]">
                    <strong>{p.nameKo ?? p.nameEn}</strong>
                    <small>{p.nameEn}</small>
                  </span>
                  <span className="gap-1 ml-auto flex flex-col items-end max-phone:gap-[3px] max-phone:[&>span]:px-1 max-phone:[&>span]:py-0.5 max-phone:[&>span]:text-[10px]">
                    {p.types.map((t) => (
                      <TypeBadge type={t} key={t} />
                    ))}
                  </span>
                  <ChevronRight size={14} />
                </button>
              ))
            )}
            {activeList.hasNextPage && (
              <button
                className="p-[13px] border border-accent/19 block w-full text-[12px] text-accent rounded-[6px] mt-2 max-tablet:col-[1/-1]"
                onClick={() => void activeList.fetchNextPage()}
                disabled={activeList.isFetchingNextPage}
              >
                {activeList.isFetchingNextPage
                  ? '더 불러오는 중…'
                  : `더 보기 (${results.length} / ${total})`}
              </button>
            )}
          </div>
        </div>
      </section>
      <div className="min-w-0">
        {selectedDetail.isPending ? (
          <div
            className="border border-line rounded-[12px] bg-surface overflow-hidden p-5.5 gap-2.5 flex items-center min-h-30 text-[13px] text-muted"
            role="status"
          >
            <LoaderCircle
              className="animate-loading motion-reduce:animate-none"
              size={21}
            />
            포켓몬 정보를 불러오고 있어요.
          </div>
        ) : selectedDetail.error ? (
          <div
            className="border border-line rounded-[12px] bg-surface overflow-hidden p-5.5 gap-2.5 flex items-center min-h-30 text-[13px] text-muted"
            role="alert"
          >
            <CircleHelp size={20} />
            <p>{selectedDetail.error.message}</p>
            <button
              onClick={() => {
                void selectedDetail.refetch();
              }}
              className="gap-[5px] text-[11px] text-ink flex items-center ml-auto whitespace-nowrap"
            >
              다시 확인
            </button>
          </div>
        ) : (
          selectedDetail.data && (
            <PokemonProfile
              key={selectedDetail.data.pokemonId}
              pokemon={selectedDetail.data}
            />
          )
        )}
      </div>
    </div>
  );
}
