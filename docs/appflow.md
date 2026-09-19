# App Flow
## Study Abroad Consultancy & Application Platform

Describes user journeys and screen-to-screen flow, derived from patterns in StudyIn, IDP, and KC Overseas.

---

## 1. High-Level Site Map

```
Home
├── Destinations
│   └── /study-in-{country}  (Overview, Universities, Courses, Cost, Scholarships,
│                              Intakes, Eligibility, Exams, Visa, Careers, Cities, FAQs)
├── Course Finder  (/find-courses)
├── University Finder  (/find-universities)
│   └── /universities/{country}/{university-slug}  (detail + courses tab)
├── Scholarships  (/scholarships)
│   └── /scholarships/{destination}/{scholarship-slug}
├── Events  (/events)
│   └── /events/{event-slug}
├── Services
│   ├── /services/visa
│   ├── /services/counselling
│   ├── /services/test-prep (IELTS/PTE/TOEFL/Duolingo)
│   └── /services/student-essentials (loans, forex, insurance, SIM, accommodation, banking)
├── Blog / Study Guides  (/blog)
│   └── /blog/{slug}
├── Company
│   ├── /about
│   ├── /team
│   ├── /branches (locator)
│   └── /careers
├── Free Consultation  (/free-consultation)  — multi-step lead form
├── Auth
│   ├── /signup
│   ├── /login
│   └── /forgot-password
└── Student Portal (auth-gated)
    ├── /dashboard
    ├── /dashboard/shortlist
    ├── /dashboard/applications/{id}   (Phase 2)
    ├── /dashboard/documents           (Phase 2)
    ├── /dashboard/events
    ├── /dashboard/messages             (Phase 2)
    └── /dashboard/profile
```

---

## 2. Primary User Journey: Prospective Student → Booked Consultation

1. **Entry** — User lands on Home (organic search, ad, or country-specific landing page) or Country Destination page.
2. **Geo-check** — If IP/locale mismatch detected, show non-blocking banner: "You are visiting from India — stay here / go to India site."
3. **Explore** — User browses destination sections (Cost, Scholarships, Visa, Careers) or uses Course Finder / University Finder.
4. **Micro-conversion (optional)** — User downloads Education Guide PDF (gated behind a lightweight email-only field) or clicks "View Brochure."
5. **Primary CTA click** — "Book Free Consultation" / "Chat to an expert" / "Get funding advice" (all route to the same multi-step form, pre-filled with context, e.g., destination selected).
6. **Multi-Step Consultation Form:**
   - **Step 1 – About you:** First name, last name, phone (with country/phone code selector), email, intended year/intake, primary study destination (dropdown), nationality, checkboxes for additional destinations of interest.
   - **Step 2 – Nearest office:** Country → City → specific Office/branch cascading dropdowns (auto-suggest nearest based on geo if possible).
   - **Consent:** Two distinct checkboxes — (a) receive comms from the company, (b) receive comms from partner institutions. Both required per policy language, but stored as separate flags.
   - **Hidden fields captured automatically:** UTM params, referrer, landing page, partner/marketing-staff ID, form type, page depth.
   - **Submit → Thank-you screen:** Confirmation message + "what happens next" (counsellor will call within X hours) + optional calendar-slot picker for a specific counsellor (as seen with named counsellor booking cards).
7. **Post-submission automation:** Lead created in CRM → routed to nearest branch/counsellor → confirmation email/SMS/WhatsApp sent → nurture sequence begins (scholarship tips, event invites) if marketing opt-in = true.
8. **Follow-up:** Counsellor contacts lead offline/via portal; lead status updates flow into Counsellor CRM Kanban.

### Alternate/secondary lead form (inline, shorter)
Used on blog posts, course cards, or footer widgets: First name, last name, email, type of study (UG/PG/Research/Other), preferred subject (autocomplete from full subject list), how did you hear about us, passport status (Yes/No/Applied). Submits to the same Lead entity with a `form_variant` tag.

---

## 3. Course Finder Flow

1. User arrives at `/find-courses` (or via Home widget toggle "Courses").
2. Enters/selects: subject (typeahead over ~80 subjects), study level (Postgraduate/Undergraduate/Foundation/A-Level/English Language/GCSE/HND/K-12/Pre-Masters/Pre-Sessional/Research/Vocational), destination country.
3. Submits search → Results page: list of course cards (Course name, University, Ranking, Next intake date, Entry score, "Read more" CTA).
4. Course card click → Course/University detail page with full course tab, fees, entry requirements, "Add to shortlist" and "Talk to counsellor about this course" CTAs.
5. Empty/low-result state → suggest broadening filters + inline lead-capture ("Can't find your course? Let an expert help").

## 4. University Finder Flow

