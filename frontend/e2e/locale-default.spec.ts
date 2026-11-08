import { expect, test } from '@playwright/test';

test('Korean IP defaults to Korean without a permanent or shared redirect', async ({ request }) => {
  const response = await request.get('/?from=bookmark', {
    headers: { 'CloudFront-Viewer-Country': 'KR', 'Accept-Language': 'en-US' },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(307);
  expect(new URL(response.headers().location, response.url()).pathname).toBe('/ko');
  expect(new URL(response.headers().location, response.url()).search).toBe('?from=bookmark');
  expect(response.headers()['cache-control']).toContain('no-store');
  expect(response.headers().vary).toContain('Cookie');
});

for (const country of ['US', 'JP', 'CN', '']) {
  test(`non-Korean or missing country keeps English: ${country || 'unknown'}`, async ({ request }) => {
    const response = await request.get('/', {
      headers: { 'CloudFront-Viewer-Country': country, 'Accept-Language': 'ko-KR' },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('<html lang="en"');
    expect(response.headers()['cache-control']).toContain('no-store');
  });
}

for (const [country, preference, target] of [
  ['KR', 'en', '/'], ['KR', 'ja', '/ja'], ['US', 'ko', '/ko'], ['KR', 'invalid', '/ko'],
]) {
  test(`saved preference takes priority: ${country}/${preference}`, async ({ request }) => {
    const response = await request.get('/', {
      headers: { 'CloudFront-Viewer-Country': country, Cookie: `pokesettle_locale=${preference}` },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(target === '/' ? 200 : 307);
    if (target !== '/') expect(new URL(response.headers().location, response.url()).pathname).toBe(target);
  });
}

test('explicit language URLs remain accessible from Korea', async ({ request }) => {
  for (const path of ['/ko', '/ja', '/zh', '/privacy']) {
    const response = await request.get(path, {
      headers: { 'CloudFront-Viewer-Country': 'KR', Cookie: 'pokesettle_locale=ko' },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(200);
  }
  const english = await request.get('/en', {
    headers: { 'CloudFront-Viewer-Country': 'KR' }, maxRedirects: 0,
  });
  expect(english.status()).toBe(308);
  expect(new URL(english.headers().location, english.url()).pathname).toBe('/');
  const followed = await request.get('/en', { headers: { 'CloudFront-Viewer-Country': 'KR' } });
  expect(new URL(followed.url()).pathname).toBe('/');
  expect(await followed.text()).toContain('<html lang="en"');
});

test('manual English selection persists on a subsequent Korean home visit', async ({ page, context }) => {
  await context.setExtraHTTPHeaders({ 'CloudFront-Viewer-Country': 'KR' });
  await page.goto('/');
  await expect(page).toHaveURL('/ko');
  await page.getByRole('combobox', { name: '언어', exact: true }).selectOption('en');
  await expect(page).toHaveURL('/');
  expect((await context.cookies()).find(cookie => cookie.name === 'pokesettle_locale')?.value).toBe('en');
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveURL('/');
});
