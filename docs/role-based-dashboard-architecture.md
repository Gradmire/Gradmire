# Role-Based Dashboards — Architecture

Built on the existing stack without new dependencies: static pages in
`frontend/pages/`, a plain Node.js API in `backend/`, PostgreSQL. See
[`role-based-dashboard-audit.md`](role-based-dashboard-audit.md) for the
starting point, [`role-permissions-matrix.md`](role-permissions-matrix.md) and
[`approval-workflows.md`](approval-workflows.md) for the rules.

## 1. Identity model

- **One account per person, for life.** `users.id` never changes. `users.role` ∈ `student | counsellor | admin | super_admin` is the only role column; "consultant" in the product is `counsellor` in the schema. A guest has no row.
- **Separate profiles per concern:** `student_profiles` (counselling preferences), `employee_profiles` (job, manager, employment status), `counsellors` (working calendar: availability, buffer, calendar id).
- **Single role per person** keeps authorisation simple. A student who becomes staff stops using the student area; their student records stay on the same id and come back into view if access is revoked (role returns to `student`).

## 2. Authorisation layers

```
browser ──► origin check ──► CSRF check ──► session (role re-read from DB) ──► requirePermission(permission)
                                                                         └─► service: ownership / assignment scope in SQL
                                                                         └─► database: CHECK, unique and exclusion constraints
```

1. `routes/context.js` — origin allow-list and per-session CSRF token for every state-changing request (unchanged).
2. `requirePermission(ctx, 'leads.assigned')` — role → permission map in `services/permissions.js`.
3. Services scope every query: `access.js` defines who a counsellor may see (one SQL predicate reused by students, applications, follow-ups and dashboards). Not-yours and not-found both return 404, so ids cannot be probed.
4. The database enforces what must never happen even if code is wrong: the two-person rule on approvals, one open application/request/invitation per person, valid statuses, no overlapping bookings.

The frontend shows each role only its own navigation and redirects people away from pages they may not use, but security does not depend on it.

## 3. Backend modules (new or changed)

| Module | Responsibility |
|---|---|
| `routes/platform-api.js` | New router for workspaces, applications, onboarding, approvals, users, leads, follow-ups, audit. Same validator, error format and CSRF/origin handling as `booking-api.js`. |
| `services/permissions.js` | Roles, permission sets, home page per role, privileged-role rules. |
| `services/access.js` | Assignment-based access predicates and 404 guards. |
| `services/approval-service.js` | Opening, listing and deciding approval requests; executes activation, role change and revocation (with reassignment). |
| `services/employee-service.js` | Invitations, token lookup, acceptance, employee list. |
| `services/consultant-application-service.js` | Applicant and reviewer workflow, private history. |
| `services/user-admin-service.js` | User search/detail, suspension, manual record linking, audit log reader. |
| `services/lead-service.js` | Lead list/detail, status, assignment, contact attempts. |
| `services/follow-up-service.js` | Follow-up tasks (plus consultation-note follow-ups, listed together). |
| `services/dashboard-service.js` | Student profile and overview, consultant overview and students, admin overview. All counts are live queries. |
| `services/inbox.js` | In-app notifications, written in the same transaction as the change. |
| `services/invitation-token.js` | HMAC invitation tokens (hash stored, token re-derived for the email). |
| `admin-service.js` | Reassignment extracted to `reassignInTransaction` so revocation reuses it. |
| `booking-service.js` | Booking leads start as `consultation_booked`; claimed leads become `converted`; `resendManageLinks`. |
| `auth-service.js` | `publicUser.home`; linked-records notification on verification. |
| `notification-*` | Payload-only email templates (invitation, application update, access change, lead assigned, booking link). |

## 4. Database (migration `006_roles_and_approvals.sql`)

| Table / change | Purpose | Key constraints and indexes |
|---|---|---|
| `users.role` | adds `super_admin` | CHECK |
| `users.status_reason/_changed_at/_changed_by` | suspension record | — |
| `student_profiles` | preferences used for counselling | ≤ 5 destinations |
| `user_notifications` | notification centre | `(user_id, created_at)`, partial unread index |
| `consultant_applications` | recruitment record, separate from the account | one open per user (partial unique), status CHECK, `RESTRICT` on user |
| `consultant_application_events` | status history + private notes | — |
| `employee_invitations` | onboarding invitation | token hash unique, one pending per email, role CHECK (no super admin) |
| `employee_profiles` | employment data | `employee_code` unique, status CHECK |
| `approval_requests` | every grant/change/removal of staff access | **`requested_by <> target`**, **`decided_by <> requested_by AND <> target`**, one open per target |
| `approval_events` | request history | — |
| `leads.status/assigned_counsellor_id/next_follow_up_at/last_contacted_at` | lead lifecycle | status CHECK, `(status, created_at)`, `(assigned_counsellor_id, status)`; existing rows backfilled |
| `lead_activities` | contact attempts, notes, assignments, links | — |
| `follow_up_tasks` | tasks linked to student/lead/consultation | `(assignee, status, due_at)` |
| `audit_log` indexes | lookup by record and by actor | `(entity_type, entity_id, created_at)`, `(actor_user_id, created_at)` |

History-bearing foreign keys use `ON DELETE RESTRICT`; the application never deletes accounts. The migration is additive; `006_roles_and_approvals.down.sql` reverses it (manual, after a backup).

## 5. Transactions and concurrency

- Every multi-step change (verification + linking, invitation acceptance + request creation, approval + role + reassignment + session revocation) runs in one transaction; a failure anywhere rolls the whole step back.
- Approvals lock the request and the target row (`FOR UPDATE`) and re-check the target's current role, so two approvers racing cannot apply a stale change.
- Partial unique indexes make duplicate submissions fail cleanly (`409`) instead of creating duplicates (applications, invitations, open requests, employee codes).
- Reassignment runs under a savepoint and relies on the existing exclusion constraint, so it can never double-book the successor.

## 6. Frontend

- `scripts/build-role-pages.mjs` generates the workspace pages from `page-shell.mjs`, like the other generated pages. `scripts/build-dashboard-pages.mjs` now puts `dashboard.html` in the same shell.
- `assets/workspace.js` — session check, role redirect, sidebar per role with unread count, dialogs, drawers, paging, form errors. `assets/workspace.css` — sidebar layout on top of the existing CRM styles.
- `assets/student-area.js` (student + public pages) and `assets/staff-area.js` (consultant + admin pages) render API data; every value is escaped. Links that come from the server are passed through `GradmireAPI.safeNext`.
- Existing CRM pages (`admin-consultations.html`, `admin-students.html`) remain the place for consultations, availability and university applications; the workspaces link to them.

## 7. Notifications

| Event | In-app | Email |
|---|---|---|
| Guest records linked on verification | student | — |
| Consultant application submitted / status changed | applicant (+ admins on submission) | applicant |
| Employee invitation | invitee (if they have an account) | invitee |
| Approval requested | eligible approvers | — |
| Access activated / changed / revoked | person, requester | person |
| Lead assigned | consultant | consultant |
| Work reassigned on revocation | successor | — |
| Follow-up assigned by someone else | assignee | — |
| Booking link resent | — | booking address |

Emails go through the existing outbox (`notifications`): retries with back-off, de-duplication keys, `skipped` (never `sent`) when no provider is configured, and a relevance re-check before sending (an invitation that was revoked or expired is not sent).
