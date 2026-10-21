/* Lead (enquiry) management. Admins see every lead and assign them;
   counsellors see only leads assigned to them. Every change is recorded as a
   lead activity, and assignments are also in the audit log. */
import { now } from '../lib/clock.js';
import { query, withTransaction } from '../lib/db.js';
import { badRequest, conflict, forbidden } from '../lib/http.js';
import { assertLeadAccess, counsellorScope } from './access.js';
import { audit } from './audit.js';
import { notifyUser } from './inbox.js';
import { enqueueNotification } from './notification-service.js';
import { isAdminRole } from './permissions.js';

export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'consultation_booked', 'converted', 'not_interested', 'closed'];
export const OPEN_LEAD_STATUSES = ['new', 'contacted', 'qualified', 'consultation_booked'];

const iso = (value) => (value ? new Date(value).toISOString() : null);
const escapeLike = (value) => value.replace(/[\\%_]/g, (char) => `\\${char}`);
const fullName = (first, last) => [first, last].filter(Boolean).join(' ');

function leadView(l) {
    return {
        id: l.id,
        source: l.source,
        status: l.status,
        name: fullName(l.first_name, l.last_name) || null,
        email: l.email,
        phone: l.phone,
        destination: l.primary_destination,
        intake: l.intended_intake,
        studyLevel: l.study_level,
        course: l.preferred_course,
        serviceInterest: l.service_interest,
        message: l.message,
        contactConsent: l.contact_consent,
        isGuest: !l.user_id,
        userId: l.user_id,
        assignedCounsellor: l.assigned_counsellor_id ? { id: l.assigned_counsellor_id, name: l.counsellor_name } : null,
        nextFollowUpAt: iso(l.next_follow_up_at),
        lastContactedAt: iso(l.last_contacted_at),
        createdAt: iso(l.created_at),
        updatedAt: iso(l.updated_at),
    };
}

const LEAD_SELECT = 'SELECT l.*, co.display_name AS counsellor_name FROM leads l LEFT JOIN counsellors co ON co.user_id = l.assigned_counsellor_id';

