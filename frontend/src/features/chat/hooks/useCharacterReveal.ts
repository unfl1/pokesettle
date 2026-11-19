import { useEffect, useState, useSyncExternalStore } from 'react';

const motionQuery = '(prefers-reduced-motion: reduce)';
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
function subscribeMotion(listener: () => void) {
  const media = window.matchMedia?.(motionQuery);
  media?.addEventListener('change', listener);
  return () => media?.removeEventListener('change', listener);
}
function prefersReducedMotion() {
  return window.matchMedia?.(motionQuery).matches ?? false;
}

// Transport chunks can contain many characters. Consume one visible grapheme per tick.
export function useCharacterReveal(target: string) {
  const reducedMotion = useSyncExternalStore(subscribeMotion, prefersReducedMotion, () => false);
  const [buffer, setBuffer] = useState('');
  const visible = reducedMotion ? target : target.startsWith(buffer) ? buffer : '';

  useEffect(() => {
    if (buffer !== visible) {
      setBuffer(visible);
      return;
    }
    if (reducedMotion || visible === target) return;
    const next = segmenter.segment(target.slice(visible.length))[Symbol.iterator]().next().value?.segment ?? '';
    const timer = window.setTimeout(() => setBuffer(visible + next), 10);
    return () => window.clearTimeout(timer);
  }, [target, visible, buffer, reducedMotion]);

  return visible;
}
