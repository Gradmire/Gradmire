/* Verifies Google Identity Services ID tokens ("Sign in with Google") without
   an SDK: RS256 signature against Google's published keys, then issuer,
   audience (our client id), expiry and a verified email.
   https://developers.google.com/identity/gsi/web/guides/verify-google-id-token */
import { createPublicKey, verify } from 'node:crypto';
import { now } from '../lib/clock.js';

const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const CLOCK_SKEW_SECONDS = 60;

let cache = { keys: null, expiresAt: 0 };
let fetchKeysOverride = null;

export const googleClientIds = () => (process.env.GOOGLE_CLIENT_ID || '').split(',').map((id) => id.trim()).filter(Boolean);
export const googleLoginConfigured = () => googleClientIds().length > 0;

/* Tests supply their own key set: async () => ({ keys: [jwk, …] }). Pass null to restore. */
export function setGoogleKeysFetcher(fetcher) {
    fetchKeysOverride = fetcher;
    cache = { keys: null, expiresAt: 0 };
}

async function signingKeys(forceRefresh = false) {
    if (!forceRefresh && cache.keys && cache.expiresAt > Date.now()) return cache.keys;
    let body;
    let maxAge = 3600;
    if (fetchKeysOverride) {
        body = await fetchKeysOverride();
    } else {
        const response = await fetch(CERTS_URL, { signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error(`Google keys request failed (${response.status})`);
        const match = /max-age=(\d+)/.exec(response.headers.get('cache-control') || '');
        if (match) maxAge = Number(match[1]);
        body = await response.json();
    }
    cache = { keys: body.keys || [], expiresAt: Date.now() + Math.min(maxAge, 86400) * 1000 };
    return cache.keys;
}

const decodePart = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

export class InvalidGoogleToken extends Error {}

/* Returns { sub, email, givenName, familyName, name } or throws InvalidGoogleToken. */
export async function verifyGoogleIdToken(token) {
    const clientIds = googleClientIds();
    if (!clientIds.length) throw new InvalidGoogleToken('Google sign-in is not configured');
    const parts = String(token || '').split('.');
    if (parts.length !== 3 || token.length > 4096) throw new InvalidGoogleToken('Malformed token');

    let header;
    let claims;
    try {
        header = decodePart(parts[0]);
        claims = decodePart(parts[1]);
    } catch {
        throw new InvalidGoogleToken('Malformed token');
    }
    if (header.alg !== 'RS256' || !header.kid) throw new InvalidGoogleToken('Unexpected token algorithm');

    let jwk = (await signingKeys()).find((key) => key.kid === header.kid);
    // Google rotates keys; refresh once if the key id is new to us.
    if (!jwk) jwk = (await signingKeys(true)).find((key) => key.kid === header.kid);
    if (!jwk) throw new InvalidGoogleToken('Unknown signing key');

    const signatureOk = verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
    if (!signatureOk) throw new InvalidGoogleToken('Bad signature');

    const nowSeconds = Math.floor(now().getTime() / 1000);
    if (!ISSUERS.has(claims.iss)) throw new InvalidGoogleToken('Wrong issuer');
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.some((aud) => clientIds.includes(aud))) throw new InvalidGoogleToken('Token was issued for another app');
    if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_SECONDS < nowSeconds) throw new InvalidGoogleToken('Token expired');
    if (typeof claims.iat === 'number' && claims.iat - CLOCK_SKEW_SECONDS > nowSeconds) throw new InvalidGoogleToken('Token issued in the future');
    if (!claims.sub || typeof claims.sub !== 'string') throw new InvalidGoogleToken('Missing subject');
    // Only a Google-verified address may be matched to (or create) an account.
    if (!claims.email || (claims.email_verified !== true && claims.email_verified !== 'true')) {
        throw new InvalidGoogleToken('Google has not verified this email address');
    }
    return {
        sub: claims.sub,
        email: String(claims.email).toLowerCase(),
        givenName: claims.given_name || null,
        familyName: claims.family_name || null,
        name: claims.name || null,
    };
}
