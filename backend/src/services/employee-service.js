/* Employee onboarding. An administrator invites a person by email. The person
   accepts with the link from that email while logged in to an account whose
   verified email is the invited address — proof that they control it. Accepting
   creates (or re-opens) their employee profile and an `employee_activation`
   approval request; access is only granted when a second, authorised person
   approves it (approval-service). The account id never changes. */
import { now } from '../lib/clock.js';
import { query, withTransaction } from '../lib/db.js';
import { badRequest, conflict, forbidden, HttpError } from '../lib/http.js';
import { openRequestInTransaction } from './approval-service.js';
import { audit } from './audit.js';
import { notifyUser } from './inbox.js';
import { invitationToken, invitationTokenHash } from './invitation-token.js';
import { enqueueNotification } from './notification-service.js';

const INVITATION_TTL_DAYS = 14;
const iso = (value) => (value ? new Date(value).toISOString() : null);
const dateOnly = (value) => (value ? String(value).slice(0, 10) : null);

function invitationView(i) {
    const expired = i.status === 'pending' && new Date(i.expires_at) <= now();
    return {
        id: i.id,
        email: i.email,
        fullName: i.full_name,
        workEmail: i.work_email,
        employeeCode: i.employee_code,
        department: i.department,
        jobTitle: i.job_title,
        intendedRole: i.intended_role,
        managerUserId: i.manager_user_id,
        startDate: dateOnly(i.start_date),
        applicationId: i.application_id,
        status: expired ? 'expired' : i.status,
        expiresAt: iso(i.expires_at),
        acceptedAt: iso(i.accepted_at),
        acceptedUserId: i.accepted_user_id,
        createdBy: i.created_by_name ? { id: i.created_by, name: i.created_by_name } : { id: i.created_by },
        createdAt: iso(i.created_at),
    };
}

