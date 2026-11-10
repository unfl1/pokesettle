import { localizedPath } from '../../../i18n/config';
import LanguageSwitcher from '../../../components/layout/LanguageSwitcher';
import LegalLinks from '../../../components/legal/LegalLinks';
import NavigationLink from '../../../components/layout/NavigationLink';
import { pageMetadata } from '../../../i18n/metadata';

import { getI18n } from '../../../i18n/server';
import Image from 'next/image';
import maleTrainer from '../../../../public/images/trainers/original-male-partner-v2.webp';
import femaleTrainer from '../../../../public/images/trainers/original-female-partner-v1.webp';
import { titleDelays } from '../../../styles/titleDelays';
import { ArrowRight, BookOpen, MessageSquare, Sparkles, Swords, TrendingUp } from 'lucide-react';


const homeMenuColors: Record<string, string> = {
  "red": "home-menu-red [--home-tone:#c63f46]",
  "yellow": "home-menu-yellow [&.home-menu-yellow]:[--home-tone:var(--color-highlight-ink)] [&.home-menu-yellow]:[--home-fill:color-mix(in_srgb,_var(--color-highlight)_20%,_var(--color-surface))]",
  "green": "home-menu-green [--tail-direction:-1] [--home-tone:#43ad86]",
  "blue": "home-menu-blue [--tail-direction:-1] [--home-tone:var(--color-accent-strong)]",
  "purple": "home-menu-purple [&.home-menu-purple]:[--tail-direction:-1] [&.home-menu-purple]:[--home-tone:#8456bc] [&.home-menu-purple]:[--home-fill:#f3edfc]"
};

const menus = [
  { href: '/chat', title: '챗봇', description: '이 상황에서는 어떻게 할까? 근거와 함께 물어보세요.', action: '질문하기', color: 'red', icon: MessageSquare },
  { href: '/pokedex', title: '도감', description: '타입부터 특성, 기술까지. 포켓몬을 더 알아보세요.', action: '찾아보기', color: 'yellow', icon: BookOpen },
  { href: '/meta', title: '메타 순위', description: '랭크 배틀에서 주목할 포켓몬을 살펴보세요.', action: '살펴보기', color: 'green', icon: TrendingUp },
  { href: '/pobti', title: '포BTI', description: '모험 속 12가지 선택으로 나의 성향과 어울리는 포켓몬을 만나 보세요.', action: '시작하기', color: 'blue', icon: Sparkles },
  { href: '/scenario', title: '6:6 시나리오', description: '내 팀과 상대 팀을 구성하고 비교해 보세요.', action: '비교하기', color: 'purple', icon: Swords },
] as const;

