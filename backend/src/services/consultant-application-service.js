/* Consultant applications: a student applies to join Gradmire as a consultant;
   admins review, shortlist, interview and decide. A hiring decision never grants
   access by itself — approval creates an employee invitation, and access is only
   activated through an approval request (employee-service, approval-service).

   State machine (reviewer moves, plus the applicant's own withdraw/resubmit)
     submitted          → under_review, info_requested, rejected
     info_requested     → submitted (applicant updates), rejected
     under_review       → shortlisted, info_requested, rejected
     shortlisted        → interview_scheduled, rejected
     interview_scheduled→ interview_scheduled (new time), interview_completed, rejected
     interview_completed→ approved, rejected
     any open state     → withdrawn (applicant only) */
import { now } from '../lib/clock.js';
import { query, withTransaction } from '../lib/db.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/http.js';
import { audit } from './audit.js';
import { assertOwnCv } from './document-service.js';
import { createInvitationInTransaction } from './employee-service.js';
import { syncInterviewMeeting } from './interview-meeting.js';
import { notifyUser } from './inbox.js';
import { enqueueNotification } from './notification-service.js';

export const OPEN_STATUSES = ['submitted', 'info_requested', 'under_review', 'shortlisted', 'interview_scheduled', 'interview_completed'];
export const ALL_STATUSES = [...OPEN_STATUSES, 'approved', 'rejected', 'withdrawn'];
/* Statuses in which the applicant may still edit their answers. */
const EDITABLE = ['submitted', 'info_requested'];

const REVIEW_TRANSITIONS = {
    submitted: ['under_review', 'info_requested', 'rejected'],
    info_requested: ['rejected'],
    under_review: ['shortlisted', 'info_requested', 'rejected'],
    shortlisted: ['interview_scheduled', 'rejected'],
    interview_scheduled: ['interview_scheduled', 'interview_completed', 'rejected'],
    interview_completed: ['approved', 'rejected'],
    approved: [],
    rejected: [],
    withdrawn: [],
};

export const STATUS_LABELS = {
    submitted: 'Submitted', info_requested: 'More information requested', under_review: 'Under review',
    shortlisted: 'Shortlisted', interview_scheduled: 'Interview scheduled', interview_completed: 'Interview completed',
    approved: 'Approved', rejected: 'Not successful', withdrawn: 'Withdrawn',
};

const FIELDS = {
    fullName: 'full_name', phone: 'phone', location: 'location', yearsExperience: 'years_experience',
    professionalExperience: 'professional_experience', education: 'education', counsellingExperience: 'counselling_experience',
    languages: 'languages', expertise: 'expertise', availability: 'availability', cvUrl: 'cv_url', cvDocumentId: 'cv_document_id', additionalInfo: 'additional_info',
};

const iso = (value) => (value ? new Date(value).toISOString() : null);

/* What the applicant sees: their answers, the status and the one message meant for them. */
function applicantView(a) {
    return {
        id: a.id,
        status: a.status,
        statusLabel: STATUS_LABELS[a.status],
        fullName: a.full_name,
        email: a.email,
        phone: a.phone,
        location: a.location,
        yearsExperience: a.years_experience,
        professionalExperience: a.professional_experience,
        education: a.education,
        counsellingExperience: a.counselling_experience,
        languages: a.languages,
        expertise: a.expertise,
        availability: a.availability,
        cvUrl: a.cv_url,
        cvDocumentId: a.cv_document_id || null,
        additionalInfo: a.additional_info,
        interviewAt: ['interview_scheduled'].includes(a.status) ? iso(a.interview_at) : null,
        // Only a link that Google actually created is shown.
        interviewMeetUrl: a.status === 'interview_scheduled' ? a.interview_meet_url || null : null,
        message: a.applicant_message,
        canEdit: EDITABLE.includes(a.status),
        canWithdraw: OPEN_STATUSES.includes(a.status),
        submittedAt: iso(a.submitted_at),
        updatedAt: iso(a.updated_at),
        decidedAt: iso(a.decided_at),
    };
}

