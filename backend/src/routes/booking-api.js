/* Routes for accounts, consultation booking, the student area, the staff CRM
   and background jobs. Handlers only parse and validate input, apply guards and
   call services; business rules live in src/services/. */
import { config } from '../config.js';
import { safeEqual } from '../lib/crypto.js';
import { badRequest, createRouter, HttpError, notFound, sendError, sendJson } from '../lib/http.js';
import { parseDateOnly, parseTimeOfDay } from '../lib/time.js';
import { createValidator, isUuid } from '../lib/validate.js';
import * as admin from '../services/admin-service.js';
import * as applications from '../services/application-service.js';
import * as auth from '../services/auth-service.js';
import * as booking from '../services/booking-service.js';
import { runDueJobs } from '../services/jobs.js';
import { retryNotification } from '../services/notification-service.js';
import { enforceRateLimit } from '../services/rate-limit.js';
import { checkCsrf, checkOrigin, createContext, requireAdmin, requireStaff, requireStudent, requireUser } from './context.js';

const router = createRouter();
const STATUSES = ['reserved', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled'];
const METHODS = ['video', 'phone', 'in_person'];
const OUTCOMES = ['qualified', 'follow_up', 'not_interested', 'application_started', 'other'];

const ok = (ctx, data, status = 200, headers = {}) => sendJson(ctx.response, status, { data }, headers);
const param = (ctx, name = 'id') => {
    const value = ctx.params[name];
    if (!isUuid(value)) throw notFound('Not found');
    return value.toLowerCase();
};

/* ── Auth ─────────────────────────────────────────────────────────────────── */

router.get('/api/v1/auth/session', async (ctx) => {
    const current = await ctx.session();
    if (!current) return ok(ctx, { user: null, csrfToken: null });
    // A fresh CSRF token each time the page asks; earlier ones stop working.
    const csrfToken = await auth.rotateCsrf(current.session.id);
    return ok(ctx, { user: auth.publicUser(current.user), csrfToken });
});

router.post('/api/v1/auth/signup', async (ctx) => {
    await enforceRateLimit('signup', ctx.ip);
    const input = createValidator(await ctx.body())
        .text('firstName', { required: true, max: 120, label: 'First name' })
        .text('lastName', { max: 120, label: 'Last name' })
        .email('email')
        .phone('phone', { required: false })
        .password('password')
        .boolean('ageConfirmation', { mustBeTrue: true, message: 'Please confirm your age, or ask a parent or guardian to sign up with you.' })
        .done();
    const result = await auth.signUp(input, { userAgent: ctx.userAgent });
    return ok(ctx, { user: result.user, csrfToken: result.csrfToken }, 201, { 'Set-Cookie': result.cookie });
});

router.post('/api/v1/auth/login', async (ctx) => {
    const body = await ctx.body();
    const input = createValidator(body).email('email').text('password', { required: true, max: 200, label: 'Password' }).done();
    await enforceRateLimit('login', `${ctx.ip}:${input.email}`);
    // The raw (untrimmed) password is what was typed.
    const result = await auth.logIn({ email: input.email, password: String(body.password) }, { userAgent: ctx.userAgent });
    return ok(ctx, { user: result.user, csrfToken: result.csrfToken }, 200, { 'Set-Cookie': result.cookie });
});

router.post('/api/v1/auth/logout', async (ctx) => {
    const current = await ctx.session();
    if (current) await auth.logOut(current.session.id);
    return ok(ctx, { loggedOut: true }, 200, { 'Set-Cookie': auth.clearSessionCookie() });
});

router.post('/api/v1/auth/verify-email/request', async (ctx) => {
    const user = await requireUser(ctx);
    await enforceRateLimit('verifyEmail', user.id);
    return ok(ctx, await auth.requestVerification(user));
});

router.post('/api/v1/auth/verify-email/confirm', async (ctx) => {
    await enforceRateLimit('verifyEmail', ctx.ip);
    const { token } = createValidator(await ctx.body()).text('token', { required: true, max: 100 }).done();
    return ok(ctx, await auth.confirmVerification(token));
});

/* ── Public booking ───────────────────────────────────────────────────────── */

router.get('/api/v1/consultation-types', async (ctx) => ok(ctx, await booking.listActiveTypes(), 200, { 'Cache-Control': 'public, max-age=60' }));

router.get('/api/v1/availability', async (ctx) => {
    await enforceRateLimit('availability', ctx.ip);
    const q = Object.fromEntries(ctx.query);
    const v = createValidator(q).uuid('consultation_type_id', { required: true, label: 'Consultation type' }).timeZone('timezone').uuid('counsellor_id');
    const date = parseDateOnly(q.date);
    v.check(Boolean(date), 'date', 'date must be YYYY-MM-DD');
    const input = v.done();
    return ok(ctx, await booking.getAvailability({ consultationTypeId: input.consultation_type_id, date, timezone: input.timezone, counsellorId: input.counsellor_id || null }));
});

function validateBooking(body, { signedIn }) {
    const v = createValidator(body)
        .uuid('consultationTypeId', { required: true, label: 'Consultation type' })
        .oneOf('meetingMethod', METHODS, { required: true, label: 'Meeting method' })
        .instant('start', { label: 'Start time' })
        .timeZone('timezone')
        .text('fullName', { required: !signedIn, max: 240, min: 2, label: 'Full name' })
        .email('email', { required: !signedIn })
        .phone('phone', { required: !signedIn })
        .text('destination', { max: 80, label: 'Preferred destination' })
        .text('degree', { max: 80, label: 'Intended degree' })
        .text('course', { max: 200, label: 'Preferred course' })
        .text('intake', { max: 40, label: 'Intended intake' })
        .text('academicSummary', { max: 500, label: 'Academic information' })
        .text('message', { max: 2000, label: 'Message' })
        .boolean('contactConsent', { mustBeTrue: true, message: 'Please agree to be contacted about this consultation.' })
        .boolean('remindersOptIn', { defaultValue: true })
        .boolean('marketingOptIn');
    // Honeypot: real visitors never see or fill this field.
    v.check(!body.website, 'website', 'Request rejected');
    return v.done();
}

router.post('/api/v1/consultations', async (ctx) => {
    await enforceRateLimit('booking', ctx.ip);
    const current = await ctx.session();
    const signedIn = current?.user.role === 'student';
    const input = validateBooking(await ctx.body(), { signedIn });
    const header = ctx.request.headers['idempotency-key'];
    const key = typeof header === 'string' ? header.trim() : '';
    if (key && !/^[A-Za-z0-9_-]{8,100}$/.test(key)) throw badRequest('Idempotency-Key must be 8–100 letters, digits, - or _');
    const result = await booking.createBooking(input, { user: current?.user || null, idempotencyKey: key || null });
    return ok(ctx, result, result.replayed ? 200 : 201, result.replayed ? { 'Idempotent-Replayed': 'true' } : {});
});

/* Guests manage a booking with the token from their confirmation link. The
   token travels in the body, never in a URL, so it stays out of logs. */
const manageToken = async (ctx) => {
    await enforceRateLimit('bookingManage', ctx.ip);
    const body = await ctx.body();
    const { token } = createValidator(body).text('token', { required: true, max: 100 }).done();
    return { token, body };
};

router.post('/api/v1/consultations/manage/lookup', async (ctx) => {
    const { token } = await manageToken(ctx);
    return ok(ctx, await booking.getByManageToken(token));
});

router.post('/api/v1/consultations/manage/cancel', async (ctx) => {
    const { token, body } = await manageToken(ctx);
    const { reason } = createValidator(body).text('reason', { max: 500 }).done();
    return ok(ctx, await booking.cancelConsultation({ scope: { manageToken: token }, reason }));
});

router.post('/api/v1/consultations/manage/reschedule', async (ctx) => {
    const { token, body } = await manageToken(ctx);
    const input = createValidator(body).instant('start').timeZone('timezone', { required: false }).done();
    return ok(ctx, await booking.rescheduleConsultation({ scope: { manageToken: token }, start: input.start, timezone: input.timezone }));
});

/* ── Student area ─────────────────────────────────────────────────────────── */

router.get('/api/v1/me/consultations', async (ctx) => {
    const user = await requireStudent(ctx);
    return ok(ctx, await booking.listStudentConsultations(user.id));
});

router.post('/api/v1/me/consultations/claim', async (ctx) => {
    const user = await requireStudent(ctx);
    const { token } = createValidator(await ctx.body()).text('token', { required: true, max: 100 }).done();
    return ok(ctx, await booking.claimConsultation(user, token));
});

router.get('/api/v1/me/consultations/:id', async (ctx) => {
    const user = await requireStudent(ctx);
    return ok(ctx, await booking.getStudentConsultation(user.id, param(ctx)));
});

router.post('/api/v1/me/consultations/:id/cancel', async (ctx) => {
    const user = await requireStudent(ctx);
    const { reason } = createValidator(await ctx.body()).text('reason', { max: 500 }).done();
    return ok(ctx, await booking.cancelConsultation({ id: param(ctx), scope: { studentUserId: user.id }, userId: user.id, reason }));
});

router.post('/api/v1/me/consultations/:id/reschedule', async (ctx) => {
    const user = await requireStudent(ctx);
    const input = createValidator(await ctx.body()).instant('start').timeZone('timezone', { required: false }).done();
    return ok(ctx, await booking.rescheduleConsultation({ id: param(ctx), scope: { studentUserId: user.id }, userId: user.id, start: input.start, timezone: input.timezone }));
});

router.get('/api/v1/me/applications', async (ctx) => {
    const user = await requireStudent(ctx);
    return ok(ctx, await applications.listForStudent(user.id));
});

/* ── Student applications (staff) ─────────────────────────────────────────── */

const CLEARABLE = ['country', 'intake', 'deadline', 'studentNote'];

function applicationInput(body, { partial }) {
    const v = createValidator(body)
        .text('university', { required: !partial, max: 200, label: 'University' })
        .text('course', { required: !partial, max: 200, label: 'Course' })
        .text('country', { max: 80, label: 'Country' })
        .text('intake', { max: 40, label: 'Intake' })
        .oneOf('status', applications.APPLICATION_STATUSES, { label: 'Status' })
        .text('studentNote', { max: 1000, label: 'Note for the student' });
    if (body?.deadline) v.check(Boolean(parseDateOnly(body.deadline)), 'deadline', 'Deadline must be a date (YYYY-MM-DD)');
    const input = v.done();
    if (body?.deadline && parseDateOnly(body.deadline)) input.deadline = String(body.deadline);
    // On updates, an empty value clears an optional field.
    if (partial) for (const key of CLEARABLE) if (body?.[key] === '' || body?.[key] === null) input[key] = '';
    return input;
}

router.get('/api/v1/admin/students', async (ctx) => {
    const staff = await requireStaff(ctx);
    const { q } = createValidator(Object.fromEntries(ctx.query)).text('q', { max: 100 }).done();
    return ok(ctx, await applications.searchStudents(staff, q));
});

router.get('/api/v1/admin/students/:id/applications', async (ctx) => {
    const staff = await requireStaff(ctx);
    return ok(ctx, await applications.listForStaff(staff, param(ctx)));
});

router.post('/api/v1/admin/students/:id/applications', async (ctx) => {
    const staff = await requireStaff(ctx);
    return ok(ctx, await applications.create(staff, param(ctx), applicationInput(await ctx.body(), { partial: false })), 201);
});

router.patch('/api/v1/admin/applications/:id', async (ctx) => {
    const staff = await requireStaff(ctx);
    return ok(ctx, await applications.update(staff, param(ctx), applicationInput(await ctx.body(), { partial: true })));
});

router.delete('/api/v1/admin/applications/:id', async (ctx) => {
    const staff = await requireStaff(ctx);
    return ok(ctx, await applications.remove(staff, param(ctx)));
});

/* ── Staff CRM ────────────────────────────────────────────────────────────── */

function pageParams(q, maxSize = 100) {
    const page = Math.max(1, Number.parseInt(q.get('page') || '1', 10) || 1);
    const pageSize = Math.min(maxSize, Math.max(1, Number.parseInt(q.get('page_size') || '25', 10) || 25));
    return { page, pageSize };
}

router.get('/api/v1/admin/consultations', async (ctx) => {
    const staff = await requireStaff(ctx);
    const q = ctx.query;
    const v = createValidator(Object.fromEntries(q))
        .oneOf('status', STATUSES, { label: 'status' })
        .oneOf('calendar_status', ['not_required', 'pending', 'synced', 'failed'], { label: 'calendar_status' })
        .uuid('consultation_type_id').uuid('counsellor_id')
        .instant('from', { required: false, label: 'from' }).instant('to', { required: false, label: 'to' })
        .text('q', { max: 100 })
        .oneOf('sort', ['asc', 'desc']);
    const input = v.done();
    return ok(ctx, await admin.listConsultations(staff, {
        ...pageParams(q), status: input.status, calendarStatus: input.calendar_status, consultationTypeId: input.consultation_type_id,
        counsellorId: input.counsellor_id, from: input.from, to: input.to, q: input.q, sort: input.sort,
    }));
});

router.get('/api/v1/admin/consultations/summary', async (ctx) => {
    const staff = await requireStaff(ctx);
    const { timezone } = createValidator(Object.fromEntries(ctx.query)).timeZone('timezone', { required: false }).done();
    return ok(ctx, await admin.summary(staff, timezone || 'Asia/Kolkata'));
});

router.get('/api/v1/admin/consultations/:id', async (ctx) => {
    const staff = await requireStaff(ctx);
    return ok(ctx, await admin.getConsultationDetail(staff, param(ctx)));
});

router.patch('/api/v1/admin/consultations/:id', async (ctx) => {
    const staff = await requireStaff(ctx);
    const body = await ctx.body();
    const v = createValidator(body)
        .oneOf('status', ['confirmed', 'completed', 'no_show', 'cancelled'], { label: 'status' })
        .uuid('counsellorId', { label: 'Counsellor' })
        .text('cancellationReason', { max: 500 });
    if (body.outcome !== undefined) v.check(body.outcome === null || OUTCOMES.includes(body.outcome), 'outcome', 'outcome is not a valid option');
    if (body.meetingUrl !== undefined && body.meetingUrl !== null) {
        let valid = false;
        try {
            valid = typeof body.meetingUrl === 'string' && body.meetingUrl.length <= 500 && new URL(body.meetingUrl).protocol === 'https:';
        } catch { /* invalid URL */ }
        v.check(valid, 'meetingUrl', 'Meeting link must be an https:// URL');
    }
    // Any other field (e.g. studentUserId, role, price) is ignored, never written.
    const input = v.done();
    return ok(ctx, await admin.updateConsultation(staff, param(ctx), {
        ...input,
        ...(body.outcome !== undefined ? { outcome: body.outcome } : {}),
        ...(body.meetingUrl !== undefined ? { meetingUrl: body.meetingUrl || null } : {}),
    }));
});

router.post('/api/v1/admin/consultations/:id/notes', async (ctx) => {
    const staff = await requireStaff(ctx);
    const input = createValidator(await ctx.body())
        .oneOf('kind', ['note', 'outcome', 'follow_up'], { required: true, label: 'kind' })
        .text('body', { required: true, max: 4000, label: 'Note' })
        .instant('dueAt', { required: false, label: 'Due date' })
        .done();
    return ok(ctx, await admin.addNote(staff, param(ctx), input), 201);
});

router.post('/api/v1/admin/consultations/:id/notes/:noteId/complete', async (ctx) => {
    const staff = await requireStaff(ctx);
    return ok(ctx, await admin.completeFollowUp(staff, param(ctx), param(ctx, 'noteId')));
});

router.post('/api/v1/admin/consultations/:id/calendar-sync', async (ctx) => {
    const staff = await requireStaff(ctx);
    return ok(ctx, await admin.retryCalendar(staff, param(ctx)));
});

router.get('/api/v1/admin/counsellors', async (ctx) => ok(ctx, await admin.listCounsellors(await requireStaff(ctx))));

router.get('/api/v1/admin/availability', async (ctx) => {
    const staff = await requireStaff(ctx);
    const { counsellor_id: counsellorId } = createValidator(Object.fromEntries(ctx.query)).uuid('counsellor_id').done();
    return ok(ctx, await admin.getAvailabilityConfig(staff, counsellorId));
});

router.post('/api/v1/admin/availability', async (ctx) => {
    const staff = await requireStaff(ctx);
    const body = await ctx.body();
    const v = createValidator(body).oneOf('kind', ['rule', 'exception'], { required: true, label: 'kind' }).uuid('counsellorId', { label: 'Counsellor' });
    if (body.kind === 'rule') {
        v.timeZone('timezone')
            .check(Number.isInteger(body.weekday) && body.weekday >= 1 && body.weekday <= 7, 'weekday', 'weekday must be 1 (Monday) to 7 (Sunday)')
            .check(Boolean(parseTimeOfDay(body.startTime)), 'startTime', 'startTime must be HH:MM')
            .check(Boolean(parseTimeOfDay(body.endTime)), 'endTime', 'endTime must be HH:MM')
            .check(!parseTimeOfDay(body.startTime) || !parseTimeOfDay(body.endTime) || body.endTime > body.startTime, 'endTime', 'endTime must be after startTime')
            .check(body.effectiveFrom == null || Boolean(parseDateOnly(body.effectiveFrom)), 'effectiveFrom', 'effectiveFrom must be YYYY-MM-DD')
            .check(body.effectiveUntil == null || Boolean(parseDateOnly(body.effectiveUntil)), 'effectiveUntil', 'effectiveUntil must be YYYY-MM-DD');
    } else {
        v.instant('startsAt', { label: 'startsAt' }).instant('endsAt', { label: 'endsAt' }).text('reason', { max: 200 });
    }
    const input = v.done();
    if (input.kind === 'exception' && input.endsAt <= input.startsAt) throw badRequest('endsAt must be after startsAt', { fields: { endsAt: 'endsAt must be after startsAt' } });
    const payload = input.kind === 'rule'
        ? { ...input, weekday: body.weekday, startTime: body.startTime, endTime: body.endTime, effectiveFrom: body.effectiveFrom || null, effectiveUntil: body.effectiveUntil || null }
        : input;
    return ok(ctx, await admin.createAvailability(staff, payload), 201);
});

router.delete('/api/v1/admin/availability/:kind/:id', async (ctx) => {
    const staff = await requireStaff(ctx);
    const kind = ctx.params.kind;
    if (!['rule', 'exception'].includes(kind)) throw notFound();
    return ok(ctx, await admin.deleteAvailability(staff, kind, param(ctx)));
});

router.get('/api/v1/admin/consultation-types', async (ctx) => {
    await requireStaff(ctx);
    return ok(ctx, await admin.listAllTypes());
});

function validateType(body, { creating }) {
    const v = createValidator(body)
        .text('name', { required: creating, max: 120, label: 'Name' })
        .text('description', { max: 600, label: 'Description' })
        .boolean('isActive', { defaultValue: undefined });
    if (creating) v.check(typeof body.slug === 'string' && /^[a-z0-9-]{3,60}$/.test(body.slug), 'slug', 'slug must be 3–60 lowercase letters, digits or dashes');
    const intField = (name, min, max) => {
        if (body[name] === undefined) return;
        v.check(Number.isInteger(body[name]) && body[name] >= min && body[name] <= max, name, `${name} must be a whole number from ${min} to ${max}`);
    };
    if (creating) v.check(body.durationMinutes !== undefined, 'durationMinutes', 'durationMinutes is required');
    intField('durationMinutes', 10, 240);
    intField('minNoticeMinutes', 0, 10080);
    intField('maxAdvanceDays', 1, 365);
    intField('sortOrder', 0, 1000);
    if (creating || body.meetingMethods !== undefined) {
        v.check(Array.isArray(body.meetingMethods) && body.meetingMethods.length > 0 && body.meetingMethods.every((m) => METHODS.includes(m)), 'meetingMethods', `meetingMethods must list some of: ${METHODS.join(', ')}`);
    }
    const input = v.done();
    const pick = (name) => (body[name] !== undefined ? { [name]: body[name] } : {});
    return { ...input, ...(creating ? { slug: body.slug } : {}), ...pick('durationMinutes'), ...pick('minNoticeMinutes'), ...pick('maxAdvanceDays'), ...pick('sortOrder'), ...(body.meetingMethods !== undefined ? { meetingMethods: [...new Set(body.meetingMethods)] } : {}), ...(body.isActive === undefined ? { isActive: undefined } : {}) };
}

router.post('/api/v1/admin/consultation-types', async (ctx) => {
    const staff = await requireAdmin(ctx);
    return ok(ctx, await admin.saveType(staff, null, validateType(await ctx.body(), { creating: true })), 201);
});

router.patch('/api/v1/admin/consultation-types/:id', async (ctx) => {
    const staff = await requireAdmin(ctx);
    return ok(ctx, await admin.saveType(staff, param(ctx), validateType(await ctx.body(), { creating: false })));
});

router.get('/api/v1/admin/notifications', async (ctx) => {
    await requireAdmin(ctx);
    const { status } = createValidator(Object.fromEntries(ctx.query)).oneOf('status', ['pending', 'sending', 'sent', 'failed', 'skipped', 'cancelled']).done();
    return ok(ctx, await admin.listNotifications({ status, ...pageParams(ctx.query) }));
});

router.post('/api/v1/admin/notifications/:id/retry', async (ctx) => {
    await requireAdmin(ctx);
    const result = await retryNotification(param(ctx));
    if (!result) throw new HttpError(409, 'Only failed or skipped notifications can be retried.', 'NOT_RETRYABLE');
    return ok(ctx, result);
});

/* ── Background jobs (cron) ───────────────────────────────────────────────── */

async function runJobs(ctx) {
    const secret = config.cronSecret();
    const header = ctx.request.headers.authorization || '';
    if (!secret || !header.startsWith('Bearer ') || !safeEqual(header.slice(7), secret)) throw new HttpError(401, 'Unauthorized', 'UNAUTHORIZED');
    return ok(ctx, await runDueJobs());
}
router.get('/api/v1/internal/jobs/run', runJobs);
router.post('/api/v1/internal/jobs/run', runJobs);

/* ── Dispatcher ───────────────────────────────────────────────────────────── */

const INTERNAL = '/api/v1/internal/';

export async function bookingApiRoute(request, response, pathname) {
    const match = router.match(request.method, pathname);
    if (!match) return false;
    if (match.methodNotAllowed) {
        sendJson(response, 405, { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
        return true;
    }
    const url = new URL(request.url, 'http://localhost');
    const ctx = createContext(request, response, url, match.params);
    try {
        if (!pathname.startsWith(INTERNAL)) {
            checkOrigin(ctx);
            await checkCsrf(ctx);
        }
        await match.handler(ctx);
    } catch (error) {
        sendError(response, error);
    }
    return true;
}
