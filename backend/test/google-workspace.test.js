/* Google Workspace features: documents in private storage, CV uploads, the staff
   Gmail inbox and outgoing email, consultant interviews with Meet, login email
   changes, follow-up reminders and the integration panel. Google itself is
   replaced by fakes; the request formats sent to Gmail and Drive are checked
   against a mocked fetch. */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
    agent, baseUrl, BASE_NOW, createStaff, db, deactivateCounsellors, fakeCalendar, guestBooking, ORIGIN, request, runJobs, setNow,
    signUpStudent, startHarness, stopHarness, useProviders,
} from './helpers/harness.js';

before(startHarness);
after(stopHarness);

const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(200, 0x20), Buffer.from('\n%%EOF')]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

function memoryStorage() {
    const files = new Map();
    return {
        name: 'memory', configured: true, files,
        async upload({ data, properties }) {
            const key = `k${files.size + 1}`;
            files.set(key, { data: Buffer.from(data), properties });
            return { key };
        },
        async download(key) { return files.get(key)?.data || null; },
        async remove(key) { files.delete(key); return { removed: true }; },
    };
}

function fakeGmail() {
    const sent = [];
    return {
        sender: { name: 'gmail', configured: true, sender: 'counselling@gradmire.test', sent, async send(message) { sent.push(message); return { messageId: `m${sent.length}`, threadId: message.threadId || `t${sent.length}` }; } },
        mailbox: {
            name: 'gmail', configured: true, mailbox: 'counselling@gradmire.test', threads: [],
            async listThreads(q) { return this.threads.map((t) => ({ id: t.id, subject: t.messages[0].subject, snippet: '', messageCount: t.messages.length, lastFrom: t.messages.at(-1).from, lastDate: null, participants: t.messages.flatMap((m) => [m.from, m.to]) })); },
            async getThread(id) { return this.threads.find((t) => t.id === id) || null; },
        },
    };
}

let storage;
let gmail;
beforeEach(async () => {
    await setNow(BASE_NOW);
    await useProviders();
    storage = memoryStorage();
    gmail = fakeGmail();
    (await import('../src/integrations/storage/index.js')).setStorage(storage);
    const email = await import('../src/integrations/email/index.js');
    email.setGmailSender(gmail.sender);
    email.setMailbox(gmail.mailbox);
    for (const table of ['document_requests', 'staff_emails', 'email_change_requests', 'follow_up_tasks', 'consultant_application_events']) await db.query(`DELETE FROM ${table}`);
    await db.query('UPDATE consultant_applications SET cv_document_id = NULL');
    await db.query('DELETE FROM consultant_applications');
    await db.query('DELETE FROM documents');
    await db.query('DELETE FROM consultations');
    await deactivateCounsellors();
});

async function verify(userId) {
    const { verificationToken } = await import('../src/services/auth-service.js');
    const row = (await db.query('SELECT id FROM email_verification_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId])).rows[0];
    await request('POST', '/api/v1/auth/verify-email/confirm', { body: { token: verificationToken(row.id) } });
}

async function student({ verified = true } = {}) {
    const client = agent();
    const profile = await signUpStudent(client);
    if (verified) await verify(profile.id);
    await client.get('/api/v1/auth/session');
    return { client, ...profile };
}

async function staffAgent(staff) {
    const client = agent();
    await client.login(staff.email, staff.password);
    return { client, ...staff };
}

/* A raw upload with the agent's cookie and CSRF token. */
async function upload(client, path, data, type) {
    const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { Origin: ORIGIN, 'Content-Type': type, Cookie: client.state.cookie, 'X-CSRF-Token': client.state.csrf },
        body: data,
    });
    return { status: response.status, body: await response.json().catch(() => null) };
}

async function download(client, path) {
    const response = await fetch(`${baseUrl}${path}`, { headers: { Cookie: client.state.cookie } });
    return { status: response.status, headers: response.headers, data: Buffer.from(await response.arrayBuffer()) };
}

const auditCount = async (action) => (await db.query('SELECT COUNT(*)::int AS n FROM audit_log WHERE action = $1', [action])).rows[0].n;

/* ── Gmail and Drive request formats ──────────────────────────────────────── */

