/* Gradmire API client.
   The base URL comes from <meta name="gm-api-base" content="https://api.example.com">
   when a page sets one; local previews talk to the dev API on port 4000, and the
   deployed site calls the gradmire-api Vercel project, which allows this site's
   origin through FRONTEND_ORIGIN.
   Account calls send the HttpOnly session cookie (credentials: 'include') and the
   per-session CSRF token from GET /api/v1/auth/session in X-CSRF-Token. */
(function () {
    'use strict';

    const PRODUCTION_API = 'https://gradmire-api.vercel.app';

    function apiBase() {
        const meta = document.querySelector('meta[name="gm-api-base"]');
        if (meta && meta.content) return meta.content.replace(/\/+$/, '');
        const host = location.hostname;
        if (location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1') return 'http://localhost:4000';
        return PRODUCTION_API;
    }

    async function submitLead(payload) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch(`${apiBase()}/api/v1/leads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
            return body.data;
        } finally {
            clearTimeout(timer);
        }
    }

    /* ── Account-aware requests ─────────────────────────────────────────── */

    class ApiError extends Error {
        constructor(message, status, code, fields) {
            super(message);
            this.status = status;
            this.code = code;
            this.fields = fields || {};
        }
    }

    let sessionPromise = null;
    let csrfToken = null;

    /* { user, csrfToken } — user is null when logged out. Cached per page. */
    function getSession(refresh) {
        if (!sessionPromise || refresh) {
            sessionPromise = rawRequest('GET', '/api/v1/auth/session')
                .then((data) => {
                    csrfToken = data.csrfToken;
                    return data;
                })
                .catch((error) => {
                    sessionPromise = null;
                    throw error;
                });
        }
        return sessionPromise;
    }

    async function rawRequest(method, path, body, headers) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        let response;
        try {
            response = await fetch(`${apiBase()}${path}`, {
                method,
                credentials: 'include',
                headers: {
                    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
                    ...(csrfToken && method !== 'GET' ? { 'X-CSRF-Token': csrfToken } : {}),
                    ...(headers || {}),
                },
                body: body !== undefined ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });
        } catch (error) {
            throw new ApiError(error.name === 'AbortError'
                ? 'The request took too long. Check your connection and try again.'
                : 'We could not reach Gradmire. Check your connection and try again.', 0, 'NETWORK');
        } finally {
            clearTimeout(timer);
        }
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new ApiError(json.error || `Request failed (${response.status})`, response.status, json.code, json.fields);
        return json.data;
    }

    async function request(method, path, body, headers) {
        // Mutations need the CSRF token of the current session (if any).
        if (method !== 'GET') await getSession().catch(() => null);
        try {
            return await rawRequest(method, path, body, headers);
        } catch (error) {
            if (error.code === 'CSRF_FAILED') {
                await getSession(true);
                return rawRequest(method, path, body, headers);
            }
            throw error;
        }
    }

    async function login(email, password) {
        const data = await request('POST', '/api/v1/auth/login', { email, password });
        csrfToken = data.csrfToken;
        sessionPromise = Promise.resolve({ user: data.user, csrfToken: data.csrfToken });
        return data.user;
    }

    async function signup(payload) {
        const data = await request('POST', '/api/v1/auth/signup', payload);
        csrfToken = data.csrfToken;
        sessionPromise = Promise.resolve({ user: data.user, csrfToken: data.csrfToken });
        return data.user;
    }

    async function logout() {
        await request('POST', '/api/v1/auth/logout', {});
        csrfToken = null;
        sessionPromise = Promise.resolve({ user: null, csrfToken: null });
    }

    /* Only same-site relative paths are accepted as a post-login destination. */
    function safeNext(value, fallback) {
        if (typeof value === 'string' && /^[a-z0-9][a-z0-9-]*\.html(?:[?#][^\s]*)?$/i.test(value)) return value;
        return fallback;
    }

    function newIdempotencyKey() {
        if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
        return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    }

    window.GradmireAPI = { submitLead, request, getSession, login, signup, logout, safeNext, newIdempotencyKey, ApiError, apiBase };
})();
