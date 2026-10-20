# Role and Permission Matrix

The source of truth is [`backend/src/services/permissions.js`](../backend/src/services/permissions.js).
Every endpoint checks a permission on the server (`requirePermission`), and the
role is read from the database on every request, never from the browser.

## Roles

| Product name | `users.role` | How someone gets it |
|---|---|---|
| Guest | *(no account)* | Visiting the site |
| Registered student | `student` | Signing up (`POST /api/v1/auth/signup` always creates a student) |
| Consultant applicant | `student` + an open row in `consultant_applications` | Applying at `/dashboard/become-consultant`. Not a role. |
| Consultant | `counsellor` | Employee invitation → acceptance → approved `employee_activation` request, or an approved `role_change` |
| Admin | `admin` | Invitation or role change approved by a **super admin** |
| Super admin | `super_admin` | Role change approved by **another** super admin; the first one is created with `npm run create-staff -- --role super_admin` |

A person keeps the same `users.id` for life. Becoming staff changes the role;
losing staff access sets it back to `student`. Student records (consultations,
leads, applications) stay attached to the same id throughout.

## Permissions by role

| Permission | Guest | Student | Consultant | Admin | Super admin |
|---|:-:|:-:|:-:|:-:|:-:|
| Browse public pages, book, send enquiries, resend a booking link | ✓ | ✓ | ✓ | ✓ | ✓ |
| `self.dashboard`, `self.profile`, `self.consultations`, `self.applications` | | ✓ | | | |
| `self.notifications` (notification centre) | | ✓ | ✓ | ✓ | ✓ |
| `consultant_application.apply` | | ✓ (verified email) | | | |
| `staff.workspace` (consultant overview) | | | ✓ | ✓ | ✓ |
| `consultations.assigned`, `students.assigned`, `leads.assigned`, `followups.own`, `availability.own` | | | ✓ | ✓ | ✓ |
| `consultations.all`, `students.all`, `leads.all`, `followups.all`, `availability.all` | | | | ✓ | ✓ |
| `admin.dashboard`, `users.view`, `audit.view` | | | | ✓ | ✓ |
| `users.suspend` (students and consultants) | | | | ✓ | ✓ |
| `users.link_records` (manual identity review) | | | | ✓ | ✓ |
| `consultant_application.review`, `consultant_application.decide` | | | | ✓ | ✓ |
| `employees.view`, `employees.invite` | | | | ✓ | ✓ |
| `approvals.view`, `approvals.request`, `approvals.decide` | | | | ✓ | ✓ |
| `consultation_types.manage`, `notifications.manage` | | | | ✓ | ✓ |
| `roles.privileged` — decide any change to admin/super-admin access; suspend or manage admins | | | | | ✓ |

## Rules that are not a single permission

| Rule | Where it is enforced |
|---|---|
| Consultants see a student only if the student booked with them or the student's enquiry is assigned to them | `access.js#counsellorSeesStudentSql` (shared by every service) |
| Consultants see only enquiries assigned to them and cannot assign | `lead-service.js` |
| Consultants manage only their own tasks and availability | `follow-up-service.js`, `admin-service.js#availabilityScope` |
| Nobody requests a change to their own access | `approval-service.js` **and** the `approval_requests_not_self_requested` constraint |
| Nobody decides a request they made or one about themselves | `approval-service.js` **and** the `approval_requests_not_self_decided` constraint |
| Changes to/from `admin` or `super_admin` need a super admin decider | `permissions.js#mayDecideRoleChange` |
| Only a super admin may suspend or request changes for an admin | `permissions.js#mayManageAccount` |
| Nobody suspends themselves | `user-admin-service.js#setStatus` |
| Super admin is never granted by invitation | `employee_invitations.intended_role` CHECK |
| The last active super admin cannot be removed or suspended | `approval-service.js`, `user-admin-service.js` (defence in depth: through the API a decider is always another super admin) |
| Suspension, role change and revocation end the person's sessions | `sessions.revoked_at` set in the same transaction |

## Page access

Pages check the session and send anyone without the right role to their own
home page (`user.home`); this is a convenience only — the API is the barrier.

| Pages | Roles |
|---|---|
| `dashboard`, `dashboard-consultations`, `dashboard-profile`, `dashboard-become-consultant` | student |
| `dashboard-notifications` | any signed-in user |
| `consultant-dashboard`, `consultant-students`, `consultant-leads`, `consultant-follow-ups`, `admin-consultations`, `admin-students` | consultant, admin, super admin |
| `admin`, `admin-users`, `admin-leads`, `admin-team`, `admin-approvals`, `admin-audit` | admin, super admin |
| `find-booking`, `join-team`, `book-consultation`, `manage-consultation` | anyone |
