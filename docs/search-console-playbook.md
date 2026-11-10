# Search Console playbook: 2027 content and mobile score

Last updated 10 November 2026. This is what you (the site owner) need to do in Google Search Console and PageSpeed Insights after the 2027 content and mobile app layer go live. Nothing here can be done from the repository.

## 1. One-time setup (15 minutes)

1. In [Search Console](https://search.google.com/search-console), add a **Domain property** for `gradmire.com` (DNS verification) so `www`, non-`www`, http and https are all covered.
2. **Sitemaps → Add** `https://www.gradmire.com/sitemap.xml`. The sitemap lists every indexable page with its last-modified date and now includes the seven 2027 guides.
3. **URL Inspection → Request indexing** for these pages, one at a time (the daily quota is small, so start with the first two):
   - `/study-abroad-2027` (the pillar)
   - `/study-abroad-intakes-2027`
   - `/best-countries-to-study-abroad-2027`
   - `/study-abroad-scholarships-2027`
   - `/study-abroad-checklist-2027`
   - `/study-abroad-tests-2027`
   - `/mbbs-abroad-2027`
   - `/blog` and `/` (their titles and links changed)
4. **Settings → Crawl stats** and **Pages**: confirm `/gm-api/`, `/admin`, `/dashboard` and the consultant pages stay excluded (they are `Disallow`ed in `robots.txt`).

## 2. The reports to watch, and what a good result looks like

| Report | Where | Healthy | What to do if it is not |
|---|---|---|---|
| Core Web Vitals (Mobile) | Experience → Core Web Vitals | LCP under 2.5 s, INP under 200 ms, CLS under 0.1 for 75% of visits | Open the failing group, then run PageSpeed Insights on one URL from it. Field data needs about 28 days of traffic to update. |
| Page indexing | Indexing → Pages | The 2027 guides show as "Indexed" within 1 to 2 weeks | "Discovered, currently not indexed" means Google has not prioritised them yet: add internal links from the pages that get traffic, and request indexing again after a week. |
| Performance | Performance → Search results | Queries containing "2027" appear and grow from December | Filter queries by "2027" and compare impressions with clicks. Rewrite the title and description of any page with impressions but a low click-through rate. |
| Mobile usability | (retired by Google in late 2023) | Not a report any more | Use the Core Web Vitals report and PageSpeed Insights instead. |
| Links | Links → Internal links | The pillar `/study-abroad-2027` is one of the top internally linked pages | Add links from any page that talks about intakes or scholarships. |

## 3. Queries to track (add to a spreadsheet, check monthly)

Primary: study abroad 2027, 2027 intake, september 2027 intake, fall 2027 intake, january 2027 intake, best countries to study abroad 2027, scholarships for 2027 intake, mbbs abroad 2027, ielts 2027.

Long tail (from the article headings): study abroad checklist 2027, documents required for study abroad, is it too late to apply for 2027 intake, study abroad timeline 2027, NEET 2027 MBBS abroad.

Track four numbers per query: impressions, clicks, click-through rate and average position. A page that ranks on page 2 (position 11 to 20) is the best candidate to improve first.

## 4. Mobile score: what was changed in the repository, and what to measure

Measured on the homepage with a local Lighthouse mobile run on 10 November 2026 (simulated mid-range phone on a slow connection, so absolute numbers are lower than on a real network):

| Metric | Before | Notes |
|---|---|---|
| Performance | 71 | |
| Largest Contentful Paint | 4.4 s | The element was the cookie banner text, not the headline |
| Total Blocking Time | 450 ms | About 650 ms came from the third-party mascot module |
| Accessibility | 91 | |
| SEO | 92 | |

Changes made:

- **Cookie banner copy is shorter on phones** (one sentence is hidden there; the same facts are in the Analytics line under "Customise"). On a first visit the banner was the largest block of text on screen and arrived late, so it was counted as the page's LCP.
- **The mascot (Strobi) loads late on phones**: after the first touch or scroll. The inline SVG shows meanwhile. This removes about 650 ms of script and a third-party connection from startup.
- **Right-sized images**: the nav logo went from 112 KB to 18 KB, the footer logo from 47 KB to 11 KB, the Finland tile from 194 KB to 74 KB, and the destination photos from 1200 px to 800 px (560 px on phones).
- **Touch polish only runs when the browser is idle** and reads layout through `IntersectionObserver`, so it causes no forced reflow.
- **Accessibility fixes**: valid list roles on the "why us" cards, accessible names that match the visible text on the destination tiles, 24 px touch targets for the slider dots, and a descriptive name for the Menu tab.
- **`viewport-fit=cover`, `theme-color`, a web app manifest** and Apple home-screen tags, so the site can be added to a phone's home screen and looks like an app when opened.

Still worth doing later (not done here, each needs a decision or a tool):

1. **Convert photos to WebP or AVIF.** Needs an image tool in your build; Vercel can also do this with its Image Optimization product.
2. **Self-host or drop `d3` and `topojson`** (about 90 KB) used only by the homepage globe, or load the globe only after the first scroll on phones.
3. **Replace the `images.unsplash.com` hotlinks** with local copies so the page does not depend on a third-party image host (the cookie policy already lists it).
4. **Minify `site.css` and `site.js`** (about 13 KB saved). Needs a build step, which `agent.md` says not to add without your approval.

## 5. How to re-measure after deploying

1. Open [PageSpeed Insights](https://pagespeed.web.dev/), enter `https://www.gradmire.com/`, and read the **Mobile** tab.
2. Check the field-data box at the top ("Discover what your real users are experiencing"). It is empty for new pages until Chrome has enough visits.
3. Repeat for `/study-abroad-2027` and `/study-in-uk`.
4. Compare against the table above. Expect the largest gain in LCP and Total Blocking Time.

## 6. Content upkeep

The 2027 guides are reviewed as of 10 November 2026 and every date in them points to an official source. Re-review them before **10 May 2027** (six months, `docs/rules.md` §3.3), and sooner when:

- UCAS, the UK, US, Canadian, Australian or German student visa rules change,
- the national study permit limits for Canada for 2027 are announced,
- NEET UG 2027 dates are published.

Run `node scripts/build-blog-pages.mjs` after editing `scripts/blog-data.mjs`, then the sync steps listed at the top of `scripts/build-blog-pages.mjs`.
