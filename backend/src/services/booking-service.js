/* Booking lifecycle: create, cancel, reschedule, guest access and claiming.
   Every change runs in one transaction that also queues its calendar job and
   notifications (outbox), so the database is the single source of truth.

   State machine
     reserved  — slot held; calendar event not created yet
     confirmed — slot held and (if a calendar is configured) the event exists
     completed / no_show — set by staff after the start time
     cancelled — by the student, a guest link, or staff
     rescheduled — superseded; `rescheduled_from_id` on the new row points here */
import { config } from '../config.js';
import { now } from '../lib/clock.js';
import { bookingReference, sha256 } from '../lib/crypto.js';
import { query, withSavepoint, withTransaction } from '../lib/db.js';
import { badRequest, conflict, forbidden, HttpError, notFound } from '../lib/http.js';
import { addMinutes, dayBounds } from '../lib/time.js';
import { audit, recordConsultationEvent } from './audit.js';
import { ACTIVE_STATUSES, findSlots } from './availability-service.js';
import { enqueueCalendarJob, needsCalendar, processCalendarJobs } from './calendar-sync.js';
import { manageTokenHash, newManageToken } from './manage-token.js';
import { enqueueNotification, processNotifications, queueCancellationMessages, queueConfirmationMessages } from './notification-service.js';

/* ── Consultation types ───────────────────────────────────────────────────── */

export const typeView = (t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    description: t.description,
    durationMinutes: t.duration_minutes,
    meetingMethods: t.meeting_methods,
    minNoticeMinutes: t.min_notice_minutes,
    maxAdvanceDays: t.max_advance_days,
});

export async function listActiveTypes() {
    const { rows } = await query('SELECT * FROM consultation_types WHERE is_active ORDER BY sort_order, name');
    return rows.map(typeView);
}

async function loadType(client, id, { lock = false } = {}) {
    const { rows } = await client.query(`SELECT * FROM consultation_types WHERE id = $1${lock ? ' FOR SHARE' : ''}`, [id]);
    return rows[0] || null;
}

/* ── Availability ─────────────────────────────────────────────────────────── */

export async function getAvailability({ consultationTypeId, date, timezone, counsellorId }) {
    const client = { query };
    const type = await loadType(client, consultationTypeId);
    if (!type || !type.is_active) throw new HttpError(422, 'This consultation type is not available for booking', 'TYPE_UNAVAILABLE');
    const { start, end } = dayBounds(date, timezone);
    const slots = await findSlots(client, { type, from: start, to: end, counsellorId });
    return {
        consultationTypeId: type.id,
        date: `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`,
        timezone,
        durationMinutes: type.duration_minutes,
        // Counsellor ids are internal; the server assigns one when the booking is made.
        slots: slots.map((slot) => ({ start: slot.start.toISOString(), end: slot.end.toISOString() })),
    };
}

/* ── Views ────────────────────────────────────────────────────────────────── */

const CONSULTATION_SELECT = `
  SELECT c.*, t.name AS type_name, t.slug AS type_slug, t.duration_minutes AS type_duration,
         co.display_name AS counsellor_name, co.timezone AS counsellor_timezone, co.calendar_id AS counsellor_calendar_id
  FROM consultations c
  JOIN consultation_types t ON t.id = c.consultation_type_id
  JOIN counsellors co ON co.user_id = c.counsellor_id`;

function changeRules(c) {
    const start = new Date(c.scheduled_start);
    const deadline = addMinutes(start, -config.changeCutoffHours() * 60);
    const active = ACTIVE_STATUSES.includes(c.status);
    const beforeDeadline = now() <= deadline;
    return {
        changeDeadline: deadline.toISOString(),
        canCancel: active && beforeDeadline,
        canReschedule: active && beforeDeadline && c.reschedule_count < config.maxReschedules(),
    };
}

/* What a student (or a guest holding the manage link) may see. No notes, no
   internal ids, no calendar internals. */
