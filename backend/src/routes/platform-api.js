/* Routes for the role-based workspaces: student profile and overview, the
   notification centre, consultant applications, employee onboarding, approvals,
   user and lead management, follow-ups and the audit log. Same conventions as
   booking-api.js: handlers validate input and check permissions on the server,
   then call services. A role sent by the browser is never read. */
import { badRequest, createRouter, notFound, sendError, sendJson } from '../lib/http.js';
import { createValidator, isUuid } from '../lib/validate.js';
import * as approvals from '../services/approval-service.js';
import * as applications from '../services/consultant-application-service.js';
import * as dashboards from '../services/dashboard-service.js';
import * as employees from '../services/employee-service.js';
import * as followUps from '../services/follow-up-service.js';
import * as inbox from '../services/inbox.js';
import * as leads from '../services/lead-service.js';
import { STAFF_ROLES } from '../services/permissions.js';
import { enforceRateLimit } from '../services/rate-limit.js';
import * as users from '../services/user-admin-service.js';
import { resendManageLinks } from '../services/booking-service.js';
import { query } from '../lib/db.js';
import { checkCsrf, checkOrigin, createContext, requirePermission, requireUser } from './context.js';

const router = createRouter();
const ok = (ctx, data, status = 200) => sendJson(ctx.response, status, { data });
const param = (ctx, name = 'id') => {
    const value = ctx.params[name];
    if (!isUuid(value)) throw notFound('Not found');
    return value.toLowerCase();
};
const queryOf = (ctx) => Object.fromEntries(ctx.query);

function pageParams(q, maxSize = 100) {
    const page = Math.max(1, Number.parseInt(q.get('page') || '1', 10) || 1);
    const pageSize = Math.min(maxSize, Math.max(1, Number.parseInt(q.get('page_size') || '25', 10) || 25));
    return { page, pageSize };
}

/* A short list of short strings (languages, destinations). */
function stringList(v, body, name, { max = 10, itemMax = 60, label = name } = {}) {
    const raw = body[name];
    if (raw === undefined) return undefined;
    const valid = Array.isArray(raw) && raw.length <= max && raw.every((item) => typeof item === 'string' && item.trim() && item.trim().length <= itemMax);
    v.check(valid, name, `${label} must be a list of up to ${max} items`);
    return valid ? [...new Set(raw.map((item) => item.trim()))] : undefined;
}

function httpsUrl(v, body, name, label) {
    const raw = body[name];
    if (raw === undefined || raw === null || raw === '') return raw === '' || raw === null ? '' : undefined;
    let valid = false;
    try {
        valid = typeof raw === 'string' && raw.length <= 500 && new URL(raw).protocol === 'https:';
    } catch { /* invalid */ }
    v.check(valid, name, `${label} must be an https:// link`);
    return valid ? raw : undefined;
}

/* ── Public: guest booking links and invitations ──────────────────────────── */

router.post('/api/v1/consultations/manage/resend', async (ctx) => {
    await enforceRateLimit('bookingResend', ctx.ip);
    const body = await ctx.body();
    const generic = { message: 'If there is an upcoming booking for this email address, we have sent its link there.' };
    // Honeypot: a filled hidden field gets the normal answer and nothing is sent.
    if (body.website) return ok(ctx, generic);
    const { email } = createValidator(body).email('email').done();
    await enforceRateLimit('bookingResend', `email:${email}`);
    await resendManageLinks(email);
    // Same answer whether or not bookings exist, so addresses cannot be probed.
    return ok(ctx, generic);
});

router.post('/api/v1/employee-invitations/lookup', async (ctx) => {
    await enforceRateLimit('invitation', ctx.ip);
    const { token } = createValidator(await ctx.body()).text('token', { required: true, max: 100 }).done();
    return ok(ctx, await employees.lookupInvitation(token));
});

/* ── Signed in: notifications ─────────────────────────────────────────────── */

router.get('/api/v1/me/notifications', async (ctx) => {
    const user = await requireUser(ctx);
    return ok(ctx, await inbox.listForUser(user.id, { unreadOnly: ctx.query.get('unread') === 'true' }));
});

router.post('/api/v1/me/notifications/read', async (ctx) => {
    const user = await requireUser(ctx);
    const body = await ctx.body();
    const ids = body.ids;
    if (ids !== undefined && !(Array.isArray(ids) && ids.length <= 100 && ids.every(isUuid))) throw badRequest('ids must be a list of notification ids');
    return ok(ctx, await inbox.markRead(user.id, ids || null));
});

