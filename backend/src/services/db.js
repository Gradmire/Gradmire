import pg from 'pg';

let pool;

/* One pool per process (or per warm serverless instance). Returns null when no
   database is configured, so callers can fall back to in-memory storage. */
export function getPool() {
    if (!process.env.DATABASE_URL) return null;
    if (!pool) {
        pool = new pg.Pool({
            connectionString: process.env.DATABASE_URL,
            max: Number(process.env.DATABASE_POOL_MAX || 5),
            idleTimeoutMillis: 10_000,
            connectionTimeoutMillis: 5_000,
        });
        pool.on('error', (error) => console.error('Idle database client error', error));
    }
    return pool;
}
