import { test, expect } from '@playwright/test';

test('root legal documents render independently of locale routing', async ({ page, request }) => {
  for (const [path, title] of [['/terms', '이용약관'], ['/privacy', '개인정보처리방침']]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain(title);
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', `https://www.pokesettle.com${path}`);
    await expect(page.locator('head link[rel="alternate"][hreflang]')).toHaveCount(0);
    const contents = page.getByRole('navigation', { name: '목차' });
    await contents.getByRole('link').last().click();
    await expect(page.locator('.legal-body section').last()).toBeInViewport();
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
  const about = await request.get('/about', { maxRedirects: 0 });
  expect(about.status()).toBe(307);
  expect(about.headers().location).toBe('https://unfl1.github.io/portfolio/');
  const xml = await (await request.get('/sitemap.xml')).text();
  expect(xml).toContain('<loc>https://www.pokesettle.com/terms</loc>');
  expect(xml).toContain('<loc>https://www.pokesettle.com/privacy</loc>');
  expect(xml).not.toContain('<loc>https://www.pokesettle.com/about</loc>');
});

test('all locales link to shared legal URLs and can return to the app', async ({ page, request }) => {
  for (const locale of ['ko', 'en', 'ja', 'zh']) {
    await page.goto(`/${locale}`);
    await expect(page.locator('footer a[href="/terms"]')).toBeVisible();
    await page.locator('footer a[href="/privacy"]').click();
    await expect(page).toHaveURL('/privacy');
    await expect(page.getByRole('heading', { name: '개인정보처리방침', exact: true })).toBeVisible();
    await page.getByRole('link', { name: '홈으로', exact: true }).click();
    await expect(page).toHaveURL('/ko');
    await page.goto(`/${locale}/pokedex`);
    await expect(page.locator('footer a[href="/terms"]')).toBeVisible();
    // Legal documents are shared Korean pages, without fabricated translated variants.
    expect((await request.get(`/${locale}/terms`)).status()).toBe(404);
  }
  expect((await request.get('/fr/terms')).status()).toBe(404);
});
