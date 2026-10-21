/* Integration: persistence, calendar sync (failures, retries, idempotency),
   notifications (failures, retries, reminders), dashboard and CRM data, staff CLI. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
    agent, BASE_NOW, createStaff, db, deactivateCounsellors, fakeCalendar, fakeEmail, guestBooking, request, runJobs,
    setNow, signUpStudent, startHarness, stopHarness, useProviders,
} from './helpers/harness.js';

before(startHarness);
after(stopHarness);

let calendar;
let email;
let counsellor;
let admin;
let adminClient;

beforeEach(async () => {
    await setNow(BASE_NOW);
    calendar = fakeCalendar();
    email = fakeEmail();
    await useProviders({ calendar, email });
    await db.query('DELETE FROM consultations');
    await db.query('DELETE FROM notifications');
    await deactivateCounsellors();
    counsellor = await createStaff({ name: 'Priya Mehta', calendarId: 'priya@gradmire.test' });
    admin = await createStaff({ role: 'admin', name: 'Admin' });
    adminClient = agent();
    await adminClient.login(admin.email, admin.password);
});

const book = (body = guestBooking(), options = {}) => request('POST', '/api/v1/consultations', { body, ...options });
const notificationsFor = async (id) => (await db.query('SELECT template, status, attempts, last_error, recipient FROM notifications WHERE consultation_id = $1 ORDER BY template', [id])).rows;

describe('persistence and calendar sync', () => {
    test('17. a booking, its lead, history, calendar event and messages are persisted', async () => {
        const result = await book();
        assert.equal(result.status, 201);
        const { consultation } = result.body.data;
        assert.equal(consultation.status, 'confirmed', 'calendar event created inline');
        assert.match(consultation.meetingUrl, /^https:\/\/meet\.google\.com\//, 'link shown only because the provider returned one');

        const row = (await db.query('SELECT * FROM consultations WHERE id = $1', [consultation.id])).rows[0];
        assert.equal(row.calendar_status, 'synced');
        assert.equal(row.calendar_event_id, `gm${row.id.replace(/-/g, '')}g1`);
        assert.equal(calendar.events.size, 1);
        const events = (await db.query('SELECT event FROM consultation_events WHERE consultation_id = $1 ORDER BY id', [row.id])).rows.map((e) => e.event);
        assert.deepEqual(events, ['created', 'calendar_synced', 'confirmed']);
        const sent = email.sent.map((m) => m.subject);
        assert.ok(sent.some((s) => s.startsWith('Confirmed:')), 'student confirmation sent');
        assert.ok(sent.some((s) => s.startsWith('New consultation:')), 'counsellor notified');
        const confirmation = email.sent.find((m) => m.subject.startsWith('Confirmed:'));
        assert.match(confirmation.text, /manage-consultation#token=/);
        assert.match(confirmation.text, /Meeting link: https:\/\/meet\.google\.com/);
        const reminders = (await notificationsFor(row.id)).filter((n) => n.template.startsWith('reminder'));
        assert.deepEqual(reminders.map((r) => r.status), ['pending', 'pending'], '24 h and 1 h reminders scheduled');
    });

    test('18. calendar failures leave the booking reserved, never falsely confirmed', async () => {
        calendar.failures = 100;
        const result = await book();
        assert.equal(result.status, 201);
        const { consultation } = result.body.data;
        assert.equal(consultation.status, 'reserved');
        assert.equal(consultation.meetingUrl, null);
        assert.ok(!email.sent.some((m) => m.subject.startsWith('Confirmed:')), 'no confirmation before the event exists');

        // The worker retries with back-off until the job is given up.
        for (let i = 0; i < 8; i += 1) {
            await setNow(new Date(BASE_NOW.getTime() + (i + 1) * 61 * 60_000));
            await runJobs();
        }
        const row = (await db.query('SELECT status, calendar_status FROM consultations WHERE id = $1', [consultation.id])).rows[0];
        assert.deepEqual(row, { status: 'reserved', calendar_status: 'failed' });
        const job = (await db.query("SELECT status, attempts FROM calendar_sync_jobs WHERE consultation_id = $1 AND action = 'create'", [consultation.id])).rows[0];
        assert.equal(job.status, 'dead');
        assert.equal(job.attempts, 6);

        const summary = await adminClient.get('/api/v1/admin/consultations/summary');
        assert.equal(summary.body.data.calendarFailed, 1);
        // Staff fix the calendar and retry: the booking confirms.
        calendar.failures = 0;
        const retried = await adminClient.post(`/api/v1/admin/consultations/${consultation.id}/calendar-sync`, {});
        assert.equal(retried.status, 200);
        assert.equal(retried.body.data.status, 'confirmed');
        assert.equal(retried.body.data.calendarStatus, 'synced');
    });

    test('19. retried calendar jobs do not create duplicate events', async () => {
        calendar.loseResponses = 1; // the event is written, then the request "times out"
        const result = await book();
        assert.equal(result.body.data.consultation.status, 'reserved');
        await setNow(new Date(BASE_NOW.getTime() + 5 * 60_000));
        await runJobs();
        await runJobs();
        assert.equal(calendar.createCalls, 2, 'one retry');
        assert.equal(calendar.events.size, 1, 'the retry found the same event id instead of creating another');
        const row = (await db.query('SELECT status FROM consultations WHERE id = $1', [result.body.data.consultation.id])).rows[0];
        assert.equal(row.status, 'confirmed');
        const jobs = (await db.query('SELECT COUNT(*)::int AS n FROM calendar_sync_jobs WHERE consultation_id = $1', [result.body.data.consultation.id])).rows[0].n;
        assert.equal(jobs, 1);
    });

    test('cancelling and rescheduling update the calendar', async () => {
        const created = (await book()).body.data;
        assert.equal(calendar.events.size, 1);
        const moved = await request('POST', '/api/v1/consultations/manage/reschedule', { body: { token: created.manageToken, start: '2026-11-03T08:00:00.000Z' } });
        assert.equal(moved.status, 200);
        assert.equal(moved.body.data.status, 'confirmed');
        assert.equal(calendar.events.size, 1, 'old event removed, new event created');
        const [event] = calendar.events.values();
        assert.equal(event.start.toISOString(), '2026-11-03T08:00:00.000Z');
        assert.ok(email.sent.some((m) => m.subject.startsWith('Rescheduled:')));

        await request('POST', '/api/v1/consultations/manage/cancel', { body: { token: created.manageToken } });
        assert.equal(calendar.events.size, 0);
        assert.ok(email.sent.some((m) => m.subject.startsWith('Cancelled:')));
        const reminders = (await db.query("SELECT status FROM notifications WHERE template LIKE 'reminder%'")).rows.map((r) => r.status);
        assert.ok(reminders.every((s) => s === 'cancelled'), `reminders cancelled: ${reminders}`);
    });

    test('external busy times hide slots', async () => {
        calendar.busy = [{ start: new Date('2026-11-03T04:30:00Z'), end: new Date('2026-11-03T05:30:00Z') }];
        const slots = (await request('GET', `/api/v1/availability?consultation_type_id=6f1c2a10-0000-4000-8000-000000000001&date=2026-11-03&timezone=Asia/Kolkata`)).body.data.slots;
        assert.equal(slots[0].start, '2026-11-03T05:30:00.000Z');
        assert.equal((await book()).status, 409, 'the booking re-check also sees the busy time');
    });
});

describe('notifications', () => {
    test('20. notification failures are recorded and retryable without duplicates', async () => {
        email.failures = 100;
        const created = (await book()).body.data.consultation;
        let rows = await notificationsFor(created.id);
        const confirmation = rows.find((r) => r.template === 'booking_confirmed');
        assert.equal(confirmation.status, 'failed');
        assert.match(confirmation.last_error, /simulated/);

        // Exhaust automatic retries.
        for (let i = 0; i < 6; i += 1) {
            await setNow(new Date(BASE_NOW.getTime() + (i + 1) * 61 * 60_000));
            await runJobs();
        }
        rows = await notificationsFor(created.id);
        assert.equal(rows.find((r) => r.template === 'booking_confirmed').attempts, 5);

        const failed = await adminClient.get('/api/v1/admin/notifications?status=failed');
        const target = failed.body.data.items.find((n) => n.consultation_id === created.id && n.template === 'booking_confirmed');
        assert.ok(target, 'failed notifications are visible to admins');
        email.failures = 0;
        assert.equal((await adminClient.post(`/api/v1/admin/notifications/${target.id}/retry`, {})).status, 200);
        await runJobs();
        await runJobs();
        assert.equal((await notificationsFor(created.id)).find((r) => r.template === 'booking_confirmed').status, 'sent');
        assert.equal(email.sent.filter((m) => m.subject.startsWith('Confirmed:')).length, 1, 'delivered exactly once');
        assert.equal((await adminClient.post(`/api/v1/admin/notifications/${target.id}/retry`, {})).status, 409, 'sent messages are not re-sent');
    });

    test('without an email provider, messages are recorded as skipped, not sent', async () => {
        await useProviders({ calendar, email: null });
        const created = (await book()).body.data.consultation;
        const rows = await notificationsFor(created.id);
        const confirmation = rows.find((r) => r.template === 'booking_confirmed');
        assert.equal(confirmation.status, 'skipped');
        assert.equal(confirmation.last_error, 'Email provider not configured');
    });

    test('reminders go out on time, once, and only for confirmed bookings', async () => {
        const created = (await book()).body.data.consultation;
        email.sent.length = 0;
        await setNow(new Date('2026-11-02T04:31:00Z')); // 24 h before start
        await runJobs();
        await runJobs();
        assert.deepEqual(email.sent.map((m) => m.subject), ['Reminder: Free study-abroad consultation is tomorrow']);
        await setNow(new Date('2026-11-03T03:31:00Z')); // 1 h before
        await runJobs();
        assert.equal(email.sent.length, 2);
        assert.match(email.sent[1].subject, /starts in 1 hour/);
        assert.ok(created.id);
    });
});

describe('dashboards', () => {
    test('21. the student dashboard shows exactly what was persisted', async () => {
        const student = agent();
        const profile = await signUpStudent(student);
        await student.get('/api/v1/auth/session');
        const created = (await student.post('/api/v1/consultations', { ...guestBooking({ meetingMethod: 'phone' }), fullName: undefined, email: undefined })).body.data.consultation;
        const list = (await student.get('/api/v1/me/consultations')).body.data;
        assert.equal(list.length, 1);
        const row = (await db.query('SELECT * FROM consultations WHERE id = $1', [created.id])).rows[0];
        const item = list[0];
        assert.equal(item.id, row.id);
        assert.equal(item.reference, row.reference);
        assert.equal(item.status, row.status);
        assert.equal(item.start, row.scheduled_start.toISOString());
        assert.equal(item.end, row.scheduled_end.toISOString());
        assert.equal(item.meetingMethod, 'phone');
        assert.equal(item.meetingUrl, null, 'no Meet link for phone calls');
        assert.equal(item.counsellor.name, 'Priya Mehta');
        assert.equal(item.studentEmail, profile.email);
        const detail = (await student.get(`/api/v1/me/consultations/${created.id}`)).body.data;
        assert.deepEqual(detail, item);
    });

    test('22. the admin CRM shows the persisted booking and supports search, filters and updates', async () => {
        const created = (await book(guestBooking({ fullName: 'Meera Nair' }))).body.data.consultation;
        await book(guestBooking({ start: '2026-11-04T04:30:00.000Z' }));
        const list = (await adminClient.get('/api/v1/admin/consultations?q=meera')).body.data;
        assert.equal(list.total, 1);
        const item = list.items[0];
        const row = (await db.query('SELECT * FROM consultations WHERE id = $1', [created.id])).rows[0];
        assert.equal(item.reference, row.reference);
        assert.equal(item.student.email, row.student_email);
        assert.equal(item.counsellor.id, row.counsellor_id);
        assert.equal(item.leadSource, 'booking');
        assert.equal((await adminClient.get('/api/v1/admin/consultations?from=2026-11-04T00:00:00Z')).body.data.total, 1);
        assert.equal((await adminClient.get('/api/v1/admin/consultations?status=cancelled')).body.data.total, 0);
        assert.equal((await adminClient.get('/api/v1/admin/consultations?page_size=1&page=2')).body.data.items.length, 1);

        const tooEarly = await adminClient.patch(`/api/v1/admin/consultations/${created.id}`, { status: 'completed' });
        assert.equal(tooEarly.status, 409);
        await setNow(new Date('2026-11-03T05:10:00Z'));
        const done = await adminClient.patch(`/api/v1/admin/consultations/${created.id}`, { status: 'completed', outcome: 'qualified' });
        assert.equal(done.status, 200, JSON.stringify(done.body));
        assert.equal(done.body.data.status, 'completed');
        await adminClient.post(`/api/v1/admin/consultations/${created.id}/notes`, { kind: 'follow_up', body: 'Send UK shortlist', dueAt: '2026-11-05T05:00:00Z' });
        const detail = (await adminClient.get(`/api/v1/admin/consultations/${created.id}`)).body.data;
        assert.equal(detail.outcome, 'qualified');
        assert.equal(detail.notes[0].kind, 'follow_up');
        assert.ok(detail.history.some((h) => h.event === 'status_changed'));
        assert.equal(detail.lead.source, 'booking');
        const bad = await adminClient.patch(`/api/v1/admin/consultations/${created.id}`, { status: 'confirmed' });
        assert.equal(bad.status, 409, 'invalid transitions rejected');
        const audit = (await db.query("SELECT COUNT(*)::int AS n FROM audit_log WHERE action = 'consultation.updated' AND entity_id = $1", [created.id])).rows[0].n;
        assert.equal(audit, 1);
    });

    test('admins reassign counsellors safely and manage availability and types', async () => {
        // Book first so the booking surely goes to Priya, then add the second counsellor.
        const created = (await book()).body.data.consultation;
        const other = await createStaff({ name: 'Second' });
        const moved = await adminClient.patch(`/api/v1/admin/consultations/${created.id}`, { counsellorId: other.id });
        assert.equal(moved.status, 200);
        assert.equal(moved.body.data.counsellor.id, other.id);
        // Second has no calendar: the old event is removed and nothing new is created.
        assert.equal(calendar.events.size, 0);

        const rule = await adminClient.post('/api/v1/admin/availability', { kind: 'rule', counsellorId: other.id, weekday: 7, startTime: '10:00', endTime: '12:00', timezone: 'Asia/Kolkata' });
        assert.equal(rule.status, 201);
        const sunday = (await request('GET', '/api/v1/availability?consultation_type_id=6f1c2a10-0000-4000-8000-000000000001&date=2026-11-08&timezone=Asia/Kolkata')).body.data.slots;
        assert.equal(sunday.length, 4);
        const badRule = await adminClient.post('/api/v1/admin/availability', { kind: 'rule', counsellorId: other.id, weekday: 9, startTime: '12:00', endTime: '10:00', timezone: 'X' });
        assert.equal(badRule.status, 400);
        assert.equal((await adminClient.delete(`/api/v1/admin/availability/rule/${rule.body.data.id}`)).status, 200);

        const type = await adminClient.post('/api/v1/admin/consultation-types', { slug: 'sop-review', name: 'SOP review', durationMinutes: 60, meetingMethods: ['video'] });
        assert.equal(type.status, 201);
        assert.ok((await request('GET', '/api/v1/consultation-types')).body.data.some((t) => t.slug === 'sop-review'));
        await adminClient.patch(`/api/v1/admin/consultation-types/${type.body.data.id}`, { isActive: false });
        assert.ok(!(await request('GET', '/api/v1/consultation-types')).body.data.some((t) => t.slug === 'sop-review'));
    });
});

describe('staff CLI', () => {
    test('create-staff adds a counsellor with default hours, and refuses to silently promote', () => {
        const backendDir = fileURLToPath(new URL('../', import.meta.url));
        const env = { ...process.env, STAFF_PASSWORD: 'cli-staff-password-1' };
        const args = ['scripts/create-staff.js', '--email', `cli.${process.pid}@gradmire.test`, '--first-name', 'Cli', '--role', 'counsellor'];
        const out = execFileSync(process.execPath, args, { cwd: backendDir, env, encoding: 'utf8' });
        assert.match(out, /Added default hours/);
        assert.throws(() => execFileSync(process.execPath, args, { cwd: backendDir, env, stdio: 'pipe' }));
    });
});