/* ── Student ──────────────────────────────────────────────────────────────── */

router.get('/api/v1/me/dashboard', async (ctx) => ok(ctx, await dashboards.studentOverview(await requirePermission(ctx, 'self.dashboard'))));

router.get('/api/v1/me/profile', async (ctx) => ok(ctx, await dashboards.getProfile(await requirePermission(ctx, 'self.profile'))));

const PROFILE_TEXT = [
    ['intendedIntake', 40, 'Intended intake'], ['studyLevel', 80, 'Study level'], ['preferredCourse', 200, 'Preferred course'],
    ['highestQualification', 200, 'Highest qualification'], ['academicScore', 80, 'Academic score'], ['englishTest', 40, 'English test'],
    ['englishScore', 40, 'English score'], ['budgetRange', 40, 'Budget'], ['consultationLanguage', 40, 'Consultation language'],
];

router.patch('/api/v1/me/profile', async (ctx) => {
    const user = await requirePermission(ctx, 'self.profile');
    const body = await ctx.body();
    const v = createValidator(body).text('firstName', { max: 120, label: 'First name' }).text('lastName', { max: 120, label: 'Last name' }).phone('phone', { required: false });
    for (const [name, max, label] of PROFILE_TEXT) v.text(name, { max, label });
    if (body.firstName !== undefined) v.check(typeof body.firstName === 'string' && body.firstName.trim().length > 0, 'firstName', 'First name is required');
    const destinations = stringList(v, body, 'destinations', { max: 5, label: 'Destinations' });
    const input = v.done();
    // Any field not listed above (email, role, status…) is ignored, never written.
    const patch = {};
    for (const key of ['firstName', 'lastName', 'phone', ...PROFILE_TEXT.map(([name]) => name)]) {
        if (body[key] === '' || body[key] === null) patch[key] = key === 'firstName' ? undefined : '';
        else if (input[key] !== undefined) patch[key] = input[key];
    }
    if (destinations !== undefined) patch.destinations = destinations;
    if (!Object.values(patch).some((value) => value !== undefined)) throw badRequest('Nothing to update.');
    return ok(ctx, await dashboards.updateProfile(user, patch));
});

/* ── Consultant applications (applicant) ──────────────────────────────────── */

function applicationInput(body, { partial }) {
    const required = !partial;
    const v = createValidator(body)
        .text('fullName', { required, max: 240, min: 2, label: 'Full name' })
        .phone('phone', { required })
        .text('location', { required, max: 120, label: 'Current location' })
        .text('professionalExperience', { required, max: 3000, label: 'Professional experience' })
        .text('education', { required, max: 2000, label: 'Education and qualifications' })
        .text('counsellingExperience', { max: 3000, label: 'Counselling experience' })
        .oneOf('availability', ['full_time', 'part_time', 'contract'], { required, label: 'Availability' })
        .text('additionalInfo', { max: 2000, label: 'Additional information' })
        .uuid('cvDocumentId', { label: 'CV' });
    if (required || body.yearsExperience !== undefined) {
        v.check(Number.isInteger(body.yearsExperience) && body.yearsExperience >= 0 && body.yearsExperience <= 60, 'yearsExperience', 'Years of experience must be a whole number from 0 to 60');
    }
    if (!partial) v.boolean('consent', { mustBeTrue: true, message: 'Please agree to the recruitment process to apply.' });
    const languages = stringList(v, body, 'languages', { label: 'Languages' });
    const expertise = stringList(v, body, 'expertise', { label: 'Areas of expertise' });
    const cvUrl = httpsUrl(v, body, 'cvUrl', 'CV link');
    const input = v.done();
    delete input.consent;
    return {
        ...input,
        ...(body.yearsExperience !== undefined ? { yearsExperience: body.yearsExperience } : {}),
        ...(languages !== undefined ? { languages } : {}),
        ...(expertise !== undefined ? { expertise } : {}),
        ...(cvUrl !== undefined ? { cvUrl } : {}),
    };
}

router.get('/api/v1/me/consultant-applications', async (ctx) => ok(ctx, await applications.listMine(await requirePermission(ctx, 'consultant_application.apply'))));

router.post('/api/v1/me/consultant-applications', async (ctx) => {
    const user = await requirePermission(ctx, 'consultant_application.apply');
    await enforceRateLimit('consultantApplication', user.id);
    return ok(ctx, await applications.submit(user, applicationInput(await ctx.body(), { partial: false })), 201);
});

