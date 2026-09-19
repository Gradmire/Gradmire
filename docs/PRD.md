# Product Requirements Document (PRD)
## Study Abroad Consultancy & Application Platform

**Version:** 1.0
**Status:** Draft for review
**Based on competitor analysis of:** StudyIn (gostudyin.com), IDP Education (idp.com), KC Overseas / Studies-Overseas.com, The Chopras (thechopras.com)

---

## 1. Competitor Analysis Summary

| Feature Area | StudyIn | IDP | KC Overseas (Studies-Overseas) | The Chopras |
|---|---|---|---|---|
| Country landing pages (Study in UK/USA/Ireland etc.) | ✅ Rich, per-country hub pages | ✅ Per-country pages | ✅ Very detailed (cost, exams, visa, cities, salary tables) | ✅ Country hub w/ scholarships tab |
| Course/University finder & search | ✅ Course finder + University search (autocomplete, 1000+ institutions) | ✅ "Find a course" / "Find a university" | ✅ University directory | — |
| Instant/conditional offer tool | — | ✅ "FastLane" instant offer engine | — | — |
| Application tracking (student portal/app) | Implied via CRM form | ✅ IDP Live mobile app (search, apply, upload docs, track status) | ✅ Student login/portal | — |
| Free counselling booking (multi-step form) | ✅ Multi-step lead form (destination, subject, office locator, consent) | ✅ "Book free counselling" | ✅ "Book Online Counselling" | ✅ Free consultation CTA |
| Branch/office locator | ✅ Country + city + nearest branch dropdown | ✅ Office finder page | — | ✅ Global offices |
| Scholarships directory | ✅ Scholarships listing w/ academic year tagging | ✅ Scholarship finder | ✅ Scholarship section per country | ✅ Scholarships tab per country |
| Events (fairs/webinars/open days) | ✅ Filterable by month/mode/destination/city | ✅ Events listing | ✅ Upcoming events | — |
| Student essentials (loans, forex, insurance, SIM, accommodation, banking) | ✅ "Student Essentials" hub | ✅ Dedicated services w/ icons | — | — |
| Language/test prep (IELTS/PTE/TOEFL/Duolingo) | ✅ Language prep hub | ✅ IELTS booking + prep | ✅ Test prep links | — |
| Visa services | ✅ Visa service page | ✅ Visa assistance | ✅ Visa process breakdown w/ fee & docs checklist | ✅ |
| Student testimonials (video) | ✅ Vimeo video wall | ✅ Student stories | ✅ Testimonials | — |
| Counsellor profiles / "meet the team" | ✅ Named counsellor cards w/ quotes | ✅ Student ambassadors (peer-to-peer chat) | ✅ Named counsellor booking slots | ✅ Team page |
| University partner logos / social proof | ✅ 250+ partner logos, stats bar (since 2006, 100+ branches, reviews, 1.3M students) | ✅ Stats bar (137k dreams, 800+ partners, 11k scholarships) | ✅ "Top Admits" wall | — |
| Blog / study guides | ✅ Study guides w/ per-country tagging | ✅ News & articles | ✅ Country-specific blog w/ dates | — |
| Downloadable guide/brochure | ✅ PDF education guide download | — | ✅ "View Brochure" gated download | — |
| Cost of living / cost calculator | — | ✅ Cost of living calculator | ✅ Cost of study/living tabs | — |
| Country/geo redirect ("visiting from Country X") | ✅ Auto-detect + confirm modal | — | — | — |
| Multi-language greeting on CTAs | ✅ (JP/TH/EN CTA variants) | — | — | — |
| Community / peer forum | — | ✅ "IDP Community" + ambassador chat | — | — |
| Compliance/policy pages | ✅ Anti-bribery, whistle-blower, modern slavery, complaint policy, Agent Quality Framework | ✅ Terms, privacy, disclaimer | ✅ Terms, privacy, payment/refund policy | — |
| University comparison page (specific school + course detail) | — | — | ✅ University detail page w/ courses tab | — |

**Key takeaway:** All competitors converge on the same core loop: **Attract (country/course SEO content) → Qualify (multi-step lead form / quiz) → Convert (free counselling booking) → Retain (portal/app for tracking application + student essentials + events + scholarships)**. Differentiators are: instant eligibility/offer engines (IDP FastLane), depth of destination data (KC Overseas), global branch density (StudyIn), and community/peer features (IDP).

---

## 2. Product Vision

Build a study-abroad platform for Indian (and eventually global) students that combines:
1. A **content & discovery layer** (destinations, courses, universities, scholarships, events, guides) for SEO-driven organic acquisition.
2. A **lead-qualification funnel** (multi-step interest form + free counselling booking) to convert visitors into leads for counsellors.
3. A **student portal/app** where a qualified lead becomes an applicant who can shortlist universities, track document upload, see application status, and access student essentials (visa, forex, insurance, accommodation, loans).
4. A **counsellor/admin CRM backend** to manage leads, branches, events, and content.

