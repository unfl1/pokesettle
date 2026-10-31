import 'server-only';
import { cache } from 'react';
import { connection } from 'next/server';

export const serverRequest = cache(async <T,>(path: string): Promise<T | null> => {
  // Resolve the runtime API origin without contacting production during builds.
  // Only public catalogue and metagame GETs may enter the shared data cache.
  await connection();
  const origin = process.env.API_ORIGIN ?? 'http://127.0.0.1:8000';
  const publicPath = path === '/meta/singles' || path === '/pokemon?limit=100&offset=0' || /^\/pokemon\/pokemon%3A\d+$/i.test(path);
  const cacheSeconds = process.env.PUBLIC_DATA_CACHE_SECONDS === '0' ? 0 : 60;
  const response = await fetch(new URL(`/api${path}`, origin), {
    ...(publicPath && cacheSeconds ? { next: { revalidate: cacheSeconds } } : { cache: 'no-store' as const }),
    signal: AbortSignal.timeout(8000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('공개 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
  return (await response.json()).data as T;
});
