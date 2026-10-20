/* Staff side of bookings. Every function takes the acting staff user and
   applies role scoping in SQL: admins see everything; counsellors see and
   change only consultations assigned to them and only their own availability. */
import { now } from '../lib/clock.js';
import { query, withSavepoint, withTransaction } from '../lib/db.js';
import { badRequest, conflict, forbidden, HttpError, notFound } from '../lib/http.js';
import { addMinutes, dayBounds, zonedParts } from '../lib/time.js';
import { audit, recordConsultationEvent } from './audit.js';
import { ACTIVE_STATUSES } from './availability-service.js';
import { CONSULTATION_SELECT, cancelInTransaction, loadConsultation, settle, typeView } from './booking-service.js';
import { enqueueCalendarJob, needsCalendar, retryCalendarSync } from './calendar-sync.js';
import { enqueueNotification, queueConfirmationMessages } from './notification-service.js';
import { isAdminRole } from './permissions.js';

const isAdmin = (staff) => isAdminRole(staff.role);
const scopeCounsellor = (staff) => (isAdmin(staff) ? null : staff.id);

function staffView(c) {
    return {
        id: c.id,
        reference: c.reference,
        status: c.status,
        calendarStatus: c.calendar_status,
        type: { id: c.consultation_type_id, name: c.type_name },
        start: new Date(c.scheduled_start).toISOString(),
        end: new Date(c.scheduled_end).toISOString(),
        timezone: c.timezone,
        meetingMethod: c.meeting_method,
        meetingUrl: c.meeting_url,
        counsellor: { id: c.counsellor_id, name: c.counsellor_name },
        student: { name: c.student_name, email: c.student_email, phone: c.student_phone, userId: c.student_user_id },
        source: c.source,
        leadSource: c.lead_source || null,
        outcome: c.outcome,
        rescheduledFromId: c.rescheduled_from_id,
        createdAt: new Date(c.created_at).toISOString(),
    };
}

/* ── List, search and summary ─────────────────────────────────────────────── */

const escapeLike = (value) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