## 3. Goals & Success Metrics

| Goal | Metric | Target (Year 1) |
|---|---|---|
| Organic acquisition | Monthly organic sessions | 100k+ |
| Lead generation | Free-counselling form completions | 5,000/month |
| Lead → Booked consultation | Booking rate | ≥ 35% of qualified leads |
| Application conversion | Leads that submit ≥1 university application via portal | ≥ 20% |
| Engagement | Portal return visits per active applicant | ≥ 3/month |
| Content | Published study guides/blog articles | 20/month |
| Reliability | Uptime | 99.9% |

## 4. Target Users / Personas

1. **Prospective Student (Aspirant)** – 17–28 yrs, researching destinations/courses, price-sensitive, anxious about visa & ROI. Primary consumer of country pages, course finder, scholarships, guides.
2. **Applicant** – Has picked a destination/course, needs to build shortlist, submit documents, track offers, prep visa.
3. **Parent/Sponsor** – Co-decision maker, cares about cost, safety, ROI, scholarships, loan/forex options.
4. **Counsellor (internal)** – Manages a portfolio of leads/applicants, needs CRM view, task reminders, document checklist.
5. **Branch/Office Admin** – Manages local branch data, events, counsellor assignment.
6. **Content/Marketing Admin** – Publishes country pages, blog, scholarships, events via CMS.
7. **University Partner (future/B2B)** – Views inbound applicant volume, publishes course/scholarship data (phase 3).

## 5. Scope

### 5.1 In Scope (Phase 1 – MVP)
- Public marketing site: Home, Country/Destination pages (dynamic, per country), Course finder, University finder/detail pages, Scholarships listing, Events listing + filters, Blog/Study guides, Services pages, About/Team/Branches, Free-consultation multi-step form, Branch locator.
- Lead capture + CRM sync (webhook/API to CRM or internal lead DB).
- Basic student account (signup/login), dashboard shell, saved universities/shortlist.
- Admin CMS for destinations, courses, universities, scholarships, events, blog.
- Analytics + UTM tracking parity with competitor forms.

### 5.2 In Scope (Phase 2)
- Full application tracker: document upload, application status per university, offer letters, visa checklist, timeline/reminders.
- Counsellor CRM dashboard: lead pipeline (Kanban), task assignment, notes, call logs.
- Test-prep / language-prep content + booking integration (IELTS/PTE/TOEFL/Duolingo).
- Student essentials marketplace integrations (education loan, forex, insurance, accommodation) — referral/affiliate links or partner APIs.
- Notifications (email/SMS/WhatsApp) for lead nurture and applicant status changes.

### 5.3 In Scope (Phase 3 — Growth)
- Instant Eligibility / "Fastlane"-style conditional offer engine.
- Mobile app (iOS/Android) mirroring portal.
- Community / peer-ambassador chat.
- University partner portal (B2B).
- Cost-of-living calculator, AI course/university recommendation.

### 5.4 Out of Scope (initial release)
- Payment processing for tuition (informational/referral only).
- Direct university application submission APIs (UCAS/Common App integration) — phase 3+.
- Multi-country legal/compliance beyond India-outbound.

## 6. Functional Requirements

### 6.1 Marketing / Content Site
- FR-1: Home page with hero, trust stats bar, destination grid, featured courses, events widget, scholarships carousel, testimonials, counsellor cards, partner logo wall, blog teaser, footer with compliance links.
- FR-2: Destination (Country) page template with sections: Overview, Top Universities, Top Courses, Cost of Study/Living, Scholarships, Intakes, Eligibility, Exams Required, Application Requirements, Visa Process (fee + docs), Career Opportunities/Salary table, Top Cities, Video reels, Top Admits, "Why choose us", FAQs, related blogs.
- FR-3: Course Finder: search-as-you-type by subject, filter by study level (UG/PG/Foundation/Research/etc.), filter by destination country, results list with course cards (university, ranking, next intake, entry score, CTA).
- FR-4: University Finder: search-as-you-type by institution name (typeahead over full institution list), filter by course type & destination; University detail page with course tabs, ranking, fees, intakes.
- FR-5: Scholarships directory: list/detail, filterable by country/academic year/degree level.
- FR-6: Events page: filter by month, mode (in-person/online), destination, city; event detail with registration form.
- FR-7: Branch/Office locator: select country → city → office; map/list display with address, phone, counsellor list.
- FR-8: Blog/Study Guides: tag by destination + topic, publish date, related-article rail.
- FR-9: Country-based geo-redirect banner ("You are visiting from X, go to X site?").
- FR-10: Global multi-country site switcher (site selector with region grouping).

