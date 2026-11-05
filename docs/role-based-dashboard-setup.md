# Role-Based Dashboards — Setup, Operations and API

Builds on [`consultation-booking-setup.md`](consultation-booking-setup.md),
which covers the base API, database, email, calendar, hosting and cron. This
page lists only what the role-based workspaces add.

## 1. Environment variables

No new variables. The workspaces use the existing ones:

| Variable | Why it matters here |
|---|---|
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | All workspace features need PostgreSQL. |
| `APP_SECRET` (32+ chars, required in production) | Signs invitation tokens as well as verification and manage links. Changing it invalidates outstanding invitations. |
| `SITE_URL`, `SITE_PAGES_PATH` | Links in invitation and application emails. |
| `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM` | Without them, invitation and status emails are recorded as `skipped`, so invitees cannot receive their link — configure email before inviting anyone. |
| `FRONTEND_ORIGIN`, session cookie settings | Unchanged; the site and API must share a site for cookies to work in all browsers (see the booking setup guide, §8). |

## 2. Migration

```bash
cd backend
npm run migrate        # applies 006_roles_and_approvals.sql once
```

Additive and safe on existing data: existing leads get a status (`converted` if linked to an account, `consultation_booked` if from a booking, otherwise `new`). Rollback (manual, after a backup): `psql "$DATABASE_URL_UNPOOLED" -f schema/006_roles_and_approvals.down.sql`.

## 3. First administrators (bootstrap)

```bash
cd backend
STAFF_PASSWORD='…at least 12 characters…' npm run create-staff -- --email hasanryan052@gmail.com --first-name Hasan --role super_admin
```

Create at least two privileged people (two super admins, or a super admin and an admin) so requests can be approved by someone other than the requester. After that, add staff only through **Team and hiring → Invitations**, and change or remove access only through **Users → Request role change / Request access removal**, approved on **Approvals**. Existing staff created by the CLI keep working; they get an employee profile at their first approved change.

## 4. Run locally

```bash
npm run db:local --prefix backend                       # terminal 1: local PostgreSQL
DATABASE_URL=postgres://gradmire:gradmire-local@127.0.0.1:54320/gradmire \
  FRONTEND_ORIGIN=http://localhost:5600 SITE_URL=http://localhost:5600 \
  sh -c 'node backend/scripts/migrate.js && node backend/src/server.js'   # terminal 2: API on :4000
python -m http.server 5600 --directory frontend         # terminal 3: site
# open http://localhost:5600/pages/login.html
```

`.claude/launch.json` has the same three as `booking-db`, `booking-api` and `booking-frontend`.

Rebuild generated pages after editing the build scripts:

```bash
node scripts/build-dashboard-pages.mjs
node scripts/build-role-pages.mjs
node scripts/check-frontend-links.mjs
```

## 5. Tests

```bash
cd backend
npm run check
npm test        # 70 tests, real PostgreSQL (embedded locally, Postgres 16 service in CI)
```

**Live check of staff access** (student → consultant, invitation → admin, consultant → admin, and the two-person rule) against a deployed site. It creates two temporary super admins and `e2e-…@example.com` accounts and deletes them all at the end, along with their applications, invitations, approvals and emails (audit rows stay). Scheduling the interview creates and then removes a real calendar event.

```bash
cd backend
# DATABASE_URL and APP_SECRET must be the target's; the file is git-ignored and excluded by .vercelignore
SITE_URL=https://www.gradmire.com node --env-file=.env.prod-tmp scripts/e2e-roles-live.js
```

It stops before creating anything if the deployed API is out of date. Each run uses two of the six sign-ups allowed per IP per hour, so run it at most three times an hour. `gradmire-api` is linked to GitHub (`Gradmire/Gradmire`, Root Directory `backend/`): every push to `master` deploys it. A dashboard *Redeploy* rebuilds that deployment's own commit, not the latest `master`; for a manual deploy run `vercel deploy --prod` from the repository root, not from `backend/`.

`test/roles.test.js` (21 tests) covers guests, guest → student linking and manual review, the student overview and profile, student/consultant/admin API isolation, the consultant application workflow, onboarding with an existing account, wrong-account and expired invitations, the super-admin rule for admin access, rejection, the two-person rule (service and database), revocation with reassignment, assignment-scoped consultant access, suspension, admin metrics against stored data and the audit log.

## 6. Pages and friendly URLs

`frontend/vercel.json` redirects:

| URL | Page |
|---|---|
| `/dashboard`, `/dashboard/profile`, `/dashboard/notifications`, `/dashboard/become-consultant`, `/dashboard/consultations` | student workspace |
| `/consultant/dashboard`, `/consultant/students`, `/consultant/leads`, `/consultant/follow-ups`, `/consultant/consultations`, `/consultant/availability` | consultant workspace (consultations and availability are the CRM) |
| `/admin`, `/admin/users`, `/admin/leads`, `/admin/consultations`, `/admin/consultant-applications`, `/admin/employees`, `/admin/onboarding`, `/admin/approvals`, `/admin/audit-logs` | admin workspace |
| `/find-booking`, `/join-team`, `/login`, `/register` | public |

