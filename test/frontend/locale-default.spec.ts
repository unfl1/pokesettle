import { expect, test } from '@playwright/test';

// Country/cookie routing is tested against the CloudFront Function separately.
for (const country of ['KR', 'JP', 'CN', 'US', '']) {
  test(`origin leaves country routing to CloudFront: ${country || 'unknown'}`, async ({ request }) => {
    const response = await request.get('/?from=bookmark', {
      headers: { 'CloudFront-Viewer-Country': country, Cookie: 'pokesettle_locale=ja' },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('<html lang="en"');
    expect(response.headers()['cache-control']).toContain('no-store');
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
  await page.goto('/ko');
  await expect(page).toHaveURL('/ko');
  await page.getByRole('combobox', { name: '언어', exact: true }).selectOption('en');
  await expect(page).toHaveURL('/');
  expect((await context.cookies()).find(cookie => cookie.name === 'pokesettle_locale')?.value).toBe('en');
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveURL('/');
});
