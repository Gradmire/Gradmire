/* Calendar outbox. Booking changes queue `create` / `cancel` jobs in the same
   transaction; this module runs them. Event ids are deterministic per
   (consultation, generation), so a job that is retried after a timeout cannot
   create a second event, and one job row per (consultation, action,
   generation) stops duplicate jobs. A booking stays `reserved` until its event
   exists; repeated failures mark it `failed` for staff instead of confirming it. */
import { config } from '../config.js';
import { now } from '../lib/clock.js';
import { query, withTransaction } from '../lib/db.js';
import { calendarEventId, getCalendarProvider } from '../integrations/calendar/index.js';
import { audit, recordConsultationEvent } from './audit.js';
import { enqueueNotification, queueConfirmationMessages } from './notification-service.js';

const backoffMinutes = (attempts) => Math.min(60, 2 ** attempts);

/* Decides how a new or moved booking starts out. */
export function needsCalendar(counsellor) {
    return getCalendarProvider().configured && Boolean(counsellor.calendar_id);
}

/* A repeated create is ignored. A repeated cancel re-runs: if a create finished
   after an earlier cancel already ran, the event must be deleted again (deleting
   twice is harmless). */
export async function enqueueCalendarJob(client, { consultationId, action, generation, calendarId }) {
    await client.query(
        `INSERT INTO calendar_sync_jobs (id, consultation_id, action, generation, calendar_id, run_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (consultation_id, action, generation) DO UPDATE
           SET status = 'pending', attempts = 0, run_at = EXCLUDED.run_at, updated_at = NOW()
           WHERE calendar_sync_jobs.action = 'cancel' AND calendar_sync_jobs.status IN ('done', 'dead')`,
        [crypto.randomUUID(), consultationId, action, generation, calendarId, now()],
    );
}

async function claimJobs({ limit, consultationId }) {
    const { rows } = await query(
        `UPDATE calendar_sync_jobs SET status = 'running', attempts = attempts + 1, locked_until = $1::timestamptz + INTERVAL '2 minutes', updated_at = NOW()
         WHERE id IN (
           SELECT id FROM calendar_sync_jobs
           WHERE ((status IN ('pending', 'failed') AND run_at <= $1) OR (status = 'running' AND locked_until < $1))
             AND attempts < max_attempts AND ($2::uuid IS NULL OR consultation_id = $2)
           ORDER BY run_at LIMIT $3 FOR UPDATE SKIP LOCKED)
         RETURNING *`,
        [now(), consultationId, limit],
    );
    return rows;
}

const describe = (c) => [
    `${c.type_name} (${c.duration_minutes} min) — ${c.meeting_method.replace('_', ' ')}`,
    `Student: ${c.student_name}`,
    `Reference: ${c.reference}`,
    'Details and contact information are in the Gradmire consultations dashboard.',
].join('\n');

async function runCreate(job, provider) {
    const { rows } = await query(
        `SELECT c.*, t.name AS type_name, t.duration_minutes FROM consultations c
         JOIN consultation_types t ON t.id = c.consultation_type_id WHERE c.id = $1`,
        [job.consultation_id],
    );
    const c = rows[0];
    // Cancelled, moved or reassigned since the job was queued: nothing to create.
    if (!c || !['reserved', 'confirmed'].includes(c.status) || c.calendar_generation !== job.generation) return 'skipped';

    const eventId = calendarEventId(c.id, job.generation);
    const created = await provider.createEvent({
        calendarId: job.calendar_id,
        eventId,
        summary: `Gradmire: ${c.type_name} — ${c.student_name}`,
        description: describe(c),
        start: new Date(c.scheduled_start),
        end: new Date(c.scheduled_end),
        timeZone: c.timezone,
        attendeeEmail: c.student_email,
        withMeet: c.meeting_method === 'video',
    });

    const stillActive = await withTransaction(async (client) => {
        const locked = (await client.query('SELECT * FROM consultations WHERE id = $1 FOR UPDATE', [c.id])).rows[0];
        if (!locked || !['reserved', 'confirmed'].includes(locked.status) || locked.calendar_generation !== job.generation) {
            // It changed while we were talking to the calendar: remove the event again.
            await enqueueCalendarJob(client, { consultationId: c.id, action: 'cancel', generation: job.generation, calendarId: job.calendar_id });
            return false;
        }
        const meetUrl = created.meetUrl && !locked.meeting_url ? created.meetUrl : null;
        const updated = (await client.query(
            `UPDATE consultations SET calendar_status = 'synced', calendar_event_id = $2,
               meeting_url = COALESCE($3, meeting_url), meeting_provider = CASE WHEN $3 IS NOT NULL THEN 'google_meet' ELSE meeting_provider END,
               status = CASE WHEN status = 'reserved' THEN 'confirmed' ELSE status END, updated_at = NOW()
             WHERE id = $1 RETURNING *`,
            [c.id, created.eventId, meetUrl],
        )).rows[0];
        await recordConsultationEvent(client, { consultationId: c.id, actorType: 'system', event: 'calendar_synced', details: { provider: provider.name, meetLink: Boolean(meetUrl) } });
        if (locked.status === 'reserved') {
            await recordConsultationEvent(client, { consultationId: c.id, actorType: 'system', event: 'confirmed' });
            await queueConfirmationMessages(client, updated);
        }
        return true;
    });
    return stillActive ? 'done' : 'superseded';
}

