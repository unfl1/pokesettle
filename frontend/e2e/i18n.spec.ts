import { test, expect } from '@playwright/test';

const languages = [
  { code: 'ko', html: 'ko', home: '배틀 준비는 PokeTact에서', pokedex: '도감', select: '언어', chat: '전략 챗봇' },
  { code: 'en', html: 'en', home: 'Prepare for battle with PokeTact', pokedex: 'Pokédex', select: 'Language', chat: 'Strategy assistant' },
  { code: 'ja', html: 'ja', home: 'バトルの準備はPokeTactで', pokedex: '図鑑', select: '言語', chat: '戦略チャットボット' },
  { code: 'zh', html: 'zh-Hans', home: '用 PokeTact 准备对战', pokedex: '图鉴', select: '语言', chat: '策略助手' },
];

test.beforeEach(async ({ page }) => {
  // Routing and UI localization must work independently of backend availability.
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: { error: { code: 'OFFLINE', message: 'Offline' } } }));
});

for (const language of languages) {
  test(`${language.code}: localized SSR, metadata, navigation, and chat`, async ({ page, request }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const response = await request.get(`/${language.code}`);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain(language.home);
    await page.goto(`/${language.code}`);
    await expect(page.locator('html')).toHaveAttribute('lang', language.html);
    await expect(page.getByRole('heading', { name: language.home })).toBeVisible();
    await expect(page.getByRole('combobox', { name: language.select })).toHaveValue(language.code);
    await page.getByRole('link', { name: new RegExp(language.pokedex) }).click();
    await expect(page).toHaveURL(`/${language.code}/pokedex`);
    await expect(page.getByRole('heading', { name: language.pokedex, exact: true })).toBeVisible();
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', `https://www.chikorita.xyz/${language.code}/pokedex`);
    for (const alternate of languages) {
      await expect(page.locator(`head link[rel="alternate"][hreflang="${alternate.html}"]`)).toHaveAttribute('href', `https://www.chikorita.xyz/${alternate.code}/pokedex`);
    }
    await expect(page.locator('head link[hreflang="x-default"]')).toHaveAttribute('href', 'https://www.chikorita.xyz/ko/pokedex');
    await expect(page.locator('head meta[property="og:url"]')).toHaveAttribute('content', `https://www.chikorita.xyz/${language.code}/pokedex`);
    await page.goto(`/${language.code}/chat`);
    await expect(page.getByRole('heading', { name: language.chat, exact: true })).toBeVisible();
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}

test('language switch retains the feature, query, and fragment', async ({ page }) => {
  await page.goto('/ko/pokedex?pokemon=pokemon%3A1#main-content');
  await page.getByRole('combobox', { name: '언어' }).selectOption('en');
  await expect(page).toHaveURL('/en/pokedex?pokemon=pokemon%3A1#main-content');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('ja');
  await expect(page).toHaveURL('/ja/pokedex?pokemon=pokemon%3A1#main-content');
  await expect(page.getByRole('link', { name: '図鑑', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('legacy URLs redirect once; unsupported locales and unknown paths return 404', async ({ request }) => {
  for (const path of ['/', '/chat', '/pokedex?pokemon=pokemon%3A25', '/meta', '/scenario']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    const destination = new URL(response.headers().location, response.url());
    expect(destination.pathname + destination.search).toBe(`/ko${path === '/' ? '' : path}`);
  }
  for (const path of ['/fr', '/fr/chat', '/ko/missing', '/constructor/chat', '/api-not-a-route']) {
    expect((await request.get(path)).status()).toBe(404);
  }
});

test('sitemap includes language variants and robots excludes API', async ({ request }) => {
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml.match(/<loc>/g)).toHaveLength(20);
  for (const language of languages) {
    expect(xml).toContain(`<loc>https://www.chikorita.xyz/${language.code}/scenario</loc>`);
    expect(xml).toContain(`hreflang="${language.html}"`);
  }
  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toContain('Disallow: /api/');
  expect(await robots.text()).toContain('Sitemap: https://www.chikorita.xyz/sitemap.xml');
});

test('root layout reserves the gutter when document overflow changes', async ({ page }) => {
  await page.goto('/en/pokedex');
  await expect(page.locator('html')).toHaveCSS('scrollbar-gutter', 'stable');
  const widths = await page.evaluate(() => {
    const root = document.documentElement;
    const initial = root.clientWidth;
    const spacer = document.createElement('div');
    spacer.style.height = '5000px';
    document.body.append(spacer);
    const long = root.clientWidth;
    root.style.overflowY = 'hidden';
    const hidden = root.clientWidth;
    spacer.remove();
    root.style.overflowY = '';
    return { initial, long, hidden };
  });
  expect(widths.long).toBe(widths.initial);
  expect(widths.hidden).toBe(widths.initial);
});

test('metadata remains in head across navigation on a slower browser', async ({ page, request }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  try {
    for (const language of languages) {
      const response = await request.get(`/${language.code}/pokedex`, {
        headers: { 'User-Agent': 'Mozilla/5.0 Chrome/142.0.0.0 Safari/537.36' },
      });
      const head = (await response.text()).split('</head>')[0];
      expect(head).toContain(`rel="canonical" href="https://www.chikorita.xyz/${language.code}/pokedex"`);
      await page.goto(`/${language.code}`);
      await page.getByRole('link', { name: new RegExp(language.pokedex) }).click();
      const canonical = page.locator('head link[rel="canonical"]');
      await expect(canonical).toHaveCount(1);
      await expect(canonical).toHaveAttribute('href', `https://www.chikorita.xyz/${language.code}/pokedex`);
      await page.getByRole('link', { name: /PokeTact/ }).click();
      await expect(canonical).toHaveAttribute('href', `https://www.chikorita.xyz/${language.code}`);
      await page.goBack();
      await expect(canonical).toHaveAttribute('href', `https://www.chikorita.xyz/${language.code}/pokedex`);
      await expect(page.locator('head meta[property="og:url"]')).toHaveAttribute('content', `https://www.chikorita.xyz/${language.code}/pokedex`);
    }
  } finally {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await cdp.detach();
  }
});