1. User arrives at `/find-universities`.
2. Typeahead search across full institution list (1000+); filters: study level, destination ("Any Country" default).
3. Selecting a university → University detail page: Overview, Courses tab (filterable by level), Rankings, Location, "Book counselling about this university."
4. Cross-link: University detail page links back to relevant Destination page and related Scholarships.

## 5. Scholarships Flow

1. `/scholarships` — list filterable by destination, academic year, degree level.
2. Card shows: Academic Year tag, Scholarship name, short eligibility teaser, "Learn more."
3. Detail page: full eligibility, coverage amount, deadline, application steps, related CTA to free consultation.
4. Destination pages surface top 3 scholarships inline with "View all scholarships" link.

## 6. Events Flow

1. `/events` — filter bar: Month, Mode (All/In-Person/Online), Destination, Location/City.
2. Event card: date, title, mode badge, destination flag, "Register."
3. Register → lightweight form (name, email, phone, city) OR auto-filled if logged in → confirmation + calendar invite (.ics) + reminder email 24h before.
4. Post-event: registered users receive follow-up email/resources; attendance logged against Lead/Student record.

## 7. Branch/Office Locator Flow

1. User selects Country → City → Office (cascading, matches competitor pattern exactly).
2. Result: office card (address, phone, map pin, list of counsellors, "Book with this office").
3. Also embedded as Step 2 inside the Free Consultation form (shared component).

## 8. Auth & Onboarding Flow

1. `/signup` — Email + password OR Google/Apple SSO OR phone+OTP.
2. Post-signup — Short onboarding quiz (destination interest, intended intake, study level, subject) → pre-populates dashboard recommendations (mirrors the lead-form fields, avoids re-asking if user arrived via a lead form — merge by email/phone).
3. `/login` — standard; "Forgot password" via email reset link or OTP.
4. First login → Dashboard tour tooltip (profile completion nudge).

## 9. Student Portal / Dashboard Flow (Phase 1 shell → Phase 2 full)

1. **Dashboard home:** profile completion %, assigned counsellor card (photo, name, "message" / "book a call"), shortlisted universities/courses, upcoming registered events, recommended scholarships.
2. **Shortlist:** Add/remove universities & courses (synced from Course/University Finder "Add to shortlist" actions).
3. **Applications (Phase 2):** Per shortlisted university → "Start Application" → Stage tracker:
   `Shortlisted → Documents Pending → Submitted → Under Review → Offer Received → Offer Accepted → Visa in Progress → Enrolled`
   - Document upload widget per required doc type (transcript, SOP, LOR, passport, English test score, resume).
   - Timeline/activity log (auto + counsellor-added notes).
   - Offer letter viewer/download when stage = Offer Received.
4. **Visa checklist (Phase 2):** Auto-generated per destination country (from Destination page's "Application/Visa Requirements" data) with checkable items and document upload.
5. **Messages (Phase 2):** Thread with assigned counsellor.
6. **Profile:** Editable personal info, nationality, passport status, academic history, test scores (IELTS/TOEFL/PTE/GRE/GMAT).

## 10. Counsellor / Admin CRM Flow (internal)

1. Counsellor logs into `/admin` (separate app or route-gated by role).
2. **Lead Inbox / Kanban board:** columns = New → Contacted → Qualified → Consultation Booked → Application Started → Enrolled → Lost/Unresponsive. Drag-and-drop or dropdown stage change.
3. Lead detail drawer: all captured fields (from both multi-step and short forms), UTM/source, consent flags, call/notes log, "Convert to Applicant" action (creates linked Application records once destination/course chosen).
4. **Branch Admin view:** filter leads/events by branch; manage local counsellor assignment.
5. **Content Admin view:** CMS forms for Destination pages, Universities, Courses, Scholarships, Events, Blog (separate from CRM; role = ContentAdmin).
6. **Reporting:** funnel dashboard (Leads → Bookings → Applications → Enrollments) by destination/source/branch/date range.

## 11. Notification Touchpoints (cross-cutting)

| Trigger | Channel | Recipient |
|---|---|---|
| Lead form submitted | Email + SMS | User (confirmation) + Counsellor (new-lead alert) |
| Event registration | Email (+ .ics) | User |
| Event reminder (24h prior) | Email/SMS/WhatsApp | User |
| Application stage change | Email + in-app | User |
| Document requested/missing | Email + in-app | User |
| Offer received | Email + in-app + SMS | User |
| Visa appointment reminder | Email/SMS | User |
| Nurture drip (scholarship tips, deadlines) | Email | Opted-in leads |

## 12. Error / Edge-State Flows
- Empty search results → guided fallback (broaden filters + lead CTA).
- Form validation errors → inline, field-level, non-blocking of already-valid steps.
- Session expiry mid-application → save draft, redirect to login, restore on return.
- Duplicate lead submission (same email/phone within 24h) → update existing lead instead of creating duplicate, notify counsellor of "repeat interest."
- Offline/slow network on document upload → resumable upload with progress + retry.
