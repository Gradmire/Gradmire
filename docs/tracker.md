# Project Tracker
## Study Abroad Consultancy & Application Platform

Use this as the seed for your Jira/Linear/Notion board. Status legend: `TODO` / `IN PROGRESS` / `BLOCKED` / `DONE`.

---

## Phase 0 — Pre-build

| ID | Task | Owner | Priority | Status | Notes |
|---|---|---|---|---|---|
| P0-1 | Decide CMS vendor | Tech Lead | P0 | TODO | Strapi vs Contentful vs Sanity |
| P0-2 | Decide CRM approach (internal vs 3rd-party) | Product + Tech Lead | P0 | TODO | Affects Lead Module scope |
| P0-3 | Repo scaffolding (web/api/admin/infra) | DevOps | P0 | TODO | |
| P0-4 | CI/CD pipeline (staging + prod deploy) | DevOps | P0 | TODO | Must deploy "hello world" |
| P0-5 | Design tokens finalized in Figma + exported | Designer | P0 | TODO | Blocks component build |
| P0-6 | Seed data prep (universities, subjects, branches) | Data/Content | P1 | TODO | ~1,000 university rows |
| P0-7 | Country/locale list finalized | Product | P1 | TODO | |

## Phase 1 — MVP

### Milestone 1.1 Foundation & Content Backbone
| ID | Task | Priority | Status |
|---|---|---|---|
| 1.1-1 | DB migrations: users, sessions, otp_codes | P0 | TODO |
| 1.1-2 | DB migrations: leads, lead_notes, lead_dedup_index | P0 | TODO |
| 1.1-3 | DB migrations: countries, branches, branch_counsellors | P0 | TODO |
| 1.1-4 | DB migrations: destinations + all destination_* tables | P0 | TODO |
| 1.1-5 | Content Module CRUD API (Destinations) | P0 | TODO |
| 1.1-6 | Content Module CRUD API (Universities/Courses/Subjects) | P0 | TODO |
| 1.1-7 | Content Module CRUD API (Scholarships/Events/Blog) | P1 | TODO |
| 1.1-8 | Import seed data (universities, subjects, branches) | P0 | TODO |
| 1.1-9 | Storybook: Button, Input, Select, Checkbox, Radio | P0 | TODO |
| 1.1-10 | Storybook: Cascading Select (Country→City→Office) | P0 | TODO |
| 1.1-11 | Storybook: Card variants (Course/University/Scholarship/Event/Blog/Counsellor/Testimonial) | P1 | TODO |
| 1.1-12 | Storybook: StatBar, Tabs/Accordion, Filter Bar | P1 | TODO |

### Milestone 1.2 Public Marketing Site
| ID | Task | Priority | Status |
|---|---|---|---|
| 1.2-1 | Home page hero + stat bar | P0 | TODO |
| 1.2-2 | Home page destination grid (region tabs) | P0 | TODO |
| 1.2-3 | Home page events widget | P1 | TODO |
| 1.2-4 | Home page scholarships carousel | P1 | TODO |
| 1.2-5 | Home page testimonials video wall | P2 | TODO |
| 1.2-6 | Home page partner logo wall (marquee) | P2 | TODO |
| 1.2-7 | Destination page template — Overview/Universities/Courses sections | P0 | TODO |
| 1.2-8 | Destination page template — Cost/Scholarships/Intakes sections | P0 | TODO |
| 1.2-9 | Destination page template — Eligibility/Exams/Visa sections | P0 | TODO |
| 1.2-10 | Destination page template — Careers/Cities/FAQs sections | P0 | TODO |
| 1.2-11 | Publish 10 destination pages with real content | P0 | TODO |
| 1.2-12 | Blog listing + detail pages | P1 | TODO |
| 1.2-13 | Services pages (Visa/Counselling/Test-prep/Student Essentials) | P1 | TODO |
| 1.2-14 | Branch/Office locator page | P0 | TODO |
| 1.2-15 | Geo-detection banner (edge middleware) | P2 | TODO |
| 1.2-16 | SEO: structured data + sitemap + meta pipeline | P0 | TODO |
| 1.2-17 | Lighthouse perf/SEO audit ≥ 90 | P0 | TODO |

### Milestone 1.3 Course & University Finder
| ID | Task | Priority | Status |
|---|---|---|---|
| 1.3-1 | Stand up Meilisearch + indexing pipeline | P0 | TODO |
| 1.3-2 | Autocomplete component (virtualized, debounced, fuzzy) | P0 | TODO |
| 1.3-3 | Course Finder page (filters + results) | P0 | TODO |
| 1.3-4 | University Finder page (search + filters + results) | P0 | TODO |
| 1.3-5 | Course/University detail pages | P0 | TODO |
| 1.3-6 | Shortlist action (localStorage stub) | P1 | TODO |
| 1.3-7 | Search load test (p95 < 300ms) | P1 | TODO |

### Milestone 1.4 Lead Capture
| ID | Task | Priority | Status |
|---|---|---|---|
| 1.4-1 | Multi-Step Consultation Form component | P0 | TODO |
| 1.4-2 | Inline short lead-form variant | P1 | TODO |
| 1.4-3 | Lead Module API (create/dedup/routing/consent) | P0 | TODO |
| 1.4-4 | UTM/attribution capture wiring | P0 | TODO |
| 1.4-5 | Wire CTAs across all public pages | P0 | TODO |
| 1.4-6 | Notification: confirmation email + counsellor alert | P0 | TODO |
| 1.4-7 | Notification: SMS confirmation | P1 | TODO |
| 1.4-8 | Outbox pattern for future CRM sync | P2 | TODO |
| 1.4-9 | E2E test: lead submission from all entry points | P0 | TODO |

