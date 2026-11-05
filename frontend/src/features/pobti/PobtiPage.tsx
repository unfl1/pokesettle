'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft, ArrowRight, Copy, RotateCcw, Sparkles } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import PokemonImage from '../pokemon/components/PokemonImage';
import { localizedPath, withoutLocale } from '../../i18n/config';
import { axes, calculateType, isPobtiType, profiles, questions } from './model';

export default function PobtiPage() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const sharedType = withoutLocale(pathname).split('/')[2]?.toUpperCase() ?? null;
  const result = isPobtiType(sharedType) ? sharedType : null;
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const [step, setStep] = useState(0);
  const [notice, setNotice] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const interactionStarted = useRef(false);
  useEffect(() => {
    if (interactionStarted.current) heading.current?.focus({ preventScroll: true });
  }, [step, started, result]);

  function navigateResult(type: string | null) {
    router.replace(localizedPath(locale, `/pobti${type ? `/${type.toLowerCase()}` : ''}`), { scroll: false });
  }
  function start() {
    interactionStarted.current = true;
    setAnswers([]); setStep(0); setStarted(true); setNotice('');
    navigateResult(null);
  }
  function select(answer: number) {
    const next = [...answers.slice(0, step), answer];
    setAnswers(next);
    if (next.length === questions.length) navigateResult(calculateType(next));
    else setStep(step + 1);
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNotice(t('결과 링크를 복사했어요!'));
    } catch {
      setNotice(t('주소창의 링크를 복사해 공유해 주세요.'));
    }
  }
  const question = questions[step];
  const profile = result ? profiles[result] : null;
  return <div className="pobti-page [width:min(100%,_720px)] [margin:0_auto] [&_button:focus-visible]:[outline:3px_solid_var(--color-accent)] [&_button:focus-visible]:[outline-offset:4px]">
    <div className="pobti-topline flex flex-wrap justify-between gap-3 mb-3.5 text-[#64748b] text-[12px] [&_>_span:first-child]:flex [&_>_span:first-child]:items-center [&_>_span:first-child]:gap-1.5 [&_>_span:first-child]:text-accent [&_>_span:first-child]:font-bold [&_>_span:first-child]:tracking-[1px]"><span><Sparkles size={16} aria-hidden="true" /> PokeSettle ORIGINAL</span><span>{t('12문항 · 약 2분')}</span></div>
    <section className="pobti-card p-10 border border-line rounded-[24px] bg-white text-center shadow-[0_16px_48px_#07164d10] [&_h1]:[margin:0_0_12px] [&_h1]:text-[clamp(32px,_5vw,_48px)] [&_h1]:font-extrabold [&_h1]:leading-[1.3] [&_h1]:tracking-[-1px] [&_h1]:wrap-anywhere [&_progress]:block [&_progress]:w-full [&_progress]:h-1.5 [&_progress]:[margin:12px_0_40px] [&_progress]:border-0 [&_progress]:rounded-[8px] [&_progress]:overflow-hidden [&_progress]:bg-accent-soft [&_progress]:[accent-color:var(--color-accent)] [&_progress::-webkit-progress-bar]:bg-accent-soft [&_progress::-webkit-progress-value]:bg-accent [&_h1.pobti-question]:min-h-21 [&_h1.pobti-question]:text-[26px] [&_h1.pobti-question]:leading-[1.6] screen-540:py-7 screen-540:px-4.5 screen-540:rounded-[18px] screen-540:[&_h1.pobti-question]:text-[22px]" aria-label={t('포BTI')}>
      {profile && result ? <>
        <p className="pobti-kicker [margin:0_0_20px] text-accent-strong font-bold text-[13px] tracking-[1px]">{t('나와 닮은 포켓몬은?')}</p>
        <div className="pobti-portrait flex justify-center [margin:0_auto_24px]"><PokemonImage key={profile.pokemonId} size="result" pokemon={{
          nameKo: t(profile.pokemon), nameEn: t(profile.pokemon),
          images: {
            artworkUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${profile.pokemonId}.png`,
            spriteUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${profile.pokemonId}.png`,
          },
        }} /></div>
        <p className="pobti-type text-[14px] tracking-[4px] text-accent font-[750] mb-2">{result}</p>
        <h1 ref={heading} tabIndex={-1}>{t(profile.pokemon)}</h1>
        <p className="pobti-subtitle [margin:0_0_16px] text-[20px] font-[650] text-ink screen-540:text-[18px]">{t(profile.title)}</p>
        <div className="pobti-traits grid grid-cols-[1fr_1fr] gap-3 [margin:28px_0] text-left [&_>_div]:flex [&_>_div]:gap-3 [&_>_div]:p-4 [&_>_div]:border [&_>_div]:border-line [&_>_div]:rounded-[12px] [&_>_div]:bg-[#ffffffb0] [&_>_div_>_span]:text-[22px] [&_>_div_>_span]:font-[750] [&_>_div_>_span]:text-accent [&_h2]:font-bold [&_h2]:mb-[5px] [&_p]:text-[#64748b] [&_p]:text-[13px] [&_p]:leading-[1.7] screen-540:grid-cols-[1fr]">{axes.map((axis, index) => {
          const side = result[index] === axis.letters[0] ? 0 : 1;
          return <div key={index}><span>{axis.letters[side]}</span><div><h2>{t(axis.labels[side])}</h2><p>{t(axis.descriptions[side])}</p></div></div>;
        })}</div>
        <div className="pobti-actions flex justify-center flex-wrap gap-2.5 screen-540:[&_>_button]:w-full"><button className="pobti-primary inline-flex items-center justify-center gap-2.5 min-h-12 py-3.5 px-6 rounded-[12px] font-bold text-white bg-accent hover:bg-accent-strong" onClick={share}><Copy size={18} />{t('결과 링크 복사')}</button><button className="pobti-secondary inline-flex items-center justify-center gap-2.5 min-h-12 py-3.5 px-6 rounded-[12px] font-bold bg-white border border-line text-ink" onClick={start}><RotateCcw size={18} />{t('다시 하기')}</button></div>
        <p className="pobti-notice mt-4 text-muted text-[13px]" role="status">{notice}</p>
        <p className="pobti-image-source mt-5 text-[11px] leading-[1.7] text-[#64748b] [&_a]:underline"><a href="https://github.com/PokeAPI/sprites" target="_blank" rel="noreferrer">{t('이미지 출처: PokéAPI sprites')}</a> · Pokémon © The Pokémon Company</p>
      </> : started ? <>
        <div className="pobti-progress-label flex justify-between gap-3 text-muted text-[12px] text-left"><span>{t('나의 모험 스타일 찾는 중')}</span><span>{step + 1} / {questions.length}</span></div>
        <progress max={questions.length} value={step} aria-label={t('테스트 진행률')} />
        <p className="pobti-kicker [margin:0_0_20px] text-accent-strong font-bold text-[13px] tracking-[1px]">QUESTION {String(step + 1).padStart(2, '0')}</p>
        <h1 className="pobti-question" ref={heading} tabIndex={-1}>{t(question.text)}</h1>
        <p className="pobti-hint text-[#64748b] text-[13px] [margin:12px_0_28px]">{t('더 나다운 쪽을 골라 주세요.')}</p>
        <div className="pobti-options grid gap-3 [&_button]:flex [&_button]:items-center [&_button]:gap-3.5 [&_button]:min-h-20 [&_button]:p-4.5 [&_button]:border [&_button]:border-line [&_button]:rounded-[14px] [&_button]:bg-white [&_button]:text-left [&_button]:leading-[1.6] [&_button:hover]:border-accent [&_button:hover]:bg-[#f2f7ff] [&_button_>_span]:grid [&_button_>_span]:place-items-center [&_button_>_span]:shrink-0 [&_button_>_span]:w-7.5 [&_button_>_span]:h-7.5 [&_button_>_span]:rounded-[9px] [&_button_>_span]:bg-accent-soft [&_button_>_span]:text-accent [&_button_>_span]:font-bold [&_button_>_svg]:shrink-0 [&_button_>_svg]:ml-auto [&_button_>_svg]:text-accent">{question.answers.map((answer, index) => <button key={`${step}-${index}`} onClick={() => select(index)}><span>{index === 0 ? 'A' : 'B'}</span>{t(answer)}<ArrowRight size={18} aria-hidden="true" /></button>)}</div>
        <button className="pobti-back flex items-center gap-2 mt-6 min-h-11 text-[#64748b] text-[13px]" disabled={step === 0} onClick={() => setStep(step - 1)}><ArrowLeft size={16} />{t('이전 질문')}</button>
      </> : <>
        <p className="pobti-kicker [margin:0_0_20px] text-accent-strong font-bold text-[13px] tracking-[1px]">{t('나와 닮은 포켓몬은?')}</p>
        <div className="pobti-orb grid place-items-center w-33 h-33 [margin:0_auto_24px] [border:8px_solid_#fff] rounded-full bg-[linear-gradient(145deg,_var(--color-accent-soft),_#d9f5ff)] shadow-[0_8px_24px_#0057ff18] text-[58px] text-accent" aria-hidden="true">✦</div>
        <h1 ref={heading} tabIndex={-1}>{t('포BTI')}</h1>
        <p className="pobti-subtitle [margin:0_0_16px] text-[20px] font-[650] text-ink screen-540:text-[18px]">{t('포켓몬 세계 속 나는 어떤 모습일까?')}</p>
        <p className="pobti-description [margin:0_auto] max-w-100 text-[#64748b] leading-[1.9]">{t('모험 속 12가지 선택으로 나의 성향과 어울리는 포켓몬을 만나 보세요.')}</p>
        <div className="pobti-tags flex flex-wrap justify-center gap-2 [margin:24px_0_32px] [&_span]:py-1.5 [&_span]:px-3 [&_span]:border [&_span]:border-line [&_span]:rounded-[30px] [&_span]:text-muted [&_span]:text-[12px] [&_span]:bg-white"><span>{t('16가지 모험 유형')}</span><span>{t('로그인 없이 바로')}</span></div>
        <button className="pobti-primary inline-flex items-center justify-center gap-2.5 min-h-12 py-3.5 px-6 rounded-[12px] font-bold text-white bg-accent hover:bg-accent-strong" onClick={start}>{t('내 포켓몬 찾기')}<ArrowRight size={18} /></button>
      </>}
    </section>
    <p className="pobti-disclaimer [margin:20px_auto] max-w-135 text-center text-[#64748b] text-[12px] leading-[1.8]">{t('재미로 즐기는 비공식 팬 테스트예요. 심리 진단이나 공식 포켓몬 성격 설정과는 관계없어요.')}</p>
  </div>;
}
