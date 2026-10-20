/* Runs a real local PostgreSQL (via the embedded-postgres dev dependency) for
   development without Docker. Data persists in backend/.local-pg/.
   Usage: npm run db:local   → prints DATABASE_URL; Ctrl+C to stop. */
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';

const port = Number(process.env.LOCAL_PG_PORT || 54320);
const databaseDir = fileURLToPath(new URL('../.local-pg/', import.meta.url));
const server = new EmbeddedPostgres({ databaseDir, user: 'gradmire', password: 'gradmire-local', port, persistent: true, initdbFlags: ['--encoding=UTF8', '--locale=C'], onLog: () => {} });

try {
    await server.initialise();
} catch (error) {
    // Already initialised on an earlier run.
    if (!/already exists|not empty/i.test(String(error.message))) throw error;
}
await server.start();
const admin = new pg.Client({ connectionString: `postgres://gradmire:gradmire-local@127.0.0.1:${port}/postgres` });
await admin.connect();
const exists = (await admin.query("SELECT 1 FROM pg_database WHERE datname = 'gradmire'")).rows.length;
if (!exists) await admin.query("CREATE DATABASE gradmire ENCODING 'UTF8' TEMPLATE template0");
await admin.end();

console.log(`Local PostgreSQL is running.\n\n  DATABASE_URL=postgres://gradmire:gradmire-local@127.0.0.1:${port}/gradmire\n\nPress Ctrl+C to stop.`);
const stop = async () => {
    await server.stop();
    process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
