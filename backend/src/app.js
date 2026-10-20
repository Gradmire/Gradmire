import { config } from './config.js';
import { bookingApiRoute } from './routes/booking-api.js';
import { healthRoute } from './routes/health.js';
import { leadsRoute } from './routes/leads.js';

/* Plain (request, response) handler shared by the local server and the Vercel function. */
export async function handleRequest(request, response) {
    // Comma-separated FRONTEND_ORIGIN, e.g. "http://localhost:8080,https://gradmire.in".
    // Credentials (the session cookie) are only ever allowed for these origins.
    const origin = request.headers.origin;
    if (origin && config.allowedOrigins().includes(origin)) {
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Access-Control-Allow-Credentials', 'true');
        response.setHeader('Vary', 'Origin');
    }
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, Idempotency-Key');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    response.setHeader('Access-Control-Max-Age', '600');

    if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return;
    }

    const { pathname } = new URL(request.url, 'http://localhost');
    if (healthRoute(request, response, pathname) || await leadsRoute(request, response, pathname) || await bookingApiRoute(request, response, pathname)) {
        return;
    }

    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Not found' }));
}
