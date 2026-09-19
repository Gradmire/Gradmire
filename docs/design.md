# Design Guidelines
## Study Abroad Consultancy & Application Platform

---

## 1. Design Principles

1. **Trust first** — Study-abroad decisions are high-stakes and expensive; every page should reinforce credibility (stats bars, partner logos, named counsellors, real testimonials) exactly as StudyIn ("Since 2006, 100+ branches, 4.7/5.0, 1.3M students assisted") and IDP ("137,000 dreams," "800+ university partners") do.
2. **Clarity over cleverness** — Dense informational content (visa fees, cost tables, eligibility) must be scannable: use tables, badges, and collapsible accordions rather than long paragraphs.
3. **Guided, not overwhelming** — Long forms and huge datasets (1,000+ universities) need progressive disclosure: search-first patterns, step-by-step forms, filters that narrow rather than a firehose of options.
4. **Consistent destination template** — Every country page follows the same section order so returning users build muscle memory (Overview → Universities → Courses → Cost → Scholarships → Intakes → Eligibility → Exams → Application/Visa → Careers → Cities → Testimonials → FAQs).
5. **Mobile-first** — Majority of the target audience (17–24, India) browses on mobile; forms, tables, and dropdowns must be thumb-friendly and use bottom-sheet patterns on small screens.
6. **Accessible** — WCAG 2.1 AA minimum: color contrast ≥ 4.5:1 for body text, all form fields labelled, keyboard-navigable multi-step forms, focus-visible states.

## 2. Visual Identity

### 2.1 Color System (token-based, define in code as CSS variables)
| Token | Purpose | Example (customize to brand) |
|---|---|---|
| `--color-primary` | Primary brand color (CTAs, links, active states) | Deep blue #1A3C7B or brand-specific |
| `--color-primary-hover` | Hover/darker variant | |
| `--color-accent` | Secondary accent (badges, highlights — e.g., scholarship tags) | Warm orange/gold #F5A623 |
| `--color-success` | Offer received, completed steps | Green #1E9E5A |
| `--color-warning` | Pending documents, deadlines | Amber #E0A400 |
| `--color-danger` | Errors, rejected/expired | Red #D64545 |
| `--color-bg` | Page background | #FFFFFF / #F7F8FA |
| `--color-surface` | Card backgrounds | #FFFFFF with subtle shadow |
| `--color-text-primary` | Headings/body | #14213D |
| `--color-text-secondary` | Meta text, captions | #5B6472 |
| `--color-border` | Dividers, input borders | #E2E5EA |

Dark mode: define `--color-*` overrides under `prefers-color-scheme: dark` / `[data-theme="dark"]`; keep same semantic names.

### 2.2 Typography
- **Headings:** A distinctive serif or geometric sans for H1/H2 to feel "institutional/academic" (e.g., "Fraunces" or "Sora") — avoid default system fonts alone for hero headings, as competitors use custom brand type.
- **Body/UI:** Highly legible sans-serif (Inter, Public Sans, or similar) at 16px base, 1.5 line-height.
- **Scale:** H1 40/48px, H2 32/40px, H3 24/32px, H4 20/28px, Body 16/24px, Small 14/20px, Caption 12/16px.
- **Numerals for stats bar** should be visually oversized (e.g., "100+", "1.3M") — tabular-nums, bold weight, paired with small caption label underneath (pattern seen across all three competitors).

### 2.3 Iconography & Imagery
- Line-icon set (outline style, 24px grid) for service categories (Visa, Loan, Insurance, SIM, Accommodation, Banking) — matches IDP's icon-led "Student Essentials" grid.
- Destination hero images: authentic photography of the destination (skyline/campus), not generic stock — consistent 16:9 or 3:2 crop, lazy-loaded, `srcset` responsive.
- Counsellor/testimonial photos: circular crop, consistent lighting/background treatment.
- Country flags as small icon badges next to nationality/destination dropdowns.

### 2.4 Spacing & Grid
- 8px base spacing scale (4/8/12/16/24/32/48/64/96).
- 12-column grid, max content width 1280px, gutter 24px desktop / 16px mobile.
- Section vertical rhythm: 64–96px desktop, 40–56px mobile between major sections.

## 3. Component Library (build in Storybook)

