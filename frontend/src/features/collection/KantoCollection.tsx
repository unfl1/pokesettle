'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import Image from 'next/image';
import pokedexEmblem from '../../../public/images/collection/kanto-pokedex-emblem.webp';
import { useI18n } from '../../i18n/I18nProvider';
import PokemonImage from '../pokemon/components/PokemonImage';
import { catchCooldownMs, collectionKey, cooldownKey, kantoCount, parseCollection, parseNextCatchAt, pickUncaught } from './storage';
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

// Coordinates come from the current viewport; static presentation stays in Tailwind.
function FlyingPortrait({ flight }: { flight: Flight }) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const animation = element.current?.animate([
      { opacity: 1, transform: `translate(${flight.left}px, ${flight.top}px) scale(1)`, offset: 0 },
      { opacity: 1, transform: `translate(${flight.left}px, ${flight.top - 22}px) scale(1.06)`, offset: 0.25 },
      { opacity: 1, offset: 0.9 },
      { opacity: 0, transform: `translate(${flight.left + flight.x}px, ${flight.top + flight.y}px) scale(0.08)`, offset: 1 },
    ], { duration: 750, easing: 'cubic-bezier(.55, .02, .78, .5)', fill: 'both' });
    return () => animation?.cancel();
  }, [flight]);
  return <div ref={element} aria-hidden="true" className="collection-flyer pointer-events-none fixed left-0 top-0 z-100 h-58.5 w-58.5 opacity-0 [&_img]:h-58.5 [&_img]:w-58.5 [&>span]:h-58.5 [&>span]:w-58.5"><Portrait pokemon={flight.pokemon} large /></div>;
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
    <button ref={dexButton} type="button" className={`collection-dexButton focus-visible:[outline:3px_solid_var(--color-accent)] focus-visible:[outline-offset:5px] relative grid place-items-center shrink-0 w-8.5 h-8.5 border-0 rounded-[9px] bg-surface text-accent-strong cursor-pointer hover:bg-accent-hover ${landed ? "collection-landed animate-effect-dex-receive motion-reduce:animate-none" : ''}`}
      onClick={openDex} disabled={!ready} aria-haspopup="dialog"
      aria-label={t('나의 관동 도감')} title={t('나의 관동 도감')}>
      <Image className="collection-dexArtwork w-8 h-8 object-contain" src={pokedexEmblem} width={32} height={32} sizes="32px" alt="" />
      <span className="collection-count absolute right-[-3px] top-[-4px] min-w-3.5 py-0.25 px-0.75 rounded-[8px] text-accent-strong bg-accent-soft text-[9px] font-bold leading-[1.3]">{caught.length}</span>
    </button>
    {showEncounter && createPortal(<>
      {phase !== 'ready' && !landed && <div
        className={`collection-captureBackdrop fixed inset-0 z-90 bg-[#050c1894] pointer-events-none animate-effect-backdrop-in [&.collection-backdropLeaving]:animate-effect-backdrop-out motion-reduce:animate-none motion-reduce:[&.collection-backdropLeaving]:animate-none ${flight ? "collection-backdropLeaving" : ''}`} aria-hidden="true" />}
      {!flight && !landed && (phase !== 'ready' || !complete) && <div className={`collection-collection fixed z-25 [bottom:max(82px,_calc(env(safe-area-inset-bottom)_+_22px))] left-[50%] [transform:translateX(-50%)] grid place-items-center [grid-template:minmax(0,_1fr)_/_minmax(0,_1fr)] w-20 h-20 [transition:bottom_450ms_ease-out,_transform_450ms_ease-out,_width_450ms_ease-out,_height_450ms_ease-out] [&.collection-capturing]:z-91 [&.collection-capturing]:bottom-[50%] [&.collection-capturing]:[transform:translate(-50%,_50%)] [&.collection-capturing]:[width:clamp(180px,_42vw,_240px)] [&.collection-capturing]:[height:clamp(180px,_42vw,_240px)] [&_.collection-dockBall]:animate-effect-encounter-appear motion-reduce:[&_.collection-dockBall]:animate-none ${phase !== 'ready' ? "collection-capturing [&.collection-capturing]:[&_.collection-dockBall]:w-full [&.collection-capturing]:[&_.collection-dockBall]:h-full [&.collection-capturing]:[&_.collection-dockBall]:opacity-100 [&.collection-capturing]:[&_.collection-dockBall]:animate-none [&.collection-capturing]:[&_.collection-dockBall_.collection-ball]:w-[90%] [&.collection-capturing]:[&_.collection-dockBall_.collection-ball]:h-[90%]" : ''}`}>
        {result ? <div ref={portrait} className={`collection-portrait grid place-items-center w-58.5 h-58.5 pointer-events-none [&_img]:w-58.5 [&_img]:h-58.5 [&_>_span]:w-58.5 [&_>_span]:h-58.5 collection-reveal relative animate-effect-reveal motion-reduce:animate-none`}>
          <Portrait key={result.id} pokemon={result} large />
        </div> : <button type="button" className="collection-dockBall grid place-items-center relative w-20 h-20 p-0 border-0 rounded-full bg-transparent shadow-[none] cursor-pointer disabled:cursor-default focus-visible:[outline:3px_solid_var(--color-accent)] focus-visible:[outline-offset:3px] [&:not(:disabled):hover_.collection-ball]:[transform:rotate(-10deg)] [&_.collection-ball]:w-17 [&_.collection-ball]:h-17 [&_.collection-ball]:[transition:width_450ms_ease-out,_height_450ms_ease-out] motion-reduce:[&:not(:disabled):hover_.collection-ball]:[transform:none]" onClick={catchPokemon}
          aria-label={t('몬스터볼 열기')} disabled={phase === 'shaking'} aria-busy={phase === 'shaking'}>
          <PokeBall shaking={phase === 'shaking'} />
        </button>}
      </div>}
    </>, document.body)}
    <span className="sr-only" role="status">{result ? t('{name}, 넌 내 거야!', { name: result.name }) : ''}</span>
    <dialog ref={dialog} className="collection-dialog [width:min(720px,_calc(100%_-_24px))] max-h-[85dvh] m-auto p-7 border border-line rounded-[24px] text-ink bg-surface shadow-[0_24px_100px_#07164d30] overscroll-contain [&::backdrop]:bg-[#07164d66] [&::backdrop]:[backdrop-filter:blur(5px)] screen-600:py-5 screen-600:px-3.5" aria-labelledby="collection-title" onClose={() => setDexOpen(false)}>
      <div className="collection-dialogHeader flex justify-between items-center gap-4 text-left [&_h2]:[margin:4px_0_22px] [&_h2]:text-[23px] [&_h2]:tracking-[-.6px] screen-600:[&_h2]:text-[20px]">
        <div><span className="collection-eyebrow text-muted text-[10px] tracking-[2px] font-semibold">KANTO · 001—151</span><h2 id="collection-title">{t('나의 관동 도감')}</h2></div>
        <button type="button" onClick={() => dialog.current?.close()} aria-label={t('수집 도감 닫기')} className="collection-close focus-visible:[outline:3px_solid_var(--color-accent)] focus-visible:[outline-offset:5px] grid place-items-center shrink-0 [align-self:flex-start] w-9 h-9 border border-line rounded-full bg-surface cursor-pointer"><X size={21} /></button>
      </div>
      <div className="collection-progressLabel flex justify-between text-[12px] [&_strong]:text-accent-strong"><span>{t('만난 포켓몬')}</span><strong>{caught.length} / {kantoCount}</strong></div>
      <progress className="collection-progress block w-full h-1.5 border-0 rounded-[10px] [margin:10px_0_14px] overflow-hidden bg-accent-soft [&::-webkit-progress-bar]:bg-accent-soft [&::-webkit-progress-value]:bg-accent [&::-webkit-progress-value]:rounded-[10px] [&::-moz-progress-bar]:bg-accent" value={caught.length} max={kantoCount} aria-label={t('도감 수집 진행률')} />
      <p className="collection-storageNote text-left text-muted text-[11px] leading-[1.7] [margin:2px_0]">{t('포획은 10분에 한 번 가능해요. 시간이 지나면 사용 중 몬스터볼이 다시 나타나요.')}</p>
      <p className="collection-storageNote text-left text-muted text-[11px] leading-[1.7] [margin:2px_0]">{t('이 브라우저에만 저장돼요. 사이트 데이터를 지우면 수집 기록도 사라져요.')}</p>
      {storageFailed && <p className="collection-storageWarning text-[#a14526] text-[12px] [margin:10px_0_0]" role="alert">{t('수집 기록을 저장할 수 없어요. 브라우저 저장 공간 설정을 확인해 주세요.')}</p>}
      {complete && <p className="collection-finished [margin:16px_0] text-[13px] text-accent-strong">{t('관동 도감 완성! 151마리를 모두 만났어요.')}</p>}
      <ol className="collection-grid grid grid-cols-[repeat(5,_minmax(0,_1fr))] gap-2 p-0 [margin:22px_0_0] list-none screen-600:grid-cols-[repeat(3,_minmax(0,_1fr))] screen-600:gap-1.5">
        {dexOpen && pokemon.map(entry => {
          const owned = caught.includes(entry.id);
          return <li key={entry.id} className={`collection-entry min-w-0 grid justify-items-center [padding:10px_5px_12px] [border:1px_solid_var(--color-line)] rounded-[12px] bg-canvas [&:not(.collection-owned)_.collection-name]:text-muted ${owned ? "collection-owned [&.collection-owned]:border-accent-soft [&.collection-owned]:bg-accent-hover [&.collection-owned]:[&_.collection-number]:text-accent-strong" : ''}`}>
            <span className="collection-number w-full flex items-center justify-between [padding:0_3px] text-[9px] text-muted tabular-nums">No. {String(entry.id).padStart(3, '0')}{owned && <span aria-label={t('수집 완료')}>✓</span>}</span>
            <div className="collection-sprite grid place-items-center h-20 [&_img]:max-w-full [&_>_span]:max-w-full">{owned ? <Portrait pokemon={entry} /> : <span className="collection-unknown text-[32px] font-[300] text-[#c5ccd8]" aria-hidden="true">?</span>}</div>
            <span className="collection-name text-[11px] wrap-anywhere">{owned ? entry.name : t('미발견')}</span>
          </li>;
        })}
      </ol>
    </dialog>
    {flight && createPortal(<FlyingPortrait flight={flight} />, document.body)}
  </>;
}
