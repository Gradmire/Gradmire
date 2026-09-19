# Technical Specification
## Study Abroad Consultancy & Application Platform

Companion to `PRD.md`. Defines architecture, stack, integrations, and technical constraints.

---

## 1. Architecture Overview

```
                        ┌─────────────────────────┐
                        │        CDN / Edge        │  (static assets, images, cached pages)
                        └────────────┬─────────────┘
                                     │
                        ┌────────────▼─────────────┐
                        │   Web App (Next.js SSR)   │  Public site + Student Portal (SPA sections)
                        └────────────┬─────────────┘
                                     │ REST/GraphQL
                 ┌───────────────────┼────────────────────┐
                 │                   │                    │
        ┌────────▼───────┐  ┌────────▼────────┐  ┌────────▼────────┐
        │   Content API   │  │   Core API       │  │   Search API     │
        │ (CMS-backed)    │  │ (Leads, Users,   │  │ (Universities,   │
        │ Destinations,   │  │  Applications,   │  │  Courses -       │
        │ Blog, Events,   │  │  Auth, Notif.)   │  │  Elasticsearch/  │
        │ Scholarships    │  │                  │  │  Algolia/Meili)  │
        └────────┬────────┘  └────────┬─────────┘  └────────┬─────────┘
                 │                    │                     │
        ┌────────▼────────────────────▼─────────────────────▼────────┐
        │                     PostgreSQL (primary DB)                 │
        │            + Redis (cache/queues) + S3 (file storage)       │
        └───────────────────────────────────────────────────────────┘
                                     │
                        ┌────────────▼─────────────┐
                        │   Integrations Layer      │
                        │  CRM, Email/SMS/WhatsApp, │
                        │  Payment/Loan partners,   │
                        │  IELTS/PTE booking APIs,  │
                        │  Analytics (GA4, GTM)     │
                        └───────────────────────────┘
```

## 2. Technology Stack (Recommended)

| Layer | Choice | Rationale |
|---|---|---|
| Frontend framework | **Next.js 14+ (React, App Router)** | SSR/ISR for SEO-heavy destination/course pages; matches patterns seen in IDP (Next.js `_next/image`) and KC Overseas (`meta-next-head-count`) |
| Styling | Tailwind CSS + component library (shadcn/ui) | Rapid, consistent UI; design tokens in `design.md` |
| State/data fetching | React Query / SWR | Caching for search & dashboard data |
| Backend API | Node.js (NestJS) or Django REST Framework | Modular, typed, good for CRM-like domain models |
| Database | PostgreSQL 15+ | Relational integrity for leads/applications/universities |
| Search | Meilisearch or Elasticsearch | Typeahead over 1,000+ universities / 500+ course subjects (<300ms) |
| Cache/Queue | Redis + BullMQ (or Sidekiq if Ruby) | Lead-processing jobs, email/SMS dispatch, notification queue |
| File storage | S3-compatible (AWS S3 / Cloudflare R2) | Document uploads, brochures, images |
| CMS | Headless CMS (Contentful/Strapi/Sanity) for content pages; custom admin for Leads/Applications | IDP uses Contentful (`images.ctfassets.net`) — proven fit for this content model |
| Auth | Auth0 / Clerk / custom JWT + OTP (MSG91/Twilio) | Email+password, Google/Apple SSO, phone OTP |
| CRM integration | Pluggable adapter pattern (HubSpot/Salesforce/Zoho/custom) | Avoid vendor lock-in; MVP can start with internal lead table |
| Notifications | SendGrid/Postmark (email), Twilio/MSG91 (SMS), WhatsApp Business API | Match competitor nurture flows |
| Analytics | GA4 + GTM (2 containers seen in competitors — marketing + product) + server-side event pipeline (Segment/RudderStack) | Funnel + attribution tracking |
| Hosting | Vercel (frontend) + AWS/GCP (backend, DB) or full AWS (ECS/Fargate) | SSR scaling + managed Postgres (RDS) |
| CI/CD | GitHub Actions → staging → production, preview deployments per PR | |
| Monitoring | Sentry (errors), Datadog/New Relic (APM), UptimeRobot/Pingdom | |

## 3. Frontend Architecture

- **Rendering strategy per route type:**
  - Home, Destination pages, Blog, Scholarships, Course/University detail → **SSG + ISR** (revalidate every 1–6h) for SEO + speed.
  - Course Finder / University Finder search results → **CSR with server API** (search-as-you-type, debounced 250ms).
  - Student Portal (dashboard, application tracker) → **CSR behind auth**, SSR only for the shell.
  - Free Consultation multi-step form → **CSR** with client-side validation (Zod/Yup) + progressive save to `localStorage`/API draft endpoint.
- **Component structure:** atomic design — `atoms/` (Button, Input, Badge), `molecules/` (CourseCard, EventCard, CounsellorCard), `organisms/` (DestinationHero, ScholarshipCarousel, MultiStepForm), `templates/` (DestinationPageTemplate).
- **i18n-ready:** copy stored in JSON/CMS, not hardcoded, even if only English at launch (competitors show multi-language CTA strings — plan for it).
- **Geo-detection:** Edge middleware (Next.js middleware) detects country via IP (Cloudflare/Vercel geo headers) → shows "visiting from X" banner, does not hard-redirect.

## 4. Backend Domain Modules

