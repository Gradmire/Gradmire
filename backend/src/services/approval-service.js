/* Approval requests: the only way staff access is granted, changed or removed
   through the application (the CLI remains the audited bootstrap path).

   Rules, enforced here and — for the two-person rule — by table constraints:
   - Nobody requests a change to their own access.
   - Nobody decides a request they made or one that targets them.
   - Any change that touches admin or super_admin access needs a super admin.
   - The target's role must still be what it was when the request was made.
   - The last active super admin cannot be removed.
   Approving runs the change and its side effects in one transaction, revokes
   the target's sessions (their next request sees the new role anyway, because
   roles are read from the database on every request) and records audit events.

   Types
     employee_activation — student → counsellor/admin, created when an invitation is accepted
     role_change         — between staff roles (counsellor ↔ admin ↔ super_admin)
     access_revocation   — staff → student; future work is reassigned first */
import { now } from '../lib/clock.js';
import { query, withTransaction } from '../lib/db.js';
import { badRequest, conflict, forbidden, HttpError, notFound } from '../lib/http.js';
import { reassignInTransaction } from './admin-service.js';
import { audit } from './audit.js';
import { notifyUser } from './inbox.js';
import { enqueueNotification } from './notification-service.js';
import { mayDecideRoleChange, mayManageAccount, STAFF_ROLES } from './permissions.js';

const ROLE_LABELS = { student: 'Student', counsellor: 'Consultant', admin: 'Administrator', super_admin: 'Super administrator' };
const OPEN = ['pending', 'info_requested'];
const iso = (value) => (value ? new Date(value).toISOString() : null);
const name = (first, last) => [first, last].filter(Boolean).join(' ');

/* ── Opening requests ─────────────────────────────────────────────────────── */

async function recordEvent(client, requestId, actorUserId, action, comment = null) {
    await client.query('INSERT INTO approval_events (request_id, actor_user_id, action, comment) VALUES ($1, $2, $3, $4)', [requestId, actorUserId, action, comment]);
}

export async function openRequestInTransaction(client, { type, targetUserId, requestedRole, requestedById, reason, relatedEntityType = null, relatedEntityId = null, reassignTo = null }) {
    const target = (await client.query('SELECT id, role, first_name, last_name FROM users WHERE id = $1', [targetUserId])).rows[0];
    if (!target) throw notFound('User not found');
    if (requestedById === targetUserId) throw forbidden('You cannot request a change to your own access.');
    const id = crypto.randomUUID();
    try {
        await client.query(
            `INSERT INTO approval_requests (id, type, target_user_id, from_role, requested_role, requested_by, reason, related_entity_type, related_entity_id, reassign_to_counsellor_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [id, type, targetUserId, target.role, requestedRole, requestedById, reason, relatedEntityType, relatedEntityId, reassignTo],
        );
    } catch (error) {
        if (error.code === '23505' && error.constraint === 'approval_requests_one_open') {
            throw conflict('This person already has an open access request. Decide or cancel it first.', 'REQUEST_OPEN');
        }
        throw error;
    }
    await recordEvent(client, id, requestedById, 'requested', reason);
    await audit(client, { actorUserId: requestedById, action: `approval.${type}_requested`, entityType: 'user', entityId: targetUserId, details: { requestId: id, from: target.role, to: requestedRole } });
    // Possible approvers hear about it; who may actually decide is checked when they do.
    const approvers = await client.query(
        `SELECT id FROM users WHERE status = 'active' AND id <> $1 AND id <> $2
           AND role IN (${['admin', 'super_admin'].includes(requestedRole) || ['admin', 'super_admin'].includes(target.role) ? "'super_admin'" : "'admin', 'super_admin'"})`,
        [requestedById, targetUserId],
    );
    for (const approver of approvers.rows) {
        await notifyUser(client, approver.id, {
            kind: 'approval_requested', title: 'Access request waiting for approval',
            body: `${ROLE_LABELS[requestedRole]} access for ${name(target.first_name, target.last_name)} (${type.replace(/_/g, ' ')}).`, link: 'admin-approvals',
        });
    }
    return { id };
}

async function loadTarget(client, targetId, { lock = false } = {}) {
    const target = (await client.query(`SELECT * FROM users WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [targetId])).rows[0];
    if (!target) throw notFound('User not found');
    return target;
}

