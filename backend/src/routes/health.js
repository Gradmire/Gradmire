export function healthRoute(request, response, pathname) {
    if (request.method !== 'GET' || pathname !== '/api/v1/health') {
        return false;
    }

    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status: 'ok', service: 'gradmire-api' }));
    return true;
}