import { expect, test } from '@playwright/test';

const fixture = `http://127.0.0.1:${process.env.FIXTURE_API_PORT ?? '5198'}/__fixture`;
test.beforeEach(async ({ request }) => { await request.post(fixture, { data: { ready: true } }); });
test.afterEach(async ({ request }) => { await request.post(fixture, { data: { ready: false } }); });

test('메타 본문·출처·선택과 공통 헤더는 JavaScript 없이 동작', async ({ browser, request, baseURL }) => {
  await request.post(fixture, { data: { ready: true, metaData: {
    items: [
      { nameEn: 'First Fixture', nameKo: '첫 번째 예시', pokemonId: null, rank: 1, images: null, groups: [] },
      { nameEn: 'Second Fixture', nameKo: '두 번째 예시', pokemonId: null, rank: 2, images: null, groups: [{ category: 'move', items: [{ name: 'Selected SSR Move', nameKo: null, rank: 1, percentage: 12 }] }] },
    ],
    season: 'SSR', dataDate: '2026-11-03', collectedAt: new Date().toISOString(), stale: false,
    sourceUrl: 'https://example.com/source', termsUrl: 'https://example.com/terms', attribution: 'SSR source', nameSources: [],
  } } });
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/ko/meta`);
    await expect(page.getByRole('navigation', { name: '주 메뉴' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'SSR source' })).toBeVisible();
    await page.getByRole('button', { name: /두 번째 예시/ }).click();
    await expect(page).toHaveURL(/pokemon=Second(?:\+|%20)Fixture/);
    await expect(page.getByRole('region', { name: '주요 세팅' })).toContainText('Selected SSR Move');
    await expect(page.getByRole('button', { name: /두 번째 예시/ })).toHaveAttribute('aria-pressed', 'true');
    await page.goto(`${baseURL}/ko/pobti`);
    await expect(page.getByRole('navigation', { name: '주 메뉴' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: '언어' })).toHaveValue('ko');
  } finally { await context.close(); }
});

for (const locale of ['ko', 'en', 'ja', 'zh']) {
  test(`${locale}: 날짜 형식·저장소·지연 스크립트 차이에도 초기 DOM 유지`, async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const errors: string[] = [], metaRequests: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && /hydration|hydrated|server rendered|#418|#425/i.test(message.text())) errors.push(message.text()); });
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/meta/singles') metaRequests.push(request.url()); });
    await page.addInitScript(() => {
      // ICU/browser date formatting must not change server-owned date text.
      Date.prototype.toLocaleString = () => 'BROWSER_DATE_FORMAT_DIFFERS';
      localStorage.setItem('pokesettle:kanto-collection:v1', '[1,25]');
      localStorage.setItem('pokesettle:kanto-next-catch-at:v1', String(Date.now() + 60000));
    });
    let release!: () => void;
    const scripts = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/_next/static/**/*.js', async route => { await scripts; await route.continue(); });
    await page.goto(`/${locale}/meta`, { waitUntil: 'commit' });
    const footer = await page.locator('.site-footer').elementHandle();
    const heading = await page.getByRole('region').filter({ has: page.locator('h2') }).first().locator('h2').elementHandle();
    const originalText = await heading!.textContent();
    release();
    // Releasing requests does not attach React's event handlers immediately.
    // The seeded count appears only after the header's collection effect runs.
    await expect(page.locator('.site-header button').filter({ hasText: /^2$/ })).toBeVisible();
    await page.locator('.help-button').click();
    await expect(page.locator('.help-notice')).toBeVisible();
    expect(await footer!.evaluate(node => node.isConnected)).toBe(true);
    expect(await heading!.evaluate(node => node.isConnected)).toBe(true);
    expect(await heading!.textContent()).toBe(originalText);
    await expect(page.locator('.metagame-page')).not.toContainText('BROWSER_DATE_FORMAT_DIFFERS');
    expect(metaRequests).toEqual([]);
    expect(errors).toEqual([]);
    await cdp.detach();
  });
}
