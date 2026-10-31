import { test, expect } from '@playwright/test';
import { axes, calculateType, profiles, questions } from '../src/features/pobti/model';

test('all answer combinations map deterministically to all sixteen types', () => {
  const counts = new Map<string, number>();
  for (let bits = 0; bits < 2 ** questions.length; bits++) {
    const answers = questions.map((_, index) => (bits >> index) & 1);
    const result = calculateType(answers);
    const expected = axes.map((axis, axisIndex) => {
      const votes = questions.flatMap((q, index) => q.axis === axisIndex ? [answers[index]] : []);
      expect(votes).toHaveLength(3);
      return axis.letters[votes.filter(value => value === 1).length >= 2 ? 1 : 0];
    }).join('');
    expect(result).toBe(expected);
    counts.set(result, (counts.get(result) ?? 0) + 1);
  }
  expect([...counts.keys()].sort()).toEqual(Object.keys(profiles).sort());
  expect([...counts.values()].every(count => count === 256)).toBe(true);
  expect(() => calculateType([])).toThrow();
  expect(() => calculateType(Array(12).fill(2))).toThrow();
});

test.beforeEach(async ({ page }) => {
  // Keep browser assertions independent of the external image host.
  await page.route('**/_next/image?**', route => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="white" /></svg>',
  }));
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: {} }));
});

test('navigation, changing a previous answer, result, reload, and retake work offline', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/ko/pobti');
  await expect(page.getByRole('link', { name: '포BTI', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: '내 포켓몬 찾기' }).click();
  await expect(page.getByRole('button', { name: '이전 질문' })).toBeDisabled();
  await page.locator('.pobti-options button').first().click();
  await page.getByRole('button', { name: '이전 질문' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await page.locator('.pobti-options button').last().click();
  for (let index = 1; index < questions.length; index++) {
    await expect(page.locator('.pobti-progress-label')).toContainText(`${index + 1} / 12`);
    await page.locator('.pobti-options button').last().click();
  }
  await expect(page).toHaveURL('/ko/pobti?type=INFP');
  await expect(page.getByRole('heading', { name: '뮤', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '결과 링크 복사' }).click();
  await expect(page.getByRole('region', { name: '포BTI', exact: true }).getByRole('status')).toHaveText('결과 링크를 복사했어요!');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('/ko/pobti?type=INFP');
  await page.reload();
  await expect(page.getByRole('heading', { name: '뮤', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '다시 하기' }).click();
  await expect(page).toHaveURL('/ko/pobti');
  await expect(page.locator('.pobti-progress-label')).toContainText('1 / 12');
  await page.screenshot({ path: '/tmp/pobti-question.png', fullPage: true });
});

for (const [locale, title, pokemon] of [['ko', '포BTI', '거북왕'], ['en', 'PoBTI', 'Blastoise'], ['ja', 'ポBTI', 'カメックス'], ['zh', '宝BTI', '水箭龟']]) {
  test(`${locale}: home entry, shared results, metadata, and responsive navigation`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await page.getByRole('link', { name: new RegExp(title) }).click();
    await expect(page).toHaveURL(`/${locale}/pobti`);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', `https://www.pokesettle.com/${locale}/pobti`);
    await page.goto(`/${locale}/pobti?type=ESTJ`);
    await expect(page.getByRole('heading', { name: pokemon, exact: true })).toBeVisible();
    for (const width of [1440, 1024, 800, 600, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    if (locale === 'ko') await page.screenshot({ path: '/tmp/pobti-mobile.png', fullPage: true });
  });
}

test('invalid and prototype-shaped results stay on the start screen', async ({ page }) => {
  for (const type of ['invalid', 'constructor', '__proto__', 'estj']) {
    await page.goto(`/ko/pobti?type=${type}`);
    await expect(page.getByRole('button', { name: '내 포켓몬 찾기' })).toBeVisible();
  }
});

test('INTP shows a loaded Alakazam artwork with the matching name', async ({ page }) => {
  await page.goto('/ko/pobti?type=INTP');
  const image = page.getByRole('img', { name: '후딘 이미지', exact: true });
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute('src', /official-artwork%2F65\.png/);
  await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: '/tmp/pobti-alakazam.png', fullPage: true });
});

test('artwork failure falls back to a sprite, then an accessible placeholder', async ({ page }) => {
  await page.route('**/_next/image?**', route => {
    const source = new URL(route.request().url()).searchParams.get('url') ?? '';
    return source.includes('/official-artwork/') ? route.abort() : route.fallback();
  });
  await page.goto('/ko/pobti?type=INTP');
  const image = page.getByRole('img', { name: '후딘 이미지', exact: true });
  await expect(image).toHaveAttribute('src', /pokemon%2F65\.png/);
  await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.route('**/_next/image?**', route => route.abort());
  await page.goto('/ko/pobti?type=INFP');
  await expect(page.getByRole('img', { name: '뮤 이미지 없음', exact: true })).toBeVisible();
});
