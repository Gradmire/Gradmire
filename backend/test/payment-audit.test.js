import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { request, startHarness, stopHarness } from './helpers/harness.js';

before(startHarness);
after(stopHarness);

describe('payments remain unavailable while gateway integration is deferred', () => {
    test('charge creation is unavailable, so clients cannot initiate payments', async () => {
        const response = await request('POST', '/api/v1/payments/create', {
            body: {
                amount: 49900,
                currency: 'INR',
                consultationId: '00000000-0000-0000-0000-000000000001',
                idempotencyKey: 'payment-audit-1',
            },
        });

        assert.equal(response.status, 404, 'Paid checkout must remain unavailable until a gateway and idempotent charge flow are implemented.');
    });

    test('payment webhooks are unavailable, so client requests cannot mark bookings paid', async () => {
        const response = await request('POST', '/api/v1/webhooks/payment', {
            body: {
                event: 'payment.captured',
                paymentId: 'fake_payment_id',
                amount: 49900,
                currency: 'INR',
                fake: true,
            },
        });

        assert.equal(response.status, 404, 'Payments must remain disabled until signed webhook processing is implemented.');
    });

    test('refunds are unavailable until authorized, idempotent refund processing is implemented', async () => {
        const response = await request('POST', '/api/v1/refunds/create', {
            body: {
                paymentId: 'pay_audit_123',
                reason: 'customer_request',
                amount: 49900,
            },
        });

        assert.equal(response.status, 404, 'Refunds must remain unavailable until verified-payment and refund controls exist.');
    });
});
