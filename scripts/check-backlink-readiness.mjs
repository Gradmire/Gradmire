/* Checks that the things listed under "Fix first" in docs/backlink-outreach-plan.md are true on the site, and says what
   still needs the owner. Run from the repository root:  node scripts/check-backlink-readiness.mjs
   "ok" = fine. "FAIL" = a mistake in the repository (exit code 1). "todo" = needs a decision or an account: not a failure. */
import fs from 'node:fs';
import path from 'node:path';
import { profiles } from './social.mjs';

const KANPUR = 'Near Halim College, Prem Nagar';
const NOIDA = 'N2 Tower, Supertech Ecovillage 1';
const EMAIL = 'info@gradmire.com';
const FOOTER_LINE = `Offices: Kanpur (${KANPUR}) and Greater Noida (${NOIDA})`;
/* Addresses that must not reappear: the old New Delhi office and the invented branches. */
const FORBIDDEN = ['Barakhamba', 'World Trade Tower', 'Andheri', 'Banjara Hills', 'Koramangala', 'Kothrud', 'Anna Nagar', 'Kalpataru', 'Connaught Place'];
const PLACEHOLDER_PHONE = '4567 8900';

const frontend = path.resolve('frontend');
const pagesRoot = path.join(frontend, 'pages');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const pages = walk(pagesRoot).filter((f) => f.endsWith('.html'));
const read = (f) => fs.readFileSync(f, 'utf8');
const rel = (f) => path.relative(frontend, f).replace(/\\/g, '/');

const results = [];
const add = (status, label, detail = '') => results.push({ status, label, detail });
const check = (ok, label, detail = '') => add(ok ? 'ok' : 'FAIL', label, ok ? '' : detail);

/* 1. The same two offices in every footer */
const noFooterLine = pages.filter((f) => !read(f).includes(FOOTER_LINE)).map(rel);
check(!noFooterLine.length, `Both offices appear in the footer of all ${pages.length} pages`, `missing on: ${noFooterLine.slice(0, 5).join(', ')}${noFooterLine.length > 5 ? ' …' : ''}`);

/* 2. No old or invented address anywhere public */
const publicFiles = [...pages, path.join(frontend, 'llms.txt'), path.join(frontend, 'assets/site.js'), path.resolve('scripts/footer.mjs')];
const stale = [];
for (const f of publicFiles) { const t = read(f); const hit = FORBIDDEN.find((w) => t.includes(w)); if (hit) stale.push(`${rel(f) || f} (${hit})`); }
check(!stale.length, 'No old New Delhi address or invented branch is left', stale.slice(0, 5).join(', '));

/* 3. Contact, About, llms.txt */
const contact = read(path.join(pagesRoot, 'contact.html'));
const officeCities = [...contact.matchAll(/class="office-city">([^<]+)</g)].map((m) => m[1].trim());
check(officeCities.length === 2 && officeCities.includes('Kanpur') && officeCities.includes('Greater Noida'), 'Contact page lists exactly the two offices', `found: ${officeCities.join(', ') || 'none'}`);
check(contact.includes(KANPUR) && contact.includes(NOIDA), 'Contact page has both street addresses');
const about = read(path.join(pagesRoot, 'about.html'));
check(about.includes(KANPUR) && about.includes(NOIDA), 'About page has both street addresses');
const llms = read(path.join(frontend, 'llms.txt'));
check(llms.includes(KANPUR) && llms.includes(NOIDA), 'llms.txt has both offices');