/* What reviewers see, including private history. */
function reviewerView(a, events = null) {
    return {
        ...applicantView(a),
        userId: a.user_id,
        accountEmail: a.account_email,
        reviewer: a.reviewer_user_id ? { id: a.reviewer_user_id, name: a.reviewer_name } : null,
        interviewAt: iso(a.interview_at),
        interviewMeeting: { status: a.interview_calendar_status, meetUrl: a.interview_meet_url || null },
        allowedTransitions: REVIEW_TRANSITIONS[a.status],
        ...(events ? {
            history: events.map((e) => ({
                event: e.event, from: e.from_status, to: e.to_status, note: e.internal_note, actor: e.actor_name, at: iso(e.created_at),
            })),
        } : {}),
    };
}

async function recordEvent(client, { applicationId, actorUserId, event, from = null, to = null, note = null }) {
    await client.query(
        'INSERT INTO consultant_application_events (application_id, actor_user_id, event, from_status, to_status, internal_note) VALUES ($1, $2, $3, $4, $5, $6)',
        [applicationId, actorUserId, event, from, to, note],
    );
}

async function tellApplicant(client, a, message = null) {
    const label = STATUS_LABELS[a.status];
    await notifyUser(client, a.user_id, {
        kind: 'consultant_application', title: `Consultant application: ${label}`,
        body: message || `Your application status is now ${label.toLowerCase()}.`, link: 'dashboard-become-consultant',
    });
    await enqueueNotification(client, {
        userId: a.user_id, template: 'consultant_application_update', recipient: a.email,
        dedupeKey: `consultant_application:${a.id}:${a.status}:${new Date(a.updated_at).getTime()}`,
        payload: { firstName: a.full_name.split(' ')[0], statusLabel: label, message },
    });
}

/* ── Applicant ────────────────────────────────────────────────────────────── */

export async function listMine(user) {
    const { rows } = await query('SELECT * FROM consultant_applications WHERE user_id = $1 ORDER BY submitted_at DESC', [user.id]);
    return rows.map(applicantView);
}

export async function getMine(user, id) {
    const { rows } = await query('SELECT * FROM consultant_applications WHERE id = $1 AND user_id = $2', [id, user.id]);
    if (!rows[0]) throw notFound('Application not found');
    return applicantView(rows[0]);
}

export async function submit(user, input) {
    if (user.role !== 'student') throw forbidden('Only student accounts can apply to become a consultant.');
    if (!user.email_verified_at) throw forbidden('Verify your email address before applying.');
    return withTransaction(async (client) => {
        if (input.cvDocumentId) await assertOwnCv(client, user.id, input.cvDocumentId);
        const id = crypto.randomUUID();
        let row;
        try {
            row = (await client.query(
                `INSERT INTO consultant_applications (id, user_id, full_name, email, phone, location, years_experience, professional_experience,
                   education, counselling_experience, languages, expertise, availability, cv_url, cv_document_id, additional_info, consent_at, submitted_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $17) RETURNING *`,
                [id, user.id, input.fullName, user.email, input.phone, input.location, input.yearsExperience, input.professionalExperience,
                    input.education, input.counsellingExperience || null, input.languages || [], input.expertise || [], input.availability,
                    input.cvUrl || null, input.cvDocumentId || null, input.additionalInfo || null, now()],
            )).rows[0];
        } catch (error) {
            if (error.code === '23505' && error.constraint === 'consultant_applications_one_open') {
                throw conflict('You already have an open application. You can update or withdraw it instead.', 'APPLICATION_OPEN');
            }
            throw error;
        }
        await recordEvent(client, { applicationId: id, actorUserId: user.id, event: 'submitted', to: 'submitted' });
        await audit(client, { actorUserId: user.id, action: 'consultant_application.submitted', entityType: 'consultant_application', entityId: id });
        await tellApplicant(client, row, 'We have received your application. A member of the team will review it.');
        // Every reviewer hears about a new application in their notification centre.
        const reviewers = await client.query("SELECT id FROM users WHERE role IN ('admin', 'super_admin') AND status = 'active'");
        for (const reviewer of reviewers.rows) {
            await notifyUser(client, reviewer.id, { kind: 'consultant_application_new', title: 'New consultant application', body: `${row.full_name} applied to join as a consultant.`, link: 'admin-team' });
        }
        return applicantView(row);
    });
}

