import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { request, startHarness, stopHarness } from './helpers/harness.js';

before(startHarness);
after(stopHarness);

describe('payment and refund audit', () => {
    test('payment charge creation with server-side idempotency must exist before live money is enabled', async () => {
        const response = await request('POST', '/api/v1/payments/create', {
            body: {
                amount: 49900,
                currency: 'INR',
                consultationId: '00000000-0000-0000-0000-000000000001',
                idempotencyKey: 'payment-audit-1',
            },
        });

        assert.notEqual(response.status, 404, 'A payment creation endpoint must exist before real-money charging is allowed.');
        assert.notEqual(response.status, 501, 'The payment gateway interface must be implemented before launch.');
    });

    test('webhook verification must exist and reject forged events before fees are accepted', async () => {
        const response = await request('POST', '/api/v1/webhooks/payment', {
            body: {
                event: 'payment.captured',
                paymentId: 'fake_payment_id',
                amount: 49900,
                currency: 'INR',
                fake: true,
            },
        });

        assert.notEqual(response.status, 404, 'A payment webhook endpoint must exist to verify gateway events.');
        assert.notEqual(response.status, 501, 'Webhook verification must be implemented before production.');
    });

    test('refund creation must be server-authorized and idempotent before any financial reversal is accepted', async () => {
        const response = await request('POST', '/api/v1/refunds/create', {
            body: {
                paymentId: 'pay_audit_123',
                reason: 'customer_request',
                amount: 49900,
            },
        });

        assert.notEqual(response.status, 404, 'A refund endpoint must exist before launch.');
        assert.notEqual(response.status, 501, 'Refund handling must be implemented before money changes hands.');
    });
});
