/* University applications a student is making. Counsellors and admins record them;
   the student sees their own on the dashboard. Scoping follows the CRM: admins reach
   every student, counsellors only students who have a consultation with them. */
import crypto from 'node:crypto';
import { now } from '../lib/clock.js';
import { query, withTransaction } from '../lib/db.js';
import { notFound } from '../lib/http.js';
import { audit } from './audit.js';
import { assertStudentAccess, counsellorSeesStudentSql } from './access.js';
import { isAdminRole } from './permissions.js';

export const APPLICATION_STATUSES = [
    'shortlisted', 'preparing', 'submitted', 'offer_conditional', 'offer_unconditional',
    'accepted', 'visa_applied', 'visa_granted', 'enrolled', 'rejected', 'withdrawn',
];

const isAdmin = (staff) => isAdminRole(staff.role);
const escapeLike = (value) => value.replace(/[\\%_]/g, (char) => `\\${char}`);
const dateOnly = (value) => (value ? new Date(value).toISOString().slice(0, 10) : null);

function view(row) {
    return {
        id: row.id,
        university: row.university,
        course: row.course,
        country: row.country,
        intake: row.intake,
        status: row.status,
        deadline: dateOnly(row.deadline),
        studentNote: row.student_note,
        updatedAt: new Date(row.updated_at).toISOString(),
    };
}

async function loadForStaff(client, staff, applicationId) {
    const { rows } = await client.query('SELECT * FROM student_applications WHERE id = $1', [applicationId]);
    if (!rows.length) throw notFound('Application not found');
    await assertStudentAccess(client, staff, rows[0].student_user_id);
    return rows[0];
}

/* ── Student ──────────────────────────────────────────────────────────────── */

export async function listForStudent(studentId) {
    const { rows } = await query('SELECT * FROM student_applications WHERE student_user_id = $1 ORDER BY updated_at DESC', [studentId]);
    return rows.map(view);
}

/* ── Staff ────────────────────────────────────────────────────────────────── */

export async function searchStudents(staff, q) {
    const values = [isAdmin(staff) ? null : staff.id];
    let filter = '';
    if (q) {
        values.push(`%${escapeLike(q.toLowerCase())}%`);
        filter = `AND (LOWER(u.email) LIKE $2 OR LOWER(u.first_name || ' ' || COALESCE(u.last_name, '')) LIKE $2)`;
    }
    const { rows } = await query(
        `SELECT u.id, u.first_name, u.last_name, u.email,
                (SELECT COUNT(*)::int FROM student_applications a WHERE a.student_user_id = u.id) AS application_count
           FROM users u
          WHERE u.role = 'student'
            AND ($1::uuid IS NULL OR ${counsellorSeesStudentSql('u', '$1')})
            ${filter}
          ORDER BY u.created_at DESC
          LIMIT 50`,
        values,
    );
    return rows.map((r) => ({ id: r.id, name: [r.first_name, r.last_name].filter(Boolean).join(' '), email: r.email, applicationCount: r.application_count }));
}

export async function listForStaff(staff, studentId) {
    return withTransaction(async (client) => {
        await assertStudentAccess(client, staff, studentId);
        const { rows } = await client.query('SELECT * FROM student_applications WHERE student_user_id = $1 ORDER BY updated_at DESC', [studentId]);
        return rows.map(view);
    });
}

export async function create(staff, studentId, input) {
    return withTransaction(async (client) => {
        await assertStudentAccess(client, staff, studentId);
        const id = crypto.randomUUID();
        const at = now();
        const { rows } = await client.query(
            `INSERT INTO student_applications
               (id, student_user_id, university, course, country, intake, status, deadline, student_note, created_by, updated_by, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11, $11) RETURNING *`,
            [id, studentId, input.university, input.course, input.country || null, input.intake || null,
                input.status || 'shortlisted', input.deadline || null, input.studentNote || null, staff.id, at],
        );
        await audit(client, { actorUserId: staff.id, action: 'application.created', entityType: 'student_application', entityId: id, details: { status: rows[0].status } });
        return view(rows[0]);
    });
}

const COLUMNS = { university: 'university', course: 'course', country: 'country', intake: 'intake', status: 'status', deadline: 'deadline', studentNote: 'student_note' };

export async function update(staff, applicationId, input) {
    return withTransaction(async (client) => {
        const before = await loadForStaff(client, staff, applicationId);
        const sets = [];
        const values = [];
        for (const [key, column] of Object.entries(COLUMNS)) {
            if (input[key] === undefined) continue;
            values.push(input[key] === '' ? null : input[key]);
            sets.push(`${column} = $${values.length}`);
        }
        if (!sets.length) return view(before);
        values.push(staff.id, now(), applicationId);
        const { rows } = await client.query(
            `UPDATE student_applications SET ${sets.join(', ')}, updated_by = $${values.length - 2}, updated_at = $${values.length - 1}
              WHERE id = $${values.length} RETURNING *`,
            values,
        );
        await audit(client, {
            actorUserId: staff.id, action: 'application.updated', entityType: 'student_application', entityId: applicationId,
            details: { fields: Object.keys(input).filter((k) => input[k] !== undefined), ...(input.status && input.status !== before.status ? { from: before.status, to: input.status } : {}) },
        });
        return view(rows[0]);
    });
}

export async function remove(staff, applicationId) {
    return withTransaction(async (client) => {
        await loadForStaff(client, staff, applicationId);
        await client.query('DELETE FROM student_applications WHERE id = $1', [applicationId]);
        await audit(client, { actorUserId: staff.id, action: 'application.deleted', entityType: 'student_application', entityId: applicationId });
        return { id: applicationId, deleted: true };
    });
}
