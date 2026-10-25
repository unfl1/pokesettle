import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, BookOpen, CircleHelp, MessageSquare, ShieldCheck, Sparkles, Swords, TrendingUp, X } from 'lucide-react';
import { useWorkspace } from '../features/chat/hooks/useWorkspace';
import ChatPanel from '../features/chat/components/ChatPanel';
import PokedexPage from '../features/pokemon/pages/PokedexPage';
import TeamWorkspace from '../features/team/components/TeamWorkspace';
import MetagamePage from '../features/metagame/MetagamePage';

type View = 'chat' | 'pokedex' | 'scenario' | 'meta';
const navigation = [
  { id: 'chat', path: '/chat', label: '챗봇', icon: MessageSquare },
  { id: 'pokedex', path: '/pokedex', label: '도감', icon: BookOpen },
  { id: 'meta', path: '/meta', label: '메타 순위', icon: TrendingUp },
  { id: 'scenario', path: '/scenario', label: '6:6 시나리오', icon: Swords },
] as const;
const introductions = {
  meta: { label: null, title: '싱글 메타 순위', description: '자주 쓰는 포켓몬과 주요 세팅을 출처·기준일과 함께 살펴보세요.' },
  pokedex: { label: null, title: '도감', description: '포켓몬의 타입·특성·종족값과 기술을 확인하세요.' },
  scenario: { label: 'BATTLE WORKSPACE', title: '우리 팀의 가능성을 살펴보세요.', description: '양쪽 팀을 구성하고, 선출과 공격·교체 시나리오를 차근차근 비교해 보세요.' },
};

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const w = useWorkspace();
  const view: View = location.pathname === '/pokedex' || (location.pathname === '/' && new URLSearchParams(location.search).has('pokemon'))
    ? 'pokedex' : location.pathname === '/scenario' ? 'scenario' : location.pathname === '/meta' ? 'meta' : 'chat';
  // Keep visited workspaces mounted so navigation preserves drafts and team edits.
  const [visited, setVisited] = useState<Set<View>>(() => new Set([view]));
  const [lastView, setLastView] = useState(view);
  const [pokedexSearch, setPokedexSearch] = useState(view === 'pokedex' ? location.search : '');
  const [showHelp, setShowHelp] = useState(false);
  if (lastView !== view) {
    setLastView(view);
    setVisited(previous => new Set([...previous, view]));
  }
  if (view === 'pokedex' && pokedexSearch !== location.search) {
    setPokedexSearch(location.search);
  }
  const ready = Boolean(w.status.data?.ready);
  const intro = view === 'chat' ? null : introductions[view];
  useEffect(() => {
    document.title = `PokeTact · ${navigation.find(item => item.id === view)!.label}`;
  }, [view]);
  const goToChat = (question?: string) => {
    if (question) w.setDraft(question);
    navigate('/chat');
    requestAnimationFrame(() => document.getElementById('chat-question')?.focus());
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
      <header className="site-header">
        <div className="header-inner">
          <Link to="/chat" className="brand" aria-label="PokeTact 홈">
            <span className="brand-symbol"><span /></span>
            PokeTact<span className="brand-tag">BETA</span>
          </Link>
          <nav className="primary-nav" aria-label="주 메뉴">
            {navigation.map(({ id, path, label, icon: Icon }) => (
              <Link key={id} to={id === 'pokedex' ? `${path}${pokedexSearch}` : path} aria-current={view === id ? 'page' : undefined}>
                <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <span className="connection-status" title={ready ? '서비스 연결됨' : '서비스 상태 확인 필요'}>
              <i data-online={ready} />
              <span>{w.status.isPending ? '연결 확인 중' : ready ? '서비스 연결됨' : '설정 확인 필요'}</span>
            </span>
            <button className="help-button" aria-label="이용 안내" aria-expanded={showHelp} onClick={() => setShowHelp(value => !value)}>
              <CircleHelp size={19} />
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className={`workspace-main ${view === 'chat' ? 'chat-width' : ''}`}>
        {intro && (
          <section className="page-intro" aria-labelledby="page-title">
            {intro.label && <span className="eyebrow"><Sparkles size={13} />{intro.label}</span>}
            <h1 id="page-title">{intro.title}</h1>
            <p>{intro.description}</p>
          </section>
        )}

        {showHelp && (
          <section className="notice help-notice" aria-label="이용 안내">
            <ShieldCheck size={20} />
            <div>
              <h2>출처를 확인하며 읽어 주세요.</h2>
              <p>챗봇에서는 배틀 상황을 질문하고, 도감에서는 포켓몬 정보를 살펴보세요. 6:6 시나리오에서는 팀을 구성하고 비교할 수 있어요. 일반 도감 정보는 Champions 사용 가능 여부를 보장하지 않아요. 대화 기록은 현재 브라우저의 세션에 연결되며, 쿠키가 만료되거나 삭제되면 다시 접근할 수 없어요.</p>
            </div>
            <button aria-label="이용 안내 닫기" onClick={() => setShowHelp(false)}><X size={18} /></button>
          </section>
        )}
        {(w.status.error || w.session.error) && (
          <div className="notice" role="alert">
            <CircleHelp size={18} /><span>{w.status.error?.message ?? w.session.error?.message}</span>
            <button onClick={w.refresh}>다시 연결</button>
          </div>
        )}
        {w.status.data && !ready && view === 'chat' && (
          <div className="notice" role="alert">
            <CircleHelp size={18} />
            <div>
              <strong>{w.status.data.missing.includes('INDEX_NOT_READY') ? '도감 색인이 준비되지 않았어요.' : '답변 모델 연결 설정이 필요해요.'}</strong>
              <p>도감 기본 질문과 정보 조회는 계속 이용할 수 있어요. 전략 답변은 서비스 준비 후 이용해 주세요.</p>
            </div>
            <button onClick={w.refresh}>다시 확인</button>
          </div>
        )}

        <div hidden={view !== 'chat'} data-testid="chat-page">
          <ChatPanel workspace={w} />
        </div>
        {visited.has('pokedex') && (
          <div hidden={view !== 'pokedex'} data-testid="pokedex-page">
            <PokedexPage active={view === 'pokedex'} ready={ready} sessionReady={w.session.isSuccess} metadataCount={w.status.data?.metadataCount} />
          </div>
        )}
        {visited.has('meta') && <div hidden={view !== 'meta'} data-testid="meta-page"><MetagamePage active={view === 'meta'} /></div>}
        {visited.has('scenario') && (
          <div hidden={view !== 'scenario'} data-testid="scenario-page">
            <TeamWorkspace sessionReady={w.session.isSuccess} onAsk={goToChat} />
          </div>
        )}
      </main>
      <footer className="site-footer">
        <Link to="/chat" className="footer-brand">PokeTact<span>포켓몬을 이해하는 더 나은 방법</span></Link>
        <span>비공식 포켓몬 전략 도우미 <ArrowUpRight size={12} /></span>
      </footer>
    </div>
  );
}
