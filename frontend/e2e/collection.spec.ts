import { test, expect, type Page } from '@playwright/test';
import { catchCooldownMs, collectionKey, cooldownKey, parseCollection, parseNextCatchAt, pickUncaught } from '../src/features/collection/storage';

const dex = (page: Page) => page.getByRole('button', { name: '나의 관동 도감', exact: true })
  .and(page.getByTitle('나의 관동 도감', { exact: true }));
const ball = (page: Page) => page.getByRole('button', { name: '몬스터볼 열기', exact: true });
const portrait = (page: Page) => page.locator('[class*="portrait"]');
const readCaught = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '[]') as number[], collectionKey);

async function fixedViewport(page: Page) {
  return page.evaluate(() => {
    // A stable root gutter may be reserved even when clientWidth includes it.
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none';
    document.body.append(probe);
    const { x, y, width, height } = probe.getBoundingClientRect();
    probe.remove();
    return { x, y, width, height };
  });
}

async function revealBall(page: Page) {
  await expect(dex(page)).toBeEnabled();
  await page.keyboard.press('Shift');
  await page.clock.runFor(16_000);
  await expect(ball(page)).toBeVisible();
}

async function advanceCooldown(page: Page) {
  const remaining = await page.evaluate(key => Number(localStorage.getItem(key) ?? 0) - Date.now(), cooldownKey);
  await page.clock.fastForward(Math.max(0, remaining) + 1);
}

