/* Builds the Press kit and link-resources page (frontend/pages/press.html).
   Everything on it is a fact already stated elsewhere on the site (About, Contact, the guides), so there is one story
   for journalists, editors and resource-page owners to quote. Linked pages are described with their own meta
   descriptions, read at build time, so this page cannot drift from them.
   Run from the repository root:  node scripts/build-press-page.mjs   (then the sync steps in docs/mobile-app-layer.md) */
import fs from 'node:fs';
import path from 'node:path';
import { esc, hero, section, shell, write, pagesDir } from './page-shell.mjs';

const SITE = 'https://www.gradmire.com';
const read = (slug) => fs.readFileSync(path.join(pagesDir, `${slug}.html`), 'utf8');
const decode = (t) => t.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, '’').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const descOf = (slug) => decode(read(slug).match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] || '');
const nameOf = (slug) => decode((read(slug).match(/<title>([\s\S]*?)<\/title>/i)?.[1] || slug).split(/\s*[|—]\s*Gradmire/i)[0]).replace(/\s+/g, ' ').trim();

const SHORT = 'Gradmire is a study-abroad counselling company for students in India. It offers a free first consultation and fee-only counselling with no commissions from universities, plus free planning tools, from offices in Kanpur and Greater Noida.';
const LONG = `${SHORT} Gradmire Education Pvt. Ltd. was founded in 2026 in Noida by Aquib Jamal. It publishes guides for nine study destinations and nine MBBS countries, scholarship and student-visa guides, and four free tools: a study cost calculator, a course comparator, a deadline tracker and a GPA, CGPA and SGPA converter. Where a figure or rule can change, the guide links to the official source.`;

const facts = [
    ['Company', 'Gradmire Education Pvt. Ltd. (trading as Gradmire)'],
    ['Founded', '2026, in Noida'],
    ['Founder', 'Aquib Jamal'],
    ['Offices', 'Kanpur: Near Halim College, Prem Nagar. Greater Noida: N2 Tower, Supertech Ecovillage 1.'],
    ['How it works', 'Fee-only counselling. No commissions from universities. The first consultation is free, with no obligation.'],
    ['Coverage', 'Nine study destinations (UK, USA, Canada, Australia, Germany, Ireland, Italy, New Zealand, Finland) and nine MBBS countries'],
    ['Free tools', 'Study cost calculator, course comparator, deadline tracker, GPA / CGPA / SGPA converter'],
    ['Languages', 'English and Hindi'],
    ['Office hours', 'Monday to Saturday, 9 AM to 7 PM IST'],
    ['Email', '<a href="mailto:info@gradmire.com">info@gradmire.com</a>'],
    ['WhatsApp', '<a href="https://wa.me/918577909702" target="_blank" rel="noopener noreferrer">+91 85779 09702</a>'],
    ['Website', `<a href="${SITE}/">www.gradmire.com</a>`]
];

const linkPages = [
    ['tools/roi-calculator', 'Free tool'], ['tools/grade-converter', 'Free tool'], ['tools/deadline-tracker', 'Free tool'], ['tools/comparator', 'Free tool'],
    ['scholarships', 'Guide'], ['mbbs-abroad', 'Guide'], ['study-abroad-2027', 'Guide'], ['destinations', 'Guide']
];

const logos = [
    ['gradmire-logo.png', 'Logo for light backgrounds (PNG)'],
    ['gradmire-logo-white.png', 'Logo for dark backgrounds (PNG)'],
    ['gradmire_logo.svg', 'Logo (SVG)'],
    ['og-cover.jpg', 'Share image, 1200 × 630 (JPG)']
];

const snippet = (slug) => `&lt;a href="${SITE}/${slug}"&gt;${esc(nameOf(slug))} by Gradmire&lt;/a&gt;`;