describe('Gmail and Drive requests', () => {
    test('Gmail messages are valid MIME, cannot gain headers, and a retry reuses an earlier copy', async () => {
        const { buildMime, createGmailSender } = await import('../src/integrations/email/gmail.js');
        const mime = buildMime({ from: 'Gradmire <a@gradmire.test>', to: 'x@example.com', subject: 'Hello\r\nBcc: evil@example.com', text: 'Hi', html: '<p>Hi</p>', messageId: '<1@gradmire.test>' });
        assert.ok(!/^Bcc:/m.test(mime), 'a line break in a subject never becomes a header');
        assert.match(mime, /Content-Type: multipart\/alternative/);
        assert.match(buildMime({ from: 'a@b.c', to: 'x@y.z', subject: 'Réservation', text: 'é', messageId: '<2@b.c>' }), /Subject: =\?UTF-8\?B\?/);

        const calls = [];
        const realFetch = globalThis.fetch;
        globalThis.fetch = async (url, init = {}) => {
            calls.push({ url: String(url), method: init.method || 'GET', body: init.body });
            if (String(url).includes('/messages?')) return new Response(JSON.stringify({ messages: calls.filter((c) => c.method === 'POST').length ? [{ id: 'earlier', threadId: 'th1' }] : [] }), { status: 200 });
            return new Response(JSON.stringify({ id: 'sent1', threadId: 'th1' }), { status: 200 });
        };
        try {
            const sender = createGmailSender({ accessToken: async (scope, subject) => `token:${scope}:${subject}`, sender: 'counselling@gradmire.test' });
            const first = await sender.send({ to: 'x@example.com', subject: 'S', text: 'T', idempotencyKey: 'k1', threadId: 'th1' });
            assert.deepEqual(first, { messageId: 'sent1', threadId: 'th1' });
            const posted = JSON.parse(calls.find((c) => c.method === 'POST').body);
            assert.equal(posted.threadId, 'th1');
            assert.match(Buffer.from(posted.raw, 'base64url').toString(), /^From: counselling@gradmire.test/m);
            assert.ok(calls[0].url.includes('/users/counselling%40gradmire.test/messages/send'));
            const again = await sender.send({ to: 'x@example.com', subject: 'S', text: 'T', idempotencyKey: 'k1', retry: true });
            assert.equal(again.messageId, 'earlier', 'a retry finds the copy already sent instead of sending twice');
            assert.equal(calls.filter((c) => c.method === 'POST').length, 1);
        } finally {
            globalThis.fetch = realFetch;
        }
    });

    test('Drive uploads go into the configured Shared Drive folder as multipart', async () => {
        const { createDriveStorage } = await import('../src/integrations/storage/drive.js');
        const realFetch = globalThis.fetch;
        let seen;
        globalThis.fetch = async (url, init) => {
            seen = { url: String(url), init };
            return new Response(JSON.stringify({ id: 'drive-file-1' }), { status: 200 });
        };
        try {
            const drive = createDriveStorage({ accessToken: async () => 't', folderId: 'folder123' });
            const { key } = await drive.upload({ name: 'a.pdf', mimeType: 'application/pdf', data: PDF, properties: { gradmireDocumentId: 'd1' } });
            assert.equal(key, 'drive-file-1');
            assert.match(seen.url, /uploadType=multipart/);
            assert.match(seen.url, /supportsAllDrives=true/);
            assert.match(seen.init.headers['Content-Type'], /^multipart\/related; boundary=/);
            assert.match(seen.init.body.toString('latin1'), /"parents":\["folder123"\]/);
        } finally {
            globalThis.fetch = realFetch;
        }
    });

    test('a personal Google account works through OAuth: refresh tokens are exchanged once and cached', async () => {
        const { createGoogleUserAuth, googleAuthMode } = await import('../src/integrations/google/auth.js');
        const saved = { ...process.env };
        try {
            delete process.env.GOOGLE_OAUTH_CLIENT_ID;
            delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
            assert.equal(googleAuthMode(), null);
            Object.assign(process.env, { GOOGLE_OAUTH_CLIENT_ID: 'id', GOOGLE_OAUTH_CLIENT_SECRET: 'secret', GOOGLE_OAUTH_REFRESH_TOKEN: 'refresh' });
            assert.equal(googleAuthMode(), 'oauth');
        } finally {
            for (const key of ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REFRESH_TOKEN', 'GOOGLE_SERVICE_ACCOUNT_EMAIL']) {
                if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
            }
        }
        const realFetch = globalThis.fetch;
        const bodies = [];
        let answer = { status: 200, json: { access_token: 'at1', expires_in: 3600 } };
        globalThis.fetch = async (url, init) => {
            bodies.push(Object.fromEntries(new URLSearchParams(String(init.body))));
            return new Response(JSON.stringify(answer.json), { status: answer.status });
        };
        try {
            const token = createGoogleUserAuth({ clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh' });
            assert.equal(await token('any-scope', 'any-subject'), 'at1');
            assert.equal(await token('other-scope'), 'at1', 'cached until it nearly expires');
            assert.equal(bodies.length, 1);
            assert.deepEqual(bodies[0], { grant_type: 'refresh_token', client_id: 'id', client_secret: 'secret', refresh_token: 'refresh' });
            answer = { status: 400, json: { error: 'invalid_grant' } };
            const revoked = createGoogleUserAuth({ clientId: 'id', clientSecret: 'secret', refreshToken: 'gone' });
            await assert.rejects(revoked(), (error) => error.permanent === true, 'a revoked token is not retried forever');
        } finally {
            globalThis.fetch = realFetch;
        }
    });

    test('the development log email provider is refused in production', async () => {
        const { getEmailProvider, setEmailProvider } = await import('../src/integrations/email/index.js');
        setEmailProvider(null);
        const saved = { ...process.env };
        try {
            process.env.EMAIL_PROVIDER = 'log';
            assert.equal(getEmailProvider().name, 'log');
            process.env.NODE_ENV = 'production';
            assert.equal(getEmailProvider().name, 'disabled');
        } finally {
            process.env.NODE_ENV = saved.NODE_ENV;
            process.env.EMAIL_PROVIDER = saved.EMAIL_PROVIDER ?? '';
        }
    });
});

/* ── Documents ────────────────────────────────────────────────────────────── */

describe('documents', () => {
    test('students upload real PDFs; wrong content, wrong types and large files are refused', async () => {
        const s = await student();
        const ok = await upload(s.client, '/api/v1/me/documents?kind=transcript&filename=My%20marks.pdf', PDF, 'application/pdf');
        assert.equal(ok.status, 201, JSON.stringify(ok.body));
        assert.equal(ok.body.data.filename, 'My marks.pdf');
        assert.equal((await upload(s.client, '/api/v1/me/documents?kind=transcript&filename=x.pdf', PNG, 'application/pdf')).status, 415, 'content must match the type');
        assert.equal((await upload(s.client, '/api/v1/me/documents?kind=transcript&filename=x.exe', Buffer.from('MZ...'), 'application/x-msdownload')).status, 415);
        assert.equal((await upload(s.client, '/api/v1/me/documents?kind=transcript&filename=big.pdf', Buffer.concat([PDF, Buffer.alloc(4 * 1024 * 1024)]), 'application/pdf')).status, 413);
        assert.equal((await upload(s.client, '/api/v1/me/documents?kind=cv&filename=x.pdf', PDF, 'application/pdf')).status, 400, 'CVs go through the application');
        const list = await s.client.get('/api/v1/me/documents');
        assert.equal(list.body.data.documents.length, 1);
        assert.ok(!JSON.stringify(list.body).includes('storage'), 'storage keys never reach the browser');
        const file = await download(s.client, `/api/v1/me/documents/${ok.body.data.id}/download`);
        assert.equal(file.status, 200);
        assert.deepEqual(file.data, PDF);
        assert.match(file.headers.get('content-disposition'), /^attachment;/);
        assert.equal(file.headers.get('x-content-type-options'), 'nosniff');
    });

    test('only the owner and staff who may see the student can open a document; staff access is audited', async () => {
        const mine = await staffAgent(await createStaff({ name: 'Mine' }));
        const s = await student();
        await s.client.post('/api/v1/consultations', { ...guestBooking(), fullName: undefined, email: undefined });
        const other = await student();
        const outsider = await staffAgent(await createStaff({ name: 'Outsider' }));
        const doc = (await upload(s.client, '/api/v1/me/documents?kind=passport&filename=passport.jpg', Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(50)]), 'image/jpeg')).body.data;
        assert.equal((await download(other.client, `/api/v1/me/documents/${doc.id}/download`)).status, 404);
        assert.equal((await download(other.client, `/api/v1/admin/documents/${doc.id}/download`)).status, 403);
        assert.equal((await download(outsider.client, `/api/v1/admin/documents/${doc.id}/download`)).status, 404, 'unassigned consultant');
        const before = await auditCount('document.downloaded');
        assert.equal((await download(mine.client, `/api/v1/admin/documents/${doc.id}/download`)).status, 200);
        assert.equal(await auditCount('document.downloaded'), before + 1);
        assert.equal((await mine.client.get(`/api/v1/admin/students/${s.id}/documents`)).body.data.documents.length, 1);
        assert.equal((await outsider.client.get(`/api/v1/admin/students/${s.id}/documents`)).status, 404);
    });

    test('a staff request is fulfilled by the upload, and deleting the upload reopens it', async () => {
        const mine = await staffAgent(await createStaff());
        const s = await student();
        await s.client.post('/api/v1/consultations', { ...guestBooking(), fullName: undefined, email: undefined });
        const req = await mine.client.post(`/api/v1/admin/students/${s.id}/document-requests`, { title: 'IELTS score report', kind: 'english_test', dueDate: '2026-11-20' });
        assert.equal(req.status, 201, JSON.stringify(req.body));
        assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM notifications WHERE template = 'document_requested'")).rows[0].n, 1);
        const doc = await upload(s.client, `/api/v1/me/documents?kind=english_test&filename=ielts.pdf&request_id=${req.body.data.id}`, PDF, 'application/pdf');
        assert.equal(doc.status, 201);
        assert.equal((await db.query('SELECT status FROM document_requests WHERE id = $1', [req.body.data.id])).rows[0].status, 'fulfilled');
        assert.equal((await s.client.delete(`/api/v1/me/documents/${doc.body.data.id}`)).status, 200);
        assert.equal((await db.query('SELECT status FROM document_requests WHERE id = $1', [req.body.data.id])).rows[0].status, 'open');
        assert.equal(storage.files.size, 0, 'the stored file is removed');
    });

    test('without storage configured, uploads say so instead of failing silently', async () => {
        (await import('../src/integrations/storage/index.js')).setStorage({ name: 'none', configured: false });
        const s = await student();
        const result = await upload(s.client, '/api/v1/me/documents?kind=other&filename=a.pdf', PDF, 'application/pdf');
        assert.equal(result.status, 503);
        assert.equal(result.body.code, 'STORAGE_UNAVAILABLE');
    });
});

