'use client';

import { useEffect, useState } from 'react';
import { GoogleAnalytics } from '@next/third-parties/google';

export default function RuntimeAnalytics() {
  const [gaId, setGaId] = useState<string>();
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/analytics/config', { cache: 'no-store', credentials: 'omit', signal: controller.signal })
      .then(async response => {
        if (!response.ok) return;
        const config: { gaId?: string } = await response.json();
        if (config.gaId && /^G-[A-Z0-9]+$/.test(config.gaId)) setGaId(config.gaId);
      })
      .catch(() => { /* Analytics availability must not block navigation. */ });
    return () => controller.abort();
  }, []);
  return gaId ? <GoogleAnalytics gaId={gaId} /> : null;
}