### Core components
- **Button** (primary, secondary, ghost, sizes sm/md/lg, loading state)
- **Input / Select / PhoneInput (with country code)** / **Checkbox** / **Radio** / **Autocomplete/Typeahead** (for university/subject search — must handle 1,000+ item lists performantly with virtualization)
- **Cascading Select** (Country → City → Office) for branch locator
- **Card variants:** CourseCard, UniversityCard, ScholarshipCard, EventCard, BlogCard, CounsellorCard, TestimonialCard
- **StatBar** (icon + big number + label, 4-across on desktop, 2x2 on mobile)
- **Tabs / Accordion** — for destination-page sub-sections (Cost of Study/Living, Bachelors/Masters course toggle)
- **Filter Bar** — chips + dropdowns with "All Filters" modal on mobile (matches Events page filter pattern)
- **Multi-Step Form Shell** — progress indicator (numbered steps or progress bar), back/next, per-step validation, save-draft
- **Stage Tracker / Timeline** — horizontal stepper for application stages (Shortlisted → ... → Enrolled), vertical variant for activity log
- **Modal / Bottom Sheet** — geo-redirect banner, video lightbox (testimonials), "All Filters" on mobile
- **Toast/Notification** — form submission success/error
- **Logo Wall / Marquee** — auto-scrolling partner university logos
- **Video Card** — thumbnail + play icon overlay, opens modal player (Vimeo/YouTube embed)

## 4. Key Page Layouts

### 4.1 Home
Hero (rotating headline + CTA) → Stat bar → Course/University search widget (tabbed) → Events carousel (filterable) → Destination grid (by region tabs: Americas/Asia/Australia/Europe/Middle East) → Counsellor cards carousel → Scholarships carousel → Video testimonial wall → Partner logo wall → Featured courses grid → Study guides/blog grid → Bottom CTA banner → Footer.

### 4.2 Destination (Country) Page
Sticky in-page nav (jump links to Overview/Universities/Courses/Cost/Scholarships/Intakes/Eligibility/Exams/Visa/Careers/Cities/FAQs) → Hero with country image + "Book Free Counselling" CTA → alternating content sections (text block + stat chips) → tables for cost/salary data → accordion for FAQs → related blog rail → bottom CTA.

### 4.3 Course/University Finder Results
Left/top filter panel (collapsible on mobile) + result grid/list toggle + result count + sort (relevance/ranking/intake date) + pagination or infinite scroll with "load more."

### 4.4 Multi-Step Consultation Form
Centered card (max-width 560px) on light background, step progress bar at top, one logical group of fields per step, sticky "Next/Submit" button, trust microcopy near submit ("Free, no obligation, unsubscribe anytime").

### 4.5 Student Dashboard
Left sidebar nav (Dashboard/Shortlist/Applications/Documents/Events/Messages/Profile) + top bar (avatar, notifications bell) + main content cards. Application stage tracker as prominent horizontal component per shortlisted university.

## 5. Content/Tone Guidelines
- Microcopy is reassuring and action-oriented: "Free counselling," "No obligation," "Get funding advice" (verbs + benefit).
- Numbers/social proof always paired with a short human label, never a bare statistic.
- Avoid jargon in nav labels; use student-facing language ("Course finder," not "Program catalog").
- Every destination page must answer, near the top: *why this country, what it costs, what happens after graduation* — matches competitor emphasis on post-study work visas and salaries.

## 6. Responsive Behavior
- Breakpoints: `sm` 360–639, `md` 640–1023, `lg` 1024–1439, `xl` 1440+.
- Navigation: full mega-menu on desktop (`lg`+) collapses to slide-in mobile drawer with accordion sub-menus (as seen in all competitor mobile menus).
- Tables (cost/salary/eligibility) become horizontally scrollable cards or stacked key-value pairs on mobile, never shrunk-to-illegible.
- Sticky mobile CTA bar ("Book Free Consultation" + phone number) pinned to bottom on content-heavy pages.

## 7. Motion & Interaction
- Subtle fade/slide-in on scroll for section reveals (max 200–300ms, respect `prefers-reduced-motion`).
- Logo wall: continuous marquee scroll, pause on hover.
- Form step transitions: horizontal slide, 250ms ease.
- Loading states: skeleton screens for search results and dashboard cards (not spinners) to reduce perceived latency.

## 8. Design System Deliverables Checklist
- [ ] Color & typography tokens (Figma variables + CSS export)
- [ ] Component library in Figma matching Storybook
- [ ] Destination page template (desktop + mobile)
- [ ] Multi-step form template
- [ ] Dashboard template
- [ ] Icon set (services, social, flags)
- [ ] Empty/error/loading state specs for search & dashboard
- [ ] Accessibility annotations (focus order, ARIA labels) on all interactive components
