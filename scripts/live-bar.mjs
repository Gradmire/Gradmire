/* The live bar: the thin scrolling ticker under the header on every public page that says what is new or open on the site
   right now. This is the one list behind it. scripts/sync-live-bar.mjs writes it into every page; the scrolling is CSS in
   assets/site.css, and assets/site.js adds the pause button. The scroll speed is worked out from this list when the pages
   are written, so nothing is measured in the browser.

   HOW TO CHANGE IT: edit `items`, then run:  node scripts/sync-live-bar.mjs

   RULES FOR THE TEXT: list only things that are live on the site today and that you can point to a page for. No counts, dates,
   prices or "limited" wording unless a source in docs/claims-source-of-truth.md backs it. Keep `text` short (one sentence):
   the whole list scrolls past in about 40 seconds, so every extra item makes each one wait longer to come round again.

   `tag` is a short label (New, Live, Open). `href` is a clean root path. A page never shows the item that links to itself. */

export const items = [
    { tag: 'New', text: '2027 study-abroad guides are live: intakes, scholarships, tests and a checklist.', cta: 'Read the guides', href: '/study-abroad-2027' },
    { tag: 'Live', text: 'Course Finder and 4 free planning tools. No sign-up needed.', cta: 'Try them', href: '/find-courses' },
    { tag: 'New', text: 'MBBS abroad 2027: NEET, eligibility and 9 country guides.', cta: 'See MBBS guides', href: '/mbbs-abroad-2027' },
    { tag: 'Open', text: 'Free consultation, online or at our Kanpur and Greater Noida offices.', cta: 'Book yours', href: '/free-consultation' }
];
