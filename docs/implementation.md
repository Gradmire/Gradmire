# Implementation Plan
## Study Abroad Consultancy & Application Platform

Companion build sequence to `PRD.md`, `techspec.md`, `appflow.md`, `design.md`, `schema.md`. Organized as phases → milestones → workstreams. Pair with `tracker.md` for granular task tracking.

---

## 0. Pre-build (Week 0)

- Finalize CMS vendor decision (Strapi self-hosted vs. Contentful/Sanity) — impacts Content Module scaffolding.
- Finalize CRM approach (internal `leads` table only vs. 3rd-party sync) for Phase 1.
- Stand up repos: `web` (Next.js), `api` (NestJS/Django), `admin` (if separate from `web`), `infra` (Terraform).
- Provision environments: local Docker Compose, staging, production skeleton (empty deploy pipeline working end-to-end before feature work starts).
- Design tokens finalized in Figma + exported to code (`design.md` §2).
- Seed data prepared: country list, initial 10 destinations, ~1,000 university records (CSV import), ~500 subjects, study levels enum.

**Exit criteria:** "Hello world" deploys successfully to staging + production via CI/CD; DB migrations run cleanly; design tokens available in codebase.

---

## Phase 1 — MVP (Weeks 1–12)

### Milestone 1.1 — Foundation & Content Backbone (Weeks 1–3)
- Implement `schema.md` §1–4 (Identity, Leads, Branches, Destinations content tables) + migrations.
- Build Content Module CRUD (admin API) for Destinations, Universities, Courses, Scholarships, Events, Blog, Branches, Team/Counsellors, Testimonials, Partner logos.
- Import seed data (universities, subjects, branches/offices, countries).
- Build design system: tokens, core components (Button, Input, Select, Cascading Select, Card variants, StatBar, Tabs/Accordion) in Storybook.

### Milestone 1.2 — Public Marketing Site (Weeks 3–7)
- Home page (hero, stat bar, destination grid, events widget, scholarships carousel, testimonials, partner logo wall, blog grid, footer).
- Destination page template (SSG/ISR) with all sections per `appflow.md` §2 and `design.md` §4.2; publish 10 destinations.
- Blog/Study Guides listing + detail pages.
- Services pages (Visa, Counselling, Test-prep landing, Student Essentials landing) — content-only in Phase 1 (deep-links to partners, no booking API yet).
- Branch/Office locator page + component (reused later in lead form).
- Geo-detection banner (edge middleware).
- SEO: structured data, sitemap generation, meta tag pipeline from CMS.

**Exit criteria:** All public marketing pages live on staging with real seeded content; Lighthouse SEO/Perf scores ≥ 90 on destination page template.

### Milestone 1.3 — Course & University Finder (Weeks 5–8)
- Stand up Meilisearch (or chosen engine); indexing pipeline from `courses`/`universities` tables.
- Build typeahead Autocomplete component (virtualized list, debounced query, fuzzy match).
- Course Finder page: subject + study level + destination filters → results grid → course detail.
- University Finder page: name search + filters → results → university detail page with course tabs.
- "Add to shortlist" action (requires auth — stub with local storage before Milestone 1.5 auth ships, migrate on login).

**Exit criteria:** Search p95 latency < 300ms with full seeded dataset; finder flows pass E2E tests.

### Milestone 1.4 — Lead Capture (Weeks 6–9)
- Build Multi-Step Consultation Form component (per `appflow.md` §2, `design.md` §4.4) with client validation, UTM/attribution capture, save-draft.
- Build inline short lead-form variant.
- Implement Lead Module API: create, dedup logic (`lead_dedup_index`), branch routing, consent storage.
- Wire "Book Free Consultation" CTA across Home, Destination pages, Blog, Course/University detail.
- Notification Module v1: transactional email (confirmation) + counsellor-alert email; SMS provider integration for confirmation.
- Basic outbox pattern for future CRM sync (even if no external CRM yet — log-and-forward ready).

**Exit criteria:** End-to-end lead submission from any entry CTA produces a `leads` row with correct attribution + triggers confirmation email; dedup verified via test cases.

### Milestone 1.5 — Auth & Student Portal Shell (Weeks 8–11)
- Auth: email+password, Google SSO, phone OTP (via provider).
- Signup onboarding quiz; merge with existing lead record by email/phone match.
- Dashboard shell: profile completion %, assigned-counsellor card (placeholder assignment logic), shortlist view (migrate localStorage shortlist to DB on login), upcoming events widget.
- Profile edit page.
- Events Module: listing + filters + registration flow (email/SMS confirmation, .ics generation).
- Scholarships Module: listing + filters + detail pages.

**Exit criteria:** New user can sign up, complete onboarding, see personalized dashboard, register for an event, browse scholarships.