## 7. API reference (added endpoints)

All responses use `{ data }` or `{ error, code, fields? }`. Lists accept `page` and `page_size` (≤ 100). State-changing requests need the session's `X-CSRF-Token`.

**Public**

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/consultations/manage/resend` | `{ email }`. Same answer for every address; rate limited per IP and per email. |
| POST | `/api/v1/employee-invitations/lookup` | `{ token }` → job title, department, masked invited email. |

**Any signed-in user**

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/me/notifications?unread=true` | `{ items, unread }` |
| POST | `/api/v1/me/notifications/read` | `{ ids? }` — omit to mark all |
| POST | `/api/v1/me/employee-invitations/accept` | `{ token }`; verified account that owns the invited email |

**Student**

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/me/dashboard` | overview: profile completion, next consultation, counts, deadlines, notifications, next steps |
| GET, PATCH | `/api/v1/me/profile` | email/role/status are never writable |
| GET, POST | `/api/v1/me/consultant-applications` | POST needs `consent: true` and a verified email |
| GET, PATCH | `/api/v1/me/consultant-applications/:id` | PATCH only while `submitted` / `info_requested` |
| POST | `/api/v1/me/consultant-applications/:id/withdraw` | |

**Consultant (and admins, for their own work)**

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/consultant/dashboard?timezone=` | today, next 7 days, counts, deadlines, new enquiries |
| GET | `/api/v1/consultant/students?q=&destination=&sort=` | assigned students (admins: all) |
| GET, POST | `/api/v1/consultant/follow-ups` | `status=open|done|cancelled|all` |
| PATCH | `/api/v1/consultant/follow-ups/:id` | |
| GET | `/api/v1/admin/leads?status=&source=&assigned=&guest=&follow_up_due=&q=` | counsellors: assigned only |
| GET, PATCH | `/api/v1/admin/leads/:id` | assigning (`assignedCounsellorId`) is admin-only |
| POST | `/api/v1/admin/leads/:id/activities` | `kind: note | contact_attempt` |

**Admin**

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/admin/overview` | live platform figures |
| GET | `/api/v1/admin/staff` | active staff for pickers |
| GET | `/api/v1/admin/users?q=&role=&status=` | |
| GET | `/api/v1/admin/users/:id` | profiles, requests, history, possible duplicates |
| PATCH | `/api/v1/admin/users/:id/status` | `{ status: active|disabled, reason }` |
| POST | `/api/v1/admin/users/:id/link-record` | `{ leadId | consultationId, reason }` |
| POST | `/api/v1/admin/users/:id/role-change-requests` | `{ requestedRole, reason }` |
| POST | `/api/v1/admin/users/:id/revocation-requests` | `{ reason, reassignToCounsellorId? }` |
| GET | `/api/v1/admin/consultant-applications?status=` | |
| GET | `/api/v1/admin/consultant-applications/:id` | includes private history |
| POST | `/api/v1/admin/consultant-applications/:id/transition` | `{ status, note?, message?, interviewAt?, job? }` |
| POST | `/api/v1/admin/consultant-applications/:id/notes` | private note |
| POST | `/api/v1/admin/consultant-applications/:id/reviewer` | `{ reviewerId }` |
| GET | `/api/v1/admin/employees?status=` | |
| GET, POST | `/api/v1/admin/employees/invitations` | |
| POST | `/api/v1/admin/employees/invitations/:id/revoke` | |
| GET | `/api/v1/admin/approvals?status=&type=` | |
| GET | `/api/v1/admin/approvals/:id` | includes history and the target's open work |
| POST | `/api/v1/admin/approvals/:id/approve` \| `reject` \| `request-information` \| `respond` \| `cancel` | `{ comment }` (required to reject, ask or respond) |
| GET | `/api/v1/admin/audit-logs?action=&entity_type=&entity_id=&actor_id=&from=&to=` | |

## 8. Operations

- **Someone leaves:** Users → their account → *Request access removal*, choosing who takes over. A second admin approves on Approvals. Their sessions end immediately; history stays.
- **Urgent lock-out:** Users → *Suspend account* (immediate, no approval). Follow with a revocation request.
- **Invitation not received:** check Admin overview → *Undelivered emails* and the email outbox (`GET /api/v1/admin/notifications?status=skipped`, retry with `POST /api/v1/admin/notifications/:id/retry`); revoke and re-invite if the address was wrong.
- **New consultant has no slots:** availability starts empty; they add hours in Consultations and availability.

## 9. Known limitations

- Gmail, Drive and Meet need the Google Workspace setup in [`google-workspace-setup.md`](google-workspace-setup.md); until then the dashboards say which features are not connected.
- **Phone OTP** and **WhatsApp** are not implemented (no provider chosen); identity rests on verified email.
- Staff accounts have no profile page yet, so a staff member's login email is changed by an administrator (the API endpoint works for any account).
- **Cross-site cookies:** production now serves the API through the site's own origin (`/gm-api`), which avoids third-party cookie blocking.
