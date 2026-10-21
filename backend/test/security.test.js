/* Security: ownership, roles, protected fields, credentials, CSRF and origin checks. */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
    agent, BASE_NOW, createStaff, db, deactivateCounsellors, guestBooking, request, setNow, signUpStudent,
    startHarness, stopHarness, useProviders,
} from './helpers/harness.js';

before(startHarness);
after(stopHarness);

let counsellorA;
let counsellorB;
beforeEach(async () => {
    await setNow(BASE_NOW);
    await useProviders();
    await db.query('DELETE FROM consultations');
    await deactivateCounsellors();
    counsellorA = await createStaff({ name: 'Counsellor A' });
    counsellorB = await createStaff({ name: 'Counsellor B' });
});

async function studentWithBooking(start = '2026-11-03T04:30:00.000Z') {
    const client = agent();
    const profile = await signUpStudent(client);
    await client.get('/api/v1/auth/session');
    const result = await client.post('/api/v1/consultations', { ...guestBooking({ start }), fullName: undefined, email: undefined });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    return { client, profile, consultation: result.body.data.consultation };
}

async function staffAgent(staff) {
    const client = agent();
    await client.login(staff.email, staff.password);
    return client;
}

describe('students and records they do not own', () => {
    test('11. a student cannot view or change another student\'s appointment', async () => {
        const alice = await studentWithBooking();
        const bob = await studentWithBooking('2026-11-03T06:00:00.000Z');
        const peek = await bob.client.get(`/api/v1/me/consultations/${alice.consultation.id}`);
        assert.equal(peek.status, 404, 'looks like "not found", so ids cannot be probed');
        const cancel = await bob.client.post(`/api/v1/me/consultations/${alice.consultation.id}/cancel`, {});
        assert.equal(cancel.status, 404);
        const move = await bob.client.post(`/api/v1/me/consultations/${alice.consultation.id}/reschedule`, { start: '2026-11-03T08:00:00.000Z' });
        assert.equal(move.status, 404);
        const list = await bob.client.get('/api/v1/me/consultations');
        assert.deepEqual(list.body.data.map((c) => c.id), [bob.consultation.id]);
        const status = (await db.query('SELECT status FROM consultations WHERE id = $1', [alice.consultation.id])).rows[0].status;
        assert.equal(status, 'confirmed');
    });

    test('a guest booking is not linked to an account just because the email matches', async () => {
        const client = agent();
        const profile = await signUpStudent(client);
        const guest = await request('POST', '/api/v1/consultations', { body: guestBooking({ email: profile.email }) });
        assert.equal(guest.status, 201);
        await client.get('/api/v1/auth/session');
        assert.equal((await client.get('/api/v1/me/consultations')).body.data.length, 0, 'unverified email links nothing');
        // Claiming with the manage link still needs a verified email.
        const claim = await client.post('/api/v1/me/consultations/claim', { token: guest.body.data.manageToken });
        assert.equal(claim.status, 403);
    });

    test('verifying the email links matching guest bookings; claim needs token + matching verified email', async () => {
        const client = agent();
        const profile = await signUpStudent(client);
        const guest = await request('POST', '/api/v1/consultations', { body: guestBooking({ email: profile.email }) });
        const other = await request('POST', '/api/v1/consultations', { body: guestBooking({ start: '2026-11-03T08:00:00.000Z' }) });

        const { verificationToken } = await import('../src/services/auth-service.js');
        const row = (await db.query('SELECT id FROM email_verification_tokens WHERE user_id = $1', [profile.id])).rows[0];
        assert.equal((await request('POST', '/api/v1/auth/verify-email/confirm', { body: { token: 'wrong-token' } })).status, 400);
        const verified = await request('POST', '/api/v1/auth/verify-email/confirm', { body: { token: verificationToken(row.id) } });
        assert.equal(verified.status, 200);
        assert.equal(verified.body.data.linkedConsultations, 1);
        assert.equal((await request('POST', '/api/v1/auth/verify-email/confirm', { body: { token: verificationToken(row.id) } })).status, 400, 'single use');

        await client.get('/api/v1/auth/session');
        const mine = await client.get('/api/v1/me/consultations');
        assert.deepEqual(mine.body.data.map((c) => c.id), [guest.body.data.consultation.id]);
        // Someone else's booking cannot be claimed even with its link.
        const steal = await client.post('/api/v1/me/consultations/claim', { token: other.body.data.manageToken });
        assert.equal(steal.status, 403);
    });
});

