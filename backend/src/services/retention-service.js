/* Data retention: removes personal details from old records that no account
   owns, so we keep only what we need (DPDP / GDPR storage limitation).

   - Guest consultations that ended more than RETENTION_CONSULTATION_MONTHS ago
     and are no longer active: name, email, phone, free text, manage link and
     message recipients are replaced; staff notes are cleared.
   - Leads without an account, older than RETENTION_LEAD_MONTHS, not touched
     for that long, with no active booking and no live newsletter opt-in.
   - Expired verification and reset tokens are deleted.

   Records linked to an account are kept while the account exists (the person
   can see them and ask for deletion through data-request.html).
   Rows are anonymised, not deleted, so counts and reports stay correct.
   Off unless RETENTION_ENABLED=true; the periods need the owner's (and legal)
   confirmation before switching it on. */
import { now } from '../lib/clock.js';
import { query, withTransaction } from '../lib/db.js';
import { audit } from './audit.js';

const int = (name, fallback) => {
    const value = Number.parseInt(process.env[name] ?? '', 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const retentionSettings = () => ({
    enabled: process.env.RETENTION_ENABLED === 'true',
    consultationMonths: int('RETENTION_CONSULTATION_MONTHS', 24),
    leadMonths: int('RETENTION_LEAD_MONTHS', 24),
    batchSize: int('RETENTION_BATCH_SIZE', 200),
});

const monthsAgo = (months) => {
    const date = now();
    date.setUTCMonth(date.getUTCMonth() - months);
    return date;
};

const CONSULTATION_WHERE = `anonymised_at IS NULL AND student_user_id IS NULL
  AND status IN ('completed', 'cancelled', 'no_show', 'rescheduled') AND scheduled_end < $1`;
const LEAD_WHERE = `l.anonymised_at IS NULL AND l.user_id IS NULL AND l.created_at < $1 AND l.updated_at < $1
  AND NOT (l.source = 'newsletter' AND l.newsletter_opt_in)
  AND NOT EXISTS (SELECT 1 FROM consultations c WHERE c.lead_id = l.id AND (c.status IN ('reserved', 'confirmed') OR c.anonymised_at IS NULL AND c.scheduled_end >= $1))`;

/* What a run would change right now (admin preview). */
export async function previewRetention() {
    const settings = retentionSettings();
    const [consultations, leads] = await Promise.all([
        query(`SELECT COUNT(*)::int AS n FROM consultations WHERE ${CONSULTATION_WHERE}`, [monthsAgo(settings.consultationMonths)]),
        query(`SELECT COUNT(*)::int AS n FROM leads l WHERE ${LEAD_WHERE}`, [monthsAgo(settings.leadMonths)]),
    ]);
    return { ...settings, consultationsDue: consultations.rows[0].n, leadsDue: leads.rows[0].n };
}

/* One batch. Safe to run repeatedly and concurrently (rows are locked and skipped). */
export async function runRetention({ force = false } = {}) {
    const settings = retentionSettings();
    if (!settings.enabled && !force) return { enabled: false, consultations: 0, leads: 0, tokens: 0 };
    return withTransaction(async (client) => {
        const at = now();
        const consultations = await client.query(
            `WITH due AS (SELECT id FROM consultations WHERE ${CONSULTATION_WHERE} ORDER BY scheduled_end LIMIT $2 FOR UPDATE SKIP LOCKED)
             UPDATE consultations c SET student_name = 'Anonymised', student_email = 'anonymised+' || c.id || '@invalid',
               student_phone = '+0', preferred_course = NULL, academic_summary = NULL, message = NULL, cancellation_reason = NULL,
               manage_token_seed = NULL, manage_token_hash = NULL, anonymised_at = $3, updated_at = $3
             FROM due WHERE c.id = due.id RETURNING c.id`,
            [monthsAgo(settings.consultationMonths), settings.batchSize, at],
        );
        const ids = consultations.rows.map((row) => row.id);
        if (ids.length) {
            await client.query("UPDATE consultation_notes SET body = '[removed under the data retention policy]' WHERE consultation_id = ANY($1)", [ids]);
            await client.query("UPDATE notifications SET recipient = 'anonymised@invalid', payload = '{}'::jsonb WHERE consultation_id = ANY($1)", [ids]);
        }
        const leads = await client.query(
            `WITH due AS (SELECT l.id FROM leads l WHERE ${LEAD_WHERE} ORDER BY l.created_at LIMIT $2 FOR UPDATE OF l SKIP LOCKED)
             UPDATE leads SET first_name = 'Anonymised', last_name = NULL, email = 'anonymised+' || leads.id || '@invalid', phone = NULL,
               message = NULL, passport_status = NULL, referral_source = NULL, preferred_course = NULL, anonymised_at = $3, updated_at = $3
             FROM due WHERE leads.id = due.id RETURNING leads.id`,
            [monthsAgo(settings.leadMonths), settings.batchSize, at],
        );
        if (leads.rows.length) {
            await client.query("UPDATE lead_activities SET body = NULL, details = '{}'::jsonb WHERE lead_id = ANY($1)", [leads.rows.map((row) => row.id)]);
        }
        const tokens = await client.query(
            `WITH a AS (DELETE FROM email_verification_tokens WHERE expires_at < $1 RETURNING 1),
                  b AS (DELETE FROM password_reset_tokens WHERE expires_at < $1 RETURNING 1)
             SELECT (SELECT COUNT(*) FROM a) + (SELECT COUNT(*) FROM b) AS n`,
            [new Date(at.getTime() - 30 * 24 * 3600_000)],
        );
        const result = { enabled: true, consultations: ids.length, leads: leads.rows.length, tokens: Number(tokens.rows[0].n) };
        if (result.consultations || result.leads) {
            await audit(client, { action: 'retention.anonymised', entityType: 'system', details: result });
        }
        return result;
    });
}
