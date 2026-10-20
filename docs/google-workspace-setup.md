# Google Workspace: Gmail, Drive and Meet

How Gradmire uses Google Workspace, how to set it up, and the workflows behind
each feature. Everything runs through **one service account** with
**domain-wide delegation**, called over plain HTTPS (no SDK), with tokens kept
server-side (`backend/src/integrations/google/auth.js`). Sign in with Google
(`GOOGLE_CLIENT_ID`) is separate and documented in the booking setup guide.

| Feature | What it does | Code |
|---|---|---|
| Gmail — system email | Confirmations, reminders, invitations, verification and every other system email go out from your Workspace mailbox | `integrations/email/gmail.js` (`EMAIL_PROVIDER=gmail`) |
| Gmail — CRM inbox | Consultants see email threads with a student or enquiry inside the dashboard | `services/staff-email-service.js` |
| Gmail — compose and reply | Consultants email a student or enquiry from the dashboard; replies stay in the Gmail thread | same |
| Google Drive | Private storage for student documents and consultant CVs | `integrations/storage/drive.js`, `services/document-service.js` |
| Google Meet | Meet links for video consultations (existing) and for consultant interviews (new) | `integrations/calendar/google.js`, `services/interview-meeting.js` |

## 1. One-time Google setup

1. **Google Cloud project** → enable **Gmail API**, **Google Drive API** and **Google Calendar API**.
2. **Service account** → create one and a JSON key. Put `client_email` in `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `private_key` (newlines as `\n`) in `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`.
3. **Domain-wide delegation** (Workspace Admin console → Security → API controls → Domain-wide delegation) → add the service account's client id with these scopes:
   ```
   https://www.googleapis.com/auth/calendar
   https://www.googleapis.com/auth/gmail.send
   https://www.googleapis.com/auth/gmail.readonly
   https://www.googleapis.com/auth/drive
   ```
   Grant only the scopes for the features you turn on. If a scope is missing, Google answers `unauthorized_client`; the API reports it as a permanent failure (no endless retries) and the admin overview shows the feature as not connected.
4. **Mailbox** → create a shared mailbox such as `counselling@gradmire.com` (a normal Workspace user or a group with a mailbox). Use it for `GMAIL_SENDER` and `GMAIL_MAILBOX`.
5. **Shared Drive** → create one (e.g. "Gradmire student documents"), add the service account as **Content manager**, create a folder in it and put the folder id (from its URL) in `GOOGLE_DRIVE_FOLDER_ID`. Restrict human membership to people who must handle documents directly; everyone else uses the dashboard.

## 2. Environment variables

| Variable | Example | Purpose |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | | Shared by Calendar, Gmail and Drive |
| `EMAIL_PROVIDER` | `gmail` | Send system email through Gmail (`resend` still works; `log` is development only and refused in production) |
| `EMAIL_FROM` | `Gradmire <counselling@gradmire.com>` | From header (must be the sender or one of its Gmail "send as" addresses) |
| `GMAIL_SENDER` | `counselling@gradmire.com` | Mailbox that sends (system email and staff emails) |
| `GMAIL_MAILBOX` | `counselling@gradmire.com` | Mailbox shown in the CRM inbox (defaults to `GMAIL_SENDER`). Use the same mailbox so replies stay in one Gmail thread. |
| `STORAGE_PROVIDER` | `drive` | Turns on documents and CV uploads (`local` is development only) |
| `GOOGLE_DRIVE_FOLDER_ID` | | Folder in the Shared Drive |
| `GOOGLE_DRIVE_IMPERSONATE` | *(optional)* | Act as a Workspace user instead of the service account |
| `CALENDAR_PROVIDER`, `GOOGLE_CALENDAR_IMPERSONATE` | `google`, `counselling@gradmire.com` | Calendar (existing) |
| `GOOGLE_CALENDAR_CREATE_MEET` | `true` | Meet links for video consultations **and** interviews |
| `GOOGLE_CALENDAR_INVITE_ATTENDEES` | `true` | Google also emails the calendar invite to the student/applicant |
| `GOOGLE_INTERVIEW_CALENDAR_ID` | `hiring@gradmire.com` | Interview calendar when the reviewer has no counsellor calendar |
| `INTERVIEW_DURATION_MINUTES` | `45` | Interview length |
| `FOLLOW_UP_REMINDER_MINUTES` | `60` | How far ahead of a due follow-up the reminder email goes out |

After deploying, open **Admin → Overview → Google Workspace connections**: it lists each feature as connected or not (names and counts only, never credentials).

## 3. Workflows

### Gmail as the email provider

1. A change (booking, invitation, application decision…) queues an email in the `notifications` outbox inside the same database transaction.
2. The worker renders it and sends it with `users.messages.send` as `GMAIL_SENDER`. Each message gets a `Message-ID` derived from its de-duplication key.
3. Gmail has no idempotency key, so on a **retry** the worker first searches the sender's mailbox for that `Message-ID` (`rfc822msgid:`) and reuses the copy if the first attempt actually went out. Result: no double-sends after a timeout.
4. Status is recorded honestly: `sent`, `failed` (retried with back-off), or `skipped` when nothing is configured.

### CRM inbox and email from the dashboard

1. A consultant opens a student (Students page) or an enquiry (Enquiries page). The API first checks they may see that person (their student / their assigned enquiry; admins see all).
2. The inbox searches `GMAIL_MAILBOX` for threads from, to or copied to that address, and keeps only threads that really involve it. Opening a thread re-checks this, so a thread id cannot be used to read unrelated mail; each opened thread is audited.
3. **Compose** sends as `GMAIL_SENDER` to the student's or enquiry's address, signed with the consultant's name. **Reply** sets `In-Reply-To`/`References` and the Gmail `threadId`, so it lands in the same conversation for both sides.
4. Every send is stored in `staff_emails` (sent or failed, with the error). Emailing an enquiry also adds an `email_sent` activity, updates "last contacted" and moves a new enquiry to "contacted". A Gmail failure returns an error to the consultant; it is never shown as sent.

### Documents (Google Drive)

1. **Student uploads** in *My documents* (or against a consultant's request). The API accepts PDF, JPG, PNG or Word (.docx) up to 4 MB, and checks the file's first bytes, not just its declared type.
2. The file goes into the Shared Drive folder, named `<document id>-<file name>`, with the student and document ids as private app properties. Then the database row is written; if that fails, the Drive file is removed again.
3. **Consultants request** a document from a student's drawer → the student gets an email and sees the request; their upload marks it received.
4. **Downloads** always go through the API: the owner, admins and the student's consultant may open a document; staff downloads are audited (`document.downloaded`). Files are sent as attachments with `nosniff` and a sandboxing CSP, never shared by link.
5. **Deleting** marks the row deleted and moves the Drive file to the Shared Drive's trash (recoverable by a Drive manager). A request it fulfilled reopens.

### Consultant CVs

1. On *Become a consultant* the applicant uploads a CV (PDF or Word); it is stored like a document with kind `cv` and attached to the application.
2. Only hiring reviewers (admins) can open it, from the application in *Team and hiring*. Consultants cannot, even for their own students. A CV attached to an open application cannot be deleted.

### Interviews with Google Meet

1. A reviewer moves an application to *Interview scheduled* with a date and time.
2. After that change is saved, the API creates a Calendar event on the reviewer's calendar (or `GOOGLE_INTERVIEW_CALENDAR_ID`) with a Meet conference, the applicant as attendee, and a deterministic event id.
3. The applicant is then told — in the dashboard and by email — with the **Join with Google Meet** link. Their application page shows the same button.
4. **Rescheduling** creates a new event and removes the old one. **Rejecting, approving or the applicant withdrawing** removes the event.
5. If Google fails, the decision still stands; the interview shows *Calendar failed* with a **Try again** button. Without a calendar it shows *No meeting link* so the reviewer knows to send one.

### Meet for consultations (existing, now shown in the workspaces)

Video bookings get a Meet link when the consultant has a calendar and `GOOGLE_CALENDAR_CREATE_MEET=true`. The link appears as **Join** on the student dashboard and on the consultant's *Today* / *Next 7 days* lists once the booking is confirmed. Staff can still paste a link by hand in the CRM.

### Login email change

1. On *My profile* the student enters the new address and their current password.
2. A link (24 hours, single use) goes to the **new** address; the **current** address is told a change was requested.
3. Opening the link changes the email, marks it verified, links any guest bookings made with it, ends every session and emails the old address that the change happened. Google-only accounts (no password) are told to contact support, because their email follows their Google account.

### Follow-up reminders

The background job emails the assignee (and adds an in-app notification) when a follow-up task, or an enquiry's next follow-up, is due within `FOLLOW_UP_REMINDER_MINUTES`. Each due time is reminded once; moving it re-arms the reminder.

## 4. Local development

`npm run db:local`, then start the API with `node --env-file=backend/.env.local-dev …` (the `workspace-api` entry in `.claude/launch.json`). That file is gitignored and sets `EMAIL_PROVIDER=log` and `STORAGE_PROVIDER=local` plus a fixed local `APP_SECRET`, so verification, invitation and email-change links can be followed from the API log after running the jobs endpoint:

```bash
curl -X POST http://localhost:4000/api/v1/internal/jobs/run -H "Authorization: Bearer local-cron-secret"
```

## 5. Limits

- Uploads are limited to 4 MB by Vercel's request size; scans larger than that must be compressed.
- The CRM inbox reads one shared mailbox; email sent from a consultant's personal Gmail is not visible.
- Service accounts without domain-wide delegation cannot use Gmail at all, and generally cannot create Meet links.
- Phone OTP and WhatsApp are not implemented (no provider chosen).
