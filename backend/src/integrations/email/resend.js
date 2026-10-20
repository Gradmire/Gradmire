/* Resend (https://resend.com/docs/api-reference/emails/send-email).
   The Idempotency-Key header makes a retried request return the original
   message instead of sending a second copy (keys are honoured for 24 hours). */
export function createResendProvider({ apiKey, from, replyTo }) {
    return {
        name: 'resend',
        configured: true,
        async send({ to, subject, text, html, idempotencyKey }) {
            let response;
            try {
                response = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        'Idempotency-Key': idempotencyKey.slice(0, 256),
                    },
                    body: JSON.stringify({ from, to: [to], subject, text, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
                    signal: AbortSignal.timeout(10_000),
                });
            } catch (error) {
                throw new Error(`Resend request failed: ${error.name}`);
            }
            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
                // 4xx other than rate limiting will not succeed on retry.
                const permanent = response.status >= 400 && response.status < 500 && response.status !== 429 && response.status !== 409;
                throw Object.assign(new Error(`Resend ${response.status}: ${String(body.message || body.name || 'error').slice(0, 200)}`), { permanent });
            }
            return { messageId: body.id || null };
        },
    };
}