export async function listLeads(staff, { status, source, assigned, q, guestOnly, followUpDue, page, pageSize }) {
    const where = [];
    const values = [];
    const add = (sql, value) => {
        values.push(value);
        where.push(sql.replaceAll('?', `$${values.length}`));
    };
    const scope = counsellorScope(staff);
    if (scope) add('l.assigned_counsellor_id = ?', scope);
    else if (assigned === 'none') where.push('l.assigned_counsellor_id IS NULL');
    else if (assigned) add('l.assigned_counsellor_id = ?', assigned);
    if (status === 'open') add('l.status = ANY(?)', OPEN_LEAD_STATUSES);
    else if (status) add('l.status = ?', status);
    if (source) add('l.source = ?', source);
    if (guestOnly) where.push('l.user_id IS NULL');
    if (followUpDue) add('l.next_follow_up_at <= ?', now());
    if (q) add("(LOWER(l.email) LIKE ? OR LOWER(COALESCE(l.first_name, '') || ' ' || COALESCE(l.last_name, '')) LIKE ? OR COALESCE(l.phone, '') LIKE ?)", `%${escapeLike(q.toLowerCase())}%`);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [list, count] = await Promise.all([
        query(`${LEAD_SELECT} ${whereSql} ORDER BY l.created_at DESC, l.id LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, values),
        query(`SELECT COUNT(*)::int AS total FROM leads l ${whereSql}`, values),
    ]);
    return { items: list.rows.map(leadView), page, pageSize, total: count.rows[0].total };
}

export async function getLead(staff, id) {
    await assertLeadAccess({ query }, staff, id);
    const l = (await query(`${LEAD_SELECT} WHERE l.id = $1`, [id])).rows[0];
    const [activities, consultations, duplicates, account] = await Promise.all([
        query(
            `SELECT a.*, u.first_name, u.last_name FROM lead_activities a LEFT JOIN users u ON u.id = a.actor_user_id
             WHERE a.lead_id = $1 ORDER BY a.id DESC LIMIT 100`,
            [id],
        ),
        query('SELECT id, reference, status, scheduled_start FROM consultations WHERE lead_id = $1 ORDER BY scheduled_start DESC', [id]),
        // Other enquiries from the same email or phone: shown for review, never merged automatically.
        query(
            `SELECT id, source, status, created_at, user_id FROM leads
             WHERE id <> $1 AND (LOWER(email) = LOWER($2) OR ($3::text IS NOT NULL AND REGEXP_REPLACE(COALESCE(phone, ''), '[\\s().-]', '', 'g') = REGEXP_REPLACE($3, '[\\s().-]', '', 'g')))
               AND ($4::uuid IS NULL OR assigned_counsellor_id = $4)
             ORDER BY created_at DESC LIMIT 20`,
            [id, l.email, l.phone, counsellorScope(staff)],
        ),
        l.user_id ? query('SELECT id, first_name, last_name, email, email_verified_at FROM users WHERE id = $1', [l.user_id]) : { rows: [] },
    ]);
    const u = account.rows[0];
    return {
        ...leadView(l),
        account: u ? { id: u.id, name: fullName(u.first_name, u.last_name), email: u.email, emailVerified: Boolean(u.email_verified_at) } : null,
        activities: activities.rows.map((a) => ({ id: String(a.id), kind: a.kind, channel: a.channel, body: a.body, details: a.details, actor: fullName(a.first_name, a.last_name) || 'System', at: iso(a.created_at) })),
        consultations: consultations.rows.map((c) => ({ id: c.id, reference: c.reference, status: c.status, start: iso(c.scheduled_start) })),
        possibleDuplicates: duplicates.rows.map((d) => ({ id: d.id, source: d.source, status: d.status, linked: Boolean(d.user_id), createdAt: iso(d.created_at) })),
    };
}

async function activity(client, leadId, actorId, kind, { channel = null, body = null, details = {} } = {}) {
    await client.query('INSERT INTO lead_activities (lead_id, actor_user_id, kind, channel, body, details) VALUES ($1, $2, $3, $4, $5, $6)', [leadId, actorId, kind, channel, body, JSON.stringify(details)]);
}

/* patch: { status, nextFollowUpAt (null clears), assignedCounsellorId (admins; null unassigns) } */
export async function updateLead(staff, id, patch) {
    if (patch.assignedCounsellorId !== undefined && !isAdminRole(staff.role)) throw forbidden('Only administrators can assign enquiries.');
    return withTransaction(async (client) => {
        const l = await assertLeadAccess(client, staff, id);
        await client.query('SELECT 1 FROM leads WHERE id = $1 FOR UPDATE', [id]);
        const changes = {};
        if (patch.status && patch.status !== l.status) {
            if (patch.status === 'converted' && !l.user_id) throw conflict('An enquiry becomes "converted" when it is linked to a verified student account.', 'NOT_LINKED');
            await client.query('UPDATE leads SET status = $2, updated_at = NOW() WHERE id = $1', [id, patch.status]);
            await activity(client, id, staff.id, 'status_changed', { details: { from: l.status, to: patch.status } });
            changes.status = { from: l.status, to: patch.status };
        }
        if (patch.nextFollowUpAt !== undefined) {
            await client.query('UPDATE leads SET next_follow_up_at = $2, updated_at = NOW() WHERE id = $1', [id, patch.nextFollowUpAt]);
            changes.nextFollowUpAt = iso(patch.nextFollowUpAt);
        }
        if (patch.assignedCounsellorId !== undefined && patch.assignedCounsellorId !== l.assigned_counsellor_id) {
            const to = patch.assignedCounsellorId;
            if (to) {
                const target = (await client.query(
                    "SELECT co.user_id, u.email, co.display_name FROM counsellors co JOIN users u ON u.id = co.user_id WHERE co.user_id = $1 AND co.is_active AND u.status = 'active'",
                    [to],
                )).rows[0];
                if (!target) throw badRequest('Choose an active counsellor.', { fields: { assignedCounsellorId: 'Choose an active counsellor' } });
                await notifyUser(client, to, { kind: 'lead_assigned', title: 'New enquiry assigned to you', body: `${fullName(l.first_name, l.last_name) || l.email} is waiting for contact.`, link: 'consultant-dashboard' });
                await enqueueNotification(client, {
                    userId: to, template: 'lead_assigned', recipient: target.email, dedupeKey: `lead:${id}:assigned:${to}:${now().getTime()}`,
                    payload: { leadName: fullName(l.first_name, l.last_name) || 'A new enquiry' },
                });
            }
            await client.query('UPDATE leads SET assigned_counsellor_id = $2, updated_at = NOW() WHERE id = $1', [id, to]);
            await activity(client, id, staff.id, 'assigned', { details: { from: l.assigned_counsellor_id, to } });
            await audit(client, { actorUserId: staff.id, action: 'lead.assigned', entityType: 'lead', entityId: id, details: { from: l.assigned_counsellor_id, to } });
            changes.assignedCounsellorId = to;
        }
        if (!Object.keys(changes).length) throw badRequest('Nothing to update.');
        await audit(client, { actorUserId: staff.id, action: 'lead.updated', entityType: 'lead', entityId: id, details: changes });
        return { id, changes };
    }).then(() => getLead(staff, id));
}

/* A note, or a contact attempt (which also moves a new lead to "contacted"). */
export async function addActivity(staff, id, { kind, channel, body }) {
    await withTransaction(async (client) => {
        const l = await assertLeadAccess(client, staff, id);
        await activity(client, id, staff.id, kind, { channel: kind === 'contact_attempt' ? channel : null, body });
        if (kind === 'contact_attempt') {
            await client.query(
                "UPDATE leads SET last_contacted_at = $2, status = CASE WHEN status = 'new' THEN 'contacted' ELSE status END, updated_at = NOW() WHERE id = $1",
                [id, now()],
            );
            if (l.status === 'new') await activity(client, id, staff.id, 'status_changed', { details: { from: 'new', to: 'contacted' } });
        }
    });
    return getLead(staff, id);
}
