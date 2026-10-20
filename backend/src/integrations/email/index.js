/* Email provider boundary. A provider implements:
     name: string
     configured: boolean          — false means "do not send; record as skipped"
     send({ to, subject, text, html, idempotencyKey, retry }) → { messageId, threadId? }
   Errors thrown from send() are treated as retryable unless error.permanent is set.

   EMAIL_PROVIDER:
     gmail  — Gmail API as GMAIL_SENDER (Workspace domain-wide delegation)
     resend — Resend HTTP API
     log    — development only: prints messages to the server log (refused in production)
   The Gmail sender and mailbox are also used directly for staff messages and
   the CRM inbox (getGmailSender / getMailbox), whatever EMAIL_PROVIDER is. */
import { config } from '../../config.js';
import { googleAuthFromEnv } from '../google/auth.js';
import { createGmailMailbox, createGmailSender } from './gmail.js';
import { createResendProvider } from './resend.js';

const disabledProvider = {
    name: 'disabled',
    configured: false,
    async send() {
        throw Object.assign(new Error('Email provider not configured'), { permanent: true });
    },
};

/* Writes the message to stdout so local flows (verification, invitations) can be followed. */
const logProvider = {
    name: 'log',
    configured: true,
    async send({ to, subject, text, idempotencyKey }) {
        console.log(`\n── email (EMAIL_PROVIDER=log) ──\nTo: ${to}\nSubject: ${subject}\n\n${text}\n────────────────\n`);
        return { messageId: `log_${idempotencyKey}` };
    },
};

let override = null;
let mailboxOverride;
let senderOverride;
let gmailSender = null;
let gmailMailbox = null;

export function getGmailSender() {
    if (senderOverride !== undefined) return senderOverride;
    const accessToken = googleAuthFromEnv();
    const sender = process.env.GMAIL_SENDER;
    if (!accessToken || !sender) return null;
    gmailSender ||= createGmailSender({ accessToken, sender, fromHeader: process.env.EMAIL_FROM || sender, replyTo: process.env.EMAIL_REPLY_TO });
    return gmailSender;
}

export function getMailbox() {
    if (mailboxOverride !== undefined) return mailboxOverride;
    const accessToken = googleAuthFromEnv();
    const mailbox = process.env.GMAIL_MAILBOX || process.env.GMAIL_SENDER;
    if (!accessToken || !mailbox) return null;
    gmailMailbox ||= createGmailMailbox({ accessToken, mailbox });
    return gmailMailbox;
}

export function getEmailProvider() {
    if (override) return override;
    const choice = (process.env.EMAIL_PROVIDER || '').toLowerCase();
    if (choice === 'gmail') return getGmailSender() || disabledProvider;
    if (choice === 'resend' && process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
        return createResendProvider({ apiKey: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM, replyTo: process.env.EMAIL_REPLY_TO });
    }
    if (choice === 'log') {
        if (!config.isProduction()) return logProvider;
        console.warn('EMAIL_PROVIDER=log is ignored in production; emails are recorded as skipped.');
    }
    return disabledProvider;
}

/* Tests inject fakes; pass null (provider) or undefined (sender/mailbox) to restore the environment-based choice. */
export function setEmailProvider(provider) {
    override = provider;
}
export function setGmailSender(sender) {
    senderOverride = sender;
}
export function setMailbox(mailbox) {
    mailboxOverride = mailbox;
}
