/* Applies schema/NNN_*.sql migrations in order, once each, recording them in
   schema_migrations. Rollback files (*.down.sql) are never applied here; run
   them by hand. Usage: DATABASE_URL=... npm run migrate */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const schemaDir = fileURLToPath(new URL('../schema/', import.meta.url));

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    // Serialise concurrent runs (e.g. two deploys at once).
    await client.query('SELECT pg_advisory_lock(727001)');

    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((row) => row.name));
    const files = (await readdir(schemaDir))
        .filter((file) => /^\d+_.+\.sql$/.test(file) && !file.endsWith('.down.sql'))
        .sort();

    for (const file of files) {
        if (applied.has(file)) continue;
        const sql = await readFile(join(schemaDir, file), 'utf8');
        await client.query('BEGIN');
        try {
            await client.query(sql);
            await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
            await client.query('COMMIT');
            console.log(`applied ${file}`);
        } catch (error) {
            await client.query('ROLLBACK');
            throw new Error(`${file} failed: ${error.message}`);
        }
    }
    console.log('migrations up to date');
} finally {
    await client.end();
}
