'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import Image from 'next/image';
import { useI18n } from '../../i18n/I18nProvider';
import PokemonImage from '../pokemon/components/PokemonImage';
import { catchCooldownMs, collectionKey, cooldownKey, kantoCount, parseCollection, parseNextCatchAt, pickUncaught } from './storage';
import styles from './collection.module.css';
import { useSurpriseEncounter } from './useSurpriseEncounter';
import PokeBall from './PokeBall';

export type Collectible = { id: number; name: string };
type Phase = 'ready' | 'shaking' | 'caught';
type Flight = { left: number; top: number; x: number; y: number; pokemon: Collectible };

function Portrait({ pokemon, large = false }: { pokemon: Collectible; large?: boolean }) {
  return <PokemonImage size={large ? 'result' : 'large'} pokemon={{
    nameKo: pokemon.name, nameEn: pokemon.name,
    images: {
      artworkUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemon.id}.png`,
      spriteUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`,
    },
  }} />;
}

export default function KantoCollection({ pokemon }: { pokemon: Collectible[] }) {
  const { t } = useI18n();
  const [caught, setCaught] = useState<number[]>([]);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>('ready');
  const [result, setResult] = useState<Collectible | null>(null);
  const [storageFailed, setStorageFailed] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const busy = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const dexButton = useRef<HTMLButtonElement>(null);
  const portrait = useRef<HTMLDivElement>(null);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [landed, setLanded] = useState(false);
  const [dexOpen, setDexOpen] = useState(false);
  const [nextCatchAt, setNextCatchAt] = useState(0);
  const [now, setNow] = useState(0);
  const mounted = useRef(false);
  const coolingDown = nextCatchAt > now;

  useEffect(() => {
    mounted.current = true;
    function sync() {
      try { setCaught(parseCollection(localStorage.getItem(collectionKey))); }
      catch { setStorageFailed(true); }
      try { setNextCatchAt(parseNextCatchAt(localStorage.getItem(cooldownKey))); }
      catch { setStorageFailed(true); }
      setNow(Date.now());
      setReady(true);
    }
    sync();
    function onStorage(event: StorageEvent) {
      if (event.key === collectionKey || event.key === cooldownKey || event.key === null) sync();
    }
    window.addEventListener('storage', onStorage);
    return () => {
      mounted.current = false;
      timers.current.forEach(clearTimeout);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function check() {
      clearTimeout(timer);
      const current = Date.now();
      setNow(current);
      if (nextCatchAt > current) timer = setTimeout(check, Math.min(nextCatchAt - current, 2_147_483_647));
    }
    check();
    document.addEventListener('visibilitychange', check);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', check); };
  }, [nextCatchAt]);

  useEffect(() => {
    if (!landed || coolingDown) return;
    busy.current = false;
    setResult(null);
    setPhase('ready');
    setLanded(false);
  }, [landed, coolingDown]);

  function schedule(callback: () => void, delay: number) {
    timers.current.push(setTimeout(callback, delay));
  }

  function openDex() {
    setDexOpen(true);
    dialog.current?.showModal();
  }

  function flyToDex(found: Collectible, reducedMotion: boolean) {
    const from = portrait.current?.getBoundingClientRect();
    const to = dexButton.current?.getBoundingClientRect();
    if (from && to && !reducedMotion) {
      setFlight({ left: from.left, top: from.top,
        x: to.left + to.width / 2 - (from.left + from.width / 2),
        y: to.top + to.height / 2 - (from.top + from.height / 2), pokemon: found });
      schedule(() => { setFlight(null); setLanded(true); }, 750);
    } else { setLanded(true); }
    if (document.activeElement === document.body) dexButton.current?.focus({ preventScroll: true });
  }

  function catchPokemon() {
    if (!ready || busy.current || phase !== 'ready' || caught.length === kantoCount) return;
    let deadline = nextCatchAt;
    try { deadline = Math.max(deadline, parseNextCatchAt(localStorage.getItem(cooldownKey))); }
    catch { setStorageFailed(true); }
    if (deadline > Date.now()) {
      setNextCatchAt(deadline);
      setNow(Date.now());
      return;
    }
    busy.current = true;
    setPhase('shaking');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    schedule(() => { void finishCatch(reducedMotion); }, reducedMotion ? 150 : 3800);
  }

  async function finishCatch(reducedMotion: boolean) {
    let entered = false;
    function claim() {
      entered = true;
      if (!mounted.current) return;
      // Check again under the cross-tab lock before awarding a Pokémon.
      let latest = caught;
      try { latest = parseCollection(localStorage.getItem(collectionKey)); }
      catch { setStorageFailed(true); }
      let deadline = nextCatchAt;
      try { deadline = Math.max(deadline, parseNextCatchAt(localStorage.getItem(cooldownKey))); }
      catch { setStorageFailed(true); }
      if (deadline > Date.now()) {
        setCaught(latest);
        setNextCatchAt(deadline);
        setNow(Date.now());
        setPhase('caught');
        setLanded(true);
        return;
      }
      const id = pickUncaught(latest);
      const found = pokemon.find(entry => entry.id === id);
      if (found) {
        const next = [...latest, found.id].sort((a, b) => a - b);
        const expiry = Date.now() + catchCooldownMs;
        try {
          localStorage.setItem(cooldownKey, String(expiry));
          localStorage.setItem(collectionKey, JSON.stringify(next));
          setStorageFailed(false);
        } catch { setStorageFailed(true); }
        setCaught(next);
        setNextCatchAt(expiry);
        setNow(Date.now());
        setResult(found);
        schedule(() => flyToDex(found, reducedMotion), reducedMotion ? 1500 : 1600);
      } else { setCaught(latest); setLanded(true); }
      setPhase('caught');
    }
    try {
      if (navigator.locks) await navigator.locks.request(collectionKey, claim);
      else claim();
    } catch { if (!entered) claim(); }
  }

  const complete = caught.length === kantoCount;
  const encounterVisible = useSurpriseEncounter(ready && phase === 'ready' && !complete && !coolingDown);
  const showEncounter = phase === 'ready' ? encounterVisible : !landed;
  return <>
    <button ref={dexButton} type="button" className={`${styles.dexButton} ${landed ? styles.landed : ''}`}
      onClick={openDex} disabled={!ready} aria-haspopup="dialog"
      aria-label={t('나의 관동 도감')} title={t('나의 관동 도감')}>
      <Image className={styles.dexArtwork} src="/images/collection/kanto-pokedex-emblem.png" width={32} height={32} sizes="32px" alt="" />
      <span className={styles.count}>{caught.length}</span>
    </button>
    {showEncounter && createPortal(<>
      {phase !== 'ready' && !landed && <div
        className={`${styles.captureBackdrop} ${flight ? styles.backdropLeaving : ''}`} aria-hidden="true" />}
      {!flight && !landed && (phase !== 'ready' || !complete) && <div className={`${styles.collection} ${phase !== 'ready' ? styles.capturing : ''}`}>
        {result ? <div ref={portrait} className={`${styles.portrait} ${styles.reveal}`}>
          <Portrait key={result.id} pokemon={result} large />
        </div> : <button type="button" className={styles.dockBall} onClick={catchPokemon}
          aria-label={t('몬스터볼 열기')} disabled={phase === 'shaking'} aria-busy={phase === 'shaking'}>
          <PokeBall shaking={phase === 'shaking'} />
        </button>}
      </div>}
    </>, document.body)}
    <span className="sr-only" role="status">{result ? t('{name}, 넌 내 거야!', { name: result.name }) : ''}</span>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="collection-title" onClose={() => setDexOpen(false)}>
      <div className={styles.dialogHeader}>
        <div><span className={styles.eyebrow}>KANTO · 001—151</span><h2 id="collection-title">{t('나의 관동 도감')}</h2></div>
        <button type="button" onClick={() => dialog.current?.close()} aria-label={t('수집 도감 닫기')} className={styles.close}><X size={21} /></button>
      </div>
      <div className={styles.progressLabel}><span>{t('만난 포켓몬')}</span><strong>{caught.length} / {kantoCount}</strong></div>
      <progress className={styles.progress} value={caught.length} max={kantoCount} aria-label={t('도감 수집 진행률')} />
      <p className={styles.storageNote}>{t('포획은 10분에 한 번 가능해요. 시간이 지나면 사용 중 몬스터볼이 다시 나타나요.')}</p>
      <p className={styles.storageNote}>{t('이 브라우저에만 저장돼요. 사이트 데이터를 지우면 수집 기록도 사라져요.')}</p>
      {storageFailed && <p className={styles.storageWarning} role="alert">{t('수집 기록을 저장할 수 없어요. 브라우저 저장 공간 설정을 확인해 주세요.')}</p>}
      {complete && <p className={styles.finished}>{t('관동 도감 완성! 151마리를 모두 만났어요.')}</p>}
      <ol className={styles.grid}>
        {dexOpen && pokemon.map(entry => {
          const owned = caught.includes(entry.id);
          return <li key={entry.id} className={`${styles.entry} ${owned ? styles.owned : ''}`}>
            <span className={styles.number}>No. {String(entry.id).padStart(3, '0')}{owned && <span aria-label={t('수집 완료')}>✓</span>}</span>
            <div className={styles.sprite}>{owned ? <Portrait pokemon={entry} /> : <span className={styles.unknown} aria-hidden="true">?</span>}</div>
            <span className={styles.name}>{owned ? entry.name : t('미발견')}</span>
          </li>;
        })}
      </ol>
    </dialog>
    {flight && createPortal(<div className={styles.flyer} aria-hidden="true" style={{
      left: flight.left, top: flight.top, '--flight-x': `${flight.x}px`, '--flight-y': `${flight.y}px`,
    } as CSSProperties}><Portrait pokemon={flight.pokemon} large /></div>, document.body)}
  </>;
}
