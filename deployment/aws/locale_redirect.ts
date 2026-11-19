interface Field { value: string }
interface QueryField extends Field { multiValue?: Field[] }
interface CloudFrontRequest { uri: string; method: string; cookies: Record<string, Field | undefined>; headers: Record<string, Field | undefined>; querystring: Record<string, QueryField> }
interface CloudFrontEvent { request: CloudFrontRequest }

// CloudFront Functions runtime 2.0; country information comes from CloudFront.
function handler(event: CloudFrontEvent) {
  var request = event.request;
  if (request.uri !== '/' || (request.method !== 'GET' && request.method !== 'HEAD')) {
    return request;
  }

  var saved = request.cookies.pokesettle_locale;
  var preference = saved && saved.value;
  var country = request.headers['cloudfront-viewer-country'];
  var defaults: Record<string, string> = { KR: 'ko', JP: 'ja', CN: 'zh' };
  var locale = defaults[country ? country.value : ''] || 'en';
  if (preference && ['ko', 'ja', 'zh', 'en'].indexOf(preference) !== -1) locale = preference;
  if (locale === 'en') return request;

  // CloudFront supplies query names and values already URL encoded.
  var query: string[] = [];
  Object.keys(request.querystring).forEach(function (key) {
    var field = request.querystring[key];
    (field.multiValue || [field]).forEach(function (entry) {
      query.push(key + '=' + entry.value);
    });
  });
  return {
    statusCode: 307,
    statusDescription: 'Temporary Redirect',
    headers: {
      location: { value: '/' + locale + (query.length ? '?' + query.join('&') : '') },
      'cache-control': { value: 'private, no-store' },
      vary: { value: 'CloudFront-Viewer-Country, Cookie' },
    },
  };
}
