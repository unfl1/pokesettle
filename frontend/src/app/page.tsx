import Link from 'next/link';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import { ArrowRight, BookOpen, MessageSquare, Swords, TrendingUp } from 'lucide-react';

const menus = [
  { href: '/chat', title: '챗봇', description: '이 상황에서는 어떻게 할까? 근거와 함께 물어보세요.', action: '질문하기', color: 'red', icon: MessageSquare },
  { href: '/pokedex', title: '도감', description: '타입부터 특성, 기술까지. 포켓몬을 더 알아보세요.', action: '찾아보기', color: 'yellow', icon: BookOpen },
  { href: '/meta', title: '메타 순위', description: '랭크 배틀에서 주목할 포켓몬을 살펴보세요.', action: '살펴보기', color: 'green', icon: TrendingUp },
  { href: '/scenario', title: '6:6 시나리오', description: '내 팀과 상대 팀을 구성하고 비교해 보세요.', action: '비교하기', color: 'blue', icon: Swords },
] as const;

const homeTitle = '배틀 준비는 PokeTact에서';

export default function Home() {
  return <div className="home-shell">
    <main id="main-content" tabIndex={-1} className="home-page">
      <div className="home-trainer home-trainer-left" aria-hidden="true">
        <Image src="/images/trainers/original-male-partner-v2.png" width={900} height={1748} sizes="(max-width: 900px) 120px, 340px" alt="" loading="eager" />
      </div>
      <div className="home-content">
        <header className="home-intro">
          <h1 aria-label={homeTitle}>
            <span className="home-title-typing" aria-hidden="true">
              {Array.from(homeTitle).map((character, index) => (
                <span key={index} className="home-title-character" style={{ '--reveal-delay': `${250 + index * 77}ms` } as CSSProperties}>{character}</span>
              ))}
              <span className="home-title-cursor">|</span>
            </span>
          </h1>
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
      </div>
      <div className="home-trainer home-trainer-right" aria-hidden="true">
        <Image src="/images/trainers/original-female-partner-v1.png" width={900} height={1748} sizes="(max-width: 900px) 120px, 340px" alt="" loading="eager" />
      </div>
    </main>
    <footer className="home-legal" aria-label="저작권 및 운영 안내">
      <p>PokeTact는 영리 목적 없이 운영하는 비공식 팬 프로젝트이며, Pokémon 공식 서비스가 아닙니다.</p>
      <p>포켓몬 및 관련 캐릭터·이미지의 권리는 각 권리자에게 있습니다.</p>
      <p>©2019 Pokémon. ©1995-2019 Nintendo/Creatures Inc. /GAME FREAK inc.</p>
    </footer>
  </div>;
}
