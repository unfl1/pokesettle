'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Copy, RotateCcw, Sparkles } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import PokemonImage from '../pokemon/components/PokemonImage';
import { axes, calculateType, isPobtiType, profiles, questions } from './model';

export default function PobtiPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const sharedType = params.get('type');
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
    const url = new URL(window.location.href);
    if (type) url.searchParams.set('type', type);
    else url.searchParams.delete('type');
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
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
  return <div className="pobti-page">
    <div className="pobti-topline"><span><Sparkles size={16} aria-hidden="true" /> PokeSettle ORIGINAL</span><span>{t('12문항 · 약 2분')}</span></div>
    <section className="pobti-card" aria-label={t('포BTI')}>
      {profile && result ? <>
        <p className="pobti-kicker">{t('나와 닮은 포켓몬은?')}</p>
        <div className="pobti-portrait"><PokemonImage key={profile.pokemonId} size="result" pokemon={{
          nameKo: t(profile.pokemon), nameEn: t(profile.pokemon),
          images: {
            artworkUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${profile.pokemonId}.png`,
            spriteUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${profile.pokemonId}.png`,
          },
        }} /></div>
        <p className="pobti-type">{result}</p>
        <h1 ref={heading} tabIndex={-1}>{t(profile.pokemon)}</h1>
        <p className="pobti-subtitle">{t(profile.title)}</p>
        <div className="pobti-traits">{axes.map((axis, index) => {
          const side = result[index] === axis.letters[0] ? 0 : 1;
          return <div key={index}><span>{axis.letters[side]}</span><div><h2>{t(axis.labels[side])}</h2><p>{t(axis.descriptions[side])}</p></div></div>;
        })}</div>
        <div className="pobti-actions"><button className="pobti-primary" onClick={share}><Copy size={18} />{t('결과 링크 복사')}</button><button className="pobti-secondary" onClick={start}><RotateCcw size={18} />{t('다시 하기')}</button></div>
        <p className="pobti-notice" role="status">{notice}</p>
        <p className="pobti-image-source"><a href="https://github.com/PokeAPI/sprites" target="_blank" rel="noreferrer">{t('이미지 출처: PokéAPI sprites')}</a> · Pokémon © The Pokémon Company</p>
      </> : started ? <>
        <div className="pobti-progress-label"><span>{t('나의 모험 스타일 찾는 중')}</span><span>{step + 1} / {questions.length}</span></div>
        <progress max={questions.length} value={step} aria-label={t('테스트 진행률')} />
        <p className="pobti-kicker">QUESTION {String(step + 1).padStart(2, '0')}</p>
        <h1 className="pobti-question" ref={heading} tabIndex={-1}>{t(question.text)}</h1>
        <p className="pobti-hint">{t('더 나다운 쪽을 골라 주세요.')}</p>
        <div className="pobti-options">{question.answers.map((answer, index) => <button key={`${step}-${index}`} onClick={() => select(index)}><span>{index === 0 ? 'A' : 'B'}</span>{t(answer)}<ArrowRight size={18} aria-hidden="true" /></button>)}</div>
        <button className="pobti-back" disabled={step === 0} onClick={() => setStep(step - 1)}><ArrowLeft size={16} />{t('이전 질문')}</button>
      </> : <>
        <p className="pobti-kicker">{t('나와 닮은 포켓몬은?')}</p>
        <div className="pobti-orb" aria-hidden="true">✦</div>
        <h1 ref={heading} tabIndex={-1}>{t('포BTI')}</h1>
        <p className="pobti-subtitle">{t('포켓몬 세계 속 나는 어떤 모습일까?')}</p>
        <p className="pobti-description">{t('모험 속 12가지 선택으로 나의 성향과 어울리는 포켓몬을 만나 보세요.')}</p>
        <div className="pobti-tags"><span>{t('16가지 모험 유형')}</span><span>{t('로그인 없이 바로')}</span></div>
        <button className="pobti-primary" onClick={start}>{t('내 포켓몬 찾기')}<ArrowRight size={18} /></button>
      </>}
    </section>
    <p className="pobti-disclaimer">{t('재미로 즐기는 비공식 팬 테스트예요. 심리 진단이나 공식 포켓몬 성격 설정과는 관계없어요.')}</p>
  </div>;
}
