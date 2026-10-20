/* Notification outbox. Rows are queued inside the same transaction as the
   booking change, then delivered by the worker. `dedupe_key` is unique, so a
   retried job or a repeated state change never queues a second copy, and the
   provider's idempotency key stops a retried send from delivering twice.
   Without a configured provider rows end as `skipped` — never `sent`. */
import { config } from '../config.js';
import { now } from '../lib/clock.js';
import { query } from '../lib/db.js';
import { getEmailProvider } from '../integrations/email/index.js';
import { verificationToken } from './auth-service.js';
import { manageTokenFromSeed } from './manage-token.js';
import { renderTemplate } from './notification-templates.js';

const REMINDER_TEMPLATE = { 1440: 'reminder_24h', 60: 'reminder_1h' };

export async function enqueueNotification(client, { consultationId = null, userId = null, template, recipient, dedupeKey, payload = {}, scheduledFor = null }) {
    await client.query(
        `INSERT INTO notifications (id, consultation_id, user_id, channel, template, recipient, dedupe_key, payload, scheduled_for)
         VALUES ($1, $2, $3, 'email', $4, $5, $6, $7, COALESCE($8, NOW()))
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [crypto.randomUUID(), consultationId, userId, template, recipient, dedupeKey, JSON.stringify(payload), scheduledFor],
    );
}

/* Called once a consultation becomes confirmed (directly, after calendar sync,
   or by staff). Queues the student confirmation, the counsellor notice and reminders. */
export async function queueConfirmationMessages(client, consultation) {
    const template = consultation.rescheduled_from_id ? 'booking_rescheduled' : 'booking_confirmed';
    await enqueueNotification(client, {
        consultationId: consultation.id, userId: consultation.student_user_id, template,
        recipient: consultation.student_email, dedupeKey: `${consultation.id}:${template}`,
    });
    const counsellor = await client.query('SELECT u.email FROM users u WHERE u.id = $1', [consultation.counsellor_id]);
    if (counsellor.rows[0]) {
        await enqueueNotification(client, {
            consultationId: consultation.id, template: 'counsellor_new_booking', recipient: counsellor.rows[0].email,
            dedupeKey: `${consultation.id}:counsellor_new_booking:${consultation.counsellor_id}`,
        });
    }
    if (!consultation.reminders_opt_in) return;
    const start = new Date(consultation.scheduled_start).getTime();
    for (const minutes of config.reminderOffsetsMinutes()) {
        const at = new Date(start - minutes * 60_000);
        if (at <= now()) continue; // too late for this reminder
        await enqueueNotification(client, {
            consultationId: consultation.id, userId: consultation.student_user_id,
            template: REMINDER_TEMPLATE[minutes] || 'reminder_24h', recipient: consultation.student_email,
            dedupeKey: `${consultation.id}:reminder:${minutes}`, scheduledFor: at, payload: { minutesBefore: minutes },
        });
    }
}

/* Cancellation or reschedule: drop reminders that have not gone out and tell both sides. */
export async function queueCancellationMessages(client, consultation, { notifyStudent = true } = {}) {
    await client.query(
        "UPDATE notifications SET status = 'cancelled', updated_at = NOW() WHERE consultation_id = $1 AND status IN ('pending', 'failed') AND template LIKE 'reminder%'",
        [consultation.id],
    );
    if (notifyStudent) {
        await enqueueNotification(client, {
            consultationId: consultation.id, userId: consultation.student_user_id, template: 'booking_cancelled',
            recipient: consultation.student_email, dedupeKey: `${consultation.id}:booking_cancelled`,
        });
    }
    // The counsellor only hears about it if they were told about the booking.
    const told = await client.query("SELECT recipient FROM notifications WHERE consultation_id = $1 AND template = 'counsellor_new_booking' AND status IN ('pending', 'sent', 'sending', 'failed', 'skipped') LIMIT 1", [consultation.id]);
    if (told.rows[0]) {
        await enqueueNotification(client, {
            consultationId: consultation.id, template: 'counsellor_cancelled', recipient: told.rows[0].recipient,
            dedupeKey: `${consultation.id}:counsellor_cancelled`,
        });
    }
}

const CONSULTATION_FOR_MESSAGE = `
  SELECT c.*, t.name AS type_name, co.display_name AS counsellor_name, co.timezone AS counsellor_timezone
  FROM consultations c JOIN consultation_types t ON t.id = c.consultation_type_id
  JOIN counsellors co ON co.user_id = c.counsellor_id WHERE c.id = $1`;

/* Whether a queued message still makes sense for the consultation's current state. */
function stillRelevant(template, c) {
    switch (template) {
        case 'booking_confirmed':
        case 'booking_rescheduled':
        case 'counsellor_new_booking':
            return c.status === 'confirmed' || c.status === 'completed';
        case 'reminder_24h':
        case 'reminder_1h':
            return c.status === 'confirmed' && new Date(c.scheduled_start) > now();
        default:
            return true;
    }
}

async function buildMessage(row) {
    if (row.template === 'email_verification') {
        return renderTemplate(row.template, { ...row.payload, token: verificationToken(row.payload.verificationId) });
    }
    if (row.template === 'staff_calendar_failed') return renderTemplate(row.template, row.payload);
    const { rows } = await query(CONSULTATION_FOR_MESSAGE, [row.consultation_id]);
    const c = rows[0];
    if (!c) return null;
    if (!stillRelevant(row.template, c)) return null;
    return renderTemplate(row.template, {
        consultationId: c.id,
        reference: c.reference,
        typeName: c.type_name,
        firstName: c.student_name.split(' ')[0],
        studentName: c.student_name,
        phone: c.student_phone,
        start: c.scheduled_start,
        end: c.scheduled_end,
        timeZone: c.timezone,
        counsellorTimeZone: c.counsellor_timezone,
        meetingMethod: c.meeting_method,
        // Only a link that was actually generated or entered is ever shown.
        meetingUrl: c.meeting_url || null,
        counsellorName: c.counsellor_name,
        cutoffHours: config.changeCutoffHours(),
        manageToken: c.manage_token_seed && ['booking_confirmed', 'booking_rescheduled', 'reminder_24h', 'reminder_1h'].includes(row.template) ? manageTokenFromSeed(c.manage_token_seed) : null,
    });
}

const backoffMinutes = (attempts) => Math.min(60, 2 ** attempts);

/* Claims due notifications with SKIP LOCKED (safe with several workers) and sends them. */
export async function processNotifications({ limit = 20, consultationId = null } = {}) {
    const { rows } = await query(
        `UPDATE notifications SET status = 'sending', attempts = attempts + 1, locked_until = $1::timestamptz + INTERVAL '2 minutes', updated_at = NOW()
         WHERE id IN (
           SELECT id FROM notifications
           WHERE ((status IN ('pending', 'failed') AND scheduled_for <= $1 AND attempts < max_attempts)
              OR (status = 'sending' AND locked_until < $1 AND attempts < max_attempts))
             AND ($2::uuid IS NULL OR consultation_id = $2)
           ORDER BY scheduled_for LIMIT $3 FOR UPDATE SKIP LOCKED)
         RETURNING *`,
        [now(), consultationId, limit],
    );
    const provider = getEmailProvider();
    const results = { sent: 0, failed: 0, skipped: 0, cancelled: 0 };
    for (const row of rows) {
        try {
            const message = await buildMessage(row);
            if (!message) {
                await query("UPDATE notifications SET status = 'cancelled', locked_until = NULL, updated_at = NOW() WHERE id = $1", [row.id]);
                results.cancelled += 1;
                continue;
            }
            if (!provider.configured) {
                await query("UPDATE notifications SET status = 'skipped', provider = $2, last_error = 'Email provider not configured', locked_until = NULL, updated_at = NOW() WHERE id = $1", [row.id, provider.name]);
                results.skipped += 1;
                continue;
            }
            const sent = await provider.send({ to: row.recipient, subject: message.subject, text: message.text, html: message.html, idempotencyKey: row.dedupe_key });
            await query(
                "UPDATE notifications SET status = 'sent', provider = $2, provider_message_id = $3, sent_at = $4, last_error = NULL, locked_until = NULL, updated_at = NOW() WHERE id = $1",
                [row.id, provider.name, sent.messageId, now()],
            );
            results.sent += 1;
        } catch (error) {
            const permanent = Boolean(error.permanent) || row.attempts >= row.max_attempts;
            await query(
                `UPDATE notifications SET status = 'failed', provider = $2, last_error = $3, locked_until = NULL,
                   attempts = CASE WHEN $4 THEN max_attempts ELSE attempts END,
                   scheduled_for = $5, updated_at = NOW() WHERE id = $1`,
                [row.id, provider.name, String(error.message).slice(0, 1000), permanent, new Date(now().getTime() + backoffMinutes(row.attempts) * 60_000)],
            );
            results.failed += 1;
        }
    }
    return results;
}

/* Staff retry: put a failed or skipped notification back in the queue. */
export async function retryNotification(id) {
    const { rows } = await query(
        `UPDATE notifications SET status = 'pending', attempts = 0, scheduled_for = $2, last_error = NULL, updated_at = NOW()
         WHERE id = $1 AND status IN ('failed', 'skipped') RETURNING id, status`,
        [id, now()],
    );
    return rows[0] || null;
}
