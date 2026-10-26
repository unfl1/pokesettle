import { expect, test } from '@playwright/test';

const meta = {
  season: 'M2', dataDate: '2026-10-24', collectedAt: '2026-10-25T00:00:00Z',
  providerGeneratedAt: null, stale: false,
  sourceUrl: 'https://championsbattledata.com', termsUrl: 'https://championsbattledata.com/api-rules/',
  attribution: 'Battle data provided by Pokémon Champions Battle Data',
  nameSources: [{ url: 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/item_names.csv', collectedAt: '2026-10-25T00:00:00Z', contentHash: 'synthetic' }],
  nameLicenceUrl: 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/LICENSE.md',
  items: [
    { nameEn: 'Synthetic One', nameKo: '합성 포켓몬', pokemonId: 'pokemon:25', rank: 1,
      images: { spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png', sourceUrl: 'https://github.com/PokeAPI/sprites', rightsNotice: 'Pokémon © Nintendo', artworkUrl: null, checkedAt: '2026-10-25', availability: 'checked_on_display' },
      groups: [
        { category: 'move', items: [{ name: 'Synthetic Move', nameKo: '합성 기술', rank: 1, percentage: 0 }] },
        { category: 'held_item', items: [{ name: 'Choice Scarf', nameKo: '구애스카프', rank: 1, percentage: 20 }] },
        { category: 'stat_alignment', items: [{ name: 'Jolly', nameKo: '명랑', rank: 1, percentage: 40 }] },
      ] },
    { nameEn: 'Synthetic Form', nameKo: null, pokemonId: null, rank: 2,
      images: null,
      groups: [{ category: 'ability', items: [{ name: 'Synthetic Ability', nameKo: null, rank: 1, percentage: null }] }] },
  ],
};

test('싱글 메타 선택·출처·원문 대체·모바일 표시', async ({ page }) => {
  await page.route('**/_next/image?**', route => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><circle cx="48" cy="48" r="32" fill="#f8cf36"/></svg>',
  }));
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
  await expect(page.getByText('구애스카프', { exact: true })).toBeVisible();
  await expect(page.getByText('명랑', { exact: true })).toBeVisible();
  const image = page.getByRole('img', { name: '합성 포켓몬 이미지', exact: true });
  await expect(image).toBeVisible();
  await expect(image).toHaveJSProperty('complete', true);
  expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  await expect(image).toHaveAttribute('srcset', /\/_next\/image\?/);
  await expect(page.getByRole('region', { name: '싱글 사용 순위' }).locator('img')).toHaveCount(1);
  await expect(page.getByText('0%', { exact: true })).toBeVisible();
  await expect(page.getByText(/데이터 기준일 2026-10-24/)).toBeVisible();
  await expect(page.getByRole('link', { name: meta.attribution })).toHaveAttribute('href', meta.sourceUrl);
  await expect(page.getByRole('link', { name: '도감 보기' })).toHaveAttribute('href', '/pokedex?pokemon=pokemon%3A25');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.screenshot({ path: '/tmp/poketact-meta-localized.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: /Synthetic Form/ }).click();
  await expect(page.getByText('Synthetic Ability')).toBeVisible();
  await expect(page.getByText('미제공', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '도감 보기' })).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Synthetic Form 이미지 없음' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/poketact-meta-mobile.png', fullPage: true });
});

test('외부 장애 안내 후 재시도·만료 캐시 안내', async ({ page }) => {
  await page.route('**/_next/image?**', route => route.abort());
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
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText('합성 외부 장애');
  failed = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByText(/임시 보관한 데이터를/)).toBeVisible();
  await expect(page.getByText('합성 기술')).toBeVisible();
  await expect(page.getByRole('img', { name: '합성 포켓몬 이미지 없음' })).toBeVisible();
});