describe('roles and protected fields', () => {
    test('12. a student cannot make themselves an administrator', async () => {
        const client = agent();
        const result = await client.post('/api/v1/auth/signup', {
            firstName: 'Eve', email: `eve.${process.pid}@example.com`, password: 'eve-password-1', ageConfirmation: true,
            role: 'admin', status: 'active', emailVerified: true,
        });
        assert.equal(result.status, 201);
        assert.equal(result.body.data.user.role, 'student');
        assert.equal(result.body.data.user.emailVerified, false);
        const row = (await db.query('SELECT role, email_verified_at FROM users WHERE id = $1', [result.body.data.user.id])).rows[0];
        assert.equal(row.role, 'student');
        assert.equal(row.email_verified_at, null);
        assert.equal((await client.get('/api/v1/admin/consultations')).status, 403);
    });

    test('13. a student cannot set protected fields on their appointment', async () => {
        const client = agent();
        await signUpStudent(client);
        await client.get('/api/v1/auth/session');
        const created = await client.post('/api/v1/consultations', {
            ...guestBooking(), fullName: undefined, email: undefined,
            status: 'completed', counsellorId: counsellorB.id, price: 0, meetingUrl: 'https://evil.example/meet', calendarStatus: 'synced',
            paymentStatus: 'paid', paymentId: 'forged-payment-id', paid: true,
        });
        assert.equal(created.status, 201);
        const consultation = created.body.data.consultation;
        assert.ok(!('paymentStatus' in consultation));
        assert.ok(!('paymentId' in consultation));
        assert.ok(!('paid' in consultation));
        const row = (await db.query('SELECT status, meeting_url, calendar_status FROM consultations WHERE id = $1', [created.body.data.consultation.id])).rows[0];
        assert.equal(row.status, 'confirmed');
        assert.equal(row.meeting_url, null);
        assert.equal(row.calendar_status, 'not_required');
        const patch = await client.patch(`/api/v1/admin/consultations/${created.body.data.consultation.id}`, { status: 'completed' });
        assert.equal(patch.status, 403);
        const after = (await db.query('SELECT status FROM consultations WHERE id = $1', [created.body.data.consultation.id])).rows[0];
        assert.equal(after.status, 'confirmed');
    });

    test('14. unauthenticated users and students cannot use admin endpoints', async () => {
        const anonymous = [
            ['GET', '/api/v1/admin/consultations'], ['GET', '/api/v1/admin/consultations/summary'],
            ['GET', '/api/v1/admin/availability'], ['POST', '/api/v1/admin/availability'],
            ['GET', '/api/v1/admin/notifications'], ['GET', '/api/v1/me/consultations'],
        ];
        for (const [method, path] of anonymous) {
            const result = await request(method, path, method === 'POST' ? { body: {} } : {});
            assert.equal(result.status, 401, `${method} ${path}`);
        }
        const student = agent();
        await signUpStudent(student);
        await student.get('/api/v1/auth/session');
        for (const path of ['/api/v1/admin/consultations', '/api/v1/admin/counsellors', '/api/v1/admin/notifications']) {
            assert.equal((await student.get(path)).status, 403, path);
        }
        assert.equal((await student.post('/api/v1/admin/availability', { kind: 'rule' })).status, 403);
        // Lead listing still uses its own admin token and is unchanged.
        assert.equal((await request('GET', '/api/v1/leads', { cookie: student.state.cookie })).status, 401);
    });

    test('15. a counsellor only reaches consultations and availability they are assigned', async () => {
        const booking = (await request('POST', '/api/v1/consultations', { body: guestBooking() })).body.data.consultation;
        const assigned = (await db.query('SELECT counsellor_id FROM consultations WHERE id = $1', [booking.id])).rows[0].counsellor_id;
        const owner = assigned === counsellorA.id ? counsellorA : counsellorB;
        const outsider = assigned === counsellorA.id ? counsellorB : counsellorA;
        const ownerClient = await staffAgent(owner);
        const outsiderClient = await staffAgent(outsider);

        assert.equal((await ownerClient.get(`/api/v1/admin/consultations/${booking.id}`)).status, 200);
        assert.equal((await outsiderClient.get(`/api/v1/admin/consultations/${booking.id}`)).status, 404);
        assert.equal((await outsiderClient.patch(`/api/v1/admin/consultations/${booking.id}`, { status: 'cancelled' })).status, 404);
        assert.equal((await outsiderClient.post(`/api/v1/admin/consultations/${booking.id}/notes`, { kind: 'note', body: 'x' })).status, 404);
        assert.equal((await outsiderClient.get('/api/v1/admin/consultations')).body.data.total, 0);
        assert.equal((await ownerClient.get('/api/v1/admin/consultations')).body.data.total, 1);

        const reassign = await ownerClient.patch(`/api/v1/admin/consultations/${booking.id}`, { counsellorId: outsider.id });
        assert.equal(reassign.status, 403, 'only admins reassign');
        const othersRules = await outsiderClient.get(`/api/v1/admin/availability?counsellor_id=${owner.id}`);
        assert.equal(othersRules.status, 403);
        const ownRuleIds = (await db.query('SELECT id FROM availability_rules WHERE counsellor_id = $1 LIMIT 1', [owner.id])).rows[0].id;
        assert.equal((await outsiderClient.delete(`/api/v1/admin/availability/rule/${ownRuleIds}`)).status, 404);
        assert.equal((await outsiderClient.get('/api/v1/admin/notifications')).status, 403, 'notification log is admin-only');

    });

    test('students never receive private notes', async () => {
        const created = (await request('POST', '/api/v1/consultations', { body: guestBooking() })).body.data;
        const admin = await createStaff({ role: 'admin', name: 'Admin' });
        const adminClient = await staffAgent(admin);
        const note = await adminClient.post(`/api/v1/admin/consultations/${created.consultation.id}/notes`, { kind: 'note', body: 'PRIVATE-NOTE-MARKER' });
        assert.equal(note.status, 201);
        const view = await request('POST', '/api/v1/consultations/manage/lookup', { body: { token: created.manageToken } });
        assert.equal(view.status, 200);
        assert.ok(!JSON.stringify(view.body).includes('PRIVATE-NOTE-MARKER'));
        assert.ok(!('notes' in view.body.data) && !('history' in view.body.data) && !('lead' in view.body.data));
    });
});

