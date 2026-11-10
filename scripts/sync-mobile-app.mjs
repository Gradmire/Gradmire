/* Adds the mobile "app" layer to every public page under frontend/pages/:
     - viewport-fit=cover, so the tab bar can sit above the iPhone home indicator,
     - theme-color (light and dark), the web app manifest and the Apple home-screen tags,
     - mobile-app.css, loaded only on phones (media="(max-width: 760px)"), and mobile-app.js (defer),
     - the bottom tab bar (plain HTML with the current page marked aria-current).
   Skips noindex pages (signed-in workspaces, invitations, drafts), 404 and the sign-in pages.
   Safe to re-run: everything it writes sits between <!-- mobile-app --> / <!-- gm-tabbar --> markers.
   Run from the repository root after any generator rebuilds pages:  node scripts/sync-mobile-app.mjs */
import fs from 'node:fs';
import path from 'node:path';

const pagesRoot = path.resolve('frontend/pages');
const SKIP = new Set(['404', 'login', 'signup', 'reset-password']);
const CSS = 'mobile-app.css?v=20';
const JS = 'mobile-app.js?v=7';

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const isNoindex = (html) => /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html);

const icon = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
const TABS = [
    { id: 'home', href: '/', label: 'Home', match: (s) => s === 'index',
      svg: icon('<path d="M3.5 11.2 12 4l8.5 7.2V19a1.5 1.5 0 0 1-1.5 1.5h-4v-5.5h-6v5.5H5A1.5 1.5 0 0 1 3.5 19z"/>') },
    { id: 'explore', href: '/destinations', label: 'Explore',
      match: (s) => /^(destinations|study-in-|mbbs-|find-|scholarships|tools\/|test-prep|visa-assistance|application-assistance|course-selection)/.test(s) && !/-2027$/.test(s),
      svg: icon('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5C9.7 18.1 8.5 15.3 8.5 12S9.7 5.9 12 3.5z"/>') },
    { id: 'book', href: '/free-consultation', label: 'Book', book: true, match: (s) => /^(free-consultation|book-consultation)/.test(s),
      svg: icon('<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M8.5 3.5v4M15.5 3.5v4M4 10h16M12 13v4.2M9.9 15.1h4.2"/>') },
    { id: 'plan', href: '/study-abroad-2027', label: '2027', match: (s) => /-2027$/.test(s) || s === 'blog',
      svg: icon('<path d="M5 4.8A1.8 1.8 0 0 1 6.8 3H19v14H6.8A1.8 1.8 0 0 0 5 18.8z"/><path d="M5 18.8A1.8 1.8 0 0 0 6.8 20.5H19v-3.5M9 7.5h6M9 11h4"/>') },
    { id: 'more', href: '/about', label: 'Menu', match: (s) => /^(about|faq|contact|career|gradmire)$/.test(s),
      /* The phone header has no menu button, so this tab is the only way in. A grid icon (not three lines) that turns into a cross while the menu is open. */
      svg: icon('<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>').replace('<svg ', '<svg class="gm-ico-open" ')
         + icon('<path d="M6 6l12 12M18 6 6 18"/>').replace('<svg ', '<svg class="gm-ico-close" ') }
];

function tabbar(slug) {
    const items = TABS.map((t) => {
        const current = t.match(slug) ? ' aria-current="page"' : '';
        const extra = t.book ? ' data-open-consult' : t.id === 'more' ? ' data-gm-menu' : '';
        const label = t.book ? `<span class="gm-tab-orb">${t.svg}</span><span class="gm-tab-label">${t.label}</span>` : `${t.svg}<span class="gm-tab-label">${t.label}</span>`;
        return `<a class="gm-tab${t.book ? ' gm-tab--book' : ''}" href="${t.href}"${current}${extra}>${label}</a>`;
    });
    return `<!-- gm-tabbar -->\n<nav class="gm-tabbar" aria-label="App navigation">\n${items.join('\n')}\n</nav>\n<!-- /gm-tabbar -->`;
}

/* Pages in sub-folders (tools/) reach the assets one level higher, as their other asset links do. */
const head = (slug) => {
    const up = '../'.repeat(slug.split('/').length);
    return [
    '<!-- mobile-app -->',
    '<meta name="theme-color" content="#F0F2F7" media="(prefers-color-scheme: light)">',
    '<meta name="theme-color" content="#0A0D16" media="(prefers-color-scheme: dark)">',
    '<link rel="manifest" href="/manifest.webmanifest">',
    '<link rel="apple-touch-icon" href="/assets/favicon.png">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-title" content="Gradmire">',
    '<style>.gm-tabbar{display:none}</style>',
    /* Low-data mode: Data Saver on, a 2G connection, or the prefers-reduced-data setting. Pages and mobile-app.css then skip decorative weight. */
    '<script>try{var n=navigator.connection;if((n&&(n.saveData||/(^|-)2g$/.test(n.effectiveType)))||matchMedia("(prefers-reduced-data: reduce)").matches)document.documentElement.classList.add("gm-lite")}catch(e){}</script>',
    `<link rel="stylesheet" href="${up}assets/${CSS}" media="(max-width: 760px)">`,
    `<script src="${up}assets/${JS}" defer></script>`,
    '<!-- /mobile-app -->'
    ].join('\n');
};

const STRIP = [
    /<!-- mobile-app -->[\s\S]*?<!-- \/mobile-app -->\r?\n?/g,
    /<!-- gm-tabbar -->[\s\S]*?<!-- \/gm-tabbar -->\r?\n?/g
];

let changed = 0, skipped = 0;
for (const file of walk(pagesRoot).filter((f) => f.endsWith('.html'))) {
    const slug = path.relative(pagesRoot, file).replace(/\\/g, '/').replace(/\.html$/, '');
    const original = fs.readFileSync(file, 'utf8');
    if (SKIP.has(slug) || isNoindex(original) || /class="[^"]*\bapp-body\b/.test(original)) { skipped += 1; continue; }

    let html = STRIP.reduce((out, re) => out.replace(re, ''), original);

    /* viewport-fit=cover */
    html = html.replace(/<meta\s+name="viewport"\s+content="([^"]*)"\s*>/i, (m, content) => (/viewport-fit=/.test(content) ? m : `<meta name="viewport" content="${content}, viewport-fit=cover">`));

    /* Head block: last thing in <head>, so it follows each page's own inline CSS. Pages written without a <head> get it before the first element of the body. */
    const headEnd = html.match(/<\/head>/i) || html.match(/<nav[\s>]/i) || html.match(/<body[\s>]/i);
    if (!headEnd) { console.warn(`No place for the head block in ${slug}; skipped.`); continue; }
    html = html.replace(headEnd[0], () => `${head(slug)}\n${headEnd[0]}`);

    /* Tab bar: just before the shared script at the end of the page, else before </body>. */
    const bar = tabbar(slug);
    const tail = html.match(/<script[^>]*src="[^"]*assets\/site\.js[^"]*"[^>]*><\/script>/i) || html.match(/<\/body>/i);
    html = tail ? html.replace(tail[0], () => `${bar}\n${tail[0]}`) : `${html.trimEnd()}\n${bar}\n`;

    if (html !== original) { fs.writeFileSync(file, html); changed += 1; }
}
console.log(`Mobile app layer synced: ${changed} page(s) updated, ${skipped} skipped.`);
