/* In-app notification centre. Rows are written inside the same transaction as
   the change they describe, so a notification never claims something that was
   rolled back. Text is plain and written by the server; never put reviewer
   notes or other staff-only text in a student's notification. */
import { now } from '../lib/clock.js';
import { query } from '../lib/db.js';

export async function notifyUser(client, userId, { kind, title, body = '', link = null }) {
    if (!userId) return;
    await client.query(
        'INSERT INTO user_notifications (id, user_id, kind, title, body, link) VALUES ($1, $2, $3, $4, $5, $6)',
        [crypto.randomUUID(), userId, kind, title.slice(0, 200), body.slice(0, 1000), link],
    );
}

const view = (n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, link: n.link, read: Boolean(n.read_at), createdAt: new Date(n.created_at).toISOString() });

export async function listForUser(userId, { unreadOnly = false, limit = 50 } = {}) {
    const [items, unread] = await Promise.all([
        query(
            `SELECT * FROM user_notifications WHERE user_id = $1 ${unreadOnly ? 'AND read_at IS NULL' : ''}
             ORDER BY created_at DESC LIMIT $2`,
            [userId, limit],
        ),
        unreadCount(userId),
    ]);
    return { items: items.rows.map(view), unread };
}

export async function unreadCount(userId) {
    const { rows } = await query('SELECT COUNT(*)::int AS n FROM user_notifications WHERE user_id = $1 AND read_at IS NULL', [userId]);
    return rows[0].n;
}

/* Marks the given notifications (or all of them) read. Only the owner's rows are touched. */
export async function markRead(userId, ids = null) {
    const { rowCount } = await query(
        `UPDATE user_notifications SET read_at = $2 WHERE user_id = $1 AND read_at IS NULL
         ${ids ? 'AND id = ANY($3::uuid[])' : ''}`,
        ids ? [userId, now(), ids] : [userId, now()],
    );
    return { marked: rowCount, unread: await unreadCount(userId) };
}
