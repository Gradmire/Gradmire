/* Follow-up tasks for staff, optionally linked to a student, a lead or a
   consultation the assignee may see. Counsellors work on their own tasks;
   admins can assign tasks to any active staff member. Follow-ups written as
   consultation notes in the CRM are listed alongside (source "consultation_note"). */
import { now } from '../lib/clock.js';
import { query, withTransaction } from '../lib/db.js';
import { badRequest, forbidden, notFound } from '../lib/http.js';
import { assertConsultationAccess, assertLeadAccess, assertStudentAccess, counsellorScope } from './access.js';
import { audit } from './audit.js';
import { notifyUser } from './inbox.js';
import { isAdminRole, STAFF_ROLES } from './permissions.js';

const iso = (value) => (value ? new Date(value).toISOString() : null);
const fullName = (first, last) => [first, last].filter(Boolean).join(' ');

function taskView(t) {
    return {
        id: t.id,
        source: 'task',
        title: t.title,
        details: t.details,
        dueAt: iso(t.due_at),
        priority: t.priority,
        status: t.status,
        overdue: t.status === 'open' && Boolean(t.due_at) && new Date(t.due_at) < now(),
        assignee: { id: t.assignee_user_id, name: fullName(t.a_first, t.a_last) },
        student: t.student_user_id ? { id: t.student_user_id, name: fullName(t.s_first, t.s_last) } : null,
        lead: t.lead_id ? { id: t.lead_id, name: fullName(t.l_first, t.l_last) || t.l_email } : null,
        consultation: t.consultation_id ? { id: t.consultation_id, reference: t.c_reference } : null,
        completedAt: iso(t.completed_at),
        createdAt: iso(t.created_at),
    };
}

const TASK_SELECT = `
  SELECT t.*, a.first_name AS a_first, a.last_name AS a_last, s.first_name AS s_first, s.last_name AS s_last,
         l.first_name AS l_first, l.last_name AS l_last, l.email AS l_email, c.reference AS c_reference
  FROM follow_up_tasks t
  JOIN users a ON a.id = t.assignee_user_id
  LEFT JOIN users s ON s.id = t.student_user_id
  LEFT JOIN leads l ON l.id = t.lead_id
  LEFT JOIN consultations c ON c.id = t.consultation_id`;

export async function listFollowUps(staff, { status = 'open', assigneeId = null }) {
    const assignee = counsellorScope(staff) || assigneeId || null;
    const [tasks, notes] = await Promise.all([
        query(
            `${TASK_SELECT} WHERE ($1::uuid IS NULL OR t.assignee_user_id = $1) AND ($2::text = 'all' OR t.status = $2)
             ORDER BY t.status = 'open' DESC, t.due_at NULLS LAST, t.created_at DESC LIMIT 300`,
            [assignee, status],
        ),
        query(
            `SELECT n.id, n.body, n.due_at, n.completed_at, n.created_at, c.id AS consultation_id, c.reference, c.student_name, c.counsellor_id
             FROM consultation_notes n JOIN consultations c ON c.id = n.consultation_id
             WHERE n.kind = 'follow_up' AND ($1::uuid IS NULL OR c.counsellor_id = $1)
               AND ($2::text = 'all' OR ($2 = 'open' AND n.completed_at IS NULL) OR ($2 = 'done' AND n.completed_at IS NOT NULL))
             ORDER BY n.completed_at IS NULL DESC, n.due_at NULLS LAST LIMIT 300`,
            [assignee, status === 'cancelled' ? 'none' : status],
        ),
    ]);
    const items = [
        ...tasks.rows.map(taskView),
        ...notes.rows.map((n) => ({
            id: n.id, source: 'consultation_note', title: n.body.slice(0, 200), details: n.body.length > 200 ? n.body : null,
            dueAt: iso(n.due_at), priority: 'normal', status: n.completed_at ? 'done' : 'open',
            overdue: !n.completed_at && Boolean(n.due_at) && new Date(n.due_at) < now(),
            assignee: { id: n.counsellor_id }, student: null, lead: null,
            consultation: { id: n.consultation_id, reference: n.reference, studentName: n.student_name },
            completedAt: iso(n.completed_at), createdAt: iso(n.created_at),
        })),
    ].sort((a, b) => (a.status === 'open') === (b.status === 'open')
        ? (a.dueAt || '9999').localeCompare(b.dueAt || '9999')
        : a.status === 'open' ? -1 : 1);
    return { items, overdue: items.filter((t) => t.overdue).length };
}

