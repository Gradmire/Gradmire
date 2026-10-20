/* End-to-end test of the deployed site as a student, a counsellor and a super
   admin. It calls the API through the site's own /gm-api proxy, exactly as the
   browser does, and deletes every account and booking it creates.
   Usage (from backend/):
     DATABASE_URL=… E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… node scripts/e2e-live.js
     SITE_URL defaults to https://gradmire-1nfj.vercel.app
   Test accounts use e2e-<timestamp>@example.com. Prints no secrets. */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import pg from 'pg';

const site = (process.env.SITE_URL || 'https://gradmire-1nfj.vercel.app').replace(/\/+$/, '');
const api = `${site}/gm-api`;
const { DATABASE_URL, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } = process.env;
if (!DATABASE_URL || !E2E_ADMIN_EMAIL || !E2E_ADMIN_PASSWORD) {
    console.error('Set DATABASE_URL, E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD.');
    process.exit(2);
}

const stamp = Date.now();
const student = { email: `e2e-student-${stamp}@example.com`, password: `E2e-${randomBytes(9).toString('base64url')}` };
const counsellor = { email: `e2e-counsellor-${stamp}@example.com`, password: `E2e-${randomBytes(9).toString('base64url')}` };
let failures = 0;

class Client {
    constructor(label) {
        this.label = label;
        this.cookie = '';
        this.csrf = null;
    }

    async call(method, path, body, headers = {}) {
        const response = await fetch(`${api}${path}`, {
            method,
            redirect: 'manual',
            headers: {
                Origin: site,
                ...(this.cookie ? { Cookie: this.cookie } : {}),
                ...(this.csrf && method !== 'GET' ? { 'X-CSRF-Token': this.csrf } : {}),
                ...(body ? { 'Content-Type': 'application/json' } : {}),
                ...headers,
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(30_000),
        });
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
            const pair = setCookie.split(';')[0];
            this.cookie = pair.endsWith('=') ? '' : pair;
        }
        const json = await response.json().catch(() => ({}));
        if (json?.data?.csrfToken !== undefined) this.csrf = json.data.csrfToken;
        return { status: response.status, json, setCookie };
    }

    async ok(method, path, body, expected = [200, 201]) {
        const r = await this.call(method, path, body);
        if (!expected.includes(r.status)) throw new Error(`${method} ${path} → ${r.status} ${r.json.error || r.json.code || ''}`.trim());
        return r.json.data;
    }

    async denied(method, path) {
        const r = await this.call(method, path);
        if (![401, 403].includes(r.status)) throw new Error(`${method} ${path} should be refused, got ${r.status}`);
        return r.status;
    }
}

async function step(label, fn) {
    try {
        const detail = await fn();
        console.log(`  ok    ${label}${detail ? ` — ${detail}` : ''}`);
        return true;
    } catch (error) {
        failures += 1;
        console.log(`  FAIL  ${label} — ${error.message}`);
        return false;
    }
}
const expect = (condition, message) => {
    if (!condition) throw new Error(message);
};

async function findSlots(client, typeId, count) {
    const slots = [];
    for (let day = 2; day <= 21 && slots.length < count; day += 1) {
        const date = new Date(Date.now() + day * 86400000).toISOString().slice(0, 10);
        const data = await client.ok('GET', `/api/v1/availability?consultation_type_id=${typeId}&date=${date}&timezone=Asia/Kolkata`);
        // One slot per day, so a reschedule always moves to a genuinely different time.
        if (data.slots.length) slots.push(data.slots.at(-1));
    }
    return slots;
}