router.get('/api/v1/me/consultant-applications/:id', async (ctx) => {
    const user = await requirePermission(ctx, 'consultant_application.apply');
    return ok(ctx, await applications.getMine(user, param(ctx)));
});

router.patch('/api/v1/me/consultant-applications/:id', async (ctx) => {
    const user = await requirePermission(ctx, 'consultant_application.apply');
    return ok(ctx, await applications.updateMine(user, param(ctx), applicationInput(await ctx.body(), { partial: true })));
});

router.post('/api/v1/me/consultant-applications/:id/withdraw', async (ctx) => {
    const user = await requirePermission(ctx, 'consultant_application.apply');
    return ok(ctx, await applications.withdrawMine(user, param(ctx)));
});

/* ── Employee invitation (invitee) ────────────────────────────────────────── */

router.post('/api/v1/me/employee-invitations/accept', async (ctx) => {
    const user = await requireUser(ctx);
    await enforceRateLimit('invitation', user.id);
    const { token } = createValidator(await ctx.body()).text('token', { max: 100 }).done();
    return ok(ctx, await employees.acceptInvitation(user, token || null));
});

router.get('/api/v1/me/employee-invitations/pending', async (ctx) => {
    const user = await requireUser(ctx);
    return ok(ctx, { invitation: await employees.myPendingInvitation(user) });
});

/* ── Consultant workspace ─────────────────────────────────────────────────── */

router.get('/api/v1/consultant/dashboard', async (ctx) => {
    const staff = await requirePermission(ctx, 'staff.workspace');
    const { timezone } = createValidator(queryOf(ctx)).timeZone('timezone', { required: false }).done();
    return ok(ctx, await dashboards.consultantOverview(staff, timezone || 'Asia/Kolkata'));
});

router.get('/api/v1/consultant/students', async (ctx) => {
    const staff = await requirePermission(ctx, 'students.assigned');
    const input = createValidator(queryOf(ctx)).text('q', { max: 100 }).text('destination', { max: 80 }).oneOf('sort', ['name', 'recent', 'follow_up']).done();
    return ok(ctx, await dashboards.listStudents(staff, { ...input, ...pageParams(ctx.query) }));
});

router.get('/api/v1/consultant/follow-ups', async (ctx) => {
    const staff = await requirePermission(ctx, 'followups.own');
    const input = createValidator(queryOf(ctx)).oneOf('status', ['open', 'done', 'cancelled', 'all']).uuid('assignee_id').done();
    return ok(ctx, await followUps.listFollowUps(staff, { status: input.status || 'open', assigneeId: input.assignee_id || null }));
});

router.post('/api/v1/consultant/follow-ups', async (ctx) => {
    const staff = await requirePermission(ctx, 'followups.own');
    const input = createValidator(await ctx.body())
        .text('title', { required: true, max: 200, label: 'Title' })
        .text('details', { max: 2000, label: 'Details' })
        .instant('dueAt', { required: false, label: 'Due date' })
        .oneOf('priority', ['low', 'normal', 'high'], { label: 'Priority' })
        .uuid('studentUserId').uuid('leadId').uuid('consultationId').uuid('assigneeUserId')
        .done();
    return ok(ctx, await followUps.createFollowUp(staff, input), 201);
});

router.patch('/api/v1/consultant/follow-ups/:id', async (ctx) => {
    const staff = await requirePermission(ctx, 'followups.own');
    const body = await ctx.body();
    const input = createValidator(body)
        .text('title', { max: 200, label: 'Title' }).text('details', { max: 2000, label: 'Details' })
        .instant('dueAt', { required: false, label: 'Due date' })
        .oneOf('priority', ['low', 'normal', 'high'], { label: 'Priority' })
        .oneOf('status', ['open', 'done', 'cancelled'], { label: 'Status' })
        .done();
    if (body.dueAt === null) input.dueAt = null;
    return ok(ctx, await followUps.updateFollowUp(staff, param(ctx), input));
});

/* ── Leads (admins: all; counsellors: assigned to them) ───────────────────── */

router.get('/api/v1/admin/leads', async (ctx) => {
    const staff = await requirePermission(ctx, 'leads.assigned');
    const q = queryOf(ctx);
    const v = createValidator(q)
        .oneOf('status', [...leads.LEAD_STATUSES, 'open'], { label: 'status' })
        .oneOf('source', ['consultation', 'contact', 'newsletter', 'booking'], { label: 'source' })
        .text('q', { max: 100 });
    v.check(!q.assigned || q.assigned === 'none' || isUuid(q.assigned), 'assigned', 'assigned must be a counsellor id or "none"');
    const input = v.done();
    return ok(ctx, await leads.listLeads(staff, {
        ...input, assigned: q.assigned || null, guestOnly: q.guest === 'true', followUpDue: q.follow_up_due === 'true', ...pageParams(ctx.query),
    }));
});