/* 4. Homepage structured data */
const index = read(path.join(pagesRoot, 'index.html'));
let org = null;
try {
    for (const m of index.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
        const data = JSON.parse(m[1]);
        const node = (data['@graph'] || [data]).find((n) => [].concat(n['@type']).includes('Organization'));
        if (node) org = node;
    }
} catch (error) { check(false, 'Homepage JSON-LD parses', error.message); }
if (org) {
    const streets = [].concat(org.address || []).map((a) => a.streetAddress);
    check(streets.includes(KANPUR) && streets.includes(NOIDA) && streets.length === 2, 'Homepage structured data lists the two offices', `found: ${streets.join(' | ')}`);
    const wanted = profiles.map((p) => p.url).filter((u) => /^https?:\/\//.test(u) && !/^https?:\/\/wa\.me\//.test(u));
    const have = [].concat(org.sameAs || []);
    check(JSON.stringify(wanted) === JSON.stringify(have), `sameAs matches the social profiles (${have.length})`, 'run: node scripts/sync-footer.mjs');
    check(Boolean(org.founder), 'Organization names its founder');
}

/* 5. Verification tags follow the config */
let verification = {};
try { verification = JSON.parse(read(path.resolve('scripts/site-verification.json'))); } catch (_) { verification = {}; }
for (const [key, tag, name] of [['google', 'google-site-verification', 'Search Console'], ['bing', 'msvalidate.01', 'Bing Webmaster Tools']]) {
    const present = index.includes(`name="${tag}"`);
    if (verification[key]) check(present, `${name} verification tag is on the homepage`, 'run: node scripts/sync-footer.mjs');
    else add('todo', `${name}: paste the verification token into scripts/site-verification.json`, 'then run node scripts/sync-footer.mjs');
}

/* 6. Press kit, tools, photos */
check(fs.existsSync(path.join(pagesRoot, 'press.html')), 'Press kit page exists');
const sitemap = read(path.join(frontend, 'sitemap.xml'));
check(sitemap.includes('https://www.gradmire.com/press'), 'Press kit is in the sitemap', 'run: node scripts/build-sitemap.mjs');
/* Pages in the tools/ folder reach it as ../press, everything else as press. */
const noPressLink = pages.filter((f) => !/href="(\.\.\/)?press"/.test(read(f))).map(rel);
check(!noPressLink.length, 'Every footer links to the press kit', `missing on ${noPressLink.length} pages`);
const tools = pages.filter((f) => rel(f).startsWith('pages/tools/'));
const noCanon = tools.filter((f) => !/rel="canonical"/.test(read(f))).map(rel);
check(tools.length >= 4 && !noCanon.length, `All ${tools.length} tool pages have a canonical address`, noCanon.join(', '));
check(read(path.join(frontend, 'assets/site.js')).includes('setupToolShare'), 'Tool pages carry the "Link to this tool" box');
const attributions = read(path.resolve('docs/mbbs-service-image-attributions.md'));
const photoKeys = [...new Set(fs.readdirSync(path.join(frontend, 'assets/photos')).map((n) => n.replace(/-(960|640)\.webp$/, '')))];
const uncredited = photoKeys.filter((k) => !attributions.includes(`${k}-960.webp`));
check(!uncredited.length, `All ${photoKeys.length} new photos are credited`, `not credited: ${uncredited.join(', ')}`);

/* 7. What still needs the owner */
const emails = new Set();
for (const f of pages) for (const m of read(f).matchAll(/[A-Za-z0-9._-]+@gradmire\.com/g)) emails.add(m[0].toLowerCase());
check([...emails].every((e) => e === EMAIL), 'Only one e-mail address is published', `found: ${[...emails].join(', ')}`);
if (contact.includes(PLACEHOLDER_PHONE)) add('todo', 'Replace the placeholder phone number on the Contact page (+91 11 4567 8900) with the real one, or remove it', 'no listing should use it');
const empty = profiles.filter((p) => !p.url).map((p) => p.key);
if (empty.length) add('todo', `Social profiles not yet created or added: ${empty.join(', ')}`, 'add each address to scripts/social.mjs, then run node scripts/sync-footer.mjs');
add('todo', 'Named counsellors with consent on the About page', 'needed for expert-comment platforms and ICEF training');
add('todo', 'Postcodes and office photos for the Google Business Profiles', 'see docs/business-listing-kit.md');

/* Report */
const width = Math.max(...results.map((r) => r.label.length));
for (const r of results) console.log(`${r.status.padEnd(4)}  ${r.label}${r.detail ? `\n      ${r.detail}` : ''}`);
const fails = results.filter((r) => r.status === 'FAIL').length;
const todos = results.filter((r) => r.status === 'todo').length;
console.log(`\n${results.filter((r) => r.status === 'ok').length} ok, ${fails} failed, ${todos} still need you.`);
process.exit(fails ? 1 : 0);
void width;
