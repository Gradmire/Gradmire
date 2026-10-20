/* Builds the scholarships hub (scholarships.html) and one page per destination
   (scholarships-in-<country>.html) into frontend/pages/.
   Run from the repository root:  node scripts/build-scholarship-pages.mjs
   Scholarship content lives in scholarship-data.mjs. */
import { destinations, multiCountry, REVIEWED } from './scholarship-data.mjs';
import { esc, consultHref, shell, leadForm, hero, section, steps, faq, cta, write } from './page-shell.mjs';

const levelName = { ug: 'Bachelor’s', pg: 'Master’s' };
const scholarshipConsult = (country = '') => consultHref('scholarship', country);

function card(s, country = '') {
    return `<article class="gp-schol" data-levels="${s.level.join(' ')}">
  <div class="gp-schol-main">
    <div class="gp-schol-head">
      <h3>${esc(s.name)}</h3>
      <div class="gp-schol-levels">${s.level.map((l) => `<span>${levelName[l]}</span>`).join('')}</div>
    </div>
    <p class="gp-schol-provider">${esc(s.provider)}</p>
    <dl class="gp-schol-facts">
      <div><dt>Value</dt><dd>${esc(s.value)}</dd></div>
      <div><dt>Who can apply</dt><dd>${esc(s.who)}</dd></div>
      <div><dt>When to apply</dt><dd>${esc(s.timing)}</dd></div>
    </dl>
  </div>
  <div class="gp-schol-actions">
    <a class="gp-btn gp-btn-primary" href="${scholarshipConsult(country)}" data-open-consult${country ? ` data-country="${country}"` : ''} data-scholarship="${esc(s.name)}">Apply with Gradmire</a>
    <a class="gp-schol-official" href="${s.url}" target="_blank" rel="noopener noreferrer">Official details <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a>
  </div>
</article>`;
}

const levelFilter = (label) => `<div class="gp-level-filter" role="group" aria-label="${esc(label)}" data-level-filter>
    <button type="button" aria-pressed="true" data-level="">All</button>
    <button type="button" aria-pressed="false" data-level="ug">Bachelor’s</button>
    <button type="button" aria-pressed="false" data-level="pg">Master’s</button>
  </div>
  <p class="gp-level-empty" role="status" hidden>No scholarships for this level here. Try “All”, or ask a counsellor about university awards.</p>`;

const helpSteps = [
    ['Shortlist', 'We match your profile, course and destination to the scholarships you are realistically eligible for.'],
    ['Plan deadlines', 'Many scholarship deadlines come before admission deadlines. We build one timeline for both.'],
    ['Strengthen your application', 'Feedback on scholarship essays, personal statements and CVs; the writing stays yours.'],
    ['References and documents', 'Guidance on referees, transcripts and any financial documents the scholarship asks for.'],
    ['Interviews', 'Practice for scholarship interviews, such as Chevening’s.'],
    ['Plan the rest', 'Most scholarships are partial, so we help you plan the remaining funding too.']
];

const commonFaq = [
    ['Are scholarships available for bachelor’s students?', 'Yes, but fewer than for master’s study. Most bachelor’s funding comes from universities as partial tuition discounts or need-based aid, so apply early and to several universities.'],
    ['Do scholarships cover everything?', 'A few fully funded scholarships cover tuition, living costs and travel, but most are partial. Plan for the full cost of study and treat a scholarship as a bonus until it is confirmed.'],
    ['Can I apply before I have an admission offer?', 'For some scholarships, yes; others need an offer first. Check each scholarship’s rules on its official page.']
];

