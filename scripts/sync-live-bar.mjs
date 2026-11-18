/* Writes the live bar (the scrolling "new and live now" ticker) just under the main header of every public page in frontend/pages/.
   The text comes from scripts/live-bar.mjs; the look and the scrolling are `.gm-live` in assets/site.css; pausing, closing and
   the scroll speed are `setupLiveBar` in assets/site.js. The bar is plain HTML and moves with CSS alone, so it runs without
   JavaScript and cannot shift the layout (it is always one row, 44px high).
   A page never shows the item that links to itself. Pages with no main header, noindex pages (signed-in workspaces,
   admin, drafts), 404 and the sign-in pages are skipped, the same as the phone app layer.
   Safe to re-run: everything it writes sits between <!-- live-bar --> markers (line endings of each page are kept).
   Run from the repository root after any generator rebuilds pages:  node scripts/sync-live-bar.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { edition, items } from './live-bar.mjs';

const pagesRoot = path.resolve('frontend/pages');
const SKIP = new Set(['404', 'login', 'signup', 'reset-password']);
const STRIP = /<!-- live-bar -->[\s\S]*?<!-- \/live-bar -->\r?\n?/g;
/* The main header is the first <nav> labelled "Main navigation"; it holds no other <nav>, so its first </nav> closes it. */
const MAIN_NAV = /<nav\b[^>]*aria-label="Main navigation"[^>]*>[\s\S]*?<\/nav>/i;

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const isNoindex = (html) => /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const arrow = '<span class="gm-live-arrow" aria-hidden="true">&rarr;</span>';
/* Both icons are drawn for either state; CSS shows the pause bars while it runs and the play triangle while it is paused. */
const pauseIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="gm-ico-pause" d="M9 6v12M15 6v12"/><path class="gm-ico-play" d="M8.5 6.5v11l9-5.5z"/></svg>';
const closeIcon ='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg>';

/* Closed state: the same rule site.js uses (readPref), run here so a visitor who closed the bar never sees it flash on the next page.
   Preferences consent means the choice lives in localStorage; without it, in this tab only. */
const GUARD = '<script>try{var b=document.getElementById("gm-live"),k="gm-live-closed",c=JSON.parse(localStorage.getItem("gm-consent")||"null"),v=(c&&c.v===1&&c.preferences&&localStorage.getItem(k))||sessionStorage.getItem(k);if(b&&v===b.dataset.edition)b.hidden=true}catch(e){}</script>';

/* The ticker runs on CSS alone: the track holds the list twice and slides left by exactly one list's width, so the loop has no
   seam. The second copy is hidden from screen readers and keyboards (aria-hidden + inert); the first copy is the real one. */
function bar(slug) {
    const own = slug === 'index' ? '/' : `/${slug}`;
    const shown = items.filter((item) => item.href !== own);
    if (!shown.length) return '';
    const rows = shown.map((item) => [
        `<li class="gm-live-item"><a href="${esc(item.href)}">`,
        `<span class="gm-live-tag">${esc(item.tag)}</span>`,
        `<span class="gm-live-text">${esc(item.text)}</span>`,
        `<span class="gm-live-cta">${esc(item.cta)}${arrow}</span>`,
        '</a></li>'
    ].join(''));
    const group = (extra) => [
        `        <ul class="gm-live-group" role="list"${extra}>`,
        ...rows.map((row) => `          ${row}`),
        '        </ul>'
    ];
    return [
        '<!-- live-bar -->',
        `<div class="gm-live" id="gm-live" role="region" aria-label="New and live on Gradmire" data-gm-live data-edition="${esc(edition)}">`,
        '  <div class="gm-live-inner">',
        '    <span class="gm-live-badge"><i class="gm-live-dot" aria-hidden="true"></i>Live now</span>',
        '    <div class="gm-live-view">',
        '      <div class="gm-live-track">',
        ...group(''),
        ...group(' aria-hidden="true" inert'),
        '      </div>',
        '    </div>',
        `    <button type="button" class="gm-live-pause" aria-label="Pause moving notices" aria-pressed="false">${pauseIcon}</button>`,
        `    <button type="button" class="gm-live-close" aria-label="Hide this notice">${closeIcon}</button>`,
        '  </div>',
        '</div>',
        GUARD,
        '<!-- /live-bar -->'
    ].join('\n');
}

let changed = 0, skipped = 0, noNav = [];
for (const file of walk(pagesRoot).filter((f) => f.endsWith('.html'))) {
    const slug = path.relative(pagesRoot, file).replace(/\\/g, '/').replace(/\.html$/, '');
    const original = fs.readFileSync(file, 'utf8');
    if (SKIP.has(slug) || isNoindex(original) || /class="[^"]*\bapp-body\b/.test(original)) { skipped += 1; continue; }

    const eol = original.includes('\r\n') ? '\r\n' : '\n';
    let html = original.replace(STRIP, '');
    const nav = html.match(MAIN_NAV);
    if (!nav) { noNav.push(slug); skipped += 1; continue; }

    const block = bar(slug).replace(/\n/g, eol);
    if (block) html = html.replace(nav[0], () => `${nav[0]}${eol}${block}`);

    if (html !== original) { fs.writeFileSync(file, html); changed += 1; }
}
console.log(`Live bar synced: ${changed} page(s) updated, ${skipped} skipped.`);
if (noNav.length) console.log(`No main header found (left alone): ${noNav.join(', ')}`);
