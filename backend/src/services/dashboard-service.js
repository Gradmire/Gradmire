/* Data behind each role's overview page. Every number is counted from stored
   records at request time; nothing is estimated or sample data. */
import { now } from '../lib/clock.js';
import { query, withTransaction } from '../lib/db.js';
import { addMinutes, dayBounds, zonedParts } from '../lib/time.js';
import { counsellorScope, counsellorSeesStudentSql } from './access.js';
import { audit } from './audit.js';
import { STATUS_LABELS as APPLICATION_LABELS } from './consultant-application-service.js';
import { listForUser } from './inbox.js';

const iso = (value) => (value ? new Date(value).toISOString() : null);
const fullName = (first, last) => [first, last].filter(Boolean).join(' ');
const OFFER = ['offer_conditional', 'offer_unconditional', 'accepted', 'visa_applied', 'visa_granted', 'enrolled'];

/* ── Student profile ──────────────────────────────────────────────────────── */

const PROFILE_FIELDS = {
    destinations: 'destinations', intendedIntake: 'intended_intake', studyLevel: 'study_level', preferredCourse: 'preferred_course',
    highestQualification: 'highest_qualification', academicScore: 'academic_score', englishTest: 'english_test',
    englishScore: 'english_score', budgetRange: 'budget_range', consultationLanguage: 'consultation_language',
};

function profileView(user, p) {
    const profile = Object.fromEntries(Object.entries(PROFILE_FIELDS).map(([key, column]) => [key, p ? p[column] : (key === 'destinations' ? [] : null)]));
    // Completion counts the account details and the fields counselling relies on.
    const checks = [
        Boolean(user.email_verified_at), Boolean(user.phone), profile.destinations.length > 0, Boolean(profile.intendedIntake),
        Boolean(profile.studyLevel), Boolean(profile.preferredCourse), Boolean(profile.highestQualification), Boolean(profile.englishTest),
        Boolean(profile.budgetRange), Boolean(profile.consultationLanguage),
    ];
    return {
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        emailVerified: Boolean(user.email_verified_at),
        phone: user.phone,
        ...profile,
        completion: Math.round((checks.filter(Boolean).length / checks.length) * 100),
        updatedAt: iso(p?.updated_at),
    };
}

export async function getProfile(user) {
    const { rows } = await query('SELECT * FROM student_profiles WHERE user_id = $1', [user.id]);
    return profileView(user, rows[0]);
}

/* Email is not editable here: changing it needs re-verification, which is not built yet. */
export async function updateProfile(user, input) {
    return withTransaction(async (client) => {
        const userSets = [];
        const userValues = [user.id];
        for (const [key, column] of [['firstName', 'first_name'], ['lastName', 'last_name'], ['phone', 'phone']]) {
            if (input[key] === undefined) continue;
            userValues.push(input[key] === '' ? null : input[key]);
            userSets.push(`${column} = $${userValues.length}`);
        }
        if (userSets.length) await client.query(`UPDATE users SET ${userSets.join(', ')}, updated_at = NOW() WHERE id = $1`, userValues);

        const keys = Object.keys(PROFILE_FIELDS).filter((key) => input[key] !== undefined);
        if (keys.length) {
            const columns = keys.map((key) => PROFILE_FIELDS[key]);
            const values = keys.map((key) => (input[key] === '' ? null : input[key]));
            await client.query(
                `INSERT INTO student_profiles (user_id, ${columns.join(', ')}, updated_at) VALUES ($1, ${columns.map((_, i) => `$${i + 2}`).join(', ')}, NOW())
                 ON CONFLICT (user_id) DO UPDATE SET ${columns.map((c) => `${c} = EXCLUDED.${c}`).join(', ')}, updated_at = NOW()`,
                [user.id, ...values],
            );
        }
        await audit(client, { actorUserId: user.id, action: 'profile.updated', entityType: 'user', entityId: user.id, details: { fields: [...Object.keys(input).filter((k) => input[k] !== undefined)] } });
        const fresh = (await client.query('SELECT * FROM users WHERE id = $1', [user.id])).rows[0];
        const p = (await client.query('SELECT * FROM student_profiles WHERE user_id = $1', [user.id])).rows[0];
        return profileView(fresh, p);
    });
}

