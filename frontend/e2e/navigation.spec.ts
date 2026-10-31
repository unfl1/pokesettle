import { test, expect } from '@playwright/test';

const fixture = `http://127.0.0.1:${process.env.FIXTURE_API_PORT ?? '5198'}/__fixture`;

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: { error: { message: 'Fixture client API unavailable' } } }));
});
test.afterEach(async ({ request }) => { await request.post(fixture, { data: { ready: false } }); });

test('홈과 기능 메뉴는 문서 재요청 없이 전환', async ({ page }) => {
  await page.goto('/ko');
  const documents: string[] = [];
  page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url()); });
  await page.getByRole('navigation', { name: '시작할 메뉴 선택' }).getByRole('link', { name: /포BTI/ }).click();
  await expect(page.getByRole('button', { name: '내 포켓몬 찾기' })).toBeVisible();
  expect(documents).toEqual([]);
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '6:6 시나리오' }).click();
  await expect(page).toHaveURL('/ko/scenario');
  expect(documents).toEqual([]);
  await page.getByRole('link', { name: 'PokeSettle 홈', exact: true }).click();
  await expect(page.getByRole('navigation', { name: '시작할 메뉴 선택' })).toBeVisible();
  expect(documents).toEqual([]);
});

test('느린 공개 조회 중에도 로딩 안내와 메뉴를 표시하고 다른 메뉴로 이동 가능', async ({ page, request }) => {
  await request.post(fixture, { data: { ready: true, delayMs: 1500 } });
  await page.goto('/ko/pobti');
  const nav = page.getByRole('navigation', { name: '주 메뉴' });
  await nav.getByRole('link', { name: '도감', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '화면을 불러오는 중…' }).first()).toBeVisible();
  await expect(page.locator('.route-loading')).toBeVisible();
  await expect(nav).toBeVisible();
  await nav.getByRole('link', { name: '포BTI', exact: true }).click();
  await expect(page.getByRole('button', { name: '내 포켓몬 찾기' })).toBeVisible();
  await expect(page).toHaveURL('/ko/pobti');
});

test('경로 응답 대기 중 클릭한 링크에 표시 후 완료 시 해제', async ({ page }) => {
  await page.route('**/ko/meta?*', async route => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    await route.continue();
  });
  await page.goto('/ko/pobti');
  const link = page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '메타 순위' });
  await link.click();
  await expect(link.locator('[data-pending]')).toBeVisible();
  await expect(page.getByRole('heading', { name: '싱글 메타 순위', exact: true })).toBeVisible();
  await expect(link.locator('[data-pending]')).toHaveCount(0);
});

test('런타임 통계 설정은 별도 no-store 응답으로 조회', async ({ request }) => {
  const response = await request.get('/analytics/config');
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-store');
  const { gaId } = await response.json();
  expect(gaId === null || /^G-[A-Z0-9]+$/.test(gaId)).toBe(true);
});

test('문서 직접 접속은 완성 HTML, RSC 이동은 스트리밍 로딩 경계 제공', async ({ request }) => {
  await request.post(fixture, { data: { ready: true } });
  const html = await request.get('/ko/pokedex', { headers: { 'Sec-Fetch-Dest': 'document' } });
  expect(await html.text()).not.toContain('class="route-loading"');
  const flight = await request.get('/ko/pokedex', { headers: { RSC: '1', 'Sec-Fetch-Dest': 'empty' } });
  expect(flight.headers()['content-type']).toContain('text/x-component');
  expect(await flight.text()).toContain('route-loading');
});

test('SSR 메타 캐시의 6시간 임시 표시와 24시간 만료 유지', async ({ request }) => {
  await request.post(fixture, { data: { ready: true, metaAgeHours: 7 } });
  const stale = await request.get('/ko/meta');
  expect(await stale.text()).toContain('최신 자료에 연결하지 못해 임시 보관한 데이터를 표시하고 있어요.');
  await request.post(fixture, { data: { ready: true, metaAgeHours: 25 } });
  const expired = await request.get('/ko/meta');
  expect(await expired.text()).not.toContain('Synthetic SSR fixture');
});

test('문서 이동 초안 복원은 초기 링크 DOM과 질문을 유지', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('poketact-navigation-draft', JSON.stringify({
      savedAt: Date.now(), draft: '복원한 질문', team: {
        own: [], opponent: [], name: '복원한 팀', selectedId: '', notice: '', tab: 'team',
        ownActive: 0, opponentActive: 0, attackTypes: [], megaUsed: 'unknown', megaTargetId: '', switchBlocked: 'unknown',
      },
    }));
  });
  let release!: () => void;
  const scriptsReady = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/_next/static/**/*.js', async route => { await scriptsReady; await route.continue(); });
  await page.goto('/ko', { waitUntil: 'commit' });
  const link = await page.getByRole('link', { name: /챗봇/ }).elementHandle();
  release();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('poketact-navigation-draft'))).toBeNull();
  expect(await link!.evaluate(node => node.isConnected)).toBe(true);
  await page.getByRole('link', { name: /챗봇/ }).click();
  await expect(page.getByLabel('포켓몬 질문')).toHaveValue('복원한 질문');
});