/* ── CV uploads ───────────────────────────────────────────────────────────── */

describe('consultant CVs', () => {
    const APPLICATION = {
        fullName: 'Ravi Kumar', phone: '+919812345678', location: 'Delhi', yearsExperience: 4, professionalExperience: 'Advising students.',
        education: 'MA', availability: 'full_time', consent: true,
    };

    test('a CV is attached to the application and visible only to hiring reviewers', async () => {
        const admin = await staffAgent(await createStaff({ role: 'admin' }));
        const consultant = await staffAgent(await createStaff());
        const s = await student();
        await s.client.post('/api/v1/consultations', { ...guestBooking(), fullName: undefined, email: undefined });
        const cv = await upload(s.client, '/api/v1/me/consultant-application-cv?filename=cv.pdf', PDF, 'application/pdf');
        assert.equal(cv.status, 201, JSON.stringify(cv.body));
        assert.equal((await upload(s.client, '/api/v1/me/consultant-application-cv?filename=cv.png', PNG, 'image/png')).status, 415, 'CVs are PDF or Word');
        const other = await student();
        assert.equal((await other.client.post('/api/v1/me/consultant-applications', { ...APPLICATION, cvDocumentId: cv.body.data.id })).status, 400, 'cannot attach someone else\'s CV');
        const app = await s.client.post('/api/v1/me/consultant-applications', { ...APPLICATION, cvDocumentId: cv.body.data.id });
        assert.equal(app.status, 201, JSON.stringify(app.body));
        assert.equal((await s.client.delete(`/api/v1/me/documents/${cv.body.data.id}`)).status, 409, 'cannot delete a CV in use');
        assert.equal((await download(admin.client, `/api/v1/admin/consultant-applications/${app.body.data.id}/cv`)).status, 200);
        assert.equal((await download(consultant.client, `/api/v1/admin/consultant-applications/${app.body.data.id}/cv`)).status, 403);
        assert.equal((await download(consultant.client, `/api/v1/admin/documents/${cv.body.data.id}/download`)).status, 404, 'even the applicant\'s own consultant cannot open hiring documents');
        assert.equal((await consultant.client.get(`/api/v1/admin/students/${s.id}/documents`)).body.data.documents.length, 0);
    });
});

