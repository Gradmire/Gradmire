/* Test harness: a real PostgreSQL (TEST_DATABASE_URL in CI, otherwise an
   embedded server), the real migration script, the real HTTP handler on an
   ephemeral port, a controllable clock and fake calendar/email providers. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const backendDir = fileURLToPath(new URL('../../', import.meta.url));
export const ORIGIN = 'http://localhost:8080';
// Monday 2 Nov 2026, 06:00 in India (00:30 UTC).
export const BASE_NOW = new Date('2026-11-02T00:30:00Z');

let embedded;
let embeddedDir;
let adminUrl;
let dbName;
let server;
export let baseUrl;
export let db; // direct pg pool for assertions

export async function startHarness() {
    if (process.env.TEST_DATABASE_URL) {
        adminUrl = process.env.TEST_DATABASE_URL;
    } else {
        const { default: EmbeddedPostgres } = await import('embedded-postgres');
        const port = 55000 + Math.floor(Math.random() * 5000);
        embeddedDir = mkdtempSync(join(tmpdir(), 'gm-pg-'));
        embedded = new EmbeddedPostgres({ databaseDir: join(embeddedDir, 'data'), user: 'postgres', password: 'test', port, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], onLog: () => {} });
        await embedded.initialise();
        await embedded.start();
        adminUrl = `postgres://postgres:test@127.0.0.1:${port}/postgres`;
    }
    dbName = `gm_test_${process.pid}_${Date.now()}`;
    const admin = new pg.Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName} ENCODING 'UTF8' TEMPLATE template0`);
    await admin.end();
    const url = new URL(adminUrl);
    url.pathname = `/${dbName}`;

    Object.assign(process.env, {
        DATABASE_URL: url.toString(),
        DATABASE_URL_UNPOOLED: url.toString(),
        APP_SECRET: 'test-secret-test-secret-test-secret-123456',
        FRONTEND_ORIGIN: ORIGIN,
        SITE_URL: ORIGIN,
        RATE_LIMIT_DISABLED: 'true',
        CRON_SECRET: 'test-cron-secret',
        BOOKING_INLINE_SYNC_TIMEOUT_MS: '5000',
        NODE_ENV: 'test',
    });
    delete process.env.VERCEL;
    // Apply migrations with the real script, twice (the second run must be a no-op).
    for (let i = 0; i < 2; i += 1) execFileSync(process.execPath, ['scripts/migrate.js'], { cwd: backendDir, env: process.env, stdio: 'pipe' });

    db = new pg.Pool({ connectionString: url.toString(), max: 3 });
    const { handleRequest } = await import('../../src/app.js');
    server = createServer(handleRequest);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    const clock = await import('../../src/lib/clock.js');
    clock.setNow(BASE_NOW);
}

export async function stopHarness() {
    await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
    const { getPool } = await import('../../src/services/db.js');
    await getPool()?.end();
    await db?.end();
    if (adminUrl) {
        const admin = new pg.Client({ connectionString: adminUrl });
        await admin.connect();
        await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`).catch(() => {});
        await admin.end();
    }
    if (embedded) {
        await embedded.stop();
        rmSync(embeddedDir, { recursive: true, force: true });
    }
}

export async function setNow(date) {
    (await import('../../src/lib/clock.js')).setNow(date);
}

/* ── HTTP clients ─────────────────────────────────────────────────────────── */

export async function request(method, path, { body, cookie, csrf, headers = {}, origin = ORIGIN } = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
            ...(origin ? { Origin: origin } : {}),
            ...(cookie ? { Cookie: cookie } : {}),
            ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
            ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch { /* non-JSON */ }
    return { status: response.status, body: json, headers: response.headers, setCookie: response.headers.get('set-cookie') };
}

/* A browser-like client: keeps the session cookie and CSRF token. */
export function agent() {
    const state = { cookie: null, csrf: null };
    const send = async (method, path, options = {}) => {
        const result = await request(method, path, { ...options, cookie: state.cookie, csrf: options.csrf ?? state.csrf });
        if (result.setCookie) state.cookie = result.setCookie.split(';')[0];
        if (result.body?.data?.csrfToken) state.csrf = result.body.data.csrfToken;
        return result;
    };
    return {
        state,
        get: (path, options) => send('GET', path, options),
        post: (path, body, options = {}) => send('POST', path, { ...options, body }),
        patch: (path, body, options = {}) => send('PATCH', path, { ...options, body }),
        delete: (path, options) => send('DELETE', path, options),
        async login(email, password) {
            const result = await send('POST', '/api/v1/auth/login', { body: { email, password } });
            if (result.status !== 200) throw new Error(`login failed: ${result.status} ${JSON.stringify(result.body)}`);
            return result;
        },
    };
}

/* ── Data helpers ─────────────────────────────────────────────────────────── */

