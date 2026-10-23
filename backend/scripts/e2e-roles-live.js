/* End-to-end test of how people get staff access on the deployed site:
     1. a student applies, is interviewed and hired, accepts the invitation from
        the dashboard and is activated as a consultant by a second admin;
     2. a new person is invited as an administrator, accepts with the email
        link and is activated by a super admin;
     3. the consultant from (1) is promoted to administrator by role change.
   It also checks the two-person rule (a requester cannot approve their own
   request) and that each role reaches only its own workspace.

   Two temporary super admins are created with create-staff, because every
   approval needs someone other than the requester. Every account uses
   e2e-…@example.com and is deleted at the end, with everything it created
   (applications, invitations, approvals, outbox emails). Audit log rows stay.
   Email addresses cannot be verified by clicking a link, so the script marks
   them verified in the database.

   Usage (from backend/):
     DATABASE_URL=… APP_SECRET=… node scripts/e2e-roles-live.js
     SITE_URL defaults to https://gradmire-1nfj.vercel.app; API_URL defaults to
     SITE_URL/gm-api (set it to http://localhost:4000 for a local API).
   APP_SECRET must match the API's, so the script can build the invitation
   link the way the email does. Prints no secrets. */
import { spawnSync } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import pg from 'pg';

const site = (process.env.SITE_URL || 'https://gradmire-1nfj.vercel.app').replace(/\/+$/, '');
const api = (process.env.API_URL || `${site}/gm-api`).replace(/\/+$/, '');
const { DATABASE_URL, APP_SECRET } = process.env;
if (!DATABASE_URL || !APP_SECRET) {
    console.error('Set DATABASE_URL and APP_SECRET.');
    process.exit(2);
}

const stamp = Date.now();
const account = (label) => ({ email: `e2e-${label}-${stamp}@example.com`, password: `E2e-${randomBytes(12).toString('base64url')}` });
const adminA = account('admin-a');
const adminB = account('admin-b');
const student = account('student');
const invitee = account('invitee');
/* Retries a request that never got a response (DNS or connection failure, seen
   intermittently from developer machines). Every write here is safe to repeat:
   a repeat either succeeds or is refused as a conflict, which the step reports. */