/* ── Student overview ─────────────────────────────────────────────────────── */

export async function studentOverview(user) {
    const [profile, consultations, applications, inbox, consultantApplication] = await Promise.all([
        getProfile(user),
        query(
            `SELECT c.id, c.reference, c.status, c.scheduled_start, c.scheduled_end, c.timezone, c.meeting_method, c.meeting_url,
                    t.name AS type_name, co.display_name AS counsellor_name
             FROM consultations c JOIN consultation_types t ON t.id = c.consultation_type_id JOIN counsellors co ON co.user_id = c.counsellor_id
             WHERE c.student_user_id = $1 AND c.status <> 'rescheduled' ORDER BY c.scheduled_start`,
            [user.id],
        ),
        query('SELECT status, deadline, university FROM student_applications WHERE student_user_id = $1', [user.id]),
        listForUser(user.id, { limit: 5 }),
        query('SELECT id, status FROM consultant_applications WHERE user_id = $1 ORDER BY submitted_at DESC LIMIT 1', [user.id]),
    ]);
    const nowTime = now();
    const upcoming = consultations.rows.filter((c) => ['reserved', 'confirmed'].includes(c.status) && new Date(c.scheduled_end) > nowTime);
    const next = upcoming[0];
    const apps = applications.rows;
    const soon = addMinutes(nowTime, 30 * 24 * 60).toISOString().slice(0, 10);
    const today = nowTime.toISOString().slice(0, 10);
    const deadlines = apps
        .filter((a) => a.deadline && a.deadline >= today && a.deadline <= soon && !['rejected', 'withdrawn', 'enrolled'].includes(a.status))
        .map((a) => ({ university: a.university, deadline: a.deadline }))
        .sort((a, b) => a.deadline.localeCompare(b.deadline));

    const steps = [];
    if (!profile.emailVerified) steps.push({ key: 'verify_email', label: 'Verify your email address', href: 'dashboard.html#verify' });
    if (profile.completion < 100) steps.push({ key: 'complete_profile', label: `Complete your profile (${profile.completion}%)`, href: 'dashboard-profile.html' });
    if (!upcoming.length && !consultations.rows.some((c) => c.status === 'completed')) steps.push({ key: 'book', label: 'Book a free consultation', href: 'book-consultation.html' });
    if (!apps.length) steps.push({ key: 'explore', label: 'Explore universities and courses', href: 'find-courses.html' });
    if (deadlines.length) steps.push({ key: 'deadline', label: `Prepare for the ${deadlines[0].university} deadline`, href: 'dashboard.html#applications' });

    const ca = consultantApplication.rows[0];
    return {
        profile: { completion: profile.completion, emailVerified: profile.emailVerified },
        nextConsultation: next ? {
            id: next.id, reference: next.reference, status: next.status, type: next.type_name, counsellor: next.counsellor_name,
            start: iso(next.scheduled_start), end: iso(next.scheduled_end), timezone: next.timezone, meetingMethod: next.meeting_method,
            meetingUrl: next.status === 'confirmed' ? next.meeting_url : null,
        } : null,
        consultations: {
            upcoming: upcoming.length,
            completed: consultations.rows.filter((c) => c.status === 'completed').length,
            cancelled: consultations.rows.filter((c) => c.status === 'cancelled').length,
        },
        applications: {
            total: apps.length,
            inProgress: apps.filter((a) => ['shortlisted', 'preparing', 'submitted'].includes(a.status)).length,
            offers: apps.filter((a) => OFFER.includes(a.status)).length,
            upcomingDeadlines: deadlines,
        },
        notifications: { unread: inbox.unread, recent: inbox.items },
        consultantApplication: ca ? { id: ca.id, status: ca.status, statusLabel: APPLICATION_LABELS[ca.status] } : null,
        nextSteps: steps,
    };
}