export function studentView(c) {
    return {
        id: c.id,
        reference: c.reference,
        status: c.status,
        type: { id: c.consultation_type_id, name: c.type_name, durationMinutes: c.type_duration },
        start: new Date(c.scheduled_start).toISOString(),
        end: new Date(c.scheduled_end).toISOString(),
        timezone: c.timezone,
        meetingMethod: c.meeting_method,
        // A link is shown only once it really exists and the booking is confirmed.
        meetingUrl: c.status === 'confirmed' && c.meeting_url ? c.meeting_url : null,
        counsellor: { name: c.counsellor_name },
        studentName: c.student_name,
        studentEmail: c.student_email,
        studentPhone: c.student_phone,
        preferences: {
            destination: c.preferred_destination, degree: c.intended_degree,
            course: c.preferred_course, intake: c.intended_intake,
        },
        message: c.message,
        cancellationReason: c.status === 'cancelled' ? c.cancellation_reason : null,
        linkedToAccount: Boolean(c.student_user_id),
        createdAt: new Date(c.created_at).toISOString(),
        ...changeRules(c),
    };
}

async function loadConsultation(clientOrNull, id) {
    const run = clientOrNull || { query };
    const { rows } = await run.query(`${CONSULTATION_SELECT} WHERE c.id = $1`, [id]);
    return rows[0] || null;
}

/* ── Lead handling ────────────────────────────────────────────────────────── */

function splitName(fullName) {
    const parts = fullName.trim().split(/\s+/);
    return { first: parts[0].slice(0, 120), last: parts.slice(1).join(' ').slice(0, 120) || null };
}

/* Reuse a lead only when the same email AND phone already exist (guest) or the
   lead already belongs to this account; otherwise create one. A matching name
   or email alone is never enough to merge records. */