/* What would have to move if this person lost their counsellor access. */
async function workload(client, userId) {
    const { rows } = await client.query(
        `SELECT
           (SELECT COUNT(*)::int FROM consultations WHERE counsellor_id = $1 AND status IN ('reserved', 'confirmed') AND scheduled_start > $2) AS consultations,
           (SELECT COUNT(*)::int FROM leads WHERE assigned_counsellor_id = $1 AND status NOT IN ('converted', 'not_interested', 'closed')) AS leads,
           (SELECT COUNT(*)::int FROM follow_up_tasks WHERE assignee_user_id = $1 AND status = 'open') AS tasks`,
        [userId, now()],
    );
    return rows[0];
}

const hasWork = (w) => w.consultations + w.leads + w.tasks > 0;

async function checkReassignTarget(client, reassignTo, targetId) {
    if (reassignTo === targetId) throw badRequest('Choose a different counsellor to take over.', { fields: { reassignToCounsellorId: 'Choose someone else' } });
    const ok = (await client.query(
        "SELECT 1 FROM counsellors co JOIN users u ON u.id = co.user_id WHERE co.user_id = $1 AND co.is_active AND u.status = 'active'",
        [reassignTo],
    )).rows.length;
    if (!ok) throw badRequest('Choose an active counsellor to take over.', { fields: { reassignToCounsellorId: 'Choose an active counsellor' } });
}

export async function requestRoleChange(actor, targetId, { requestedRole, reason }) {
    return withTransaction(async (client) => {
        if (actor.id === targetId) throw forbidden('You cannot request a change to your own access.');
        const target = await loadTarget(client, targetId);
        if (!STAFF_ROLES.includes(target.role)) {
            throw conflict('Students gain staff access through an employee invitation, not a role change.', 'USE_INVITATION');
        }
        if (!STAFF_ROLES.includes(requestedRole)) throw badRequest('Use an access revocation to remove staff access.', { fields: { requestedRole: 'Choose a staff role' } });
        if (requestedRole === target.role) throw badRequest('This person already has that role.', { fields: { requestedRole: 'Choose a different role' } });
        if (!mayManageAccount(actor, target.role)) throw forbidden('Only a super administrator can change an administrator\'s access.');
        return openRequestInTransaction(client, { type: 'role_change', targetUserId: targetId, requestedRole, requestedById: actor.id, reason });
    });
}

export async function requestRevocation(actor, targetId, { reason, reassignToCounsellorId = null }) {
    return withTransaction(async (client) => {
        if (actor.id === targetId) throw forbidden('You cannot request a change to your own access.');
        const target = await loadTarget(client, targetId);
        if (!STAFF_ROLES.includes(target.role)) throw conflict('This person has no staff access to revoke.', 'NOT_STAFF');
        if (!mayManageAccount(actor, target.role)) throw forbidden('Only a super administrator can revoke an administrator\'s access.');
        const work = await workload(client, targetId);
        if (reassignToCounsellorId) await checkReassignTarget(client, reassignToCounsellorId, targetId);
        else if (hasWork(work)) {
            throw new HttpError(422, `This person has ${work.consultations} upcoming consultation(s), ${work.leads} open enquiry(ies) and ${work.tasks} open task(s). Choose who takes them over.`, 'REASSIGNMENT_REQUIRED', { fields: { reassignToCounsellorId: 'Choose who takes over their work' } });
        }
        return openRequestInTransaction(client, {
            type: 'access_revocation', targetUserId: targetId, requestedRole: 'student', requestedById: actor.id, reason, reassignTo: reassignToCounsellorId,
        });
    });
}