1. **Content Module** — Destinations, Universities, Courses, Scholarships, Events, Blog, Branches, Testimonials, Team/Counsellors, Partner Logos. CRUD via CMS; public read API cached (Redis, 5–15 min TTL) + CDN.
2. **Identity Module** — Users (Student, Counsellor, BranchAdmin, ContentAdmin, SuperAdmin), Auth (JWT + refresh, OTP), RBAC.
3. **Lead Module** — Lead entity, UTM/attribution capture, consent records, branch/office routing, dedup logic, CRM sync webhook/outbox pattern.
4. **Application Module (Phase 2)** — Application entity (student ↔ university ↔ course), Stage enum, DocumentUpload, OfferLetter, Timeline/Activity log.
5. **Notification Module** — Template-based email/SMS/WhatsApp sends, triggered by domain events (lead created, stage changed, event reminder).
6. **Search Module** — Indexing pipeline: on Content Module write → push to Meilisearch/Elasticsearch index (universities, courses).
7. **Events Module** — Event, Registration, capacity, filters (month/mode/destination/city).
8. **Admin/CRM Module** — Pipeline board (Kanban) view over Lead + Application, notes, tasks, call logs.

## 5. Key Integrations

| Integration | Purpose | Notes |
|---|---|---|
| CRM (HubSpot/Salesforce/Zoho) | Lead sync for sales/counsellor follow-up | Outbox pattern: write locally first, async push, retry on failure |
| Email/SMS/WhatsApp provider | Nurture sequences, OTP, notifications | Template versioning, opt-out compliance |
| IELTS/PTE/TOEFL/Duolingo booking partners | Deep-link or API booking (as IDP does with IELTS booking) | Start as deep-links (Phase 1), API integration Phase 2+ |
| Education loan / forex / insurance partners | Referral links / lead-share API | Track as "Student Essentials" clicks/conversions |
| Analytics (GA4, GTM, Segment) | Funnel + attribution | Server-side tagging to survive ad blockers |
| Maps (Google Maps/Mapbox) | Branch locator | Static list fallback for low-bandwidth users |
| Payment (future) | Application fee handling if introduced | Razorpay/Stripe when in scope |

## 6. Search & Typeahead Requirements

- Index fields for Universities: `name`, `aliases`, `country`, `city`, `course_types[]`, `rankings{source, value}`, `logo`, `slug`.
- Index fields for Courses: `subject_name`, `category`, `study_levels[]`, `destinations[]`.
- Must support fuzzy match (typo tolerance) — competitor lists show long, punctuation-heavy institution names (e.g., "St. Mary's University College") requiring tolerant matching.
- Response target: p95 < 300ms; pagination 10–20 results/page with "load more".

## 7. Data Privacy & Compliance

- Store consent flags separately per purpose: `marketing_opt_in`, `partner_institution_opt_in`, `newsletter_opt_in` — mirrors StudyIn's two distinct checkboxes.
- Passport status, nationality are sensitive-ish PII → encrypt at rest (column-level or KMS-backed).
- Implement "Right to be forgotten" endpoint (soft-delete + PII scrub job).
- Cookie consent banner (GDPR/DPDP) gating non-essential analytics cookies.
- Publish standard policy pages: Privacy Policy, Terms of Service, Cookie Policy, Refund/Payment Terms (if applicable), Student Complaint Policy, Agent Code of Conduct — all as CMS-managed static pages.

## 8. Environments

| Env | Purpose | Notes |
|---|---|---|
| `local` | Developer machines | Docker Compose (Postgres, Redis, Meilisearch, MailHog) |
| `staging` | QA/UAT | Mirrors production, seeded with anonymized data |
| `production` | Live | Blue/green or rolling deploys, DB migrations gated behind approval |

## 9. API Design Principles

- REST (or GraphQL if team prefers single endpoint) with versioning: `/api/v1/...`.
- Pagination: cursor-based for search/listing endpoints.
- Errors: RFC7807 problem+json format.
- Idempotency keys on lead-submission endpoint to prevent duplicate submissions from double-clicks/retries.
- Rate limiting on public endpoints (search, lead submission) via Redis token bucket — protect against scraping/spam.

## 10. Testing Strategy

- Unit tests: domain logic (stage transitions, dedup, consent logic) ≥ 80% coverage on Core API.
- Integration tests: API ↔ DB, API ↔ Search index sync.
- E2E tests (Playwright/Cypress): Destination page render, Course Finder search flow, Multi-step consultation form submission, Login + Dashboard load, Application stage update.
- Load testing (k6) on Search API and Lead submission endpoint before intake-season traffic spikes.
- Accessibility testing (axe-core) in CI for public pages.

## 11. Deployment & DevOps

- Infrastructure as Code (Terraform) for DB, Redis, Search cluster, S3 buckets, CDN.
- Feature flags (LaunchDarkly/Unleash) for staged rollout (e.g., new destination page template, application tracker).
- Blue/green deploy for backend; Vercel/Netlify preview URLs for frontend PRs.
- Automated DB migrations (Prisma/TypeORM/Alembic) run pre-deploy with rollback plan.

## 12. Open Technical Decisions
- Headless CMS vendor choice (Strapi self-hosted vs. Contentful/Sanity managed) — cost vs. control tradeoff.
- Build vs. buy CRM (impacts Lead Module scope in Phase 1).
- Search engine choice (Meilisearch simpler ops vs. Elasticsearch more powerful facets) — recommend Meilisearch for MVP given dataset size (<50k records).