/* ── Consultant workspace ─────────────────────────────────────────────────── */

export async function consultantOverview(staff, timezone) {
    const scope = staff.id; // the consultant workspace always shows the signed-in person's own work
    const today = zonedParts(now(), timezone);
    const { start, end } = dayBounds({ year: today.year, month: today.month, day: today.day }, timezone);
    const weekEnd = addMinutes(now(), 7 * 24 * 60);
    const [todayRows, upcomingRows, counts, deadlines, recentStudents] = await Promise.all([
        query(
            `SELECT c.id, c.reference, c.status, c.scheduled_start, c.scheduled_end, c.student_name, c.meeting_method, t.name AS type_name
             FROM consultations c JOIN consultation_types t ON t.id = c.consultation_type_id
             WHERE c.counsellor_id = $1 AND c.scheduled_start >= $2 AND c.scheduled_start < $3 AND c.status IN ('reserved', 'confirmed', 'completed', 'no_show')
             ORDER BY c.scheduled_start`,
            [scope, start, end],
        ),
        query(
            `SELECT c.id, c.reference, c.status, c.scheduled_start, c.scheduled_end, c.student_name, c.meeting_method, t.name AS type_name
             FROM consultations c JOIN consultation_types t ON t.id = c.consultation_type_id
             WHERE c.counsellor_id = $1 AND c.scheduled_start >= $2 AND c.scheduled_start < $3 AND c.status IN ('reserved', 'confirmed')
             ORDER BY c.scheduled_start LIMIT 10`,
            [scope, end, weekEnd],
        ),
        query(
            `SELECT
               (SELECT COUNT(*)::int FROM users u WHERE u.role = 'student' AND ${counsellorSeesStudentSql('u', '$1')}) AS assigned_students,
               (SELECT COUNT(*)::int FROM leads WHERE assigned_counsellor_id = $1 AND status = 'new') AS new_leads,
               (SELECT COUNT(*)::int FROM leads WHERE assigned_counsellor_id = $1 AND status IN ('new', 'contacted', 'qualified', 'consultation_booked')) AS open_leads,
               (SELECT COUNT(*)::int FROM follow_up_tasks WHERE assignee_user_id = $1 AND status = 'open') +
                 (SELECT COUNT(*)::int FROM consultation_notes n JOIN consultations c ON c.id = n.consultation_id WHERE c.counsellor_id = $1 AND n.kind = 'follow_up' AND n.completed_at IS NULL) AS open_follow_ups,
               (SELECT COUNT(*)::int FROM follow_up_tasks WHERE assignee_user_id = $1 AND status = 'open' AND due_at < $2) +
                 (SELECT COUNT(*)::int FROM consultation_notes n JOIN consultations c ON c.id = n.consultation_id WHERE c.counsellor_id = $1 AND n.kind = 'follow_up' AND n.completed_at IS NULL AND n.due_at < $2) AS overdue_follow_ups,
               (SELECT COUNT(*)::int FROM leads WHERE assigned_counsellor_id = $1 AND next_follow_up_at < $2 AND status IN ('new', 'contacted', 'qualified', 'consultation_booked')) AS leads_follow_up_due,
               -- Sessions that have ended but still need marking, or are marked completed without an outcome.
               (SELECT COUNT(*)::int FROM consultations WHERE counsellor_id = $1 AND ((status IN ('reserved', 'confirmed') AND scheduled_end < $2) OR (status = 'completed' AND outcome IS NULL))) AS outcomes_due`,
            [scope, now()],
        ),
        query(
            `SELECT a.university, a.course, a.deadline, a.status, u.id AS student_id, u.first_name, u.last_name
             FROM student_applications a JOIN users u ON u.id = a.student_user_id
             WHERE a.deadline BETWEEN $2::date AND $3::date AND a.status IN ('shortlisted', 'preparing', 'submitted') AND ${counsellorSeesStudentSql('u', '$1')}
             ORDER BY a.deadline LIMIT 10`,
            [scope, now().toISOString().slice(0, 10), addMinutes(now(), 30 * 24 * 60).toISOString().slice(0, 10)],
        ),
        query(
            `SELECT l.id, l.first_name, l.last_name, l.email, l.status, l.created_at FROM leads l
             WHERE l.assigned_counsellor_id = $1 AND l.status = 'new' ORDER BY l.created_at DESC LIMIT 10`,
            [scope],
        ),
    ]);
    const item = (c) => ({ id: c.id, reference: c.reference, status: c.status, start: iso(c.scheduled_start), end: iso(c.scheduled_end), student: c.student_name, type: c.type_name, meetingMethod: c.meeting_method });
    return {
        timezone,
        today: todayRows.rows.map(item),
        upcoming: upcomingRows.rows.map(item),
        counts: {
            assignedStudents: counts.rows[0].assigned_students,
            newLeads: counts.rows[0].new_leads,
            openLeads: counts.rows[0].open_leads,
            openFollowUps: counts.rows[0].open_follow_ups,
            overdueFollowUps: counts.rows[0].overdue_follow_ups,
            leadsFollowUpDue: counts.rows[0].leads_follow_up_due,
            outcomesDue: counts.rows[0].outcomes_due,
        },
        deadlines: deadlines.rows.map((d) => ({ university: d.university, course: d.course, deadline: d.deadline, status: d.status, student: { id: d.student_id, name: fullName(d.first_name, d.last_name) } })),
        newLeads: recentStudents.rows.map((l) => ({ id: l.id, name: fullName(l.first_name, l.last_name) || l.email, status: l.status, createdAt: iso(l.created_at) })),
    };
}

