/* Roles, approvals and workspaces: guest → student, consultant applications,
   employee onboarding, role changes, revocation, assignment-scoped access,
   suspension, notifications and audit. Runs on the real HTTP handler and database. */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
    agent, BASE_NOW, createStaff, db, deactivateCounsellors, guestBooking, request, setNow, signUpStudent,
    startHarness, stopHarness, useProviders,
} from './helpers/harness.js';

before(startHarness);
after(stopHarness);

beforeEach(async () => {
    await setNow(BASE_NOW);
    await useProviders();
    for (const table of ['approval_events', 'approval_requests', 'employee_profiles', 'employee_invitations', 'consultant_application_events',
        'consultant_applications', 'follow_up_tasks', 'lead_activities', 'user_notifications']) {
        await db.query(`DELETE FROM ${table}`);
    }
    await db.query('DELETE FROM consultations');
    await db.query('UPDATE leads SET assigned_counsellor_id = NULL');
    await deactivateCounsellors();
});

async function verify(userId) {
    const { verificationToken } = await import('../src/services/auth-service.js');
    const row = (await db.query('SELECT id FROM email_verification_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId])).rows[0];
    const result = await request('POST', '/api/v1/auth/verify-email/confirm', { body: { token: verificationToken(row.id) } });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body.data;
}

async function student({ verified = true, ...overrides } = {}) {
    const client = agent();
    const profile = await signUpStudent(client, overrides);
    if (verified) await verify(profile.id);
    await client.get('/api/v1/auth/session');
    return { client, ...profile };
}

async function staffAgent(staff) {
    const client = agent();
    await client.login(staff.email, staff.password);
    return { client, ...staff };
}

const APPLICATION = {
    fullName: 'Ravi Kumar', phone: '+919812345678', location: 'Delhi', yearsExperience: 4,
    professionalExperience: 'Four years advising students on UK and Irish universities.', education: 'MA Education',
    languages: ['English', 'Hindi'], expertise: ['UK', 'Ireland'], availability: 'full_time', consent: true,
};

const role = async (id) => (await db.query('SELECT role FROM users WHERE id = $1', [id])).rows[0].role;
const auditCount = async (action, entityId) => (await db.query('SELECT COUNT(*)::int AS n FROM audit_log WHERE action = $1 AND entity_id = $2', [action, entityId])).rows[0].n;

async function inviteAndAccept(admin, invitee, { intendedRole = 'counsellor' } = {}) {
    const invite = await admin.client.post('/api/v1/admin/employees/invitations', {
        email: invitee.email, fullName: 'Ravi Kumar', department: 'Counselling', jobTitle: 'Consultant', intendedRole,
    });
    assert.equal(invite.status, 201, JSON.stringify(invite.body));
    const { invitationToken } = await import('../src/services/invitation-token.js');
    const token = invitationToken(invite.body.data.id);
    const accepted = await invitee.client.post('/api/v1/me/employee-invitations/accept', { token });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
    return { invitation: invite.body.data, token, requestId: accepted.body.data.approvalRequestId };
}

/* ── Guests ───────────────────────────────────────────────────────────────── */

describe('guests', () => {
    test('a guest cannot reach any signed-in API', async () => {
        for (const path of ['/api/v1/me/dashboard', '/api/v1/me/profile', '/api/v1/me/notifications', '/api/v1/me/consultant-applications',
            '/api/v1/consultant/dashboard', '/api/v1/consultant/students', '/api/v1/admin/overview', '/api/v1/admin/users', '/api/v1/admin/leads',
            '/api/v1/admin/approvals', '/api/v1/admin/audit-logs']) {
            assert.equal((await request('GET', path)).status, 401, path);
        }
    });

    test('resending booking links answers the same for every address and only emails the booking address', async () => {
        await createStaff();
        const booking = guestBooking();
        assert.equal((await request('POST', '/api/v1/consultations', { body: booking })).status, 201);
        const known = await request('POST', '/api/v1/consultations/manage/resend', { body: { email: booking.email } });
        const unknown = await request('POST', '/api/v1/consultations/manage/resend', { body: { email: 'nobody@example.com' } });
        assert.equal(known.status, 200);
        assert.deepEqual(known.body, unknown.body, 'no difference reveals whether a booking exists');
        await request('POST', '/api/v1/consultations/manage/resend', { body: { email: booking.email } });
        const queued = await db.query("SELECT recipient FROM notifications WHERE template = 'booking_link'");
        assert.deepEqual(queued.rows.map((r) => r.recipient), [booking.email], 'one message per booking per hour, to the booking address');
    });
});

/* ── Guest → student ──────────────────────────────────────────────────────── */

describe('guest to student', () => {
    test('verifying the email links the guest booking with its id, converts the lead and notifies the student', async () => {
        await createStaff();
        const s = await student({ verified: false });
        const guest = await request('POST', '/api/v1/consultations', { body: guestBooking({ email: s.email }) });
        const bookingId = guest.body.data.consultation.id;
        const linked = await verify(s.id);
        assert.equal(linked.linkedConsultations, 1);
        const mine = await s.client.get('/api/v1/me/consultations');
        assert.deepEqual(mine.body.data.map((c) => c.id), [bookingId], 'same booking id, nothing duplicated');
        const lead = (await db.query('SELECT status, user_id FROM leads WHERE id = (SELECT lead_id FROM consultations WHERE id = $1)', [bookingId])).rows[0];
        assert.equal(lead.user_id, s.id);
        assert.equal(lead.status, 'converted');
        const inbox = await s.client.get('/api/v1/me/notifications');
        assert.equal(inbox.body.data.items[0].kind, 'records_linked');
    });

    test('guest records sharing only a phone number are flagged for review, never linked; an admin links one with a reason', async () => {
        const admin = await staffAgent(await createStaff({ role: 'admin' }));
        const s = await student({ phone: '+919800000001' });
        const lead = await request('POST', '/api/v1/leads', { body: { source: 'consultation', firstName: 'Ravi', email: 'other-address@example.com', phone: '+919800000001', contactConsent: true } });
        const leadId = lead.body.data.id;
        const detail = await admin.client.get(`/api/v1/admin/users/${s.id}`);
        assert.deepEqual(detail.body.data.possibleDuplicates.leads.map((l) => l.id), [leadId]);
        assert.equal((await db.query('SELECT user_id FROM leads WHERE id = $1', [leadId])).rows[0].user_id, null);

        const noReason = await admin.client.post(`/api/v1/admin/users/${s.id}/link-record`, { leadId });
        assert.equal(noReason.status, 400);
        const link = await admin.client.post(`/api/v1/admin/users/${s.id}/link-record`, { leadId, reason: 'Confirmed by phone call' });
        assert.equal(link.status, 200);
        assert.equal((await db.query('SELECT user_id FROM leads WHERE id = $1', [leadId])).rows[0].user_id, s.id);
        assert.equal(await auditCount('identity.manual_link', s.id), 1);
        assert.equal((await admin.client.post(`/api/v1/admin/users/${s.id}/link-record`, { leadId, reason: 'again' })).status, 409, 'cannot link twice');
    });
});

/* ── Student workspace ────────────────────────────────────────────────────── */

describe('student workspace', () => {
    test('the overview counts the student\'s own records only', async () => {
        await createStaff();
        const alice = await student();
        const bob = await student();
        await alice.client.post('/api/v1/consultations', { ...guestBooking(), fullName: undefined, email: undefined });
        await db.query("INSERT INTO student_applications (id, student_user_id, university, course, status) VALUES ($1, $2, 'UCL', 'MSc', 'offer_conditional')", [crypto.randomUUID(), alice.id]);
        const a = (await alice.client.get('/api/v1/me/dashboard')).body.data;
        assert.equal(a.consultations.upcoming, 1);
        assert.equal(a.applications.total, 1);
        assert.equal(a.applications.offers, 1);
        assert.ok(a.nextConsultation);
        const b = (await bob.client.get('/api/v1/me/dashboard')).body.data;
        assert.equal(b.consultations.upcoming, 0);
        assert.equal(b.applications.total, 0);
        assert.equal(b.nextConsultation, null);
        assert.ok(b.nextSteps.some((step) => step.key === 'book'));
    });

    test('profile updates write only whitelisted fields and report completion', async () => {
        const s = await student();
        const result = await s.client.patch('/api/v1/me/profile', {
            destinations: ['United Kingdom', 'Ireland'], intendedIntake: 'September 2027', studyLevel: 'Postgraduate',
            role: 'admin', email: 'hijack@example.com', status: 'active',
        });
        assert.equal(result.status, 200, JSON.stringify(result.body));
        assert.deepEqual(result.body.data.destinations, ['United Kingdom', 'Ireland']);
        assert.ok(result.body.data.completion > 0 && result.body.data.completion < 100);
        const row = (await db.query('SELECT role, email FROM users WHERE id = $1', [s.id])).rows[0];
        assert.equal(row.role, 'student');
        assert.equal(row.email, s.email);
        assert.equal((await s.client.patch('/api/v1/me/profile', { destinations: ['a', 'b', 'c', 'd', 'e', 'f'] })).status, 400);
    });

    test('a student cannot use consultant or admin APIs', async () => {
        const s = await student();
        for (const path of ['/api/v1/consultant/dashboard', '/api/v1/consultant/students', '/api/v1/consultant/follow-ups', '/api/v1/admin/overview',
            '/api/v1/admin/users', '/api/v1/admin/leads', '/api/v1/admin/approvals', '/api/v1/admin/consultant-applications', '/api/v1/admin/audit-logs']) {
            assert.equal((await s.client.get(path)).status, 403, path);
        }
        const self = await s.client.post(`/api/v1/admin/users/${s.id}/role-change-requests`, { requestedRole: 'admin', reason: 'promote me' });
        assert.equal(self.status, 403);
        assert.equal(await role(s.id), 'student');
    });
});

/* ── Consultant applications ──────────────────────────────────────────────── */

describe('consultant applications', () => {
    test('submit, review privately, request information, resubmit, approve: approval invites but grants nothing', async () => {
        const admin = await staffAgent(await createStaff({ role: 'admin' }));
        const s = await student();
        const created = await s.client.post('/api/v1/me/consultant-applications', APPLICATION);
        assert.equal(created.status, 201, JSON.stringify(created.body));
        const id = created.body.data.id;
        assert.equal((await s.client.post('/api/v1/me/consultant-applications', APPLICATION)).status, 409, 'one open application');

        assert.equal((await admin.client.post(`/api/v1/admin/consultant-applications/${id}/notes`, { note: 'PRIVATE: strong on UK' })).status, 201);
        assert.equal((await admin.client.post(`/api/v1/admin/consultant-applications/${id}/transition`, { status: 'approved' })).status, 409, 'cannot skip the interview');
        const info = await admin.client.post(`/api/v1/admin/consultant-applications/${id}/transition`, { status: 'info_requested', message: 'Please add your IELTS training experience.', note: 'PRIVATE: check references' });
        assert.equal(info.status, 200, JSON.stringify(info.body));

        const mine = await s.client.get(`/api/v1/me/consultant-applications/${id}`);
        assert.equal(mine.body.data.status, 'info_requested');
        assert.equal(mine.body.data.message, 'Please add your IELTS training experience.');
        assert.ok(!JSON.stringify(mine.body).includes('PRIVATE'), 'reviewer notes never reach the applicant');
        assert.equal((await s.client.patch(`/api/v1/me/consultant-applications/${id}`, { counsellingExperience: 'Ran IELTS workshops.' })).body.data.status, 'submitted');

        for (const step of [{ status: 'under_review' }, { status: 'shortlisted' }, { status: 'interview_scheduled', interviewAt: '2026-11-10T06:00:00Z' }, { status: 'interview_completed' }]) {
            const moved = await admin.client.post(`/api/v1/admin/consultant-applications/${id}/transition`, step);
            assert.equal(moved.status, 200, `${step.status}: ${JSON.stringify(moved.body)}`);
        }
        assert.equal((await s.client.patch(`/api/v1/me/consultant-applications/${id}`, { location: 'Mumbai' })).status, 409, 'locked once under review');
        const approved = await admin.client.post(`/api/v1/admin/consultant-applications/${id}/transition`, { status: 'approved', job: { jobTitle: 'Consultant' } });
        assert.equal(approved.status, 200, JSON.stringify(approved.body));
        assert.ok(approved.body.data.invitation, 'an invitation is created');
        assert.equal(await role(s.id), 'student', 'the hiring decision alone grants no access');
        assert.equal((await s.client.get('/api/v1/consultant/dashboard')).status, 403);
        const history = (await admin.client.get(`/api/v1/admin/consultant-applications/${id}`)).body.data.history;
        assert.ok(history.some((e) => e.note === 'PRIVATE: strong on UK'));
        assert.equal(await auditCount('consultant_application.approved', id), 1);
    });

    test('a rejected application creates no invitation and no access', async () => {
        const admin = await staffAgent(await createStaff({ role: 'admin' }));
        const s = await student();
        const id = (await s.client.post('/api/v1/me/consultant-applications', APPLICATION)).body.data.id;
        assert.equal((await admin.client.post(`/api/v1/admin/consultant-applications/${id}/transition`, { status: 'rejected', message: 'Not this time.' })).status, 200);
        assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM employee_invitations')).rows[0].n, 0);
        assert.equal(await role(s.id), 'student');
        assert.equal((await s.client.post(`/api/v1/me/consultant-applications/${id}/withdraw`, {})).status, 409, 'closed applications cannot be withdrawn');
    });

    test('unverified students, counsellors and admins cannot apply; counsellors cannot review', async () => {
        const unverified = await student({ verified: false });
        assert.equal((await unverified.client.post('/api/v1/me/consultant-applications', APPLICATION)).status, 403);
        const counsellor = await staffAgent(await createStaff());
        assert.equal((await counsellor.client.post('/api/v1/me/consultant-applications', APPLICATION)).status, 403);
        assert.equal((await counsellor.client.get('/api/v1/admin/consultant-applications')).status, 403);
        const missingConsent = await (await student()).client.post('/api/v1/me/consultant-applications', { ...APPLICATION, consent: false });
        assert.equal(missingConsent.status, 400);
    });
});

/* ── Employee onboarding ──────────────────────────────────────────────────── */

describe('employee onboarding', () => {
    test('an existing student is onboarded on the same account after a second admin approves', async () => {
        await createStaff();
        const inviter = await staffAgent(await createStaff({ role: 'admin', name: 'Inviter' }));
        const approver = await staffAgent(await createStaff({ role: 'admin', name: 'Approver' }));
        const s = await student();
        const booked = await s.client.post('/api/v1/consultations', { ...guestBooking(), fullName: undefined, email: undefined });
        const { requestId, token } = await inviteAndAccept(inviter, s);
        const activationRequests = await approver.client.get('/api/v1/admin/approvals?status=pending&type=employee_activation');
        assert.equal(activationRequests.status, 200);
        assert.ok(activationRequests.body.data.items.some((item) => item.id === requestId), 'another admin sees the accepted invitation for approval');
        assert.equal(await role(s.id), 'student', 'accepting does not grant access');
        assert.equal((await s.client.get('/api/v1/auth/session')).body.data.user.home, 'dashboard', 'pending approval keeps the student workspace');
        assert.equal((await s.client.post('/api/v1/me/employee-invitations/accept', { token })).status, 400, 'single use');

        const own = await inviter.client.post(`/api/v1/admin/approvals/${requestId}/approve`, {});
        assert.equal(own.status, 403, 'the requester cannot approve their own request');
        const approved = await approver.client.post(`/api/v1/admin/approvals/${requestId}/approve`, { comment: 'Welcome' });
        assert.equal(approved.status, 200, JSON.stringify(approved.body));

        assert.equal(await role(s.id), 'counsellor');
        assert.equal((await s.client.get('/api/v1/me/dashboard')).status, 401, 'old sessions end on a role change');
        const fresh = agent();
        await fresh.login(s.email, s.password);
        const session = await fresh.get('/api/v1/auth/session');
        assert.equal(session.body.data.user.role, 'counsellor');
        assert.equal(session.body.data.user.home, 'consultant-dashboard');
        assert.equal((await fresh.get('/api/v1/consultant/dashboard')).status, 200);
        assert.equal((await fresh.get('/api/v1/admin/users')).status, 403, 'a consultant is not an admin');
        const ids = (await db.query('SELECT id FROM consultations WHERE student_user_id = $1', [s.id])).rows.map((r) => r.id);
        assert.deepEqual(ids, [booked.body.data.consultation.id], 'student history stays on the same account id');
        const profile = (await db.query('SELECT employment_status, approved_by FROM employee_profiles WHERE user_id = $1', [s.id])).rows[0];
        assert.equal(profile.employment_status, 'active');
        assert.equal(profile.approved_by, approver.id);
        assert.equal(await auditCount('role.granted', s.id), 1);
        const granted = (await db.query("SELECT details FROM audit_log WHERE action = 'role.granted' AND entity_id = $1", [s.id])).rows[0].details;
        assert.deepEqual([granted.before.role, granted.after.role], ['student', 'counsellor']);
        assert.ok(!JSON.stringify(granted).match(/password|token/i), 'no secrets in the audit log');

        const requester = await staffAgent(await createStaff({ role: 'super_admin', name: 'Promotion requester' }));
        const finalApprover = await staffAgent(await createStaff({ role: 'super_admin', name: 'Promotion approver' }));
        const promotion = await requester.client.post(`/api/v1/admin/users/${s.id}/role-change-requests`, { requestedRole: 'admin', reason: 'Promote to team administrator' });
        assert.equal(promotion.status, 201, JSON.stringify(promotion.body));
        const promotionId = promotion.body.data.id;
        const visiblePromotions = await finalApprover.client.get('/api/v1/admin/approvals?status=pending&type=role_change');
        assert.ok(visiblePromotions.body.data.items.some((item) => item.id === promotionId), 'super admin sees the promotion request');
        assert.equal((await finalApprover.client.post(`/api/v1/admin/approvals/${promotionId}/approve`, {})).status, 200);
        assert.equal(await role(s.id), 'admin');
        assert.equal((await fresh.get('/api/v1/auth/session')).body.data.user, null, 'promotion revokes the consultant session');

        const promoted = agent();
        await promoted.login(s.email, s.password);
        const adminSession = await promoted.get('/api/v1/auth/session');
        assert.equal(adminSession.body.data.user.role, 'admin');
        assert.equal(adminSession.body.data.user.home, 'admin');
        assert.equal((await promoted.get('/api/v1/admin/overview')).status, 200);
        assert.equal((await promoted.get('/api/v1/consultant/dashboard')).status, 200, 'admins retain access to their own work dashboard');
    });

    test('the invitation must be accepted by a verified account that owns the invited address', async () => {
        const admin = await staffAgent(await createStaff({ role: 'admin' }));
        const invited = await student();
        const intruder = await student();
        const unverified = await student({ verified: false });
        const invite = await admin.client.post('/api/v1/admin/employees/invitations', { email: invited.email, fullName: 'Ravi', department: 'Counselling', jobTitle: 'Consultant', intendedRole: 'counsellor' });
        const { invitationToken } = await import('../src/services/invitation-token.js');
        const token = invitationToken(invite.body.data.id);
        assert.equal((await intruder.client.post('/api/v1/me/employee-invitations/accept', { token })).status, 403);
        assert.equal((await unverified.client.post('/api/v1/me/employee-invitations/accept', { token })).status, 403);
        assert.equal((await invited.client.post('/api/v1/me/employee-invitations/accept', { token: 'forged-token' })).status, 400);
        const lookup = await request('POST', '/api/v1/employee-invitations/lookup', { body: { token } });
        assert.equal(lookup.status, 200);
        assert.ok(!lookup.body.data.invitedEmail.includes(invited.email.split('@')[0]), 'the address is masked');
        assert.equal((await admin.client.post('/api/v1/admin/employees/invitations', { email: invited.email, fullName: 'Ravi', department: 'X', jobTitle: 'Y', intendedRole: 'counsellor' })).status, 409, 'one pending invitation per address');
        await db.query("UPDATE employee_invitations SET expires_at = $2 WHERE id = $1", [invite.body.data.id, new Date(BASE_NOW.getTime() - 1000)]);
        assert.equal((await invited.client.post('/api/v1/me/employee-invitations/accept', { token })).status, 400, 'expired');
    });

    test('an invited student can accept from the dashboard notification without the email link', async () => {
        const admin = await staffAgent(await createStaff({ role: 'admin' }));
        const superAdmin = await staffAgent(await createStaff({ role: 'super_admin' }));
        const invited = await student();
        const intruder = await student();
        const unverified = await student({ verified: false });
        assert.equal((await invited.client.get('/api/v1/me/employee-invitations/pending')).body.data.invitation, null);
        const invite = await admin.client.post('/api/v1/admin/employees/invitations', { email: invited.email, fullName: 'Ravi', department: 'Counselling', jobTitle: 'Consultant', intendedRole: 'counsellor' });
        assert.equal(invite.status, 201);

        const note = (await invited.client.get('/api/v1/me/notifications')).body.data.items.find((n) => n.kind === 'employee_invitation');
        assert.equal(note.link, 'join-team', 'the notification opens the accept page');
        const pending = await invited.client.get('/api/v1/me/employee-invitations/pending');
        assert.equal(pending.body.data.invitation.jobTitle, 'Consultant');
        assert.equal((await intruder.client.get('/api/v1/me/employee-invitations/pending')).body.data.invitation, null);
        assert.equal((await intruder.client.post('/api/v1/me/employee-invitations/accept', {})).status, 400, 'nothing to accept for another address');
        assert.equal((await unverified.client.post('/api/v1/me/employee-invitations/accept', {})).status, 403);

        const accepted = await invited.client.post('/api/v1/me/employee-invitations/accept', {});
        assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
        assert.equal(accepted.body.data.status, 'pending_approval');
        const approvals = (await superAdmin.client.get('/api/v1/me/notifications')).body.data.items.filter((n) => n.kind === 'approval_requested');
        assert.equal(approvals.length, 1, 'the super admin hears about the approval request');
        assert.equal((await invited.client.post('/api/v1/me/employee-invitations/accept', {})).status, 400, 'single use');
    });

    test('admin access needs a super admin to approve', async () => {
        const inviter = await staffAgent(await createStaff({ role: 'admin' }));
        const otherAdmin = await staffAgent(await createStaff({ role: 'admin' }));
        const superAdmin = await staffAgent(await createStaff({ role: 'super_admin' }));
        const s = await student();
        const { requestId } = await inviteAndAccept(inviter, s, { intendedRole: 'admin' });
        assert.equal((await otherAdmin.client.post(`/api/v1/admin/approvals/${requestId}/approve`, {})).status, 403);
        assert.equal(await role(s.id), 'student');
        assert.equal((await superAdmin.client.post(`/api/v1/admin/approvals/${requestId}/approve`, {})).status, 200);
        assert.equal(await role(s.id), 'admin');
    });

    test('a rejected onboarding grants nothing and closes the profile', async () => {
        const inviter = await staffAgent(await createStaff({ role: 'admin' }));
        const approver = await staffAgent(await createStaff({ role: 'admin' }));
        const s = await student();
        const { requestId } = await inviteAndAccept(inviter, s);
        assert.equal((await approver.client.post(`/api/v1/admin/approvals/${requestId}/reject`, {})).status, 400, 'a reason is required');
        assert.equal((await approver.client.post(`/api/v1/admin/approvals/${requestId}/reject`, { comment: 'Start date moved' })).status, 200);
        assert.equal(await role(s.id), 'student');
        assert.equal((await db.query('SELECT employment_status FROM employee_profiles WHERE user_id = $1', [s.id])).rows[0].employment_status, 'terminated');
    });
});

/* ── Role changes and revocation ──────────────────────────────────────────── */

describe('role changes and revocation', () => {
    test('nobody requests or decides a change to their own access; the database enforces it too', async () => {
        const admin = await staffAgent(await createStaff({ role: 'admin' }));
        const counsellor = await staffAgent(await createStaff());
        assert.equal((await admin.client.post(`/api/v1/admin/users/${admin.id}/role-change-requests`, { requestedRole: 'super_admin', reason: 'self' })).status, 403);
        assert.equal((await counsellor.client.post(`/api/v1/admin/users/${counsellor.id}/role-change-requests`, { requestedRole: 'admin', reason: 'self' })).status, 403);
        assert.equal((await counsellor.client.get('/api/v1/admin/approvals')).status, 403);
        await assert.rejects(
            db.query("INSERT INTO approval_requests (id, type, target_user_id, from_role, requested_role, requested_by, reason) VALUES ($1, 'role_change', $2, 'admin', 'super_admin', $2, 'x')", [crypto.randomUUID(), admin.id]),
            /approval_requests_not_self_requested/,
        );
        const other = await staffAgent(await createStaff({ role: 'admin' }));
        const req = await other.client.post(`/api/v1/admin/users/${counsellor.id}/role-change-requests`, { requestedRole: 'admin', reason: 'Team lead' });
        assert.equal(req.status, 201);
        await assert.rejects(
            db.query('UPDATE approval_requests SET decided_by = requested_by WHERE id = $1', [req.body.data.id]),
            /approval_requests_not_self_decided/,
        );
        assert.equal((await counsellor.client.post(`/api/v1/admin/approvals/${req.body.data.id}/approve`, {})).status, 403, 'the target cannot approve');
        assert.equal((await admin.client.post(`/api/v1/admin/approvals/${req.body.data.id}/approve`, {})).status, 403, 'granting admin needs a super admin');
    });

    test('revoking a consultant reassigns their upcoming work, keeps history and ends their access', async () => {
        const leaving = await staffAgent(await createStaff({ name: 'Leaving' }));
        const booking = await request('POST', '/api/v1/consultations', { body: guestBooking() });
        assert.equal(booking.body.data.consultation.counsellor.name, 'Leaving');
        const successor = await createStaff({ name: 'Successor' });
        const requester = await staffAgent(await createStaff({ role: 'admin' }));
        const approver = await staffAgent(await createStaff({ role: 'admin' }));
        const lead = (await db.query('SELECT lead_id FROM consultations WHERE id = $1', [booking.body.data.consultation.id])).rows[0].lead_id;
        await db.query('UPDATE leads SET assigned_counsellor_id = $2 WHERE id = $1', [lead, leaving.id]);
        await leaving.client.post('/api/v1/consultant/follow-ups', { title: 'Call back', leadId: lead });

        const noTarget = await requester.client.post(`/api/v1/admin/users/${leaving.id}/revocation-requests`, { reason: 'Left the company' });
        assert.equal(noTarget.status, 422);
        assert.equal(noTarget.body.code, 'REASSIGNMENT_REQUIRED');
        const req = await requester.client.post(`/api/v1/admin/users/${leaving.id}/revocation-requests`, { reason: 'Left the company', reassignToCounsellorId: successor.id });
        assert.equal(req.status, 201, JSON.stringify(req.body));
        const approved = await approver.client.post(`/api/v1/admin/approvals/${req.body.data.id}/approve`, {});
        assert.equal(approved.status, 200, JSON.stringify(approved.body));
        assert.deepEqual(approved.body.data.outcome.moved, { consultations: 1, leads: 1, tasks: 1 });

        assert.equal(await role(leaving.id), 'student');
        assert.equal((await db.query('SELECT counsellor_id FROM consultations WHERE id = $1', [booking.body.data.consultation.id])).rows[0].counsellor_id, successor.id);
        assert.equal((await db.query('SELECT assigned_counsellor_id FROM leads WHERE id = $1', [lead])).rows[0].assigned_counsellor_id, successor.id);
        assert.equal((await db.query('SELECT is_active FROM counsellors WHERE user_id = $1', [leaving.id])).rows[0].is_active, false);
        const events = await db.query("SELECT COUNT(*)::int AS n FROM consultation_events WHERE consultation_id = $1 AND event = 'counsellor_assigned'", [booking.body.data.consultation.id]);
        assert.equal(events.rows[0].n, 1, 'the reassignment is in the booking history');
        assert.equal((await leaving.client.get('/api/v1/consultant/dashboard')).status, 401, 'sessions revoked');
        const again = agent();
        await again.login(leaving.email, leaving.password);
        assert.equal((await again.get('/api/v1/consultant/dashboard')).status, 403, 'no consultant access after re-login');
        assert.equal((await again.get(`/api/v1/admin/leads/${lead}`)).status, 403);
        assert.equal(await auditCount('role.revoked', leaving.id), 1);
    });

    test('changing a super admin needs a third, independent super admin', async () => {
        const target = await staffAgent(await createStaff({ role: 'super_admin' }));
        const requester = await staffAgent(await createStaff({ role: 'super_admin' }));
        const admin = await staffAgent(await createStaff({ role: 'admin' }));
        assert.equal((await admin.client.post(`/api/v1/admin/users/${target.id}/role-change-requests`, { requestedRole: 'admin', reason: 'Step down' })).status, 403, 'admins cannot even ask');
        const req = await requester.client.post(`/api/v1/admin/users/${target.id}/role-change-requests`, { requestedRole: 'admin', reason: 'Step down' });
        assert.equal(req.status, 201, JSON.stringify(req.body));
        const id = req.body.data.id;
        assert.equal((await requester.client.post(`/api/v1/admin/approvals/${id}/approve`, {})).status, 403, 'not the requester');
        assert.equal((await target.client.post(`/api/v1/admin/approvals/${id}/approve`, {})).status, 403, 'not the target');
        assert.equal((await admin.client.post(`/api/v1/admin/approvals/${id}/approve`, {})).status, 403, 'not an admin');
        assert.equal(await role(target.id), 'super_admin');
        const third = await staffAgent(await createStaff({ role: 'super_admin' }));
        assert.equal((await third.client.post(`/api/v1/admin/approvals/${id}/request-information`, { comment: 'Who replaces them?' })).status, 200);
        assert.equal((await third.client.post(`/api/v1/admin/approvals/${id}/approve`, {})).status, 409, 'waiting for information');
        assert.equal((await requester.client.post(`/api/v1/admin/approvals/${id}/respond`, { comment: 'Priya takes over.' })).status, 200);
        assert.equal((await third.client.post(`/api/v1/admin/approvals/${id}/approve`, {})).status, 200);
        assert.equal(await role(target.id), 'admin');
        const history = (await third.client.get(`/api/v1/admin/approvals/${id}`)).body.data.history.map((h) => h.action);
        assert.deepEqual(history, ['requested', 'info_requested', 'responded', 'approved']);
    });
});

/* ── Assignment-scoped consultant access ──────────────────────────────────── */

describe('consultant access is limited to assignments', () => {
    test('consultants see only their students and assigned leads, and cannot assign', async () => {
        const mine = await staffAgent(await createStaff({ name: 'Mine' }));
        const s1 = await student();
        await s1.client.post('/api/v1/consultations', { ...guestBooking(), fullName: undefined, email: undefined });
        const theirs = await staffAgent(await createStaff({ name: 'Theirs' }));
        await deactivateCounsellors();
        await db.query('UPDATE counsellors SET is_active = TRUE WHERE user_id = $1', [theirs.id]);
        const s2 = await student();
        await s2.client.post('/api/v1/consultations', { ...guestBooking({ start: '2026-11-03T06:00:00.000Z' }), fullName: undefined, email: undefined });
        await db.query('UPDATE counsellors SET is_active = TRUE WHERE user_id = $1', [mine.id]);

        const students = (await mine.client.get('/api/v1/consultant/students')).body.data.items.map((s) => s.id);
        assert.deepEqual(students, [s1.id]);
        assert.equal((await mine.client.get(`/api/v1/admin/students/${s2.id}/applications`)).status, 404);

        const leadA = (await request('POST', '/api/v1/leads', { body: { source: 'contact', firstName: 'A', email: 'a-lead@example.com', message: 'hi' } })).body.data.id;
        const leadB = (await request('POST', '/api/v1/leads', { body: { source: 'contact', firstName: 'B', email: 'b-lead@example.com', message: 'hi' } })).body.data.id;
        const admin = await staffAgent(await createStaff({ role: 'admin' }));
        assert.equal((await admin.client.patch(`/api/v1/admin/leads/${leadA}`, { assignedCounsellorId: mine.id })).status, 200);
        assert.equal((await admin.client.patch(`/api/v1/admin/leads/${leadB}`, { assignedCounsellorId: theirs.id })).status, 200);
        const list = (await mine.client.get('/api/v1/admin/leads')).body.data.items.map((l) => l.id);
        assert.deepEqual(list, [leadA]);
        assert.equal((await mine.client.get(`/api/v1/admin/leads/${leadB}`)).status, 404);
        assert.equal((await mine.client.patch(`/api/v1/admin/leads/${leadA}`, { assignedCounsellorId: mine.id })).status, 403, 'consultants cannot assign');
        const contact = await mine.client.post(`/api/v1/admin/leads/${leadA}/activities`, { kind: 'contact_attempt', channel: 'phone', body: 'No answer' });
        assert.equal(contact.status, 201);
        assert.equal(contact.body.data.status, 'contacted');
        assert.equal((await mine.client.get('/api/v1/me/notifications')).body.data.items[0].kind, 'lead_assigned');

        assert.equal((await mine.client.post('/api/v1/consultant/follow-ups', { title: 'x', studentUserId: s2.id })).status, 404, 'cannot attach tasks to students they cannot see');
        assert.equal((await mine.client.post('/api/v1/consultant/follow-ups', { title: 'x', assigneeUserId: theirs.id })).status, 403, 'cannot assign tasks to others');
        const task = await mine.client.post('/api/v1/consultant/follow-ups', { title: 'Send shortlist', studentUserId: s1.id, dueAt: '2026-11-01T00:00:00Z', priority: 'high' });
        assert.equal(task.status, 201);
        assert.equal(task.body.data.overdue, true);
        assert.equal((await theirs.client.patch(`/api/v1/consultant/follow-ups/${task.body.data.id}`, { status: 'done' })).status, 404);
        const overview = (await mine.client.get('/api/v1/consultant/dashboard?timezone=Asia/Kolkata')).body.data;
        assert.equal(overview.counts.assignedStudents, 1, 'one booking; lead A has no account');
        assert.equal(overview.counts.overdueFollowUps, 1);
        assert.equal(overview.counts.openLeads, 1);
        assert.equal((await mine.client.get('/api/v1/admin/audit-logs')).status, 403);
    });
});

/* ── Suspension, overview and audit ───────────────────────────────────────── */

describe('administration', () => {
    test('suspension ends sessions at once and is audited; admins cannot suspend admins or themselves', async () => {
        const admin = await staffAgent(await createStaff({ role: 'admin' }));
        const s = await student();
        const suspended = await admin.client.patch(`/api/v1/admin/users/${s.id}/status`, { status: 'disabled', reason: 'Fraudulent bookings' });
        assert.equal(suspended.status, 200);
        assert.equal((await s.client.get('/api/v1/me/dashboard')).status, 401);
        const relogin = agent();
        assert.equal((await relogin.post('/api/v1/auth/login', { email: s.email, password: s.password })).status, 403);
        assert.equal(await auditCount('user.suspended', s.id), 1);
        assert.equal((await admin.client.patch(`/api/v1/admin/users/${s.id}/status`, { status: 'active', reason: 'Resolved' })).status, 200);
        const otherAdmin = await createStaff({ role: 'admin' });
        assert.equal((await admin.client.patch(`/api/v1/admin/users/${otherAdmin.id}/status`, { status: 'disabled', reason: 'x x' })).status, 403);
        assert.equal((await admin.client.patch(`/api/v1/admin/users/${admin.id}/status`, { status: 'disabled', reason: 'x x' })).status, 403);
    });

    test('the admin overview matches stored data', async () => {
        const admin = await staffAgent(await createStaff({ role: 'admin' }));
        await createStaff();
        const before = (await admin.client.get('/api/v1/admin/overview')).body.data;
        await student();
        const booking = guestBooking();
        await request('POST', '/api/v1/consultations', { body: booking });
        const contact = await request('POST', '/api/v1/leads', { body: { source: 'contact', firstName: 'C', email: 'c-lead@example.com', message: 'hi' } });
        // Rows are stamped with the database clock; move these two onto the test clock.
        await db.query('UPDATE leads SET created_at = $1 WHERE id = $2 OR LOWER(email) = $3', [BASE_NOW, contact.body.data.id, booking.email]);
        const after = (await admin.client.get('/api/v1/admin/overview')).body.data;
        assert.equal(after.students, before.students + 1);
        assert.equal(after.upcomingConsultations, before.upcomingConsultations + 1);
        assert.equal(after.newEnquiries7d, before.newEnquiries7d + 2, 'the booking lead and the contact form');
        assert.equal(after.unassignedEnquiries, before.unassignedEnquiries + 1, 'the booked lead is past "qualified"');
        assert.equal(after.activeConsultants, (await db.query("SELECT COUNT(*)::int AS n FROM counsellors co JOIN users u ON u.id = co.user_id WHERE co.is_active AND u.role = 'counsellor' AND u.status = 'active'")).rows[0].n);
        assert.equal(after.completionRate90d, before.completionRate90d, 'no attended consultations yet');
    });

    test('the audit log viewer filters by record and never shows secrets', async () => {
        const admin = await staffAgent(await createStaff({ role: 'admin' }));
        const s = await student();
        await admin.client.patch(`/api/v1/admin/users/${s.id}/status`, { status: 'disabled', reason: 'Check' });
        const log = await admin.client.get(`/api/v1/admin/audit-logs?entity_type=user&entity_id=${s.id}`);
        assert.equal(log.status, 200);
        assert.ok(log.body.data.items.some((e) => e.action === 'user.suspended' && e.actor.id === admin.id));
        assert.ok(!JSON.stringify(log.body).match(/password|csrf|token_hash/i));
    });
});
