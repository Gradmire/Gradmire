/* Sign in with Google, password reset and data retention. */
import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync } from 'node:crypto';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
    agent, BASE_NOW, createStaff, db, deactivateCounsellors, fakeEmail, guestBooking, request, runJobs, setNow,
    signUpStudent, startHarness, stopHarness, useProviders,
} from './helpers/harness.js';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-kid', alg: 'RS256', use: 'sig' };
const { privateKey: otherKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

let email;
before(async () => {
    process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
    await startHarness();
    (await import('../src/integrations/google-identity.js')).setGoogleKeysFetcher(async () => ({ keys: [jwk] }));
});
after(stopHarness);
beforeEach(async () => {
    await setNow(BASE_NOW);
    email = fakeEmail();
    await useProviders({ email });
});

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
function googleToken(claims = {}, { key = privateKey, kid = 'test-kid', alg = 'RS256' } = {}) {
    const iat = Math.floor(BASE_NOW.getTime() / 1000);
    const head = b64({ alg, kid, typ: 'JWT' });
    const body = b64({ iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: 'google-sub-1', email: 'g.user@example.com', email_verified: true, given_name: 'Gita', family_name: 'Rao', iat, exp: iat + 3600, ...claims });
    const signer = createSign('RSA-SHA256');
    signer.update(`${head}.${body}`);
    return `${head}.${body}.${signer.sign(key).toString('base64url')}`;
}
const googleLogin = (client, credential, extra = {}) => client.post('/api/v1/auth/google', { credential, ...extra });
let counter = 0;
const uniq = (prefix) => `${prefix}${++counter}.${process.pid}@example.com`;

describe('Sign in with Google', () => {
    test('config endpoint reports the public client id only', async () => {
        const result = await request('GET', '/api/v1/auth/google/config');
        assert.deepEqual(result.body.data, { enabled: true, clientId: CLIENT_ID });
    });

    test('a new Google user needs age confirmation, then gets a verified student account', async () => {
        const address = uniq('new');
        const client = agent();
        const first = await googleLogin(client, googleToken({ sub: 'sub-new', email: address }));
        assert.equal(first.status, 409);
        assert.equal(first.body.code, 'GOOGLE_SIGNUP_NEEDS_CONSENT');
        const second = await googleLogin(client, googleToken({ sub: 'sub-new', email: address }), { ageConfirmation: true, role: 'admin' });
        assert.equal(second.status, 201, JSON.stringify(second.body));
        assert.equal(second.body.data.user.role, 'student', 'role cannot be chosen by the client');
        assert.equal(second.body.data.user.emailVerified, true);
        assert.match(second.setCookie, /HttpOnly/);
        const row = (await db.query('SELECT google_sub, password_hash, first_name FROM users WHERE id = $1', [second.body.data.user.id])).rows[0];
        assert.deepEqual(row, { google_sub: 'sub-new', password_hash: null, first_name: 'Gita' });
        // Same Google identity logs straight in next time, without consent prompts.
        const again = await googleLogin(agent(), googleToken({ sub: 'sub-new', email: address }));
        assert.equal(again.status, 200);
        assert.equal(again.body.data.user.id, second.body.data.user.id);
        // Google-only accounts cannot be logged into with a guessed password.
        assert.equal((await request('POST', '/api/v1/auth/login', { body: { email: address, password: 'anything-at-all' } })).status, 401);
    });

    test('links to an existing verified account and keeps its password', async () => {
        const staff = await createStaff({ name: 'Linked Staff' });
        const result = await googleLogin(agent(), googleToken({ sub: 'sub-staff', email: staff.email }));
        assert.equal(result.status, 200);
        assert.equal(result.body.data.user.role, 'counsellor');
        assert.equal((await request('POST', '/api/v1/auth/login', { body: { email: staff.email, password: staff.password } })).status, 200);
    });

    test('taking over an unverified account revokes the squatter\'s password and sessions', async () => {
        const squatter = agent();
        const profile = await signUpStudent(squatter, { email: uniq('squat') });
        await squatter.get('/api/v1/auth/session');
        assert.equal((await squatter.get('/api/v1/me/consultations')).status, 200);
        const owner = await googleLogin(agent(), googleToken({ sub: 'sub-owner', email: profile.email }));
        assert.equal(owner.status, 200);
        assert.equal(owner.body.data.user.id, profile.id);
        assert.equal((await squatter.get('/api/v1/me/consultations')).status, 401, 'old session revoked');
        assert.equal((await request('POST', '/api/v1/auth/login', { body: { email: profile.email, password: profile.password } })).status, 401, 'old password removed');
    });

    test('a Google sign-in links guest bookings made with that email', async () => {
        await deactivateCounsellors();
        await createStaff();
        const address = uniq('guestg');
        const booked = await request('POST', '/api/v1/consultations', { body: guestBooking({ email: address }) });
        assert.equal(booked.status, 201);
        const client = agent();
        await googleLogin(client, googleToken({ sub: 'sub-guest', email: address }), { ageConfirmation: true });
        await client.get('/api/v1/auth/session');
        const mine = await client.get('/api/v1/me/consultations');
        assert.deepEqual(mine.body.data.map((c) => c.id), [booked.body.data.consultation.id]);
    });

    test('forged, expired, foreign and unverified tokens are rejected', async () => {
        const cases = [
            ['signed with another key', googleToken({}, { key: otherKey })],
            ['unknown key id', googleToken({}, { kid: 'nope' })],
            ['wrong audience', googleToken({ aud: 'someone-else.apps.googleusercontent.com' })],
            ['wrong issuer', googleToken({ iss: 'https://evil.example' })],
            ['expired', googleToken({ exp: Math.floor(BASE_NOW.getTime() / 1000) - 3600 })],
            ['unverified email', googleToken({ email_verified: false })],
            ['alg none', `${b64({ alg: 'none', kid: 'test-kid' })}.${b64({ sub: 'x' })}.`],
            ['garbage', 'not-a-jwt'],
        ];
        for (const [label, token] of cases) {
            const result = await googleLogin(agent(), token, { ageConfirmation: true });
            assert.equal(result.status, 401, label);
            assert.equal(result.body.code, 'GOOGLE_TOKEN_INVALID', label);
        }
    });

    test('Google sign-in is refused when no client id is configured', async () => {
        const saved = process.env.GOOGLE_CLIENT_ID;
        delete process.env.GOOGLE_CLIENT_ID;
        try {
            assert.equal((await request('GET', '/api/v1/auth/google/config')).body.data.enabled, false);
            assert.equal((await googleLogin(agent(), googleToken())).status, 503);
        } finally {
            process.env.GOOGLE_CLIENT_ID = saved;
        }
    });
});

describe('Password reset', () => {
    async function resetLink(address) {
        await request('POST', '/api/v1/auth/password-reset/request', { body: { email: address } });
        await runJobs();
        const message = email.sent.filter((m) => m.to === address && m.subject.startsWith('Reset')).at(-1);
        return message && decodeURIComponent(/reset-password\.html#token=([^\s"]+)/.exec(message.text)[1]);
    }

    test('request → email → new password; sessions are signed out and the link works once', async () => {
        const client = agent();
        const profile = await signUpStudent(client, { email: uniq('reset') });
        await client.get('/api/v1/auth/session');
        const token = await resetLink(profile.email);
        assert.ok(token, 'reset email sent with a link');
        const done = await request('POST', '/api/v1/auth/password-reset/confirm', { body: { token, password: 'brand-new-pass-1' } });
        assert.equal(done.status, 200, JSON.stringify(done.body));
        assert.equal((await client.get('/api/v1/me/consultations')).status, 401, 'existing sessions revoked');
        assert.equal((await request('POST', '/api/v1/auth/login', { body: { email: profile.email, password: profile.password } })).status, 401);
        assert.equal((await request('POST', '/api/v1/auth/login', { body: { email: profile.email, password: 'brand-new-pass-1' } })).status, 200);
        assert.equal((await request('POST', '/api/v1/auth/password-reset/confirm', { body: { token, password: 'another-pass-22' } })).status, 400, 'single use');
        await runJobs();
        assert.ok(email.sent.some((m) => m.to === profile.email && m.subject === 'Your Gradmire password was changed'));
        const verified = (await db.query('SELECT email_verified_at FROM users WHERE id = $1', [profile.id])).rows[0].email_verified_at;
        assert.ok(verified, 'opening the emailed link verifies the address');
    });

    test('the response never reveals whether an account exists', async () => {
        const known = await signUpStudent(agent(), { email: uniq('known') });
        const a = await request('POST', '/api/v1/auth/password-reset/request', { body: { email: known.email } });
        const b = await request('POST', '/api/v1/auth/password-reset/request', { body: { email: uniq('nobody') } });
        assert.equal(a.status, b.status);
        assert.deepEqual(a.body, b.body);
    });

    test('expired and superseded links are rejected, and weak passwords refused', async () => {
        const profile = await signUpStudent(agent(), { email: uniq('expire') });
        const first = await resetLink(profile.email);
        const second = await resetLink(profile.email);
        assert.equal((await request('POST', '/api/v1/auth/password-reset/confirm', { body: { token: first, password: 'new-password-123' } })).status, 400, 'older link replaced');
        assert.equal((await request('POST', '/api/v1/auth/password-reset/confirm', { body: { token: second, password: 'short' } })).status, 400, 'password rules apply');
        await setNow(new Date(BASE_NOW.getTime() + 61 * 60_000));
        assert.equal((await request('POST', '/api/v1/auth/password-reset/confirm', { body: { token: second, password: 'new-password-123' } })).status, 400, 'expired after an hour');
    });

    test('a Google-only account can add a password through reset', async () => {
        const address = uniq('gpass');
        await googleLogin(agent(), googleToken({ sub: 'sub-gpass', email: address }), { ageConfirmation: true });
        const token = await resetLink(address);
        assert.equal((await request('POST', '/api/v1/auth/password-reset/confirm', { body: { token, password: 'my-first-password' } })).status, 200);
        assert.equal((await request('POST', '/api/v1/auth/login', { body: { email: address, password: 'my-first-password' } })).status, 200);
    });
});

describe('Data retention', () => {
    test('anonymises old guest bookings and leads only when enabled, and keeps account-owned records', async () => {
        await deactivateCounsellors();
        await createStaff();
        const guest = (await request('POST', '/api/v1/consultations', { body: guestBooking({ email: uniq('old'), message: 'Private plans' }) })).body.data;
        const student = agent();
        await signUpStudent(student);
        await student.get('/api/v1/auth/session');
        const owned = (await student.post('/api/v1/consultations', { ...guestBooking({ start: '2026-11-03T08:00:00.000Z' }), fullName: undefined, email: undefined })).body.data.consultation;
        const upcoming = (await request('POST', '/api/v1/consultations', { body: guestBooking({ email: uniq('soon'), start: '2026-11-03T10:00:00.000Z' }) })).body.data.consultation;
        await request('POST', '/api/v1/consultations/manage/cancel', { body: { token: guest.manageToken } });
        await db.query("UPDATE consultations SET status = 'completed' WHERE id = $1", [owned.id]);
        await db.query("UPDATE leads SET created_at = NOW() - INTERVAL '3 years', updated_at = NOW() - INTERVAL '3 years' WHERE id = (SELECT lead_id FROM consultations WHERE id = $1)", [guest.consultation.id]);

        await setNow(new Date('2029-01-01T00:00:00Z')); // > 24 months later
        const admin = await createStaff({ role: 'admin', name: 'Admin' });
        const adminClient = agent();
        await adminClient.login(admin.email, admin.password);
        const preview = await adminClient.get('/api/v1/admin/retention');
        assert.equal(preview.status, 200);
        assert.equal(preview.body.data.enabled, false);
        assert.ok(preview.body.data.consultationsDue >= 1);

        assert.equal((await runJobs()).retention.enabled, false, 'off by default');
        assert.notEqual((await db.query('SELECT student_name FROM consultations WHERE id = $1', [guest.consultation.id])).rows[0].student_name, 'Anonymised');

        process.env.RETENTION_ENABLED = 'true';
        try {
            const totals = (await runJobs()).retention;
            assert.ok(totals.consultations >= 1);
        } finally {
            delete process.env.RETENTION_ENABLED;
        }
        const old = (await db.query('SELECT * FROM consultations WHERE id = $1', [guest.consultation.id])).rows[0];
        assert.equal(old.student_name, 'Anonymised');
        assert.match(old.student_email, /^anonymised\+.*@invalid$/);
        assert.equal(old.message, null);
        assert.equal(old.manage_token_hash, null);
        assert.ok(old.anonymised_at);
        assert.equal((await request('POST', '/api/v1/consultations/manage/lookup', { body: { token: guest.manageToken } })).status, 404, 'old link stops working');
        const lead = (await db.query('SELECT first_name, email, phone FROM leads WHERE id = $1', [old.lead_id])).rows[0];
        assert.equal(lead.first_name, 'Anonymised');
        assert.equal(lead.phone, null);
        assert.notEqual((await db.query('SELECT student_name FROM consultations WHERE id = $1', [owned.id])).rows[0].student_name, 'Anonymised', 'account-owned history kept');
        assert.ok(upcoming.id);
        assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM audit_log WHERE action = 'retention.anonymised'")).rows[0].n >= 1, true);
        assert.equal((await request('GET', '/api/v1/admin/retention')).status, 401, 'preview is admin-only');
    });
});
