/* Assignment-based access for counsellors, defined once. A counsellor may see a
   student who booked a consultation with them, or whose enquiry (lead) is
   assigned to them. Admins see everyone. */
import { isAdminRole } from './permissions.js';
import { notFound } from '../lib/http.js';

/* SQL condition: may the counsellor in parameter `param` see the student row aliased `alias`? */
export const counsellorSeesStudentSql = (alias, param) => `(
  EXISTS (SELECT 1 FROM consultations sc WHERE sc.student_user_id = ${alias}.id AND sc.counsellor_id = ${param})
  OR EXISTS (SELECT 1 FROM leads sl WHERE sl.user_id = ${alias}.id AND sl.assigned_counsellor_id = ${param}))`;

/* null for admins (no restriction), otherwise the counsellor's own id. */
export const counsellorScope = (staff) => (isAdminRole(staff.role) ? null : staff.id);

/* Throws 404 (same as "no such student") unless `staff` may see `studentId`. */
export async function assertStudentAccess(client, staff, studentId) {
    const { rows } = await client.query(
        `SELECT u.id FROM users u WHERE u.id = $1 AND u.role = 'student'
           AND ($2::uuid IS NULL OR ${counsellorSeesStudentSql('u', '$2')})`,
        [studentId, counsellorScope(staff)],
    );
    if (!rows.length) throw notFound('Student not found');
}

/* Throws 404 unless `staff` may see the lead. */
export async function assertLeadAccess(client, staff, leadId) {
    const { rows } = await client.query(
        'SELECT * FROM leads WHERE id = $1 AND ($2::uuid IS NULL OR assigned_counsellor_id = $2)',
        [leadId, counsellorScope(staff)],
    );
    if (!rows.length) throw notFound('Enquiry not found');
    return rows[0];
}

/* Throws 404 unless `staff` may see the consultation. */
export async function assertConsultationAccess(client, staff, consultationId) {
    const { rows } = await client.query(
        'SELECT * FROM consultations WHERE id = $1 AND ($2::uuid IS NULL OR counsellor_id = $2)',
        [consultationId, counsellorScope(staff)],
    );
    if (!rows.length) throw notFound('Consultation not found');
    return rows[0];
}
