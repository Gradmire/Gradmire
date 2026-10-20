/* Student applications: staff record them, students see only their own. */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
    agent, BASE_NOW, createStaff, db, deactivateCounsellors, guestBooking, setNow, signUpStudent,
    startHarness, stopHarness, useProviders,
} from './helpers/harness.js';

before(startHarness);
after(stopHarness);

let counsellorA;
let counsellorB;
let admin;
beforeEach(async () => {
    await setNow(BASE_NOW);
    await useProviders();
    await db.query('DELETE FROM student_applications');
    await db.query('DELETE FROM consultations');
    await deactivateCounsellors();
    counsellorA = await createStaff({ name: 'Counsellor A' });
    counsellorB = await createStaff({ name: 'Counsellor B' });
    admin = await createStaff({ role: 'admin', name: 'Admin', hours: false });
});

async function staffAgent(staff) {
    const client = agent();
    await client.login(staff.email, staff.password);
    return client;
}

/* A signed-up student with one consultation; returns which counsellor got it. */
async function studentWithBooking() {
    const client = agent();
    const profile = await signUpStudent(client);
    await client.get('/api/v1/auth/session');
    const result = await client.post('/api/v1/consultations', { ...guestBooking({ start: '2026-11-03T04:30:00.000Z' }), fullName: undefined, email: undefined });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    const { rows } = await db.query('SELECT student_user_id, counsellor_id FROM consultations WHERE id = $1', [result.body.data.consultation.id]);
    const owner = rows[0].counsellor_id === counsellorA.id ? counsellorA : counsellorB;
    const outsider = owner === counsellorA ? counsellorB : counsellorA;
    return { client, profile, studentId: rows[0].student_user_id, owner, outsider };
}

const application = { university: 'University of Toronto', course: 'Computer Science', country: 'Canada', intake: 'Sep 2027', status: 'preparing', deadline: '2027-01-15', studentNote: 'Upload your transcript by Friday.' };

describe('student applications', () => {
    test('the assigned counsellor records an application and the student sees it', async () => {
        const { client, studentId, owner } = await studentWithBooking();
        const staff = await staffAgent(owner);

        const found = await staff.get('/api/v1/admin/students?q=');
        assert.equal(found.status, 200);
        assert.ok(found.body.data.some((s) => s.id === studentId));

        const created = await staff.post(`/api/v1/admin/students/${studentId}/applications`, application);
        assert.equal(created.status, 201, JSON.stringify(created.body));
        assert.equal(created.body.data.status, 'preparing');
        assert.equal(created.body.data.deadline, '2027-01-15');

        const updated = await staff.patch(`/api/v1/admin/applications/${created.body.data.id}`, { status: 'submitted', studentNote: '' });
        assert.equal(updated.status, 200, JSON.stringify(updated.body));
        assert.equal(updated.body.data.status, 'submitted');
        assert.equal(updated.body.data.studentNote, null, 'empty value clears the note');

        const mine = await client.get('/api/v1/me/applications');
        assert.equal(mine.status, 200);
        assert.equal(mine.body.data.length, 1);
        assert.equal(mine.body.data[0].university, 'University of Toronto');
        assert.equal(mine.body.data[0].status, 'submitted');

        const log = await db.query("SELECT action FROM audit_log WHERE entity_type = 'student_application' ORDER BY created_at");
        assert.deepEqual(log.rows.map((r) => r.action), ['application.created', 'application.updated']);
    });

    test('a student sees only their own applications and cannot use the staff endpoints', async () => {
        const first = await studentWithBooking();
        const second = await studentWithBooking();
        const staff = await staffAgent(admin);
        const created = await staff.post(`/api/v1/admin/students/${first.studentId}/applications`, application);
        assert.equal(created.status, 201);

        assert.equal((await second.client.get('/api/v1/me/applications')).body.data.length, 0);
        assert.equal((await second.client.get(`/api/v1/admin/students/${first.studentId}/applications`)).status, 403);
        assert.equal((await first.client.post(`/api/v1/admin/students/${first.studentId}/applications`, application)).status, 403);
        assert.equal((await first.client.patch(`/api/v1/admin/applications/${created.body.data.id}`, { status: 'enrolled' })).status, 403);
        assert.equal((await agent().get('/api/v1/me/applications')).status, 401);
    });

    test('a counsellor only reaches students who have a consultation with them; admins reach all', async () => {
        const { studentId, owner, outsider } = await studentWithBooking();
        const outsiderClient = await staffAgent(outsider);
        const created = await (await staffAgent(owner)).post(`/api/v1/admin/students/${studentId}/applications`, application);
        assert.equal(created.status, 201);

        assert.equal((await outsiderClient.get(`/api/v1/admin/students/${studentId}/applications`)).status, 404);
        assert.equal((await outsiderClient.post(`/api/v1/admin/students/${studentId}/applications`, application)).status, 404);
        assert.equal((await outsiderClient.patch(`/api/v1/admin/applications/${created.body.data.id}`, { status: 'rejected' })).status, 404);
        assert.equal((await outsiderClient.delete(`/api/v1/admin/applications/${created.body.data.id}`)).status, 404);
        assert.ok(!(await outsiderClient.get('/api/v1/admin/students')).body.data.some((s) => s.id === studentId));

        const adminClient = await staffAgent(admin);
        assert.equal((await adminClient.get(`/api/v1/admin/students/${studentId}/applications`)).body.data.length, 1);
        const removed = await adminClient.delete(`/api/v1/admin/applications/${created.body.data.id}`);
        assert.equal(removed.status, 200);
        assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM student_applications')).rows[0].n, 0);
    });

    test('input is validated and staff cannot attach applications to staff accounts', async () => {
        const { studentId } = await studentWithBooking();
        const staff = await staffAgent(admin);
        const missing = await staff.post(`/api/v1/admin/students/${studentId}/applications`, { course: 'Law' });
        assert.equal(missing.status, 400);
        assert.ok(missing.body.fields.university);
        assert.equal((await staff.post(`/api/v1/admin/students/${studentId}/applications`, { ...application, status: 'hacked' })).status, 400);
        assert.equal((await staff.post(`/api/v1/admin/students/${studentId}/applications`, { ...application, deadline: '2027-02-30' })).status, 400);
        assert.equal((await staff.post(`/api/v1/admin/students/${counsellorA.id}/applications`, application)).status, 404);
    });
});
