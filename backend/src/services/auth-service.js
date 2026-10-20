/* First-party accounts: scrypt passwords, opaque session tokens in an HttpOnly
   cookie (only hashes are stored), a per-session CSRF token, and email
   verification. Roles are only ever set server-side; sign-up always creates a
   student. */
import { config } from '../config.js';
import { now } from '../lib/clock.js';
import { dummyPasswordCheck, hashPassword, hmac, randomToken, sha256, verifyPassword } from '../lib/crypto.js';
import { query, withTransaction } from '../lib/db.js';
import { conflict, forbidden, HttpError, parseCookies, unauthorized } from '../lib/http.js';
import { audit } from './audit.js';
import { enqueueNotification } from './notification-service.js';

const MAX_FAILED_LOGINS = 10;
const LOCK_MINUTES = 15;
const VERIFY_TTL_HOURS = 48;
export const STAFF_ROLES = ['counsellor', 'admin'];

export const cookieName = () => (config.cookieSecure() ? '__Host-gm_session' : 'gm_session');

export function publicUser(row) {
    return {
        id: row.id,
        email: row.email,
        emailVerified: Boolean(row.email_verified_at),
        role: row.role,
        firstName: row.first_name,
        lastName: row.last_name,
        phone: row.phone,
    };
}

function sessionCookie(token, maxAgeSeconds) {
    const parts = [`${cookieName()}=${token}`, 'Path=/', 'HttpOnly', `SameSite=${config.cookieSameSite()}`, `Max-Age=${maxAgeSeconds}`];
    if (config.cookieSecure() || config.cookieSameSite() === 'None') parts.push('Secure');
    return parts.join('; ');
}

export const clearSessionCookie = () => sessionCookie('', 0);

async function createSession(client, userId, userAgent) {
    const token = randomToken(32);
    const csrfToken = randomToken(24);
    const ttlHours = config.sessionTtlHours();
    const expiresAt = new Date(now().getTime() + ttlHours * 3600_000);
    await client.query(
        `INSERT INTO sessions (id, user_id, token_hash, csrf_hash, user_agent, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [crypto.randomUUID(), userId, sha256(token), sha256(csrfToken), String(userAgent || '').slice(0, 200), expiresAt],
    );
    return { cookie: sessionCookie(token, ttlHours * 3600), csrfToken };
}

export async function signUp(input, { userAgent }) {
    const passwordHash = await hashPassword(input.password);
    return withTransaction(async (client) => {
        const existing = await client.query('SELECT id FROM users WHERE LOWER(email) = $1', [input.email]);
        if (existing.rows.length) {
            throw conflict('An account with this email already exists. Log in instead.', 'EMAIL_TAKEN');
        }
        const id = crypto.randomUUID();
        const { rows } = await client.query(
            `INSERT INTO users (id, email, password_hash, role, first_name, last_name, phone)
             VALUES ($1, $2, $3, 'student', $4, $5, $6) RETURNING *`,
            [id, input.email, passwordHash, input.firstName, input.lastName || null, input.phone || null],
        );
        await audit(client, { actorUserId: id, action: 'auth.signup', entityType: 'user', entityId: id });
        await issueVerification(client, rows[0]);
        const session = await createSession(client, id, userAgent);
        return { user: publicUser(rows[0]), ...session };
    });
}

export async function logIn({ email, password }, { userAgent }) {
    const { rows } = await query('SELECT * FROM users WHERE LOWER(email) = $1', [email]);
    const user = rows[0];
    if (!user) {
        await dummyPasswordCheck(password);
        throw unauthorized('Email or password is incorrect');
    }
    if (user.locked_until && new Date(user.locked_until) > now()) {
        throw new HttpError(429, 'Too many failed attempts. Try again in a few minutes.', 'ACCOUNT_LOCKED');
    }
    const valid = await verifyPassword(password, user.password_hash);
    return withTransaction(async (client) => {
        if (!valid) {
            // Every MAX_FAILED_LOGINS consecutive failures lock the account for a while.
            const failures = user.failed_login_count + 1;
            const lock = failures >= MAX_FAILED_LOGINS;
            await client.query(
                'UPDATE users SET failed_login_count = $2, locked_until = COALESCE($3, locked_until) WHERE id = $1',
                [user.id, lock ? 0 : failures, lock ? new Date(now().getTime() + LOCK_MINUTES * 60_000) : null],
            );
            await audit(client, { actorUserId: user.id, action: 'auth.login_failed', entityType: 'user', entityId: user.id });
            return { error: unauthorized('Email or password is incorrect') };
        }
        if (user.status !== 'active') return { error: forbidden('This account is disabled. Contact Gradmire support.') };
        await client.query('UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = $1', [user.id]);
        await audit(client, { actorUserId: user.id, action: 'auth.login', entityType: 'user', entityId: user.id });
        const session = await createSession(client, user.id, userAgent);
        return { user: publicUser(user), ...session };
    }).then((result) => {
        if (result.error) throw result.error;
        return result;
    });
}

/* Resolves the session cookie to { user, session } or null. Expired, revoked and
   disabled-account sessions are rejected. */
export async function loadSession(request) {
    const token = parseCookies(request.headers.cookie || '')[cookieName()];
    if (!token || token.length > 100) return null;
    const { rows } = await query(
        `SELECT s.id AS session_id, s.csrf_hash, s.expires_at, s.last_seen_at, u.*
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > $2 AND u.status = 'active'`,
        [sha256(token), now()],
    );
    const row = rows[0];
    if (!row) return null;
    if (now() - new Date(row.last_seen_at) > 10 * 60_000) {
        await query('UPDATE sessions SET last_seen_at = $2 WHERE id = $1', [row.session_id, now()]);
    }
    return { user: row, session: { id: row.session_id, csrfHash: row.csrf_hash } };
}

/* A fresh CSRF token for the current session (the old one stays valid only until replaced). */
export async function rotateCsrf(sessionId) {
    const csrfToken = randomToken(24);
    await query('UPDATE sessions SET csrf_hash = $2 WHERE id = $1', [sessionId, sha256(csrfToken)]);
    return csrfToken;
}

export async function logOut(sessionId) {
    await query('UPDATE sessions SET revoked_at = $2 WHERE id = $1', [sessionId, now()]);
}

/* ── Email verification ───────────────────────────────────────────────────── */

/* The token is HMAC(APP_SECRET, id): the worker re-derives it when it renders
   the email, so neither the token nor anything that reveals it is stored. */
export const verificationToken = (id) => hmac(config.appSecret(), `verify:${id}`);

async function issueVerification(client, user) {
    const id = crypto.randomUUID();
    await client.query(
        `INSERT INTO email_verification_tokens (id, user_id, token_hash, email, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, user.id, sha256(verificationToken(id)), user.email, new Date(now().getTime() + VERIFY_TTL_HOURS * 3600_000)],
    );
    await enqueueNotification(client, {
        userId: user.id,
        template: 'email_verification',
        recipient: user.email,
        dedupeKey: `verify:${id}`,
        payload: { firstName: user.first_name, verificationId: id },
    });
}

