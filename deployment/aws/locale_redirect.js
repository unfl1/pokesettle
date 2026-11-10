// CloudFront Functions runtime 2.0; country information comes from CloudFront.
function handler(event) {
  var request = event.request;
  if (request.uri !== '/' || (request.method !== 'GET' && request.method !== 'HEAD')) {
    return request;
  }

  var saved = request.cookies.pokesettle_locale;
  var preference = saved && saved.value;
  var country = request.headers['cloudfront-viewer-country'];
  var locale = { KR: 'ko', JP: 'ja', CN: 'zh' }[country && country.value] || 'en';
  if (['ko', 'ja', 'zh', 'en'].indexOf(preference) !== -1) locale = preference;
  if (locale === 'en') return request;

  // CloudFront supplies query names and values already URL encoded.
  var query = [];
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
