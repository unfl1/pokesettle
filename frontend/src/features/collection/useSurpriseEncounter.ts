'use client';

import { useLayoutEffect, useState } from 'react';

// Count visible time after the first real interaction, rather than page-load time.
export function useSurpriseEncounter(enabled: boolean) {
  const [visible, setVisible] = useState(false);

  // Attach activation listeners in the commit that enables the encounter,
  // before an enabled control can receive the visitor's first interaction.
  useLayoutEffect(() => {
    if (!enabled) { setVisible(false); return; }
    let remaining = 8_000 + Math.random() * 7_000;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let startedAt = 0;
    let activated = false;
    let finished = false;

    function resume() {
      if (!activated || finished || document.hidden || timer !== null) return;
      startedAt = performance.now();
      timer = setTimeout(() => {
        timer = null;
        finished = true;
        setVisible(true);
      }, remaining);
    }

    function activate() {
      if (activated || document.hidden) return;
      activated = true;
      resume();
    }

    function onVisibilityChange() {
      if (document.hidden && timer !== null) {
        clearTimeout(timer);
        timer = null;
        remaining = Math.max(0, remaining - (performance.now() - startedAt));
      } else { resume(); }
    }

    window.addEventListener('pointerdown', activate, { passive: true });
    window.addEventListener('keydown', activate);
    window.addEventListener('scroll', activate, { passive: true, capture: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      if (timer !== null) clearTimeout(timer);
      window.removeEventListener('pointerdown', activate);
      window.removeEventListener('keydown', activate);
      window.removeEventListener('scroll', activate, true);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [enabled]);

  return enabled && visible;
}
