import { getPool } from '../services/db.js';
import { HttpError } from './http.js';

/* The booking system needs durable storage; unlike leads it has no in-memory mode. */
export function requirePool() {
    const pool = getPool();
    if (!pool) throw new HttpError(503, 'Booking is temporarily unavailable. Please try again later.', 'DATABASE_UNAVAILABLE');
    return pool;
}

export async function query(text, values) {
    return requirePool().query(text, values);
}

export async function withTransaction(work) {
    const client = await requirePool().connect();
    try {
        await client.query('BEGIN');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}

/* Runs `work` inside a savepoint so one failed statement does not abort the transaction. */
export async function withSavepoint(client, name, work) {
    await client.query(`SAVEPOINT ${name}`);
    try {
        const result = await work();
        await client.query(`RELEASE SAVEPOINT ${name}`);
        return result;
    } catch (error) {
        await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
        throw error;
    }
}
