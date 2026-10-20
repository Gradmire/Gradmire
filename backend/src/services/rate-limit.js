/* Fixed-window rate limits stored in PostgreSQL so every serverless instance
   shares the same counters. Buckets are HMACs, so raw IPs and emails are not stored. */
import { config } from '../config.js';
import { hmac } from '../lib/crypto.js';
import { HttpError } from '../lib/http.js';
import { now } from '../lib/clock.js';
import { getPool } from './db.js';

const memory = new Map();

export const LIMITS = {
    booking: { limit: 8, windowSeconds: 3600 },
    bookingManage: { limit: 30, windowSeconds: 3600 },
    availability: { limit: 120, windowSeconds: 60 },
    login: { limit: 10, windowSeconds: 900 },
    signup: { limit: 6, windowSeconds: 3600 },
    verifyEmail: { limit: 6, windowSeconds: 3600 },
    bookingResend: { limit: 5, windowSeconds: 3600 },
    invitation: { limit: 20, windowSeconds: 3600 },
    consultantApplication: { limit: 5, windowSeconds: 3600 },
    upload: { limit: 30, windowSeconds: 3600 },
    staffEmail: { limit: 60, windowSeconds: 3600 },
    googleLogin: { limit: 20, windowSeconds: 900 },
    passwordReset: { limit: 5, windowSeconds: 3600 },
};

export async function enforceRateLimit(name, key) {
    if (process.env.RATE_LIMIT_DISABLED === 'true' && !config.isProduction()) return;
    const { limit, windowSeconds } = LIMITS[name];
    const windowMs = windowSeconds * 1000;
    const current = now().getTime();
    const windowStart = new Date(current - (current % windowMs));
    const bucket = Buffer.from(hmac(config.appSecret(), `${name}:${key}`), 'base64url').toString('hex').slice(0, 64);

    let hits;
    const pool = getPool();
    if (pool) {
        const { rows } = await pool.query(
            `INSERT INTO rate_limits (bucket, window_start, hits) VALUES ($1, $2, 1)
             ON CONFLICT (bucket, window_start) DO UPDATE SET hits = rate_limits.hits + 1
             RETURNING hits`,
            [bucket, windowStart],
        );
        hits = rows[0].hits;
    } else {
        const memoryKey = `${bucket}:${windowStart.getTime()}`;
        hits = (memory.get(memoryKey) || 0) + 1;
        memory.set(memoryKey, hits);
    }

    if (hits > limit) {
        const retryAfter = Math.ceil((windowStart.getTime() + windowMs - current) / 1000);
        throw new HttpError(429, 'Too many requests. Please wait a little and try again.', 'RATE_LIMITED', { retryAfter });
    }
}

export async function purgeOldRateLimits(client) {
    await client.query("DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 day'");
}
