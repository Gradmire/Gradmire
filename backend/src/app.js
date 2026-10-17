import { healthRoute } from './routes/health.js';
import { leadsRoute } from './routes/leads.js';

// Comma-separated list, e.g. "http://localhost:8080,https://gradmire.in".
// Not needed when the site and API share an origin (the Vercel /api rewrite).
const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:8080')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

/* Plain (request, response) handler shared by the local server and the Vercel function. */
export async function handleRequest(request, response) {
    const origin = request.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Vary', 'Origin');
    }
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

    if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return;
    }

    const { pathname } = new URL(request.url, 'http://localhost');
    if (healthRoute(request, response, pathname) || await leadsRoute(request, response, pathname)) {
        return;
    }

    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Not found' }));
}
