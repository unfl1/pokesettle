function handler(event) {
    var request = event.request;
    var uri = request.uri;
    // API errors must remain API errors; never rewrite them to the frontend HTML.
    if (uri === '/api' || uri.indexOf('/api/') === 0 || uri.indexOf('/assets/') === 0) {
        return request;
    }
    var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);
    if (uri === '/' || lastSegment.indexOf('.') === -1) {
        request.uri = '/index.html';
    }
    return request;
}