export async function createFollowUp(staff, input) {
    return withTransaction(async (client) => {
        let assigneeId = staff.id;
        if (input.assigneeUserId && input.assigneeUserId !== staff.id) {
            if (!isAdminRole(staff.role)) throw forbidden('Only administrators can assign tasks to someone else.');
            const ok = (await client.query("SELECT 1 FROM users WHERE id = $1 AND role = ANY($2) AND status = 'active'", [input.assigneeUserId, STAFF_ROLES])).rows.length;
            if (!ok) throw badRequest('Choose an active staff member.', { fields: { assigneeUserId: 'Choose an active staff member' } });
            assigneeId = input.assigneeUserId;
        }
        // The task may only point at records the assignee can open.
        const assignee = (await client.query('SELECT id, role FROM users WHERE id = $1', [assigneeId])).rows[0];
        if (input.studentUserId) await assertStudentAccess(client, assignee, input.studentUserId);
        if (input.leadId) await assertLeadAccess(client, assignee, input.leadId);
        if (input.consultationId) await assertConsultationAccess(client, assignee, input.consultationId);
        const id = crypto.randomUUID();
        await client.query(
            `INSERT INTO follow_up_tasks (id, assignee_user_id, created_by, student_user_id, lead_id, consultation_id, title, details, due_at, priority)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [id, assigneeId, staff.id, input.studentUserId || null, input.leadId || null, input.consultationId || null, input.title, input.details || null, input.dueAt || null, input.priority || 'normal'],
        );
        if (assigneeId !== staff.id) {
            await notifyUser(client, assigneeId, { kind: 'follow_up_assigned', title: 'New follow-up task', body: input.title, link: 'consultant-follow-ups.html' });
        }
        await audit(client, { actorUserId: staff.id, action: 'follow_up.created', entityType: 'follow_up_task', entityId: id, details: { assigneeId } });
        return taskView((await client.query(`${TASK_SELECT} WHERE t.id = $1`, [id])).rows[0]);
    });
}

/* patch: { status, title, details, dueAt, priority } */
export async function updateFollowUp(staff, id, patch) {
    return withTransaction(async (client) => {
        const t = (await client.query('SELECT * FROM follow_up_tasks WHERE id = $1 AND ($2::uuid IS NULL OR assignee_user_id = $2) FOR UPDATE', [id, counsellorScope(staff)])).rows[0];
        if (!t) throw notFound('Task not found');
        const map = { title: 'title', details: 'details', dueAt: 'due_at', priority: 'priority', status: 'status' };
        const sets = [];
        const values = [id];
        for (const [key, column] of Object.entries(map)) {
            if (patch[key] === undefined) continue;
            values.push(patch[key]);
            sets.push(`${column} = $${values.length}`);
        }
        if (!sets.length) throw badRequest('Nothing to update.');
        if (patch.status) {
            values.push(patch.status === 'done' ? now() : null);
            sets.push(`completed_at = $${values.length}`);
        }
        await client.query(`UPDATE follow_up_tasks SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`, values);
        await audit(client, { actorUserId: staff.id, action: 'follow_up.updated', entityType: 'follow_up_task', entityId: id, details: { fields: Object.keys(patch).filter((k) => patch[k] !== undefined), ...(patch.status ? { from: t.status, to: patch.status } : {}) } });
        return taskView((await client.query(`${TASK_SELECT} WHERE t.id = $1`, [id])).rows[0]);
    });
}
