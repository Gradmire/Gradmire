/* Builds the MBBS Abroad hub and one page per country into frontend/pages/.
   Run from the repository root:  node scripts/build-mbbs-pages.mjs
   Country copy lives in mbbs-data.mjs; the nav and footer are taken from an existing
   destination page so every page keeps the same header and footer. */
import fs from 'node:fs';
import path from 'node:path';
import { countries, REVIEWED } from './mbbs-data.mjs';

const pagesDir = path.resolve('frontend/pages');
const template = fs.readFileSync(path.join(pagesDir, 'study-in-finland.html'), 'utf8');
const navHtml = template.match(/<nav class="nav[\s\S]*?<\/nav>/)[0];
const footerHtml = template.match(/<footer[\s\S]*?<\/footer>/)[0];
const siteCss = template.match(/site\.css\?v=\d+/)[0];
const siteJs = fs.readFileSync(path.join(pagesDir, 'index.html'), 'utf8').match(/site\.js\?v=\d+/)[0];

const esc = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const consultHref = (slug = '') => `free-consultation.html?interest=mbbs-abroad${slug ? `&amp;country=${slug}` : ''}#book`;
const NMC_REGS = 'https://www.nmc.org.in/rules-regulations/foreign-medical-graduate-licentiate-regulations-2021/';
const NMC_HOME = 'https://www.nmc.org.in/';
const NEET = 'https://neet.nta.nic.in/';

const themeBoot = '<script>try{var c=JSON.parse(localStorage.getItem("gm-consent")||"null"),t=(c&&c.preferences&&localStorage.getItem("gradmire-theme"))||sessionStorage.getItem("gradmire-theme");if(t)document.documentElement.dataset.theme=t;}catch(e){}</script>';

function shell({ title, description, body }) {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
${themeBoot}
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="stylesheet" href="../assets/${siteCss}">
<link rel="stylesheet" href="../assets/mbbs.css?v=2">
</head>
<body class="destination-page mbbs-page">
${navHtml}
${body}
${footerHtml}
<script src="../assets/${siteJs}" defer></script>
</body>
</html>
`;
}

/* Inline lead form: site.js validates it, stores a prefill and opens the booking page. */
function leadForm(country) {
    const id = country ? country.slug : 'hub';
    return `<form class="mbbs-lead" data-consult-form data-interest="mbbs-abroad" data-country="${country ? country.slug : ''}" novalidate aria-labelledby="lead-title-${id}">
  <p class="mbbs-lead-eyebrow">Free MBBS counselling</p>
  <h2 class="mbbs-lead-title" id="lead-title-${id}">${country ? `Check your fit for MBBS in ${esc(country.name)}` : 'Find the right country for your MBBS'}</h2>
  <label class="mbbs-field"><span>Full name</span><input name="name" type="text" autocomplete="name" required></label>
  <label class="mbbs-field"><span>Phone number</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" required></label>
  <label class="mbbs-field"><span>Email <em>(optional)</em></span><input name="email" type="email" autocomplete="email"></label>
  <p class="mbbs-lead-error" role="alert" hidden></p>
  <button type="submit" class="mbbs-btn mbbs-btn-primary">Book my free counselling <span aria-hidden="true">→</span></button>
  <p class="mbbs-lead-fine">You’ll confirm your details and consent on the next step. Under 18? Please ask a parent or guardian first. <a href="privacy.html">Privacy policy</a></p>
</form>`;
}

const eligibility = `<ul class="mbbs-check">
  <li><strong>NEET-UG qualified.</strong> The NMC requires a qualifying NEET score for any Indian student who plans to practise in India after an MBBS abroad.</li>
  <li><strong>Class 12 with Physics, Chemistry, Biology and English.</strong> At least 50% aggregate in PCB (40% for SC/ST/OBC, 45% for PwD candidates), or the university’s own higher cut-off.</li>
  <li><strong>Age 17 or older</strong> by 31 December of the admission year.</li>
  <li><strong>A valid passport</strong> and the documents the university and embassy ask for.</li>
</ul>`;

const nmcChecklist = `<ol class="mbbs-check mbbs-check--numbered">
  <li>The course runs at least <strong>54 months</strong>, followed by a <strong>12-month internship at the same university</strong>.</li>
  <li>The <strong>whole course is taught in English</strong>.</li>
  <li>The curriculum covers the subjects the NMC lists, with clinical training in the same country.</li>
  <li>The degree lets you <strong>register or get a licence to practise</strong> in that country, on the same terms as its own citizens.</li>
  <li>You finish the course within <strong>10 years</strong> of joining.</li>
</ol>`;

const steps = [
    ['Free counselling', 'We look at your NEET score, PCB marks, budget and preferences, and explain the trade-offs honestly.'],
    ['Shortlist', 'We compare universities against the NMC’s 2021 regulations, the clinical training they offer and the total six-year cost.'],
    ['Apply', 'We prepare and check your documents, then submit your application to the universities you choose.'],
    ['Admission letter', 'Once a university admits you, we help you check the offer and the fee schedule before you pay anything.'],
    ['Visa', 'We guide your invitation, visa file and medical tests, and prepare you for embassy steps.'],
    ['Fly and enrol', 'Pre-departure briefing, travel planning and help with hostel, registration and arrival formalities.']
];

const documents = ['Class 10 and Class 12 mark sheets and certificates', 'NEET-UG scorecard', 'Passport (valid well beyond your travel date)', 'Passport-size photographs', 'Birth certificate (attested or apostilled if requested)', 'Medical fitness certificate, including HIV test', 'Admission letter or invitation from the university', 'Proof of fee payment and funds, as the embassy requires'];

const commonFaq = [
    ['Will my MBBS abroad be valid in India?', `To practise in India you must meet the NMC’s Foreign Medical Graduate Licentiate Regulations, 2021, pass India’s licensing exam (currently FMGE, to be replaced by NExT), and complete a 12-month supervised internship in India. Check every programme against <a href="${NMC_REGS}" target="_blank" rel="noopener noreferrer">the regulations</a> before you apply.`],
    ['Does the NMC publish a list of approved foreign universities?', 'No. The NMC does not approve individual foreign universities. It sets conditions the course must meet. A university appearing in the WHO/World Directory of Medical Schools is necessary but not enough on its own; the programme you join must also meet the NMC rules.'],
    ['How long is my NEET score valid for studying abroad?', 'Under current NMC guidance, a qualifying NEET-UG result can be used for admission abroad for three years from the result date. Check the NMC website for the latest notice before you apply.']
];

function faqBlock(items) {
    return items.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${a.includes('<a ') ? a : esc(a)}</p></details>`).join('\n');
}

