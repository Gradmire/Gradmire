/* Writes the one site footer (scripts/footer.mjs) into every page under frontend/pages/.
   Run from the repository root after changing the footer:  node scripts/sync-footer.mjs
   A page's existing <footer>…</footer> is replaced; the dashboard, which has none,
   gets it at the end of its scrolling main panel. */
import fs from 'node:fs';
import path from 'node:path';
import { footerHtml } from './footer.mjs';

const pagesRoot = path.resolve('frontend/pages');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

let changed = 0;
for (const file of walk(pagesRoot).filter((f) => f.endsWith('.html'))) {
    const rel = path.relative(pagesRoot, path.dirname(file));
    const prefix = rel ? '../'.repeat(rel.split(path.sep).length) : '';
    const footer = footerHtml(prefix);
    const html = fs.readFileSync(file, 'utf8');
    let next;
    if (/<footer[\s>]/.test(html)) {
        next = html.replace(/<footer[\s>][\s\S]*?<\/footer>/, footer);
    } else if (html.includes('</main>')) {
        next = html.replace(/(\s*)<\/main>/, `\n${footer}$1</main>`);
    } else {
        console.warn(`No place for the footer in ${path.relative(pagesRoot, file)}`);
        continue;
    }
    if (next !== html) { fs.writeFileSync(file, next); changed += 1; }
}
console.log(`Footer synced: ${changed} page(s) updated.`);