### Milestone 1.5 Auth & Student Portal Shell
| ID | Task | Priority | Status |
|---|---|---|---|
| 1.5-1 | Auth: email+password | P0 | TODO |
| 1.5-2 | Auth: Google SSO | P1 | TODO |
| 1.5-3 | Auth: phone OTP | P1 | TODO |
| 1.5-4 | Signup onboarding quiz + lead merge logic | P0 | TODO |
| 1.5-5 | Dashboard shell (profile %, counsellor card, shortlist, events widget) | P0 | TODO |
| 1.5-6 | Migrate localStorage shortlist → DB on login | P1 | TODO |
| 1.5-7 | Profile edit page | P1 | TODO |
| 1.5-8 | Events Module: listing + filters | P0 | TODO |
| 1.5-9 | Events Module: registration + confirmation (.ics) | P1 | TODO |
| 1.5-10 | Scholarships Module: listing + filters + detail | P0 | TODO |

### Milestone 1.6 Admin CMS & Lead Kanban
| ID | Task | Priority | Status |
|---|---|---|---|
| 1.6-1 | Role-based admin routing (RBAC) | P0 | TODO |
| 1.6-2 | ContentAdmin CMS forms (all content types) | P0 | TODO |
| 1.6-3 | Lead Kanban board UI | P0 | TODO |
| 1.6-4 | Lead detail drawer (notes/call log/stage change) | P0 | TODO |
| 1.6-5 | BranchAdmin view (filter by branch) | P1 | TODO |
| 1.6-6 | Reporting v1 (funnel counts) | P1 | TODO |
| 1.6-7 | Audit logging wired | P1 | TODO |

### Launch Readiness
| ID | Task | Priority | Status |
|---|---|---|---|
| L-1 | Accessibility audit (axe-core) pass | P0 | TODO |
| L-2 | Load test Search + Lead endpoints (5x peak) | P0 | TODO |
| L-3 | Publish legal/compliance pages | P0 | TODO |
| L-4 | Analytics (GA4/GTM) + funnel event instrumentation | P0 | TODO |
| L-5 | Go/no-go review | P0 | TODO |
| L-6 | **Production launch** | P0 | TODO |

---

## Phase 2 — Application Tracking & CRM Depth

| ID | Task | Priority | Status |
|---|---|---|---|
| 2.1-1 | DB migrations: applications, application_documents, activity_log, visa_checklists | P0 | TODO |
| 2.1-2 | "Start Application" action from Shortlist | P0 | TODO |
| 2.1-3 | Stage tracker UI (stepper) | P0 | TODO |
| 2.1-4 | Document upload widget (resumable, S3) | P0 | TODO |
| 2.1-5 | Auto-generated visa checklist per destination | P1 | TODO |
| 2.2-1 | Counsellor applicant view (stage/doc status) | P0 | TODO |
| 2.2-2 | Task/reminder system | P1 | TODO |
| 2.2-3 | Messaging thread (student ↔ counsellor) | P1 | TODO |
| 2.2-4 | Notification triggers for stage changes | P0 | TODO |
| 2.3-1 | Test-prep deep-links w/ click tracking | P1 | TODO |
| 2.3-2 | Student Essentials referral flows w/ tracking | P1 | TODO |
| 2.4-1 | Notification template library | P1 | TODO |
| 2.4-2 | WhatsApp Business API integration | P2 | TODO |
| 2.4-3 | Nurture drip sequences | P2 | TODO |
| 2.5-1 | Full funnel dashboard (sliceable) | P1 | TODO |
| 2.5-2 | Cohort/UTM-level ROI reporting | P2 | TODO |

## Phase 3 — Growth (Backlog, prioritize post-launch)

| ID | Task | Priority | Status |
|---|---|---|---|
| 3-1 | Instant Eligibility/Conditional-Offer engine | P2 | BACKLOG |
| 3-2 | Native mobile app | P2 | BACKLOG |
| 3-3 | Community/peer-ambassador chat | P3 | BACKLOG |
| 3-4 | University Partner B2B portal | P3 | BACKLOG |
| 3-5 | Cost-of-living calculator | P2 | BACKLOG |
| 3-6 | AI course/university recommendation | P3 | BACKLOG |
| 3-7 | Multi-locale/currency expansion | P3 | BACKLOG |

---

## Risk/Issue Log

| ID | Risk/Issue | Impact | Mitigation | Owner | Status |
|---|---|---|---|---|---|
| R-1 | Large dataset curation ongoing effort | Med | CSV bulk import + partner feed job | Data Lead | OPEN |
| R-2 | Multi-step form drop-off | Med | Progressive disclosure, minimal step-1 fields | Product | OPEN |
| R-3 | SEO cannibalization across destination pages | Med | Canonical tags, unique content blocks | SEO/Content | OPEN |
| R-4 | Compliance/data-privacy gaps | High | Legal review, DPDP-compliant consent model | Legal + Tech Lead | OPEN |
| R-5 | Portal scope creep into full CRM | Med | Explicit phase gating per PRD §5 | Product | OPEN |

## Weekly Status Template
```
Week of: ____
Completed:
- 
Blocked (with reason):
- 
Next week plan:
- 
Metrics snapshot (leads, bookings, conversion %):
- 
```