export async function requestVerification(user) {
    if (user.email_verified_at) return { alreadyVerified: true };
    await withTransaction((client) => issueVerification(client, user));
    return { sent: true };
}

/* Confirms ownership of the email, then links guest bookings and leads made
   with that same email address to the account. */
export async function confirmVerification(token) {
    return withTransaction(async (client) => {
        const { rows } = await client.query(
            `SELECT t.*, u.email AS current_email FROM email_verification_tokens t JOIN users u ON u.id = t.user_id
             WHERE t.token_hash = $1 FOR UPDATE OF t`,
            [sha256(token)],
        );
        const record = rows[0];
        if (!record || record.consumed_at || new Date(record.expires_at) <= now() || record.email.toLowerCase() !== record.current_email.toLowerCase()) {
            throw new HttpError(400, 'This verification link is invalid or has expired. Request a new one from your dashboard.', 'INVALID_TOKEN');
        }
        await client.query('UPDATE email_verification_tokens SET consumed_at = $2 WHERE id = $1', [record.id, now()]);
        await client.query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, $2), updated_at = $2 WHERE id = $1', [record.user_id, now()]);
        const linked = await linkGuestRecords(client, record.user_id, record.email);
        await audit(client, { actorUserId: record.user_id, action: 'auth.email_verified', entityType: 'user', entityId: record.user_id, details: linked });
        return { verified: true, ...linked };
    });
}

export async function linkGuestRecords(client, userId, email) {
    const consultations = await client.query(
        'UPDATE consultations SET student_user_id = $1, updated_at = NOW() WHERE student_user_id IS NULL AND LOWER(student_email) = LOWER($2) RETURNING id',
        [userId, email],
    );
    const leads = await client.query(
        'UPDATE leads SET user_id = $1, updated_at = NOW() WHERE user_id IS NULL AND LOWER(email) = LOWER($2) RETURNING id',
        [userId, email],
    );
    return { linkedConsultations: consultations.rowCount, linkedLeads: leads.rowCount };
}