/* Edits are allowed until review starts (or while more information is requested). */
export async function updateMine(user, id, input) {
    return withTransaction(async (client) => {
        const a = (await client.query('SELECT * FROM consultant_applications WHERE id = $1 AND user_id = $2 FOR UPDATE', [id, user.id])).rows[0];
        if (!a) throw notFound('Application not found');
        if (!EDITABLE.includes(a.status)) throw conflict('This application is being reviewed and can no longer be edited.', 'NOT_EDITABLE');
        if (input.cvDocumentId) await assertOwnCv(client, user.id, input.cvDocumentId);
        const sets = [];
        const values = [id];
        for (const [key, column] of Object.entries(FIELDS)) {
            if (input[key] === undefined) continue;
            values.push(input[key] === '' ? null : input[key]);
            sets.push(`${column} = $${values.length}`);
        }
        if (!sets.length) throw badRequest('Nothing to update.');
        // Answering a request for information puts the application back in the queue.
        const resubmitted = a.status === 'info_requested';
        const row = (await client.query(
            `UPDATE consultant_applications SET ${sets.join(', ')}${resubmitted ? ", status = 'submitted', applicant_message = NULL" : ''}, updated_at = NOW()
             WHERE id = $1 RETURNING *`,
            values,
        )).rows[0];
        await recordEvent(client, { applicationId: id, actorUserId: user.id, event: 'updated_by_applicant', ...(resubmitted ? { from: 'info_requested', to: 'submitted' } : {}) });
        await audit(client, { actorUserId: user.id, action: 'consultant_application.updated', entityType: 'consultant_application', entityId: id, details: { fields: Object.keys(input).filter((k) => input[k] !== undefined) } });
        return applicantView(row);
    });
}

export async function withdrawMine(user, id) {
    return withTransaction(async (client) => {
        const a = (await client.query('SELECT * FROM consultant_applications WHERE id = $1 AND user_id = $2 FOR UPDATE', [id, user.id])).rows[0];
        if (!a) throw notFound('Application not found');
        if (!OPEN_STATUSES.includes(a.status)) throw conflict('This application is already closed.', 'NOT_OPEN');
        const row = (await client.query("UPDATE consultant_applications SET status = 'withdrawn', decided_at = $2, updated_at = NOW() WHERE id = $1 RETURNING *", [id, now()])).rows[0];
        await recordEvent(client, { applicationId: id, actorUserId: user.id, event: 'withdrawn', from: a.status, to: 'withdrawn' });
        await audit(client, { actorUserId: user.id, action: 'consultant_application.withdrawn', entityType: 'consultant_application', entityId: id });
        return row;
    }).then(async (row) => applicantView(row.interview_event_id ? await syncInterviewMeeting(id) : row));
}

/* ── Reviewers ────────────────────────────────────────────────────────────── */

const REVIEW_SELECT = `
  SELECT a.*, u.email AS account_email, r.first_name || COALESCE(' ' || r.last_name, '') AS reviewer_name
  FROM consultant_applications a JOIN users u ON u.id = a.user_id LEFT JOIN users r ON r.id = a.reviewer_user_id`;

