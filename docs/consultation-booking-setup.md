# Consultation Booking — Setup, Operations and Deployment

This guide covers the consultation booking system: accounts, the public booking
page, the student area, the staff CRM, calendar sync, email, background jobs,
tests and deployment. The before-state audit is in
[`consultation-booking-audit.md`](consultation-booking-audit.md).

---

## 1. What it does

1. A visitor opens **`/book-consultation`** (`frontend/pages/book-consultation.html`), picks a
   consultation type, a meeting method, a date and a time, and enters contact details.
   Registration is not required.
2. The API validates everything, **recomputes availability on the server** and inserts
   the booking. A PostgreSQL exclusion constraint makes double-booking impossible, even
   for simultaneous requests.
3. If Google Calendar is configured for the counsellor, the booking is **reserved**
   until the calendar event exists, then becomes **confirmed**. Without a calendar it is
   confirmed straight away. The response tells the student which state applies, and a
   meeting link is shown only if one was really generated.
4. Confirmation emails, counsellor notices and reminders (24 h and 1 h before) are queued
   in the database and delivered by the worker. Failures are recorded and retryable.
   Without an email provider they are recorded as `skipped`, never as `sent`.
5. Students with an account see bookings at **`/dashboard/consultations`**. Guests get a
   private manage link (`manage-consultation.html#token=…`) to view, reschedule or cancel,
   and can later add the booking to an account.
6. Staff use **`/admin/consultations`**: overview counts, search and filters, detail
   drawer, status changes, reassignment (admins), private notes, outcomes, follow-up
   tasks, message log with retry, calendar retry, and availability management.

### Booking states

| Status | Meaning | Set by |
|---|---|---|
| `reserved` | Slot held; calendar event not created yet | System on booking |
| `confirmed` | Slot held and calendar synced (or no calendar needed) | System, or staff "Confirm manually" |
| `completed` / `no_show` | After the start time | Staff |
| `cancelled` | Cancelled by student, guest link or staff | — |
| `rescheduled` | Superseded by a new booking (`rescheduled_from_id` links them) | System |

`calendar_status` is tracked separately: `not_required`, `pending`, `synced`, `failed`.

### Policy (configurable)

- Slots every `BOOKING_SLOT_STEP_MINUTES` (30). Each consultation type has its own
  duration, minimum notice (default 3 h) and booking horizon (default 60 days).
- Students and guests can cancel or reschedule up to `BOOKING_CHANGE_CUTOFF_HOURS` (24)
  before the start, and reschedule at most `BOOKING_MAX_RESCHEDULES` (2) times. Staff
  are not limited by the cutoff.
- Each counsellor has a buffer after every booking (default 10 min).

## 2. Architecture

```
frontend/pages/*.html  ──fetch (credentials: include, X-CSRF-Token)──▶  backend (node:http)
  book / manage / dashboard / admin                                    src/app.js → routes/booking-api.js
  assets/api.js, booking-common.js, booking.js, …                        │  validate, guards (lib/, routes/context.js)
                                                                         ▼
                                       services/  auth · booking · availability · admin · calendar-sync · notification · jobs
                                                                         │  SQL (pg), transactions, outbox rows
                                                                         ▼
                                                   PostgreSQL (schema/004_consultation_booking.sql)
                                                                         ▲
                 worker: GET /api/v1/internal/jobs/run (cron) or `npm run worker`  ─▶ integrations/calendar (Google) · integrations/email (Resend)
```

- **Routes** only parse input and apply guards. **Services** hold the business rules.
  **Integrations** are provider adapters behind small interfaces, so tests use fakes.
- **Outbox**: every booking change writes its calendar job and notifications in the same
  transaction. The worker claims rows with `FOR UPDATE SKIP LOCKED`, so several workers
  are safe.
- After a booking, the API spends up to `BOOKING_INLINE_SYNC_TIMEOUT_MS` (8 s) trying to
  finish calendar sync and send the first emails, so most bookings return `confirmed`.
  Anything unfinished is picked up by the worker.

### Concurrency and integrity