/* ── Interviews with Google Meet ──────────────────────────────────────────── */

describe('consultant interviews', () => {
    test('scheduling creates a Meet event and tells the applicant; rescheduling replaces it; rejection removes it', async () => {
        const calendar = fakeCalendar();
        await useProviders({ calendar });
        const reviewer = await staffAgent(await createStaff({ role: 'admin', calendarId: 'reviewer@gradmire.test' }));
        const s = await student();
        const id = (await s.client.post('/api/v1/me/consultant-applications', {
            fullName: 'Ravi', phone: '+919812345678', location: 'Delhi', yearsExperience: 2, professionalExperience: 'x', education: 'y', availability: 'part_time', consent: true,
        })).body.data.id;
        for (const status of ['under_review', 'shortlisted']) await reviewer.client.post(`/api/v1/admin/consultant-applications/${id}/transition`, { status });
        const scheduled = await reviewer.client.post(`/api/v1/admin/consultant-applications/${id}/transition`, { status: 'interview_scheduled', interviewAt: '2026-11-10T06:00:00Z' });
        assert.equal(scheduled.status, 200, JSON.stringify(scheduled.body));
        assert.equal(scheduled.body.data.interviewMeeting.status, 'synced');
        assert.ok(scheduled.body.data.interviewMeeting.meetUrl.startsWith('https://meet.google.com/'));
        assert.equal(calendar.events.size, 1);
        const event = [...calendar.events.values()][0];
        assert.equal(event.calendarId, 'reviewer@gradmire.test');
        assert.equal(event.withMeet, true);
        assert.equal(event.attendeeEmail, s.email);
        const mine = (await s.client.get(`/api/v1/me/consultant-applications/${id}`)).body.data;
        assert.equal(mine.interviewMeetUrl, scheduled.body.data.interviewMeeting.meetUrl);
        const told = (await db.query("SELECT payload FROM notifications WHERE template = 'consultant_application_update' AND recipient = $1 ORDER BY created_at DESC LIMIT 1", [s.email])).rows[0];
        assert.match(told.payload.message, /meet\.google\.com/);

        await reviewer.client.post(`/api/v1/admin/consultant-applications/${id}/transition`, { status: 'interview_scheduled', interviewAt: '2026-11-11T06:00:00Z' });
        assert.equal(calendar.events.size, 1, 'the old event is replaced');
        assert.ok([...calendar.events.keys()][0].endsWith('g2'));
        await reviewer.client.post(`/api/v1/admin/consultant-applications/${id}/transition`, { status: 'rejected' });
        assert.equal(calendar.events.size, 0);
        assert.equal((await s.client.get(`/api/v1/me/consultant-applications/${id}`)).body.data.interviewMeetUrl, null);
    });

    test('a calendar failure does not block the decision and can be retried', async () => {
        const calendar = fakeCalendar();
        calendar.failures = 1;
        await useProviders({ calendar });
        const reviewer = await staffAgent(await createStaff({ role: 'admin', calendarId: 'reviewer2@gradmire.test' }));
        const s = await student();
        const id = (await s.client.post('/api/v1/me/consultant-applications', {
            fullName: 'Ravi', phone: '+919812345678', location: 'Delhi', yearsExperience: 2, professionalExperience: 'x', education: 'y', availability: 'part_time', consent: true,
        })).body.data.id;
        for (const status of ['under_review', 'shortlisted']) await reviewer.client.post(`/api/v1/admin/consultant-applications/${id}/transition`, { status });
        const scheduled = await reviewer.client.post(`/api/v1/admin/consultant-applications/${id}/transition`, { status: 'interview_scheduled', interviewAt: '2026-11-10T06:00:00Z' });
        assert.equal(scheduled.body.data.status, 'interview_scheduled');
        assert.equal(scheduled.body.data.interviewMeeting.status, 'failed');
        const retried = await reviewer.client.post(`/api/v1/admin/consultant-applications/${id}/interview-meeting`, {});
        assert.equal(retried.body.data.interviewMeeting.status, 'synced');
        assert.ok(retried.body.data.interviewMeeting.meetUrl);
    });
});

