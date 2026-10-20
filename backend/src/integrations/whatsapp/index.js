/* WhatsApp boundary (not active). The owner chose email-only notifications for
   now; no WhatsApp notifications are queued. To add one later, implement a
   provider with the same shape as the email providers (Meta WhatsApp Cloud API
   needs pre-approved message templates and the student's opt-in), return it
   here, and queue `channel: 'whatsapp'` rows in notification-service.js.
   See docs/consultation-booking-setup.md → "WhatsApp". */
export function getWhatsAppProvider() {
    return {
        name: 'whatsapp-disabled',
        configured: false,
        async send() {
            throw Object.assign(new Error('WhatsApp provider not configured'), { permanent: true });
        },
    };
}