async function fetchWithRetry(url, options) {
    for (let attempt = 1; ; attempt += 1) {
        try {
            return await fetch(url, { ...options, signal: AbortSignal.timeout(30_000) });
        } catch (error) {
            if (attempt >= 3) throw new Error(`${options.method || 'GET'} ${url.replace(api, '')} → network error (${error.cause?.code || error.message})`);
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
    }
}

const invitationToken = (id) => createHmac('sha256', APP_SECRET).update(`invite:${id}`).digest('base64url');
let failures = 0;

class Client {
    constructor(label) {
        this.label = label;
        this.cookie = '';
        this.csrf = null;
    }

    async call(method, path, body) {
        const response = await fetchWithRetry(`${api}${path}`, {
            method,
            redirect: 'manual',
            headers: {
                Origin: site,
                ...(this.cookie ? { Cookie: this.cookie } : {}),
                ...(this.csrf && method !== 'GET' ? { 'X-CSRF-Token': this.csrf } : {}),
                ...(body ? { 'Content-Type': 'application/json' } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
            const pair = setCookie.split(';')[0];
            this.cookie = pair.endsWith('=') ? '' : pair;
        }
        const json = await response.json().catch(() => ({}));
        if (json?.data?.csrfToken !== undefined) this.csrf = json.data.csrfToken;
        return { status: response.status, json };
    }

    async ok(method, path, body, expected = [200, 201]) {
        const r = await this.call(method, path, body);
        if (r.status === 429) throw new Error(`${method} ${path} → 429 rate limited (signups: 6 per IP per hour; wait for the next full hour)`);
        if (!expected.includes(r.status)) throw new Error(`${method} ${path} → ${r.status} ${r.json.error || r.json.code || ''}`.trim());
        return r.json.data;
    }

    async denied(method, path, body) {
        const r = await this.call(method, path, body);
        if (![401, 403].includes(r.status)) throw new Error(`${method} ${path} should be refused, got ${r.status}`);
        return r.status;
    }

    async login({ email, password }) {
        this.cookie = '';
        this.csrf = null;
        return (await this.ok('POST', '/api/v1/auth/login', { email, password })).user;
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

async function withDb(fn) {
    const db = new pg.Client({ connectionString: DATABASE_URL });
    await db.connect();
    try {
        return await fn(db);
    } finally {
        await db.end();
    }
}
const roleOf = (email) => withDb(async (db) => (await db.query('SELECT role FROM users WHERE email = $1', [email])).rows[0]?.role);
const verifyEmail = (email) => withDb((db) => db.query('UPDATE users SET email_verified_at = NOW() WHERE email = $1', [email]));

function createSuperAdmin(who, lastName) {
    // A network error (seen: an intermittent DNS failure for the database host) happens before
    // create-staff opens its transaction, so retrying it cannot leave a half-made account.
    for (let attempt = 1; ; attempt += 1) {
        const result = spawnSync(process.execPath, ['scripts/create-staff.js', '--email', who.email, '--first-name', 'E2E',
            '--last-name', lastName, '--role', 'super_admin', '--no-default-hours'],
        { env: { ...process.env, STAFF_PASSWORD: who.password, NODE_NO_WARNINGS: '1' }, encoding: 'utf8' });
        if (result.status === 0) return;
        const output = (result.stderr || result.stdout).trim().split('\n');
        const error = output.find((line) => /error|failed/i.test(line)) || output.pop();
        if (attempt >= 3 || !/ENOTFOUND|EAI_AGAIN|ECONNRESET|ETIMEDOUT|ECONNREFUSED/.test(error)) throw new Error(error);
    }
}

async function signUp(client, who, lastName) {
    const data = await client.ok('POST', '/api/v1/auth/signup', { firstName: 'E2E', lastName, email: who.email, password: who.password, ageConfirmation: true });
    expect(data.user.role === 'student', `role ${data.user.role}`);
    await verifyEmail(who.email);
    return data.user.id;
}

async function pendingApprovalFor(client, targetId, type) {
    const list = await client.ok('GET', `/api/v1/admin/approvals?status=pending&type=${type}&page_size=100`);
    const request = list.items.find((r) => r.target.id === targetId);
    expect(request, `no pending ${type} request for the target`);
    return request;
}

async function cleanup() {
    return withDb(async (db) => {
        await db.query('BEGIN');
        try {
            const users = (await db.query("SELECT id FROM users WHERE email LIKE 'e2e-%@example.com'")).rows.map((r) => r.id);
            const consultations = (await db.query(
                "SELECT id, lead_id FROM consultations WHERE student_user_id = ANY($1) OR counsellor_id = ANY($1) OR LOWER(student_email) LIKE 'e2e-%@example.com'",
                [users],
            )).rows;
            const ids = consultations.map((r) => r.id);
            const leads = consultations.map((r) => r.lead_id).filter(Boolean);
            const approvals = await db.query('DELETE FROM approval_requests WHERE target_user_id = ANY($1) OR requested_by = ANY($1) OR decided_by = ANY($1)', [users]);
            await db.query('DELETE FROM employee_profiles WHERE user_id = ANY($1)', [users]);
            const invitations = await db.query(
                "DELETE FROM employee_invitations WHERE created_by = ANY($1) OR accepted_user_id = ANY($1) OR LOWER(email) LIKE 'e2e-%@example.com'",
                [users],
            );
            const applications = await db.query('DELETE FROM consultant_applications WHERE user_id = ANY($1)', [users]);
            await db.query('UPDATE consultations SET rescheduled_from_id = NULL WHERE rescheduled_from_id = ANY($1)', [ids]);
            await db.query('DELETE FROM follow_up_tasks WHERE consultation_id = ANY($1) OR assignee_user_id = ANY($2) OR student_user_id = ANY($2)', [ids, users]);
            await db.query('DELETE FROM consultations WHERE id = ANY($1)', [ids]);
            await db.query("DELETE FROM leads WHERE id = ANY($1) OR LOWER(email) LIKE 'e2e-%@example.com'", [leads]);
            // Unsent emails to the test addresses would only bounce.
            const outbox = await db.query("DELETE FROM notifications WHERE LOWER(recipient) LIKE 'e2e-%@example.com' OR user_id = ANY($1)", [users]);
            // Real admins are told about the test applicant and requests; those inbox items go too.
            const inbox = await db.query("DELETE FROM user_notifications WHERE created_at >= $1 AND (title LIKE '%E2E %' OR body LIKE '%E2E %')", [new Date(stamp)]);
            await db.query('DELETE FROM users WHERE id = ANY($1)', [users]);
            await db.query('COMMIT');
            return `${users.length} accounts, ${applications.rowCount} applications, ${invitations.rowCount} invitations, `
                + `${approvals.rowCount} approvals, ${outbox.rowCount} outbox emails, ${inbox.rowCount} inbox items removed`;
        } catch (error) {
            await db.query('ROLLBACK');
            throw error;
        }
    });
}

console.log(`Staff access end-to-end test: ${site} (API ${api})\n`);

const a = new Client('admin A');
const b = new Client('admin B');
const s = new Client('student');
const n = new Client('invitee');
const ids = {};

// Stop before creating anything if the deployed API predates the flows under test.
const probe = await fetchWithRetry(`${api}/api/v1/me/employee-invitations/pending`, { headers: { Origin: site } });
if (probe.status === 404) {
    console.error('The deployed API has no /api/v1/me/employee-invitations/pending route; redeploy the backend first. Nothing was created.');
    process.exit(2);
}

try {
    console.log('Setup');
    await step('two temporary super admins', async () => {
        createSuperAdmin(adminA, 'Admin A');
        createSuperAdmin(adminB, 'Admin B');
        ids.a = (await a.login(adminA)).id;
        ids.b = (await b.login(adminB)).id;
    });

    console.log('\n1. Student → Consultant');
    let application = null;
    await step('student signs up (email marked verified)', async () => {
        ids.student = await signUp(s, student, 'Student');
    });
    await step('student is kept out of staff workspaces', async () => {
        await s.denied('GET', '/api/v1/consultant/dashboard');
        await s.denied('GET', '/api/v1/admin/consultant-applications');
    });
    await step('student applies to become a consultant', async () => {
        application = await s.ok('POST', '/api/v1/me/consultant-applications', {
            fullName: 'E2E Student', phone: '+919000000001', location: 'Delhi, India', yearsExperience: 3,
            professionalExperience: 'Automated end-to-end test applicant; deleted afterwards.', education: 'MSc, test university',
            availability: 'part_time', languages: ['English', 'Hindi'], expertise: ['UK'], consent: true,
        });
        expect(application?.id, 'no application returned');
        return application.status;
    });
    for (const [to, extra] of [
        ['under_review', {}],
        ['shortlisted', {}],
        ['interview_scheduled', { interviewAt: new Date(Date.now() + 3 * 86400000).toISOString() }],
        ['interview_completed', {}],
    ]) {
        await step(`admin A moves the application to ${to}`, async () => {
            await a.ok('POST', `/api/v1/admin/consultant-applications/${application.id}/transition`, { status: to, ...extra });
            if (to === 'interview_scheduled') {
                const row = await withDb(async (db) => (await db.query('SELECT interview_calendar_status, interview_meet_url FROM consultant_applications WHERE id = $1', [application.id])).rows[0]);
                return `calendar ${row.interview_calendar_status}${row.interview_meet_url ? ', Meet link created' : ''}`;
            }
            if (to === 'interview_completed') {
                const row = await withDb(async (db) => (await db.query('SELECT interview_event_id FROM consultant_applications WHERE id = $1', [application.id])).rows[0]);
                expect(!row.interview_event_id, 'interview calendar event was not removed');
                return 'calendar event removed';
            }
            return '';
        });
    }
    await step('admin A approves the application → invitation created', async () => {
        const data = await a.ok('POST', `/api/v1/admin/consultant-applications/${application.id}/transition`, { status: 'approved' });
        expect(data.invitation, 'no invitation returned');
        expect(await roleOf(student.email) === 'student', 'hiring alone changed the role');
        return 'role still student';
    });
    await step('student sees the invitation on the dashboard and accepts it', async () => {
        const pending = await s.ok('GET', '/api/v1/me/employee-invitations/pending');
        expect(pending.invitation?.intendedRole === 'counsellor', 'no pending consultant invitation');
        const data = await s.ok('POST', '/api/v1/me/employee-invitations/accept', {});
        expect(data.status === 'pending_approval', `status ${data.status}`);
    });
    let activation = null;
    await step('admin A (the inviter) cannot approve the activation', async () => {
        activation = await pendingApprovalFor(a, ids.student, 'employee_activation');
        expect(activation.canDecide === false, 'UI offers the inviter a decision');
        return `refused with ${await a.denied('POST', `/api/v1/admin/approvals/${activation.id}/approve`, {})}`;
    });
    await step('admin B approves the activation', async () => {
        await b.ok('POST', `/api/v1/admin/approvals/${activation.id}/approve`, { comment: 'E2E test' });
        expect(await roleOf(student.email) === 'counsellor', `role ${await roleOf(student.email)}`);
    });
    await step('old student session was ended', async () => {
        expect((await s.ok('GET', '/api/v1/auth/session')).user === null, 'still signed in');
    });
    await step('new consultant logs in and reaches the consultant workspace only', async () => {
        const user = await s.login(student);
        expect(user.role === 'counsellor', `role ${user.role}`);
        await s.ok('GET', '/api/v1/consultant/dashboard');
        await s.denied('GET', '/api/v1/admin/users');
        await s.denied('GET', '/api/v1/admin/approvals');
    });

    console.log('\n2. New person → Administrator (invitation)');
    let invitation = null;
    await step('admin A invites a new person as administrator', async () => {
        invitation = await a.ok('POST', '/api/v1/admin/employees/invitations', {
            email: invitee.email, fullName: 'E2E Invitee', department: 'Operations', jobTitle: 'E2E test administrator', intendedRole: 'admin',
        });
        invitation = invitation.invitation || invitation;
        expect(invitation?.id, 'no invitation returned');
    });
    await step('invitee signs up (email marked verified)', async () => {
        ids.invitee = await signUp(n, invitee, 'Invitee');
    });
    await step('invitation link works (public lookup)', async () => {
        const data = await n.ok('POST', '/api/v1/employee-invitations/lookup', { token: invitationToken(invitation.id) });
        expect(data.intendedRole === 'admin', `role ${data.intendedRole}`);
    });
    await step('invitee accepts with the email link token', async () => {
        const data = await n.ok('POST', '/api/v1/me/employee-invitations/accept', { token: invitationToken(invitation.id) });
        expect(data.status === 'pending_approval', `status ${data.status}`);
        expect(await roleOf(invitee.email) === 'student', 'accepting alone granted access');
    });
    await step('admin A cannot approve; super admin B approves', async () => {
        const request = await pendingApprovalFor(b, ids.invitee, 'employee_activation');
        await a.denied('POST', `/api/v1/admin/approvals/${request.id}/approve`, {});
        await b.ok('POST', `/api/v1/admin/approvals/${request.id}/approve`, { comment: 'E2E test' });
        expect(await roleOf(invitee.email) === 'admin', `role ${await roleOf(invitee.email)}`);
    });
    await step('new administrator logs in and reaches the admin workspace', async () => {
        const user = await n.login(invitee);
        expect(user.role === 'admin', `role ${user.role}`);
        await n.ok('GET', '/api/v1/admin/overview');
        await n.ok('GET', '/api/v1/admin/users');
        await n.ok('GET', '/api/v1/admin/approvals');
    });

    console.log('\n3. Consultant → Administrator (role change)');
    let change = null;
    await step('admin A requests the role change', async () => {
        await a.ok('POST', `/api/v1/admin/users/${ids.student}/role-change-requests`, { requestedRole: 'admin', reason: 'E2E test promotion' });
        change = await pendingApprovalFor(a, ids.student, 'role_change');
    });
    await step('an admin (not super admin) cannot approve admin access', async () => {
        // Only meaningful if the invitee really is an admin; otherwise the refusal proves nothing.
        expect(await roleOf(invitee.email) === 'admin', `invitee is ${await roleOf(invitee.email)}, not admin`);
        return `refused with ${await n.denied('POST', `/api/v1/admin/approvals/${change.id}/approve`, {})}`;
    });
    await step('admin A (the requester) cannot approve', async () => {
        return `refused with ${await a.denied('POST', `/api/v1/admin/approvals/${change.id}/approve`, {})}`;
    });
    await step('super admin B approves; consultant is now administrator', async () => {
        await b.ok('POST', `/api/v1/admin/approvals/${change.id}/approve`, { comment: 'E2E test' });
        const user = await s.login(student);
        expect(user.role === 'admin', `role ${user.role}`);
        await s.ok('GET', '/api/v1/admin/users');
    });

    console.log('\nWrap-up');
    await step('log out every session', async () => {
        for (const client of [a, b, s, n]) await client.ok('POST', '/api/v1/auth/logout');
    });
} finally {
    await step('cleanup: delete test accounts and everything they created', cleanup);
    await step('cleanup check: no e2e accounts left', async () => {
        const left = await withDb(async (db) => (await db.query("SELECT COUNT(*)::int AS n FROM users WHERE email LIKE 'e2e-%@example.com'")).rows[0].n);
        expect(left === 0, `${left} left`);
    });
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
