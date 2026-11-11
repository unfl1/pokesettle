import { expect, test } from '@playwright/test';

const meta = {
  season: 'M2', dataDate: '2026-10-24', collectedAt: new Date().toISOString(),
  providerGeneratedAt: null, stale: false,
  sourceUrl: 'https://championsbattledata.com', termsUrl: 'https://championsbattledata.com/api-rules/',
  attribution: 'Battle data provided by Pokémon Champions Battle Data',
  nameSources: [{ url: 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/item_names.csv', collectedAt: new Date().toISOString(), contentHash: 'synthetic' }],
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

const fixture = `http://127.0.0.1:${process.env.FIXTURE_API_PORT ?? '5198'}/__fixture`;
test.beforeEach(async ({ request }) => { await request.post(fixture, { data: { ready: true, metaData: meta } }); });
test.afterEach(async ({ request }) => { await request.post(fixture, { data: { ready: false } }); });

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
  await page.goto('/ko/meta');
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
  const notes = page.getByRole('complementary', { name: '출처 및 이용 안내' });
  await expect(notes.getByRole('link', { name: meta.attribution })).toBeVisible();
  const settingsBox = await page.getByRole('region', { name: '주요 세팅' }).boundingBox();
  const notesBox = await notes.boundingBox();
  expect(notesBox!.y).toBeGreaterThanOrEqual(settingsBox!.y + settingsBox!.height);
  await expect(page.getByRole('link', { name: '도감 보기' })).toHaveAttribute('href', '/ko/pokedex/synthetic-one');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.screenshot({ path: '/tmp/poketact-meta-localized.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('link', { name: /Synthetic Form/ }).click();
  await expect(page).toHaveURL(/pokemon=Synthetic(?:\+|%20)Form/);
  await expect(page.getByText('Synthetic Ability')).toBeVisible();
  await expect(page.getByText('미제공', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '도감 보기' })).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Synthetic Form 이미지 없음' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/poketact-meta-mobile.png', fullPage: true });
  await page.goBack();
  await expect(page.getByText('합성 기술')).toBeVisible();
  await page.goForward();
  await expect(page.getByText('Synthetic Ability')).toBeVisible();
});

test('외부 장애 안내 후 재시도·만료 캐시 안내', async ({ page, request }) => {
  await page.route('**/_next/image?**', route => route.abort());
  await request.post(fixture, { data: { ready: false } });
  await page.goto('/ko/meta');
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText('싱글 메타를 불러오지 못했어요.');
  await request.post(fixture, { data: { ready: true, metaData: { ...meta, stale: true } } });
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByText(/임시 보관한 데이터를/)).toBeVisible();
  await expect(page.getByText('합성 기술')).toBeVisible();
  await expect(page.getByRole('img', { name: '합성 포켓몬 이미지 없음' })).toBeVisible();
});

test('메타 응답을 기다리는 동안 외부 조회 안내와 로딩 영역 표시', async ({ page, request }) => {
  await page.goto('/ko/pobti');
  await request.post(fixture, { data: { ready: true, metaData: meta, delayMs: 1500 } });
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '메타 순위' }).click();
  await expect(page.getByText('최초 조회나 갱신 시 외부 자료를 확인하므로 잠시 걸릴 수 있어요.')).toBeVisible();
  await expect(page.getByRole('region', { name: '싱글 사용 순위' })).toHaveCount(0);
  await expect(page.getByText('합성 기술')).toBeVisible();
  await expect(page.getByText('최초 조회나 갱신 시 외부 자료를 확인하므로 잠시 걸릴 수 있어요.')).toHaveCount(0);
});


const localizedPokemon = {
  ...meta.items[0], pokemonId: 'pokemon:25', nameEn: 'Pikachu', nameKo: '피카츄',
  names: { ko: '피카츄', en: 'Pikachu', ja: 'ピカチュウ', zh: '皮卡丘' },
  slugs: { ko: '피카츄', en: 'pikachu', ja: 'ピカチュウ', zh: '皮卡丘' },
};

test('메타 상세 URL·기존 쿼리·언어 전환과 직접 접속', async ({ page, request }) => {
  await request.post(fixture, { data: { ready: true, metaData: { ...meta, items: [localizedPokemon] } } });
  await page.goto('/ko/meta');
  const ranking = page.getByRole('region', { name: '싱글 사용 순위' });
  await expect(ranking.getByRole('link')).toHaveAttribute('href', '/ko/meta/' + 'pikachu');
  await ranking.getByRole('link').click();
  await expect(page).toHaveURL(new RegExp('/ko/meta/' + 'pikachu'));
  await expect(page.getByRole('region', { name: '주요 세팅' })).toContainText('피카츄');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://pokesettle.com/ko/meta/' + 'pikachu');
  for (const [locale, path, name] of [
    ['en', '/meta/pikachu', 'Pikachu'],
    ['ja', '/ja/meta/' + 'pikachu', 'ピカチュウ'],
    ['zh', '/zh/meta/' + 'pikachu', '皮卡丘'],
    ['ko', '/ko/meta/' + 'pikachu', '피카츄'],
  ]) {
    await page.getByRole('combobox', { name: /언어|Language|言語|语言/ }).selectOption(locale);
    await expect.poll(() => new URL(page.url()).pathname).toBe(path);
    await expect(page.getByRole('heading', { name: new RegExp(name) })).toBeVisible();
  }
  await page.reload();
  await expect(page.getByText('합성 기술')).toBeVisible();
  await page.goto('/ko/meta?pokemon=Pikachu');
  await expect.poll(() => new URL(page.url()).pathname).toBe('/ko/meta/' + 'pikachu');
  expect(new URL(page.url()).search).toBe('');
  await page.goto('/ko/meta/wrong-name-25');
  await expect.poll(() => new URL(page.url()).pathname).toBe('/ko/meta/' + 'pikachu');
});

test('메타 상세의 잘못된 ID와 순위에 없는 포켓몬은 404', async ({ request }) => {
  await request.post(fixture, { data: { ready: true, metaData: { ...meta, items: [localizedPokemon] } } });
  for (const path of ['/ko/meta/invalid', '/ko/meta/unknown-999999', '/ko/meta/bulbasaur-1']) {
    const response = await request.get(path);
    // Streaming notFound can use HTTP 200 with an explicit noindex directive.
    expect(response.status() === 404 || (await response.text()).includes('name="robots" content="noindex"')).toBe(true);
  }
});

test('메타 상세 선택은 JavaScript 없이도 링크로 동작', async ({ browser, request, baseURL }) => {
  await request.post(fixture, { data: { ready: true, metaData: { ...meta, items: [localizedPokemon] } } });
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/ko/meta`);
    await page.getByRole('region', { name: '싱글 사용 순위' }).getByRole('link').click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/ko/meta/' + 'pikachu');
    await expect(page.getByText('합성 기술')).toBeVisible();
  } finally { await context.close(); }
});