function countryPage(d) {
    const others = destinations.filter((o) => o.slug !== d.slug);
    const body = `${hero({
        crumbs: [['Home', 'index.html'], ['Scholarships', 'scholarships.html'], [`Scholarships in ${d.name}`]],
        eyebrow: `Scholarships in ${d.name}`,
        title: `Scholarships to study in ${d.fullName}`,
        intro: d.intro,
        actions: `<a class="gp-btn gp-btn-primary" href="#scholarships">See scholarships</a>
        <a class="gp-btn gp-btn-ghost" href="${d.page}">Study in ${esc(d.fullName)}</a>`,
        form: leadForm({ id: `schol-${d.slug}`, interest: 'scholarship', country: d.slug, eyebrow: 'Free scholarship guidance', title: `Find scholarships you can win in ${d.name}` })
    })}
<main id="main">
${section({ id: 'scholarships', tag: 'Bachelor’s & master’s', title: `Scholarships in ${d.name}`, lead: 'A summary of each scholarship. Values and dates change every year, so always confirm on the official page before you apply.', body: `${levelFilter(`Filter ${d.name} scholarships by study level`)}
  <div class="gp-schol-list">
${d.scholarships.map((s) => card(s, d.slug)).join('\n')}
  </div>
  <p class="gp-note">Last reviewed ${REVIEWED}. Gradmire is not the awarding body for these scholarships and cannot guarantee an award; the official page always takes precedence.</p>` })}

${section({ id: 'how-we-help', tag: 'How we help', title: 'Apply for scholarships with Gradmire', body: steps(helpSteps) })}

${section({ id: 'faq', tag: 'FAQs', title: `Scholarships in ${d.name}: common questions`, cls: 'gp-faq', body: faq(commonFaq) })}

${section({ id: 'other-countries', tag: 'Other destinations', title: 'Scholarships in other countries', body: `<div class="gp-pill-links">${others.map((o) => `<a href="scholarships-in-${o.slug}.html">Scholarships in ${esc(o.name)}</a>`).join('')}<a href="scholarships.html">All scholarships</a></div>` })}

${cta({ title: 'Want help finding funding?', text: `Tell us your course and budget and we’ll shortlist scholarships in ${d.fullName} you can apply for.`, href: scholarshipConsult(d.slug), label: 'Book free scholarship guidance', country: d.slug })}
</main>`;
    return shell({
        title: `Scholarships in ${d.name} for International Students (Bachelor’s & Master’s) | Gradmire`,
        description: `Scholarships for bachelor’s and master’s study in ${d.fullName}: what each covers, who can apply, when to apply and links to official details.`,
        body
    });
}

function hubPage() {
    /* Old links used scholarships.html?country=uk; send them to the country page. */
    const redirect = `<script>(function(){var c=(new URLSearchParams(location.search).get('country')||'').toLowerCase().replace(/[^a-z]/g,'');var ok=${JSON.stringify(destinations.map((d) => d.slug))};if(ok.indexOf(c)>-1)location.replace('scholarships-in-'+c+'.html');})();</script>`;
    const body = `${redirect}
${hero({
        crumbs: [['Home', 'index.html'], ['Scholarships']],
        eyebrow: 'Scholarships',
        title: 'Scholarships for bachelor’s and master’s study abroad.',
        intro: 'Explore government, university and foundation scholarships in nine study destinations. See what each covers and who can apply, then get help putting together a strong application.',
        actions: `<a class="gp-btn gp-btn-primary" href="#countries">Choose a country</a>
        <a class="gp-btn gp-btn-ghost" href="#how-we-help">How we help</a>`,
        form: leadForm({ id: 'schol-hub', interest: 'scholarship', eyebrow: 'Free scholarship guidance', title: 'Find scholarships that fit your profile' })
    })}
<main id="main">
${section({ id: 'countries', tag: 'By country', title: 'Scholarships by destination', body: `<div class="gp-tile-grid">
${destinations.map((d) => `    <a class="gp-tile" href="scholarships-in-${d.slug}.html">
      <span class="gp-tile-name">Scholarships in ${esc(d.name)}</span>
      <span class="gp-tile-meta">${d.scholarships.length} scholarship${d.scholarships.length === 1 ? '' : 's'} and award types</span>
      <span class="gp-tile-meta">${[...new Set(d.scholarships.flatMap((s) => s.level))].sort((a, b) => (a === 'ug' ? -1 : 1)).map((l) => levelName[l]).join(' · ')}</span>
      <span class="gp-tile-go" aria-hidden="true">→</span>
    </a>`).join('\n')}
  </div>` })}

${section({ id: 'from-india', tag: 'For Indian students', title: 'Programmes that fund study in several countries', lead: 'Indian trusts and foundations that support postgraduate study abroad, wherever you are admitted.', body: `<div class="gp-schol-list">
${multiCountry.map((s) => card(s)).join('\n')}
  </div>` })}

${section({ id: 'how-we-help', tag: 'How we help', title: 'Apply for scholarships with Gradmire', body: steps(helpSteps) })}

${section({ id: 'faq', tag: 'FAQs', title: 'Scholarships: common questions', cls: 'gp-faq', body: faq(commonFaq) })}

${cta({ title: 'Not sure which scholarships you qualify for?', text: 'Book a free session and we’ll shortlist scholarships that match your profile, course and budget.', href: scholarshipConsult(), label: 'Book free scholarship guidance' })}
</main>`;
    return shell({
        title: 'Scholarships to Study Abroad: Bachelor’s & Master’s by Country | Gradmire',
        description: 'Scholarships for bachelor’s and master’s study in the UK, USA, Canada, Australia, Germany, Ireland, New Zealand, Italy and Finland, with official links and application help.',
        body
    });
}

write('scholarships.html', hubPage());
for (const d of destinations) write(`scholarships-in-${d.slug}.html`, countryPage(d));
console.log(`Built scholarships.html and ${destinations.length} country pages.`);