router.get('/api/v1/admin/leads/:id', async (ctx) => ok(ctx, await leads.getLead(await requirePermission(ctx, 'leads.assigned'), param(ctx))));

router.patch('/api/v1/admin/leads/:id', async (ctx) => {
    const staff = await requirePermission(ctx, 'leads.assigned');
    const body = await ctx.body();
    const v = createValidator(body).oneOf('status', leads.LEAD_STATUSES, { label: 'Status' }).instant('nextFollowUpAt', { required: false, label: 'Next follow-up' });
    if (body.assignedCounsellorId !== undefined && body.assignedCounsellorId !== null) v.uuid('assignedCounsellorId', { label: 'Counsellor' });
    const input = v.done();
    return ok(ctx, await leads.updateLead(staff, param(ctx), {
        status: input.status,
        ...(body.nextFollowUpAt !== undefined ? { nextFollowUpAt: input.nextFollowUpAt || null } : {}),
        ...(body.assignedCounsellorId !== undefined ? { assignedCounsellorId: input.assignedCounsellorId || null } : {}),
    }));
});

router.post('/api/v1/admin/leads/:id/activities', async (ctx) => {
    const staff = await requirePermission(ctx, 'leads.assigned');
    const body = await ctx.body();
    const v = createValidator(body).oneOf('kind', ['note', 'contact_attempt'], { required: true, label: 'Kind' }).text('body', { required: body.kind === 'note', max: 2000, label: 'Note' });
    if (body.kind === 'contact_attempt') v.oneOf('channel', ['phone', 'email', 'whatsapp', 'other'], { required: true, label: 'Channel' });
    return ok(ctx, await leads.addActivity(staff, param(ctx), v.done()), 201);
});

/* ── Admin: overview, users, audit ────────────────────────────────────────── */

router.get('/api/v1/admin/overview', async (ctx) => {
    await requirePermission(ctx, 'admin.dashboard');
    return ok(ctx, await dashboards.adminOverview());
});

/* Staff for pickers (reviewers, managers, assignees). */
router.get('/api/v1/admin/staff', async (ctx) => {
    await requirePermission(ctx, 'users.view');
    const { rows } = await query(
        `SELECT u.id, u.first_name, u.last_name, u.role, co.is_active AS takes_consultations FROM users u
         LEFT JOIN counsellors co ON co.user_id = u.id WHERE u.role = ANY($1) AND u.status = 'active' ORDER BY u.first_name`,
        [STAFF_ROLES],
    );
    return ok(ctx, rows.map((r) => ({ id: r.id, name: [r.first_name, r.last_name].filter(Boolean).join(' '), role: r.role, takesConsultations: Boolean(r.takes_consultations) })));
});

router.get('/api/v1/admin/users', async (ctx) => {
    await requirePermission(ctx, 'users.view');
    const input = createValidator(queryOf(ctx))
        .text('q', { max: 100 })
        .oneOf('role', ['student', 'counsellor', 'admin', 'super_admin'], { label: 'role' })
        .oneOf('status', ['active', 'disabled'], { label: 'status' })
        .done();
    return ok(ctx, await users.listUsers({ ...input, ...pageParams(ctx.query) }));
});

router.get('/api/v1/admin/users/:id', async (ctx) => {
    await requirePermission(ctx, 'users.view');
    return ok(ctx, await users.getUser(param(ctx)));
});

router.patch('/api/v1/admin/users/:id/status', async (ctx) => {
    const actor = await requirePermission(ctx, 'users.suspend');
    const input = createValidator(await ctx.body())
        .oneOf('status', ['active', 'disabled'], { required: true, label: 'Status' })
        .text('reason', { required: true, max: 500, min: 3, label: 'Reason' })
        .done();
    return ok(ctx, await users.setStatus(actor, param(ctx), input));
});

router.post('/api/v1/admin/users/:id/link-record', async (ctx) => {
    const actor = await requirePermission(ctx, 'users.link_records');
    const input = createValidator(await ctx.body()).uuid('leadId').uuid('consultationId').text('reason', { required: true, max: 500, min: 3, label: 'Reason' }).done();
    return ok(ctx, await users.linkRecord(actor, param(ctx), input));
});