/* Used by the admin endpoint and by an approved consultant application. */
export async function createInvitationInTransaction(client, actor, input) {
    const email = input.email.toLowerCase();
    const existing = (await client.query('SELECT id, role FROM users WHERE LOWER(email) = $1', [email])).rows[0];
    if (existing && existing.role !== 'student') {
        throw conflict('This person already has staff access. Use a role-change request instead.', 'ALREADY_STAFF');
    }
    if (input.managerUserId) {
        const manager = (await client.query("SELECT id FROM users WHERE id = $1 AND role IN ('counsellor', 'admin', 'super_admin')", [input.managerUserId])).rows[0];
        if (!manager) throw badRequest('Choose a staff member as manager.', { fields: { managerUserId: 'Choose a staff member' } });
    }
    const id = crypto.randomUUID();
    let row;
    try {
        row = (await client.query(
            `INSERT INTO employee_invitations (id, email, full_name, work_email, employee_code, department, job_title, intended_role,
               manager_user_id, start_date, application_id, token_hash, expires_at, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
            [id, email, input.fullName, input.workEmail || null, input.employeeCode || null, input.department, input.jobTitle, input.intendedRole,
                input.managerUserId || null, input.startDate || null, input.applicationId || null, invitationTokenHash(invitationToken(id)),
                new Date(now().getTime() + INVITATION_TTL_DAYS * 86_400_000), actor.id],
        )).rows[0];
    } catch (error) {
        if (error.code === '23505' && error.constraint === 'employee_invitations_one_pending') {
            throw conflict('There is already a pending invitation for this email address.', 'INVITATION_PENDING');
        }
        throw error;
    }
    await enqueueNotification(client, {
        userId: existing?.id || null, template: 'employee_invitation', recipient: email, dedupeKey: `invite:${id}`,
        payload: { invitationId: id, fullName: input.fullName, jobTitle: input.jobTitle, department: input.department },
    });
    if (existing) {
        await notifyUser(client, existing.id, { kind: 'employee_invitation', title: 'You are invited to join the Gradmire team', body: `Open the invitation we emailed you to accept the ${input.jobTitle} role.`, link: 'dashboard' });
    }
    await audit(client, {
        actorUserId: actor.id, action: 'employee.invited', entityType: 'employee_invitation', entityId: id,
        details: { intendedRole: input.intendedRole, existingAccount: Boolean(existing), fromApplication: Boolean(input.applicationId) },
    });
    return invitationView(row);
}

export async function createInvitation(actor, input) {
    return withTransaction((client) => createInvitationInTransaction(client, actor, input));
}

export async function listInvitations({ status }) {
    const { rows } = await query(
        `SELECT i.*, u.first_name || COALESCE(' ' || u.last_name, '') AS created_by_name
         FROM employee_invitations i JOIN users u ON u.id = i.created_by
         WHERE ($1::text IS NULL OR i.status = $1) ORDER BY i.created_at DESC LIMIT 200`,
        [status || null],
    );
    return rows.map(invitationView);
}

export async function revokeInvitation(actor, id) {
    return withTransaction(async (client) => {
        const { rows } = await client.query("UPDATE employee_invitations SET status = 'revoked', updated_at = NOW() WHERE id = $1 AND status = 'pending' RETURNING *", [id]);
        if (!rows[0]) throw conflict('Only a pending invitation can be revoked.', 'NOT_PENDING');
        await audit(client, { actorUserId: actor.id, action: 'employee.invitation_revoked', entityType: 'employee_invitation', entityId: id });
        return invitationView(rows[0]);
    });
}

/* ── Invitee ──────────────────────────────────────────────────────────────── */

const invalid = () => new HttpError(400, 'This invitation link is not valid, has expired or was already used.', 'INVALID_INVITATION');

function maskEmail(email) {
    const [name, domain] = email.split('@');
    return `${name.slice(0, 2)}${'•'.repeat(Math.max(1, name.length - 2))}@${domain}`;
}

/* What the holder of the link may see before accepting: the role, not personal data. */
export async function lookupInvitation(token) {
    const { rows } = await query('SELECT * FROM employee_invitations WHERE token_hash = $1', [invitationTokenHash(token)]);
    const i = rows[0];
    if (!i || i.status !== 'pending' || new Date(i.expires_at) <= now()) throw invalid();
    return { jobTitle: i.job_title, department: i.department, intendedRole: i.intended_role, invitedEmail: maskEmail(i.email), expiresAt: iso(i.expires_at) };
}

export async function acceptInvitation(user, token) {
    if (!user.email_verified_at) throw forbidden('Verify your email address first, then open the invitation again.');
    return withTransaction(async (client) => {
        const i = (await client.query('SELECT * FROM employee_invitations WHERE token_hash = $1 FOR UPDATE', [invitationTokenHash(token)])).rows[0];
        if (!i || i.status !== 'pending' || new Date(i.expires_at) <= now()) throw invalid();
        // The link alone is not enough: the account must own the invited address.
        if (i.email.toLowerCase() !== user.email.toLowerCase()) {
            throw forbidden('This invitation was sent to a different email address. Log in with the invited account.');
        }
        if (user.role !== 'student') throw conflict('This account already has staff access. Ask an administrator for a role change instead.', 'ALREADY_STAFF');

        const at = now();
        try {
            await client.query(
                `INSERT INTO employee_profiles (user_id, employee_code, work_email, department, job_title, manager_user_id, start_date, system_role,
                   employment_status, invitation_id, created_by, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, $11, $11)
                 ON CONFLICT (user_id) DO UPDATE SET employee_code = EXCLUDED.employee_code, work_email = EXCLUDED.work_email,
                   department = EXCLUDED.department, job_title = EXCLUDED.job_title, manager_user_id = EXCLUDED.manager_user_id,
                   start_date = EXCLUDED.start_date, system_role = EXCLUDED.system_role, employment_status = 'pending',
                   invitation_id = EXCLUDED.invitation_id, approved_by = NULL, approved_at = NULL, terminated_by = NULL, terminated_at = NULL,
                   updated_at = EXCLUDED.updated_at`,
                [user.id, i.employee_code, i.work_email, i.department, i.job_title, i.manager_user_id, i.start_date, i.intended_role, i.id, i.created_by, at],
            );
        } catch (error) {
            if (error.code === '23505' && error.constraint === 'employee_profiles_employee_code_key') {
                throw conflict('That employee ID is already used by another employee. Ask the administrator to correct the invitation.', 'EMPLOYEE_CODE_TAKEN');
            }
            throw error;
        }
        await client.query("UPDATE employee_invitations SET status = 'accepted', accepted_at = $2, accepted_user_id = $3, updated_at = NOW() WHERE id = $1", [i.id, at, user.id]);
        const request = await openRequestInTransaction(client, {
            type: 'employee_activation', targetUserId: user.id, requestedRole: i.intended_role, requestedById: i.created_by,
            reason: `Activate ${i.intended_role} access for ${i.job_title} (${i.department}), accepted from invitation.`,
            relatedEntityType: 'employee_invitation', relatedEntityId: i.id,
        });
        await audit(client, { actorUserId: user.id, action: 'employee.invitation_accepted', entityType: 'employee_invitation', entityId: i.id, details: { approvalRequestId: request.id } });
        await notifyUser(client, user.id, { kind: 'employee_onboarding', title: 'Invitation accepted', body: 'Your access will be switched on once an administrator approves your onboarding.', link: 'dashboard' });
        return { accepted: true, approvalRequestId: request.id, status: 'pending_approval' };
    });
}

/* ── Employees ────────────────────────────────────────────────────────────── */

export async function listEmployees({ status }) {
    const { rows } = await query(
        `SELECT e.*, u.email, u.first_name, u.last_name, u.role, u.status AS account_status,
                m.first_name || COALESCE(' ' || m.last_name, '') AS manager_name,
                (SELECT COUNT(*)::int FROM consultations c WHERE c.counsellor_id = e.user_id AND c.status IN ('reserved', 'confirmed') AND c.scheduled_start > NOW()) AS upcoming_consultations,
                (SELECT COUNT(*)::int FROM leads l WHERE l.assigned_counsellor_id = e.user_id AND l.status NOT IN ('converted', 'not_interested', 'closed')) AS open_leads
         FROM employee_profiles e JOIN users u ON u.id = e.user_id LEFT JOIN users m ON m.id = e.manager_user_id
         WHERE ($1::text IS NULL OR e.employment_status = $1)
         ORDER BY e.employment_status, u.first_name LIMIT 500`,
        [status || null],
    );
    return rows.map((e) => ({
        userId: e.user_id,
        name: [e.first_name, e.last_name].filter(Boolean).join(' '),
        email: e.email,
        workEmail: e.work_email,
        employeeCode: e.employee_code,
        department: e.department,
        jobTitle: e.job_title,
        manager: e.manager_user_id ? { id: e.manager_user_id, name: e.manager_name } : null,
        startDate: dateOnly(e.start_date),
        systemRole: e.system_role,
        currentRole: e.role,
        accountStatus: e.account_status,
        employmentStatus: e.employment_status,
        approvedAt: iso(e.approved_at),
        terminatedAt: iso(e.terminated_at),
        upcomingConsultations: e.upcoming_consultations,
        openLeads: e.open_leads,
    }));
}

export async function getEmployeeProfile(userId) {
    const { rows } = await query('SELECT * FROM employee_profiles WHERE user_id = $1', [userId]);
    return rows[0] || null;
}

