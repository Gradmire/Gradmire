/* Builds the public Photo credits page (frontend/pages/photo-credits.html) from the attribution tables in
     docs/germany-image-attributions.md and docs/destination-image-attributions.md.
   CC BY and CC BY-SA licences ask for credit to the photographer next to the work or somewhere reasonable
   for the medium, so every photo on the country guides is listed here and the footer links to the page.
   Run from the repository root:  node scripts/build-credits-page.mjs   (then sync-footer if the footer changed) */
import fs from 'node:fs';
import { esc, hero, shell, write } from './page-shell.mjs';

const link = (text) => esc(text).replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
    (_, label, url) => `<a href="${url}" target="_blank" rel="noopener">${label}</a>`);
const rowsOf = (file) => fs.readFileSync(file, 'utf8').split(/\r?\n/)
    .filter((l) => l.startsWith('|') && !/^\|\s*(-{3}|Page use|Country)/.test(l))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));

const germany = rowsOf('docs/germany-image-attributions.md').map(([use, , creator, licence, source]) => ['Germany', use, creator, licence, source]);
const others = rowsOf('docs/destination-image-attributions.md').map(([country, use, , creator, licence, source]) => [country, use, creator, licence, source]);
const rows = [...others, ...germany];

const body = `${hero({
    crumbs: [['Home', './'], ['Photo credits']],
    eyebrow: 'Photo credits',
    title: 'Who took the photos on our country guides.',
    intro: 'The university and city photos on the UK, USA, Canada, Australia, Ireland, Italy, New Zealand and Germany guides are freely licensed files from Wikimedia Commons. We resized them for the web and changed nothing else. Thank you to the photographers.',
    actions: '',
    form: ''
})}
<main id="main">
<section class="gp-section">
  <div class="gp-table-wrap"><table class="gp-table gp-table--compact">
    <thead><tr><th scope="col">Country</th><th scope="col">Photo</th><th scope="col">Creator</th><th scope="col">Licence</th><th scope="col">Source</th></tr></thead>
    <tbody>
${rows.map((r) => `      <tr>${r.map((c) => `<td>${link(c)}</td>`).join('')}</tr>`).join('\n')}
    </tbody>
  </table></div>
  <p class="gp-note">Licences: CC0 and public domain files need no credit; CC BY and CC BY-SA files are credited above. CC BY-SA terms also apply to the resized copies shown on this site.</p>
</section>
</main>`;

const html = shell({
    title: 'Photo credits | Gradmire',
    description: 'Credits and licences for the university and city photos on the Gradmire country guides.',
    body
}).replace('<link rel="icon"', '<meta name="robots" content="noindex, follow">\n<link rel="icon"');
write('photo-credits.html', html);
console.log(`Built the Photo credits page (${rows.length} photos).`);
