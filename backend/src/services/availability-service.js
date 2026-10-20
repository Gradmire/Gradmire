/* Computes bookable slots from data, never from the client:
   weekly rules (wall-clock times in the rule's timezone) − date exceptions −
   existing active bookings (including the counsellor's buffer) − external
   calendar busy times, limited by the type's minimum notice and booking horizon. */
import { config } from '../config.js';
import { now } from '../lib/clock.js';
import { addDays, addMinutes, formatDateOnly, isoWeekday, overlaps, parseTimeOfDay, zonedParts, zonedTimeToUtc } from '../lib/time.js';
import { getCalendarProvider } from '../integrations/calendar/index.js';

export const ACTIVE_STATUSES = ['reserved', 'confirmed'];

/* Free/busy lookups are best-effort: if the calendar is down we still offer
   slots from the database (the booking itself is protected by the exclusion
   constraint), and log the failure. */
async function externalBusy(counsellors, from, to) {
    const provider = getCalendarProvider();
    const busy = new Map();
    if (!provider.configured || !provider.getBusy) return busy;
    await Promise.all(counsellors.filter((c) => c.calendar_id).map(async (c) => {
        try {
            busy.set(c.user_id, await provider.getBusy(c.calendar_id, from, to));
        } catch (error) {
            console.warn('Calendar free/busy unavailable for a counsellor:', error.message);
        }
    }));
    return busy;
}

/* Every candidate slot in [from, to) for the given type, as
   [{ start, end, counsellorIds: [...] }] sorted by start. `exactStart` limits
   the result to one start time (used to re-check a booking request). */
export async function findSlots(client, { type, from, to, counsellorId = null, exactStart = null, excludeConsultationId = null, ignoreNotice = false }) {
    const current = now();
    const earliest = ignoreNotice ? current : addMinutes(current, type.min_notice_minutes);
    const latest = addMinutes(current, type.max_advance_days * 24 * 60);
    const windowStart = new Date(Math.max(from.getTime(), earliest.getTime()));
    const windowEnd = new Date(Math.min(to.getTime(), latest.getTime()));
    if (windowStart >= windowEnd) return [];

    const counsellors = (await client.query(
        `SELECT user_id, display_name, timezone, buffer_minutes, calendar_id FROM counsellors c
         JOIN users u ON u.id = c.user_id
         WHERE c.is_active AND u.status = 'active' AND ($1::uuid IS NULL OR c.user_id = $1)
         ORDER BY c.user_id`,
        [counsellorId],
    )).rows;
    if (!counsellors.length) return [];
    const ids = counsellors.map((c) => c.user_id);

    // Look a day either side so rules in other timezones and long buffers are covered.
    const padStart = addMinutes(windowStart, -24 * 60);
    const padEnd = addMinutes(windowEnd, 24 * 60);
    // One pg client runs one query at a time (it may be a transaction), so these are sequential;
    // the external calendar lookup runs alongside them.
    const busyPromise = externalBusy(counsellors, padStart, padEnd);
    const rules = await client.query('SELECT * FROM availability_rules WHERE counsellor_id = ANY($1)', [ids]);
    const exceptions = await client.query('SELECT counsellor_id, starts_at, ends_at FROM availability_exceptions WHERE counsellor_id = ANY($1) AND starts_at < $3 AND ends_at > $2', [ids, padStart, padEnd]);
    const bookings = await client.query(
        `SELECT counsellor_id, scheduled_start, blocked_until FROM consultations
         WHERE counsellor_id = ANY($1) AND status = ANY($4) AND scheduled_start < $3 AND blocked_until > $2
           AND ($5::uuid IS NULL OR id <> $5)`,
        [ids, padStart, padEnd, ACTIVE_STATUSES, excludeConsultationId],
    );
    const busy = await busyPromise;

    const step = config.slotStepMinutes();
    const slots = new Map();
    for (const counsellor of counsellors) {
        const myRules = rules.rows.filter((r) => r.counsellor_id === counsellor.user_id);
        const myExceptions = exceptions.rows.filter((e) => e.counsellor_id === counsellor.user_id);
        const myBookings = bookings.rows.filter((b) => b.counsellor_id === counsellor.user_id);
        const myBusy = busy.get(counsellor.user_id) || [];

        for (const rule of myRules) {
            const ruleStart = parseTimeOfDay(String(rule.start_time).slice(0, 5));
            const ruleEnd = parseTimeOfDay(String(rule.end_time).slice(0, 5));
            // Walk the local dates (in the rule's zone) that touch the padded window.
            const firstLocal = zonedParts(padStart, rule.timezone);
            let date = { year: firstLocal.year, month: firstLocal.month, day: firstLocal.day };
            for (let i = 0; i < 4 + Math.ceil((padEnd - padStart) / 86_400_000); i += 1, date = addDays(date, 1)) {
                if (isoWeekday(date) !== rule.weekday) continue;
                const dateText = formatDateOnly(date);
                if (rule.effective_from && dateText < toDateText(rule.effective_from)) continue;
                if (rule.effective_until && dateText > toDateText(rule.effective_until)) continue;
                const open = zonedTimeToUtc({ ...date, ...ruleStart }, rule.timezone);
                const close = zonedTimeToUtc({ ...date, ...ruleEnd }, rule.timezone);
                if (!open || !close || close <= open) continue;

                for (let start = open; addMinutes(start, type.duration_minutes) <= close; start = addMinutes(start, step)) {
                    if (start < windowStart || start >= windowEnd) continue;
                    if (exactStart && start.getTime() !== exactStart.getTime()) continue;
                    const end = addMinutes(start, type.duration_minutes);
                    const blockedUntil = addMinutes(end, counsellor.buffer_minutes);
                    if (myExceptions.some((e) => overlaps(start, end, new Date(e.starts_at), new Date(e.ends_at)))) continue;
                    if (myBookings.some((b) => overlaps(start, blockedUntil, new Date(b.scheduled_start), new Date(b.blocked_until)))) continue;
                    if (myBusy.some((b) => overlaps(start, end, b.start, b.end))) continue;
                    const key = start.toISOString();
                    if (!slots.has(key)) slots.set(key, { start, end, counsellorIds: [] });
                    const slot = slots.get(key);
                    if (!slot.counsellorIds.includes(counsellor.user_id)) slot.counsellorIds.push(counsellor.user_id);
                }
            }
        }
    }
    return [...slots.values()].sort((a, b) => a.start - b.start);
}

const toDateText = (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10));
