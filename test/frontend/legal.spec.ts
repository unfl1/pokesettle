import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const languages = [
  { code: 'ko', html: 'ko', terms: '이용약관', privacy: '개인정보처리방침', contents: '목차', home: '홈으로', select: '언어', date: '2026년 11월 2일', storage: '3. 쿠키와 브라우저 저장소' },
  { code: 'en', html: 'en', terms: 'Terms of Use', privacy: 'Privacy Policy', contents: 'Contents', home: 'Home', select: 'Language', date: 'November 2, 2026', storage: '3. Cookies and browser storage' },
  { code: 'ja', html: 'ja', terms: '利用規約', privacy: 'プライバシーポリシー', contents: '目次', home: 'ホームへ', select: '言語', date: '2026年11月2日', storage: '3. Cookieとブラウザーのストレージ' },
  { code: 'zh', html: 'zh-Hans', terms: '使用条款', privacy: '隐私政策', contents: '目录', home: '返回首页', select: '语言', date: '2026年11月2日', storage: '3. Cookie与浏览器存储' },
];
function path(locale: string, suffix = '') { return locale === 'en' ? suffix || '/' : `/${locale}${suffix}`; }

for (const language of languages) {
  test(`${language.code}: full legal documents, metadata, contents and mobile layout`, async ({ page, request }) => {
    const apiRequests: string[] = [];
    page.on('request', req => { if (new URL(req.url()).pathname.startsWith('/api/')) apiRequests.push(req.url()); });
    for (const document of ['terms', 'privacy'] as const) {
      const url = path(language.code, `/${document}`);
      const response = await request.get(url, { maxRedirects: 0 });
      expect(response.status()).toBe(200);
      expect(await response.text()).toContain(language[document]);
      await page.goto(url);
      await expect(page.locator('html')).toHaveAttribute('lang', language.html);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(language[document]);
      await expect(page.locator('.legal-date')).toContainText(language.date);
      await expect(page.locator('.legal-body > section')).toHaveCount(7);
      await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', `https://pokesettle.com${url}`);
      await expect(page.locator('head meta[property="og:url"]')).toHaveAttribute('content', `https://pokesettle.com${url}`);
      for (const alternate of languages) {
        await expect(page.locator(`head link[hreflang="${alternate.html}"]`)).toHaveAttribute('href', `https://pokesettle.com${path(alternate.code, `/${document}`)}`);
      }
      await expect(page.locator('head link[hreflang="x-default"]')).toHaveAttribute('href', `https://pokesettle.com/${document}`);
      if (language.code !== 'ko') {
        const visible = (await page.locator('.legal-body').innerText()).replaceAll('강현준', '');
        expect(visible).not.toMatch(/[가-힣]/);
      }
      if (document === 'privacy') {
        await expect(page.getByRole('heading', { name: language.storage })).toBeVisible();
        await expect(page.locator('.legal-body')).toContainText('pokecoach_session');
        await expect(page.locator('.legal-body')).toContainText('sessionStorage');
        await expect(page.locator('.legal-body')).toContainText('localStorage');
      }
      const contents = page.getByRole('navigation', { name: language.contents, exact: true });
      await contents.getByRole('link').last().click();
      await expect(page.locator('.legal-body > section').last()).toBeInViewport();
      await expect(page.locator('.legal-related a').first()).toHaveAttribute('href', path(language.code, document === 'terms' ? '/privacy' : '/terms'));
      await expect(page.getByRole('link', { name: language.home, exact: true })).toHaveAttribute('href', path(language.code));
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        expect(await page.evaluate(() => window.document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    }
    expect(apiRequests).toEqual([]);
    const xml = await (await request.get(`/sitemap-${language.code}.xml`)).text();
    for (const document of ['terms', 'privacy']) {
      expect(xml).toContain(`<loc>https://pokesettle.com${path(language.code, `/${document}`)}</loc>`);
    }
  });
}

test('all app footers preserve the selected language when opening policies and returning home', async ({ page }) => {
  for (const language of languages) {
    for (const feature of ['', '/pobti']) {
      await page.goto(path(language.code, feature));
      await page.locator(`footer a[href="${path(language.code, '/privacy')}"]`).click();
      await expect(page).toHaveURL(path(language.code, '/privacy'));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(language.privacy);
      await page.getByRole('link', { name: language.home, exact: true }).click();
      await expect(page).toHaveURL(path(language.code));
    }
  }
});

test('legal language switching retains the document, query and section', async ({ page }) => {
  for (const document of ['terms', 'privacy']) {
    await page.goto(`/ko/${document}?from=footer#rights`);
    for (const [from, to] of [[languages[0], languages[1]], [languages[1], languages[2]], [languages[2], languages[3]], [languages[3], languages[0]]]) {
      await page.getByRole('combobox', { name: from.select, exact: true }).selectOption(to.code);
      await expect(page).toHaveURL(`${path(to.code, `/${document}`)}?from=footer#rights`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(to[document as 'terms' | 'privacy']);
      await expect(page.locator('html')).toHaveAttribute('lang', to.html);
    }
  }
});

test('legacy English policies redirect once and unsupported paths stay 404', async ({ request }) => {
  for (const document of ['terms', 'privacy']) {
    const response = await request.get(`/en/${document}?tag=a&tag=b`, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    const destination = new URL(response.headers().location, response.url());
    expect(destination.pathname + destination.search).toBe(`/${document}?tag=a&tag=b`);
    expect((await request.get(destination.pathname + destination.search, { maxRedirects: 0 })).status()).toBe(200);
  }
  for (const url of ['/about', '/fr/terms', '/ko/terms/missing', '/ja/privacy/missing']) {
    expect((await request.get(url)).status()).toBe(404);
  }
});

test('legal dictionaries have complete translations and preserve literal identifiers', () => {
  const dictionaries = Object.fromEntries(languages.map(language => [language.code, JSON.parse(readFileSync(new URL(`../../frontend/src/components/legal/dictionaries/${language.code}.json`, import.meta.url), 'utf8')) as Record<string, string>]));
  const keys = Object.keys(dictionaries.ko).sort();
  for (const language of languages) {
    const dictionary = dictionaries[language.code];
    expect(Object.keys(dictionary).sort()).toEqual(keys);
    expect(Object.values(dictionary).every(value => value.length > 0)).toBe(true);
    for (const identifier of ['sessionStorage', 'localStorage', 'HttpOnly', 'OpenAI', 'Google Analytics']) {
      expect(Object.values(dictionary).join(' ')).toContain(identifier);
    }
  }
});
