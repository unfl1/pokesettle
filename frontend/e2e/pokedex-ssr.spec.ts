import { test, expect } from '@playwright/test';
const fixture = `http://127.0.0.1:${process.env.FIXTURE_API_PORT ?? '5198'}/__fixture`;
const ko = '/ko/pokedex/%ED%94%BC%EC%B9%B4%EC%B8%84-%EC%98%A4%EB%A6%AC%EC%A7%80%EB%84%90%EC%BA%A1-10094';
test.beforeEach(async ({ request }) => { await request.post(fixture, { data: { ready: true } }); });
test.afterEach(async ({ request }) => { await request.post(fixture, { data: { ready: false } }); });

test('기존 URL과 잘못된 이름은 308, 없는 ID는 실제 404', async ({ request }) => {
  const legacy = await request.get('/ko/pokedex?pokemon=pokemon%3A10094&tag=a&tag=b&empty=', { maxRedirects: 0 });
  expect(legacy.status()).toBe(308);
  const url = new URL(legacy.headers().location, legacy.url());
  expect(decodeURIComponent(url.pathname)).toBe('/ko/pokedex/피카츄-오리지널캡-10094');
  expect(url.search).toBe('?tag=a&tag=b&empty=');
  const renamed = await request.get('/ko/pokedex/old-name-10094?check=1', { maxRedirects: 0 });
  expect(renamed.status()).toBe(308);
  expect(decodeURIComponent(new URL(renamed.headers().location, renamed.url()).pathname)).toBe('/ko/pokedex/피카츄-오리지널캡-10094');
  for (const path of ['/ko/pokedex/missing-999999999', '/ko/pokedex?pokemon=pokemon%3A999999', '/ko/pokedex?pokemon=pokemon%3A25&pokemon=pokemon%3A1', '/fr/pokedex/example-25']) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});

test('JavaScript 없이 상세 본문·스탯·출처와 실제 목록 링크 확인', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const response = await page.goto(`${test.info().project.use.baseURL}${ko}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: '피카츄 (오리지널캡)', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: '종족값' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'PokéAPI 메타데이터 원문' })).toHaveAttribute('href', 'https://pokeapi.co/api/v2/pokemon/10094/');
  await expect(page.getByRole('link', { name: '이상해씨 선택' })).toHaveAttribute('href', /-1$/);
  await page.screenshot({ path: '/tmp/pokesettle-pokedex-ssr-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/pokesettle-pokedex-ssr-mobile.png', fullPage: true });
  await context.close();
});

test('상세 metadata와 언어 전환은 동일 ID의 현지화 URL 유지', async ({ page }) => {
  await page.goto(ko + '?check=1#main-content');
  await expect(page).toHaveTitle('피카츄 (오리지널캡) | 도감 | PokeSettle');
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', 'https://www.pokesettle.com' + ko);
  await page.getByRole('combobox', { name: '언어' }).selectOption('en');
  await expect(page).toHaveURL('/en/pokedex/pikachu-original-cap-10094?check=1#main-content');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Original Cap Pikachu');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('ja');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ピカチュウ (オリジナルキャップ)');
  await expect(page.getByRole('link', { name: '図鑑', exact: true })).toHaveAttribute('aria-current', 'page');
  expect(decodeURIComponent(new URL(page.url()).pathname)).toBe('/ja/pokedex/ピカチュウ-オリジナルキャップ-10094');
  await page.getByRole('combobox', { name: '言語' }).selectOption('zh');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('皮卡丘 (初始帽子)');
  await expect(page.locator('head link[hreflang="zh-Hans"]')).toHaveAttribute('href', /\/zh\/pokedex\/.*-10094$/);
});

test('공개 페이지는 채팅 세션·상태·대화를 조회하지 않고 메타도 SSR', async ({ page, request }) => {
  const calls: string[] = [];
  page.on('request', req => { if (new URL(req.url()).pathname.startsWith('/api/')) calls.push(new URL(req.url()).pathname); });
  for (const path of ['/ko', '/ko/pokedex', ko, '/ko/meta']) {
    await page.goto(path);
    await expect(page.locator('body')).toBeVisible();
  }
  expect(calls).toEqual([]);
  const response = await request.get('/ko/meta');
  // Assert visible HTML separately from the RSC script payload.
  expect(await response.text()).toContain('Synthetic SSR fixture');
  await expect(page.getByRole('region', { name: '싱글 사용 순위' })).toContainText('피카츄');
});

test('서버 API 실패를 포켓몬 없음으로 표시하지 않음', async ({ request, page }) => {
  await request.post(fixture, { data: { ready: true, failedIds: ['pokemon:10094'] } });
  await page.goto(ko);
  await expect(page.locator('section[role=alert]')).toContainText('포켓몬 정보를 불러오지 못했어요.');
  await expect(page.getByRole('heading', { name: '포켓몬을 찾을 수 없습니다.' })).toHaveCount(0);
});

test('favicon은 16·32·48px 실제 ICO이며 상세 sitemap URL 중복 없음', async ({ request }) => {
  const favicon = await request.get('/favicon.ico');
  expect(favicon.status()).toBe(200);
  const bytes = await favicon.body();
  expect([...bytes.subarray(0, 6)]).toEqual([0, 0, 1, 0, 3, 0]);
  const xml = await (await request.get('/sitemap.xml')).text();
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
  expect(urls).toHaveLength(5424);
  expect(new Set(urls).size).toBe(urls.length);
  expect(xml.length).toBeLessThan(50 * 1024 * 1024);
});
