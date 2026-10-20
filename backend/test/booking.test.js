/* Booking behaviour: guest and student bookings, validation, availability,
   concurrency, idempotency, timezones, cancellation and rescheduling. */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
    agent, BASE_NOW, createStaff, db, deactivateCounsellors, guestBooking, request, setNow, signUpStudent,
    startHarness, stopHarness, TYPE_FREE, TYPE_UNI, useProviders,
} from './helpers/harness.js';

before(startHarness);
after(stopHarness);

let counsellor;
beforeEach(async () => {
    await setNow(BASE_NOW);
    await useProviders();
    await db.query('DELETE FROM consultations');
    await deactivateCounsellors();
    counsellor = await createStaff({ name: 'Priya Mehta' });
});

const book = (body, options = {}) => request('POST', '/api/v1/consultations', { body, ...options });

describe('public catalogue and availability', () => {
    test('lists the seeded active consultation types with durations', async () => {
        const result = await request('GET', '/api/v1/consultation-types');
        assert.equal(result.status, 200);
        const slugs = result.body.data.map((t) => t.slug);
        assert.deepEqual(slugs, ['free-consultation', 'university-selection', 'profile-evaluation', 'application-guidance', 'visa-guidance']);
        assert.equal(result.body.data[0].durationMinutes, 30);
    });

    test('returns only slots inside working hours, with notice applied', async () => {
        const result = await request('GET', `/api/v1/availability?consultation_type_id=${TYPE_FREE}&date=2026-11-03&timezone=Asia/Kolkata`);
        assert.equal(result.status, 200);
        const slots = result.body.data.slots;
        // 10:00–18:00 IST, 30-minute slots → 16 starts, first 10:00 IST (04:30Z), last 17:30 IST.
        assert.equal(slots.length, 16);
        assert.equal(slots[0].start, '2026-11-03T04:30:00.000Z');
        assert.equal(slots.at(-1).start, '2026-11-03T12:00:00.000Z');
        assert.ok(!('counsellorIds' in slots[0]), 'internal counsellor ids are not exposed');
    });

    test('Sunday has no slots and invalid parameters are rejected', async () => {
        const sunday = await request('GET', `/api/v1/availability?consultation_type_id=${TYPE_FREE}&date=2026-11-08&timezone=Asia/Kolkata`);
        assert.equal(sunday.body.data.slots.length, 0);
        const badZone = await request('GET', `/api/v1/availability?consultation_type_id=${TYPE_FREE}&date=2026-11-03&timezone=Mars/Olympus`);
        assert.equal(badZone.status, 400);
        const badDate = await request('GET', `/api/v1/availability?consultation_type_id=${TYPE_FREE}&date=2026-02-30&timezone=UTC`);
        assert.equal(badDate.status, 400);
    });
});