function countryPage(c) {
    const others = countries.filter((o) => o.slug !== c.slug);
    const f = c.facts;
    const body = `<header class="mbbs-hero">
  <div class="mbbs-hero-inner">
    <div class="mbbs-hero-copy">
      <nav class="mbbs-crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a> <span aria-hidden="true">/</span> <a href="mbbs-abroad.html">MBBS Abroad</a> <span aria-hidden="true">/</span> <span aria-current="page">${esc(c.name)}</span></nav>
      <span class="mbbs-eyebrow">MBBS in ${esc(c.name)}</span>
      <h1>${esc(c.headline)}</h1>
      <p>${esc(c.intro)}</p>
      <div class="mbbs-hero-actions">
        <a class="mbbs-btn mbbs-btn-primary" href="${consultHref(c.slug)}" data-open-consult data-country="${c.slug}">Talk to an MBBS counsellor</a>
        <a class="mbbs-btn mbbs-btn-ghost" href="#fees">See fees &amp; costs</a>
      </div>
    </div>
    ${leadForm(c)}
  </div>
</header>
<div class="mbbs-facts" aria-label="MBBS in ${esc(c.name)} at a glance">
  <div><span>Course length</span><strong>${esc(f.duration)}</strong></div>
  <div><span>Teaching language</span><strong>${esc(f.medium)}</strong></div>
  <div><span>Tuition (indicative)</span><strong>${esc(f.tuition)}</strong></div>
  <div><span>Living costs (indicative)</span><strong>${esc(f.living)}</strong></div>
  <div><span>Main intake</span><strong>${esc(f.intake)}</strong></div>
</div>
<nav class="mbbs-subnav" aria-label="On this page"><div class="mbbs-subnav-inner">
  <a href="#overview">Overview</a><a href="#universities">Universities</a><a href="#eligibility">Eligibility</a><a href="#admission">Admission</a><a href="#fees">Fees</a><a href="#visa">Visa</a><a href="#student-life">Student life</a><a href="#licensing">After MBBS</a><a href="#faq">FAQs</a>
</div></nav>
<main id="main">
<section class="mbbs-section" id="overview">
  <span class="mbbs-tag">Why ${esc(c.name)}</span>
  <h2>What makes ${esc(c.name)} worth considering</h2>
  <div class="mbbs-grid-3">
${c.why.map(([t, p]) => `    <article class="mbbs-card"><h3>${esc(t)}</h3><p>${esc(p)}</p></article>`).join('\n')}
  </div>
  <p class="mbbs-note"><strong>Know before you go:</strong> ${esc(c.caution)}</p>
</section>

<section class="mbbs-section" id="universities">
  <span class="mbbs-tag">Universities</span>
  <h2>Medical universities in ${esc(c.name)} to look at</h2>
  <p class="mbbs-lead-text">A starting shortlist, not a ranking. Before applying, we check each programme’s length, teaching language and internship arrangements against the NMC’s 2021 regulations.</p>
  <div class="mbbs-uni-grid">
${c.universities.map(([name, city, note]) => `    <article class="mbbs-uni">
      <span class="mbbs-uni-city">${esc(city)}, ${esc(c.name)}</span>
      <h3>${esc(name)}</h3>
      <p>${esc(note)}</p>
      <a class="mbbs-uni-cta" href="${consultHref(c.slug)}" data-open-consult data-country="${c.slug}">Apply with Gradmire <span aria-hidden="true">→</span></a>
    </article>`).join('\n')}
  </div>
</section>

<section class="mbbs-section" id="eligibility">
  <span class="mbbs-tag">Eligibility</span>
  <h2>Who can apply</h2>
  <div class="mbbs-grid-2">
    <article class="mbbs-card"><h3>Basic eligibility for Indian students</h3>${eligibility}</article>
    <article class="mbbs-card"><h3>The NMC checklist every programme must pass</h3>${nmcChecklist}<p class="mbbs-source">Source: <a href="${NMC_REGS}" target="_blank" rel="noopener noreferrer">NMC Foreign Medical Graduate Licentiate Regulations, 2021</a></p></article>
  </div>
</section>

<section class="mbbs-section" id="admission">
  <span class="mbbs-tag">Admission process</span>
  <h2>How admission works, step by step</h2>
  <ol class="mbbs-steps">
${steps.map(([t, p]) => `    <li><h3>${esc(t)}</h3><p>${esc(p)}</p></li>`).join('\n')}
  </ol>
  <div class="mbbs-card mbbs-docs"><h3>Documents you’ll usually need</h3><ul>${documents.map((d) => `<li>${esc(d)}</li>`).join('')}</ul></div>
</section>

<section class="mbbs-section" id="fees">
  <span class="mbbs-tag">Fees &amp; living costs</span>
  <h2>What MBBS in ${esc(c.name)} costs</h2>
  <div class="mbbs-cost">
    <div class="mbbs-cost-item"><span>Tuition</span><strong>${esc(f.tuition)}</strong><p>Varies by university and city. Some universities charge the first year’s fee plus a one-time admission fee.</p></div>
    <div class="mbbs-cost-item"><span>Living costs</span><strong>${esc(f.living)}</strong><p>Hostel, food, local transport and day-to-day expenses. Capital cities cost more.</p></div>
    <div class="mbbs-cost-item"><span>Also budget for</span><strong>One-time costs</strong><p>Flights, visa and medical tests, insurance, document attestation and winter clothing where relevant.</p></div>
  </div>
  <p class="mbbs-note">These are indicative planning ranges (last reviewed ${REVIEWED}), not a quote. Fees and exchange rates change, so we confirm the current fee schedule with the university before you pay. Try the <a href="tools/roi-calculator.html">study cost calculator</a> to plan a full budget.</p>
</section>

<section class="mbbs-section" id="visa">
  <span class="mbbs-tag">Student visa</span>
  <h2>Getting your ${esc(c.name)} student visa</h2>
  <p class="mbbs-lead-text">${esc(c.visa.summary)}</p>
  <div class="mbbs-grid-2">
    <article class="mbbs-card"><h3>Typical visa file</h3><ul>${c.visa.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></article>
    <article class="mbbs-card"><h3>After you arrive</h3><p>${esc(c.visa.after)}</p></article>
  </div>
  <p class="mbbs-note">Visa rules and document lists change. This is a planning summary, not legal advice. Always follow the current checklist from the embassy and your university.</p>
</section>

<section class="mbbs-section" id="student-life">
  <span class="mbbs-tag">Student life</span>
  <h2>Living in ${esc(c.name)} as an Indian student</h2>
  <div class="mbbs-grid-3">
${c.life.map(([t, p]) => `    <article class="mbbs-card"><h3>${esc(t)}</h3><p>${esc(p)}</p></article>`).join('\n')}
  </div>
</section>

<section class="mbbs-section" id="licensing">
  <span class="mbbs-tag">After your MBBS</span>
  <h2>Clinical training and careers after graduation</h2>
  <div class="mbbs-grid-3">
    <article class="mbbs-card"><h3>Practise in India</h3><p>Pass India’s licensing exam (currently FMGE, to be replaced by NExT), then complete a 12-month supervised internship in India before full registration.</p></article>
    <article class="mbbs-card"><h3>Practise abroad</h3><p>Graduates can also prepare for other countries’ licensing routes, such as the USMLE (USA), the UKMLA/PLAB (UK) or the AMC exams (Australia), each with its own eligibility rules.</p></article>
    <article class="mbbs-card"><h3>Postgraduate study</h3><p>Specialisation options depend on where you are licensed. Plan early if you are aiming for PG in India or abroad.</p></article>
  </div>
</section>

<section class="mbbs-section mbbs-why" id="why-gradmire">
  <span class="mbbs-tag">Why Gradmire</span>
  <h2>We help you choose a programme that keeps your India licence open</h2>
  <div class="mbbs-grid-2">
    <ul class="mbbs-check">
      <li><strong>NMC-first shortlisting.</strong> Every option is checked against the 2021 regulations before we suggest it.</li>
      <li><strong>Transparent costs.</strong> We walk you through the university’s own fee schedule, with no surprise add-ons.</li>
      <li><strong>Documents and visa.</strong> We check every document and guide you through the invitation, visa and embassy steps.</li>
      <li><strong>After arrival.</strong> Pre-departure briefing and help settling in, from hostel to registration.</li>
    </ul>
    <div class="mbbs-compare"><h3>Comparing countries?</h3><p>See every MBBS destination side by side on one page.</p><a class="mbbs-btn mbbs-btn-primary" href="mbbs-abroad.html#compare">Compare MBBS countries</a></div>
  </div>
</section>

<section class="mbbs-section mbbs-faq" id="faq">
  <span class="mbbs-tag">FAQs</span>
  <h2>MBBS in ${esc(c.name)}: common questions</h2>
${faqBlock([...c.faq, ...commonFaq])}
</section>

<section class="mbbs-section" aria-labelledby="other-countries">
  <span class="mbbs-tag">Other MBBS destinations</span>
  <h2 id="other-countries">Explore more countries</h2>
  <div class="mbbs-country-links">${others.map((o) => `<a href="mbbs-in-${o.slug}.html">MBBS in ${esc(o.name)}</a>`).join('')}</div>
</section>

<div class="mbbs-cta">
  <h2>Not sure ${esc(c.name)} is the right fit?</h2>
  <p>Talk through your NEET score, budget and goals with a Gradmire counsellor. Counselling is free and there’s no obligation.</p>
  <a class="mbbs-btn mbbs-btn-primary" href="${consultHref(c.slug)}" data-open-consult data-country="${c.slug}">Book a free consultation</a>
</div>
</main>`;
    return shell({
        title: `MBBS in ${c.name} for Indian Students: Fees, Universities & Eligibility | Gradmire`,
        description: `MBBS in ${c.name}: course length, indicative fees, medical universities, NEET eligibility, NMC checks, admission steps and student visa guidance for Indian students.`,
        body
    });
}