const SORTS = { name: "u.first_name, u.last_name", recent: 'last_interaction DESC NULLS LAST', follow_up: 'next_follow_up NULLS LAST' };

/* Students the staff member may see, with the details a consultant works from. */
export async function listStudents(staff, { q, destination, sort, page, pageSize }) {
    const scope = counsellorScope(staff);
    const values = [scope];
    const where = ["u.role = 'student'", `($1::uuid IS NULL OR ${counsellorSeesStudentSql('u', '$1')})`];
    if (q) {
        values.push(`%${q.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
        where.push(`(LOWER(u.email) LIKE $${values.length} OR LOWER(u.first_name || ' ' || COALESCE(u.last_name, '')) LIKE $${values.length})`);
    }
    if (destination) {
        values.push(destination);
        where.push(`$${values.length} = ANY(p.destinations)`);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const from = `FROM users u LEFT JOIN student_profiles p ON p.user_id = u.id`;
    const [list, count] = await Promise.all([
        query(
            `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, p.destinations, p.intended_intake,
                    (SELECT MAX(c.scheduled_start) FROM consultations c WHERE c.student_user_id = u.id AND c.scheduled_start <= NOW() AND ($1::uuid IS NULL OR c.counsellor_id = $1)) AS last_interaction,
                    (SELECT MIN(c.scheduled_start) FROM consultations c WHERE c.student_user_id = u.id AND c.status IN ('reserved', 'confirmed') AND c.scheduled_start > NOW()) AS next_consultation,
                    (SELECT MIN(t.due_at) FROM follow_up_tasks t WHERE t.student_user_id = u.id AND t.status = 'open') AS next_follow_up,
                    (SELECT a.status FROM student_applications a WHERE a.student_user_id = u.id ORDER BY a.updated_at DESC LIMIT 1) AS latest_application_status,
                    (SELECT COUNT(*)::int FROM student_applications a WHERE a.student_user_id = u.id) AS application_count,
                    (SELECT co.display_name FROM consultations c JOIN counsellors co ON co.user_id = c.counsellor_id WHERE c.student_user_id = u.id ORDER BY c.scheduled_start DESC LIMIT 1) AS consultant
             ${from} ${whereSql} ORDER BY ${SORTS[sort] || SORTS.recent}, u.id LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
            values,
        ),
        query(`SELECT COUNT(*)::int AS total ${from} ${whereSql}`, values),
    ]);
    return {
        items: list.rows.map((s) => ({
            id: s.id, name: fullName(s.first_name, s.last_name), email: s.email, phone: s.phone,
            destinations: s.destinations || [], intake: s.intended_intake, consultant: s.consultant,
            lastInteraction: iso(s.last_interaction), nextConsultation: iso(s.next_consultation), nextFollowUp: iso(s.next_follow_up),
            latestApplicationStatus: s.latest_application_status, applicationCount: s.application_count,
        })),
        page, pageSize, total: count.rows[0].total,
    };
}