/* ── Staff email (Gmail) ──────────────────────────────────────────────────── */

describe('staff email', () => {
    test('consultants see only threads with their student and can reply in the thread; every send is recorded', async () => {
        const mine = await staffAgent(await createStaff({ name: 'Mine' }));
        const s = await student();
        await s.client.post('/api/v1/consultations', { ...guestBooking(), fullName: undefined, email: undefined });
        gmail.mailbox.threads = [
            { id: 'aaa111', messages: [{ id: '1', from: `Ravi <${s.email}>`, to: 'counselling@gradmire.test', subject: 'Visa question', messageId: '<q1@example.com>', references: '', text: 'Hi' }] },
            { id: 'bbb222', messages: [{ id: '2', from: 'someone@else.com', to: 'counselling@gradmire.test', subject: 'Private', messageId: '<p@x>', references: '', text: 'secret' }] },
        ];
        const list = await mine.client.get(`/api/v1/admin/students/${s.id}/emails`);
        assert.equal(list.status, 200, JSON.stringify(list.body));
        assert.deepEqual(list.body.data.threads.map((t) => t.id), ['aaa111'], 'unrelated mail is filtered out');
        assert.equal((await mine.client.get(`/api/v1/admin/students/${s.id}/emails/bbb222`)).status, 404, 'a thread id cannot open unrelated mail');
        assert.equal((await mine.client.get(`/api/v1/admin/students/${s.id}/emails/aaa111`)).status, 200);

        const reply = await mine.client.post(`/api/v1/admin/students/${s.id}/emails`, { body: 'Here is the checklist.', threadId: 'aaa111' });
        assert.equal(reply.status, 201, JSON.stringify(reply.body));
        const sent = gmail.sender.sent.at(-1);
        assert.equal(sent.to, s.email);
        assert.equal(sent.subject, 'Re: Visa question');
        assert.equal(sent.inReplyTo, '<q1@example.com>');
        assert.equal(sent.threadId, 'aaa111', 'same mailbox, so the Gmail thread is kept');
        assert.match(sent.text, /— Test Counsellor, Gradmire|— Mine, Gradmire/);
        assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM staff_emails WHERE status = 'sent' AND student_user_id = $1", [s.id])).rows[0].n, 1);

        const outsider = await staffAgent(await createStaff({ name: 'Outsider' }));
        assert.equal((await outsider.client.get(`/api/v1/admin/students/${s.id}/emails`)).status, 404);
        assert.equal((await outsider.client.post(`/api/v1/admin/students/${s.id}/emails`, { subject: 'x', body: 'y' })).status, 404);
        assert.equal((await s.client.get(`/api/v1/admin/students/${s.id}/emails`)).status, 403);
    });

    test('emailing an enquiry marks it contacted; a Gmail failure is recorded and reported, not hidden', async () => {
        const admin = await staffAgent(await createStaff({ role: 'admin' }));
        const lead = (await request('POST', '/api/v1/leads', { body: { source: 'contact', firstName: 'Lena', email: 'lena@example.com', message: 'hi' } })).body.data.id;
        const sent = await admin.client.post(`/api/v1/admin/leads/${lead}/emails`, { subject: 'Your enquiry', body: 'Happy to help.' });
        assert.equal(sent.status, 201, JSON.stringify(sent.body));
        const row = (await db.query('SELECT status, last_contacted_at FROM leads WHERE id = $1', [lead])).rows[0];
        assert.equal(row.status, 'contacted');
        assert.ok(row.last_contacted_at);
        gmail.sender.send = async () => { throw new Error('Gmail unavailable'); };
        const failed = await admin.client.post(`/api/v1/admin/leads/${lead}/emails`, { subject: 'Again', body: 'x' });
        assert.equal(failed.status, 502);
        assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM staff_emails WHERE status = 'failed' AND lead_id = $1", [lead])).rows[0].n, 1);
        (await import('../src/integrations/email/index.js')).setGmailSender(null);
        assert.equal((await admin.client.post(`/api/v1/admin/leads/${lead}/emails`, { subject: 'x', body: 'y' })).status, 503);
    });
});

