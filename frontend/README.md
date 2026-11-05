# Gradmire Frontend

The existing static HTML prototype is grouped under `pages/`, with shared image assets under `assets/`.

Open `pages/index.html` directly for a static preview, or serve the repository with a local static server when testing page-to-page links.

## Shared page parts

Several parts of every page are written by scripts in `../scripts/`, so change them there and re-run the script from the repository root instead of editing each page:

- `node scripts/sync-footer.mjs` writes the site footer (`scripts/footer.mjs`) into every page.
- `node scripts/sync-seo-tags.mjs` writes each public page's canonical link, Open Graph and Twitter tags (from its own title and description) and breadcrumb data, and marks login and sign-up `noindex`. Run it after adding or retitling a page, and after any `build-*.mjs` script, which rewrites its pages without these tags.
- `node scripts/build-sitemap.mjs` rewrites `sitemap.xml` from the pages. Run it after the SEO sync, and again after committing so each page's `lastmod` is right.
- `node scripts/build-career-page.mjs` rebuilds `pages/career.html`.
- `node scripts/build-credits-page.mjs` rebuilds `pages/photo-credits.html` from `docs/destination-image-attributions.md` and `docs/germany-image-attributions.md`. Add a row to the matching attribution document whenever you add a photo from Wikimedia Commons, then re-run it.
- `node scripts/check-frontend-links.mjs` checks that every local link resolves.

The link-preview image is `assets/og-cover.jpg` (1200 x 630). University and city photos on the country guides are local copies in `assets/<country>/`; their creators and licences are in the attribution documents above.