export async function listConsultations(staff, filters) {
    const where = [];
    const values = [];
    const add = (sql, value) => {
        values.push(value);
        where.push(sql.replace('?', `$${values.length}`));
    };
    const counsellorScope = scopeCounsellor(staff);
    if (counsellorScope) add('c.counsellor_id = ?', counsellorScope);
    else if (filters.counsellorId) add('c.counsellor_id = ?', filters.counsellorId);
    if (filters.from) add('c.scheduled_start >= ?', filters.from);
    if (filters.to) add('c.scheduled_start < ?', filters.to);
    if (filters.status) add('c.status = ?', filters.status);
    else where.push("c.status <> 'rescheduled'");
    if (filters.consultationTypeId) add('c.consultation_type_id = ?', filters.consultationTypeId);
    if (filters.calendarStatus) add('c.calendar_status = ?', filters.calendarStatus);
    if (filters.q) {
        values.push(`%${escapeLike(filters.q.toLowerCase())}%`);
        const p = `$${values.length}`;
        where.push(`(LOWER(c.student_name) LIKE ${p} OR LOWER(c.student_email) LIKE ${p} OR LOWER(c.reference) LIKE ${p} OR c.student_phone LIKE ${p})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const pageSize = filters.pageSize;
    const offset = (filters.page - 1) * pageSize;
    const order = filters.sort === 'desc' ? 'DESC' : 'ASC';
    const [list, count] = await Promise.all([
        query(
            `${CONSULTATION_SELECT.replace('FROM consultations c', ', l.source AS lead_source FROM consultations c LEFT JOIN leads l ON l.id = c.lead_id')}
             ${whereSql} ORDER BY c.scheduled_start ${order}, c.id LIMIT ${pageSize} OFFSET ${offset}`,
            values,
        ),
        query(`SELECT COUNT(*)::int AS total FROM consultations c ${whereSql}`, values),
    ]);
    return { items: list.rows.map(staffView), page: filters.page, pageSize, total: count.rows[0].total };
}

export async function summary(staff, timezone) {
    const today = zonedParts(now(), timezone);
    const { start, end } = dayBounds({ year: today.year, month: today.month, day: today.day }, timezone);
    const counsellorScope = scopeCounsellor(staff);
    const { rows } = await query(
        `SELECT
           COUNT(*) FILTER (WHERE scheduled_start >= $2 AND scheduled_start < $3 AND status IN ('reserved', 'confirmed', 'completed', 'no_show'))::int AS today,
           COUNT(*) FILTER (WHERE scheduled_start >= $4 AND status IN ('reserved', 'confirmed'))::int AS upcoming,
           COUNT(*) FILTER (WHERE status = 'reserved')::int AS pending,
           COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
           COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
           COUNT(*) FILTER (WHERE status = 'no_show')::int AS no_show,
           COUNT(*) FILTER (WHERE calendar_status = 'failed' AND status IN ('reserved', 'confirmed'))::int AS calendar_failed
         FROM consultations WHERE ($1::uuid IS NULL OR counsellor_id = $1)`,
        [counsellorScope, start, end, now()],
    );
    const failedNotifications = isAdmin(staff)
        ? (await query("SELECT COUNT(*)::int AS n FROM notifications WHERE status IN ('failed', 'skipped')")).rows[0].n
        : null;
    return { timezone, ...rows[0], noShow: rows[0].no_show, calendarFailed: rows[0].calendar_failed, failedNotifications };
}

/* ── Detail ───────────────────────────────────────────────────────────────── */

async function loadScoped(staff, id) {
    const c = await loadConsultation(null, id);
    if (!c || (scopeCounsellor(staff) && c.counsellor_id !== staff.id)) throw notFound('Consultation not found');
    return c;
}

export async function getConsultationDetail(staff, id) {
    const c = await loadScoped(staff, id);
    const [lead, notes, events, notifications, chain] = await Promise.all([
        c.lead_id ? query(
            `SELECT id, source, first_name, last_name, email, phone, primary_destination, intended_intake, study_level,
                    preferred_course, service_interest, marketing_opt_in, created_at FROM leads WHERE id = $1`, [c.lead_id]) : { rows: [] },
        query(
            `SELECT n.id, n.kind, n.body, n.due_at, n.completed_at, n.created_at, u.first_name AS author
             FROM consultation_notes n LEFT JOIN users u ON u.id = n.author_user_id WHERE n.consultation_id = $1 ORDER BY n.created_at`, [c.id]),
        query(
            `SELECT e.event, e.actor_type, e.details, e.created_at, u.first_name AS actor
             FROM consultation_events e LEFT JOIN users u ON u.id = e.actor_user_id WHERE e.consultation_id = $1 ORDER BY e.id`, [c.id]),
        query('SELECT id, template, recipient, status, attempts, last_error, scheduled_for, sent_at FROM notifications WHERE consultation_id = $1 ORDER BY created_at', [c.id]),
        c.rescheduled_from_id ? query('SELECT id, reference, scheduled_start, status FROM consultations WHERE id = $1', [c.rescheduled_from_id]) : { rows: [] },
    ]);
    return {
        ...staffView(c),
        preferences: { destination: c.preferred_destination, degree: c.intended_degree, course: c.preferred_course, intake: c.intended_intake },
        academicSummary: c.academic_summary,
        message: c.message,
        cancellation: c.status === 'cancelled' ? { by: c.cancelled_by, reason: c.cancellation_reason, at: c.cancelled_at } : null,
        lead: lead.rows[0] || null,
        notes: notes.rows.map((n) => ({ id: n.id, kind: n.kind, body: n.body, dueAt: n.due_at, completedAt: n.completed_at, createdAt: n.created_at, author: n.author })),
        history: events.rows.map((e) => ({ event: e.event, actorType: e.actor_type, actor: e.actor, details: e.details, at: e.created_at })),
        notifications: notifications.rows.map((n) => ({ id: n.id, template: n.template, recipient: n.recipient, status: n.status, attempts: n.attempts, lastError: n.last_error, scheduledFor: n.scheduled_for, sentAt: n.sent_at })),
        rescheduledFrom: chain.rows[0] ? { id: chain.rows[0].id, reference: chain.rows[0].reference, start: chain.rows[0].scheduled_start } : null,
    };
}

/* ── Update ───────────────────────────────────────────────────────────────── */

const TRANSITIONS = {
    reserved: ['confirmed', 'cancelled'],
    confirmed: ['completed', 'no_show', 'cancelled'],
    completed: ['no_show'],
    no_show: ['completed'],
    cancelled: [],
    rescheduled: [],
};

export async function updateConsultation(staff, id, patch) {
    if (patch.counsellorId && !isAdmin(staff)) throw forbidden('Only administrators can reassign consultations.');
    const updatedId = await withTransaction(async (client) => {
        const c = (await client.query('SELECT * FROM consultations WHERE id = $1 FOR UPDATE', [id])).rows[0];
        if (!c || (scopeCounsellor(staff) && c.counsellor_id !== staff.id)) throw notFound('Consultation not found');
        const changes = {};

        if (patch.status && patch.status !== c.status) {
            if (!TRANSITIONS[c.status].includes(patch.status)) {
                throw conflict(`A ${c.status} consultation cannot be marked ${patch.status}.`, 'INVALID_TRANSITION');
            }
            if (['completed', 'no_show'].includes(patch.status) && new Date(c.scheduled_start) > now()) {
                throw conflict('A consultation can be marked completed or no-show only after it has started.', 'TOO_EARLY');
            }
            if (patch.status === 'cancelled') {
                await cancelInTransaction(client, c, { scope: { staff: true }, userId: staff.id, reason: patch.cancellationReason || null });
                changes.status = 'cancelled';
            } else {
                const row = (await client.query('UPDATE consultations SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *', [id, patch.status])).rows[0];
                await recordConsultationEvent(client, { consultationId: id, actorType: 'staff', actorUserId: staff.id, event: 'status_changed', details: { from: c.status, to: patch.status } });
                // Staff confirming a reserved booking (e.g. after a calendar failure) sends the confirmation.
                if (c.status === 'reserved' && patch.status === 'confirmed') await queueConfirmationMessages(client, row);
                changes.status = patch.status;
            }
        }

        if (patch.counsellorId && patch.counsellorId !== c.counsellor_id) {
            if (!ACTIVE_STATUSES.includes(changes.status || c.status)) throw conflict('Only active consultations can be reassigned.', 'NOT_ACTIVE');
            await reassignInTransaction(client, staff.id, c, patch.counsellorId);
            changes.counsellorId = patch.counsellorId;
        }

        if (patch.outcome !== undefined) {
            await client.query('UPDATE consultations SET outcome = $2, updated_at = NOW() WHERE id = $1', [id, patch.outcome]);
            await recordConsultationEvent(client, { consultationId: id, actorType: 'staff', actorUserId: staff.id, event: 'outcome_recorded', details: { outcome: patch.outcome } });
            changes.outcome = patch.outcome;
        }

        if (patch.meetingUrl !== undefined) {
            await client.query("UPDATE consultations SET meeting_url = $2, meeting_provider = CASE WHEN $2::text IS NULL THEN NULL ELSE 'manual' END, updated_at = NOW() WHERE id = $1", [id, patch.meetingUrl]);
            await recordConsultationEvent(client, { consultationId: id, actorType: 'staff', actorUserId: staff.id, event: 'meeting_link_updated' });
            changes.meetingUrl = Boolean(patch.meetingUrl);
        }

        if (!Object.keys(changes).length) throw badRequest('Nothing to update.');
        await audit(client, { actorUserId: staff.id, action: 'consultation.updated', entityType: 'consultation', entityId: id, details: changes });
        return id;
    });
    await settle(updatedId);
    return getConsultationDetail(staff, updatedId);
}

/* Moves an active consultation to another counsellor inside the caller's
   transaction: frees the old calendar event, books the new one, tells the new
   counsellor and records who did it. Shared by the CRM and access revocation. */
export async function reassignInTransaction(client, actorUserId, c, targetId) {
    const target = (await client.query(
        "SELECT co.* FROM counsellors co JOIN users u ON u.id = co.user_id WHERE co.user_id = $1 AND co.is_active AND u.status = 'active'",
        [targetId],
    )).rows[0];
    if (!target) throw badRequest('Choose an active counsellor.', { fields: { counsellorId: 'Choose an active counsellor' } });
    const id = c.id;
    const oldCounsellor = (await client.query('SELECT calendar_id FROM counsellors WHERE user_id = $1', [c.counsellor_id])).rows[0];
    const generation = c.calendar_generation + 1;
    const calendar = needsCalendar(target);
    let row;
    try {
        row = (await withSavepoint(client, 'reassign', () => client.query(
            `UPDATE consultations SET counsellor_id = $2, blocked_until = scheduled_end + make_interval(mins => $3),
               calendar_generation = $4, calendar_status = $5, calendar_event_id = NULL,
               meeting_url = CASE WHEN meeting_provider = 'google_meet' THEN NULL ELSE meeting_url END,
               meeting_provider = CASE WHEN meeting_provider = 'google_meet' THEN NULL ELSE meeting_provider END,
               updated_at = NOW()
             WHERE id = $1 RETURNING *`,
            [id, target.user_id, target.buffer_minutes, generation, calendar ? 'pending' : 'not_required'],
        ))).rows[0];
    } catch (error) {
        if (error.code === '23P01') throw conflict(`${target.display_name} already has a booking at the time of ${c.reference}.`, 'SLOT_UNAVAILABLE');
        throw error;
    }
    if (c.calendar_status !== 'not_required' && oldCounsellor?.calendar_id) {
        await enqueueCalendarJob(client, { consultationId: id, action: 'cancel', generation: c.calendar_generation, calendarId: oldCounsellor.calendar_id });
    }
    if (calendar) await enqueueCalendarJob(client, { consultationId: id, action: 'create', generation, calendarId: target.calendar_id });
    if (row.status === 'confirmed') {
        const email = (await client.query('SELECT email FROM users WHERE id = $1', [target.user_id])).rows[0].email;
        await enqueueNotification(client, { consultationId: id, template: 'counsellor_new_booking', recipient: email, dedupeKey: `${id}:counsellor_new_booking:${target.user_id}:${generation}` });
    }
    await recordConsultationEvent(client, { consultationId: id, actorType: 'staff', actorUserId, event: 'counsellor_assigned', details: { from: c.counsellor_id, to: target.user_id } });
    return row;
}

/* ── Notes, outcomes and follow-up tasks ──────────────────────────────────── */

export async function addNote(staff, id, { kind, body, dueAt }) {
    await loadScoped(staff, id);
    return withTransaction(async (client) => {
        const noteId = crypto.randomUUID();
        await client.query(
            'INSERT INTO consultation_notes (id, consultation_id, author_user_id, kind, body, due_at) VALUES ($1, $2, $3, $4, $5, $6)',
            [noteId, id, staff.id, kind, body, kind === 'follow_up' ? dueAt || null : null],
        );
        await recordConsultationEvent(client, { consultationId: id, actorType: 'staff', actorUserId: staff.id, event: `${kind}_added` });
        await audit(client, { actorUserId: staff.id, action: 'consultation.note_added', entityType: 'consultation', entityId: id, details: { kind } });
        return { id: noteId };
    });
}

export async function completeFollowUp(staff, id, noteId) {
    await loadScoped(staff, id);
    const { rows } = await query(
        "UPDATE consultation_notes SET completed_at = $3 WHERE id = $1 AND consultation_id = $2 AND kind = 'follow_up' AND completed_at IS NULL RETURNING id",
        [noteId, id, now()],
    );
    if (!rows[0]) throw notFound('Follow-up task not found');
    return { id: rows[0].id, completed: true };
}

export async function retryCalendar(staff, id) {
    const c = await loadScoped(staff, id);
    if (!ACTIVE_STATUSES.includes(c.status)) throw conflict('Only active consultations can be synced.', 'NOT_ACTIVE');
    if (!c.counsellor_calendar_id || !needsCalendar({ calendar_id: c.counsellor_calendar_id })) {
        throw new HttpError(422, 'No calendar is configured for this counsellor.', 'CALENDAR_NOT_CONFIGURED');
    }
    await withTransaction(async (client) => {
        await retryCalendarSync(client, c, c.counsellor_calendar_id);
        await audit(client, { actorUserId: staff.id, action: 'calendar.retry', entityType: 'consultation', entityId: id });
    });
    await settle(id);
    return getConsultationDetail(staff, id);
}

/* ── Counsellors and availability ─────────────────────────────────────────── */

export async function listCounsellors(staff) {
    const { rows } = await query(
        `SELECT co.user_id, co.display_name, co.timezone, co.buffer_minutes, co.is_active, (co.calendar_id IS NOT NULL) AS has_calendar
         FROM counsellors co WHERE ($1::uuid IS NULL OR co.user_id = $1) ORDER BY co.is_active DESC, co.display_name`,
        [scopeCounsellor(staff)],
    );
    return rows.map((r) => ({ id: r.user_id, name: r.display_name, timezone: r.timezone, bufferMinutes: r.buffer_minutes, isActive: r.is_active, hasCalendar: r.has_calendar }));
}

function availabilityScope(staff, counsellorId) {
    if (isAdmin(staff)) return counsellorId || null;
    if (counsellorId && counsellorId !== staff.id) throw forbidden('Counsellors can only manage their own availability.');
    return staff.id;
}

export async function getAvailabilityConfig(staff, counsellorId) {
    const scope = availabilityScope(staff, counsellorId);
    const [rules, exceptions] = await Promise.all([
        query('SELECT * FROM availability_rules WHERE ($1::uuid IS NULL OR counsellor_id = $1) ORDER BY counsellor_id, weekday, start_time', [scope]),
        query('SELECT * FROM availability_exceptions WHERE ($1::uuid IS NULL OR counsellor_id = $1) AND ends_at > $2 ORDER BY starts_at', [scope, addMinutes(now(), -7 * 24 * 60)]),
    ]);
    return {
        rules: rules.rows.map((r) => ({ id: r.id, counsellorId: r.counsellor_id, weekday: r.weekday, startTime: String(r.start_time).slice(0, 5), endTime: String(r.end_time).slice(0, 5), timezone: r.timezone, effectiveFrom: r.effective_from, effectiveUntil: r.effective_until })),
        exceptions: exceptions.rows.map((e) => ({ id: e.id, counsellorId: e.counsellor_id, startsAt: e.starts_at, endsAt: e.ends_at, reason: e.reason })),
    };
}

export async function createAvailability(staff, input) {
    const counsellorId = availabilityScope(staff, input.counsellorId) || input.counsellorId;
    const counsellor = (await query('SELECT user_id FROM counsellors WHERE user_id = $1', [counsellorId])).rows[0];
    if (!counsellor) throw badRequest('Unknown counsellor', { fields: { counsellorId: 'Choose a counsellor' } });
    return withTransaction(async (client) => {
        const id = crypto.randomUUID();
        if (input.kind === 'rule') {
            await client.query(
                `INSERT INTO availability_rules (id, counsellor_id, weekday, start_time, end_time, timezone, effective_from, effective_until, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [id, counsellorId, input.weekday, input.startTime, input.endTime, input.timezone, input.effectiveFrom || null, input.effectiveUntil || null, staff.id],
            );
        } else {
            await client.query(
                'INSERT INTO availability_exceptions (id, counsellor_id, starts_at, ends_at, reason, created_by) VALUES ($1, $2, $3, $4, $5, $6)',
                [id, counsellorId, input.startsAt, input.endsAt, input.reason || null, staff.id],
            );
        }
        await audit(client, { actorUserId: staff.id, action: `availability.${input.kind}_created`, entityType: 'counsellor', entityId: counsellorId, details: { id } });
        return { id, kind: input.kind };
    });
}