router.post('/api/v1/admin/users/:id/role-change-requests', async (ctx) => {
    const actor = await requirePermission(ctx, 'approvals.request');
    const input = createValidator(await ctx.body())
        .oneOf('requestedRole', STAFF_ROLES, { required: true, label: 'Role' })
        .text('reason', { required: true, max: 1000, min: 3, label: 'Reason' })
        .done();
    return ok(ctx, await approvals.requestRoleChange(actor, param(ctx), input), 201);
});

router.post('/api/v1/admin/users/:id/revocation-requests', async (ctx) => {
    const actor = await requirePermission(ctx, 'approvals.request');
    const input = createValidator(await ctx.body())
        .text('reason', { required: true, max: 1000, min: 3, label: 'Reason' })
        .uuid('reassignToCounsellorId', { label: 'Counsellor' })
        .done();
    return ok(ctx, await approvals.requestRevocation(actor, param(ctx), input), 201);
});

router.get('/api/v1/admin/audit-logs', async (ctx) => {
    await requirePermission(ctx, 'audit.view');
    const q = queryOf(ctx);
    const v = createValidator(q)
        .text('action', { max: 60 }).text('entity_type', { max: 40 }).text('entity_id', { max: 64 }).uuid('actor_id')
        .instant('from', { required: false, label: 'from' }).instant('to', { required: false, label: 'to' });
    const input = v.done();
    return ok(ctx, await users.listAudit({
        action: input.action, entityType: input.entity_type, entityId: input.entity_id, actorId: input.actor_id, from: input.from, to: input.to, ...pageParams(ctx.query),
    }));
});

/* ── Admin: consultant applications ───────────────────────────────────────── */

router.get('/api/v1/admin/consultant-applications', async (ctx) => {
    await requirePermission(ctx, 'consultant_application.review');
    const { status } = createValidator(queryOf(ctx)).oneOf('status', applications.ALL_STATUSES, { label: 'status' }).done();
    return ok(ctx, await applications.listForReview({ status, ...pageParams(ctx.query) }));
});

router.get('/api/v1/admin/consultant-applications/:id', async (ctx) => {
    await requirePermission(ctx, 'consultant_application.review');
    return ok(ctx, await applications.getForReview(param(ctx)));
});

router.post('/api/v1/admin/consultant-applications/:id/notes', async (ctx) => {
    const reviewer = await requirePermission(ctx, 'consultant_application.review');
    const { note } = createValidator(await ctx.body()).text('note', { required: true, max: 2000, label: 'Note' }).done();
    return ok(ctx, await applications.addNote(reviewer, param(ctx), note), 201);
});

router.post('/api/v1/admin/consultant-applications/:id/reviewer', async (ctx) => {
    const actor = await requirePermission(ctx, 'consultant_application.review');
    const { reviewerId } = createValidator(await ctx.body()).uuid('reviewerId', { required: true, label: 'Reviewer' }).done();
    return ok(ctx, await applications.assignReviewer(actor, param(ctx), reviewerId));
});

router.post('/api/v1/admin/consultant-applications/:id/transition', async (ctx) => {
    const reviewer = await requirePermission(ctx, 'consultant_application.decide');
    const body = await ctx.body();
    const v = createValidator(body)
        .oneOf('status', applications.ALL_STATUSES.filter((s) => !['submitted', 'withdrawn'].includes(s)), { required: true, label: 'Status' })
        .text('note', { max: 2000, label: 'Private note' })
        .text('message', { max: 1000, label: 'Message to the applicant' })
        .instant('interviewAt', { required: false, label: 'Interview time' });
    let job;
    if (body.job !== undefined) {
        const jv = createValidator(body.job).text('department', { max: 80, label: 'Department' }).text('jobTitle', { max: 120, label: 'Job title' }).uuid('managerUserId', { label: 'Manager' });
        if (body.job?.startDate) jv.check(/^\d{4}-\d{2}-\d{2}$/.test(String(body.job.startDate)), 'startDate', 'Start date must be YYYY-MM-DD');
        job = { ...jv.done(), startDate: body.job?.startDate || null };
    }
    return ok(ctx, await applications.transition(reviewer, param(ctx), { ...v.done(), job }));
});

/* ── Admin: employees and invitations ─────────────────────────────────────── */

router.get('/api/v1/admin/employees', async (ctx) => {
    await requirePermission(ctx, 'employees.view');
    const { status } = createValidator(queryOf(ctx)).oneOf('status', ['pending', 'active', 'terminated'], { label: 'status' }).done();
    return ok(ctx, await employees.listEmployees({ status }));
});

