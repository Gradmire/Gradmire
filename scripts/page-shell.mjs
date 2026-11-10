/* Shared pieces for the generated guide pages (MBBS Abroad, Student Services).
   The nav is copied from an existing destination page and the footer comes from
   footer.mjs, so every page keeps the same header and footer. */
import fs from 'node:fs';
import path from 'node:path';
import { footerHtml } from './footer.mjs';
import { PHOTOS, COUNTRY_PHOTOS } from './photo-data.mjs';

export const pagesDir = path.resolve('frontend/pages');
const template = fs.readFileSync(path.join(pagesDir, 'study-in-finland.html'), 'utf8');
const navHtml = template.match(/<nav class="nav[\s\S]*?<\/nav>/)[0];
const siteCss = template.match(/site\.css\?v=\d+/)[0];
const siteJs = fs.readFileSync(path.join(pagesDir, 'index.html'), 'utf8').match(/site\.js\?v=\d+/)[0];
const GUIDE_CSS = 'guide-pages.css?v=7';

export const esc = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/* Text that may carry a link we wrote ourselves is passed through; everything else is escaped. */
export const rich = (value) => (/<a\s/.test(value) ? value : esc(value));
export const consultHref = (interest, country = '') => `free-consultation?interest=${interest}${country ? `&amp;country=${country}` : ''}#book`;

const themeBoot = '<script>try{var c=JSON.parse(localStorage.getItem("gm-consent")||"null"),t=(c&&c.preferences&&localStorage.getItem("gradmire-theme"))||sessionStorage.getItem("gradmire-theme");if(t)document.documentElement.dataset.theme=t;}catch(e){}</script>';

/* `head` is extra markup for <head> (for example JSON-LD) and `css` lists extra stylesheets under assets/. */
export function shell({ title, description, body, bodyClass = '', head = '', css = [] }) {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
${themeBoot}
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" href="/assets/favicon-light.ico" sizes="any">
<link rel="icon" href="/assets/favicon-light.ico" media="(prefers-color-scheme: light)">
<link rel="icon" href="/assets/favicon-dark.ico" media="(prefers-color-scheme: dark)">
<link rel="stylesheet" href="../assets/${siteCss}">
<link rel="stylesheet" href="../assets/${GUIDE_CSS}">${css.map((href) => `\n<link rel="stylesheet" href="../assets/${href}">`).join('')}${head ? `\n${head}` : ''}
</head>
<body class="destination-page guide-page${bodyClass ? ` ${bodyClass}` : ''}">
${navHtml}
${body}
${footerHtml()}
<script src="../assets/${siteJs}" defer></script>
</body>
</html>
`;
}

/* Inline lead form: site.js validates it, stores a prefill and opens the booking page. */
export function leadForm({ id, interest, country = '', exam = '', scholarship = '', eyebrow, title, button = 'Book my free counselling', extra = '' }) {
    const context = `${exam ? ` data-exam="${esc(exam)}"` : ''}${scholarship ? ` data-scholarship="${esc(scholarship)}"` : ''}`;
    return `<form class="gp-lead" data-consult-form data-interest="${interest}" data-country="${country}"${context} novalidate aria-labelledby="lead-title-${id}">
  <p class="gp-lead-eyebrow">${esc(eyebrow)}</p>
  <h2 class="gp-lead-title" id="lead-title-${id}">${esc(title)}</h2>
  <label class="gp-field"><span>Full name</span><input name="name" type="text" autocomplete="name" required></label>
  <label class="gp-field"><span>Phone number</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" required></label>
  <label class="gp-field"><span>Email <em>(optional)</em></span><input name="email" type="email" autocomplete="email"></label>${extra}
  <p class="gp-lead-error" role="alert" hidden></p>
  <button type="submit" class="gp-btn gp-btn-primary">${esc(button)} <span aria-hidden="true">→</span></button>
  <p class="gp-lead-fine">You’ll confirm your details and consent on the next step. Under 18? Please ask a parent or guardian first. <a href="privacy">Privacy policy</a></p>
</form>`;
}

/* A photo from the WebP sets in assets/photos, with a small and a large size so phones download the small one.
   `variant`: "band" is a wide strip under the hero; "side" is a smaller picture inside a section. */
export function photo(key, variant = 'band') {
    const p = PHOTOS[key];
    if (!p) throw new Error(`No photo called ${key} in scripts/photo-data.mjs`);
    const base = `../assets/photos/${key}`;
    return `<figure class="gp-photo gp-photo--${variant}">
  <img src="${base}-960.webp" srcset="${base}-640.webp 640w, ${base}-960.webp 960w" sizes="${variant === 'band' ? '(max-width: 1200px) 100vw, 1160px' : '(max-width: 800px) 100vw, 760px'}" width="${p.w}" height="${p.h}" alt="${esc(p.alt)}" style="object-position:${p.pos}" loading="lazy" decoding="async">
  <figcaption>${esc(p.caption)} <a href="photo-credits">Photo credit</a></figcaption>
</figure>`;
}

/* A university photo that is already on a country guide (credited on the Photo credits page). */
export function countryPhoto(slug, variant = 'band') {
    const p = COUNTRY_PHOTOS[slug];
    if (!p) return '';
    return `<figure class="gp-photo gp-photo--${variant}">
  <img src="../assets/${p.file}" width="${p.w}" height="${p.h}" alt="${esc(`A building at the ${p.name}`)}" loading="lazy" decoding="async">
  <figcaption>${esc(p.name)} <a href="photo-credits">Photo credit</a></figcaption>
</figure>`;
}

export function hero({ crumbs, eyebrow, title, intro, actions, form }) {
    const trail = crumbs.map(([label, href], i) => (i === crumbs.length - 1
        ? `<span aria-current="page">${esc(label)}</span>`
        : `<a href="${href}">${esc(label)}</a>`)).join(' <span aria-hidden="true">/</span> ');
    return `<header class="gp-hero">
  <div class="gp-hero-inner">
    <div class="gp-hero-copy">
      <nav class="gp-crumbs" aria-label="Breadcrumb">${trail}</nav>
      <span class="gp-eyebrow">${esc(eyebrow)}</span>
      <h1>${esc(title)}</h1>
      <p>${esc(intro)}</p>
      <div class="gp-hero-actions">${actions}</div>
    </div>
    ${form}
  </div>
</header>`;
}

export const section = ({ id, tag, title, lead = '', body, cls = '' }) => `<section class="gp-section${cls ? ` ${cls}` : ''}" id="${id}">
  <span class="gp-tag">${esc(tag)}</span>
  <h2>${esc(title)}</h2>${lead ? `\n  <p class="gp-lead-text">${rich(lead)}</p>` : ''}
  ${body}
</section>`;

export const cards = (items, cols = 3) => `<div class="gp-grid-${cols}">
${items.map(([t, p]) => `    <article class="gp-card"><h3>${esc(t)}</h3><p>${rich(p)}</p></article>`).join('\n')}
  </div>`;

export const steps = (items) => `<ol class="gp-steps">
${items.map(([t, p]) => `    <li><h3>${esc(t)}</h3><p>${esc(p)}</p></li>`).join('\n')}
  </ol>`;

export const checklist = (items, numbered = false) => `<${numbered ? 'ol' : 'ul'} class="gp-check${numbered ? ' gp-check--numbered' : ''}">
${items.map((i) => `  <li>${i}</li>`).join('\n')}
</${numbered ? 'ol' : 'ul'}>`;

export const faq = (items) => items.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${rich(a)}</p></details>`).join('\n');

/* A strip of Gradmire's own free tools before the closing call to action: a quiet in-page promo that also links the pages together. */
const FREE_TOOLS = [
    ['Study cost calculator', 'Add tuition, living and test costs, then set the total against your expected salary.', 'tools/roi-calculator', 'Use the calculator'],
    ['Course comparator', 'Compare courses side by side before you choose.', 'tools/comparator', 'Compare courses'],
    ['Deadline tracker', 'Track application deadlines and see which are urgent.', 'tools/deadline-tracker', 'Track deadlines'],
    ['GPA / CGPA converter', 'Estimate an equivalent percentage or GPA scale as a starting point.', 'tools/grade-converter', 'Convert a grade']
];
export const toolsStrip = () => section({ id: 'free-tools', tag: 'Free tools', title: 'Plan with our free tools', body: `<div class="gp-tools">
${FREE_TOOLS.map(([t, p, href, label]) => `    <article class="gp-card"><h3>${esc(t)}</h3><p>${esc(p)}</p><a class="gp-uni-cta" href="${href}">${esc(label)} <span aria-hidden="true">→</span></a></article>`).join('\n')}
  </div>` });

export const cta = ({ title, text, href, label, country = '', exam = '' }) => `<div class="gp-cta">
  <h2>${esc(title)}</h2>
  <p>${esc(text)}</p>
  <a class="gp-btn gp-btn-primary" href="${href}" data-open-consult${country ? ` data-country="${country}"` : ''}${exam ? ` data-exam="${esc(exam)}"` : ''}>${esc(label)}</a>
</div>`;

export function write(name, html) {
    fs.writeFileSync(path.join(pagesDir, name), html);
}
