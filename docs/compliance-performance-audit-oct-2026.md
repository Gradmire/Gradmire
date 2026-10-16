# Compliance, accessibility and performance audit — October 2026

Audit of the static frontend (`frontend/pages`, 35 pages) against the legal/compliance and web-performance checklists. Accessibility was measured with axe-core 4.10 (WCAG 2 A/AA) on every page before and after the changes.

**Result:** all 35 pages pass axe (WCAG 2 A/AA) with no violations in both light and dark mode; before the changes about 20 pages failed in light mode alone. The items marked **Needs you** below cannot be completed without business facts or legal review.

## Legal and compliance

| Item | Status | What changed / what is needed |
| --- | --- | --- |
| Privacy policy | Done (existing) | Cookies section rewritten to match what the site really stores; links to the new cookie policy and data-request form. |
| Terms of service | Done (existing) | Links fees and refunds to the new policy. |
| Refund policy | **Needs you** | `refund-policy.html` drafted with highlighted `[To confirm: …]` placeholders: paid services and fees, refund windows, billing email, response and refund times, effective date. It is `noindex` until filled. Remove the `robots` meta tag once done. Legal review required (`rules.md` §3.5). |
| Cookie policy | Done | `cookie-policy.html` lists every storage item, its purpose and lifetime, and the third-party services that load. |
| Cookie consent banner | Done | `site.js` → `setupConsentBanner`. Accept and Reject are equal-weight; Customise toggles Preferences/Analytics; "Cookie settings" in every footer reopens it. Nothing optional is stored before a choice. `window.gradmireConsent.allows('analytics')` is the hook any future analytics must check. |
| Form consents | Done | Consultation form: required "contact me about this request" consent is separate from optional marketing and partner opt-ins, all unticked. Signup and newsletter: explicit notices, unticked opt-ins. |
| Unnecessary data | Done | Passport status and "How did you hear" are now optional with "Prefer not to say". Popup asks only name and phone (email optional). |
| Third-party SDKs | Done | Removed the unused Bootstrap JS bundle (26 pages). Self-hosted the fonts, so Google no longer receives visitors' IP addresses. Remaining third parties are documented in the cookie policy: Unsplash images, jsDelivr/unpkg/cdnjs libraries (homepage globe, GSAP), Vercel hosting. |
| Dark patterns | Done | Removed fake live availability ("Next available: Monday 11am with Priya", "Next slot …"). Popup no longer stacks on the cookie banner and stays away 3 days after closing (with consent). |
| Hidden fees | **Needs you** | No fees are shown anywhere. The refund policy commits to a written quote before any paid service; you need to list the paid services and fees. |
| Fake reviews | Partly done, **needs you** | Removed the consultation page's star-rated testimonials: they reused homepage names with different degrees and universities (Aryan Kapoor at LSE vs UCL; Diya Menon vs Diya Singh at Toronto). Removed a "⭐ 4.9 · 340 students" rating on the dashboard. **The three homepage testimonials must be real, with the students' written consent; otherwise remove them.** |
| Unsupported claims | Partly done, **needs you** | Removed: "97% satisfaction" (2 pages), "Over 4,800 students funded", "99.2% visa success rate", "200+ Chevening awards", "#1 destination", "India's most trusted" (meta tags). Reworded "Certified immigration consultant", which contradicted the Terms ("we do not act as a licensed immigration agent"). "18 yrs" corrected to 20+ (since 2006). **Still on the site and needing a source-of-truth document (`rules.md` §3.4): 47,000+ students placed, 850+ partner universities, 50+ countries, "since 2006", "no commission / fee-only model", counsellor years of experience, team bios.** |
| Alt text | Done | Every `<img>` has an `alt`; decorative images use `alt=""`. |
| Colour contrast | Done | Light mode: footer text, hero tags, green chips on green tints, WhatsApp card, search tags, 404 number, event badge and others raised to at least 4.5:1 (3:1 for large text). Dark mode: green-filled buttons keep the deep green (#007A5A) so white text stays at 5.3:1, blue-filled areas use the deep brand blue, and green text uses the brighter dark-theme green. New `--accent-text` token for green text on tinted backgrounds. |
| Keyboard navigation | Done | "Skip to content" link on every page; Deadline Tracker items are focusable checkboxes (Space/Enter); horizontal scroll rows are focusable; form fields labelled; links in body text underlined. Pages now declare `<html lang="en">` and a doctype. |
| Business details | Partly done, **needs you** | Every footer shows Gradmire Education Pvt. Ltd., the registered office from the Terms, and privacy@gradmire.in. **Please add CIN, GSTIN (if registered) and a phone number, and confirm the address.** |
| Age consent | Done | Required "I am 18+, or my parent/guardian agrees" on the consultation form and signup; under-18 notes on the popup and contact form. |
| Unsubscribe link | Policy done, **needs you** | Newsletter and data-request pages promise a one-click unsubscribe in every email (`rules.md` §4.4). Your email provider must actually include it; the static site sends no email. |
| Font and image licences | Done, **check logos** | Fonts are SIL OFL (`assets/fonts/LICENSE.md`); photos are Unsplash Licence. University and company logos are trademarks; several are fair-use files (see `logo-sources.md`). Get permission or use official brand-kit files before launch. |
| Data deletion request | Done | `data-request.html` covers access, correction, deletion, withdrawing consent/unsubscribing and nominating someone; it opens a pre-filled email to privacy@gradmire.in. Linked from every footer, the privacy policy and the contact form. |

## Performance

| Item | Status | Notes |
| --- | --- | --- |
| Core Web Vitals | Improved | Fewer render-blocking requests (self-hosted fonts with `preload` for the main face, no Bootstrap), deferred scripts, lazy images below the fold. Measure LCP/CLS/INP on the deployed site with PageSpeed Insights; this audit could not measure field data. |
| Component-based CSS / separate responsive CSS | Not changed | Each page carries its own inline CSS plus shared `site.css`/`auth.css`. Splitting it is a larger refactor with little gain for a 35-page static site. |
| ETag-based API, React Query, virtualised lists | Not applicable | Static site with no API or long lists. Vercel already sends ETags for static files. |
| Intersection Observer | Done (existing) | Used for reveals, counters, logo sliders and pausing the globe off-screen. |
| Priority hints | Done | `preconnect` to images.unsplash.com (20 pages) and to unpkg/jsDelivr on the homepage; `preload` for the main font; `fetchpriority="high"` on hero photos. |
| Cache busting | Done | `site.css`/`site.js` are now `?v=13`. **Bump the number on every page whenever you edit them**, or browsers may keep the old version for up to a week. |
| Gzip/Brotli, connection reuse, CDN | Handled by Vercel | Vercel serves over HTTP/2 with Brotli on its edge network. Fewer third-party origins now means fewer connections. |
| Defer render-blocking JS | Done | `site.js` (all pages) and d3, topojson and GSAP (homepage) load with `defer`. A one-line script in each `<head>` applies the saved night/day theme before first paint, so deferring causes no flash of the wrong theme. |
| Dead-code elimination | Done | Removed the Bootstrap bundle, the unused Three.js earth textures (about 1.4 MB) and about 6 KB of unused homepage CSS. |
| Caching headers | Done | `frontend/vercel.json`: fonts cached for a year (`immutable`), CSS/JS for a day with a week of `stale-while-revalidate`, images for a week. |
| Service worker | Deliberately skipped | Offline caching adds stale-content risk to a marketing site that changes often. Revisit if offline tools become a goal. |

## Other things found

- **Two email domains:** the contact form sends to `counselling@gradmire.com`, while everything else uses `@gradmire.in`, and the homepage `og:url`/`og:image` point to `gradmire.com`. Confirm which domain is real.
- `og-cover.jpg` (homepage social image) is referenced but not in the repo.
- Forms have no backend yet: the consultation form, signup, newsletter and Google sign-in do not send data anywhere. Connect them before relying on them for leads.
- 21 pages had no doctype, so they rendered in quirks mode; they now render in standards mode. Automated checks found no horizontal overflow or script errors on any page, and the pages I viewed looked unchanged, but I did not visually review all 21. Watch for small spacing differences.