router.get('/api/v1/admin/employees/invitations', async (ctx) => {
    await requirePermission(ctx, 'employees.view');
    const { status } = createValidator(queryOf(ctx)).oneOf('status', ['pending', 'accepted', 'revoked'], { label: 'status' }).done();
    return ok(ctx, await employees.listInvitations({ status }));
});

router.post('/api/v1/admin/employees/invitations', async (ctx) => {
    const actor = await requirePermission(ctx, 'employees.invite');
    const body = await ctx.body();
    const v = createValidator(body)
        .email('email', { label: 'Email address' })
        .text('fullName', { required: true, max: 240, min: 2, label: 'Full name' })
        .email('workEmail', { required: false, label: 'Work email' })
        .text('employeeCode', { max: 40, label: 'Employee ID' })
        .text('department', { required: true, max: 80, label: 'Department' })
        .text('jobTitle', { required: true, max: 120, label: 'Job title' })
        .oneOf('intendedRole', ['counsellor', 'admin'], { required: true, label: 'System role' })
        .uuid('managerUserId', { label: 'Manager' });
    if (body.startDate) v.check(/^\d{4}-\d{2}-\d{2}$/.test(String(body.startDate)), 'startDate', 'Start date must be YYYY-MM-DD');
    const input = v.done();
    return ok(ctx, await employees.createInvitation(actor, { ...input, startDate: body.startDate || null }), 201);
});

router.post('/api/v1/admin/employees/invitations/:id/revoke', async (ctx) => {
    const actor = await requirePermission(ctx, 'employees.invite');
    return ok(ctx, await employees.revokeInvitation(actor, param(ctx)));
});

/* ── Admin: approvals ─────────────────────────────────────────────────────── */

router.get('/api/v1/admin/approvals', async (ctx) => {
    const viewer = await requirePermission(ctx, 'approvals.view');
    const input = createValidator(queryOf(ctx))
        .oneOf('status', ['pending', 'info_requested', 'approved', 'rejected', 'cancelled'], { label: 'status' })
        .oneOf('type', ['employee_activation', 'role_change', 'access_revocation'], { label: 'type' })
        .done();
    return ok(ctx, await approvals.listRequests(viewer, { ...input, ...pageParams(ctx.query) }));
});

router.get('/api/v1/admin/approvals/:id', async (ctx) => {
    const viewer = await requirePermission(ctx, 'approvals.view');
    return ok(ctx, await approvals.getRequest(viewer, param(ctx)));
});

const comment = async (ctx, required) => createValidator(await ctx.body()).text('comment', { required, max: 1000, label: 'Comment' }).done();

router.post('/api/v1/admin/approvals/:id/approve', async (ctx) => {
    const actor = await requirePermission(ctx, 'approvals.decide');
    return ok(ctx, await approvals.approve(actor, param(ctx), await comment(ctx, false)));
});

router.post('/api/v1/admin/approvals/:id/reject', async (ctx) => {
    const actor = await requirePermission(ctx, 'approvals.decide');
    return ok(ctx, await approvals.reject(actor, param(ctx), await comment(ctx, true)));
});

router.post('/api/v1/admin/approvals/:id/request-information', async (ctx) => {
    const actor = await requirePermission(ctx, 'approvals.decide');
    return ok(ctx, await approvals.requestInformation(actor, param(ctx), await comment(ctx, true)));
});

router.post('/api/v1/admin/approvals/:id/respond', async (ctx) => {
    const actor = await requirePermission(ctx, 'approvals.request');
    return ok(ctx, await approvals.respond(actor, param(ctx), await comment(ctx, true)));
});

router.post('/api/v1/admin/approvals/:id/cancel', async (ctx) => {
    const actor = await requirePermission(ctx, 'approvals.request');
    return ok(ctx, await approvals.cancel(actor, param(ctx)));
});

/* ── Dispatcher ───────────────────────────────────────────────────────────── */

export async function platformApiRoute(request, response, pathname) {
    const match = router.match(request.method, pathname);
    if (!match) return false;
    if (match.methodNotAllowed) {
        sendJson(response, 405, { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
        return true;
    }
    const ctx = createContext(request, response, new URL(request.url, 'http://localhost'), match.params);
    try {
        checkOrigin(ctx);
        await checkCsrf(ctx);
        await match.handler(ctx);
    } catch (error) {
        sendError(response, error);
    }
    return true;
}
