import { expect, test } from '@playwright/test';

const meta = {
  season: 'M2', dataDate: '2026-10-24', collectedAt: '2026-10-25T00:00:00Z',
  providerGeneratedAt: null, stale: false,
  sourceUrl: 'https://championsbattledata.com', termsUrl: 'https://championsbattledata.com/api-rules/',
  attribution: 'Battle data provided by Pokémon Champions Battle Data',
  items: [
    { nameEn: 'Synthetic One', nameKo: '합성 포켓몬', pokemonId: 'pokemon:25', rank: 1,
      groups: [{ category: 'move', items: [{ name: 'Synthetic Move', nameKo: '합성 기술', rank: 1, percentage: 0 }] }] },
    { nameEn: 'Synthetic Form', nameKo: null, pokemonId: null, rank: 2,
      groups: [{ category: 'ability', items: [{ name: 'Synthetic Ability', nameKo: null, rank: 1, percentage: null }] }] },
  ],
};

test('싱글 메타 선택·출처·원문 대체·모바일 표시', async ({ page }) => {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const data = path === '/api/meta/singles' ? meta
      : path === '/api/status' ? { ready: false, missing: ['MODEL_KEY_MISSING'] }
      : path === '/api/session' ? { active: true } : { items: [] };
    return route.fulfill({ json: { data, warnings: [], requestId: 'synthetic' } });
  });
  await page.goto('/meta');
  await expect(page.getByRole('heading', { name: '싱글 메타 순위' })).toBeVisible();
  await expect(page.getByText('합성 기술')).toBeVisible();
  await expect(page.getByText('0%', { exact: true })).toBeVisible();
  await expect(page.getByText(/데이터 기준일 2026-10-24/)).toBeVisible();
  await expect(page.getByRole('link', { name: meta.attribution })).toHaveAttribute('href', meta.sourceUrl);
  await expect(page.getByRole('link', { name: '도감 보기' })).toHaveAttribute('href', '/pokedex?pokemon=pokemon%3A25');
  await page.getByRole('button', { name: /Synthetic Form/ }).click();
  await expect(page.getByText('Synthetic Ability')).toBeVisible();
  await expect(page.getByText('미제공', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '도감 보기' })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/poketact-meta-mobile.png', fullPage: true });
});

test('외부 장애 안내 후 재시도·만료 캐시 안내', async ({ page }) => {
  let failed = true;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/meta/singles') {
      if (failed) return route.fulfill({ status: 503, json: { error: { code: 'META_UNAVAILABLE', message: '합성 외부 장애', retryable: true } } });
      return route.fulfill({ json: { data: { ...meta, stale: true } } });
    }
    return route.fulfill({ json: { data: path === '/api/status' ? { ready: true } : { active: true, items: [] } } });
  });
  await page.goto('/meta');
  await expect(page.getByRole('alert')).toContainText('합성 외부 장애');
  failed = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByText(/임시 보관한 데이터를/)).toBeVisible();
  await expect(page.getByText('합성 기술')).toBeVisible();
});