function hubPage() {
    const body = `<header class="mbbs-hero">
  <div class="mbbs-hero-inner">
    <div class="mbbs-hero-copy">
      <nav class="mbbs-crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a> <span aria-hidden="true">/</span> <span aria-current="page">MBBS Abroad</span></nav>
      <span class="mbbs-eyebrow">MBBS Abroad</span>
      <h1>Become a doctor abroad, without closing the door to practising in India.</h1>
      <p>Compare nine popular MBBS destinations for Indian students on course length, indicative fees and living costs. We check every option against the NMC’s rules for foreign medical graduates.</p>
      <div class="mbbs-hero-actions">
        <a class="mbbs-btn mbbs-btn-primary" href="#compare">Compare countries</a>
        <a class="mbbs-btn mbbs-btn-ghost" href="#nmc">Read the NMC checklist</a>
      </div>
    </div>
    ${leadForm(null)}
  </div>
</header>
<main id="main">
<section class="mbbs-section" id="countries">
  <span class="mbbs-tag">Destinations</span>
  <h2>Choose a country to explore</h2>
  <div class="mbbs-country-grid">
${countries.map((c) => `    <a class="mbbs-country" href="mbbs-in-${c.slug}.html">
      <span class="mbbs-country-name">${esc(c.name)}</span>
      <span class="mbbs-country-meta">${esc(c.facts.tuition)}</span>
      <span class="mbbs-country-meta">${esc(c.facts.duration)}</span>
      <span class="mbbs-country-go" aria-hidden="true">→</span>
    </a>`).join('\n')}
  </div>
</section>

<section class="mbbs-section" id="compare">
  <span class="mbbs-tag">Side by side</span>
  <h2>Compare MBBS countries</h2>
  <div class="mbbs-table-wrap" tabindex="0" role="region" aria-label="MBBS country comparison table">
    <table class="mbbs-table">
      <thead><tr><th scope="col">Country</th><th scope="col">Course length</th><th scope="col">Tuition (indicative)</th><th scope="col">Living (indicative)</th><th scope="col">Patient language</th><th scope="col">Intake</th></tr></thead>
      <tbody>
${countries.map((c) => `        <tr><th scope="row"><a href="mbbs-in-${c.slug}.html">${esc(c.name)}</a></th><td>${esc(c.facts.duration)}</td><td>${esc(c.facts.tuition)}</td><td>${esc(c.facts.living)}</td><td>${esc(c.facts.medium.replace(/^English \((.*) for patient contact\)$/, '$1'))}</td><td>${esc(c.facts.intake)}</td></tr>`).join('\n')}
      </tbody>
    </table>
  </div>
  <p class="mbbs-note">Indicative planning ranges, last reviewed ${REVIEWED}. Fees vary by university and change from year to year; we confirm the current fee schedule before you apply.</p>
</section>

<section class="mbbs-section" id="nmc">
  <span class="mbbs-tag">NMC rules</span>
  <h2>The checklist that protects your India licence</h2>
  <p class="mbbs-lead-text">The NMC does not approve foreign universities one by one. Instead, the <a href="${NMC_REGS}" target="_blank" rel="noopener noreferrer">Foreign Medical Graduate Licentiate Regulations, 2021</a> set conditions your course must meet. Miss one and you may not be allowed to sit India’s licensing exam.</p>
  <div class="mbbs-grid-2">
    <article class="mbbs-card"><h3>Your programme must meet these conditions</h3>${nmcChecklist}</article>
    <article class="mbbs-card"><h3>You must meet these conditions</h3>${eligibility}<p class="mbbs-source">Official sites: <a href="${NMC_HOME}" target="_blank" rel="noopener noreferrer">National Medical Commission</a> · <a href="${NEET}" target="_blank" rel="noopener noreferrer">NEET-UG (NTA)</a></p></article>
  </div>
</section>

<section class="mbbs-section" id="admission">
  <span class="mbbs-tag">How we help</span>
  <h2>From NEET result to your first lecture</h2>
  <ol class="mbbs-steps">
${steps.map(([t, p]) => `    <li><h3>${esc(t)}</h3><p>${esc(p)}</p></li>`).join('\n')}
  </ol>
</section>

<section class="mbbs-section mbbs-faq" id="faq">
  <span class="mbbs-tag">FAQs</span>
  <h2>MBBS abroad: common questions</h2>
${faqBlock([
        ['Which country is best for MBBS abroad?', 'There is no single best country. The right choice depends on your NEET score, budget, how comfortable you are learning a new language for patient care, climate, and whether you plan to practise in India or abroad. Counselling helps you weigh these for your situation.'],
        ...commonFaq
    ])}
</section>

<div class="mbbs-cta">
  <h2>Talk to an MBBS counsellor</h2>
  <p>Get a shortlist that fits your NEET score and budget and meets NMC requirements. Counselling is free and there’s no obligation.</p>
  <a class="mbbs-btn mbbs-btn-primary" href="${consultHref()}" data-open-consult>Book a free consultation</a>
</div>
</main>`;
    return shell({
        title: 'MBBS Abroad for Indian Students: Compare Countries, Fees & NMC Rules | Gradmire',
        description: 'Compare MBBS abroad in Russia, China, Georgia, Egypt, Uzbekistan, Kazakhstan, Kyrgyzstan, Bulgaria and Moldova: course length, indicative fees, living costs and NMC eligibility.',
        body
    });
}

fs.writeFileSync(path.join(pagesDir, 'mbbs-abroad.html'), hubPage());
for (const c of countries) fs.writeFileSync(path.join(pagesDir, `mbbs-in-${c.slug}.html`), countryPage(c));
console.log(`Built mbbs-abroad.html and ${countries.length} country pages.`);
