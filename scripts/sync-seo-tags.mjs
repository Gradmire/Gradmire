/* Writes the shared SEO head tags into every public page under frontend/pages/:
     - <link rel="canonical"> at https://www.gradmire.com/<page> (no .html),
     - Open Graph and Twitter card tags built from the page's own <title> and description,
     - a BreadcrumbList (Home > section page > page) for every page except the home page,
     - noindex for login and sign-up, which have nothing to show in search results.
   Pages that are already noindex (workspaces, invitations) are left alone.
   Safe to re-run: everything it writes sits between <!-- seo --> and <!-- /seo -->.
   Run from the repository root after adding or retitling a page:  node scripts/sync-seo-tags.mjs
   Then run  node scripts/build-sitemap.mjs  so the sitemap matches. */
import fs from 'node:fs';
import path from 'node:path';

const SITE = 'https://www.gradmire.com';
const IMAGE = `${SITE}/assets/og-cover.jpg`;
const IMAGE_ALT = 'Gradmire: study abroad, without the guesswork.';
const pagesRoot = path.resolve('frontend/pages');
const NOINDEX = new Set(['login', 'signup']);
const SKIP = new Set(['404']);
/* Section pages that group other pages: their children get a breadcrumb step for them. */
const PARENTS = [
    [/^study-in-/, 'destinations'],
    [/^mbbs-in-/, 'mbbs-abroad'],
    [/^scholarships-in-/, 'scholarships'],
    [/^test-prep-/, 'test-preparation'],
    [/-2027$/, 'blog']
];
/* The 2027 guides from build-blog-pages.mjs are articles; every other page is a plain website page. */
const isArticle = (slug) => /-2027$/.test(slug);

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const attr = (value) => value.replace(/"/g, '&quot;');
const urlOf = (slug) => (slug === 'index' ? `${SITE}/` : `${SITE}/${slug}`);
const read = (slug) => fs.readFileSync(path.join(pagesRoot, `${slug}.html`), 'utf8');
const titleOf = (html) => (html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim();
const descOf = (html) => html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] || '';
const isNoindex = (html) => /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html);

const decode = (text) => text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, '’').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/* "Study in Canada: Costs, Visa &amp; Universities | Gradmire" -> "Study in Canada". */
function shortName(title) {
    const parts = decode(title).split(/\s*(?:\||—|:)\s*/).map((p) => p.trim()).filter(Boolean);
    return (parts[0] && parts[0].toLowerCase() !== 'gradmire' ? parts[0] : parts[1]) || decode(title);
}

function breadcrumbs(slug, html) {
    const trail = [{ name: 'Home', url: `${SITE}/` }];
    const parent = PARENTS.find(([pattern]) => pattern.test(slug.replace(/^tools\//, '')))?.[1];
    if (parent && parent !== slug && fs.existsSync(path.join(pagesRoot, `${parent}.html`))) {
        trail.push({ name: shortName(titleOf(read(parent))), url: urlOf(parent) });
    }
    trail.push({ name: shortName(titleOf(html)), url: urlOf(slug) });
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: trail.map((step, i) => ({ '@type': 'ListItem', position: i + 1, name: step.name, item: step.url }))
    };
}

function seoBlock(slug, html) {
    const title = attr(titleOf(html));
    const description = descOf(html);
    const url = urlOf(slug);
    const lines = [
        '<!-- seo -->',
        `<link rel="canonical" href="${url}">`,
        `<meta property="og:type" content="${isArticle(slug) ? 'article' : 'website'}">`,
        '<meta property="og:site_name" content="Gradmire">',
        '<meta property="og:locale" content="en_IN">',
        `<meta property="og:url" content="${url}">`,
        `<meta property="og:title" content="${title}">`,
        `<meta property="og:description" content="${description}">`,
        `<meta property="og:image" content="${IMAGE}">`,
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        `<meta property="og:image:alt" content="${IMAGE_ALT}">`,
        '<meta name="twitter:card" content="summary_large_image">',
        `<meta name="twitter:title" content="${title}">`,
        `<meta name="twitter:description" content="${description}">`,
        `<meta name="twitter:image" content="${IMAGE}">`
    ];
    if (slug !== 'index') {
        lines.push(`<script type="application/ld+json">${JSON.stringify(breadcrumbs(slug, html)).replace(/</g, '\\u003c')}</script>`);
    }
    lines.push('<!-- /seo -->');
    return lines.join('\n');
}

/* Each pattern takes its own line break with it, so a re-run puts everything back exactly where it was. */
const STRIP = [
    /<!-- seo -->[\s\S]*?<!-- \/seo -->\r?\n?/g,
    /<link\s+rel="canonical"[^>]*>[ \t]*\r?\n?/gi,
    /<meta\s+(?:property="og:[^"]*"|name="twitter:[^"]*")[^>]*>[ \t]*\r?\n?/gi
];

let changed = 0;
for (const file of walk(pagesRoot).filter((f) => f.endsWith('.html'))) {
    const slug = path.relative(pagesRoot, file).replace(/\\/g, '/').replace(/\.html$/, '');
    if (SKIP.has(slug)) continue;
    const html = fs.readFileSync(file, 'utf8');
    const noindexed = NOINDEX.has(slug) && !isNoindex(html);
    if (isNoindex(html) || NOINDEX.has(slug) && !noindexed) continue;

    let next = STRIP.reduce((out, pattern) => out.replace(pattern, ''), html);
    const block = noindexed
        ? '<!-- seo -->\n<meta name="robots" content="noindex, follow">\n<!-- /seo -->'
        : seoBlock(slug, next);
    const charset = next.match(/<meta\s+charset="[^"]*"\s*>/i);
    if (!charset) { console.warn(`No <meta charset> in ${slug}; skipped.`); continue; }
    next = next.replace(charset[0], `${charset[0]}\n${block}`);
    if (next !== html) { fs.writeFileSync(file, next); changed += 1; }
}
console.log(`SEO tags synced: ${changed} page(s) updated.`);
