import 'server-only';
import { cache } from 'react';

export const serverRequest = cache(async <T,>(path: string): Promise<T | null> => {
  const origin = process.env.API_ORIGIN ?? 'http://127.0.0.1:8000';
  const response = await fetch(new URL(`/api${path}`, origin), {
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('공개 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
  return (await response.json()).data as T;
});