/* ── Email change ─────────────────────────────────────────────────────────── */

describe('login email change', () => {
    test('needs the password and a confirmation from the new address; ends sessions and links guest records', async () => {
        await createStaff();
        const s = await student();
        assert.equal((await s.client.post('/api/v1/me/email-change', { newEmail: 'new.addr@example.com', password: 'wrong-password' })).status, 403);
        const guest = await request('POST', '/api/v1/consultations', { body: guestBooking({ email: 'new.addr@example.com' }) });
        assert.equal(guest.status, 201);
        const asked = await s.client.post('/api/v1/me/email-change', { newEmail: 'new.addr@example.com', password: s.password });
        assert.equal(asked.status, 200, JSON.stringify(asked.body));
        const templates = (await db.query("SELECT template, recipient FROM notifications WHERE template LIKE 'email_change%' ORDER BY template")).rows;
        assert.deepEqual(templates.map((t) => [t.template, t.recipient]), [['email_change_confirm', 'new.addr@example.com'], ['email_change_notice', s.email]]);
        assert.equal((await db.query('SELECT email FROM users WHERE id = $1', [s.id])).rows[0].email, s.email, 'nothing changes before confirmation');

        const { emailChangeToken } = await import('../src/services/auth-service.js');
        const changeId = (await db.query('SELECT id FROM email_change_requests WHERE user_id = $1', [s.id])).rows[0].id;
        const confirmed = await request('POST', '/api/v1/auth/email-change/confirm', { body: { token: emailChangeToken(changeId) } });
        assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
        assert.equal(confirmed.body.data.linkedConsultations, 1);
        assert.equal((await db.query('SELECT email FROM users WHERE id = $1', [s.id])).rows[0].email, 'new.addr@example.com');
        assert.equal((await s.client.get('/api/v1/me/dashboard')).status, 401, 'signed out everywhere');
        assert.equal((await request('POST', '/api/v1/auth/email-change/confirm', { body: { token: emailChangeToken(changeId) } })).status, 400, 'single use');
        const relogin = agent();
        await relogin.login('new.addr@example.com', s.password);
        assert.equal((await relogin.get('/api/v1/me/consultations')).body.data.length, 1);
    });

    test('an address used by another account is refused; Google-only accounts are told why', async () => {
        const a = await student();
        const b = await student();
        assert.equal((await a.client.post('/api/v1/me/email-change', { newEmail: b.email, password: a.password })).status, 409);
        const { requestEmailChange } = await import('../src/services/auth-service.js');
        await assert.rejects(requestEmailChange({ id: a.id, email: a.email, password_hash: null }, { newEmail: 'z@example.com', password: '' }), (error) => error.code === 'GOOGLE_ACCOUNT');
    });
});

