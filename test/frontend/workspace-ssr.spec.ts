import { expect, test } from '@playwright/test';

const fixture = `http://127.0.0.1:${process.env.FIXTURE_API_PORT ?? '5198'}/__fixture`;
test.beforeEach(async ({ request }) => {
  await request.post(fixture, { data: { ready: true, workspaceSessions: {
    alice: {
      conversations: [{ conversationId: 'alice-chat', title: 'Alice SSR history', messageCount: 1, updatedAt: null }],
      messages: [{ messageId: 'alice-message', role: 'user', content: 'Alice SSR message', createdAt: '2026-11-10T00:00:00Z' }],
      teams: [{ teamId: 'alice-team', name: 'Alice SSR team', members: [] }],
    },
    bob: { conversations: [], messages: [], teams: [] },
  } } });
});
test.afterEach(async ({ request }) => { await request.post(fixture, { data: { ready: false } }); });

test('개인 대화·저장 팀을 JavaScript 없이 렌더링하고 세션별 격리', async ({ browser, baseURL }) => {
  for (const session of ['alice', 'bob', 'expired', null]) {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      if (session) await context.addCookies([{ name: 'pokecoach_session', value: session, url: baseURL! }]);
      const page = await context.newPage();
      const response = await page.goto(`${baseURL}/ko/chat`);
      expect(response!.headers()['cache-control']).toContain('no-store');
      if (session === 'alice') {
        await expect(page.locator('.chat-history-list')).toContainText('Alice SSR history');
        await expect(page.locator('.chat-feed')).toContainText('Alice SSR message');
      } else {
        await expect(page.locator('body')).not.toContainText('Alice SSR');
      }
      await page.goto(`${baseURL}/ko/scenario`);
      if (session === 'alice') await expect(page.locator('option').filter({ hasText: 'Alice SSR team' }).first()).toBeAttached();
      else await expect(page.locator('body')).not.toContainText('Alice SSR');
    } finally { await context.close(); }
  }
});

test('하이드레이션 직후 개인 데이터 중복 요청 없이 대화 선택 가능', async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: 'pokecoach_session', value: 'alice', url: baseURL! }]);
  const calls: string[] = [], errors: string[] = [];
  page.on('request', request => {
    if (/\/api\/(session|conversations|status)(?:[/?]|$)/.test(new URL(request.url()).pathname)) calls.push(request.url());
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/ko/chat');
  await expect(page.getByRole('button', { name: '새 채팅', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Alice SSR history', exact: true }).click();
  await expect(page.locator('.chat-feed')).toContainText('Alice SSR message');
  expect(calls).toEqual([]);
  expect(errors).toEqual([]);
});
