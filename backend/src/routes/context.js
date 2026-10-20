/* Per-request context and guards shared by the booking API routes. */
import { config } from '../config.js';
import { sha256, safeEqual } from '../lib/crypto.js';
import { clientIp, forbidden, HttpError, readJsonBody, unauthorized } from '../lib/http.js';
import { loadSession } from '../services/auth-service.js';
import { ADMIN_ROLES, can, STAFF_ROLES } from '../services/permissions.js';
import { getPool } from '../services/db.js';

const STATE_CHANGING = new Set(['POST', 'PATCH', 'DELETE']);

export function createContext(request, response, url, params) {
    let sessionPromise;
    let bodyPromise;
    const ctx = {
        request,
        response,
        url,
        params,
        query: url.searchParams,
        ip: clientIp(request, config.trustProxy()),
        userAgent: request.headers['user-agent'] || '',
        /* { user, session } or null. Cached for the request. */
        session() {
            if (!getPool()) return Promise.resolve(null);
            sessionPromise ||= loadSession(request);
            return sessionPromise;
        },
        body() {
            bodyPromise ||= readJsonBody(request);
            return bodyPromise;
        },
    };
    return ctx;
}

/* Browsers always send Origin on cross-site POST/PATCH/DELETE; reject any origin
   that is not ours. Requests without Origin (curl, server-to-server) carry no
   ambient browser credentials risk beyond the CSRF check below. */
export function checkOrigin(ctx) {
    if (!STATE_CHANGING.has(ctx.request.method)) return;
    const origin = ctx.request.headers.origin;
    if (origin && origin !== 'null' && !config.allowedOrigins().includes(origin)) throw forbidden('Cross-site request blocked');
    if (origin === 'null') throw forbidden('Cross-site request blocked');
}

/* Synchroniser token: every state-changing request that rides on a session
   cookie must echo the session's CSRF token in X-CSRF-Token. */
export async function checkCsrf(ctx) {
    if (!STATE_CHANGING.has(ctx.request.method)) return;
    const current = await ctx.session();
    if (!current) return;
    const token = ctx.request.headers['x-csrf-token'];
    if (typeof token !== 'string' || !token || !safeEqual(sha256(token), current.session.csrfHash)) {
        throw new HttpError(403, 'Your session token is missing or out of date. Refresh the page and try again.', 'CSRF_FAILED');
    }
}

export async function requireUser(ctx, roles = null) {
    const current = await ctx.session();
    if (!current) throw unauthorized();
    if (roles && !roles.includes(current.user.role)) throw forbidden();
    return current.user;
}

export const requireStudent = (ctx) => requireUser(ctx, ['student']);
export const requireStaff = (ctx) => requireUser(ctx, STAFF_ROLES);
export const requireAdmin = (ctx) => requireUser(ctx, ADMIN_ROLES);

/* The check every new endpoint uses: the server-side permission, never a role sent by the browser. */
export async function requirePermission(ctx, permission) {
    const user = await requireUser(ctx);
    if (!can(user, permission)) throw forbidden();
    return user;
}
