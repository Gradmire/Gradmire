/* Admin user management: search, account detail, suspension and the manual
   review of guest records whose owner could not be established automatically.
   Roles are never edited here — they change only through approval requests. */
import { now } from '../lib/clock.js';
import { query, withTransaction } from '../lib/db.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/http.js';
import { audit } from './audit.js';
import { notifyUser } from './inbox.js';
import { mayManageAccount } from './permissions.js';

const iso = (value) => (value ? new Date(value).toISOString() : null);
const escapeLike = (value) => value.replace(/[\\%_]/g, (char) => `\\${char}`);
const fullName = (u) => [u.first_name, u.last_name].filter(Boolean).join(' ');

function userRow(u) {
    return {
        id: u.id,
        name: fullName(u),
        email: u.email,
        emailVerified: Boolean(u.email_verified_at),
        phone: u.phone,
        role: u.role,
        status: u.status,
        statusReason: u.status_reason,
        createdAt: iso(u.created_at),
        ...(u.employment_status !== undefined ? { employmentStatus: u.employment_status } : {}),
    };
}

export async function listUsers({ q, role, status, page, pageSize }) {
    const where = [];
    const values = [];
    const add = (sql, value) => {
        values.push(value);
        where.push(sql.replaceAll('?', `$${values.length}`));
    };
    if (role) add('u.role = ?', role);
    if (status) add('u.status = ?', status);
    if (q) add("(LOWER(u.email) LIKE ? OR LOWER(u.first_name || ' ' || COALESCE(u.last_name, '')) LIKE ? OR u.phone LIKE ?)", `%${escapeLike(q.toLowerCase())}%`);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [list, count] = await Promise.all([
        query(
            `SELECT u.*, e.employment_status FROM users u LEFT JOIN employee_profiles e ON e.user_id = u.id
             ${whereSql} ORDER BY u.created_at DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
            values,
        ),
        query(`SELECT COUNT(*)::int AS total FROM users u ${whereSql}`, values),
    ]);
    return { items: list.rows.map(userRow), page, pageSize, total: count.rows[0].total };
}

export async function getUser(id) {
    const u = (await query('SELECT * FROM users WHERE id = $1', [id])).rows[0];
    if (!u) throw notFound('User not found');
    const [profile, employee, consultations, leads, applications, requests, history, duplicates] = await Promise.all([
        query('SELECT * FROM student_profiles WHERE user_id = $1', [id]),
        query('SELECT * FROM employee_profiles WHERE user_id = $1', [id]),
        query(
            `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status IN ('reserved', 'confirmed') AND scheduled_start > NOW())::int AS upcoming
             FROM consultations WHERE student_user_id = $1`,
            [id],
        ),
        query('SELECT id, source, status, created_at FROM leads WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20', [id]),
        query('SELECT id, status, submitted_at FROM consultant_applications WHERE user_id = $1 ORDER BY submitted_at DESC', [id]),
        query('SELECT id, type, status, from_role, requested_role, created_at, decided_at FROM approval_requests WHERE target_user_id = $1 ORDER BY created_at DESC LIMIT 20', [id]),
        query(
            `SELECT a.action, a.details, a.created_at, x.first_name, x.last_name FROM audit_log a LEFT JOIN users x ON x.id = a.actor_user_id
             WHERE a.entity_type = 'user' AND a.entity_id = $1 ORDER BY a.created_at DESC LIMIT 50`,
            [id],
        ),
        possibleDuplicates(u),
    ]);
    const p = profile.rows[0];
    const e = employee.rows[0];
    return {
        ...userRow(u),
        studentProfile: p ? { destinations: p.destinations, intendedIntake: p.intended_intake, studyLevel: p.study_level, preferredCourse: p.preferred_course } : null,
        employeeProfile: e ? {
            department: e.department, jobTitle: e.job_title, employeeCode: e.employee_code, workEmail: e.work_email,
            systemRole: e.system_role, employmentStatus: e.employment_status, approvedAt: iso(e.approved_at), terminatedAt: iso(e.terminated_at),
        } : null,
        consultations: consultations.rows[0],
        leads: leads.rows.map((l) => ({ id: l.id, source: l.source, status: l.status, createdAt: iso(l.created_at) })),
        consultantApplications: applications.rows.map((a) => ({ id: a.id, status: a.status, submittedAt: iso(a.submitted_at) })),
        accessRequests: requests.rows.map((r) => ({ id: r.id, type: r.type, status: r.status, fromRole: r.from_role, requestedRole: r.requested_role, createdAt: iso(r.created_at), decidedAt: iso(r.decided_at) })),
        history: history.rows.map((h) => ({ action: h.action, details: h.details, actor: fullName(h) || 'System', at: iso(h.created_at) })),
        possibleDuplicates: duplicates,
    };
}

/* Unlinked guest records that share this account's phone number but not its
   verified email. These are never linked automatically — an admin decides. */
async function possibleDuplicates(u) {
    if (!u.phone) return { leads: [], consultations: [] };
    const [leads, consultations] = await Promise.all([
        query(
            `SELECT id, first_name, last_name, email, source, created_at FROM leads
             WHERE user_id IS NULL AND REGEXP_REPLACE(COALESCE(phone, ''), '[\\s().-]', '', 'g') = $1 AND LOWER(email) <> LOWER($2)
             ORDER BY created_at DESC LIMIT 20`,
            [u.phone, u.email],
        ),
        query(
            `SELECT id, reference, student_name, student_email, scheduled_start, status FROM consultations
             WHERE student_user_id IS NULL AND student_phone = $1 AND LOWER(student_email) <> LOWER($2)
             ORDER BY scheduled_start DESC LIMIT 20`,
            [u.phone, u.email],
        ),
    ]);
    return {
        leads: leads.rows.map((l) => ({ id: l.id, name: fullName(l), email: l.email, source: l.source, createdAt: iso(l.created_at) })),
        consultations: consultations.rows.map((c) => ({ id: c.id, reference: c.reference, name: c.student_name, email: c.student_email, start: iso(c.scheduled_start), status: c.status })),
    };
}

/* Suspend (status 'disabled') or reactivate. Suspension ends every session at once. */
export async function setStatus(actor, id, { status, reason }) {
    if (actor.id === id) throw forbidden('You cannot suspend or reactivate your own account.');
    return withTransaction(async (client) => {
        const u = (await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [id])).rows[0];
        if (!u) throw notFound('User not found');
        if (!mayManageAccount(actor, u.role)) throw forbidden('Only a super administrator can suspend or reactivate an administrator.');
        if (u.status === status) throw conflict(`This account is already ${status === 'active' ? 'active' : 'suspended'}.`, 'NO_CHANGE');
        if (status === 'disabled' && u.role === 'super_admin') {
            const others = (await client.query("SELECT COUNT(*)::int AS n FROM users WHERE role = 'super_admin' AND status = 'active' AND id <> $1", [id])).rows[0].n;
            if (!others) throw conflict('This is the last active super administrator.', 'LAST_SUPER_ADMIN');
        }
        await client.query(
            'UPDATE users SET status = $2, status_reason = $3, status_changed_at = $4, status_changed_by = $5, updated_at = NOW() WHERE id = $1',
            [id, status, reason, now(), actor.id],
        );
        if (status === 'disabled') await client.query('UPDATE sessions SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL', [id, now()]);
        await audit(client, {
            actorUserId: actor.id, action: status === 'disabled' ? 'user.suspended' : 'user.reactivated', entityType: 'user', entityId: id,
            details: { before: { status: u.status }, after: { status }, role: u.role, reason },
        });
        if (status === 'active') await notifyUser(client, id, { kind: 'account_reactivated', title: 'Your account was reactivated', body: 'You can use your Gradmire account again.', link: 'dashboard.html' });
        return userRow((await client.query('SELECT * FROM users WHERE id = $1', [id])).rows[0]);
    });
}

/* Manual identity review: an admin links one unowned guest record to this
   student, with a reason. Recorded on the user, the record and the audit log. */
export async function linkRecord(actor, userId, { leadId = null, consultationId = null, reason }) {
    if (Boolean(leadId) === Boolean(consultationId)) throw badRequest('Choose exactly one enquiry or consultation to link.');
    return withTransaction(async (client) => {
        const u = (await client.query("SELECT * FROM users WHERE id = $1 AND role = 'student'", [userId])).rows[0];
        if (!u) throw notFound('Student not found');
        let updated;
        if (leadId) {
            updated = await client.query(
                "UPDATE leads SET user_id = $2, status = CASE WHEN status IN ('not_interested', 'closed') THEN status ELSE 'converted' END, updated_at = NOW() WHERE id = $1 AND user_id IS NULL RETURNING id",
                [leadId, userId],
            );
            if (updated.rowCount) await client.query("INSERT INTO lead_activities (lead_id, actor_user_id, kind, body, details) VALUES ($1, $2, 'linked', $3, $4)", [leadId, actor.id, reason, JSON.stringify({ userId, manual: true })]);
        } else {
            updated = await client.query('UPDATE consultations SET student_user_id = $2, updated_at = NOW() WHERE id = $1 AND student_user_id IS NULL RETURNING id', [consultationId, userId]);
            if (updated.rowCount) await client.query("INSERT INTO consultation_events (consultation_id, actor_user_id, actor_type, event, details) VALUES ($1, $2, 'staff', 'linked_manually', $3)", [consultationId, actor.id, JSON.stringify({ userId })]);
        }
        if (!updated.rowCount) throw conflict('That record does not exist or already belongs to an account.', 'ALREADY_LINKED');
        await audit(client, { actorUserId: actor.id, action: 'identity.manual_link', entityType: 'user', entityId: userId, details: { leadId, consultationId, reason } });
        await notifyUser(client, userId, { kind: 'records_linked', title: 'A record was added to your account', body: 'Our team linked an earlier enquiry or booking to your account.', link: 'dashboard.html' });
        return { linked: true };
    });
}

/* ── Audit log ────────────────────────────────────────────────────────────── */

export async function listAudit({ action, entityType, entityId, actorId, from, to, page, pageSize }) {
    const where = [];
    const values = [];
    const add = (sql, value) => {
        values.push(value);
        where.push(sql.replace('?', `$${values.length}`));
    };
    if (action) add("a.action LIKE ? ESCAPE '\\'", `${escapeLike(action)}%`);
    if (entityType) add('a.entity_type = ?', entityType);
    if (entityId) add('a.entity_id = ?', entityId);
    if (actorId) add('a.actor_user_id = ?', actorId);
    if (from) add('a.created_at >= ?', from);
    if (to) add('a.created_at < ?', to);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [list, count] = await Promise.all([
        query(
            `SELECT a.*, u.first_name, u.last_name, u.email AS actor_email FROM audit_log a LEFT JOIN users u ON u.id = a.actor_user_id
             ${whereSql} ORDER BY a.created_at DESC, a.id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
            values,
        ),
        query(`SELECT COUNT(*)::int AS total FROM audit_log a ${whereSql}`, values),
    ]);
    return {
        items: list.rows.map((a) => ({
            id: String(a.id), action: a.action, entityType: a.entity_type, entityId: a.entity_id, details: a.details,
            actor: a.actor_user_id ? { id: a.actor_user_id, name: fullName(a), email: a.actor_email } : null, at: iso(a.created_at),
        })),
        page, pageSize, total: count.rows[0].total,
    };
}
