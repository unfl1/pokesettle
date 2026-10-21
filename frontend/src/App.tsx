import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  ArrowDown,
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
import { api } from './services/api';
import { useWorkspace } from './hooks/useWorkspace';
import ChatPanel from './components/ChatPanel';
import { PokemonProfile, TypeBadge } from './components/PokemonProfile';
import PokemonImage from './components/PokemonImage';
import type { PokemonSummary } from './types';

export default function App() {
  const [params, setParams] = useSearchParams();
  const pokemonId = params.get('pokemon') ?? 'pokemon:25';
  const w = useWorkspace(pokemonId);
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
    queryFn: ({ pageParam }) => api.pokemon(name.trim(), pageParam),
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
    queryFn: ({ pageParam }) => api.discover(submittedCondition!, pageParam),
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
    setParams({ pokemon: pokemon.pokemonId });
    setCatalogOpen(false);
  }

  return (
    <div className="app-shell">
      <aside className="rail" aria-label="주 메뉴">
        <a className="brand-symbol" href="/" aria-label="PokéCoach 홈">
          <span />
        </a>
        <div className="rail-divider" />
        <button
          className="rail-link active"
          title="챗봇"
          aria-label="챗봇"
          onClick={() => document.getElementById('chat-question')?.focus()}
        >
          <MessageSquare size={20} />
        </button>
        <button
          className="rail-link"
          title="이용 안내"
          aria-label="이용 안내"
          onClick={() => setShowHelp((v) => !v)}
          aria-expanded={showHelp}
        >
          <CircleHelp size={20} />
        </button>
        <span className="rail-bottom">PC</span>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <a href="/" className="wordmark">
            PokéCoach<span>AI</span>
          </a>
          <span className="topbar-divider" />
          <span className="topbar-subtitle">생각에 근거를 더하다</span>
          <div className="connection-state">
            <i className={ready ? 'online' : ''} />
            <span>
              {w.status.isPending
                ? '연결 확인 중'
                : ready
                  ? '서비스 연결됨'
                  : '설정 확인 필요'}
            </span>
          </div>
        </header>
        <main className="workspace">
          <div className="page-heading">
            <div>
              <p className="breadcrumb">
                워크스페이스
                <ChevronRight size={12} />
                코치와 대화
              </p>
              <h1>
                질문에서, 더 좋은 판단으로<span className="heading-dot">.</span>
              </h1>
              <p className="page-description">
                포켓몬을 선택하고 대화해 보세요. 답변의 근거도 함께 확인할 수
                있어요.
              </p>
            </div>
            <div className="dataset-pill">
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
              <span className="dataset-divider" />
              Champions 적격성 미확인
            </div>
          </div>
          {showHelp && (
            <section className="help-panel">
              <ShieldCheck size={20} />
              <div>
                <h2>출처를 확인하며 읽어 주세요.</h2>
                <p>
                  이름 검색 또는 자연어 조건으로 포켓몬을 선택한 뒤 질문하세요.
                  답변의 작은 근거 번호를 누르면 실제 인용 자료를 확인할 수
                  있습니다. 일반 도감 정보는 Champions의 사용 가능 여부나 전략을
                  보장하지 않습니다. 대화 기록은 현재 브라우저의 세션에 연결되어
                  서버에 보관되며, 쿠키가 만료되거나 삭제되면 다시 접근할 수
                  없습니다.
                </p>
              </div>
              <button
                className="text-button"
                onClick={() => setShowHelp(false)}
              >
                닫기
              </button>
            </section>
          )}
          {(w.status.error || w.session.error) && (
            <div className="service-alert" role="alert">
              <CircleHelp size={19} />
              <span>{w.status.error?.message ?? w.session.error?.message}</span>
              <button onClick={w.refresh}>
                <RefreshCw size={14} />
                다시 연결
              </button>
            </div>
          )}
          {w.status.data && !ready && (
            <div className="service-alert" role="alert">
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
          <div className="research-grid">
            <section className="catalog-panel" aria-label="포켓몬 탐색">
              <div className="catalog-title">
                <div>
                  <h2>포켓몬 찾기</h2>
                  <p>궁금한 포켓몬부터 시작하세요.</p>
                </div>
                <Search size={19} />
                <button
                  className="catalog-toggle"
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
                className={`catalog-controls ${catalogOpen ? 'expanded' : ''}`}
              >
                <div
                  className="search-tabs"
                  role="group"
                  aria-label="검색 방식"
                >
                  <button
                    className={mode === 'name' ? 'selected' : ''}
                    onClick={() => setMode('name')}
                  >
                    <Search size={13} />
                    이름 검색
                  </button>
                  <button
                    className={mode === 'conditions' ? 'selected' : ''}
                    onClick={() => setMode('conditions')}
                  >
                    <Sparkles size={13} />
                    조건으로 찾기
                  </button>
                </div>
                {mode === 'name' ? (
                  <div className="name-search">
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
                    className="condition-form"
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
                        <LoaderCircle size={14} className="spin" />
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
                    className={`discovery-note ${discoveryResult!.status === 'needs_clarification' ? 'clarify' : ''}`}
                    role="status"
                  >
                    <span className="eyebrow">
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
                  <div className="list-error" role="alert">
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
                <div className="list-caption">
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
                  className="pokemon-list"
                  aria-label="포켓몬 목록"
                  aria-busy={activeList.isFetching}
                >
                  {activeList.isPending ? (
                    <div className="list-loading" role="status">
                      <LoaderCircle size={18} className="spin" />
                      도감을 불러오고 있어요.
                    </div>
                  ) : !results.length ? (
                    <div className="empty-list">
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
                        className={`pokemon-item ${p.pokemonId === pokemonId ? 'selected' : ''}`}
                        key={p.pokemonId}
                        onClick={() => choose(p)}
                        aria-label={`${p.nameKo ?? p.nameEn} 선택`}
                        aria-pressed={p.pokemonId === pokemonId}
                      >
                        <span className="pokemon-number">
                          {String(
                            p.speciesId ?? p.pokemonId.split(':').at(-1),
                          ).padStart(3, '0')}
                        </span>
                        <PokemonImage
                          key={p.pokemonId}
                          pokemon={p}
                          size="small"
                        />
                        <span className="pokemon-copy">
                          <strong>{p.nameKo ?? p.nameEn}</strong>
                          <small>{p.nameEn}</small>
                        </span>
                        <span className="list-types">
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
                      className="load-more"
                      onClick={() => void activeList.fetchNextPage()}
                      disabled={activeList.isFetchingNextPage}
                    >
                      {activeList.isFetchingNextPage
                        ? '더 불러오는 중…'
                        : `더 보기 (${results.length} / ${total})`}
                    </button>
                  )}
                </div>
                <div className="catalog-footnote">
                  <Layers size={13} />
                  <span>기본 종·별도 폼 · 일반 도감</span>
                </div>
              </div>
            </section>
            <div className="detail-column">
              {w.detail.isPending ? (
                <div className="profile-card profile-loading" role="status">
                  <LoaderCircle className="spin" size={21} />
                  포켓몬 정보를 불러오고 있어요.
                </div>
              ) : w.detail.error ? (
                <div className="profile-card profile-loading" role="alert">
                  <CircleHelp size={20} />
                  <p>{w.detail.error.message}</p>
                  <button
                    onClick={() => {
                      void w.detail.refetch();
                    }}
                    className="text-button"
                  >
                    다시 확인
                  </button>
                </div>
              ) : (
                w.detail.data && (
                  <PokemonProfile
                    pokemon={w.detail.data}
                    onGuide={() => w.submit('guide')}
                    disabled={!w.canSend}
                  />
                )
              )}
              <ChatPanel key={pokemonId} workspace={w} />
              <footer className="workspace-footer">
                <span>
                  <ShieldCheck size={12} />
                  확인된 범위 안에서, 근거와 함께.
                </span>
                <span>PokéCoach AI · 비공식 학습 프로젝트</span>
              </footer>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