### 6.2 Lead Capture & Qualification
- FR-11: Multi-step "Book Free Consultation" form: Step 1 (name, phone w/ country code, email, intended intake period, study destination, nationality, other destinations of interest, consent checkboxes), Step 2 (nearest office: country → city → office), Step 3 confirmation/thank-you with next steps.
- FR-12: Secondary lightweight lead form variant (name, email, study type, preferred subject, source, passport status) for content-page inline CTAs.
- FR-13: UTM & attribution capture (utm_source/medium/campaign/term/content, referrer, landing page, partner/marketing-staff ID) stored with every lead.
- FR-14: Consent management (marketing opt-in, partner-institution opt-in) stored distinctly, unsubscribe support.
- FR-15: Lead deduplication by email/phone; merge into existing CRM record.
- FR-16: Auto-routing of lead to nearest branch/counsellor based on selected office.

### 6.3 Student Account & Portal (Phase 1 shell → Phase 2 full)
- FR-17: Signup/login (email+password, OTP, Google/Apple SSO).
- FR-18: Dashboard: profile completion %, saved/shortlisted universities & courses, upcoming events registered, assigned counsellor contact card.
- FR-19 (Phase 2): Application tracker — per university: stage (Shortlisted → Documents Pending → Submitted → Under Review → Offer Received → Accepted → Visa → Enrolled), document checklist with upload, offer letter storage.
- FR-20 (Phase 2): Visa checklist & appointment tracker.
- FR-21 (Phase 2): Notifications center (in-app + email/SMS/WhatsApp) for status changes & reminders.

### 6.4 Admin / CMS
- FR-22: Role-based admin (Content Editor, Counsellor, Branch Admin, Super Admin).
- FR-23: CMS for Destination pages, Universities, Courses, Scholarships, Events, Blog, Branches, Team/Counsellor profiles, Testimonials, Partner logos.
- FR-24: Lead/CRM dashboard: Kanban pipeline by stage, filters (destination, source, counsellor, date), notes/call log, task reminders, export to CSV/CRM.
- FR-25: Event management: create event, capacity, registrations export, email confirmations.
- FR-26: Audit log for content & lead changes.

### 6.5 Non-content system requirements
- FR-27: Full-text/typeahead search across 1,000+ universities and 100+ course subjects with <300ms response.
- FR-28: SEO: server-rendered pages, structured data (Organization, FAQ, Course, EducationalOccupationalProgram schema), sitemaps per locale/country.
- FR-29: Multi-locale support (English first; architecture must allow additional locales/currencies later).
- FR-30: Accessibility WCAG 2.1 AA for public pages.

## 7. Non-Functional Requirements
- Performance: LCP < 2.5s on 4G for country pages; TTFB < 600ms.
- Availability: 99.9% uptime SLA.
- Security: OWASP ASVS L2 baseline; PII (passport status, phone, email) encrypted at rest; GDPR/DPDP (India) compliant consent trail.
- Scalability: support 500k monthly sessions, 50k concurrent at peak (exam result/intake seasons).
- Data retention: leads retained per consent; deletion-on-request workflow.
- Observability: centralized logging, error tracking, uptime monitoring, funnel analytics (GA4 + CRM events).

## 8. Assumptions & Constraints
- Primary market: India (multi-country expansion architecture, not initial scope).
- CRM: assume a pluggable CRM integration point (HubSpot/Salesforce/Zoho or custom) rather than building full CRM in MVP — but Phase 2 requires an internal lightweight CRM if no 3rd-party is chosen.
- Content volume at launch: 10 destination pages, 1,000+ university records (import/seed), 500+ course subjects, 50 scholarships, 20 blog posts.
- No payment gateway in MVP (referral-only for loans/forex/insurance).

## 9. Risks
| Risk | Mitigation |
|---|---|
| Large university/course dataset needs ongoing curation | Build CMS bulk-import (CSV) + partner data feed ingestion job |
| Lead-form drop-off (multi-step forms are long) | Progressive disclosure, save-and-resume, minimal required fields in step 1 |
| SEO cannibalization across many near-duplicate destination pages | Canonical tags, unique per-country content blocks, avoid templated boilerplate |
| Compliance (education agent regulation, data privacy) | Legal review of Agent Quality Framework-equivalent policy, DPDP compliance, consent granularity |
| Portal/app scope creep into full CRM | Explicit phase gating (see Section 5) |

## 10. Release Plan (High-Level)
- **Phase 1 (MVP, ~10–12 weeks):** Marketing site + course/university finder + lead capture + basic account shell + CMS.
- **Phase 2 (+8–10 weeks):** Application tracker, counsellor CRM, notifications, test-prep integration.
- **Phase 3 (+ongoing):** Instant offer engine, mobile app, community, partner portal.

See `tracker.md` for the detailed task breakdown and `implementation.md` for the build sequence.