describe('credentials, sessions and CSRF', () => {
    test('16. invalid, expired and revoked credentials are rejected', async () => {
        assert.equal((await request('GET', '/api/v1/me/consultations', { cookie: 'gm_session=forged-token-value' })).status, 401);
        const staff = await createStaff();
        assert.equal((await request('POST', '/api/v1/auth/login', { body: { email: staff.email, password: 'wrong-password' } })).status, 401);
        assert.equal((await request('POST', '/api/v1/auth/login', { body: { email: 'nobody@example.com', password: 'whatever-123' } })).status, 401);

        const client = agent();
        await signUpStudent(client);
        await client.get('/api/v1/auth/session');
        assert.equal((await client.get('/api/v1/me/consultations')).status, 200);
        assert.equal((await client.post('/api/v1/auth/logout', {})).status, 200);
        // Logout cleared our cookie; replay the old one to prove the server revoked it.
        const replay = await request('GET', '/api/v1/me/consultations', { cookie: client.state.cookie });
        assert.equal(replay.status, 401);

        const second = agent();
        await signUpStudent(second);
        await setNow(new Date(BASE_NOW.getTime() + 8 * 24 * 3600_000)); // past the 7-day session lifetime
        assert.equal((await second.get('/api/v1/me/consultations')).status, 401);
    });

    test('repeated wrong passwords lock the account for a while', async () => {
        const staff = await createStaff();
        for (let i = 0; i < 10; i += 1) await request('POST', '/api/v1/auth/login', { body: { email: staff.email, password: `wrong-${i}` } });
        const locked = await request('POST', '/api/v1/auth/login', { body: { email: staff.email, password: staff.password } });
        assert.equal(locked.status, 429);
        await setNow(new Date(BASE_NOW.getTime() + 16 * 60_000));
        assert.equal((await request('POST', '/api/v1/auth/login', { body: { email: staff.email, password: staff.password } })).status, 200);
    });

    test('state-changing requests need the CSRF token and an allowed origin', async () => {
        const { client, consultation } = await studentWithBooking();
        const noToken = await client.post(`/api/v1/me/consultations/${consultation.id}/cancel`, {}, { csrf: 'not-the-token' });
        assert.equal(noToken.status, 403);
        assert.equal(noToken.body.code, 'CSRF_FAILED');
        const foreign = await request('POST', `/api/v1/me/consultations/${consultation.id}/cancel`, { body: {}, cookie: client.state.cookie, csrf: client.state.csrf, origin: 'https://evil.example' });
        assert.equal(foreign.status, 403);
        assert.equal((await request('POST', '/api/v1/consultations', { body: guestBooking(), origin: 'https://evil.example' })).status, 403);
        const ok = await client.post(`/api/v1/me/consultations/${consultation.id}/cancel`, {});
        assert.equal(ok.status, 200);
    });

    test('session cookie is HttpOnly and passwords are stored as scrypt hashes', async () => {
        const client = agent();
        const result = await client.post('/api/v1/auth/signup', { firstName: 'Hash', email: `hash.${process.pid}@example.com`, password: 'plain-text-pass', ageConfirmation: true });
        assert.match(result.setCookie, /HttpOnly/);
        assert.match(result.setCookie, /SameSite=Lax/);
        const row = (await db.query('SELECT password_hash FROM users WHERE id = $1', [result.body.data.user.id])).rows[0];
        assert.match(row.password_hash, /^scrypt\$/);
        assert.ok(!row.password_hash.includes('plain-text-pass'));
        const sessions = (await db.query('SELECT token_hash FROM sessions WHERE user_id = $1', [result.body.data.user.id])).rows;
        assert.ok(!result.setCookie.includes(sessions[0].token_hash), 'only the token hash is stored');
    });

    test('public endpoints are rate limited per client', async () => {
        delete process.env.RATE_LIMIT_DISABLED;
        try {
            const statuses = [];
            for (let i = 0; i < 12; i += 1) {
                statuses.push((await request('POST', '/api/v1/auth/login', { body: { email: 'flood@example.com', password: `guess-${i}` } })).status);
            }
            assert.deepEqual(statuses.slice(0, 10), Array(10).fill(401));
            assert.deepEqual(statuses.slice(10), [429, 429]);
            const limited = await request('POST', '/api/v1/auth/login', { body: { email: 'flood@example.com', password: 'x-123456' } });
            assert.ok(Number(limited.headers.get('retry-after')) > 0);
            const stored = (await db.query('SELECT bucket FROM rate_limits LIMIT 1')).rows[0].bucket;
            assert.ok(!stored.includes('flood') && !stored.includes('127.0.0.1'), 'keys are HMACs, not raw IPs or emails');
        } finally {
            process.env.RATE_LIMIT_DISABLED = 'true';
        }
    });

    test('the jobs endpoint requires the cron secret', async () => {
        assert.equal((await request('GET', '/api/v1/internal/jobs/run')).status, 401);
        assert.equal((await request('GET', '/api/v1/internal/jobs/run', { headers: { Authorization: 'Bearer nope' } })).status, 401);
        assert.equal((await request('GET', '/api/v1/internal/jobs/run', { headers: { Authorization: 'Bearer test-cron-secret' } })).status, 200);
    });
});