### Milestone 1.6 — Admin CMS & Lead Kanban (Weeks 9–12)
- Role-based admin app/routes: ContentAdmin (CMS forms), BranchAdmin, Counsellor, SuperAdmin.
- Lead Kanban board (stage columns, drag/dropdown stage change, filters, notes/call log).
- Reporting v1: funnel counts (Leads → Bookings) by destination/source/date range.
- Audit logging wired for content + lead stage changes.

**Exit criteria:** Counsellor can log in, see assigned leads, change stage, add notes; content admin can publish a new destination page without engineering involvement.

### Phase 1 Launch Readiness
- Accessibility audit (axe-core) pass on public pages.
- Load test Search API + Lead submission endpoint at 5x expected peak.
- Legal/compliance pages published (Privacy, Terms, Cookie Policy, Complaint Policy, Agent Code of Conduct equivalent).
- Analytics wired (GA4 + GTM, funnel events instrumented).
- Go/no-go review → **Production launch.**

---

## Phase 2 — Application Tracking & CRM Depth (Weeks 13–22)

### Milestone 2.1 — Application Module (Weeks 13–16)
- Implement `applications`, `application_documents`, `application_activity_log`, `visa_checklists` tables.
- "Start Application" action from Shortlist → creates `applications` row at `shortlisted` stage.
- Stage tracker UI (horizontal stepper) on dashboard + application detail page.
- Document upload widget (resumable, S3-backed) per required doc type.
- Auto-generated visa checklist per destination (sourced from `destination_visa_info.required_documents`).

### Milestone 2.2 — Counsellor Workflow Depth (Weeks 15–18)
- Counsellor view of assigned applicants' stage/document status (not just leads).
- Task/reminder system (e.g., "document overdue," "offer deadline approaching").
- Messaging thread (student ↔ counsellor) — in-app + email fallback.
- Notification triggers for all stage changes (`schema.md` §10).

### Milestone 2.3 — Test-Prep & Student Essentials Integration (Weeks 17–19)
- IELTS/PTE/TOEFL/Duolingo: deep-link booking (Phase 1 was static content; now trackable click-through + lead tagging).
- Student Essentials partner referral flows (loan, forex, insurance, accommodation, SIM, banking) with click/conversion tracking.

### Milestone 2.4 — Notifications & Nurture (Weeks 18–20)
- Full notification template library (`notification_templates`).
- WhatsApp Business API integration for high-open-rate reminders.
- Drip nurture sequences for opted-in unconverted leads (scholarship tips, deadline reminders, event invites).

### Milestone 2.5 — Reporting v2 (Weeks 20–22)
- Full funnel dashboard: Leads → Consultation → Application Started → Offer → Enrolled, sliceable by destination/source/branch/counsellor/date.
- Cohort/conversion-rate reporting for marketing attribution (UTM-level ROI).

**Exit criteria:** A student can go from shortlist → document upload → offer → visa checklist entirely inside the portal, with counsellor visibility at every stage.

---

## Phase 3 — Growth Features (Ongoing, post Week 22)

- Instant Eligibility/Conditional-Offer engine (rules-based initially, ML-assisted later).
- Native mobile app (React Native/Flutter) mirroring portal + push notifications.
- Community/peer-ambassador chat feature.
- University Partner B2B portal (inbound applicant analytics, course/scholarship self-serve publishing).
- Cost-of-living calculator (interactive tool).
- AI-assisted course/university recommendation (based on profile + preferences).
- Additional locales/currencies if expanding beyond India.

---

## Workstream Ownership (suggested)

| Workstream | Owner role |
|---|---|
| Design system & Storybook | Frontend Lead + Designer |
| Content Module + CMS | Backend Lead + Content Admin stakeholder |
| Search/Finder | Backend Lead |
| Lead Module & Forms | Full-stack + Growth/Marketing stakeholder |
| Auth & Portal | Full-stack |
| Application Module (Phase 2) | Backend Lead |
| Notifications | Backend + DevOps (provider integrations) |
| Admin/CRM | Full-stack + Ops stakeholder |
| Infra/CI-CD | DevOps |
| QA/Accessibility | QA Lead |

## Dependencies & Sequencing Notes
- Search indexing (Milestone 1.3) depends on seeded Universities/Courses data from Milestone 1.1.
- Lead Module dedup (1.4) should exist before Auth (1.5) so signup can merge existing lead records.
- Application Module (2.1) depends on Shortlist (1.5) and Destination visa data (1.2) being complete.
- Reporting (2.5) depends on stable event/notification instrumentation from 1.4–2.4.

## Definition of Done (per feature)
1. Meets acceptance criteria in `tracker.md`.
2. Unit + integration tests passing, coverage threshold met.
3. Accessibility checked (axe-core, keyboard nav).
4. Responsive on `sm/md/lg/xl` breakpoints.
5. Analytics events instrumented where relevant.
6. Reviewed against `design.md` visual spec.
7. Deployed to staging, product/QA sign-off, then merged to production release train.
