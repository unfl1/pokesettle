import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const handler = runInNewContext(`${readFileSync(new URL('../../deployment/aws/locale_redirect.js', import.meta.url), 'utf8')}; handler;`);
function request(country, preference, extra = {}) {
  return {
    uri: '/', method: 'GET', querystring: {},
    headers: country ? { 'cloudfront-viewer-country': { value: country } } : {},
    cookies: preference ? { pokesettle_locale: { value: preference } } : {},
    ...extra,
  };
}

for (const [country, path] of [['KR', '/ko'], ['JP', '/ja'], ['CN', '/zh'], ['US', null], ['', null], ['TW', null], ['HK', null]]) {
  test(`country default ${country || 'missing'}`, () => {
    const input = request(country);
    const output = handler({ request: input });
    if (!path) return assert.equal(output, input);
    assert.equal(output.statusCode, 307);
    assert.equal(output.headers.location.value, path);
    assert.equal(output.headers['cache-control'].value, 'private, no-store');
  });
}
for (const [country, saved, path] of [['KR', 'en', null], ['JP', 'ko', '/ko'], ['CN', 'ja', '/ja'], ['US', 'zh', '/zh'], ['JP', 'invalid', '/ja']]) {
  test(`saved choice ${country}/${saved}`, () => {
    const input = request(country, saved);
    const output = handler({ request: input });
    if (!path) return assert.equal(output, input);
    assert.equal(output.headers.location.value, path);
  });
}
test('preserves encoded queries and repeated parameters on HEAD', () => {
  const output = handler({ request: request('JP', null, {
    method: 'HEAD', querystring: {
      q: { value: '%ED%94%BC%EC%B9%B4%EC%B8%84' },
      tag: { value: 'a', multiValue: [{ value: 'a' }, { value: 'b%26c' }] },
    },
  }) });
  assert.equal(output.headers.location.value, '/ja?q=%ED%94%BC%EC%B9%B4%EC%B8%84&tag=a&tag=b%26c');
});
test('explicit URLs, API, assets, and write requests pass through', () => {
  for (const uri of ['/ko', '/ja', '/zh', '/en', '/chat', '/pokedex/pikachu', '/privacy', '/api/status', '/_next/static/app.js']) {
    const input = request('KR', 'ja', { uri });
    assert.equal(handler({ request: input }), input);
  }
  const input = request('CN', null, { method: 'POST' });
  assert.equal(handler({ request: input }), input);
});