let staffCounter = 0;
export async function createStaff({ role = 'counsellor', name = 'Test Counsellor', timezone = 'Asia/Kolkata', calendarId = null, buffer = 10, hours = true, password = 'staff-password-123' } = {}) {
    const { hashPassword } = await import('../../src/lib/crypto.js');
    staffCounter += 1;
    const id = crypto.randomUUID();
    const email = `staff${staffCounter}.${process.pid}@gradmire.test`;
    await db.query(
        "INSERT INTO users (id, email, email_verified_at, password_hash, role, first_name) VALUES ($1, $2, NOW(), $3, $4, $5)",
        [id, email, await hashPassword(password), role, name],
    );
    await db.query('INSERT INTO counsellors (user_id, display_name, timezone, buffer_minutes, calendar_id, is_active) VALUES ($1, $2, $3, $4, $5, $6)', [id, name, timezone, buffer, calendarId, role === 'counsellor']);
    if (hours && role === 'counsellor') {
        for (let weekday = 1; weekday <= 6; weekday += 1) {
            await db.query("INSERT INTO availability_rules (id, counsellor_id, weekday, start_time, end_time, timezone) VALUES ($1, $2, $3, '10:00', '18:00', $4)", [crypto.randomUUID(), id, weekday, timezone]);
        }
    }
    return { id, email, password };
}

export async function deactivateCounsellors() {
    await db.query('UPDATE counsellors SET is_active = FALSE');
}

export const TYPE_FREE = '6f1c2a10-0000-4000-8000-000000000001'; // 30 min
export const TYPE_UNI = '6f1c2a10-0000-4000-8000-000000000002'; // 45 min

let studentCounter = 0;
export function guestBooking(overrides = {}) {
    studentCounter += 1;
    return {
        consultationTypeId: TYPE_FREE,
        meetingMethod: 'video',
        // Tuesday 3 Nov 2026, 10:00 IST
        start: '2026-11-03T04:30:00.000Z',
        timezone: 'Asia/Kolkata',
        fullName: 'Asha Verma',
        email: `asha${studentCounter}.${process.pid}@example.com`,
        phone: '+91 98765 43210',
        destination: 'United Kingdom',
        degree: 'Postgraduate',
        course: 'MSc Data Science',
        intake: 'September 2027',
        contactConsent: true,
        ...overrides,
    };
}

export async function signUpStudent(client, overrides = {}) {
    studentCounter += 1;
    const body = {
        firstName: 'Ravi', lastName: 'Kumar', email: `ravi${studentCounter}.${process.pid}@example.com`,
        phone: '+919812345678', password: 'student-password-1', ageConfirmation: true, ...overrides,
    };
    const result = await client.post('/api/v1/auth/signup', body);
    if (result.status !== 201) throw new Error(`signup failed: ${result.status} ${JSON.stringify(result.body)}`);
    return { ...body, id: result.body.data.user.id };
}

export async function runJobs() {
    const { runDueJobs } = await import('../../src/services/jobs.js');
    return runDueJobs();
}

/* ── Fake providers ───────────────────────────────────────────────────────── */

export function fakeCalendar() {
    const events = new Map();
    const fake = {
        name: 'fake-calendar',
        configured: true,
        events,
        createCalls: 0,
        failures: 0, // throw this many times before succeeding
        loseResponses: 0, // create the event, then throw (a timeout after the write)
        meet: true,
        busy: [],
        async getBusy() {
            return fake.busy;
        },
        async createEvent(input) {
            fake.createCalls += 1;
            if (fake.failures > 0) {
                fake.failures -= 1;
                throw new Error('Calendar API unavailable (simulated)');
            }
            // Same id → same event, as Google's 409-then-get handling guarantees.
            if (!events.has(input.eventId)) events.set(input.eventId, { ...input, meetUrl: fake.meet && input.withMeet ? `https://meet.google.com/${input.eventId.slice(2, 12)}` : null });
            if (fake.loseResponses > 0) {
                fake.loseResponses -= 1;
                throw new Error('Calendar request timed out after write (simulated)');
            }
            const event = events.get(input.eventId);
            return { eventId: input.eventId, meetUrl: event.meetUrl };
        },
        async deleteEvent({ eventId }) {
            events.delete(eventId);
            return { deleted: true };
        },
    };
    return fake;
}

export function fakeEmail() {
    const fake = {
        name: 'fake-email',
        configured: true,
        sent: [],
        keys: new Set(),
        failures: 0,
        async send(message) {
            if (fake.failures > 0) {
                fake.failures -= 1;
                throw new Error('SMTP relay unavailable (simulated)');
            }
            // Mirrors provider idempotency: the same key is delivered once.
            if (!fake.keys.has(message.idempotencyKey)) {
                fake.keys.add(message.idempotencyKey);
                fake.sent.push(message);
            }
            return { messageId: `msg_${fake.sent.length}` };
        },
    };
    return fake;
}

export async function useProviders({ calendar = null, email = null } = {}) {
    (await import('../../src/integrations/calendar/index.js')).setCalendarProvider(calendar);
    (await import('../../src/integrations/email/index.js')).setEmailProvider(email);
}