export async function listForReview({ status, page, pageSize }) {
    const values = [status || null, pageSize, (page - 1) * pageSize];
    const [list, count] = await Promise.all([
        query(`${REVIEW_SELECT} WHERE ($1::text IS NULL OR a.status = $1) ORDER BY a.submitted_at DESC LIMIT $2 OFFSET $3`, values),
        query('SELECT COUNT(*)::int AS total FROM consultant_applications WHERE ($1::text IS NULL OR status = $1)', [status || null]),
    ]);
    return { items: list.rows.map((a) => reviewerView(a)), page, pageSize, total: count.rows[0].total };
}

export async function getForReview(id) {
    const { rows } = await query(`${REVIEW_SELECT} WHERE a.id = $1`, [id]);
    if (!rows[0]) throw notFound('Application not found');
    const events = await query(
        `SELECT e.*, u.first_name || COALESCE(' ' || u.last_name, '') AS actor_name
         FROM consultant_application_events e LEFT JOIN users u ON u.id = e.actor_user_id WHERE e.application_id = $1 ORDER BY e.id`,
        [id],
    );
    return reviewerView(rows[0], events.rows);
}

export async function addNote(reviewer, id, note) {
    return withTransaction(async (client) => {
        const a = (await client.query('SELECT id FROM consultant_applications WHERE id = $1', [id])).rows[0];
        if (!a) throw notFound('Application not found');
        await recordEvent(client, { applicationId: id, actorUserId: reviewer.id, event: 'note', note });
        return { added: true };
    });
}

export async function assignReviewer(actor, id, reviewerId) {
    return withTransaction(async (client) => {
        const a = (await client.query('SELECT * FROM consultant_applications WHERE id = $1 FOR UPDATE', [id])).rows[0];
        if (!a) throw notFound('Application not found');
        const reviewer = (await client.query("SELECT id FROM users WHERE id = $1 AND role IN ('admin', 'super_admin') AND status = 'active'", [reviewerId])).rows[0];
        if (!reviewer) throw badRequest('Choose an active administrator as reviewer.', { fields: { reviewerId: 'Choose an administrator' } });
        if (reviewerId === a.user_id) throw forbidden('An applicant cannot review their own application.');
        await client.query('UPDATE consultant_applications SET reviewer_user_id = $2, updated_at = NOW() WHERE id = $1', [id, reviewerId]);
        await recordEvent(client, { applicationId: id, actorUserId: actor.id, event: 'reviewer_assigned' });
        await audit(client, { actorUserId: actor.id, action: 'consultant_application.reviewer_assigned', entityType: 'consultant_application', entityId: id, details: { reviewerId } });
        return getForReviewIn(client, id);
    });
}

async function getForReviewIn(client, id) {
    const { rows } = await client.query(`${REVIEW_SELECT} WHERE a.id = $1`, [id]);
    return reviewerView(rows[0]);
}

/* Moves the application along. `input`: { status, note (private), message (to the applicant),
   interviewAt, job (on approval: { department, jobTitle, startDate, managerUserId }) } */