async function runCancel(job, provider) {
    await provider.deleteEvent({ calendarId: job.calendar_id, eventId: calendarEventId(job.consultation_id, job.generation) });
    return 'done';
}

async function markFailure(job, error) {
    const dead = Boolean(error.permanent) || job.attempts >= job.max_attempts;
    const message = String(error.message || 'Calendar error').slice(0, 1000);
    await withTransaction(async (client) => {
        await client.query(
            `UPDATE calendar_sync_jobs SET status = $2, last_error = $3, locked_until = NULL, run_at = $4, updated_at = NOW() WHERE id = $1`,
            [job.id, dead ? 'dead' : 'failed', message, new Date(now().getTime() + backoffMinutes(job.attempts) * 60_000)],
        );
        if (!dead || job.action !== 'create') return;
        const { rows } = await client.query(
            "UPDATE consultations SET calendar_status = 'failed', updated_at = NOW() WHERE id = $1 AND calendar_generation = $2 AND status IN ('reserved', 'confirmed') RETURNING id, reference",
            [job.consultation_id, job.generation],
        );
        if (!rows[0]) return;
        await recordConsultationEvent(client, { consultationId: job.consultation_id, actorType: 'system', event: 'calendar_failed', details: { error: message.slice(0, 200) } });
        await audit(client, { action: 'calendar.sync_failed', entityType: 'consultation', entityId: job.consultation_id });
        if (config.adminAlertEmail()) {
            await enqueueNotification(client, {
                template: 'staff_calendar_failed', recipient: config.adminAlertEmail(),
                dedupeKey: `${job.consultation_id}:calendar_failed:${job.generation}`,
                payload: { consultationId: job.consultation_id, reference: rows[0].reference, error: message.slice(0, 300) },
            });
        }
    });
}

export async function processCalendarJobs({ limit = 10, consultationId = null } = {}) {
    const provider = getCalendarProvider();
    const results = { done: 0, failed: 0, skipped: 0 };
    if (!provider.configured) return results;
    for (const job of await claimJobs({ limit, consultationId })) {
        try {
            const outcome = job.action === 'create' ? await runCreate(job, provider) : await runCancel(job, provider);
            await query("UPDATE calendar_sync_jobs SET status = 'done', last_error = NULL, locked_until = NULL, updated_at = NOW() WHERE id = $1", [job.id]);
            if (outcome === 'skipped') results.skipped += 1;
            else results.done += 1;
        } catch (error) {
            await markFailure(job, error);
            results.failed += 1;
        }
    }
    return results;
}

/* Reconciliation: active bookings still waiting for a calendar event but with
   no live job (e.g. a job row was removed by hand) get their job back. */
export async function reconcileCalendar() {
    if (!getCalendarProvider().configured) return 0;
    const { rowCount } = await query(
        `INSERT INTO calendar_sync_jobs (id, consultation_id, action, generation, calendar_id)
         SELECT gen_random_uuid(), c.id, 'create', c.calendar_generation, co.calendar_id
         FROM consultations c JOIN counsellors co ON co.user_id = c.counsellor_id
         WHERE c.status IN ('reserved', 'confirmed') AND c.calendar_status = 'pending' AND co.calendar_id IS NOT NULL
           AND c.scheduled_start > NOW()
         ON CONFLICT (consultation_id, action, generation) DO NOTHING`,
    );
    return rowCount;
}

/* Staff retry after a terminal failure: requeue the current generation's create job. */
export async function retryCalendarSync(client, consultation, calendarId) {
    await client.query("UPDATE consultations SET calendar_status = 'pending', updated_at = NOW() WHERE id = $1", [consultation.id]);
    const { rowCount } = await client.query(
        `UPDATE calendar_sync_jobs SET status = 'pending', attempts = 0, run_at = $3, last_error = NULL, updated_at = NOW()
         WHERE consultation_id = $1 AND action = 'create' AND generation = $2`,
        [consultation.id, consultation.calendar_generation, now()],
    );
    if (!rowCount) await enqueueCalendarJob(client, { consultationId: consultation.id, action: 'create', generation: consultation.calendar_generation, calendarId });
}
