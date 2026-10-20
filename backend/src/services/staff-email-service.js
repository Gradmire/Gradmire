/* Email with students and enquiries from the staff dashboard, through Gmail.

   Reading: the shared Workspace mailbox (GMAIL_MAILBOX) is searched for threads
   with the person's address. A thread is only shown if one of its messages is
   from, to or copied to that address, so a thread id cannot be used to read
   unrelated mail. Staff only reach people they may already see (access.js).

   Sending: as GMAIL_SENDER, logged in staff_emails (and on the enquiry's
   history) whether it succeeded or failed. Replies keep the Gmail thread. */
import { getGmailSender, getMailbox } from '../integrations/email/index.js';
import { query, withTransaction } from '../lib/db.js';
import { HttpError, notFound } from '../lib/http.js';
import { assertLeadAccess, assertStudentAccess } from './access.js';
import { audit } from './audit.js';

const iso = (value) => (value ? new Date(value).toISOString() : null);

/* target: { type: 'student' | 'lead', id } → { email, name, studentUserId, leadId } after the access check. */
async function resolve(staff, target) {
    if (target.type === 'student') {
        await assertStudentAccess({ query }, staff, target.id);
        const u = (await query('SELECT id, email, first_name, last_name FROM users WHERE id = $1', [target.id])).rows[0];
        return { email: u.email.toLowerCase(), name: [u.first_name, u.last_name].filter(Boolean).join(' '), studentUserId: u.id, leadId: null };
    }
    const l = await assertLeadAccess({ query }, staff, target.id);
    return { email: l.email.toLowerCase(), name: [l.first_name, l.last_name].filter(Boolean).join(' ') || l.email, studentUserId: l.user_id, leadId: l.id };
}

const mailbox = () => {
    const m = getMailbox();
    if (!m) throw new HttpError(503, 'The Gmail inbox is not connected. An administrator needs to set GMAIL_MAILBOX and the Google service account.', 'MAILBOX_UNAVAILABLE');
    return m;
};

/* Gmail search for one address; quotes are removed so the value stays a single term. */
const searchFor = (email) => {
    const safe = `"${email.replace(/["\\]/g, '')}"`;
    return `from:${safe} OR to:${safe} OR cc:${safe}`;
};

const involves = (headerValue, email) => String(headerValue || '').toLowerCase().includes(email);

async function sentLog(person) {
    const { rows } = await query(
        `SELECT e.*, u.first_name, u.last_name FROM staff_emails e LEFT JOIN users u ON u.id = e.sender_user_id
         WHERE ($1::uuid IS NOT NULL AND e.student_user_id = $1) OR ($2::uuid IS NOT NULL AND e.lead_id = $2) OR LOWER(e.recipient) = $3
         ORDER BY e.created_at DESC LIMIT 50`,
        [person.studentUserId, person.leadId, person.email],
    );
    return rows.map((e) => ({ id: e.id, subject: e.subject, status: e.status, error: e.error, threadId: e.gmail_thread_id, sentBy: [e.first_name, e.last_name].filter(Boolean).join(' '), at: iso(e.created_at) }));
}

export async function listThreads(staff, target) {
    const person = await resolve(staff, target);
    const m = getMailbox();
    const [threads, sent] = await Promise.all([
        m ? m.listThreads(searchFor(person.email), { max: 20 }) : Promise.resolve(null),
        sentLog(person),
    ]);
    return {
        email: person.email,
        connected: Boolean(m),
        canSend: Boolean(getGmailSender()),
        // Gmail's own search can match loosely; keep only threads that really involve the address.
        threads: threads ? threads.filter((t) => t.participants.some((p) => involves(p, person.email))) : [],
        sent,
    };
}

export async function getThread(staff, target, threadId) {
    const person = await resolve(staff, target);
    const thread = await mailbox().getThread(threadId);
    if (!thread || !thread.messages.some((msg) => [msg.from, msg.to, msg.cc].some((h) => involves(h, person.email)))) {
        throw notFound('Email thread not found');
    }
    await withTransaction((client) => audit(client, { actorUserId: staff.id, action: 'email.thread_viewed', entityType: target.type === 'student' ? 'user' : 'lead', entityId: target.id, details: { threadId } }));
    return { id: thread.id, messages: thread.messages.map(({ references, messageId, ...msg }) => msg) };
}

export async function send(staff, target, { subject, body, threadId = null }) {
    const person = await resolve(staff, target);
    const sender = getGmailSender();
    if (!sender) throw new HttpError(503, 'Sending email from the dashboard needs Gmail. An administrator needs to set GMAIL_SENDER and the Google service account.', 'GMAIL_UNAVAILABLE');

    let reply = {};
    if (threadId) {
        const thread = await mailbox().getThread(threadId);
        const last = thread?.messages.filter((msg) => [msg.from, msg.to, msg.cc].some((h) => involves(h, person.email))).pop();
        if (!last) throw notFound('Email thread not found');
        reply = {
            inReplyTo: last.messageId || null,
            references: [last.references, last.messageId].filter(Boolean).join(' ') || null,
            // A Gmail thread id belongs to one mailbox; only reuse it when we send from that mailbox.
            threadId: sender.sender === getMailbox()?.mailbox ? threadId : null,
        };
        subject ||= /^re:/i.test(last.subject) ? last.subject : `Re: ${last.subject}`;
    }
    const staffName = [staff.first_name, staff.last_name].filter(Boolean).join(' ');
    const text = `${body}\n\n— ${staffName}, Gradmire`;
    const id = crypto.randomUUID();
    let result = null;
    let error = null;
    try {
        result = await sender.send({ to: person.email, subject, text, idempotencyKey: `staff_email:${id}`, ...reply });
    } catch (e) {
        error = e;
    }
    await withTransaction(async (client) => {
        await client.query(
            `INSERT INTO staff_emails (id, sender_user_id, student_user_id, lead_id, recipient, subject, body, gmail_message_id, gmail_thread_id, status, error)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [id, staff.id, person.studentUserId, person.leadId, person.email, subject.slice(0, 250), text.slice(0, 10_000), result?.messageId || null, result?.threadId || null, error ? 'failed' : 'sent', error ? String(error.message).slice(0, 500) : null],
        );
        if (person.leadId && !error) {
            await client.query("INSERT INTO lead_activities (lead_id, actor_user_id, kind, channel, body, details) VALUES ($1, $2, 'email_sent', 'email', $3, $4)", [person.leadId, staff.id, subject, JSON.stringify({ staffEmailId: id })]);
            await client.query("UPDATE leads SET last_contacted_at = NOW(), status = CASE WHEN status = 'new' THEN 'contacted' ELSE status END, updated_at = NOW() WHERE id = $1", [person.leadId]);
        }
        await audit(client, { actorUserId: staff.id, action: error ? 'email.send_failed' : 'email.sent', entityType: target.type === 'student' ? 'user' : 'lead', entityId: target.id, details: { staffEmailId: id, reply: Boolean(threadId) } });
    });
    if (error) throw new HttpError(502, 'Gmail did not accept the message. It was not sent; please try again.', 'EMAIL_SEND_FAILED');
    return { id, status: 'sent', threadId: result.threadId || null };
}