export async function transition(reviewer, id, input) {
    const outcome = await withTransaction(async (client) => {
        const a = (await client.query('SELECT * FROM consultant_applications WHERE id = $1 FOR UPDATE', [id])).rows[0];
        if (!a) throw notFound('Application not found');
        if (a.user_id === reviewer.id) throw forbidden('You cannot decide your own application.');
        const to = input.status;
        if (!REVIEW_TRANSITIONS[a.status].includes(to)) {
            throw conflict(`An application that is "${STATUS_LABELS[a.status]}" cannot move to "${STATUS_LABELS[to] || to}".`, 'INVALID_TRANSITION');
        }
        if (to === 'interview_scheduled' && !input.interviewAt) throw badRequest('Choose the interview date and time.', { fields: { interviewAt: 'Interview time is required' } });
        if (to === 'info_requested' && !input.message) throw badRequest('Tell the applicant what information you need.', { fields: { message: 'A message to the applicant is required' } });

        const decided = ['approved', 'rejected'].includes(to);
        const row = (await client.query(
            `UPDATE consultant_applications SET status = $2::text,
               interview_at = CASE WHEN $2::text = 'interview_scheduled' THEN $3::timestamptz ELSE interview_at END,
               -- Each (re)scheduling gets a new calendar event.
               interview_generation = interview_generation + CASE WHEN $2::text = 'interview_scheduled' THEN 1 ELSE 0 END,
               applicant_message = $4,
               reviewer_user_id = COALESCE(reviewer_user_id, $5),
               decided_by = CASE WHEN $6 THEN $5 ELSE decided_by END,
               decided_at = CASE WHEN $6 THEN $7::timestamptz ELSE decided_at END,
               updated_at = NOW()
             WHERE id = $1 RETURNING *`,
            [id, to, input.interviewAt || null, input.message || null, reviewer.id, decided, now()],
        )).rows[0];
        await recordEvent(client, { applicationId: id, actorUserId: reviewer.id, event: 'status_changed', from: a.status, to, note: input.note || null });
        await audit(client, {
            actorUserId: reviewer.id, action: decided ? `consultant_application.${to}` : 'consultant_application.status_changed',
            entityType: 'consultant_application', entityId: id, details: { from: a.status, to },
        });

        let invitation = null;
        if (to === 'approved') {
            // Hiring decision recorded; access still needs the invitation and an activation approval.
            invitation = await createInvitationInTransaction(client, reviewer, {
                email: a.email,
                fullName: a.full_name,
                department: input.job?.department || 'Counselling',
                jobTitle: input.job?.jobTitle || 'Study-abroad consultant',
                intendedRole: 'counsellor',
                startDate: input.job?.startDate || null,
                managerUserId: input.job?.managerUserId || null,
                applicationId: id,
            });
        }
        const defaultMessage = to === 'approved'
            ? 'Congratulations, your application was approved. Check your email for an invitation to join the team; your consultant access starts once onboarding is approved.'
            : null;
        // Interview invitations wait until the calendar event (and its Meet link) exists.
        if (!['interview_completed', 'interview_scheduled'].includes(to)) await tellApplicant(client, row, input.message || defaultMessage);
        return { to, invitation, hadEvent: Boolean(a.interview_event_id) };
    });

    if (outcome.to === 'interview_scheduled' || outcome.hadEvent) {
        const fresh = await syncInterviewMeeting(id);
        if (outcome.to === 'interview_scheduled') await withTransaction((client) => tellApplicant(client, fresh, interviewMessage(fresh, input.message)));
    }
    return { ...(await getForReviewIn({ query }, id)), invitation: outcome.invitation };
}

function interviewMessage(a, message) {
    const when = new Date(a.interview_at).toUTCString().replace(':00 GMT', ' UTC');
    const join = a.interview_meet_url ? `Join with Google Meet: ${a.interview_meet_url}` : 'The meeting link will be sent to you before the interview.';
    return [message, `Your interview is scheduled for ${when}.`, join].filter(Boolean).join(' ');
}

/* Staff retry after a failed calendar sync. */
export async function retryInterviewMeeting(reviewer, id) {
    const a = (await query('SELECT status FROM consultant_applications WHERE id = $1', [id])).rows[0];
    if (!a) throw notFound('Application not found');
    if (a.status !== 'interview_scheduled') throw conflict('Only a scheduled interview has a meeting.', 'NOT_SCHEDULED');
    await syncInterviewMeeting(id);
    await withTransaction(async (client) => {
        // A new updated_at gives the applicant's email a new de-duplication key.
        const fresh = (await client.query('UPDATE consultant_applications SET updated_at = NOW() WHERE id = $1 RETURNING *', [id])).rows[0];
        await audit(client, { actorUserId: reviewer.id, action: 'consultant_application.meeting_retried', entityType: 'consultant_application', entityId: id, details: { status: fresh.interview_calendar_status } });
        if (fresh.interview_meet_url) await tellApplicant(client, fresh, interviewMessage(fresh, null));
    });
    return getForReviewIn({ query }, id);
}