const body = `${hero({
    crumbs: [['Home', './'], ['Press kit']],
    eyebrow: 'Press kit',
    title: 'Facts, logos and links for writers and editors.',
    intro: 'Everything you need to describe Gradmire accurately, plus ready-made links to our free tools and guides. Everything here is also stated on the rest of the site.',
    actions: '<a class="gp-btn gp-btn-primary" href="#facts">Key facts</a>\n        <a class="gp-btn gp-btn-ghost" href="#link-to-us">Link to our tools</a>',
    form: ''
})}
<main id="main">
${section({ id: 'about', tag: 'About Gradmire', title: 'Two descriptions you can use', body: `<div class="gp-grid-2">
    <article class="gp-card"><h3>Short</h3><p>${esc(SHORT)}</p></article>
    <article class="gp-card"><h3>Longer</h3><p>${esc(LONG)}</p></article>
  </div>` })}

${section({ id: 'facts', tag: 'Key facts', title: 'Gradmire at a glance', body: `<div class="gp-table-wrap"><table class="gp-table gp-table--compact">
    <tbody>
${facts.map(([k, v]) => `      <tr><th scope="row">${esc(k)}</th><td>${/^</.test(v) ? v : esc(v)}</td></tr>`).join('\n')}
    </tbody>
  </table></div>` })}

${section({ id: 'founder', tag: 'Founder', title: 'Aquib Jamal', body: `<div class="gp-grid-2">
    <article class="gp-card"><p>Aquib Jamal founded Gradmire in 2026 in Noida. He believes that choosing where to study abroad is one of the biggest decisions a student and their family will ever make, and that the advice behind it should be clear, honest and built around the student.</p>
    <p><a href="about#founder-title">Read the founder story on the About page</a></p></article>
    <article class="gp-card"><h3>Portrait</h3><p>Photo supplied by Gradmire.</p><p><a href="../assets/team/aquib-jamal.webp" download>Download the portrait (WebP, 1254 × 1254)</a></p></article>
  </div>` })}

${section({ id: 'logos', tag: 'Brand', title: 'Logos and images', lead: 'Please use the logo as it is: no recolouring, stretching or added effects, and with clear space around it.', body: `<div class="gp-grid-2">
${logos.map(([file, label]) => `    <article class="gp-card"><h3>${esc(label)}</h3><p><a href="../assets/${file}" download>Download ${esc(file)}</a></p></article>`).join('\n')}
  </div>` })}

${section({ id: 'link-to-us', tag: 'Link to us', title: 'Free tools and guides you can link to', lead: 'If a page of ours would help your readers, a plain text link is all we ask. Copy the HTML below, or write your own anchor text.', body: `<div class="gp-grid-2">
${linkPages.map(([slug, kind]) => `    <article class="gp-card"><h3><a href="${slug}">${esc(nameOf(slug))}</a></h3><p><strong>${kind}.</strong> ${esc(descOf(slug))}</p>
      <pre class="gp-code"><code>${snippet(slug)}</code></pre></article>`).join('\n')}
  </div>` })}

${section({ id: 'sourcing', tag: 'How we source', title: 'How our guides are written', body: `<div class="gp-grid-2">
    <article class="gp-card"><h3>Official sources first</h3><p>Fees, dates and rules change, so each guide links to the official source for anything that can change. Figures are planning ranges, not quotes.</p></article>
    <article class="gp-card"><h3>Corrections</h3><p>If you find a mistake, please email <a href="mailto:info@gradmire.com">info@gradmire.com</a> with the page and the correct source. We would rather fix it than leave it.</p></article>
    <article class="gp-card"><h3>Photo credits</h3><p>Photos on our guides are freely licensed files, credited on the <a href="photo-credits">Photo credits</a> page.</p></article>
    <article class="gp-card"><h3>Media enquiries</h3><p>Email <a href="mailto:info@gradmire.com">info@gradmire.com</a> and tell us your outlet, the topic and your deadline.</p></article>
  </div>` })}
</main>`;

write('press.html', shell({
    title: 'Press kit and link resources | Gradmire',
    description: 'Facts, logos, a founder bio and ready-made links to Gradmire’s free study-abroad tools and guides, for journalists, editors and resource-page owners.',
    body
}));
console.log('Built the Press kit page.');
