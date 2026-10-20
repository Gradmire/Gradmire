/* Google service-account access tokens over plain HTTPS (no SDK), shared by
   Calendar, Gmail and Drive. OAuth 2.0 JWT bearer grant signed with the
   service account key; with `subject` set, calls run as that Workspace user
   (domain-wide delegation), which Gmail always needs and Meet links need.
   Tokens are cached per (scope, subject) until a minute before expiry.
   Credentials stay server-side; nothing here is returned to clients. */
import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const b64url = (value) => Buffer.from(value).toString('base64url');

export function createGoogleAuth({ clientEmail, privateKey }) {
    const cache = new Map();

    return async function accessToken(scope, subject = '') {
        const key = `${scope}|${subject}`;
        const cached = cache.get(key);
        if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;
        const issuedAt = Math.floor(Date.now() / 1000);
        const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
        const claims = b64url(JSON.stringify({
            iss: clientEmail, scope, aud: TOKEN_URL, iat: issuedAt, exp: issuedAt + 3600,
            ...(subject ? { sub: subject } : {}),
        }));
        const signer = createSign('RSA-SHA256');
        signer.update(`${header}.${claims}`);
        const assertion = `${header}.${claims}.${signer.sign(privateKey).toString('base64url')}`;
        const response = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
            signal: AbortSignal.timeout(8000),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body.access_token) {
            // unauthorized_client usually means the scope is not granted to the service account in the Workspace admin console.
            throw Object.assign(new Error(`Google token request failed (${response.status} ${body.error || ''})`.trim()), { permanent: body.error === 'unauthorized_client' });
        }
        cache.set(key, { token: body.access_token, expiresAt: Date.now() + (body.expires_in || 3600) * 1000 });
        return body.access_token;
    };
}

let shared = null;

/* The process-wide token source from GOOGLE_SERVICE_ACCOUNT_*; null when not configured. */
export function googleAuthFromEnv() {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    if (!clientEmail || !privateKey.includes('PRIVATE KEY')) return null;
    shared ||= createGoogleAuth({ clientEmail, privateKey });
    return shared;
}

/* JSON call helper with a timeout. Returns { status, ok, data }. */
export async function googleJson(token, method, url, body) {
    const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(10_000),
    });
    const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
    return { status: response.status, ok: response.ok, data };
}

export const googleError = (what, result) => Object.assign(
    new Error(`Google ${what} failed (${result.status} ${result.data?.error?.message || ''})`.trim().slice(0, 300)),
    // Client errors other than rate limiting will not succeed on retry.
    { permanent: result.status >= 400 && result.status < 500 && result.status !== 429 && result.status !== 408 },
);
