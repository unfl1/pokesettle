import Link from 'next/link';
import { ArrowRight, BookOpen, MessageSquare, Swords, TrendingUp } from 'lucide-react';

const menus = [
  { href: '/chat', title: '챗봇', description: '이 상황에서는 어떻게 할까? 근거와 함께 물어보세요.', action: '질문하기', color: 'red', icon: MessageSquare },
  { href: '/pokedex', title: '도감', description: '타입부터 특성, 기술까지. 포켓몬을 더 알아보세요.', action: '찾아보기', color: 'yellow', icon: BookOpen },
  { href: '/meta', title: '메타 순위', description: '랭크 배틀에서 주목할 포켓몬을 살펴보세요.', action: '살펴보기', color: 'green', icon: TrendingUp },
  { href: '/scenario', title: '6:6 시나리오', description: '내 팀과 상대 팀을 구성하고 비교해 보세요.', action: '비교하기', color: 'blue', icon: Swords },
] as const;

export default function Home() {
  return <div className="home-page">
    <header className="home-intro">
      <p className="home-kicker">작은 준비가, 다음 한 수를 바꾸니까.</p>
      <h1>배틀 준비는 PokeTact에서.</h1>
      <p>질문하고, 찾아보고, 비교해 보세요.</p>
    </header>
    <nav className="home-menus" aria-label="시작할 메뉴 선택">
      {menus.map(({ href, title, description, action, color, icon: Icon }) => (
        <Link key={href} href={href} className={`home-menu home-menu-${color}`}>
          <span className="home-menu-icon" aria-hidden="true"><Icon size={23} strokeWidth={1.8} /></span>
          <span className="home-menu-copy"><h2>{title}</h2><span>{description}</span></span>
          <span className="home-menu-action" aria-hidden="true"><span>{action}</span><ArrowRight size={17} /></span>
        </Link>
      ))}
    </nav>
  </div>;
}
