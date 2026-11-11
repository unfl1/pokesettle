import 'server-only';
import { cache } from 'react';
import { serverRequest } from '../../lib/serverApi';
import type { SinglesMeta } from './types';

export const getSinglesMeta = cache(async () => {
  const data = await serverRequest<SinglesMeta>('/meta/singles').catch(() => null);
  if (!data) return null;
  // Preserve the backend's 6h freshness / 24h expiry even if revalidation fails.
  const age = Date.now() - Date.parse(data.collectedAt);
  if (!Number.isFinite(age) || age >= 24 * 60 * 60 * 1000) return null;
  return age >= 6 * 60 * 60 * 1000 ? { ...data, stale: true } : data;
});
