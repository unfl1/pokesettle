import { test, expect } from '@playwright/test';

// Opt-in: run against an isolated FastAPI + PostgreSQL + installed Node worker.
// No API responses mocked, no model calls or external data collection.
test('실제 API·DB·Node 계산기와 UI의 조건부 KO 연결', async ({ page }) => {
  test.skip(process.env.POKETACT_LIVE_DAMAGE !== '1', '격리된 실제 백엔드 실행 필요');
  await page.route('https://**/*', (route) => route.abort());
  await page.request.post('/api/session');
  const member = (pokemonId: string) => ({ pokemonId, moves: [] });
  const own = await page.request.post('/api/teams', { data: {
    name: '통합 공격자', members: [member('pokemon:25')],
  } });
  const opponent = await page.request.post('/api/teams', { data: {
    name: '통합 방어자', members: [member('pokemon:9')],
  } });
  expect(own.ok()).toBeTruthy();
  expect(opponent.ok()).toBeTruthy();
  await page.goto('/');
  await page.getByRole('link', { name: '6:6 시나리오', exact: true }).click();
  await page.getByLabel('저장한 내 팀', { exact: true }).selectOption({ label: '통합 공격자' });
  await page.getByLabel('상대 팀 불러오기', { exact: true }).selectOption({ label: '통합 방어자' });
  const panel = page.getByRole('region', { name: '참조 데미지 계산', exact: true });
  await panel.getByLabel('공격자 포켓몬').selectOption('pokemon:25');
  await panel.getByLabel('계산 기술', { exact: true }).selectOption('thunderbolt');
  await panel.getByLabel('방어자 포켓몬').selectOption('pokemon:9');
  await panel.getByLabel('공격자 특수공격', { exact: true }).fill('32');
  await panel.getByRole('checkbox').check();
  const submit = panel.getByRole('button', { name: '참조 피해 계산', exact: true });
  await submit.click();
  await expect(panel.getByRole('heading', { name: '참조 피해 범위: 84–102 HP' })).toBeVisible();
  await expect(panel.getByText('기준 HP: 154 / 154 · 최대 HP 가정')).toBeVisible();
  for (const [hp, count] of [[84, 16], [85, 15], [103, 0]]) {
    await panel.getByLabel('방어자 남은 HP (실수치)', { exact: true }).fill(String(hp));
    await expect(panel.getByText('참조 피해 범위:', { exact: false })).toHaveCount(0);
    await submit.click();
    await expect(panel.getByText(`단일 타격 KO 조건 충족: ${count} / 16개 피해 후보`)).toBeVisible();
  }
  await panel.getByLabel('방어자 남은 HP (실수치)', { exact: true }).fill('155');
  await submit.click();
  await expect(panel.getByRole('alert')).toContainText('최대 HP를 초과');
  await expect(panel.getByText('참조 피해 범위:', { exact: false })).toHaveCount(0);
  await panel.getByLabel('방어자 남은 HP (실수치)', { exact: true }).fill('84');
  await submit.click();
  await expect(panel.getByText('단일 타격 KO 조건 충족: 16 / 16개 피해 후보')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
