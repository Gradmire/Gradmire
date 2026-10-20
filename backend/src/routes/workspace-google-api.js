/* Routes for the Google Workspace features: documents (Google Drive), the
   staff inbox and outgoing email (Gmail), consultant interview meetings
   (Calendar + Meet), login email changes and the integration status panel.
   Same conventions as platform-api.js: validate, check permissions on the
   server, call services. Uploads are raw bodies; downloads stream through here
   so every access is checked (files are never shared by link). */
import { getCalendarProvider } from '../integrations/calendar/index.js';
import { getEmailProvider, getGmailSender, getMailbox } from '../integrations/email/index.js';
import { googleAuthMode } from '../integrations/google/auth.js';
import { getStorage } from '../integrations/storage/index.js';
import { createRouter, notFound, readRawBody, sendError, sendFile, sendJson } from '../lib/http.js';
import { query } from '../lib/db.js';
import { createValidator, isUuid } from '../lib/validate.js';
import { confirmEmailChange, requestEmailChange } from '../services/auth-service.js';
import * as applications from '../services/consultant-application-service.js';
import * as documents from '../services/document-service.js';
import { enforceRateLimit } from '../services/rate-limit.js';
import * as staffEmail from '../services/staff-email-service.js';
import { checkCsrf, checkOrigin, createContext, requirePermission, requireUser } from './context.js';

const router = createRouter();
const ok = (ctx, data, status = 200) => sendJson(ctx.response, status, { data });
const param = (ctx, name = 'id') => {
    const value = ctx.params[name];
    if (!isUuid(value)) throw notFound('Not found');
    return value.toLowerCase();
};
/* Gmail thread ids are hexadecimal. */
const threadParam = (ctx) => {
    const value = ctx.params.threadId;
    if (!/^[0-9a-f]{6,32}$/i.test(value || '')) throw notFound('Email thread not found');
    return value;
};

