/* Roles and permissions. The role lives on users.role and is re-read from the
   database on every request, so a change takes effect immediately. Guests have
   no account and no role: they only reach public endpoints.

   "Consultant" in the product is the `counsellor` role in the database.
   A consultant applicant is a student with an open consultant application, not
   a separate role. */

export const ROLES = ['student', 'counsellor', 'admin', 'super_admin'];
export const STAFF_ROLES = ['counsellor', 'admin', 'super_admin'];
export const ADMIN_ROLES = ['admin', 'super_admin'];
/* Roles that only a super admin may grant, remove or suspend. */
export const PRIVILEGED_ROLES = ['admin', 'super_admin'];

const STUDENT = [
    'self.dashboard', 'self.profile', 'self.consultations', 'self.applications', 'self.notifications', 'self.documents',
    'consultant_application.apply',
];
const COUNSELLOR = [
    'self.notifications', 'staff.workspace',
    'consultations.assigned', 'students.assigned', 'leads.assigned', 'followups.own', 'availability.own',
    // Documents and email of the students and enquiries they may already see.
    'documents.assigned', 'email.assigned',
];
const ADMIN = [
    ...COUNSELLOR,
    'admin.dashboard', 'consultations.all', 'students.all', 'leads.all', 'followups.all', 'availability.all',
    'users.view', 'users.suspend', 'users.link_records',
    'consultant_application.review', 'consultant_application.decide',
    'employees.view', 'employees.invite',
    'approvals.view', 'approvals.request', 'approvals.decide',
    'audit.view', 'consultation_types.manage', 'notifications.manage', 'integrations.view',
];
const SUPER_ADMIN = [...ADMIN, 'roles.privileged'];

const GRANTS = {
    student: new Set(STUDENT),
    counsellor: new Set(COUNSELLOR),
    admin: new Set(ADMIN),
    super_admin: new Set(SUPER_ADMIN),
};

export const can = (user, permission) => Boolean(user && GRANTS[user.role]?.has(permission));
export const isStaff = (user) => Boolean(user && STAFF_ROLES.includes(user.role));
export const isAdminRole = (role) => ADMIN_ROLES.includes(role);
export const permissionsFor = (role) => [...(GRANTS[role] || [])].sort();

/* Where each role lands after logging in. */
export const HOME_PAGE = {
    student: 'dashboard',
    counsellor: 'consultant-dashboard',
    admin: 'admin',
    super_admin: 'admin',
};

/* May `actor` act on an account that currently holds `targetRole`
   (suspend it, request a change to it)? Privileged accounts need a super admin. */
export function mayManageAccount(actor, targetRole) {
    if (!can(actor, 'users.suspend')) return false;
    return PRIVILEGED_ROLES.includes(targetRole) ? can(actor, 'roles.privileged') : true;
}

/* May `actor` approve a change from `fromRole` to `toRole`? Any change that
   touches admin or super admin access needs a super admin. */
export function mayDecideRoleChange(actor, fromRole, toRole) {
    if (!can(actor, 'approvals.decide')) return false;
    if (PRIVILEGED_ROLES.includes(fromRole) || PRIVILEGED_ROLES.includes(toRole)) return can(actor, 'roles.privileged');
    return true;
}