| Risk | Protection |
|---|---|
| Two people book the same counsellor and time | `EXCLUDE USING gist (counsellor_id WITH =, tstzrange(scheduled_start, blocked_until) WITH &&) WHERE status IN ('reserved','confirmed')`. The losing insert fails, the next free counsellor is tried, otherwise 409 `SLOT_UNAVAILABLE`. |
| Same person double-submits | Second exclusion constraint on `LOWER(student_email)` and time range (409 `STUDENT_OVERLAP`), plus the `Idempotency-Key` header (unique column; replays return the original booking, and a key reused with different data gets 422). |
| Client claims a slot is free | Server recomputes slots from rules, exceptions, bookings, buffers, notice and calendar free/busy before inserting. |
| Cancel/reschedule races | Row lock (`SELECT … FOR UPDATE`). The old slot is released and the new one inserted in one transaction; on failure everything rolls back. `rescheduled_from_id` is unique. |
| Calendar timeout after the event was written | Deterministic event id (`gm<uuid>g<generation>`); a retry gets 409 and re-reads the existing event. One job row per (booking, action, generation). |
| Calendar down | Booking stays `reserved` (no false confirmation). Retries with exponential back-off (6 attempts). Then `calendar_status = failed`, an optional staff alert, and the CRM shows it with a retry button. |
| Email retried | `notifications.dedupe_key` is unique, and Resend's `Idempotency-Key` stops duplicate deliveries. |
| Timezones | All instants stored as `timestamptz` (UTC). The student's IANA zone is kept for display. Availability rules are wall-clock times in the counsellor's zone, so DST is handled. Input times must carry an explicit offset. |

## 3. Database

Migration **`backend/schema/004_consultation_booking.sql`** (additive; no existing data
is changed except adding nullable columns to `leads` and allowing `source = 'booking'`):

