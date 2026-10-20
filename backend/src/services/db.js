import pg from 'pg';

// Keep DATE columns as 'YYYY-MM-DD' strings; the default parser turns them into
// local-midnight Dates, which shift by a day outside UTC.
pg.types.setTypeParser(1082, (value) => value);

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
