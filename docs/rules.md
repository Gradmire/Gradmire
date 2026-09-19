# Rules & Standards
## Study Abroad Consultancy & Application Platform

Engineering, content, and operational rules the team must follow. Treat as binding unless explicitly amended via PR to this file.

---

## 1. Code & Engineering Rules

1. **Branching:** `main` (production) ← `staging` ← feature branches (`feat/*`, `fix/*`, `chore/*`). No direct commits to `main`/`staging`.
2. **PR review:** Minimum 1 approving review; 2 for changes touching Lead/Application/Auth modules or DB migrations.
3. **Migrations:** Every schema change is a versioned migration file (never manual DB edits). Migrations must include a rollback path. Destructive migrations (drop column/table) require a two-step deploy (deprecate → remove next release).
4. **API contracts:** Breaking changes require a new API version (`/api/v2`) or a deprecation window of ≥ 30 days with client notice.
5. **Secrets:** No secrets in source control. Use environment-specific secret managers (AWS Secrets Manager/Vault). `.env.example` committed, `.env` gitignored.
6. **Testing gate:** CI must pass unit + integration tests before merge. E2E suite runs on every deploy to staging; must pass before promotion to production.
7. **Coverage floor:** Core API domain logic (Lead dedup, Application stage transitions, Auth) ≥ 80% coverage; overall repo ≥ 60%.
8. **Linting/formatting:** ESLint + Prettier (or equivalent) enforced in CI; no merge on lint failure.
9. **Feature flags:** Any user-facing feature that changes an existing funnel step (forms, search, dashboard) ships behind a flag with staged rollout (5% → 25% → 100%).
10. **Accessibility:** No PR merges for public-facing UI without passing automated axe-core checks; manual keyboard-nav spot check for new interactive components.
11. **Performance budget:** Public pages must not regress LCP/CLS/TTFB budgets defined in `techspec.md` §11 without an explicit, documented exception approved by Tech Lead.
12. **Dependency hygiene:** Dependabot/Renovate enabled; critical/high vulnerabilities patched within 7 days.

## 2. Data & Privacy Rules

1. **Consent granularity:** Marketing opt-in, partner-institution opt-in, and newsletter opt-in are always stored as **separate boolean fields** — never collapse into a single "I agree" flag. Matches the two-checkbox pattern required by competitor forms and general consent-law best practice.
2. **PII minimization:** Only collect fields that map to a stated product need in `PRD.md`. No speculative "just in case" fields.
3. **Encryption:** Passport status, phone, email, and any uploaded documents (passport copy, transcripts) are encrypted at rest. TLS 1.2+ enforced in transit everywhere.
4. **Retention:** Leads with no activity for 24 months and no active consent are purged or anonymized via scheduled job, unless legal/finance requires longer retention for a specific record.
5. **Right to erasure:** A documented, testable workflow exists to fully delete/anonymize a user's PII within 30 days of a verified request, while preserving anonymized aggregate analytics.
6. **Data export:** Users can request a machine-readable export of their own data (JSON) via support request in Phase 1; self-serve export is a Phase 2+ nice-to-have.
7. **Third-party sharing:** Data is shared with partner institutions or affiliate/referral partners **only** when `partner_institution_opt_in = true` (or the specific referral consent for that flow), and only the minimum fields necessary.
8. **Analytics vs. PII:** Product analytics (GA4/Segment) must not receive raw PII (name, email, phone, passport) as event properties — use internal user/lead IDs and hash where cross-referencing is needed.
9. **Audit trail:** All create/update/delete on `leads`, `applications`, `users`, and published content go through `audit_logs` — no silent writes.

## 3. Content & SEO Rules