async function cleanup() {
    const db = new pg.Client({ connectionString: DATABASE_URL });
    await db.connect();
    try {
        await db.query('BEGIN');
        const users = (await db.query("SELECT id FROM users WHERE email LIKE 'e2e-%@example.com'")).rows.map((r) => r.id);
        const consultations = (await db.query(
            "SELECT id, lead_id FROM consultations WHERE student_user_id = ANY($1) OR counsellor_id = ANY($1) OR LOWER(student_email) LIKE 'e2e-%@example.com'",
            [users],
        )).rows;
        const ids = consultations.map((r) => r.id);
        const leads = consultations.map((r) => r.lead_id).filter(Boolean);
        await db.query('UPDATE consultations SET rescheduled_from_id = NULL WHERE rescheduled_from_id = ANY($1)', [ids]);
        await db.query('DELETE FROM follow_up_tasks WHERE consultation_id = ANY($1) OR assignee_user_id = ANY($2) OR student_user_id = ANY($2)', [ids, users]);
        await db.query('DELETE FROM consultations WHERE id = ANY($1)', [ids]);
        await db.query("DELETE FROM leads WHERE id = ANY($1) OR LOWER(email) LIKE 'e2e-%@example.com'", [leads]);
        await db.query('DELETE FROM users WHERE id = ANY($1)', [users]);
        await db.query('COMMIT');
        return `${users.length} accounts, ${ids.length} bookings, ${new Set(leads).size} leads removed`;
    } catch (error) {
        await db.query('ROLLBACK');
        throw error;
    } finally {
        await db.end();
    }
}

console.log(`End-to-end test: ${site} (API through ${api})\n`);