/* ── Follow-up reminders ──────────────────────────────────────────────────── */

describe('follow-up reminders', () => {
    test('a task due soon is reminded once; moving the due time reminds again', async () => {
        const mine = await staffAgent(await createStaff());
        const task = await mine.client.post('/api/v1/consultant/follow-ups', { title: 'Call Asha', dueAt: new Date(BASE_NOW.getTime() + 30 * 60_000).toISOString() });
        assert.equal(task.status, 201);
        await runJobs();
        await runJobs();
        const count = async () => (await db.query("SELECT COUNT(*)::int AS n FROM notifications WHERE template = 'follow_up_reminder' AND recipient = $1", [mine.email])).rows[0].n;
        assert.equal(await count(), 1);
        await mine.client.patch(`/api/v1/consultant/follow-ups/${task.body.data.id}`, { dueAt: new Date(BASE_NOW.getTime() + 50 * 60_000).toISOString() });
        await runJobs();
        assert.equal(await count(), 2);
        const later = await mine.client.post('/api/v1/consultant/follow-ups', { title: 'Next week', dueAt: new Date(BASE_NOW.getTime() + 7 * 86_400_000).toISOString() });
        assert.equal(later.status, 201);
        await runJobs();
        assert.equal(await count(), 2, 'not yet due');
    });
});

/* ── Integration status ───────────────────────────────────────────────────── */

describe('integration status', () => {
    test('admins see which Google services are connected, never credentials', async () => {
        const admin = await staffAgent(await createStaff({ role: 'admin' }));
        const consultant = await staffAgent(await createStaff());
        const status = await admin.client.get('/api/v1/admin/integrations');
        assert.equal(status.status, 200);
        assert.equal(status.body.data.storage.configured, true);
        assert.equal(status.body.data.gmail.inbox, 'counselling@gradmire.test');
        assert.ok(!/PRIVATE KEY|secret|token/i.test(JSON.stringify(status.body)));
        assert.equal((await consultant.client.get('/api/v1/admin/integrations')).status, 403);
    });
});