1. **No templated boilerplate across destination pages:** Each destination page must have a minimum of 300 words of genuinely unique overview/why-study content (not find/replace of country name) to avoid SEO cannibalization/duplicate-content penalties.
2. **Every published page requires:** unique `<title>`, meta description, canonical URL, and structured data appropriate to page type (Organization, FAQPage, Course, EducationalOccupationalProgram, Event).
3. **Claims requiring numbers (salary ranges, visa fees, scholarship amounts) must cite a source/date** in the CMS record (internal field, not necessarily shown publicly) and be reviewed at least every 6 months for accuracy — visa fees and salary bands change.
4. **No fabricated statistics or testimonials.** All stat-bar numbers, review scores, and student counts must be backed by an internal source-of-truth doc updated quarterly.
5. **Legal/compliance pages (Privacy Policy, Terms of Service, Cookie Policy, Complaint Policy, Agent Code of Conduct)** must be reviewed by legal counsel before each material change, not just at launch.
6. **Accessibility of content:** All images require descriptive `alt` text; all embedded videos require captions or a text transcript link.
7. **Content publishing workflow:** Draft → Internal review → Legal review (if claims/pricing/visa content) → Publish. No direct-to-production publishing of destination/visa/cost content without at least one reviewer.

## 4. Lead & Funnel Rules

1. **Single source of truth for a person:** dedup by normalized email OR normalized phone; if either matches an existing lead, update that record — never create a duplicate.
2. **Response SLA:** A new "Consultation Booked" lead must be contacted (call/email) by an assigned counsellor within 24 business hours; breach triggers an automatic escalation notification to the Branch Admin.
3. **No dark patterns:** Consent checkboxes must be unchecked by default (opt-in, not opt-out) unless local law explicitly permits otherwise for a given market — currently applies to India (DPDP) launch market.
4. **Unsubscribe:** Every marketing email/SMS/WhatsApp message includes a working, immediate unsubscribe/opt-out mechanism; opt-out must be honored within 48 hours system-wide, not just for future campaign sends.
5. **Attribution integrity:** UTM and referrer data captured at lead creation must never be overwritten by a later touch — store first-touch and last-touch separately if multi-touch attribution is needed later.

## 5. Design & UX Rules

1. Follow `design.md` tokens/components exactly; no one-off inline styles for colors/spacing in production code — use design tokens.
2. Every form field has a visible label (not placeholder-only) to remain accessible and usable when autofilled.
3. Every multi-step flow shows current step and total steps, and allows going back without losing entered data.
4. Loading states use skeletons, not blocking spinners, for any list/search/dashboard view expected to take > 300ms.
5. Mobile breakpoints (`sm`) are designed and tested first, not as an afterthought of desktop layout.
6. Color is never the sole indicator of state (e.g., application stage) — pair with icon/text label for colorblind accessibility.

## 6. Operational Rules

1. **On-call/incident response:** Sev1 (site down, lead submission failing) — 15-minute acknowledgement target, status page updated within 30 minutes.
2. **Backups:** DB automated backups daily, retained 30 days minimum, with a tested restore procedure quarterly.
3. **Change freeze:** No non-critical deploys during peak intake-decision weeks (announced per academic calendar, e.g., major September/January intake windows) without Tech Lead + Product sign-off.
4. **Monitoring alerts:** Error-rate, latency, and queue-depth alerts route to the on-call engineer; lead-submission failure rate > 1% for 10 minutes triggers a page (this funnel is revenue-critical).
5. **Vendor/API keys rotation:** Rotate third-party API keys (CRM, SMS, email, maps, search) at minimum every 12 months or immediately on suspected compromise.

## 7. Governance / Change Management

1. Any change to this `rules.md` requires a PR reviewed by Tech Lead + Product Lead.
2. Any change to the data schema (`schema.md`) affecting PII fields requires sign-off from whoever owns data-privacy/compliance responsibility.
3. Phase-gating in `PRD.md`/`implementation.md` (what's in Phase 1 vs. 2 vs. 3) can only be re-scoped via an explicit written decision recorded in `tracker.md`'s risk/issue log — no silent scope creep mid-sprint.