try {
    console.log('Pages');
    for (const path of ['/', '/pages/login.html', '/pages/signup.html', '/pages/book-consultation.html', '/pages/dashboard.html',
        '/pages/dashboard-consultations.html', '/pages/consultant-dashboard.html', '/pages/admin.html', '/pages/admin-consultations.html',
        '/pages/admin-users.html', '/pages/reset-password.html', '/login', '/dashboard', '/admin']) {
        await step(`GET ${path}`, async () => {
            // One retry, so a single slow cold start is not reported as a broken page.
            const get = () => fetch(`${site}${path}`, { redirect: 'follow', signal: AbortSignal.timeout(30_000) });
            const r = await get().catch(get);
            expect(r.status === 200, `status ${r.status}`);
        });
    }

    await step('setup: test counsellor (no public hours)', async () => {
        const result = spawnSync(process.execPath, ['scripts/create-staff.js', '--email', counsellor.email, '--first-name', 'E2E',
            '--last-name', 'Counsellor', '--role', 'counsellor', '--no-default-hours'],
        { env: { ...process.env, STAFF_PASSWORD: counsellor.password, NODE_NO_WARNINGS: '1' }, encoding: 'utf8' });
        expect(result.status === 0, (result.stderr || result.stdout).trim().split('\n').pop());
    });

    const s = new Client('student');
    const a = new Client('admin');
    const c = new Client('counsellor');
    let types = [];
    let slots = [];
    let booking = null;
    let counsellorId = null;

    await step('counsellor logs in', async () => {
        const data = await c.ok('POST', '/api/v1/auth/login', { email: counsellor.email, password: counsellor.password });
        expect(data.user.role === 'counsellor', `role ${data.user.role}`);
        counsellorId = data.user.id;
    });

    console.log('\nStudent');
    await step('sign up', async () => {
        const data = await s.ok('POST', '/api/v1/auth/signup', { firstName: 'E2E', lastName: 'Student', email: student.email, password: student.password, ageConfirmation: true });
        expect(data.user.role === 'student', `role ${data.user.role}`);
        expect(s.cookie.startsWith('__Host-gm_session='), 'no session cookie');
    });
    await step('session cookie is first-party and kept', async () => {
        const data = await s.ok('GET', '/api/v1/auth/session');
        expect(data.user?.email === student.email, 'not signed in after signup');
    });
    await step('dashboard, profile and notifications', async () => {
        await s.ok('GET', '/api/v1/me/dashboard');
        await s.ok('PATCH', '/api/v1/me/profile', { phone: '+919000000000' });
        await s.ok('GET', '/api/v1/me/profile');
        await s.ok('GET', '/api/v1/me/notifications');
    });
    await step('blocked from staff and admin areas', async () => {
        await s.denied('GET', '/api/v1/admin/consultations');
        await s.denied('GET', '/api/v1/admin/users');
        await s.denied('GET', '/api/v1/consultant/dashboard');
    });
    await step('find open slots', async () => {
        types = await s.ok('GET', '/api/v1/consultation-types');
        slots = await findSlots(s, types[0].id, 2);
        expect(slots.length === 2, `only ${slots.length} bookable day(s) in the next three weeks`);
        return `${types[0].name}: ${slots[0].start}`;
    });
    await step('book a consultation while signed in', async () => {
        const data = await s.ok('POST', '/api/v1/consultations', {
            consultationTypeId: types[0].id, meetingMethod: types[0].meetingMethods[0], start: slots[0].start, timezone: 'Asia/Kolkata',
            contactConsent: true, remindersOptIn: false, message: 'Automated end-to-end test; deleted afterwards.',
        });
        booking = data.consultation;
        expect(booking?.id, 'no consultation returned');
        return `${booking.reference} ${booking.status}`;
    });
    await step('booking appears under My consultations', async () => {
        const list = await s.ok('GET', '/api/v1/me/consultations');
        const rows = Array.isArray(list) ? list : list.consultations || list.items || [];
        expect(rows.some((row) => row.id === booking.id), 'booking missing from the list');
        await s.ok('GET', `/api/v1/me/consultations/${booking.id}`);
    });
    await step('reschedule to another day', async () => {
        const data = await s.ok('POST', `/api/v1/me/consultations/${booking.id}/reschedule`, { start: slots[1].start, timezone: 'Asia/Kolkata' });
        const moved = data.consultation || data;
        if (moved.id) booking = moved;
        return `now ${booking.start || slots[1].start}`;
    });

    console.log('\nSuper admin');
    await step('log in', async () => {
        const data = await a.ok('POST', '/api/v1/auth/login', { email: E2E_ADMIN_EMAIL, password: E2E_ADMIN_PASSWORD });
        expect(data.user.role === 'super_admin', `role ${data.user.role}`);
        expect((await a.ok('GET', '/api/v1/auth/session')).user, 'session not kept');
    });
    for (const path of ['/api/v1/admin/overview', '/api/v1/admin/users', '/api/v1/admin/consultations/summary', '/api/v1/admin/counsellors',
        '/api/v1/admin/leads', '/api/v1/admin/students', '/api/v1/admin/approvals', '/api/v1/admin/audit-logs', '/api/v1/admin/notifications',
        '/api/v1/admin/consultant-applications', '/api/v1/admin/employees', '/api/v1/admin/availability']) {
        await step(`GET ${path.replace('/api/v1', '')}`, () => a.ok('GET', path).then(() => ''));
    }
    await step('sees the student booking and the test counsellor', async () => {
        const data = await a.ok('GET', `/api/v1/admin/consultations/${booking.id}`);
        expect((data.consultation || data).id === booking.id, 'wrong booking');
        const counsellors = await a.ok('GET', '/api/v1/admin/counsellors');
        expect(counsellors.some((row) => row.id === counsellorId), 'test counsellor not in the counsellor list');
    });
    await step('reassign the booking to the test counsellor', async () => {
        await a.ok('PATCH', `/api/v1/admin/consultations/${booking.id}`, { counsellorId });
    });

    console.log('\nCounsellor');
    await step('dashboard, students and follow-ups', async () => {
        await c.ok('GET', '/api/v1/consultant/dashboard');
        await c.ok('GET', '/api/v1/consultant/students');
        await c.ok('GET', '/api/v1/consultant/follow-ups');
    });
    await step('sees the assigned booking', async () => {
        const data = await c.ok('GET', `/api/v1/admin/consultations/${booking.id}`);
        expect((data.consultation || data).id === booking.id, 'wrong booking');
    });
    await step('adds a note and a follow-up', async () => {
        await c.ok('POST', `/api/v1/admin/consultations/${booking.id}/notes`, { kind: 'note', body: 'E2E note' });
        await c.ok('POST', `/api/v1/admin/consultations/${booking.id}/notes`, { kind: 'follow_up', body: 'E2E follow-up', dueAt: new Date(Date.now() + 86400000).toISOString() });
    });
    await step('blocked from admin-only areas', async () => {
        await c.denied('GET', '/api/v1/admin/users');
        await c.denied('GET', '/api/v1/admin/audit-logs');
    });

    console.log('\nWrap-up');
    await step('student cancels the booking', async () => {
        const data = await s.ok('POST', `/api/v1/me/consultations/${booking.id}/cancel`, { reason: 'E2E test' });
        expect((data.consultation || data).status === 'cancelled', `status ${(data.consultation || data).status}`);
    });
    await step('log out ends every session', async () => {
        for (const client of [s, a, c]) {
            await client.ok('POST', '/api/v1/auth/logout');
            expect((await client.ok('GET', '/api/v1/auth/session')).user === null, `${client.label} still signed in`);
        }
    });
} finally {
    await step('cleanup: delete test accounts and bookings', cleanup);
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
