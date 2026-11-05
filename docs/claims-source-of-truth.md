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
| "Founded in 2026 in Noida by Aquib Jamal", branches in Delhi/NCR, Greater Noida, Lucknow and Kanpur ("Opening soon") | Stated by the owner on the About page. No separate evidence in the repository. |
| Response time: the consultation popup and page say "within 24 hours", the homepage says "one working day", and `gradmire.html` says "24 business hours" | Align all wording with the 24 business hour SLA in `docs/rules.md` §4.2 |
| University and employer logos on the homepage | 15 are public-domain files that are still trademarks, used only to name the organisation. See `docs/logo-sources.md`. |