describe('creating bookings', () => {
    test('1. a guest can book a valid slot; lead and booking are persisted', async () => {
        const body = guestBooking();
        const result = await book(body);
        assert.equal(result.status, 201, JSON.stringify(result.body));
        const { consultation, manageToken } = result.body.data;
        assert.equal(consultation.status, 'confirmed'); // no calendar configured → confirmed from the DB alone
        assert.equal(consultation.meetingUrl, null, 'no link is claimed when none was generated');
        assert.match(consultation.reference, /^GM-[0-9A-Z]{8}$/);
        assert.ok(manageToken && manageToken.length > 30);

        const row = (await db.query('SELECT * FROM consultations WHERE id = $1', [consultation.id])).rows[0];
        assert.equal(row.student_user_id, null);
        assert.equal(row.counsellor_id, counsellor.id);
        assert.equal(row.scheduled_start.toISOString(), body.start);
        assert.equal(row.scheduled_end.toISOString(), '2026-11-03T05:00:00.000Z');
        assert.equal(row.student_phone, '+919876543210', 'phone stored in normalised international form');
        assert.notEqual(row.manage_token_hash, manageToken, 'only a hash of the manage token is stored');
        const lead = (await db.query('SELECT * FROM leads WHERE id = $1', [row.lead_id])).rows[0];
        assert.equal(lead.source, 'booking');
        assert.equal(lead.email, body.email);
    });

    test('2. a signed-in student books with account details; client-sent identity is ignored', async () => {
        const student = agent();
        const profile = await signUpStudent(student);
        await student.get('/api/v1/auth/session');
        const result = await student.post('/api/v1/consultations', {
            ...guestBooking(), fullName: undefined, email: 'someone-else@example.com', phone: undefined,
        });
        assert.equal(result.status, 201, JSON.stringify(result.body));
        const row = (await db.query('SELECT * FROM consultations WHERE id = $1', [result.body.data.consultation.id])).rows[0];
        assert.equal(row.student_user_id, profile.id);
        assert.equal(row.student_email, profile.email, 'email comes from the account, not the request');
        assert.equal(row.student_name, 'Ravi Kumar');
        const lead = (await db.query('SELECT user_id FROM leads WHERE id = $1', [row.lead_id])).rows[0];
        assert.equal(lead.user_id, profile.id);
    });

    test('3. invalid submissions are rejected with field errors', async () => {
        const cases = [
            [{ email: 'not-an-email' }, 'email'],
            [{ phone: '98765' }, 'phone'],
            [{ contactConsent: false }, 'contactConsent'],
            [{ timezone: 'Not/AZone' }, 'timezone'],
            [{ start: '2026-11-03 10:00' }, 'start'],
            [{ meetingMethod: 'carrier-pigeon' }, 'meetingMethod'],
            [{ fullName: '' }, 'fullName'],
            [{ message: 'x'.repeat(2001) }, 'message'],
            [{ website: 'http://spam.example' }, 'website'],
        ];
        for (const [override, field] of cases) {
            const result = await book(guestBooking(override));
            assert.equal(result.status, 400, `${field} should be rejected`);
            assert.ok(result.body.fields[field], `error reported on ${field}: ${JSON.stringify(result.body)}`);
        }
        const notJson = await fetch(`${(await import('./helpers/harness.js')).baseUrl}/api/v1/consultations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops' });
        assert.equal(notJson.status, 400);
        assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM consultations')).rows[0].n, 0);
    });

    test('4. an inactive consultation type cannot be booked or queried', async () => {
        await db.query('UPDATE consultation_types SET is_active = FALSE WHERE id = $1', [TYPE_UNI]);
        try {
            const result = await book(guestBooking({ consultationTypeId: TYPE_UNI }));
            assert.equal(result.status, 422);
            assert.equal(result.body.code, 'TYPE_UNAVAILABLE');
            const slots = await request('GET', `/api/v1/availability?consultation_type_id=${TYPE_UNI}&date=2026-11-03&timezone=UTC`);
            assert.equal(slots.status, 422);
        } finally {
            await db.query('UPDATE consultation_types SET is_active = TRUE WHERE id = $1', [TYPE_UNI]);
        }
    });

    test('5. unavailable slots are rejected: outside hours, misaligned, too soon, taken, blocked', async () => {
        const outside = await book(guestBooking({ start: '2026-11-03T14:00:00.000Z' })); // 19:30 IST
        assert.equal(outside.status, 409);
        assert.equal(outside.body.code, 'SLOT_UNAVAILABLE');
        const misaligned = await book(guestBooking({ start: '2026-11-03T04:40:00.000Z' }));
        assert.equal(misaligned.status, 409);
        const fourHoursAway = await book(guestBooking({ start: '2026-11-02T04:30:00.000Z' })); // Mon 10:00 IST, 4 h ahead
        assert.equal(fourHoursAway.status, 201);
        await setNow(new Date('2026-11-02T03:00:00Z')); // 08:30 IST: 10:00 IST is now under 3h away
        const underNotice = await book(guestBooking({ start: '2026-11-02T05:00:00.000Z' }));
        assert.equal(underNotice.status, 409);
        await setNow(BASE_NOW);

        assert.equal((await book(guestBooking())).status, 201);
        const taken = await book(guestBooking());
        assert.equal(taken.status, 409, 'same slot with the only counsellor is taken');
        // The 10-minute buffer after 10:00–10:30 blocks [10:30, 10:40), so a 10:30 start is rejected.
        const inBuffer = await book(guestBooking({ start: '2026-11-03T05:00:00.000Z' }));
        assert.equal(inBuffer.status, 409, 'buffer after the previous booking is respected');
        assert.equal((await book(guestBooking({ start: '2026-11-03T05:30:00.000Z' }))).status, 201);

        await db.query("INSERT INTO availability_exceptions (id, counsellor_id, starts_at, ends_at, reason) VALUES ($1, $2, '2026-11-04T00:00:00Z', '2026-11-05T00:00:00Z', 'Leave')", [crypto.randomUUID(), counsellor.id]);
        assert.equal((await book(guestBooking({ start: '2026-11-04T04:30:00.000Z' }))).status, 409, 'exception blocks the day');
    });

    test('6. concurrent requests cannot double-book a counsellor', async () => {
        const attempts = await Promise.all(Array.from({ length: 8 }, () => book(guestBooking())));
        const statuses = attempts.map((a) => a.status).sort();
        assert.equal(statuses.filter((s) => s === 201).length, 1, `exactly one wins: ${statuses}`);
        assert.ok(statuses.filter((s) => s !== 201).every((s) => s === 409));
        const { rows } = await db.query("SELECT COUNT(*)::int AS n FROM consultations WHERE status IN ('reserved', 'confirmed')");
        assert.equal(rows[0].n, 1);

        // The database itself refuses an overlapping insert, even bypassing the API.
        const existing = (await db.query('SELECT * FROM consultations LIMIT 1')).rows[0];
        await assert.rejects(
            db.query(
                `INSERT INTO consultations (id, reference, consultation_type_id, counsellor_id, student_name, student_email, student_phone,
                   scheduled_start, scheduled_end, blocked_until, timezone, meeting_method, status)
                 VALUES ($1, 'GM-RAWINSRT', $2, $3, 'X', 'x@example.com', '+911234567', $4, $5, $5, 'UTC', 'video', 'confirmed')`,
                [crypto.randomUUID(), TYPE_FREE, existing.counsellor_id, new Date('2026-11-03T04:45:00Z'), new Date('2026-11-03T05:15:00Z')],
            ),
            (error) => error.code === '23P01',
        );
    });

    test('6b. with two counsellors, concurrent bookings for one slot are spread across both', async () => {
        const second = await createStaff({ name: 'Second Counsellor' });
        const attempts = await Promise.all(Array.from({ length: 4 }, () => book(guestBooking())));
        assert.equal(attempts.filter((a) => a.status === 201).length, 2);
        const { rows } = await db.query('SELECT counsellor_id FROM consultations ORDER BY counsellor_id');
        assert.deepEqual(rows.map((r) => r.counsellor_id).sort(), [counsellor.id, second.id].sort());
    });

    test('7. duplicate submissions do not create duplicate appointments', async () => {
        const body = guestBooking();
        const key = 'idem-key-123456';
        const [first, second] = await Promise.all([
            book(body, { headers: { 'Idempotency-Key': key } }),
            book(body, { headers: { 'Idempotency-Key': key } }),
        ]);
        const ids = new Set([first, second].map((r) => r.body.data?.consultation?.id));
        assert.equal(ids.size, 1, `same booking returned: ${first.status}/${second.status}`);
        assert.deepEqual([first.status, second.status].sort(), [200, 201]);
        const third = await book(body, { headers: { 'Idempotency-Key': key } });
        assert.equal(third.status, 200);
        assert.equal(third.headers.get('idempotent-replayed'), 'true');
        assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM consultations')).rows[0].n, 1);

        const reused = await book({ ...body, start: '2026-11-03T06:00:00.000Z' }, { headers: { 'Idempotency-Key': key } });
        assert.equal(reused.status, 422, 'a key cannot be reused for a different request');

        // Without a key, a double click from the same person is stopped by the per-student overlap rule.
        await createStaff({ name: 'Another' });
        const again = await book({ ...body });
        assert.equal(again.status, 409);
        assert.equal(again.body.code, 'STUDENT_OVERLAP');
    });

    test('8. timezones: slots and bookings convert correctly between zones', async () => {
        // A New York visitor asking for Monday 2 Nov sees the IST working day that falls on their date.
        const ny = await request('GET', `/api/v1/availability?consultation_type_id=${TYPE_FREE}&date=2026-11-02&timezone=America/New_York`);
        const starts = ny.body.data.slots.map((s) => s.start);
        // 2 Nov NY = 05:00Z 2 Nov → 05:00Z 3 Nov; IST hours on 2 Nov are 04:30Z–12:30Z, so 05:00Z onward…
        assert.equal(starts[0], '2026-11-02T05:00:00.000Z');
        // …and the first Tuesday IST slot too, because 3 Nov 10:00 IST (04:30Z) is still 2 Nov 23:30 in New York.
        assert.ok(starts.includes('2026-11-03T04:30:00.000Z'));
        assert.ok(starts.every((s) => s >= '2026-11-02T05:00:00.000Z' && s < '2026-11-03T05:00:00.000Z'));

        const result = await book(guestBooking({ start: '2026-11-02T23:30:00-05:00', timezone: 'America/New_York' }));
        assert.equal(result.status, 201, JSON.stringify(result.body));
        const row = (await db.query('SELECT scheduled_start, timezone FROM consultations WHERE id = $1', [result.body.data.consultation.id])).rows[0];
        assert.equal(row.scheduled_start.toISOString(), '2026-11-03T04:30:00.000Z', 'stored in UTC');
        assert.equal(row.timezone, 'America/New_York', 'display timezone kept');
    });
});

describe('changing bookings', () => {
    test('9. cancellation follows the 24-hour policy and frees the slot', async () => {
        const created = (await book(guestBooking())).body.data;
        // 28.5 hours before start: allowed.
        const lookup = await request('POST', '/api/v1/consultations/manage/lookup', { body: { token: created.manageToken } });
        assert.equal(lookup.body.data.canCancel, true);

        await setNow(new Date('2026-11-02T06:00:00Z')); // 22.5 h before
        const late = await request('POST', '/api/v1/consultations/manage/cancel', { body: { token: created.manageToken } });
        assert.equal(late.status, 409);
        assert.equal(late.body.code, 'POLICY_CUTOFF');

        await setNow(BASE_NOW);
        const cancelled = await request('POST', '/api/v1/consultations/manage/cancel', { body: { token: created.manageToken, reason: 'Clash with exam' } });
        assert.equal(cancelled.status, 200);
        assert.equal(cancelled.body.data.status, 'cancelled');
        const again = await request('POST', '/api/v1/consultations/manage/cancel', { body: { token: created.manageToken } });
        assert.equal(again.status, 409, 'cannot cancel twice');
        assert.equal((await book(guestBooking())).status, 201, 'the slot is bookable again');
        const bogus = await request('POST', '/api/v1/consultations/manage/lookup', { body: { token: 'x'.repeat(43) } });
        assert.equal(bogus.status, 404);
    });

    test('10. rescheduling reserves the new slot safely and keeps the original on failure', async () => {
        const created = (await book(guestBooking())).body.data;
        const other = (await book(guestBooking({ start: '2026-11-03T07:30:00.000Z' }))).body.data;

        const clash = await request('POST', '/api/v1/consultations/manage/reschedule', { body: { token: created.manageToken, start: '2026-11-03T07:30:00.000Z' } });
        assert.equal(clash.status, 409, 'cannot move onto a taken slot');
        const original = (await db.query('SELECT status FROM consultations WHERE id = $1', [created.consultation.id])).rows[0];
        assert.equal(original.status, 'confirmed', 'failed reschedule leaves the booking untouched');

        // Moving 30 minutes later overlaps the old booking's own buffer — allowed, since it is released.
        const moved = await request('POST', '/api/v1/consultations/manage/reschedule', { body: { token: created.manageToken, start: '2026-11-03T05:00:00.000Z' } });
        assert.equal(moved.status, 200, JSON.stringify(moved.body));
        assert.equal(moved.body.data.start, '2026-11-03T05:00:00.000Z');
        const rows = (await db.query('SELECT id, status, rescheduled_from_id, reschedule_count FROM consultations WHERE id IN ($1, $2)', [created.consultation.id, moved.body.data.id])).rows;
        const old = rows.find((r) => r.id === created.consultation.id);
        const fresh = rows.find((r) => r.id === moved.body.data.id);
        assert.equal(old.status, 'rescheduled');
        assert.equal(fresh.rescheduled_from_id, old.id);
        assert.equal(fresh.reschedule_count, 1);
        // The same link now opens the new booking.
        const lookup = await request('POST', '/api/v1/consultations/manage/lookup', { body: { token: created.manageToken } });
        assert.equal(lookup.body.data.id, fresh.id);
        // Move again, well away; the original 10:00 slot is then free for someone else.
        const movedAgain = await request('POST', '/api/v1/consultations/manage/reschedule', { body: { token: created.manageToken, start: '2026-11-03T09:00:00.000Z' } });
        assert.equal(movedAgain.status, 200);
        assert.equal(movedAgain.body.data.canReschedule, false, 'the reschedule limit (2) is reached');
        assert.equal((await book(guestBooking({ start: '2026-11-03T04:30:00.000Z' }))).status, 201);
        assert.ok(other.consultation.id);
    });

    test('10b. concurrent reschedules of one booking cannot both succeed', async () => {
        const created = (await book(guestBooking())).body.data;
        const results = await Promise.all(['2026-11-03T06:00:00.000Z', '2026-11-03T07:00:00.000Z'].map((start) => request('POST', '/api/v1/consultations/manage/reschedule', { body: { token: created.manageToken, start } })));
        const okCount = results.filter((r) => r.status === 200).length;
        assert.equal(okCount, 1, `statuses: ${results.map((r) => r.status)}`);
        assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM consultations WHERE status IN ('reserved','confirmed')")).rows[0].n, 1);
    });

    test('students cancel and reschedule their own bookings from the dashboard API', async () => {
        const student = agent();
        await signUpStudent(student);
        await student.get('/api/v1/auth/session');
        const created = (await student.post('/api/v1/consultations', { ...guestBooking(), fullName: undefined, email: undefined })).body.data.consultation;
        const moved = await student.post(`/api/v1/me/consultations/${created.id}/reschedule`, { start: '2026-11-03T08:00:00.000Z' });
        assert.equal(moved.status, 200);
        const list = await student.get('/api/v1/me/consultations');
        assert.deepEqual(list.body.data.map((c) => c.id), [moved.body.data.id], 'superseded rows are hidden');
        const cancelled = await student.post(`/api/v1/me/consultations/${moved.body.data.id}/cancel`, { reason: 'Plans changed' });
        assert.equal(cancelled.body.data.status, 'cancelled');
    });
});