/* ── Reading ──────────────────────────────────────────────────────────────── */

const REQUEST_SELECT = `
  SELECT r.*, t.first_name AS t_first, t.last_name AS t_last, t.email AS t_email, t.role AS t_role, t.status AS t_status,
         q.first_name AS q_first, q.last_name AS q_last, d.first_name AS d_first, d.last_name AS d_last,
         co.display_name AS reassign_name
  FROM approval_requests r
  JOIN users t ON t.id = r.target_user_id
  JOIN users q ON q.id = r.requested_by
  LEFT JOIN users d ON d.id = r.decided_by
  LEFT JOIN counsellors co ON co.user_id = r.reassign_to_counsellor_id`;

function requestView(r, viewer) {
    const isOpen = OPEN.includes(r.status);
    const personallyBlocked = viewer && (viewer.id === r.requested_by || viewer.id === r.target_user_id);
    return {
        id: r.id,
        type: r.type,
        status: r.status,
        target: { id: r.target_user_id, name: name(r.t_first, r.t_last), email: r.t_email, currentRole: r.t_role, accountStatus: r.t_status },
        fromRole: r.from_role,
        requestedRole: r.requested_role,
        reason: r.reason,
        reviewerComment: r.reviewer_comment,
        requestedBy: { id: r.requested_by, name: name(r.q_first, r.q_last) },
        decidedBy: r.decided_by ? { id: r.decided_by, name: name(r.d_first, r.d_last) } : null,
        decidedAt: iso(r.decided_at),
        reassignTo: r.reassign_to_counsellor_id ? { id: r.reassign_to_counsellor_id, name: r.reassign_name } : null,
        relatedEntity: r.related_entity_type ? { type: r.related_entity_type, id: r.related_entity_id } : null,
        createdAt: iso(r.created_at),
        updatedAt: iso(r.updated_at),
        // Hints for the UI; the server re-checks everything on submit.
        canDecide: Boolean(viewer && r.status === 'pending' && !personallyBlocked && mayDecideRoleChange(viewer, r.from_role, r.requested_role)),
        canRequestInfo: Boolean(viewer && r.status === 'pending' && !personallyBlocked && mayDecideRoleChange(viewer, r.from_role, r.requested_role)),
        canRespond: Boolean(viewer && r.status === 'info_requested' && viewer.id === r.requested_by),
        canCancel: Boolean(viewer && isOpen && viewer.id === r.requested_by),
    };
}

