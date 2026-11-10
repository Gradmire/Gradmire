# Claims source of truth

`docs/rules.md` §3.4 says every statistic, review score and student count on the site must be backed by an internal source-of-truth document. This is that document. Update it whenever a claim is added, changed or removed, and review it at least quarterly.

Last updated 2 November 2026.

## Confirmed by the owner

| Claim | Where it appears | Evidence | Revisit when |
|---|---|---|---|
| Gradmire takes no commission from universities and runs a fee-only model ("No commission model", "0% commission from universities", "No commissions from universities. Ever.", "our only client is you") | `index.html` (hero pill, "Commission from universities" card, evidence line), `about.html` (two lines), `faq.html` (one answer) | The owner confirmed on 2 November 2026 that Gradmire does not earn money from universities or from referral partners | Any paid arrangement starts with a university or referral partner. Check in particular the loan, forex and insurance referral links planned in `docs/PRD.md`, and whether sharing leads with partner institutions (`partner_institution_opt_in`) ever becomes paid. |

## Facts that can be checked in this repository

| Statement | Source |
|---|---|
| 9 destination country guides | the nine `study-in-*` pages |
| 9 MBBS abroad country guides | the nine `mbbs-in-*` pages |
| 4 free planning tools | `tools/` (comparator, deadline tracker, cost calculator, grade converter) |
| 68 universities and 171 example courses in the Course Finder, 8 universities per country (4 for Finland) | `scripts/course-data.mjs`. The hero stats on the UK, USA, Canada and Australia guides and the "68" on `gradmire.html` are typed in by hand, so update them when this file changes. |

## 2027 guides (added 10 November 2026)

Seven articles generated from `scripts/blog-data.mjs`: `study-abroad-2027`, `study-abroad-intakes-2027`, `best-countries-to-study-abroad-2027`, `study-abroad-scholarships-2027`, `study-abroad-checklist-2027`, `study-abroad-tests-2027` and `mbbs-abroad-2027`. They carry no statistics, fees, salaries, testimonials or named authors (`author` in the Article schema is the organisation). Every claim comes from one of these:

| Statement | Source |
|---|---|
| UCAS main deadline for 2027 entry is 18:00 UK time on 13 January 2027; Oxford, Cambridge, medicine, dentistry and veterinary courses had 15 October 2026 | [UCAS event page](https://www.ucas.com/events/2027-entry-deadline-for-all-undergraduate-courses-except-those-with-a-15-october-deadline-475546), read 10 November 2026 |
| Typical intake months by country (September, January, February, July and so on) | The intake calendars on the `study-in-*` pages, plus well-known academic calendars for Germany, Ireland, New Zealand, Italy and Finland. Every article says the months are typical and to confirm on the university page. **Owner to verify** the Germany, Ireland, Italy, Finland and New Zealand rows. |
| IELTS usually valid 2 years, TOEFL 2 years, GRE and GMAT 5 years; TOEFL 1 to 6 scale since 21 January 2026 | `test-prep-*.html` and `scripts/build-service-pages.mjs` |
| Scholarship names by country | `scripts/scholarship-data.mjs` (names only; amounts and deadlines stay on the scholarship pages) |
| MBBS programme length and teaching language by country; NEET needed; about 6 years with 54 months of study plus a 12-month internship at the same university; recognition via the World Directory of Medical Schools | `scripts/mbbs-data.mjs`, which cites the NMC Foreign Medical Graduate Licentiate Regulations 2021 |
| Germany: Indian applicants are normally asked for an APS certificate, which can take months | General knowledge, hedged in the text ("normally", "confirm with DAAD"). **Owner to verify.** |
| "Gradmire does not earn commission from universities" (in the FAQ of three articles) | Owner confirmation recorded above |

Not stated anywhere in the guides, on purpose: Canadian study permit caps for 2027 (not confirmed when written), any fee, visa charge, proof-of-funds amount or exchange rate. Re-review before 10 May 2027.

## Removed because there was no evidence

- "47,000+ students placed", "47k+", the per-country "students placed" counts (47k, 15k, 12k, 10k), and "4,200+ placed this year".
- "850+ partner universities", "1,000+ partner universities", "150+ UK partnerships", and the per-country partner counts (150+, 200+, 120+, 100+).
- "Since 2006", "20+ years", "18+ years", "50+ countries". The About page says Gradmire was founded in 2026.
- The homepage `AggregateRating` (4.9 from 47,000 ratings, 3,200 reviews). The figures were not shown on the page.
- Three named homepage testimonials and two on `gradmire.html`, the named counsellor profiles and their stock photos, and the invented authors and dates on the blog cards.
- "Our partner universities" headings and "official partnerships" wording.

Do not put any of these back without evidence recorded in this file. Named testimonials and named staff need the person's written consent.

## Still open

| Item | Status |
|---|---|
| "Founded in 2026 in Noida by Aquib Jamal" | Stated by the owner on the About page. No separate evidence in the repository. |
| Two offices only: Kanpur (Near Halim College, Prem Nagar) and Greater Noida (N2 Tower, Supertech Ecovillage 1). Replaced the earlier New Delhi registered office, the invented Mumbai, Hyderabad, Bengaluru, Pune and Chennai branches, and the "Opening soon" branches | Given by the owner on 10 Nov 2026. No postcodes were supplied, so none are published. The terms and grievance pages still name the courts in New Delhi as the jurisdiction: that is a legal choice, not an address, and was not changed. Owner to confirm which office, if either, is the registered office on the company records. |
| The founder story on the About page (Aquib Jamal, photo, "Meet the founder") | Written only from statements already on the site: founded in 2026, believes the advice should be clear, honest and built around the student, fee-only with no university commissions, counsellors who specialise by destination, new company that would rather earn trust than claim it. It contains no personal history, qualifications or quotes. Owner to add real details (why he started, background) if he wants them. The photo was supplied by the owner. |
| Response time: the consultation popup and page say "within 24 hours", the homepage says "one working day", and `gradmire.html` says "24 business hours" | Align all wording with the 24 business hour SLA in `docs/rules.md` §4.2 |
| University and employer logos on the homepage | 15 are public-domain files that are still trademarks, used only to name the organisation. See `docs/logo-sources.md`. |
