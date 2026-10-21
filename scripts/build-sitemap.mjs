// Writes frontend/sitemap.xml from the pages themselves: every page under
// frontend/pages except noindex pages and a few utility pages, at its canonical
// URL (or https://www.gradmire.com/<page> without .html, which Vercel serves from /pages), with
// the date of its last commit as <lastmod>. Run: node scripts/build-sitemap.mjs
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const SITE = 'https://www.gradmire.com';
const root = new URL('../frontend/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const pagesDir = join(root, 'pages');
// Public but not useful in search results.
const SKIP = new Set(['404.html', 'login.html', 'signup.html']);

const walk = (dir) => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : name.endsWith('.html') ? [path] : [];
});

const lastCommitDate = (file) => {
    try {
        return execFileSync('git', ['log', '-1', '--format=%cs', '--', file], { encoding: 'utf8' }).trim() || null;
    } catch {
        return null;
    }
};

const entries = [];
for (const file of walk(pagesDir)) {
    const page = relative(pagesDir, file).replace(/\\/g, '/');
    if (SKIP.has(page)) continue;
    const html = readFileSync(file, 'utf8');
    if (/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html)) continue;
    const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1];
    const loc = canonical || (page === 'index.html' ? `${SITE}/` : `${SITE}/${page.replace(/\.html$/, '')}`);
    entries.push({ loc, lastmod: lastCommitDate(file) });
}
entries.sort((a, b) => (a.loc === `${SITE}/` ? -1 : b.loc === `${SITE}/` ? 1 : a.loc.localeCompare(b.loc)));

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(({ loc, lastmod }) => `  <url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
writeFileSync(join(root, 'sitemap.xml'), xml);
console.log(`sitemap.xml: ${entries.length} pages`);