export default async function Home() {
  const { locale, t: translate } = await getI18n();
  const homeTitle = translate('배틀 준비는 PokeSettle에서');
  return <div className="home-shell bg-surface min-h-[100dvh] flex flex-col">
    <div className="home-language flex justify-end [padding:12px_20px_0]"><LanguageSwitcher /></div>
    <main id="main-content" tabIndex={-1} className="home-page [width:min(100%,_1400px)] flex-1 [margin:0_auto] py-12 px-8 grid grid-cols-[minmax(0,_1fr)_minmax(0,_3fr)_minmax(0,_1fr)] items-center justify-center gap-6 screen-900:[width:min(100%,_810px)] screen-900:grid-cols-[repeat(2,_minmax(0,_1fr))] screen-900:[align-content:center] screen-900:[gap:20px_24px] screen-600:py-8 screen-600:px-5">
      <div className="home-trainer pointer-events-none select-none [&_img]:block [&_img]:w-full [&_img]:[height:clamp(260px,_34vw,_500px)] [&_img]:object-contain [&_img]:[transform:scale(.75)] screen-900:[grid-row:1] screen-900:[&_img]:w-auto screen-900:[&_img]:h-45 home-trainer-left [grid-column:1] screen-900:[justify-self:end]" aria-hidden="true">
        <Image src={maleTrainer} sizes="(max-width: 900px) 120px, 340px" alt="" loading="eager" />
      </div>
      <div className="home-content w-full max-w-186.5 min-w-0 [margin:0_auto] screen-900:[grid-column:1_/_-1] screen-900:[grid-row:2]">
        <header className="home-intro text-center mb-7.5 [&_h1]:mb-0 [&_h1]:text-[32px] [&_h1]:font-[750] [&_h1]:leading-[1.4] [&_h1]:tracking-[-1.4px] [&_h1]:[transform:translateY(-16px)] screen-600:[&_h1]:text-[26px]">
          <h1 aria-label={homeTitle}>
            <span className="home-title-typing inline-block min-h-[1.4em]" aria-hidden="true">
              {Array.from(homeTitle).map((character, index) => (
                <span key={index} className={`home-title-character inline-block w-0 overflow-hidden align-bottom whitespace-pre invisible animate-effect-home-title-reveal [@media(prefers-reduced-motion:_reduce)]:w-auto [@media(prefers-reduced-motion:_reduce)]:overflow-visible [@media(prefers-reduced-motion:_reduce)]:visible [@media(prefers-reduced-motion:_reduce)]:animate-none ${titleDelays[index] ?? titleDelays[titleDelays.length - 1]}`}>{character}</span>
              ))}
              <span className="home-title-cursor inline-block ml-[.18em] font-normal animate-effect-home-title-blink [@media(prefers-reduced-motion:_reduce)]:animate-none">|</span>
            </span>
          </h1>
        </header>
        <nav className="home-menus grid gap-3" aria-label={translate("시작할 메뉴 선택")}>
          {menus.map(({ href, title, description, action, color, icon: Icon }) => (
            <NavigationLink prefetch={false} key={href} href={localizedPath(locale, href)} className={`home-menu [--home-fill:color-mix(in_srgb,_var(--home-tone)_9%,_var(--color-surface))] [--home-outline:color-mix(in_srgb,_var(--home-tone)_68%,_var(--color-muted))] relative grid grid-cols-[46px_minmax(0,_1fr)_auto] items-center gap-5 py-5.75 px-6.25 [border:2px_solid_var(--home-outline)] rounded-[26px] bg-[var(--home-fill)] no-underline shadow-[0_2px_8px_color-mix(in_srgb,_var(--home-tone)_6%,_transparent)] [&:nth-child(even)_.home-menu-tail]:left-auto [&:nth-child(even)_.home-menu-tail]:right-[-30px] [&:nth-child(even)_.home-menu-tail]:[transform:scale(-1,_var(--tail-direction,_1))] hover:[--home-fill:color-mix(in_srgb,_var(--home-tone)_15%,_var(--color-surface))] screen-600:grid-cols-[38px_minmax(0,_1fr)_17px] screen-600:gap-3 screen-600:py-5 screen-600:px-4 screen-600:[&:nth-child(even)_.home-menu-tail]:right-[-20px] ${homeMenuColors[color]}`}>
              <svg className="home-menu-tail absolute left-[-30px] [top:calc(50%_-_20px)] w-8 h-10 overflow-visible pointer-events-none [transform:scale(1,_var(--tail-direction,_1))] [&_path]:fill-[var(--home-fill)] [&_path]:stroke-[var(--home-outline)] [&_path]:stroke-[2] [&_path]:[stroke-linecap:round] [&_path]:[stroke-linejoin:round] [&_path.home-menu-tail-seam]:fill-[none] [&_path.home-menu-tail-seam]:stroke-[var(--home-fill)] [&_path.home-menu-tail-seam]:stroke-[4] [&_path.home-menu-tail-seam]:[stroke-linecap:butt] screen-600:left-[-20px] screen-600:[top:calc(50%_-_15px)] screen-600:w-5.5 screen-600:h-7.5" viewBox="0 0 32 40" aria-hidden="true" focusable="false">
                <path d="M32 2C20 10 9 25 2 37C13 35 22 30 32 29" />
                <path className="home-menu-tail-seam" d="M32 2V29" />
              </svg>
              <span className="home-menu-icon grid place-items-center w-11.5 h-11.5 rounded-[13px] bg-surface text-[var(--home-tone)] screen-600:w-9.5 screen-600:h-9.5 screen-600:rounded-[10px]" aria-hidden="true"><Icon size={23} strokeWidth={1.8} /></span>
              <span className="home-menu-copy grid gap-[7px] [&_h2]:text-[17px] [&_h2]:font-bold [&_h2]:tracking-[-.5px] [&_h2]:text-ink [&_>_span]:text-[14px] [&_>_span]:leading-[1.6] [&_>_span]:text-muted"><h2>{translate(title)}</h2><span>{translate(description)}</span></span>
              <span className="home-menu-action flex items-center gap-3 text-ink text-[14px] whitespace-nowrap screen-600:[&_>_span]:hidden" aria-hidden="true"><span>{translate(action)}</span><ArrowRight size={17} /></span>
            </NavigationLink>
          ))}
        </nav>
      </div>
      <div className="home-trainer pointer-events-none select-none [&_img]:block [&_img]:w-full [&_img]:[height:clamp(260px,_34vw,_500px)] [&_img]:object-contain [&_img]:[transform:scale(.75)] screen-900:[grid-row:1] screen-900:[&_img]:w-auto screen-900:[&_img]:h-45 home-trainer-right [grid-column:3] screen-900:[grid-column:2] screen-900:[justify-self:start]" aria-hidden="true">
        <Image src={femaleTrainer} sizes="(max-width: 900px) 120px, 340px" alt="" loading="eager" />
      </div>
    </main>
    <footer className="home-legal [padding:0_20px_20px] text-muted text-center text-[11px] leading-[1.8] wrap-anywhere [&_p]:m-0" aria-label={translate("저작권 및 운영 안내")}>
      <LegalLinks locale={locale} />
      <p>{translate("PokeSettle은 영리 목적 없이 운영하는 비공식 팬 프로젝트이며, Pokémon 공식 서비스가 아닙니다.")}</p>
      <p>{translate("포켓몬 및 관련 캐릭터·이미지의 권리는 각 권리자에게 있습니다. ©2019 Pokémon. ©1995-2019 Nintendo/Creatures Inc. /GAME FREAK inc.")}</p>
    </footer>
  </div>;
}

export async function generateMetadata() {
  return pageMetadata('/', '배틀 준비는 PokeSettle에서', '포켓몬 도감과 문서 근거를 함께 확인하는 PokeSettle');
}
