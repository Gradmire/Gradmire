# Approval Workflows

How people move between roles. Every step is a server-side state change inside
one database transaction, with an audit event and (where useful) an in-app
notification and an email. Code: `approval-service.js`, `employee-service.js`,
`consultant-application-service.js`, `auth-service.js`, `booking-service.js`.

## A. Guest → registered student

No administrator approval: ownership is proved automatically, and only
ambiguous cases go to a person.

1. A guest books (`POST /api/v1/consultations`) or sends an enquiry (`POST /api/v1/leads`). The booking is stored before any confirmation is shown, with a lead (status `consultation_booked`) and a manage link (HMAC token; only its hash is stored).
2. Lost the email? `POST /api/v1/consultations/manage/resend` emails the link again **to the booking address only** (same answer for every address; one email per booking per hour; rate limited).
3. The guest signs up. Nothing is linked yet — a typed email proves nothing.
4. They verify their email (single-use, 48-hour, HMAC-derived token). In that transaction every **unowned** consultation and lead with the same email is linked to the account, leads become `converted`, the student gets a notification, and `auth.email_verified` is audited with the counts.
5. Alternatively they claim one booking with its manage link **and** a verified account whose email matches the booking (`POST /api/v1/me/consultations/claim`). The whole reschedule chain is linked.
6. **Ambiguous identity → manual review.** Records that share the account's phone number but not its verified email are never linked. They are listed as *possible duplicates* on the user's admin page; an admin links one with a written reason (`POST /api/v1/admin/users/:id/link-record`), audited as `identity.manual_link`.

Records already owned by another account are never moved. Booking ids, history and leads are preserved.

## B. Registered user → consultant applicant

```
submitted ──► under_review ──► shortlisted ──► interview_scheduled ──► interview_completed ──► approved
    │  ▲            │                                   │  (re-schedule)                       │
    │  └── info_requested ◄─┘                            └──────────────► rejected ◄────────────┘
    └──────────────────────────────────────────────────────────► rejected
 any open state ──► withdrawn (applicant)
```

1. A **student with a verified email** submits (`POST /api/v1/me/consultant-applications`). One open application per person (partial unique index). Staff accounts cannot apply.
2. All active admins get a notification; the applicant gets a confirmation (in-app + email).
3. Reviewers move it along (`POST /api/v1/admin/consultant-applications/:id/transition`). Invalid jumps return `409 INVALID_TRANSITION`. Each move can carry a **private note** (staff-only history) and a **message to the applicant** (the only reviewer text they ever see).
4. `info_requested` reopens editing; the applicant's update sends it back to `submitted`. Editing is locked once review starts.
5. **Approval is a hiring decision only.** It records who decided, notifies the applicant and creates an **employee invitation** to the applicant's account email. The role does not change.

## C/D. Applicant or existing user → active consultant (employee onboarding)

1. An admin invites (`POST /api/v1/admin/employees/invitations`) — or approval in B does it. The invitation stores the job details and `intended_role` (`counsellor` or `admin`; never `super_admin`). One pending invitation per email. Valid 14 days. Token = HMAC(`invite:` + id), only its hash stored.
2. The person opens the emailed link (`join-team.html`). The token is moved out of the address bar into session storage so it never appears in a login/sign-up URL.
3. They log in or sign up **with the invited address** and verify it. Acceptance (`POST /api/v1/me/employee-invitations/accept`) requires: valid pending unexpired token **and** a verified account whose email equals the invited email **and** the account is currently a student.
   - An existing student with a personal email is invited at that personal email. A work email is stored separately on the employee profile; the login email is never silently replaced.
4. Acceptance creates (or re-opens) the **employee profile** (`pending`) and an **`employee_activation` approval request**, requested by the inviting admin.
5. A **different** authorised person approves (`POST /api/v1/admin/approvals/:id/approve`): an admin for consultant access, a super admin for admin access. In one transaction:
   - `users.role` changes; the `counsellors` working profile is created/activated (availability starts empty — the consultant sets hours in their workspace);
   - the employee profile becomes `active` with `approved_by`/`approved_at`;
   - all of the person's sessions are revoked, so their next login shows the new workspace;
   - `role.granted` is audited with before/after roles; the person and the requester are notified.
6. Rejection closes the request and marks the pending profile `terminated`; nothing is granted.

The account id never changes; student consultations and applications stay with it.

## E. Role change or revocation

**Role change** (between `counsellor`, `admin`, `super_admin`): `POST /api/v1/admin/users/:id/role-change-requests`. Students cannot be role-changed (use an invitation).

**Revocation** (staff → student): `POST /api/v1/admin/users/:id/revocation-requests`. If the person has upcoming consultations, open enquiries or open tasks, the request **must** name an active counsellor to take them over (`422 REASSIGNMENT_REQUIRED` otherwise). On approval, in one transaction:

1. future active consultations are reassigned with the same logic as the CRM (calendar events moved, new counsellor notified, booking history records it); a clash rolls everything back with a clear message;
2. open enquiries and open tasks move to the successor (lead history records it);
3. the `counsellors` row is deactivated (never deleted, so past consultations keep their counsellor);
4. the role returns to `student`, the employee profile becomes `terminated`;
5. sessions are revoked; `role.revoked` is audited with what moved.

**Suspension** (`PATCH /api/v1/admin/users/:id/status`) is immediate rather than approved, because it only removes access: sessions end at once, login is refused, records are kept, a reason is mandatory and audited. Admins can suspend students and consultants; only super admins can suspend admins.

## Approval request lifecycle

```
pending ──approve──► approved
   │ ──reject───► rejected
   │ ──request-information──► info_requested ──respond (requester)──► pending
   └──cancel (requester)──► cancelled        (info_requested can also be rejected or cancelled)
```

| Check (on approve) | Result if it fails |
|---|---|
| Decider is not the requester or the target (service **and** DB constraint) | 403 |
| Decider may decide this change (super admin for admin-level changes) | 403 |
| Request is `pending` | 409 `NOT_PENDING` |
| Target's role is still `from_role` | 409 `STALE_REQUEST` |
| Target account is active | 409 `ACCOUNT_SUSPENDED` |
| Not removing the last active super admin | 409 `LAST_SUPER_ADMIN` |
| Only one open request per person (partial unique index) | 409 `REQUEST_OPEN` (on creation) |

## Bootstrap

The two-person rule means one person can never grant themselves access. To start:

1. `npm run create-staff -- --email … --first-name … --role super_admin` (audited as `staff.created_by_cli`).
2. Create a second privileged person the same way, or invite an admin and have a second super admin approve.
3. From then on, grant and remove access only through approval requests.