export async function listRequests(viewer, { status, type, page, pageSize }) {
    const values = [status || null, type || null];
    const where = "WHERE ($1::text IS NULL OR r.status = $1) AND ($2::text IS NULL OR r.type = $2)";
    const [list, count] = await Promise.all([
        query(`${REQUEST_SELECT} ${where} ORDER BY (r.status IN ('pending', 'info_requested')) DESC, r.created_at DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, values),
        query(`SELECT COUNT(*)::int AS total FROM approval_requests r ${where}`, values),
    ]);
    return { items: list.rows.map((r) => requestView(r, viewer)), page, pageSize, total: count.rows[0].total };
}

export async function getRequest(viewer, id) {
    const { rows } = await query(`${REQUEST_SELECT} WHERE r.id = $1`, [id]);
    if (!rows[0]) throw notFound('Request not found');
    const [events, work] = await Promise.all([
        query(
            `SELECT e.action, e.comment, e.created_at, u.first_name, u.last_name FROM approval_events e
             LEFT JOIN users u ON u.id = e.actor_user_id WHERE e.request_id = $1 ORDER BY e.id`,
            [id],
        ),
        workload({ query }, rows[0].target_user_id),
    ]);
    return {
        ...requestView(rows[0], viewer),
        workload: work,
        history: events.rows.map((e) => ({ action: e.action, comment: e.comment, actor: name(e.first_name, e.last_name), at: iso(e.created_at) })),
    };
}

/* ── Deciding ─────────────────────────────────────────────────────────────── */

async function lockRequest(client, id) {
    const r = (await client.query('SELECT * FROM approval_requests WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!r) throw notFound('Request not found');
    return r;
}

function assertMayDecide(actor, r) {
    if (actor.id === r.requested_by) throw forbidden('A request must be decided by someone other than the person who made it.');
    if (actor.id === r.target_user_id) throw forbidden('You cannot decide a request about your own access.');
    if (!mayDecideRoleChange(actor, r.from_role, r.requested_role)) {
        throw forbidden('Only a super administrator can decide changes to administrator access.');
    }
}

async function revokeSessions(client, userId) {
    await client.query('UPDATE sessions SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL', [userId, now()]);
}

async function assertNotLastSuperAdmin(client, target, newRole) {
    if (target.role !== 'super_admin' || newRole === 'super_admin') return;
    const others = (await client.query("SELECT COUNT(*)::int AS n FROM users WHERE role = 'super_admin' AND status = 'active' AND id <> $1", [target.id])).rows[0].n;
    if (!others) throw conflict('This is the last active super administrator. Appoint another one first.', 'LAST_SUPER_ADMIN');
}

/* Counsellor working profile: created or switched on for counsellors; admins keep theirs as it was. */
async function ensureCounsellorProfile(client, target, role) {
    await client.query(
        `INSERT INTO counsellors (user_id, display_name, is_active) VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET is_active = CASE WHEN $3 THEN TRUE ELSE counsellors.is_active END, updated_at = NOW()`,
        [target.id, name(target.first_name, target.last_name), role === 'counsellor'],
    );
}

async function applyGrant(client, actor, r, target) {
    await client.query('UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1', [target.id, r.requested_role]);
    await ensureCounsellorProfile(client, target, r.requested_role);
    // Staff created by the CLI may have no employee profile yet; give them a minimal one.
    await client.query(
        `INSERT INTO employee_profiles (user_id, department, job_title, system_role, employment_status, approved_by, approved_at)
         VALUES ($1, 'Unassigned', $2, $3, 'active', $4, $5)
         ON CONFLICT (user_id) DO UPDATE SET system_role = EXCLUDED.system_role, employment_status = 'active',
           approved_by = EXCLUDED.approved_by, approved_at = EXCLUDED.approved_at, terminated_by = NULL, terminated_at = NULL, updated_at = NOW()`,
        [target.id, ROLE_LABELS[r.requested_role], r.requested_role, actor.id, now()],
    );
    return {};
}

async function applyRevocation(client, actor, r, target) {
    const work = await workload(client, target.id);
    if (hasWork(work) && !r.reassign_to_counsellor_id) {
        throw new HttpError(422, 'This person still has upcoming work and the request names nobody to take it over. Reject it and request again with a counsellor.', 'REASSIGNMENT_REQUIRED');
    }
    const to = r.reassign_to_counsellor_id;
    let moved = { consultations: 0, leads: 0, tasks: 0 };
    if (to) {
        await checkReassignTarget(client, to, target.id);
        const upcoming = await client.query(
            "SELECT * FROM consultations WHERE counsellor_id = $1 AND status IN ('reserved', 'confirmed') AND scheduled_start > $2 ORDER BY scheduled_start FOR UPDATE",
            [target.id, now()],
        );
        for (const c of upcoming.rows) await reassignInTransaction(client, actor.id, c, to);
        const leads = await client.query(
            "UPDATE leads SET assigned_counsellor_id = $2, updated_at = NOW() WHERE assigned_counsellor_id = $1 AND status NOT IN ('converted', 'not_interested', 'closed') RETURNING id",
            [target.id, to],
        );
        for (const lead of leads.rows) {
            await client.query("INSERT INTO lead_activities (lead_id, actor_user_id, kind, details) VALUES ($1, $2, 'assigned', $3)", [lead.id, actor.id, JSON.stringify({ from: target.id, to, reason: 'access_revoked' })]);
        }
        const tasks = await client.query("UPDATE follow_up_tasks SET assignee_user_id = $2, updated_at = NOW() WHERE assignee_user_id = $1 AND status = 'open' RETURNING id", [target.id, to]);
        moved = { consultations: upcoming.rows.length, leads: leads.rowCount, tasks: tasks.rowCount };
        if (hasWork(moved)) {
            await notifyUser(client, to, { kind: 'work_reassigned', title: 'Work reassigned to you', body: `${moved.consultations} consultation(s), ${moved.leads} enquiry(ies) and ${moved.tasks} task(s) were moved to you.`, link: 'consultant-dashboard' });
        }
    }
    // Past consultations keep pointing at the (now inactive) counsellor row: history stays intact.
    await client.query('UPDATE counsellors SET is_active = FALSE, updated_at = NOW() WHERE user_id = $1', [target.id]);
    await client.query("UPDATE users SET role = 'student', updated_at = NOW() WHERE id = $1", [target.id]);
    await client.query(
        "UPDATE employee_profiles SET employment_status = 'terminated', terminated_by = $2, terminated_at = $3, updated_at = NOW() WHERE user_id = $1",
        [target.id, actor.id, now()],
    );
    return { moved };
}

const CHANGE_MESSAGE = {
    employee_activation: (r) => ({ subject: 'Your Gradmire staff access is active', message: `Your ${ROLE_LABELS[r.requested_role].toLowerCase()} access has been approved. Your workspace is ready the next time you log in.` }),
    role_change: (r) => ({ subject: 'Your Gradmire access has changed', message: `Your role changed from ${ROLE_LABELS[r.from_role]} to ${ROLE_LABELS[r.requested_role]}.` }),
    access_revocation: () => ({ subject: 'Your Gradmire staff access has ended', message: 'Your staff access has been removed. Your personal account and any student records stay available.' }),
};

export async function approve(actor, id, { comment = null } = {}) {
    return withTransaction(async (client) => {
        const r = await lockRequest(client, id);
        if (r.status !== 'pending') throw conflict('Only a pending request can be approved.', 'NOT_PENDING');
        assertMayDecide(actor, r);
        const target = await loadTarget(client, r.target_user_id, { lock: true });
        if (target.role !== r.from_role) throw conflict('This person\'s role changed since the request was made. Reject it and create a new one.', 'STALE_REQUEST');
        if (target.status !== 'active') throw conflict('This account is suspended. Reactivate it before changing its access.', 'ACCOUNT_SUSPENDED');
        await assertNotLastSuperAdmin(client, target, r.requested_role);

        const outcome = r.type === 'access_revocation' ? await applyRevocation(client, actor, r, target) : await applyGrant(client, actor, r, target);
        await revokeSessions(client, target.id);
        await client.query(
            "UPDATE approval_requests SET status = 'approved', decided_by = $2, decided_at = $3, reviewer_comment = $4, updated_at = NOW() WHERE id = $1",
            [id, actor.id, now(), comment],
        );
        await recordEvent(client, id, actor.id, 'approved', comment);
        await audit(client, {
            actorUserId: actor.id, action: r.type === 'access_revocation' ? 'role.revoked' : 'role.granted', entityType: 'user', entityId: target.id,
            details: { requestId: id, type: r.type, before: { role: target.role }, after: { role: r.requested_role }, requestedBy: r.requested_by, ...outcome },
        });
        const { subject, message } = CHANGE_MESSAGE[r.type](r);
        await notifyUser(client, target.id, { kind: 'access_changed', title: subject, body: message, link: 'login' });
        await enqueueNotification(client, {
            userId: target.id, template: 'access_changed', recipient: target.email, dedupeKey: `approval:${id}:approved`,
            payload: { firstName: target.first_name, subject, message },
        });
        await notifyUser(client, r.requested_by, { kind: 'approval_decided', title: 'Your access request was approved', body: `${name(target.first_name, target.last_name)}: ${ROLE_LABELS[r.requested_role]}.`, link: 'admin-approvals' });
        return getRequestIn(client, actor, id, outcome);
    });
}

export async function reject(actor, id, { comment }) {
    return withTransaction(async (client) => {
        const r = await lockRequest(client, id);
        if (!OPEN.includes(r.status)) throw conflict('Only an open request can be rejected.', 'NOT_OPEN');
        assertMayDecide(actor, r);
        await client.query(
            "UPDATE approval_requests SET status = 'rejected', decided_by = $2, decided_at = $3, reviewer_comment = $4, updated_at = NOW() WHERE id = $1",
            [id, actor.id, now(), comment],
        );
        if (r.type === 'employee_activation') {
            // Onboarding closed without access; the profile stays as a record.
            await client.query("UPDATE employee_profiles SET employment_status = 'terminated', terminated_by = $2, terminated_at = $3, updated_at = NOW() WHERE user_id = $1 AND employment_status = 'pending'", [r.target_user_id, actor.id, now()]);
            await notifyUser(client, r.target_user_id, { kind: 'access_changed', title: 'Your onboarding was not approved', body: 'Your staff access was not activated. Contact the person who invited you if you have questions.', link: 'dashboard' });
        }
        await recordEvent(client, id, actor.id, 'rejected', comment);
        await audit(client, { actorUserId: actor.id, action: 'approval.rejected', entityType: 'user', entityId: r.target_user_id, details: { requestId: id, type: r.type, requestedRole: r.requested_role } });
        await notifyUser(client, r.requested_by, { kind: 'approval_decided', title: 'Your access request was rejected', body: comment, link: 'admin-approvals' });
        return getRequestIn(client, actor, id);
    });
}

export async function requestInformation(actor, id, { comment }) {
    return withTransaction(async (client) => {
        const r = await lockRequest(client, id);
        if (r.status !== 'pending') throw conflict('Only a pending request can be sent back for information.', 'NOT_PENDING');
        assertMayDecide(actor, r);
        await client.query("UPDATE approval_requests SET status = 'info_requested', reviewer_comment = $2, updated_at = NOW() WHERE id = $1", [id, comment]);
        await recordEvent(client, id, actor.id, 'info_requested', comment);
        await notifyUser(client, r.requested_by, { kind: 'approval_info_requested', title: 'More information needed on an access request', body: comment, link: 'admin-approvals' });
        return getRequestIn(client, actor, id);
    });
}

export async function respond(actor, id, { comment }) {
    return withTransaction(async (client) => {
        const r = await lockRequest(client, id);
        if (r.status !== 'info_requested') throw conflict('This request is not waiting for information.', 'NOT_WAITING');
        if (actor.id !== r.requested_by) throw forbidden('Only the person who made the request can answer.');
        await client.query("UPDATE approval_requests SET status = 'pending', updated_at = NOW() WHERE id = $1", [id]);
        await recordEvent(client, id, actor.id, 'responded', comment);
        return getRequestIn(client, actor, id);
    });
}

export async function cancel(actor, id) {
    return withTransaction(async (client) => {
        const r = await lockRequest(client, id);
        if (!OPEN.includes(r.status)) throw conflict('Only an open request can be cancelled.', 'NOT_OPEN');
        if (actor.id !== r.requested_by) throw forbidden('Only the person who made the request can cancel it.');
        await client.query("UPDATE approval_requests SET status = 'cancelled', decided_at = $2, updated_at = NOW() WHERE id = $1", [id, now()]);
        await recordEvent(client, id, actor.id, 'cancelled');
        await audit(client, { actorUserId: actor.id, action: 'approval.cancelled', entityType: 'user', entityId: r.target_user_id, details: { requestId: id } });
        return getRequestIn(client, actor, id);
    });
}

async function getRequestIn(client, viewer, id, outcome = null) {
    const { rows } = await client.query(`${REQUEST_SELECT} WHERE r.id = $1`, [id]);
    return { ...requestView(rows[0], viewer), ...(outcome ? { outcome } : {}) };
}