async function upsertLead(client, { userId, name, email, phone, input, typeSlug }) {
    let existing;
    if (userId) {
        existing = (await client.query('SELECT id FROM leads WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId])).rows[0];
    } else {
        existing = (await client.query(
            `SELECT id FROM leads WHERE user_id IS NULL AND LOWER(email) = $1
               AND REGEXP_REPLACE(COALESCE(phone, ''), '[\\s().-]', '', 'g') = $2
             ORDER BY created_at DESC LIMIT 1`,
            [email, phone],
        )).rows[0];
    }
    const prefs = [input.destination || null, input.intake || null, input.degree || null, input.course || null, typeSlug];
    if (existing) {
        await client.query(
            `UPDATE leads SET primary_destination = COALESCE($2, primary_destination), intended_intake = COALESCE($3, intended_intake),
               study_level = COALESCE($4, study_level), preferred_course = COALESCE($5, preferred_course),
               service_interest = $6, contact_consent = TRUE, updated_at = NOW(),
               status = CASE WHEN status IN ('new', 'contacted', 'qualified') THEN 'consultation_booked' ELSE status END
             WHERE id = $1`,
            [existing.id, ...prefs],
        );
        return existing.id;
    }
    const id = crypto.randomUUID();
    const { first, last } = splitName(name);
    await client.query(
        `INSERT INTO leads (id, source, user_id, first_name, last_name, email, phone, primary_destination, intended_intake,
           study_level, preferred_course, service_interest, contact_consent, marketing_opt_in, status)
         VALUES ($1, 'booking', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, $12, $13)`,
        [id, userId, first, last, email, phone, ...prefs, input.marketingOptIn === true, userId ? 'converted' : 'consultation_booked'],
    );
    return id;
}

/* Spread bookings: the counsellor with the fewest active bookings around that time goes first. */
async function orderByLoad(client, counsellorIds, start, preferred = null) {
    const { rows } = await client.query(
        `SELECT counsellor_id, COUNT(*)::int AS load FROM consultations
         WHERE counsellor_id = ANY($1) AND status = ANY($2) AND scheduled_start BETWEEN $3 AND $4
         GROUP BY counsellor_id`,
        [counsellorIds, ACTIVE_STATUSES, addMinutes(start, -12 * 60), addMinutes(start, 12 * 60)],
    );
    const load = new Map(rows.map((row) => [row.counsellor_id, row.load]));
    const ordered = [...counsellorIds].sort((a, b) => (load.get(a) || 0) - (load.get(b) || 0) || a.localeCompare(b));
    if (preferred && ordered.includes(preferred)) return [preferred, ...ordered.filter((id) => id !== preferred)];
    return ordered;
}

/* Inserts against each candidate counsellor in turn. The exclusion constraints
   are the real guard: a concurrent booking that won the slot makes this insert
   fail and we try the next counsellor. */
async function insertForCandidates(client, candidates, start, buildRow) {
    for (const counsellorId of candidates) {
        const slotLock = await client.query(
            "SELECT pg_try_advisory_xact_lock(hashtextextended('gradmire:booking:counsellor-slot:' || $1 || ':' || $2, 0)) AS locked",
            [counsellorId, new Date(start).toISOString()],
        );
        if (!slotLock.rows[0].locked) continue;

        const counsellor = (await client.query('SELECT * FROM counsellors WHERE user_id = $1', [counsellorId])).rows[0];
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const row = buildRow(counsellor);
            const columns = Object.keys(row);
            try {
                const { rows } = await withSavepoint(client, 'book_slot', () => client.query(
                    `INSERT INTO consultations (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
                    columns.map((column) => row[column]),
                ));
                return { consultation: rows[0], counsellor };
            } catch (error) {
                if (error.code === '23P01' && error.constraint === 'consultations_counsellor_no_overlap') break;
                if (error.code === '23P01' && error.constraint === 'consultations_student_no_overlap') {
                    throw conflict('You already have a consultation booked at this time.', 'STUDENT_OVERLAP');
                }
                if (error.code === '23505' && error.constraint === 'consultations_reference_key') continue;
                throw error;
            }
        }
    }
    throw conflict('That time is no longer available. Please choose another slot.', 'SLOT_UNAVAILABLE');
}

/* Starts the booking in the right state and queues the follow-up work. */
async function startLifecycle(client, consultation, counsellor, { actorType, actorUserId, event, details = {} }) {
    await recordConsultationEvent(client, { consultationId: consultation.id, actorType, actorUserId, event, details });
    if (needsCalendar(counsellor)) {
        await enqueueCalendarJob(client, { consultationId: consultation.id, action: 'create', generation: consultation.calendar_generation, calendarId: counsellor.calendar_id });
        return consultation;
    }
    await recordConsultationEvent(client, { consultationId: consultation.id, actorType: 'system', event: 'confirmed', details: { calendar: 'not_required' } });
    await queueConfirmationMessages(client, consultation);
    return consultation;
}

const initialState = (counsellor) => (needsCalendar(counsellor)
    ? { status: 'reserved', calendar_status: 'pending' }
    : { status: 'confirmed', calendar_status: 'not_required' });

/* Tries to finish calendar sync and send the first emails before we answer,
   so most bookings come back "confirmed". If it takes too long the booking
   simply stays "reserved" and the worker carries on. */
async function settle(...consultationIds) {
    const work = (async () => {
        for (const consultationId of consultationIds) await processCalendarJobs({ consultationId });
        for (const consultationId of consultationIds) await processNotifications({ consultationId, limit: 5 });
    })().catch((error) => console.warn('Inline booking follow-up failed; the worker will retry:', error.message));
    await Promise.race([work, new Promise((resolve) => setTimeout(resolve, config.inlineSyncTimeoutMs()).unref?.())]);
}

/* ── Create ───────────────────────────────────────────────────────────────── */

export async function createBooking(input, { user = null, idempotencyKey = null } = {}) {
    // Staff sessions book as guests; only student accounts own bookings.
    const student = user && user.role === 'student' ? user : null;
    const email = student ? student.email.toLowerCase() : input.email;
    const name = student ? [student.first_name, student.last_name].filter(Boolean).join(' ') : input.fullName;
    const phone = input.phone || student?.phone;
    if (!phone) throw badRequest('Phone number is required', { fields: { phone: 'Phone number is required' } });
    if (!name) throw badRequest('Full name is required', { fields: { fullName: 'Full name is required' } });

    const fingerprint = sha256(JSON.stringify([input.consultationTypeId, input.start.toISOString(), email, input.meetingMethod]));
    const manage = newManageToken();

    const replay = async () => {
        if (!idempotencyKey) return null;
        const { rows } = await query('SELECT id, idempotency_fingerprint FROM consultations WHERE idempotency_key = $1', [idempotencyKey]);
        if (!rows[0]) return null;
        if (rows[0].idempotency_fingerprint !== fingerprint) {
            throw new HttpError(422, 'This Idempotency-Key was already used for a different booking request.', 'IDEMPOTENCY_MISMATCH');
        }
        return rows[0].id;
    };

    const replayedId = await replay();
    if (replayedId) return { consultation: studentView(await loadConsultation(null, replayedId)), replayed: true };

    let bookingResult;
    try {
        bookingResult = await withTransaction(async (client) => {
            if (idempotencyKey) {
                await client.query(
                    "SELECT pg_advisory_xact_lock(hashtextextended('gradmire:booking:idempotency:' || $1, 0))",
                    [idempotencyKey],
                );
                const existing = (await client.query(
                    'SELECT id, idempotency_fingerprint FROM consultations WHERE idempotency_key = $1',
                    [idempotencyKey],
                )).rows[0];
                if (existing) {
                    if (existing.idempotency_fingerprint !== fingerprint) {
                        throw new HttpError(422, 'This Idempotency-Key was already used for a different booking request.', 'IDEMPOTENCY_MISMATCH');
                    }
                    return { id: existing.id, replayed: true };
                }
            }

            const type = await loadType(client, input.consultationTypeId, { lock: true });
            if (!type || !type.is_active) throw new HttpError(422, 'This consultation type is not available for booking.', 'TYPE_UNAVAILABLE');
            if (!type.meeting_methods.includes(input.meetingMethod)) {
                throw badRequest('That meeting method is not offered for this consultation type.', { fields: { meetingMethod: 'Choose one of the offered meeting methods' } });
            }
            // Re-derive availability on the server; the client's slot list is never trusted.
            const slots = await findSlots(client, { type, from: input.start, to: addMinutes(input.start, 1), exactStart: input.start });
            if (!slots.length) throw conflict('That time is no longer available. Please choose another slot.', 'SLOT_UNAVAILABLE');
            const candidates = await orderByLoad(client, slots[0].counsellorIds, input.start);

            const leadId = await upsertLead(client, { userId: student?.id || null, name, email, phone, input, typeSlug: type.slug });
            if (student && !student.phone) await client.query('UPDATE users SET phone = $2, updated_at = NOW() WHERE id = $1 AND phone IS NULL', [student.id, phone]);

            const end = addMinutes(input.start, type.duration_minutes);
            const { consultation, counsellor } = await insertForCandidates(client, candidates, input.start, (c) => ({
                id: crypto.randomUUID(),
                reference: bookingReference(),
                student_user_id: student?.id || null,
                lead_id: leadId,
                consultation_type_id: type.id,
                counsellor_id: c.user_id,
                student_name: name,
                student_email: email,
                student_phone: phone,
                preferred_destination: input.destination || null,
                intended_degree: input.degree || null,
                preferred_course: input.course || null,
                intended_intake: input.intake || null,
                academic_summary: input.academicSummary || null,
                message: input.message || null,
                scheduled_start: input.start,
                scheduled_end: end,
                blocked_until: addMinutes(end, c.buffer_minutes),
                timezone: input.timezone,
                meeting_method: input.meetingMethod,
                reminders_opt_in: input.remindersOptIn !== false,
                manage_token_seed: manage.seed,
                manage_token_hash: manage.hash,
                idempotency_key: idempotencyKey,
                idempotency_fingerprint: idempotencyKey ? fingerprint : null,
                ...initialState(c),
            }));
            await startLifecycle(client, consultation, counsellor, {
                actorType: student ? 'student' : 'guest', actorUserId: student?.id || null, event: 'created',
                details: { source: 'website', counsellorAssigned: true },
            });
            return { id: consultation.id, replayed: false };
        });
    } catch (error) {
        // A concurrent request with the same key may have won the race.
        if (idempotencyKey && (error.code === '23505' || error.status === 409)) {
            const id = await replay();
            if (id) return { consultation: studentView(await loadConsultation(null, id)), replayed: true };
        }
        throw error;
    }

    if (bookingResult.replayed) {
        return { consultation: studentView(await loadConsultation(null, bookingResult.id)), replayed: true };
    }

    await settle(bookingResult.id);
    return { consultation: studentView(await loadConsultation(null, bookingResult.id)), manageToken: manage.token, replayed: false };
}

/* ── Access scopes ────────────────────────────────────────────────────────── */

/* scope: { studentUserId } | { manageToken } | { counsellorId } | { staff: true } */
async function lockForChange(client, id, scope) {
    let rows;
    if (scope.manageToken) {
        ({ rows } = await client.query('SELECT * FROM consultations WHERE manage_token_hash = $1 FOR UPDATE', [manageTokenHash(scope.manageToken)]));
    } else {
        ({ rows } = await client.query('SELECT * FROM consultations WHERE id = $1 FOR UPDATE', [id]));
    }
    const c = rows[0];
    // Not-yours and not-found look identical, so ids cannot be probed.
    if (!c) throw notFound('Consultation not found');
    if (scope.studentUserId && c.student_user_id !== scope.studentUserId) throw notFound('Consultation not found');
    if (scope.counsellorId && c.counsellor_id !== scope.counsellorId) throw notFound('Consultation not found');
    return c;
}

function assertStudentMayChange(c, action) {
    if (!ACTIVE_STATUSES.includes(c.status)) throw conflict(`This consultation can no longer be ${action === 'cancel' ? 'cancelled' : 'rescheduled'}.`, 'NOT_ACTIVE');
    const rules = changeRules(c);
    if (!(action === 'cancel' ? rules.canCancel : rules.canReschedule)) {
        if (action === 'reschedule' && c.reschedule_count >= config.maxReschedules() && now() <= new Date(rules.changeDeadline)) {
            throw conflict(`A booking can be rescheduled at most ${config.maxReschedules()} times. Please contact us.`, 'RESCHEDULE_LIMIT');
        }
        throw conflict(`Changes are possible up to ${config.changeCutoffHours()} hours before the start time. Please contact us instead.`, 'POLICY_CUTOFF');
    }
}

const actorFor = (scope, userId) => (scope.manageToken ? { actorType: 'guest', actorUserId: null }
    : scope.studentUserId ? { actorType: 'student', actorUserId: userId } : { actorType: 'staff', actorUserId: userId });

/* ── Cancel ───────────────────────────────────────────────────────────────── */

export async function cancelInTransaction(client, c, { scope, userId = null, reason = null }) {
    const isStaff = !scope.studentUserId && !scope.manageToken;
    if (isStaff) {
        if (!ACTIVE_STATUSES.includes(c.status)) throw conflict('Only reserved or confirmed consultations can be cancelled.', 'NOT_ACTIVE');
    } else {
        assertStudentMayChange(c, 'cancel');
    }
    const { rows } = await client.query(
        `UPDATE consultations SET status = 'cancelled', cancelled_by = $2, cancellation_reason = $3, cancelled_at = $4, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [c.id, isStaff ? 'staff' : 'student', reason, now()],
    );
    const { actorType, actorUserId } = actorFor(scope, userId);
    await recordConsultationEvent(client, { consultationId: c.id, actorType, actorUserId, event: 'cancelled', details: { reason: reason ? 'given' : 'none' } });
    if (c.calendar_status !== 'not_required') {
        const calendarId = (await client.query('SELECT calendar_id FROM counsellors WHERE user_id = $1', [c.counsellor_id])).rows[0]?.calendar_id;
        if (calendarId) await enqueueCalendarJob(client, { consultationId: c.id, action: 'cancel', generation: c.calendar_generation, calendarId });
    }
    await queueCancellationMessages(client, rows[0]);
    return rows[0];
}

export async function cancelConsultation({ id = null, scope, userId = null, reason = null }) {
    const cancelled = await withTransaction(async (client) => {
        const c = await lockForChange(client, id, scope);
        return cancelInTransaction(client, c, { scope, userId, reason });
    });
    await settle(cancelled.id);
    return studentView(await loadConsultation(null, cancelled.id));
}

/* ── Reschedule ───────────────────────────────────────────────────────────── */

export async function rescheduleConsultation({ id = null, scope, userId = null, start, timezone = null }) {
    let oldId;
    const newId = await withTransaction(async (client) => {
        const old = await lockForChange(client, id, scope);
        oldId = old.id;
        const isStaff = !scope.studentUserId && !scope.manageToken;
        if (isStaff) {
            if (!ACTIVE_STATUSES.includes(old.status)) throw conflict('Only reserved or confirmed consultations can be rescheduled.', 'NOT_ACTIVE');
        } else {
            assertStudentMayChange(old, 'reschedule');
        }
        if (new Date(old.scheduled_start).getTime() === start.getTime()) throw badRequest('Choose a different time from the current booking.', { fields: { start: 'Choose a different time' } });

        const type = await loadType(client, old.consultation_type_id, { lock: true });
        // The old booking's own block must not hide slots right next to it.
        const slots = await findSlots(client, { type, from: start, to: addMinutes(start, 1), exactStart: start, excludeConsultationId: old.id });
        if (!slots.length) throw conflict('That time is no longer available. Please choose another slot.', 'SLOT_UNAVAILABLE');
        const candidates = await orderByLoad(client, slots[0].counsellorIds, start, old.counsellor_id);

        // Release the old slot first (same transaction): if the new insert
        // fails, the rollback restores the original booking untouched.
        await client.query(
            "UPDATE consultations SET status = 'rescheduled', manage_token_seed = NULL, manage_token_hash = NULL, updated_at = NOW() WHERE id = $1",
            [old.id],
        );
        const end = addMinutes(start, type.duration_minutes);
        const { consultation, counsellor } = await insertForCandidates(client, candidates, start, (c) => ({
            id: crypto.randomUUID(),
            reference: bookingReference(),
            student_user_id: old.student_user_id,
            lead_id: old.lead_id,
            consultation_type_id: old.consultation_type_id,
            counsellor_id: c.user_id,
            student_name: old.student_name,
            student_email: old.student_email,
            student_phone: old.student_phone,
            preferred_destination: old.preferred_destination,
            intended_degree: old.intended_degree,
            preferred_course: old.preferred_course,
            intended_intake: old.intended_intake,
            academic_summary: old.academic_summary,
            message: old.message,
            scheduled_start: start,
            scheduled_end: end,
            blocked_until: addMinutes(end, c.buffer_minutes),
            timezone: timezone || old.timezone,
            meeting_method: old.meeting_method,
            reminders_opt_in: old.reminders_opt_in,
            // The guest's existing link keeps working and now opens the new booking.
            manage_token_seed: old.manage_token_seed,
            manage_token_hash: old.manage_token_hash,
            rescheduled_from_id: old.id,
            reschedule_count: old.reschedule_count + 1,
            source: old.source,
            ...initialState(c),
        }));

        const { actorType, actorUserId } = actorFor(scope, userId);
        await recordConsultationEvent(client, { consultationId: old.id, actorType, actorUserId, event: 'rescheduled', details: { to: consultation.id } });
        if (old.calendar_status !== 'not_required') {
            const calendarId = (await client.query('SELECT calendar_id FROM counsellors WHERE user_id = $1', [old.counsellor_id])).rows[0]?.calendar_id;
            if (calendarId) await enqueueCalendarJob(client, { consultationId: old.id, action: 'cancel', generation: old.calendar_generation, calendarId });
        }
        await queueCancellationMessages(client, old, { notifyStudent: false });
        await startLifecycle(client, consultation, counsellor, { actorType, actorUserId, event: 'created', details: { rescheduledFrom: old.id } });
        return consultation.id;
    });
    // The old booking's calendar removal and the counsellor notice run now too.
    await settle(newId, oldId);
    return studentView(await loadConsultation(null, newId));
}

/* ── Student and guest reads ──────────────────────────────────────────────── */

export async function listStudentConsultations(userId) {
    const { rows } = await query(
        `${CONSULTATION_SELECT} WHERE c.student_user_id = $1 AND c.status <> 'rescheduled' ORDER BY c.scheduled_start DESC LIMIT 200`,
        [userId],
    );
    return rows.map(studentView);
}

export async function getStudentConsultation(userId, id) {
    const c = await loadConsultation(null, id);
    if (!c || c.student_user_id !== userId) throw notFound('Consultation not found');
    return studentView(c);
}

export async function getByManageToken(token) {
    const { rows } = await query(`${CONSULTATION_SELECT} WHERE c.manage_token_hash = $1`, [manageTokenHash(token)]);
    if (!rows[0]) throw notFound('This booking link is not valid.');
    return studentView(rows[0]);
}

/* Links a guest booking to the logged-in student. Requires the manage link
   (proof of receiving the confirmation) AND a verified account email that
   matches the booking, so a typed-in email can never take over a booking. */
export async function claimConsultation(user, token) {
    if (user.role !== 'student') throw forbidden('Only student accounts can claim bookings.');
    if (!user.email_verified_at) throw forbidden('Verify your email address first, then try again.');
    return withTransaction(async (client) => {
        const c = await lockForChange(client, null, { manageToken: token });
        if (c.student_email.toLowerCase() !== user.email.toLowerCase()) {
            throw forbidden('This booking was made with a different email address than your account.');
        }
        if (c.student_user_id && c.student_user_id !== user.id) throw forbidden('This booking already belongs to another account.');
        // Link the whole reschedule chain so history stays together.
        await client.query(
            `WITH RECURSIVE chain AS (
               SELECT id, rescheduled_from_id FROM consultations WHERE id = $1
               UNION ALL SELECT p.id, p.rescheduled_from_id FROM consultations p JOIN chain ON p.id = chain.rescheduled_from_id)
             UPDATE consultations SET student_user_id = $2, updated_at = NOW() WHERE id IN (SELECT id FROM chain) AND student_user_id IS NULL`,
            [c.id, user.id],
        );
        if (c.lead_id) await client.query("UPDATE leads SET user_id = $2, status = 'converted', updated_at = NOW() WHERE id = $1 AND user_id IS NULL", [c.lead_id, user.id]);
        await recordConsultationEvent(client, { consultationId: c.id, actorType: 'student', actorUserId: user.id, event: 'claimed' });
        await audit(client, { actorUserId: user.id, action: 'consultation.claimed', entityType: 'consultation', entityId: c.id });
        return studentView(await loadConsultation(client, c.id));
    });
}

/* A guest who lost their confirmation email asks for the links again. The links
   go only to the address the booking was made with, so knowing an email gets
   nobody else's booking; the caller always gets the same answer. One resend per
   booking per hour (dedupe key) stops this being used to flood an inbox. */
export async function resendManageLinks(email) {
    await withTransaction(async (client) => {
        const { rows } = await client.query(
            `SELECT id, student_email, student_user_id FROM consultations
             WHERE LOWER(student_email) = $1 AND status IN ('reserved', 'confirmed') AND scheduled_start > $2 AND manage_token_seed IS NOT NULL
             ORDER BY scheduled_start LIMIT 5`,
            [email.toLowerCase(), now()],
        );
        const hour = Math.floor(now().getTime() / 3600_000);
        for (const c of rows) {
            await enqueueNotification(client, {
                consultationId: c.id, userId: c.student_user_id, template: 'booking_link', recipient: c.student_email,
                dedupeKey: `${c.id}:booking_link:${hour}`,
            });
        }
        return rows.length;
    });
    return { sent: true };
}

export { loadConsultation, CONSULTATION_SELECT, lockForChange, startLifecycle, initialState, settle };