/* ── Admin overview ───────────────────────────────────────────────────────── */

export async function adminOverview() {
    const nowTime = now();
    const weekAgo = addMinutes(nowTime, -7 * 24 * 60);
    const quarterAgo = addMinutes(nowTime, -90 * 24 * 60);
    const { rows } = await query(
        `SELECT
           (SELECT COUNT(*)::int FROM users WHERE role = 'student') AS students,
           (SELECT COUNT(*)::int FROM users WHERE role = 'student' AND created_at >= $2) AS new_students,
           (SELECT COUNT(*)::int FROM leads WHERE created_at >= $2) AS new_enquiries,
           (SELECT COUNT(*)::int FROM leads WHERE user_id IS NULL AND status IN ('new', 'contacted', 'qualified', 'consultation_booked')) AS open_guest_enquiries,
           (SELECT COUNT(*)::int FROM leads WHERE assigned_counsellor_id IS NULL AND status IN ('new', 'contacted', 'qualified')) AS unassigned_enquiries,
           (SELECT COUNT(*)::int FROM consultations WHERE status IN ('reserved', 'confirmed') AND scheduled_start >= $1) AS upcoming_consultations,
           (SELECT COUNT(*)::int FROM consultant_applications WHERE status IN ('submitted', 'info_requested', 'under_review', 'shortlisted', 'interview_scheduled', 'interview_completed')) AS open_consultant_applications,
           (SELECT COUNT(*)::int FROM approval_requests WHERE status IN ('pending', 'info_requested')) AS open_approvals,
           (SELECT COUNT(*)::int FROM employee_invitations WHERE status = 'pending' AND expires_at > $1) AS pending_invitations,
           (SELECT COUNT(*)::int FROM counsellors co JOIN users u ON u.id = co.user_id WHERE co.is_active AND u.status = 'active' AND u.role = 'counsellor') AS active_consultants,
           (SELECT COUNT(*)::int FROM follow_up_tasks WHERE status = 'open' AND due_at < $1) +
             (SELECT COUNT(*)::int FROM consultation_notes WHERE kind = 'follow_up' AND completed_at IS NULL AND due_at < $1) AS overdue_follow_ups,
           (SELECT COUNT(*)::int FROM consultations WHERE status = 'completed' AND scheduled_start >= $3) AS completed_90d,
           (SELECT COUNT(*)::int FROM consultations WHERE status = 'no_show' AND scheduled_start >= $3) AS no_show_90d,
           (SELECT COUNT(*)::int FROM notifications WHERE status IN ('failed', 'skipped')) AS undelivered_emails`,
        [nowTime, weekAgo, quarterAgo],
    );
    const r = rows[0];
    const attended = r.completed_90d + r.no_show_90d;
    return {
        students: r.students,
        newStudents7d: r.new_students,
        newEnquiries7d: r.new_enquiries,
        openGuestEnquiries: r.open_guest_enquiries,
        unassignedEnquiries: r.unassigned_enquiries,
        upcomingConsultations: r.upcoming_consultations,
        openConsultantApplications: r.open_consultant_applications,
        openApprovals: r.open_approvals,
        pendingInvitations: r.pending_invitations,
        activeConsultants: r.active_consultants,
        overdueFollowUps: r.overdue_follow_ups,
        undeliveredEmails: r.undelivered_emails,
        // Shown only when there is something to measure.
        completionRate90d: attended ? { completed: r.completed_90d, noShow: r.no_show_90d, rate: Math.round((r.completed_90d / attended) * 100) } : null,
    };
}