test.beforeEach(async ({ context, page }) => {
  await page.clock.install();
  await context.route('**/_next/image?**', route => route.fulfill({ contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="25" fill="#9acbb5"/></svg>' }));
});

test('수집 데이터는 1세대 정수만 허용하며 중복과 범위 밖 ID 제외', () => {
  expect(parseCollection('[151,1,1,0,152,10025,"25",2.5,null]')).toEqual([1, 151]);
  expect(parseCollection(null)).toEqual([]);
  expect(() => parseCollection('{')).toThrow();
  expect(() => parseCollection('{}')).toThrow();
  const all = Array.from({ length: 151 }, (_, index) => index + 1);
  expect(pickUncaught(all)).toBeNull();
  expect(pickUncaught(all.filter(id => id !== 25))).toBe(25);
  expect(catchCooldownMs).toBe(600_000);
  for (const raw of [null, 'bad', '-1', 'Infinity', '1.5']) expect(parseNextCatchAt(raw)).toBe(0);
  expect(parseNextCatchAt('1800000000000')).toBe(1800000000000);
});

test('루트와 모든 언어의 홈에서 포획 볼·수집 버튼 미표시, 메뉴 5개 유지', async ({ page }) => {
  for (const path of ['/', '/ko', '/en', '/ja', '/zh']) {
    await page.goto(path);
    await expect(page.locator('.home-menus a')).toHaveCount(5);
    await expect(page.locator('dialog')).toHaveCount(0);
    await expect(ball(page)).toHaveCount(0);
    await expect(dex(page)).toHaveCount(0);
  }
});

test('사용 전에는 숨기고 사용 중 무작위 대기 후 중앙에 서서히 등장', async ({ page }) => {
  await page.goto('/ko/pobti');
  await expect(dex(page)).toBeEnabled();
  await page.clock.runFor(30_000);
  await expect(ball(page)).toHaveCount(0);
  await page.getByRole('button', { name: '내 포켓몬 찾기', exact: true }).click();
  await page.clock.runFor(7000);
  await expect(ball(page)).toHaveCount(0);
  await page.clock.runFor(8100);
  await expect(ball(page)).toBeVisible();
  expect(await ball(page).evaluate(el => getComputedStyle(el).animationDuration)).toBe('1.8s');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const box = await ball(page).boundingBox();
    const viewport = await fixedViewport(page);
    expect(box!.x + box!.width / 2).toBeCloseTo(viewport.x + viewport.width / 2, 0);
    expect(await ball(page).evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    expect(await ball(page).getAttribute('title')).toBeNull();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: '/tmp/pokesettle-surprise-ball-mobile.png', animations: 'disabled' });
});

test('숨겨진 탭에서는 등장 대기를 멈추고 화면 복귀 후 남은 시간만 계산', async ({ page }) => {
  await page.goto('/ko/pobti');
  await expect(dex(page)).toBeEnabled();
  await page.keyboard.press('Shift');
  await page.clock.runFor(5000);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(60_000);
  await expect(ball(page)).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(2000);
  await expect(ball(page)).toHaveCount(0);
  await page.clock.runFor(8100);
  await expect(ball(page)).toBeVisible();
});

test('수집 아이콘은 언어 선택 왼쪽, 151칸 도감과 모바일 넘침·Escape·포커스 확인', async ({ page }) => {
  await page.goto('/ko/pobti');
  for (const width of [1440, 780, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const icon = await dex(page).boundingBox();
    const language = await page.getByRole('combobox', { name: '언어', exact: true }).boundingBox();
    expect(icon!.x + icon!.width).toBeLessThanOrEqual(language!.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await dex(page).click();
  const dialog = page.getByRole('dialog', { name: '나의 관동 도감', exact: true });
  await expect(dialog.getByRole('listitem')).toHaveCount(151);
  await expect(dialog.getByText('미발견', { exact: true })).toHaveCount(151);
  await expect(dialog.getByRole('progressbar')).toHaveAttribute('value', '0');
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/pokesettle-collection-mobile.png' });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(dex(page)).toBeFocused();
});

test('포획·상단 이동 후 10분 제한, 새로고침 유지 및 같은 화면에서 다시 수집', async ({ page }) => {
  await page.goto('/ko/pobti');
  await revealBall(page);
  await expect(page.locator('[class*="captureBackdrop"]')).toHaveCount(0);
  await ball(page).click();
  await expect(ball(page)).toBeDisabled();
  await expect(page.locator('[class*="captureBackdrop"]')).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(await ball(page).locator('svg').evaluate(el => getComputedStyle(el).animationIterationCount)).toBe('3');
  await page.screenshot({ path: '/tmp/pokesettle-centered-capture.png', animations: 'disabled' });
  const centered = await ball(page).boundingBox();
  const viewport = await fixedViewport(page);
  expect(centered!.x + centered!.width / 2).toBeCloseTo(viewport.x + viewport.width / 2, 0);
  expect(centered!.y + centered!.height / 2).toBeCloseTo(viewport.y + viewport.height / 2, 0);
  expect(centered!.width).toBeGreaterThan(150);
  await page.clock.runFor(3850);
  await expect(page.getByRole('status')).toContainText('넌 내 거야!');
  const first = await readCaught(page);
  expect(first).toHaveLength(1);
  await page.clock.runFor(400);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(portrait(page)).toHaveCount(1);
  await expect(page.locator('[class*="captureBackdrop"]')).toBeVisible();
  await page.screenshot({ path: '/tmp/pokesettle-collection-caught.png', animations: 'disabled' });
  await page.clock.runFor(1200);
  await expect(portrait(page)).toHaveCount(0);
  await expect(page.locator('[class*="flyer"]')).toBeVisible();
  await expect(page.locator('[class*="captureBackdrop"]')).toHaveClass(/backdropLeaving/);
  const target = await dex(page).boundingBox();
  const landing = await page.locator('[class*="flyer"]').evaluate(el => {
    const style = (el as HTMLElement).style;
    const computed = getComputedStyle(el);
    return { x: parseFloat(style.left) + parseFloat(computed.width) / 2 + parseFloat(style.getPropertyValue('--flight-x')),
      y: parseFloat(style.top) + parseFloat(computed.height) / 2 + parseFloat(style.getPropertyValue('--flight-y')) };
  });
  expect(landing.x).toBeCloseTo(target!.x + target!.width / 2, 0);
  expect(landing.y).toBeCloseTo(target!.y + target!.height / 2, 0);
  await page.clock.runFor(800);
  await expect(page.locator('[class*="flyer"]')).toHaveCount(0);
  await expect(page.locator('[class*="captureBackdrop"]')).toHaveCount(0);
  await expect(dex(page)).toBeFocused();
  await dex(page).click();
  await expect(page.getByRole('dialog', { name: '나의 관동 도감', exact: true }).getByRole('progressbar')).toHaveAttribute('value', '1');
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: '6:6 시나리오', exact: true }).click();
  await expect(page).toHaveURL('/ko/scenario');
  await expect(ball(page)).toHaveCount(0);
  await page.reload();
  await page.keyboard.press('Shift');
  await page.clock.runFor(16_000);
  await expect(ball(page)).toHaveCount(0);
  await advanceCooldown(page);
  await revealBall(page);
  await ball(page).click();
  await page.clock.runFor(3850);
  const second = await readCaught(page);
  expect(second).toHaveLength(2);
  expect(second).toContain(first[0]);
  expect(new Set(second).size).toBe(2);
});

test('새로고침 없이 10분이 지나면 다시 등장하고 추가 수집', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/ko/pobti');
  await revealBall(page);
  await ball(page).click();
  await expect(page.getByRole('status')).toContainText('넌 내 거야!');
  await page.clock.runFor(2000);
  await expect(ball(page)).toHaveCount(0);
  await advanceCooldown(page);
  await expect(page.getByRole('status')).toBeEmpty();
  await revealBall(page);
  await ball(page).click();
  await expect(dex(page)).toHaveText('2');
  expect(await readCaught(page)).toHaveLength(2);
});

test('150마리 수집 후 남은 뮤만 등장하고 151마리 완성 후 추가 포획 없음', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, JSON.stringify(Array.from({ length: 150 }, (_, i) => i + 1))), collectionKey);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/ko/pobti');
  await revealBall(page);
  await ball(page).click();
  await expect(page.getByRole('status')).toHaveText('뮤, 넌 내 거야!');
  await dex(page).click();
  const dialog = page.getByRole('dialog', { name: '나의 관동 도감', exact: true });
  await expect(dialog.getByRole('progressbar')).toHaveAttribute('value', '151');
  await expect(dialog).toContainText('관동 도감 완성!');
  expect(await readCaught(page)).toHaveLength(151);
  await page.keyboard.press('Escape');
  await expect(ball(page)).toHaveCount(0);
});

