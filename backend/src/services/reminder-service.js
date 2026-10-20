/* Follow-up reminders, run by the background job. A reminder goes out once a
   task (or an enquiry's next follow-up) is due within FOLLOW_UP_REMINDER_MINUTES.
   `reminded_for` records which due time was reminded: an unchanged due time is
   never reminded twice, and a moved one is reminded again. Rows are claimed with
   SKIP LOCKED so overlapping job runs cannot double-send. */
import { now } from '../lib/clock.js';
import { withTransaction } from '../lib/db.js';
import { notifyUser } from './inbox.js';
import { enqueueNotification } from './notification-service.js';

const leadMinutes = () => Math.max(0, Number.parseInt(process.env.FOLLOW_UP_REMINDER_MINUTES || '60', 10) || 60);
const fullName = (first, last) => [first, last].filter(Boolean).join(' ');

export async function queueFollowUpReminders({ limit = 100 } = {}) {
    const horizon = new Date(now().getTime() + leadMinutes() * 60_000);
    return withTransaction(async (client) => {
        const tasks = await client.query(
            `SELECT t.id, t.title, t.details, t.due_at, u.id AS user_id, u.email, co.timezone
             FROM follow_up_tasks t JOIN users u ON u.id = t.assignee_user_id LEFT JOIN counsellors co ON co.user_id = u.id
             WHERE t.status = 'open' AND t.due_at IS NOT NULL AND t.due_at <= $1 AND t.reminded_for IS DISTINCT FROM t.due_at AND u.status = 'active'
             ORDER BY t.due_at LIMIT $2 FOR UPDATE OF t SKIP LOCKED`,
            [horizon, limit],
        );
        for (const t of tasks.rows) {
            await enqueueNotification(client, {
                userId: t.user_id, template: 'follow_up_reminder', recipient: t.email, dedupeKey: `follow_up:${t.id}:${new Date(t.due_at).getTime()}`,
                payload: { title: t.title, details: t.details || '', dueAt: new Date(t.due_at).toISOString(), timeZone: t.timezone || 'Asia/Kolkata', page: 'consultant-follow-ups.html' },
            });
            await notifyUser(client, t.user_id, { kind: 'follow_up_due', title: `Follow-up due: ${t.title}`, link: 'consultant-follow-ups.html' });
            await client.query('UPDATE follow_up_tasks SET reminded_for = due_at WHERE id = $1', [t.id]);
        }
        const leads = await client.query(
            `SELECT l.id, l.first_name, l.last_name, l.email AS lead_email, l.next_follow_up_at, u.id AS user_id, u.email, co.timezone
             FROM leads l JOIN counsellors co ON co.user_id = l.assigned_counsellor_id JOIN users u ON u.id = co.user_id
             WHERE l.next_follow_up_at IS NOT NULL AND l.next_follow_up_at <= $1 AND l.follow_up_reminded_for IS DISTINCT FROM l.next_follow_up_at
               AND l.status IN ('new', 'contacted', 'qualified', 'consultation_booked') AND u.status = 'active'
             ORDER BY l.next_follow_up_at LIMIT $2 FOR UPDATE OF l SKIP LOCKED`,
            [horizon, limit],
        );
        for (const l of leads.rows) {
            const title = `Follow up with ${fullName(l.first_name, l.last_name) || l.lead_email}`;
            await enqueueNotification(client, {
                userId: l.user_id, template: 'follow_up_reminder', recipient: l.email, dedupeKey: `lead_follow_up:${l.id}:${new Date(l.next_follow_up_at).getTime()}`,
                payload: { title, details: '', dueAt: new Date(l.next_follow_up_at).toISOString(), timeZone: l.timezone || 'Asia/Kolkata', page: `consultant-leads.html#lead=${l.id}` },
            });
            await notifyUser(client, l.user_id, { kind: 'follow_up_due', title, link: 'consultant-leads.html' });
            await client.query('UPDATE leads SET follow_up_reminded_for = next_follow_up_at WHERE id = $1', [l.id]);
        }
        return { tasks: tasks.rows.length, leads: leads.rows.length };
    });
}
