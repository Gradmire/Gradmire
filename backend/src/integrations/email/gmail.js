/* Gmail API (https://developers.google.com/workspace/gmail/api) over plain
   HTTPS with the shared service account and domain-wide delegation.

   Sending runs as GMAIL_SENDER (scope gmail.send): messages are RFC 2822 MIME,
   base64url-encoded into `raw`. Gmail has no idempotency key, so every message
   carries a Message-ID derived from our idempotency key; before a *retry* the
   sender's mailbox is searched for that id (rfc822msgid:) and an earlier copy
   is reused instead of sending twice. That search needs gmail.readonly.

   Reading runs as GMAIL_MAILBOX (scope gmail.readonly) for the staff inbox.
   Nothing from Google is returned to clients without passing the access
   checks in services/staff-email-service.js. */
import { createHash } from 'node:crypto';
import { googleError, googleJson } from '../google/auth.js';

const API = 'https://gmail.googleapis.com/gmail/v1/users';
const SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

/* Header values never contain line breaks, so a subject or name cannot add headers. */
const headerSafe = (value) => String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
const encodeWord = (value) => (/^[\x20-\x7E]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`);
const wrap76 = (b64) => b64.replace(/.{1,76}/g, '$&\r\n').trimEnd();

/* A stable Message-ID for an idempotency key. */
export const messageIdFor = (key, domain) => `<${createHash('sha256').update(String(key)).digest('hex').slice(0, 32)}@${domain}>`;

export function buildMime({ from, to, replyTo, subject, text, html, messageId, inReplyTo, references }) {
    const boundary = `gm_${createHash('sha256').update(`${messageId}${subject}`).digest('hex').slice(0, 24)}`;
    const headers = [
        `From: ${headerSafe(from)}`,
        `To: ${headerSafe(to)}`,
        ...(replyTo ? [`Reply-To: ${headerSafe(replyTo)}`] : []),
        `Subject: ${encodeWord(headerSafe(subject))}`,
        `Message-ID: ${headerSafe(messageId)}`,
        ...(inReplyTo ? [`In-Reply-To: ${headerSafe(inReplyTo)}`] : []),
        ...(references ? [`References: ${headerSafe(references)}`] : []),
        'MIME-Version: 1.0',
    ];
    const part = (type, body) => [`--${boundary}`, `Content-Type: ${type}; charset="UTF-8"`, 'Content-Transfer-Encoding: base64', '', wrap76(Buffer.from(body, 'utf8').toString('base64'))].join('\r\n');
    const body = html
        ? [`Content-Type: multipart/alternative; boundary="${boundary}"`, '', part('text/plain', text || ''), part('text/html', html), `--${boundary}--`].join('\r\n')
        : ['Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', wrap76(Buffer.from(text || '', 'utf8').toString('base64'))].join('\r\n');
    return `${headers.join('\r\n')}\r\n${body}`;
}

export function createGmailSender({ accessToken, sender, fromHeader, replyTo }) {
    const domain = sender.split('@')[1] || 'gradmire.local';
    const base = `${API}/${encodeURIComponent(sender)}`;

    async function findSent(messageId) {
        const token = await accessToken(READ_SCOPE, sender);
        const result = await googleJson(token, 'GET', `${base}/messages?maxResults=1&q=${encodeURIComponent(`rfc822msgid:${messageId}`)}`);
        if (!result.ok) return null; // cannot check: fall through to sending
        const found = result.data.messages?.[0];
        return found ? { messageId: found.id, threadId: found.threadId } : null;
    }

    return {
        name: 'gmail',
        configured: true,
        sender,
        /* Same contract as the other email providers, plus optional threading.
           Returns { messageId, threadId }. */
        async send({ to, subject, text, html, idempotencyKey, retry = false, threadId = null, inReplyTo = null, references = null }) {
            const messageId = messageIdFor(idempotencyKey, domain);
            if (retry) {
                const earlier = await findSent(messageId);
                if (earlier) return earlier;
            }
            const raw = Buffer.from(buildMime({ from: fromHeader || sender, to, replyTo, subject, text, html, messageId, inReplyTo, references }), 'utf8').toString('base64url');
            const token = await accessToken(SEND_SCOPE, sender);
            const result = await googleJson(token, 'POST', `${base}/messages/send`, { raw, ...(threadId ? { threadId } : {}) });
            if (!result.ok) throw googleError('Gmail send', result);
            return { messageId: result.data.id, threadId: result.data.threadId };
        },
    };
}

const header = (message, name) => message.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

/* Plain-text body of a message: the first text/plain part, else text/html with tags removed. */
function bodyText(payload) {
    const parts = [];
    const walk = (p) => {
        if (!p) return;
        if (p.parts) p.parts.forEach(walk);
        else if (p.body?.data) parts.push({ type: p.mimeType, data: Buffer.from(p.body.data, 'base64url').toString('utf8') });
    };
    walk(payload);
    const plain = parts.find((p) => p.type === 'text/plain');
    if (plain) return plain.data;
    const html = parts.find((p) => p.type === 'text/html');
    return html ? html.data.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() : '';
}

export function createGmailMailbox({ accessToken, mailbox }) {
    const base = `${API}/${encodeURIComponent(mailbox)}`;
    const token = () => accessToken(READ_SCOPE, mailbox);

    return {
        name: 'gmail',
        configured: true,
        mailbox,
        /* Threads matching a Gmail search, newest first, with subject/participants/date of the latest message. */
        async listThreads(q, { max = 20 } = {}) {
            const t = await token();
            const list = await googleJson(t, 'GET', `${base}/threads?maxResults=${max}&q=${encodeURIComponent(q)}`);
            if (!list.ok) throw googleError('Gmail thread search', list);
            const threads = list.data.threads || [];
            const meta = 'format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Date';
            return Promise.all(threads.map(async (th) => {
                const got = await googleJson(t, 'GET', `${base}/threads/${encodeURIComponent(th.id)}?${meta}`);
                if (!got.ok) throw googleError('Gmail thread read', got);
                const messages = got.data.messages || [];
                const last = messages[messages.length - 1] || {};
                return {
                    id: th.id,
                    subject: header(messages[0] || {}, 'Subject'),
                    snippet: th.snippet || last.snippet || '',
                    messageCount: messages.length,
                    lastFrom: header(last, 'From'),
                    lastDate: last.internalDate ? new Date(Number(last.internalDate)).toISOString() : null,
                    participants: [...new Set(messages.flatMap((m) => ['From', 'To', 'Cc'].map((h) => header(m, h))).join(',').split(',').map((v) => v.trim()).filter(Boolean))],
                };
            }));
        },
        /* One thread with every message's headers and plain-text body. */
        async getThread(id) {
            const got = await googleJson(await token(), 'GET', `${base}/threads/${encodeURIComponent(id)}?format=full`);
            if (got.status === 404) return null;
            if (!got.ok) throw googleError('Gmail thread read', got);
            return {
                id: got.data.id,
                messages: (got.data.messages || []).map((m) => ({
                    id: m.id,
                    from: header(m, 'From'),
                    to: header(m, 'To'),
                    cc: header(m, 'Cc'),
                    subject: header(m, 'Subject'),
                    messageId: header(m, 'Message-ID') || header(m, 'Message-Id'),
                    references: header(m, 'References'),
                    date: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : null,
                    text: bodyText(m.payload).slice(0, 20_000),
                })),
            };
        },
    };
}
