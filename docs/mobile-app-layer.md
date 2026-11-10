# Mobile app layer

Phones (screens 760 px wide or narrower) get an app-style layer on every public page. Wider screens never download or apply it.

## What it is

| Piece | File | Notes |
|---|---|---|
| Bottom tab bar (Home, Explore, Book, 2027, Menu) | HTML written by `scripts/sync-mobile-app.mjs` | Plain links, current page marked `aria-current`. **Book** opens the existing consultation sheet (`data-open-consult`); **Menu** opens the site menu. Hidden by default, shown by the mobile stylesheet. |
| Styles | `frontend/assets/mobile-app.css` | Linked with `media="(max-width: 760px)"`. Tab bar, press feedback, quick-action tiles, compact cookie sheet, page transitions. |
| Touch polish | `frontend/assets/mobile-app.js` | Optional. Runs when the browser is idle. Without it the layer still works. |
| Homepage quick actions and 2027 band | `frontend/pages/index.html` | `.gm-quick` is hidden on desktop by an inline rule and shown by `mobile-app.css`. |
| Install as an app | `frontend/manifest.webmanifest` + head tags | `display: standalone`, shortcuts to Book, 2027 plan and Courses. |

Skipped pages: sign-in and sign-up, 404, anything `noindex` (signed-in workspaces, invitations).

## Compact phone layout (added after the first release)

- **Footer:** on phones it shows the logo, one line of pitch, the sign-up field, one row of company links and a short legal line. The full link directory moved into the phone menu (`mobileInfo` in `site.js`): company and legal links, registered office, e-mail and social icons. Legal links marked in `scripts/footer.mjs` (third value `true`) are hidden in the phone footer only.
- **Social icons:** `socialLinks` in `frontend/assets/site.js` is empty on purpose, because the repository has no real profile addresses. Fill in the URL for each account Gradmire actually runs and the icon appears; networks left empty show nothing. The e-mail icon is always shown.
- **Header:** logo left, theme toggle right. There is **no three-line menu button on phones** (hidden with `.nav-ham { display: none }` in `mobile-app.css`); the **Menu** tab in the bottom bar opens and closes the same menu, turns into a cross while it is open, and the bar stays visible so it can be closed. Tablets between 761 and 1180 px still show the three-line button.
- **Home hero:** the three trust points are an equal three-tile row; the globe and its destination picker are smaller, and the picker is one swipeable row.
- **Country guides:** the long card grids (courses, universities, cities, intakes and so on) become swipeable rows on phones. The UK guide went from about 19,800 px to about 11,200 px tall. Any new grid class on those pages needs adding to the `:is(...)` list in `mobile-app.css`.
- **Destinations filter:** each card carries `data-region` (`popular`, `europe`, `asia-pacific`, `americas`, space separated). "Most popular" is an editorial group (UK, USA, Canada, Australia, Germany): change it by editing those attributes.
- **Low-data mode:** a tiny script in the head adds `gm-lite` to `<html>` when Data Saver is on, the connection is 2G, or `prefers-reduced-data` is set. The home page then skips the globe libraries (about 190 KB), the mascot module is not loaded, decorative photos become plain colour and animations stop.

## React Bits patterns, ported without React

The site is static HTML and `agent.md` says not to add a framework or build step unless asked, so the [React Bits](https://reactbits.dev) ideas are re-implemented in CSS and a few lines of JavaScript. No dependency, no hydration cost.

| React Bits component | Where it is used here |
|---|---|
| Dock | Tab bar: the pressed tab grows and its neighbours lean in |
| Shiny Text | The Book orb sweep and the "2027 plan" tile label |
| Spotlight Card | A glow follows the finger on `.gp-card`, `.bl-card`, `.gp-tile`, `.uni-card` |
| Animated List | Cards below the first screen rise in one after another |

Everything respects `prefers-reduced-motion`. Nothing on the first screen is animated or delayed, so it cannot hurt Largest Contentful Paint or layout shift.

## Maintaining it

- It is **generated into pages**, like the footer. After running any `build-*.mjs` generator, run:

  ```bash
  node scripts/sync-footer.mjs && node scripts/sync-seo-tags.mjs && node scripts/sync-mobile-app.mjs && node scripts/build-sitemap.mjs && node scripts/check-frontend-links.mjs
  ```

- Change the tabs in `TABS` inside `sync-mobile-app.mjs`. Change the look in `mobile-app.css`. Bump `CSS` and `JS` version numbers in that script when you edit the files, so browsers do not keep the old copy.
- Do **not** rebuild `scholarships-in-*`, `mbbs-in-*`, `test-prep-*` and hub pages from their generators without checking titles first: their on-disk titles and descriptions were edited by hand (including the 2027 wording) and the generators still hold older ones.
- Pages that add their own bottom-fixed controls should offset them by `var(--gm-tab-h)` plus `env(safe-area-inset-bottom)`.
