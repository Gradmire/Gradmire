# Go-live checklist: booking, accounts and Google sign-in

Work through this in order. Each step says **who** does it: steps marked *you* need
your own accounts (domain registrar, Vercel, Google, Resend, GitHub). Nothing here can
be done with placeholder credentials. Background detail is in
[`consultation-booking-setup.md`](consultation-booking-setup.md) and
[`role-based-dashboard-setup.md`](role-based-dashboard-setup.md).

## 0. Before anything (you)

- [ ] Back up the production Neon database (Neon console → Branches → *Create branch*
      from `main`, name it `pre-booking-launch`).
- [ ] Decide the data-retention periods with whoever owns privacy and legal (defaults: 24
      months for guest bookings and for leads without an account). Retention stays **off**
      until you set `RETENTION_ENABLED=true`.

## 1. Domains: site and API on one site (you), required for logins

Logins use an HttpOnly cookie. On the two default hosts (`gradmire-1nfj.vercel.app` and
`gradmire-api.vercel.app`), browsers treat it as a third-party cookie and Safari and
privacy-mode browsers drop it.

1. [ ] Vercel → project **gradmire** (the site) → *Settings → Domains* → add `gradmire.in`
       (and `www.gradmire.in` redirecting to it).
2. [ ] Vercel → project **gradmire-api** → *Settings → Domains* → add `api.gradmire.in`.
3. [ ] At your DNS provider, add the records Vercel shows (an `A`/`ALIAS` record for the apex
       and `CNAME api → cname.vercel-dns.com`). Wait until both show "Valid".
4. [ ] Point the site at the new API: in `frontend/assets/api.js` set
       `const PRODUCTION_API = 'https://api.gradmire.in';` (*me or you*: a one-line change).

## 2. API environment variables (you, in Vercel → gradmire-api → Settings → Environment Variables, Production)

Generate secrets locally with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

| Variable | Value |
|---|---|
| `APP_SECRET` | a new random value (never reuse; changing it invalidates emailed links) |
| `CRON_SECRET` | another new random value |
| `FRONTEND_ORIGIN` | `https://gradmire.in` (add `,https://www.gradmire.in` if used) |
| `SITE_URL` | `https://gradmire.in` |
| `GOOGLE_CLIENT_ID` | from step 3 |
| `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM` | from step 4 |
| `ADMIN_ALERT_EMAIL` | the inbox that should hear about calendar failures |
| `RETENTION_ENABLED` | `false` for now (see step 0) |

`DATABASE_URL`, `DATABASE_URL_UNPOOLED` and `ADMIN_API_TOKEN` already exist.

## 3. Sign in with Google (you)

1. [ ] Google Cloud Console → create or choose a project → *APIs & Services → OAuth consent
       screen*: user type **External**, app name "Gradmire", support email, logo optional,
       authorised domain `gradmire.in`, scopes: only the defaults (`openid`, `email`,
       `profile`). Publish the app (until it is published, only listed test users can sign in).
2. [ ] *Credentials → Create credentials → OAuth client ID → Web application*.
       **Authorised JavaScript origins:** `https://gradmire.in` (plus
       `http://localhost:8080` and `http://localhost:5600` for local testing).
       No redirect URI is needed (the button uses a popup).
3. [ ] Copy the **Client ID** (`…apps.googleusercontent.com`) into `GOOGLE_CLIENT_ID`. The
       client **secret** is not used; do not store it anywhere.

How it behaves:
- A returning Google user signs straight in.
- A Google user whose email matches an existing account is linked to it. If that
  account's email was never verified, its old password and sessions are revoked first,
  because Google has just proved who owns the address.
- A new Google user must confirm their age, then gets a student account with a verified
  email. Bookings made earlier as a guest with that email appear in their dashboard.
- Without `GOOGLE_CLIENT_ID`, the button tells people to use email and password.

## 4. Email through Resend (you)

1. [ ] resend.com → *Domains → Add* `gradmire.in` → add the DNS records it lists (SPF/DKIM)
       → wait for "Verified".
2. [ ] *API Keys → Create* (permission: *Sending access*, domain `gradmire.in`).
3. [ ] Set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY=…`,
       `EMAIL_FROM=Gradmire <consultations@gradmire.in>`, optionally `EMAIL_REPLY_TO`.

Without this, booking confirmations, verification and **password reset emails are not
sent** (they are recorded as "skipped" in the CRM).

## 5. Google Calendar (optional, you)

Follow §6 of `consultation-booking-setup.md`. Skip it to launch without calendar
invites: bookings confirm from the database and students get an `.ics` file.

## 6. Deploy (me or you)

```bash
cd backend
vercel deploy --prod          # runs migrations 004–007 on the production database
```

Then create the first super admin and counsellors against production (use the
**unpooled** URL; the password is your choice and is never printed when you set it):

```bash
DATABASE_URL="<DATABASE_URL_UNPOOLED>" STAFF_PASSWORD='…' npm run create-staff -- --email you@gradmire.in --first-name You --role super_admin
DATABASE_URL="<DATABASE_URL_UNPOOLED>" STAFF_PASSWORD='…' npm run create-staff -- --email priya@gradmire.in --first-name Priya --last-name Mehta --role counsellor
```

Deploy the site (push to the branch Vercel builds, or `vercel deploy --prod` from `frontend/`).

## 7. Background jobs (you)

Pick one (details in §9 of the setup guide):
- [ ] **GitHub Actions (free):** repository → *Settings → Secrets and variables → Actions* →
      add `BOOKING_JOBS_URL = https://api.gradmire.in/api/v1/internal/jobs/run` and
      `CRON_SECRET` (same value as the API). The workflow `booking-jobs.yml` runs every 10
      minutes once it is on the default branch.
- [ ] **Vercel Pro:** add the cron entry to `backend/vercel.json`.

## 8. Smoke test (me or you)

```bash
cd backend
API_URL=https://api.gradmire.in SITE_ORIGIN=https://gradmire.in CRON_SECRET='…' npm run smoke
API_URL=https://api.gradmire.in SITE_ORIGIN=https://gradmire.in npm run smoke -- --book you@yourdomain.com
```

The first checks health, CORS, the database and migrations, availability, Google
configuration, cross-site protection and one worker pass. The second also books a
real slot as a guest and cancels it; you should receive the confirmation and
cancellation emails.

Then by hand, in a normal **and** a private browser window:
- [ ] Sign up with email, verify via the emailed link, log out, log back in.
- [ ] *Forgot password?* → email → set a new password → old sessions are signed out.
- [ ] Continue with Google (new account, then again as a returning user).
- [ ] Book while logged in; the booking appears in *My consultations*. Reschedule, then cancel.
- [ ] Staff: log in at `/admin/consultations`, find the booking, add a note.

## 9. After launch

- [ ] Watch *Undelivered emails* and *Calendar issues* on the CRM overview for the first week.
- [ ] When retention periods are agreed: set `RETENTION_ENABLED=true` (and the months), and check
      `GET /api/v1/admin/retention` (admin) first to see how many records would be anonymised.
- [ ] Remove `http://localhost:*` origins from the Google OAuth client if you no longer test locally.