/* Upload metadata travels in the query string; the body is the file itself. */
async function fileFrom(ctx) {
    const data = await readRawBody(ctx.request, documents.MAX_BYTES);
    const mimeType = String(ctx.request.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    const { filename } = createValidator({ filename: ctx.query.get('filename') }).text('filename', { required: true, max: 200, label: 'File name' }).done();
    return { data, mimeType, filename };
}

/* ── Student documents ────────────────────────────────────────────────────── */

router.get('/api/v1/me/documents', async (ctx) => ok(ctx, await documents.listMine(await requirePermission(ctx, 'self.documents'))));

router.post('/api/v1/me/documents', async (ctx) => {
    const user = await requirePermission(ctx, 'self.documents');
    await enforceRateLimit('upload', user.id);
    const meta = createValidator(Object.fromEntries(ctx.query))
        .oneOf('kind', documents.STUDENT_KINDS, { required: true, label: 'Document type' })
        .uuid('request_id', { label: 'Document request' })
        .done();
    const file = await fileFrom(ctx);
    return ok(ctx, await documents.uploadMine(user, { ...file, kind: meta.kind, requestId: meta.request_id || null }), 201);
});

router.get('/api/v1/me/documents/:id/download', async (ctx) => {
    const user = await requirePermission(ctx, 'self.documents');
    sendFile(ctx.response, await documents.downloadForOwner(user, param(ctx)));
});

router.delete('/api/v1/me/documents/:id', async (ctx) => {
    const user = await requirePermission(ctx, 'self.documents');
    return ok(ctx, await documents.removeMine(user, param(ctx)));
});

/* CV for a consultant application: uploaded first, then referenced as cvDocumentId. */
router.post('/api/v1/me/consultant-application-cv', async (ctx) => {
    const user = await requirePermission(ctx, 'consultant_application.apply');
    await enforceRateLimit('upload', user.id);
    return ok(ctx, await documents.uploadCv(user, await fileFrom(ctx)), 201);
});

router.get('/api/v1/me/consultant-application-cv/:id', async (ctx) => {
    const user = await requirePermission(ctx, 'consultant_application.apply');
    sendFile(ctx.response, await documents.downloadForOwner(user, param(ctx)));
});

/* ── Staff: documents ─────────────────────────────────────────────────────── */

router.get('/api/v1/admin/students/:id/documents', async (ctx) => ok(ctx, await documents.listForStudent(await requirePermission(ctx, 'documents.assigned'), param(ctx))));

router.post('/api/v1/admin/students/:id/document-requests', async (ctx) => {
    const staff = await requirePermission(ctx, 'documents.assigned');
    const body = await ctx.body();
    const v = createValidator(body)
        .text('title', { required: true, max: 200, label: 'What to upload' })
        .text('details', { max: 1000, label: 'Details' })
        .oneOf('kind', documents.STUDENT_KINDS, { label: 'Document type' });
    if (body.dueDate) v.check(/^\d{4}-\d{2}-\d{2}$/.test(String(body.dueDate)), 'dueDate', 'Due date must be YYYY-MM-DD');
    return ok(ctx, await documents.requestDocument(staff, param(ctx), { ...v.done(), dueDate: body.dueDate || null }), 201);
});

router.post('/api/v1/admin/document-requests/:id/cancel', async (ctx) => ok(ctx, await documents.cancelRequest(await requirePermission(ctx, 'documents.assigned'), param(ctx))));

router.get('/api/v1/admin/documents/:id/download', async (ctx) => {
    const staff = await requirePermission(ctx, 'documents.assigned');
    sendFile(ctx.response, await documents.downloadForStaff(staff, param(ctx)));
});

router.get('/api/v1/admin/consultant-applications/:id/cv', async (ctx) => {
    const staff = await requirePermission(ctx, 'consultant_application.review');
    const row = (await query('SELECT cv_document_id FROM consultant_applications WHERE id = $1', [param(ctx)])).rows[0];
    if (!row?.cv_document_id) throw notFound('This application has no uploaded CV.');
    sendFile(ctx.response, await documents.downloadForStaff(staff, row.cv_document_id));
});

router.post('/api/v1/admin/consultant-applications/:id/interview-meeting', async (ctx) => {
    const reviewer = await requirePermission(ctx, 'consultant_application.decide');
    return ok(ctx, await applications.retryInterviewMeeting(reviewer, param(ctx)));
});

/* ── Staff: email (Gmail) ─────────────────────────────────────────────────── */

const emailBody = async (ctx) => {
    const body = await ctx.body();
    const v = createValidator(body)
        .text('subject', { required: !body.threadId, max: 200, label: 'Subject' })
        .text('body', { required: true, max: 8000, label: 'Message' });
    v.check(body.threadId === undefined || body.threadId === null || /^[0-9a-f]{6,32}$/i.test(String(body.threadId)), 'threadId', 'Not a valid thread');
    const input = v.done();
    return { subject: input.subject || '', body: input.body, threadId: body.threadId || null };
};

for (const [segment, type, permission] of [['students', 'student', 'students.assigned'], ['leads', 'lead', 'leads.assigned']]) {
    router.get(`/api/v1/admin/${segment}/:id/emails`, async (ctx) => {
        await requirePermission(ctx, permission);
        const staff = await requirePermission(ctx, 'email.assigned');
        return ok(ctx, await staffEmail.listThreads(staff, { type, id: param(ctx) }));
    });
    router.get(`/api/v1/admin/${segment}/:id/emails/:threadId`, async (ctx) => {
        const staff = await requirePermission(ctx, 'email.assigned');
        return ok(ctx, await staffEmail.getThread(staff, { type, id: param(ctx) }, threadParam(ctx)));
    });
    router.post(`/api/v1/admin/${segment}/:id/emails`, async (ctx) => {
        const staff = await requirePermission(ctx, 'email.assigned');
        await enforceRateLimit('staffEmail', staff.id);
        return ok(ctx, await staffEmail.send(staff, { type, id: param(ctx) }, await emailBody(ctx)), 201);
    });
}

/* ── Login email change (any signed-in user) ──────────────────────────────── */

router.post('/api/v1/me/email-change', async (ctx) => {
    const user = await requireUser(ctx);
    await enforceRateLimit('verifyEmail', user.id);
    const body = await ctx.body();
    const { newEmail } = createValidator(body).email('newEmail', { label: 'New email address' }).done();
    return ok(ctx, await requestEmailChange(user, { newEmail, password: typeof body.password === 'string' ? body.password : '' }));
});

router.post('/api/v1/auth/email-change/confirm', async (ctx) => {
    await enforceRateLimit('verifyEmail', ctx.ip);
    const { token } = createValidator(await ctx.body()).text('token', { required: true, max: 100 }).done();
    return ok(ctx, await confirmEmailChange(token));
});

/* ── Admin: which Google services are connected ───────────────────────────── */

router.get('/api/v1/admin/integrations', async (ctx) => {
    await requirePermission(ctx, 'integrations.view');
    const email = getEmailProvider();
    const sender = getGmailSender();
    const mailbox = getMailbox();
    const storage = getStorage();
    const calendar = getCalendarProvider();
    const counsellors = (await query("SELECT COUNT(*) FILTER (WHERE is_active)::int AS active, COUNT(*) FILTER (WHERE is_active AND calendar_id IS NOT NULL)::int AS with_calendar FROM counsellors")).rows[0];
    // Names and booleans only: never keys, tokens or mailbox contents.
    return ok(ctx, {
        google: { mode: googleAuthMode() },
        email: { provider: email.name, sending: email.configured },
        gmail: { sender: sender ? sender.sender : null, inbox: mailbox ? mailbox.mailbox : null },
        storage: { provider: storage.name, configured: storage.configured },
        calendar: { provider: calendar.name, configured: calendar.configured, meetLinks: calendar.configured && process.env.GOOGLE_CALENDAR_CREATE_MEET === 'true', consultantsWithCalendar: counsellors.with_calendar, activeConsultants: counsellors.active },
        interviews: { calendarId: Boolean(process.env.GOOGLE_INTERVIEW_CALENDAR_ID) },
    });
});

/* ── Dispatcher ───────────────────────────────────────────────────────────── */

export async function workspaceGoogleApiRoute(request, response, pathname) {
    const match = router.match(request.method, pathname);
    if (!match) return false;
    if (match.methodNotAllowed) {
        sendJson(response, 405, { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
        return true;
    }
    const ctx = createContext(request, response, new URL(request.url, 'http://localhost'), match.params);
    try {
        checkOrigin(ctx);
        await checkCsrf(ctx);
        await match.handler(ctx);
    } catch (error) {
        sendError(response, error);
    }
    return true;
}
