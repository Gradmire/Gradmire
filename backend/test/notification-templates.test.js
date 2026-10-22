import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderTemplate } from '../src/services/notification-templates.js';

test('employee invitation email directs invitees to accept on the join page', () => {
    const email = renderTemplate('employee_invitation', {
        fullName: 'Test Invitee',
        jobTitle: 'Consultant',
        department: 'Counselling',
        expiresAt: '2026-12-01T00:00:00.000Z',
        token: 'test-invitation-token',
    });

    assert.match(email.subject, /invited to join/i);
    assert.match(email.text, /Review invitation: http:\/\/localhost:8080\/pages\/join-team#token=test-invitation-token/);
    assert.match(email.text, /opening it does not accept the invitation/i);
    assert.match(email.text, /click Accept the invitation on the page/i);
    assert.match(email.html, />Review invitation<\/a>/);
});
