import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  ArrowDown,
  UsersRound,
  ArrowRight,
  MessageSquare,
  ChevronRight,
  CircleHelp,
  Database,
  Layers,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { pokemonApi } from '../features/pokemon/api';
import { useWorkspace } from '../features/chat/hooks/useWorkspace';
import ChatPanel from '../features/chat/components/ChatPanel';
import TeamWorkspace from '../features/team/components/TeamWorkspace';
import { PokemonProfile } from '../features/pokemon/components/PokemonProfile';
import { TypeBadge } from '../features/pokemon/components/TypeBadge';
import PokemonImage from '../features/pokemon/components/PokemonImage';
import type { PokemonSummary } from '../features/pokemon/types';

export default function App() {
  const [params, setParams] = useSearchParams();
  const pokemonId = params.get('pokemon') ?? 'pokemon:25';
  const chatPokemonId = params.get('chat') ?? pokemonId;
  const w = useWorkspace(chatPokemonId);
  const selectedDetail = useQuery({
    queryKey: ['detail', pokemonId, w.status.data?.metadataCount],
    queryFn: () => pokemonApi.detail(pokemonId),
  });
  const [view, setView] = useState<'chat' | 'teams'>('chat');
  const [teamsOpened, setTeamsOpened] = useState(false);
  const [mode, setMode] = useState<'name' | 'conditions'>('name');
  const [name, setName] = useState('');
  const [condition, setCondition] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [submittedCondition, setSubmittedCondition] = useState<string | null>(
    null,
  );
  const ready = w.status.data?.ready;
  const list = useInfiniteQuery({
    queryKey: ['catalog-pages', name.trim(), w.status.data?.metadataCount],
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
      w.status.data?.metadataCount,
    ],
    queryFn: ({ pageParam }) => pokemonApi.discover(submittedCondition!, pageParam),
    initialPageParam: 0,
    enabled:
      submittedCondition !== null && w.session.isSuccess && Boolean(ready),
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
    setParams({ pokemon: pokemon.pokemonId, chat: chatPokemonId });
    setCatalogOpen(false);
  }

  return (
    <div>
      <aside
        className="px-0 py-5.5 gap-4 fixed top-0 right-auto bottom-0 left-0 w-18 bg-[#121820] border-r border-r-[#28313e] flex items-center flex-col z-[2] max-tablet:w-13.5"
        aria-label="주 메뉴"
      >
        <a
          className="border-[2px] border-accent w-7.5 h-7.5 rounded-full grid place-items-center relative before:[content:''] before:absolute before:left-0 before:right-0 before:border-t-[2px] before:border-t-accent [&_span]:border-[2px] [&_span]:border-accent [&_span]:w-2.5 [&_span]:h-2.5 [&_span]:rounded-full [&_span]:bg-[#121820] [&_span]:z-[1]"
          href="/"
          aria-label="PokeTact 홈"
        >
          <span />
        </a>
        <div className="mx-0 my-3 h-[1px] w-[25px] bg-[#28313e]" />
        <button
          className="w-10 h-10 grid place-items-center text-[#8b96a8] rounded-[10px] aria-[current=page]:text-accent aria-[current=page]:bg-[#a7efc514]"
          aria-current={view === 'chat' ? 'page' : undefined}
          title="챗봇"
          aria-label="챗봇"
          onClick={() => {
            setView('chat');
            requestAnimationFrame(() =>
              document.getElementById('chat-question')?.focus(),
            );
          }}
        >
          <MessageSquare size={20} />
        </button>
        <button
          className="grid h-10 w-10 place-items-center rounded-[10px] text-[#8b96a8] aria-[current=page]:bg-[#a7efc514] aria-[current=page]:text-accent"
          aria-label="팀과 전투 준비"
          title="팀과 전투 준비"
          aria-current={view === 'teams' ? 'page' : undefined}
          onClick={() => {
            setTeamsOpened(true);
            setView('teams');
          }}
        >
          <UsersRound size={20} />
        </button>
        <button
          className="w-10 h-10 grid place-items-center text-[#8b96a8] rounded-[10px] aria-[current=page]:text-accent aria-[current=page]:bg-[#a7efc514]"
          title="이용 안내"
          aria-label="이용 안내"
          onClick={() => setShowHelp((v) => !v)}
          aria-expanded={showHelp}
        >
          <CircleHelp size={20} />
        </button>
        <span className="p-2 border border-[#344151] mt-auto rounded-[50%] text-[10px] text-[#9daabc]">
          PC
        </span>
      </aside>
      <div className="ml-18 max-tablet:ml-13.5">
        <header className="px-8.5 py-0 gap-5.5 h-18 border-b border-b-[#28313e] flex items-center max-desktop:px-6 max-tablet:px-4.5 max-tablet:h-15.5 max-phone:gap-2.5">
          <a
            href="/"
            className="text-[19px] font-bold tracking-[-0.7px] max-phone:text-[17px] [&_span]:px-1 [&_span]:py-[3px] [&_span]:border [&_span]:border-[#a7efc544] [&_span]:text-accent [&_span]:text-[10px] [&_span]:ml-1.5 [&_span]:rounded-[3px] [&_span]:align-middle"
          >
            PokeTact<span>AI</span>
          </a>
          <span className="h-[17px] border-l border-l-[#344151] max-tablet:hidden" />
          <span className="text-[11px] text-[#8997aa] max-tablet:hidden">
            생각에 근거를 더하다
          </span>
          <div className="gap-2 ml-auto flex items-center text-[10px] text-[#9ca8b9] max-phone:text-[8px] [&_i]:w-1.5 [&_i]:h-1.5 [&_i]:rounded-full [&_i]:bg-[#e0b574] [&_i[data-online=true]]:bg-accent [&_i[data-online=true]]:shadow-[0_0_8px_#a7efc530]">
            <i data-online={Boolean(ready)} />
            <span>
              {w.status.isPending
                ? '연결 확인 중'
                : ready
                  ? '서비스 연결됨'
                  : '설정 확인 필요'}
            </span>
          </div>
        </header>
        <main className="px-8.5 py-6.5 m-auto max-w-450 max-desktop:p-6 max-tablet:px-[17px] max-tablet:py-5.5 max-phone:px-3 max-phone:py-[19px]">
          {teamsOpened && (
            <div hidden={view !== 'teams'}>
              <TeamWorkspace
                sessionReady={w.session.isSuccess}
                onBack={() => setView('chat')}
                onAsk={(question) => {
                  w.setDraft(question);
                  setView('chat');
                  requestAnimationFrame(() =>
                    document.getElementById('chat-question')?.focus(),
                  );
                }}
              />
            </div>
          )}
          {view === 'chat' && (
            <>
              <div className="gap-4 flex justify-between items-center mb-[25px] max-tablet:mb-5">
                <div>
                  <p className="gap-[7px] flex items-center text-[#7e8da1] text-[10px] mb-3">
                    워크스페이스
                    <ChevronRight size={12} />
                    코치와 대화
                  </p>
                  <h1 className="text-[28px] tracking-[-1.3px] font-[650] leading-[1.4] max-desktop:text-[26px] max-tablet:text-[25px] max-phone:text-[22px]">
                    질문에서, 더 좋은 판단으로
                    <span className="text-accent">.</span>
                  </h1>
                  <p className="text-[#8f9caf] text-[12px] leading-[1.8] mt-[7px] max-phone:text-[10px]">
                    포켓몬을 선택하고 대화해 보세요. 답변의 근거도 함께 확인할
                    수 있어요.
                  </p>
                </div>
                <div className="px-[13px] py-[11px] border border-[#2c3644] gap-2.5 flex items-center text-[10px] text-[#8e9bac] rounded-[6px] max-desktop:hidden [&_svg]:text-accent [&_strong]:text-[#c9d3df] [&_strong]:font-medium">
                  <Database size={15} />
                  <span>
                    일반 도감{' '}
                    <strong>
                      {w.status.data?.speciesCount ??
                        w.status.data?.metadataCount ??
                        '—'}
                      종
                    </strong>
                  </span>
                  <span className="h-[11px] border-l border-l-[#364151]" />
                  Champions 적격성 미확인
                </div>
              </div>
              {showHelp && (
                <section className="px-4 py-[13px] border border-[#a7efc530] gap-[11px] flex items-start bg-[#d3b97c08] text-[#c4b38f] rounded-[8px] text-[11px] leading-[1.8] mb-5 max-phone:flex-wrap [&_p]:text-[#8d9bab] [&_p]:text-[11px] [&_h2]:text-[12px] [&_h2]:text-[#b9d5c6] [&_h2]:mb-[5px] [&_svg]:mt-[3px]">
                  <ShieldCheck size={20} />
                  <div>
                    <h2>출처를 확인하며 읽어 주세요.</h2>
                    <p>
                      이름 검색 또는 자연어 조건으로 포켓몬을 선택한 뒤
                      질문하세요. 답변의 작은 근거 번호를 누르면 실제 인용
                      자료를 확인할 수 있습니다. 일반 도감 정보는 Champions의
                      사용 가능 여부나 전략을 보장하지 않습니다. 대화 기록은
                      현재 브라우저의 세션에 연결되어 서버에 보관되며, 쿠키가
                      만료되거나 삭제되면 다시 접근할 수 없습니다.
                    </p>
                  </div>
                  <button
                    className="gap-[5px] text-[10px] text-[#b4d8c6] flex items-center ml-auto whitespace-nowrap"
                    onClick={() => setShowHelp(false)}
                  >
                    닫기
                  </button>
                </section>
              )}
              {(w.status.error || w.session.error) && (
                <div
                  className="px-4 py-[13px] border border-[#d3b97c36] gap-[11px] flex items-center bg-[#d3b97c08] text-[#c4b38f] rounded-[8px] text-[11px] leading-[1.8] mb-5 max-phone:flex-wrap [&_button]:gap-[5px] [&_button]:text-[10px] [&_button]:text-[#b4d8c6] [&_button]:flex [&_button]:items-center [&_button]:ml-auto [&_button]:whitespace-nowrap [&_p]:text-[#8d9bab] [&_p]:text-[11px]"
                  role="alert"
                >
                  <CircleHelp size={19} />
                  <span>
                    {w.status.error?.message ?? w.session.error?.message}
                  </span>
                  <button onClick={w.refresh}>
                    <RefreshCw size={14} />
                    다시 연결
                  </button>
                </div>
              )}
              {w.status.data && !ready && (
                <div
                  className="px-4 py-[13px] border border-[#d3b97c36] gap-[11px] flex items-center bg-[#d3b97c08] text-[#c4b38f] rounded-[8px] text-[11px] leading-[1.8] mb-5 max-phone:flex-wrap [&_button]:gap-[5px] [&_button]:text-[10px] [&_button]:text-[#b4d8c6] [&_button]:flex [&_button]:items-center [&_button]:ml-auto [&_button]:whitespace-nowrap [&_p]:text-[#8d9bab] [&_p]:text-[11px]"
                  role="alert"
                >
                  <CircleHelp size={19} />
                  <div>
                    <strong>
                      {w.status.data.missing.includes('INDEX_NOT_READY')
                        ? '도감 색인이 준비되지 않았어요.'
                        : '답변 모델 연결 설정이 필요해요.'}
                    </strong>
                    <p>
                      {w.status.data.missing.includes('INDEX_NOT_READY')
                        ? '서버에서 데이터 준비를 완료한 뒤 다시 확인해 주세요.'
                        : '서버에 모델 키와 모델 이름을 설정한 뒤 다시 확인해 주세요. 도감 정보는 계속 살펴볼 수 있습니다.'}
                    </p>
                  </div>
                  <button onClick={w.refresh}>
                    <RefreshCw size={14} />
                    다시 확인
                  </button>
                </div>
              )}
              <div className="gap-5.5 grid grid-cols-[274px_minmax(0,_1fr)] items-start max-desktop:gap-[17px] max-desktop:grid-cols-[240px_minmax(0,_1fr)] max-tablet:grid-cols-[minmax(0,_1fr)]">
                <section
                  className="border border-[#2b3441] rounded-[12px] bg-[#151c26] overflow-hidden"
                  aria-label="포켓몬 탐색"
                >
                  <div className="px-[19px] pt-[21px] pb-[17px] flex justify-between items-center max-tablet:px-[17px] max-tablet:py-4 [&_h2]:text-[14px] [&_h2]:font-semibold [&_p]:text-[10px] [&_p]:text-[#8391a5] [&_p]:mt-1.5 max-tablet:[&_p]:hidden [&_svg]:text-[#6e7f95] max-tablet:[&>svg]:hidden">
                    <div>
                      <h2>포켓몬 찾기</h2>
                      <p>궁금한 포켓몬부터 시작하세요.</p>
                    </div>
                    <Search size={19} />
                    <button
                      className="hidden max-tablet:gap-[5px] max-tablet:flex max-tablet:items-center max-tablet:text-[10px] max-tablet:text-accent max-tablet:[&[aria-expanded='true']_svg]:transform-[rotate(90deg)]"
                      onClick={() => setCatalogOpen((v) => !v)}
                      aria-expanded={catalogOpen}
                      aria-controls="catalog-controls"
                    >
                      {catalogOpen ? '접기' : '선택·검색 열기'}
                      <ChevronRight size={13} />
                    </button>
                  </div>
                  <div
                    id="catalog-controls"
                    className="max-tablet:[&[data-expanded=false]]:hidden"
                    data-expanded={catalogOpen}
                  >
                    <div
                      className="p-[3px] mx-4 border border-[#273341] gap-[3px] flex mt-0 mb-[15px] bg-[#101720] rounded-[7px] max-tablet:mb-2.5 [&_button]:px-[3px] [&_button]:py-2 [&_button]:gap-1.5 [&_button]:flex-1 [&_button]:flex [&_button]:items-center [&_button]:justify-center [&_button]:text-[10px] [&_button]:text-[#8998ab] [&_button]:rounded-[4px] [&_[aria-pressed=true]]:bg-[#27333f] [&_[aria-pressed=true]]:text-[#cfe4db]"
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
                      <div className="p-2.5 mx-4 my-0 border border-[#344150] gap-2 flex items-center bg-[#111923] rounded-[7px] text-[#8493a8] [&_input]:border-0 [&_input]:border-[currentColor] [&_input]:w-full [&_input]:bg-[transparent] [&_input]:outline-none [&_input]:text-[11px] [&_input]:min-w-0 [&_input]:text-[#e8edf3] [&_kbd]:text-[13px] [&_kbd]:text-[#63758c]">
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
                        <kbd>⌕</kbd>
                      </div>
                    ) : (
                      <form
                        className="mx-4 my-0 [&_textarea]:p-2.5 [&_textarea]:border [&_textarea]:border-[#344150] [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:bg-[#111923] [&_textarea]:rounded-[6px] [&_textarea]:text-[#e8edf3] [&_textarea]:text-[11px] [&_textarea]:leading-[1.7] [&_button]:px-0 [&_button]:py-[11px] [&_button]:gap-[7px] [&_button]:w-full [&_button]:flex [&_button]:items-center [&_button]:text-[10px] [&_button]:text-[#b1d9c4] [&_button_svg:last-child]:ml-auto"
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
                            !w.session.isSuccess
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
                        className="p-[11px] mx-4 my-3 border border-[#a7efc529] bg-[#a7efc506] rounded-[6px] text-[10px] leading-[1.8] text-[#9ebcac] [&_p]:mt-[5px] [&_small]:text-[9px] [&_small]:text-[#8ca0b4]"
                        role="status"
                      >
                        <span className="gap-1.5 text-[9px] tracking-[0.7px] text-[#8295a8] flex items-center">
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
                        className="[&_button]:gap-[5px] [&_button]:text-[10px] [&_button]:text-[#b4d8c6] [&_button]:flex [&_button]:items-center [&_button]:ml-auto [&_button]:whitespace-nowrap p-[11px] mx-4 my-3 border border-[#d3b97c30] bg-[#d3b97c08] rounded-[6px] text-[10px] leading-[1.8] text-[#b6aa91]"
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
                    <div className="px-4.5 flex items-center justify-between pt-5 pb-2.5 text-[9px] text-[#7e8da1] max-tablet:pt-3 [&_span:last-child]:gap-[7px] [&_span:last-child]:flex [&_span:last-child]:items-center">
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
                      className="px-2 h-[clamp(400px,_calc(100dvh_-_400px),_710px)] overflow-auto pt-0 pb-2.5 [scrollbar-width:thin] [scrollbar-color:#354253_transparent] max-tablet:h-42.5 max-tablet:grid max-tablet:grid-cols-[1fr_1fr] max-tablet:[align-content:start] max-tablet:gap-y-0 max-tablet:gap-x-1"
                      aria-label="포켓몬 목록"
                      aria-busy={activeList.isFetching}
                    >
                      {activeList.isPending ? (
                        <div
                          className="px-2.5 py-7.5 gap-[13px] text-center text-[#8198af] text-[11px] flex items-center flex-col"
                          role="status"
                        >
                          <LoaderCircle
                            size={18}
                            className="animate-loading motion-reduce:animate-none"
                          />
                          도감을 불러오고 있어요.
                        </div>
                      ) : !results.length ? (
                        <div className="px-2.5 py-7.5 gap-[13px] text-center text-[#8198af] text-[11px] flex items-center flex-col [&_strong]:text-[12px] [&_strong]:font-medium [&_p]:text-[10px] [&_p]:leading-[1.9]">
                          <Search size={25} />
                          <strong>
                            {discoveryResult?.status === 'needs_clarification'
                              ? '조건을 조금 더 알려 주세요.'
                              : '일치하는 포켓몬이 없어요.'}
                          </strong>
                          <p>
                            현재 확보된 일반 도감에서 검색합니다.
                            <br />
                            이름이나 조건을 바꿔 보세요.
                          </p>
                        </div>
                      ) : (
                        results.map((p) => (
                          <button
                            className="px-2.5 py-[13px] border border-[transparent] gap-[7px] flex items-center w-full text-left rounded-[7px] mb-[3px] min-h-16 max-phone:px-[5px] max-phone:py-2.5 max-phone:gap-[5px] [&:hover:not([aria-pressed=true])]:bg-[#202b38] aria-pressed:border-[#a7efc547] aria-pressed:bg-[#a7efc50b] [&>svg]:text-[#65788e] [&>svg]:w-[11px] max-phone:[&>svg]:hidden [&[aria-pressed=true]>svg]:text-accent group"
                            key={p.pokemonId}
                            onClick={() => choose(p)}
                            aria-label={`${p.nameKo ?? p.nameEn} 선택`}
                            aria-pressed={p.pokemonId === pokemonId}
                          >
                            <span className="text-[9px] tabular-nums text-[#677b91] max-phone:hidden group-aria-pressed:text-accent">
                              {String(
                                p.speciesId ?? p.pokemonId.split(':').at(-1),
                              ).padStart(3, '0')}
                            </span>
                            <PokemonImage
                              key={p.pokemonId}
                              pokemon={p}
                              size="small"
                            />
                            <span className="min-w-0 [&_strong]:block [&_strong]:text-[12px] [&_strong]:font-medium [&_strong]:wrap-anywhere max-phone:[&_strong]:text-[10px] [&_small]:block [&_small]:text-[9px] [&_small]:text-[#75889f] [&_small]:mt-[3px] [&_small]:wrap-anywhere max-phone:[&_small]:text-[8px]">
                              <strong>{p.nameKo ?? p.nameEn}</strong>
                              <small>{p.nameEn}</small>
                            </span>
                            <span className="gap-1 ml-auto flex flex-col items-end max-phone:gap-[3px] max-phone:[&>span]:px-1 max-phone:[&>span]:py-0.5 max-phone:[&>span]:text-[8px]">
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
                          className="p-[13px] border border-[#a7efc530] block w-full text-[11px] text-accent rounded-[6px] mt-2 max-tablet:col-[1/-1]"
                          onClick={() => void activeList.fetchNextPage()}
                          disabled={activeList.isFetchingNextPage}
                        >
                          {activeList.isFetchingNextPage
                            ? '더 불러오는 중…'
                            : `더 보기 (${results.length} / ${total})`}
                        </button>
                      )}
                    </div>
                    <div className="px-4.5 py-[13px] gap-[7px] border-t border-t-[#283341] flex items-center text-[#6f8198] text-[9px] max-tablet:px-[17px] max-tablet:py-[9px]">
                      <Layers size={13} />
                      <span>기본 종·별도 폼 · 일반 도감</span>
                    </div>
                  </div>
                </section>
                <div className="gap-4.5 flex flex-col min-w-0">
                  {selectedDetail.isPending ? (
                    <div
                      className="border border-[#2b3441] rounded-[12px] bg-[#151c26] overflow-hidden p-5.5 gap-2.5 flex items-center min-h-30 text-[12px] text-[#94a7ba]"
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
                      className="border border-[#2b3441] rounded-[12px] bg-[#151c26] overflow-hidden p-5.5 gap-2.5 flex items-center min-h-30 text-[12px] text-[#94a7ba]"
                      role="alert"
                    >
                      <CircleHelp size={20} />
                      <p>{selectedDetail.error.message}</p>
                      <button
                        onClick={() => {
                          void selectedDetail.refetch();
                        }}
                        className="gap-[5px] text-[10px] text-[#b4d8c6] flex items-center ml-auto whitespace-nowrap"
                      >
                        다시 확인
                      </button>
                    </div>
                  ) : (
                    selectedDetail.data && (
                      <PokemonProfile
                        key={selectedDetail.data.pokemonId}
                        pokemon={selectedDetail.data}
                        onGuide={() => w.submit('guide')}
                        disabled={!w.canSend || !w.status.data?.ready || pokemonId !== chatPokemonId}
                      />
                    )
                  )}
                  {pokemonId !== chatPokemonId && selectedDetail.data && (
                    <div className="rounded-[8px] border border-[#344253] p-3 text-[11px] leading-[1.9]">
                      <p>포켓몬 정보를 살펴보는 동안 기존 대화를 유지합니다.</p>
                      <button
                        className="mt-2 rounded-[6px] border border-[#a7efc540] px-3 py-2 text-accent"
                        onClick={() => setParams({ pokemon: pokemonId, chat: pokemonId })}
                      >
                        이 포켓몬으로 대화하기
                      </button>
                      <p className="mt-1 text-[#8295a8]">선택 시 해당 포켓몬의 대화 기록으로 전환합니다. 기존 기록은 유지됩니다.</p>
                    </div>
                  )}
                  <ChatPanel key={chatPokemonId} workspace={w} />
                  <footer className="gap-3 flex items-center justify-between text-[#5f758b] text-[9px] [&>span:first-child]:gap-1.5 [&>span:first-child]:flex [&>span:first-child]:items-center max-tablet:[&>span:last-child]:hidden">
                    <span>
                      <ShieldCheck size={12} />
                      확인된 범위 안에서, 근거와 함께.
                    </span>
                    <span>PokeTact · 비공식 학습 프로젝트</span>
                  </footer>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