test('깨진 저장 기록에서 복구하고 저장 차단 시 실제 오류 안내', async ({ page }) => {
  await page.addInitScript(key => { if (!localStorage.getItem(key)) localStorage.setItem(key, '{'); }, collectionKey);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/ko/pobti');
  await revealBall(page);
  await ball(page).click();
  await expect(page.getByRole('status')).toContainText('넌 내 거야!');
  expect(await readCaught(page)).toHaveLength(1);
  await page.reload();
  await advanceCooldown(page);
  // Override after reload, without interfering with unrelated navigation drafts.
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'QuotaExceededError'); }; });
  await revealBall(page);
  await ball(page).click();
  await dex(page).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('수집 기록을 저장할 수 없어요.');
  expect(await readCaught(page)).toHaveLength(1);
});

test('다른 탭에도 10분 제한 적용, 만료 후 중복 없이 추가 수집', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/ko/pobti');
  const other = await context.newPage();
  await other.clock.install();
  await other.emulateMedia({ reducedMotion: 'reduce' });
  await other.goto('/ko/pobti');
  await revealBall(page);
  await ball(page).click();
  await expect(page.getByRole('status')).toContainText('넌 내 거야!');
  await expect(dex(other)).toHaveText('1');
  await other.keyboard.press('Shift');
  await other.clock.runFor(16_000);
  await expect(ball(other)).toHaveCount(0);
  await advanceCooldown(other);
  await revealBall(other);
  await ball(other).click();
  await expect(other.getByRole('status')).toContainText('넌 내 거야!');
  expect(await readCaught(other)).toHaveLength(2);
  await expect(dex(page)).toHaveText('2');
  await other.close();
});

test('동시에 두 탭에서 눌러도 한 마리만 수집', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/ko/pobti');
  const other = await context.newPage();
  await other.clock.install();
  await other.emulateMedia({ reducedMotion: 'reduce' });
  await other.goto('/ko/pobti');
  await revealBall(page);
  await revealBall(other);
  await Promise.all([ball(page).click(), ball(other).click()]);
  await Promise.all([page.clock.runFor(250), other.clock.runFor(250)]);
  await expect(dex(page)).toHaveText('1');
  await expect(dex(other)).toHaveText('1');
  expect(await readCaught(page)).toHaveLength(1);
  await other.close();
});

test('흔들리는 도중 홈으로 나가면 포획 타이머 정리', async ({ page }) => {
  await page.goto('/ko/pobti');
  await revealBall(page);
  await ball(page).click();
  await page.goto('/ko');
  await page.clock.runFor(6000);
  expect(await readCaught(page)).toEqual([]);
  await expect(page.locator('[class*="captureBackdrop"]')).toHaveCount(0);
  await expect(page.locator('dialog')).toHaveCount(0);
});

test('영어·일본어·중국어 도감 이름과 모션 줄이기 적용', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, '[25]'), collectionKey);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const row of [
    { locale: 'en', label: 'My Kanto Pokédex', name: 'Pikachu' },
    { locale: 'ja', label: 'マイカントー図鑑', name: 'ピカチュウ' },
    { locale: 'zh', label: '我的关都图鉴', name: '皮卡丘' },
  ]) {
    await page.goto(`/${row.locale}/pobti`);
    await expect(page.locator('dialog img')).toHaveCount(0);
    await page.getByRole('button', { name: row.label, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: row.label, exact: true });
    await expect(dialog.getByText(row.name, { exact: true })).toBeVisible();
    await expect(dialog).not.toContainText('미발견');
    await page.keyboard.press('Escape');
  }
  await page.goto('/ko/pobti');
  await revealBall(page);
  await ball(page).click();
  await expect(page.getByRole('status')).toContainText('넌 내 거야!');
  await expect(portrait(page)).toHaveCount(0, { timeout: 4000 });
  await expect(page.locator('[class*="flyer"]')).toHaveCount(0);
});
