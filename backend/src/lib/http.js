/* Small HTTP toolkit for the booking API: errors, JSON responses, body parsing
   and a path router. The older lead routes keep their own helpers. */

export class HttpError extends Error {
    constructor(status, message, code = undefined, details = undefined) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

export const badRequest = (message, details) => new HttpError(400, message, 'VALIDATION_ERROR', details);
export const notFound = (message = 'Not found') => new HttpError(404, message, 'NOT_FOUND');
export const conflict = (message, code = 'CONFLICT') => new HttpError(409, message, code);
export const forbidden = (message = 'You do not have permission to do that') => new HttpError(403, message, 'FORBIDDEN');
export const unauthorized = (message = 'Please log in to continue') => new HttpError(401, message, 'UNAUTHORIZED');

export function sendJson(response, status, body, headers = {}) {
    if (response.headersSent) return;
    response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        // Responses carry personal data; never let a shared cache keep them.
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        ...headers,
    });
    response.end(JSON.stringify(body));
}

export function sendError(response, error) {
    if (error instanceof HttpError) {
        const headers = error.status === 429 && error.details?.retryAfter ? { 'Retry-After': String(error.details.retryAfter) } : {};
        sendJson(response, error.status, { error: error.message, code: error.code, ...(error.details?.fields ? { fields: error.details.fields } : {}) }, headers);
        return;
    }
    // Unknown errors: log the message and stack only, never request bodies.
    console.error('Unhandled API error:', error?.message, error?.stack?.split('\n').slice(1, 4).join(' | '));
    sendJson(response, 500, { error: 'Something went wrong. Please try again.', code: 'INTERNAL' });
}

export function readJsonBody(request, maxBytes = 16 * 1024) {
    return new Promise((resolve, reject) => {
        const type = request.headers['content-type'] || '';
        let raw = '';
        let tooLarge = false;
        request.setEncoding('utf8');
        request.on('data', (chunk) => {
            if (tooLarge) return;
            raw += chunk;
            if (Buffer.byteLength(raw) > maxBytes) {
                tooLarge = true;
                raw = '';
                reject(new HttpError(413, 'Request body is too large', 'BODY_TOO_LARGE'));
            }
        });
        request.on('end', () => {
            if (tooLarge) return;
            if (!raw) return resolve({});
            if (!type.includes('application/json')) return reject(new HttpError(415, 'Send the request body as application/json', 'UNSUPPORTED_MEDIA_TYPE'));
            try {
                const parsed = JSON.parse(raw);
                if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
                resolve(parsed);
            } catch {
                reject(new HttpError(400, 'Request body must be a JSON object', 'INVALID_JSON'));
            }
        });
        request.on('error', reject);
    });
}

/* Routes like '/api/v1/me/consultations/:id'. Params must be UUID-safe words. */
export function createRouter() {
    const routes = [];
    const add = (method, path, handler) => {
        const keys = [];
        const pattern = new RegExp(`^${path.replace(/:([a-zA-Z]+)/g, (_, key) => {
            keys.push(key);
            return '([A-Za-z0-9_-]{1,64})';
        })}$`);
        routes.push({ method, pattern, keys, handler });
    };
    return {
        get: (path, handler) => add('GET', path, handler),
        post: (path, handler) => add('POST', path, handler),
        patch: (path, handler) => add('PATCH', path, handler),
        delete: (path, handler) => add('DELETE', path, handler),
        /* Returns { handler, params } or { methodNotAllowed: true } or null. */
        match(method, pathname) {
            let pathMatched = false;
            for (const route of routes) {
                const found = route.pattern.exec(pathname);
                if (!found) continue;
                pathMatched = true;
                if (route.method !== method) continue;
                const params = Object.fromEntries(route.keys.map((key, index) => [key, found[index + 1]]));
                return { handler: route.handler, params };
            }
            return pathMatched ? { methodNotAllowed: true } : null;
        },
    };
}

export function clientIp(request, trustProxy) {
    if (trustProxy) {
        const forwarded = request.headers['x-forwarded-for'];
        if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
        const real = request.headers['x-real-ip'];
        if (typeof real === 'string' && real) return real.trim();
    }
    return request.socket?.remoteAddress || 'unknown';
}

export function parseCookies(header = '') {
    const cookies = {};
    for (const part of header.split(';')) {
        const index = part.indexOf('=');
        if (index < 1) continue;
        const name = part.slice(0, index).trim();
        const value = part.slice(index + 1).trim();
        try {
            cookies[name] = decodeURIComponent(value);
        } catch {
            cookies[name] = value;
        }
    }
    return cookies;
}
