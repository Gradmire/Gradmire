/* Email provider boundary. A provider implements:
     name: string
     configured: boolean          — false means "do not send; record as skipped"
     send({ to, subject, text, html, idempotencyKey }) → { messageId }
   Errors thrown from send() are treated as retryable unless error.permanent is set. */
import { createResendProvider } from './resend.js';

const disabledProvider = {
    name: 'disabled',
    configured: false,
    async send() {
        throw Object.assign(new Error('Email provider not configured'), { permanent: true });
    },
};

let override = null;

export function getEmailProvider() {
    if (override) return override;
    const choice = (process.env.EMAIL_PROVIDER || '').toLowerCase();
    if (choice === 'resend' && process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
        return createResendProvider({ apiKey: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM, replyTo: process.env.EMAIL_REPLY_TO });
    }
    return disabledProvider;
}

/* Tests inject a fake provider; pass null to restore the environment-based choice. */
export function setEmailProvider(provider) {
    override = provider;
}