| Table | Purpose |
|---|---|
| `users` | Accounts: scrypt `password_hash`, `role` (`student`/`counsellor`/`admin`), `email_verified_at`, lockout fields |
| `sessions` | SHA-256 hashes of session and CSRF tokens, expiry, revocation |
| `email_verification_tokens` | Hash of single-use, 48 h verification tokens |
| `leads` (+`user_id`, `preferred_course`, `updated_at`) | Existing table, reused for booking leads |
| `consultation_types` | Configurable catalogue (seeded with the 5 Gradmire types) |
| `counsellors` | Staff profile: display name, timezone, buffer, Google calendar id, active |
| `availability_rules` | Weekly hours per counsellor (split a day into several rules for breaks), effective date range |
| `availability_exceptions` | Date-specific unavailable periods |
| `consultations` | The bookings (see constraints above) |
| `consultation_notes` | Private staff notes, outcomes, follow-up tasks (never returned to students) |
| `consultation_events` | Appointment history |
| `calendar_sync_jobs`, `notifications` | Outbox queues |
| `audit_log` | Staff and account actions |
| `rate_limits` | Shared fixed-window counters (HMAC'd keys; no raw IPs stored) |

Requires the `btree_gist` extension (the migration runs `CREATE EXTENSION IF NOT EXISTS
btree_gist`; it is available on Neon and standard PostgreSQL 13+).

**Apply migrations**

```bash
cd backend
DATABASE_URL=postgres://… npm run migrate
```

The runner applies each `schema/NNN_*.sql` once, inside a transaction, under an advisory
lock. A second run is a no-op. Production Vercel builds run it automatically
(`vercel-build`); preview builds skip it.

**Rollback** (manual, destructive for booking data, never automatic): back up first,
then run `schema/004_consultation_booking.down.sql` with `psql`. It drops only the
tables added by 004, keeps every lead, and removes the 004 row from `schema_migrations`.

## 4. Environment variables

All are documented in [`backend/.env.example`](../backend/.env.example). The server
reads the process environment; it does not load `.env` files itself.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Pooled URL. Booking returns 503 without it. |
| `DATABASE_URL_UNPOOLED` | Neon | Direct URL for migrations |
| `APP_SECRET` | **Production** | 32+ random chars. Signs manage/verification links and rate-limit keys. In production, requests that need it fail with an error until it is set. |
| `FRONTEND_ORIGIN` | Yes | Comma-separated site origins allowed by CORS (with credentials) and the Origin check |
| `SITE_URL`, `SITE_PAGES_PATH` | Yes | Used to build links in emails (`https://gradmire.com` + `/pages`) |
| `CRON_SECRET` | Yes | Bearer token for the job endpoint |
| `SESSION_COOKIE_SAMESITE` | Optional | `Lax` (default). `None` only for a cross-site API (see §8). |
| `SESSION_COOKIE_SECURE` | Optional | Defaults on in production |
| `SESSION_TTL_HOURS` | Optional | 168 |
| `TRUST_PROXY` | Optional | On by default on Vercel (reads `X-Forwarded-For`) |
| `BOOKING_*` | Optional | Policy knobs in §1 |
| `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | For email | `EMAIL_FROM` must use a domain verified in Resend |
| `ADMIN_ALERT_EMAIL` | Optional | Receives calendar-failure alerts |
| `CALENDAR_PROVIDER=google`, `GOOGLE_*` | For calendar | §6 |
| `ADMIN_API_TOKEN` | Existing | Still protects `GET /api/v1/leads` |

Never put any of these in frontend files. The frontend only knows the API base URL.

## 5. Accounts and staff

- **Students** sign up on `signup.html`. The server always creates `role = student`.
  Login, logout, verification and sessions are server-side. The cookie is `HttpOnly`,
  `SameSite=Lax`, and in production `Secure` with the `__Host-` prefix.
- **Account linking.** A guest booking joins an account only through verified identity:
  1. on email verification, guest bookings and leads made with that exact email are
     linked; or
  2. "Add this booking to my dashboard" on the manage page, which requires the manage
     link **and** a verified account email that matches the booking.

  A name or a typed-in email never links anything.
- **Sign in with Google** (`GOOGLE_CLIENT_ID`): the Google button on login and sign-up
  posts Google's signed ID token to `POST /api/v1/auth/google`. The server verifies the
  signature (Google's published keys), issuer, audience, expiry and that Google verified
  the email, then:
  - logs in the account already linked to that Google identity; or
  - links an account with the same email. If that account's email was never verified,
    its password and sessions are revoked first, to stop pre-registration takeover.
  - Otherwise it creates a verified student account, after the person confirms their age.

  Guest bookings with that email are linked. Setup: `docs/go-live-checklist.md` §3.
- **Password reset**: *Forgot password?* on the login page →
  `reset-password.html` → `POST /api/v1/auth/password-reset/request`.
  - The answer is the same whether or not the account exists.
  - The emailed link is single-use and expires after 60 minutes. Only the newest link
    works.
  - `/confirm` sets the new password, signs out every session, verifies the email
    and sends a "password changed" email.
  - Google-only accounts can use it to add a password.
- **Staff** accounts are never created through the public API. Use the CLI:

```bash
cd backend
DATABASE_URL=… STAFF_PASSWORD='a-long-unique-password' npm run create-staff -- \
  --email priya@gradmire.com --first-name Priya --last-name Mehta --role counsellor \
  --timezone Asia/Kolkata --calendar-id priya@gradmire.com
```

  Counsellors get Mon–Sat 10:00–18:00 in their timezone (change it in the CRM, or pass
  `--no-default-hours`). Admins get a non-bookable counsellor profile. Without
  `STAFF_PASSWORD`, a random password is printed once. `--promote` turns an existing
  account into staff. Staff log in at `/admin/consultations` (or `login.html`).

### Roles

| Action | Student | Counsellor | Admin |
|---|---|---|---|
| Own bookings: view, cancel, reschedule (policy applies) | ✓ | — | — |
| CRM list, detail, notes, status, outcome, meeting link | — | Assigned only | All |
| Reassign counsellor, manage types, notification log/retry | — | — | ✓ |
| Availability | — | Own | All |

Everything is enforced in the API. Records you are not allowed to see return 404, so ids
cannot be probed.

## 6. Google Calendar (optional)

1. In Google Cloud, create a project, enable the **Google Calendar API**, create a
   **service account** and a JSON key.
2. Either **share** each counsellor's calendar with the service account email ("Make
   changes to events"), **or** (Google Workspace) grant **domain-wide delegation** for scope
   `https://www.googleapis.com/auth/calendar` and set `GOOGLE_CALENDAR_IMPERSONATE` to a
   Workspace user who can write those calendars.
3. Set `CALENDAR_PROVIDER=google`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`,
   `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (the key's `private_key`, newlines as `\n`).
4. Give each counsellor a calendar id (`create-staff --calendar-id`, usually their email).
   Counsellors without one are confirmed without a calendar.
5. Optional: `GOOGLE_CALENDAR_CREATE_MEET=true` (video bookings get a Meet link) and
   `GOOGLE_CALENDAR_INVITE_ATTENDEES=true` (student invited by Google).

**Provider limitations.** Service accounts without domain-wide delegation generally
cannot create Meet links or invite attendees; leave both flags `false` in that case.
Students still get the confirmation email and an `.ics` / Google Calendar link. Meet
creation can be asynchronous: if Google does not return a link, none is shown, and staff
can add one manually in the CRM. Free/busy lookups are best-effort; if Google is down,
slots come from the database only (the booking itself is still protected).

## 7. Email (Resend) and WhatsApp

1. Create a Resend account, verify your sending domain, create an API key.
2. Set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM="Gradmire <info@gradmire.com>"`.
3. Messages: booking confirmed or rescheduled (with manage link), cancelled, reminders,
   counsellor notices, email verification, staff calendar alerts.
4. Students opt in or out of reminders on the booking form. Transactional messages need
   the contact consent the form requires. Marketing opt-in is stored separately on the lead.
5. **Existing notifications are not resent automatically after you configure the
   provider.** Rows recorded as `skipped` can be retried individually from the CRM.

**WhatsApp** is intentionally not active (email-only was chosen).
`src/integrations/whatsapp/index.js` documents the boundary. Meta WhatsApp Cloud API needs
a business account, approved templates and explicit opt-in. Add a provider there and
queue `channel: 'whatsapp'` rows.

## 8. Hosting the site and API together (important for logins)

The site (`gradmire-1nfj.vercel.app`) and API (`gradmire-api.vercel.app`) are different
*sites* (`vercel.app` is on the Public Suffix List). Browsers treat the session cookie as
third-party there and Safari, Firefox and privacy-mode Chrome will drop it, so **logins
will not work reliably on the two default `*.vercel.app` hosts.** Guest booking does not
need cookies and works everywhere. Pick one:

- **Recommended:** custom domains on one registrable domain, e.g. site `gradmire.com` and
  API `api.gradmire.com`. Set `FRONTEND_ORIGIN=https://gradmire.com`,
  `SITE_URL=https://gradmire.com`, and add
  `<meta name="gm-api-base" content="https://api.gradmire.com">` (or change
  `PRODUCTION_API` in `frontend/assets/api.js`). Keep `SameSite=Lax`.
- Or serve the API under the site's own origin (a working `/api` rewrite or proxy).
- Last resort: `SESSION_COOKIE_SAMESITE=None` (forces `Secure`). It works only where the
  browser allows third-party cookies.

## 9. Background jobs

The worker does calendar sync and retries, notification delivery and reminders,
reconciliation, and rate-limit and session cleanup. Run it every few minutes, in one of
three ways:

- **Vercel Cron (Pro plan):** add to `backend/vercel.json`
  `"crons": [{ "path": "/api/v1/internal/jobs/run", "schedule": "*/5 * * * *" }]`. Vercel
  sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set.
  Do not add this on Hobby: Hobby only allows daily crons and the deploy fails.
- **GitHub Actions (free):** `.github/workflows/booking-jobs.yml` calls the endpoint every
  10 minutes once the repo secrets `BOOKING_JOBS_URL`
  (`https://<api>/api/v1/internal/jobs/run`) and `CRON_SECRET` exist. GitHub can delay
  scheduled runs, so 1-hour reminders may arrive a few minutes late.
- **Long-running host:** `npm run worker` (`WORKER_INTERVAL_SECONDS`, default 60).

Manual run: `curl -H "Authorization: Bearer $CRON_SECRET" https://<api>/api/v1/internal/jobs/run`.

## 10. Local development

```bash
# 1. Database (real PostgreSQL via the embedded-postgres dev dependency, no Docker)
cd backend
npm install
npm run db:local                      # leave running; prints DATABASE_URL

# 2. API (new terminal)
cd backend
export DATABASE_URL=postgres://gradmire:gradmire-local@127.0.0.1:54320/gradmire
export FRONTEND_ORIGIN=http://localhost:8080 SITE_URL=http://localhost:8080 CRON_SECRET=local-cron
npm run migrate
STAFF_PASSWORD='choose-a-local-password' npm run create-staff -- --email you@gradmire.test --first-name You --role admin
STAFF_PASSWORD='choose-another-one' npm run create-staff -- --email counsellor@gradmire.test --first-name Priya --role counsellor
npm start                             # http://localhost:4000

# 3. Site (new terminal, repository root)
python -m http.server 8080 --directory frontend
# open http://localhost:8080/pages/book-consultation.html
```

Pages on `localhost` call `http://localhost:4000` automatically (`assets/api.js`).
Without an email provider, messages show as `skipped` in the CRM. Run jobs locally with
`curl -H "Authorization: Bearer local-cron" http://localhost:4000/api/v1/internal/jobs/run`.

The booking pages are generated: edit `scripts/build-booking-pages.mjs`, then run
`node scripts/build-booking-pages.mjs` from the repository root.

## 11. Tests

```bash
cd backend
npm run check      # syntax check of every backend file
npm test           # node:test, 45 tests against real PostgreSQL
```

`npm test` uses `TEST_DATABASE_URL` if set (CI uses the workflow's Postgres service).
Otherwise it starts an embedded PostgreSQL 16. Each test file creates and drops its own
database and applies migrations with the real script (twice, to prove idempotency).
Calendar and email are replaced by in-memory fakes. The clock is fixed so slot and
policy tests are deterministic.

Coverage, mapped to the brief:

| # | Scenario | Test |
|---|---|---|
| 1–10 | Guest, student, invalid input, inactive type, unavailable slot, concurrency (8 parallel requests → 1 booking), idempotency, timezones, cancel policy, safe reschedule (+ concurrent reschedules) | `test/booking.test.js` |
| 11–16 | Cross-student access, self-promotion to admin, protected fields, anonymous/student admin access, counsellor scoping, forged/expired/revoked sessions, lockout, CSRF and Origin, cookie flags, cron secret, unverified-email linking | `test/security.test.js` |
| 17–22 | Persistence, calendar failure stays reserved → failed → staff retry, lost-response retry makes one event, reschedule/cancel update the calendar, external busy times, notification failure → retry → exactly one delivery, skipped without provider, reminder timing, dashboard and CRM data match the DB, reassignment, availability and type management, staff CLI | `test/integration.test.js` |
| — | DST and timezone helpers | `test/time.test.js` |

CI (`.github/workflows/test.yml`) now also runs `npm test` and syntax-checks the new
frontend scripts.

## 12. Deployment checklist

1. Back up the Neon database (branch or snapshot).
2. API project env (Production): `APP_SECRET`, `CRON_SECRET`, `FRONTEND_ORIGIN`,
   `SITE_URL`, optionally `EMAIL_*`, `CALENDAR_*`, `ADMIN_ALERT_EMAIL`.
3. Deploy the API (`cd backend && vercel deploy --prod`). The build runs migration 004.
   Check `GET /api/v1/consultation-types` returns 5 types.
4. Create staff with `npm run create-staff` against the production `DATABASE_URL_UNPOOLED`.
5. Set up the scheduler (§9).
6. Resolve same-site hosting (§8) before announcing student logins.
7. Deploy the site. `frontend/vercel.json` redirects `/book-consultation`,
   `/dashboard/consultations` and `/admin/consultations` to the pages.
8. Smoke test: book as a guest, see it in the CRM, cancel it from the manage link.

## 13. API reference

All responses are `{ "data": … }` or `{ "error", "code", "fields"? }`. State-changing
requests from a signed-in browser need `X-CSRF-Token` (from `GET /auth/session`).

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /api/v1/auth/session` | — | Current user (or null) and a fresh CSRF token |
| `POST /api/v1/auth/signup` · `login` · `logout` | — | Accounts (rate-limited) |
| `POST /api/v1/auth/verify-email/request` · `confirm` | user · — | Email verification |
| `GET /api/v1/consultation-types` | — | Active types |
| `GET /api/v1/availability?consultation_type_id&date&timezone[&counsellor_id]` | — | Genuinely free slots for that local date |
| `POST /api/v1/consultations` (+`Idempotency-Key`) | optional | Create booking |
| `POST /api/v1/consultations/manage/lookup` · `cancel` · `reschedule` | manage token | Guest self-service |
| `GET /api/v1/me/consultations` · `/:id` | student | Own bookings |
| `POST /api/v1/me/consultations/:id/cancel` · `/reschedule` · `/claim` | student | Changes and claiming |
| `GET /api/v1/admin/consultations` (`page`, `page_size`, `status`, `consultation_type_id`, `counsellor_id`, `from`, `to`, `q`, `calendar_status`, `sort`) | staff | List |
| `GET /api/v1/admin/consultations/summary` · `/:id` | staff | Overview, detail |
| `PATCH /api/v1/admin/consultations/:id` (`status`, `counsellorId`, `outcome`, `meetingUrl`, `cancellationReason`) | staff (reassign: admin) | Update |
| `POST /api/v1/admin/consultations/:id/notes` · `/notes/:noteId/complete` · `/calendar-sync` | staff | Notes, follow-ups, calendar retry |
| `GET/POST /api/v1/admin/availability`, `DELETE /api/v1/admin/availability/:kind/:id` | staff (own) / admin | Rules and exceptions |
| `GET /api/v1/admin/counsellors` | staff | Counsellors |
| `GET/POST /api/v1/admin/consultation-types`, `PATCH /…/:id` | staff / admin | Catalogue |
| `GET /api/v1/admin/notifications`, `POST /…/:id/retry` | admin | Delivery log and retry |
| `GET\|POST /api/v1/internal/jobs/run` | `CRON_SECRET` | Worker pass |
| `GET /api/v1/auth/google/config`, `POST /api/v1/auth/google` | — | Sign in with Google |
| `POST /api/v1/auth/password-reset/request` · `confirm` | — | Password reset (rate-limited) |
| `GET /api/v1/admin/retention` | admin | Retention settings and records due |

Existing `GET /api/v1/health`, `GET/POST /api/v1/leads` are unchanged.

## 14. Known limitations and remaining work

- **Cross-site cookies** on the default Vercel hosts (§8). This must be resolved for
  student logins in production.
- **Google sign-in** and **password reset** work end to end in tests (signed test tokens,
  fake mailbox) but need `GOOGLE_CLIENT_ID` and Resend before they work for real
  (`docs/go-live-checklist.md`).
- Email delivery and Google Calendar have been tested with fakes only. **Live
  credentials have not been exercised.** Run the smoke test in §12 after configuring them.
- Rate limits are per IP/email fixed windows in PostgreSQL. Consider a CAPTCHA if spam
  appears (none is added, to avoid third-party scripts).
- Staff accounts have no 2FA. The admin UI has no user management (CLI only).
- **Data retention** (`services/retention-service.js`) is built but **off** until
  `RETENTION_ENABLED=true`. When on, each worker pass anonymises:
  - guest consultations that ended more than `RETENTION_CONSULTATION_MONTHS` (24) ago;
  - leads without an account untouched for `RETENTION_LEAD_MONTHS` (24), except live
    newsletter subscribers and leads with recent or active bookings.

  It also deletes expired tokens. Account-owned history is kept while the account exists.
  `GET /api/v1/admin/retention` previews the counts. The periods need owner and legal
  sign-off.
- Reminder timing depends on the scheduler frequency (§9).
- Reassigning to another counsellor checks overlaps but not that counsellor's working hours
  (an admin override, by design).