export async function deleteAvailability(staff, kind, id) {
    const table = kind === 'rule' ? 'availability_rules' : 'availability_exceptions';
    const scope = availabilityScope(staff, null);
    return withTransaction(async (client) => {
        const { rows } = await client.query(`DELETE FROM ${table} WHERE id = $1 AND ($2::uuid IS NULL OR counsellor_id = $2) RETURNING counsellor_id`, [id, scope]);
        if (!rows[0]) throw notFound('Availability entry not found');
        await audit(client, { actorUserId: staff.id, action: `availability.${kind}_deleted`, entityType: 'counsellor', entityId: rows[0].counsellor_id, details: { id } });
        return { deleted: true };
    });
}

/* ── Consultation types (admin only) ──────────────────────────────────────── */

export async function listAllTypes() {
    const { rows } = await query('SELECT * FROM consultation_types ORDER BY sort_order, name');
    return rows.map((t) => ({ ...typeView(t), isActive: t.is_active, sortOrder: t.sort_order }));
}

export async function saveType(staff, id, input) {
    return withTransaction(async (client) => {
        let row;
        if (id) {
            const sets = [];
            const values = [id];
            const map = { name: 'name', description: 'description', durationMinutes: 'duration_minutes', meetingMethods: 'meeting_methods', minNoticeMinutes: 'min_notice_minutes', maxAdvanceDays: 'max_advance_days', isActive: 'is_active', sortOrder: 'sort_order' };
            for (const [key, column] of Object.entries(map)) {
                if (input[key] === undefined) continue;
                values.push(input[key]);
                sets.push(`${column} = $${values.length}`);
            }
            if (!sets.length) throw badRequest('Nothing to update.');
            row = (await client.query(`UPDATE consultation_types SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`, values)).rows[0];
            if (!row) throw notFound('Consultation type not found');
        } else {
            try {
                row = (await client.query(
                    `INSERT INTO consultation_types (id, slug, name, description, duration_minutes, meeting_methods, min_notice_minutes, max_advance_days, is_active, sort_order)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
                    [crypto.randomUUID(), input.slug, input.name, input.description || '', input.durationMinutes, input.meetingMethods,
                        input.minNoticeMinutes ?? 180, input.maxAdvanceDays ?? 60, input.isActive ?? true, input.sortOrder ?? 100],
                )).rows[0];
            } catch (error) {
                if (error.code === '23505') throw conflict('A consultation type with this slug already exists.', 'SLUG_TAKEN');
                throw error;
            }
        }
        await audit(client, { actorUserId: staff.id, action: id ? 'consultation_type.updated' : 'consultation_type.created', entityType: 'consultation_type', entityId: row.id });
        return { ...typeView(row), isActive: row.is_active, sortOrder: row.sort_order };
    });
}

/* ── Notifications (admin only) ───────────────────────────────────────────── */

export async function listNotifications({ status, page, pageSize }) {
    const values = [status || null, pageSize, (page - 1) * pageSize];
    const { rows } = await query(
        `SELECT n.id, n.consultation_id, c.reference, n.template, n.recipient, n.status, n.attempts, n.max_attempts, n.last_error, n.scheduled_for, n.sent_at, n.created_at
         FROM notifications n LEFT JOIN consultations c ON c.id = n.consultation_id
         WHERE ($1::text IS NULL OR n.status = $1) ORDER BY n.created_at DESC LIMIT $2 OFFSET $3`,
        values,
    );
    return { items: rows, page, pageSize };
}
