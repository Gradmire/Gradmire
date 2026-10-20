/* Runtime settings read from the environment. Read lazily (functions, not
   constants) so tests and scripts can set variables before first use. */
import { randomBytes } from 'node:crypto';

const int = (name, fallback) => {
    const value = Number.parseInt(process.env[name] ?? '', 10);
    return Number.isFinite(value) ? value : fallback;
};
const bool = (name, fallback = false) => {
    const value = process.env[name];
    if (value === undefined || value === '') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

let devSecret;

export const config = {
    isProduction: () => process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production',

    /* Signs guest manage links and keys rate-limit buckets. Must be stable and
       secret in production; a per-process random value is used in development. */
    appSecret() {
        const secret = process.env.APP_SECRET;
        if (secret && secret.length >= 32) return secret;
        if (config.isProduction()) throw new Error('APP_SECRET must be set to at least 32 characters');
        devSecret ||= randomBytes(32).toString('base64url');
        return devSecret;
    },

    allowedOrigins: () => (process.env.FRONTEND_ORIGIN || 'http://localhost:8080')
        .split(',').map((origin) => origin.trim()).filter(Boolean),
    /* Public URL of the site, used in email links. */
    siteUrl: () => (process.env.SITE_URL || config.allowedOrigins()[0] || 'http://localhost:8080').replace(/\/+$/, ''),
    /* Path from the site root to the static pages (the site serves frontend/pages under /pages). */
    pagesPath: () => (process.env.SITE_PAGES_PATH ?? '/pages').replace(/\/+$/, ''),

    cookieSecure: () => bool('SESSION_COOKIE_SECURE', config.isProduction()),
    cookieSameSite: () => {
        const value = (process.env.SESSION_COOKIE_SAMESITE || 'Lax').toLowerCase();
        return value === 'none' ? 'None' : value === 'strict' ? 'Strict' : 'Lax';
    },
    sessionTtlHours: () => int('SESSION_TTL_HOURS', 24 * 7),
    trustProxy: () => bool('TRUST_PROXY', Boolean(process.env.VERCEL)),

    slotStepMinutes: () => Math.max(5, int('BOOKING_SLOT_STEP_MINUTES', 30)),
    changeCutoffHours: () => Math.max(0, int('BOOKING_CHANGE_CUTOFF_HOURS', 24)),
    maxReschedules: () => Math.max(0, int('BOOKING_MAX_RESCHEDULES', 2)),
    reminderOffsetsMinutes: () => (process.env.BOOKING_REMINDER_OFFSETS_MINUTES ?? '1440,60')
        .split(',').map((value) => Number.parseInt(value, 10)).filter((value) => value > 0),
    /* Max time a booking request waits for the calendar before answering "reserved". */
    inlineSyncTimeoutMs: () => int('BOOKING_INLINE_SYNC_TIMEOUT_MS', 8000),

    cronSecret: () => process.env.CRON_SECRET || '',
    adminAlertEmail: () => process.env.ADMIN_ALERT_EMAIL || '',
};
