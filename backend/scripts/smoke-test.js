/* Post-deploy smoke test against a running API. Read-only by default.
   Usage:
     API_URL=https://api.gradmire.in SITE_ORIGIN=https://gradmire.in npm run smoke
     ... CRON_SECRET=… npm run smoke                 also runs one worker pass
     ... npm run smoke -- --book you@yourdomain.com  also books a guest test slot and cancels it
   Exits non-zero if any check fails. Prints no secrets. */
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { book: { type: 'string' } } });
const api = (process.env.API_URL || 'http://localhost:4000').replace(/\/+$/, '');
const origin = process.env.SITE_ORIGIN || 'http://localhost:8080';
let failures = 0;

async function call(method, path, { body, headers = {} } = {}) {
    const response = await fetch(`${api}${path}`, {
        method,
        headers: { Origin: origin, ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20_000),
    });
    const json = await response.json().catch(() => ({}));
    return { status: response.status, headers: response.headers, json };
}

async function check(label, fn) {
    try {
        const detail = await fn();
        console.log(`  ok    ${label}${detail ? ` — ${detail}` : ''}`);
    } catch (error) {
        failures += 1;
        console.log(`  FAIL  ${label} — ${error.message}`);
    }
}
const expect = (condition, message) => {
    if (!condition) throw new Error(message);
};

console.log(`Smoke test: ${api} (site origin ${origin})`);

await check('health', async () => {
    const r = await call('GET', '/api/v1/health');
    expect(r.status === 200 && r.json.status === 'ok', `status ${r.status}`);
});

await check('CORS allows the site with credentials', async () => {
    const r = await call('GET', '/api/v1/health');
    expect(r.headers.get('access-control-allow-origin') === origin, 'site origin missing from FRONTEND_ORIGIN');
    expect(r.headers.get('access-control-allow-credentials') === 'true', 'credentials not allowed');
});

let types = [];
await check('database and migrations (consultation types)', async () => {
    const r = await call('GET', '/api/v1/consultation-types');
    expect(r.status === 200, `status ${r.status}: ${r.json.error || ''}`);
    types = r.json.data;
    expect(types.length > 0, 'no active consultation types');
    return `${types.length} active types`;
});

let slot = null;
await check('availability (at least one counsellor with hours)', async () => {
    for (let day = 1; day <= 14 && !slot; day += 1) {
        const date = new Date(Date.now() + day * 86400000).toISOString().slice(0, 10);
        const r = await call('GET', `/api/v1/availability?consultation_type_id=${types[0].id}&date=${date}&timezone=Asia/Kolkata`);
        expect(r.status === 200, `status ${r.status}: ${r.json.error || ''}`);
        if (r.json.data.slots.length) slot = r.json.data.slots.at(-1);
    }
    expect(slot, 'no slots in the next 14 days: create a counsellor with npm run create-staff');
    return `next test slot ${slot.start}`;
});

await check('session endpoint and cookie settings', async () => {
    const r = await call('GET', '/api/v1/auth/session');
    expect(r.status === 200 && r.json.data.user === null, `status ${r.status}`);
});

await check('Google sign-in configuration', async () => {
    const r = await call('GET', '/api/v1/auth/google/config');
    expect(r.status === 200, `status ${r.status}`);
    return r.json.data.enabled ? 'enabled' : 'not configured (GOOGLE_CLIENT_ID unset) — email login only';
});

await check('cross-site requests are blocked', async () => {
    const response = await fetch(`${api}/api/v1/auth/login`, {
        method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'x@example.com', password: 'x-123456' }), signal: AbortSignal.timeout(20_000),
    });
    expect(response.status === 403, `expected 403, got ${response.status}`);
});

if (process.env.CRON_SECRET) {
    await check('worker pass (CRON_SECRET)', async () => {
        const r = await call('GET', '/api/v1/internal/jobs/run', { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
        expect(r.status === 200, `status ${r.status}`);
        const n = r.json.data.notifications;
        return `notifications sent ${n.sent}, failed ${n.failed}, skipped ${n.skipped}${n.skipped ? ' (email provider not configured?)' : ''}`;
    });
} else {
    console.log('  skip  worker pass (set CRON_SECRET to include it)');
}

if (values.book) {
    await check(`guest booking round trip (${values.book})`, async () => {
        expect(slot, 'no slot to book');
        const created = await call('POST', '/api/v1/consultations', {
            headers: { 'Idempotency-Key': `smoke-${Date.now()}` },
            body: {
                consultationTypeId: types[0].id, meetingMethod: types[0].meetingMethods[0], start: slot.start, timezone: 'Asia/Kolkata',
                fullName: 'Smoke Test', email: values.book, phone: '+910000000000', contactConsent: true, remindersOptIn: false,
                message: 'Automated smoke test, cancelled immediately.',
            },
        });
        expect(created.status === 201, `booking failed: ${created.status} ${created.json.error || ''}`);
        const { consultation, manageToken } = created.json.data;
        const cancelled = await call('POST', '/api/v1/consultations/manage/cancel', { body: { token: manageToken, reason: 'Smoke test' } });
        expect(cancelled.status === 200 && cancelled.json.data.status === 'cancelled', `cancel failed: ${cancelled.status}`);
        return `${consultation.reference} was ${consultation.status}, then cancelled (check the inbox of ${values.book})`;
    });
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
