/* Builds the MBBS Abroad hub and one page per country into frontend/pages/.
   Run from the repository root:  node scripts/build-mbbs-pages.mjs
   Country copy lives in mbbs-data.mjs; shared layout pieces in page-shell.mjs. */
import { countries, REVIEWED } from './mbbs-data.mjs';
import { esc, consultHref, shell, leadForm, hero, section, cards, steps, checklist, faq, cta, write } from './page-shell.mjs';

const NMC_REGS = 'https://www.nmc.org.in/rules-regulations/foreign-medical-graduate-licentiate-regulations-2021/';
const WDOMS = 'https://www.wdoms.org/';
const mbbsConsult = (slug = '') => consultHref('mbbs-abroad', slug);

const eligibility = checklist([
    '<strong>Secondary school completed</strong> (Class 12, A-levels, IB or equivalent) with Biology, Chemistry and usually Physics and English.',
    '<strong>Good science marks.</strong> Many universities ask for around 50–60% or more in the science subjects; some set their own entrance exam or interview.',
    '<strong>Age 17 or older</strong> by the start of the course (most universities set 31 December of the admission year).',
    '<strong>A valid passport</strong> and the documents the university and embassy ask for.'
]);

const licenceChecks = checklist([
    `The university is listed in the <a href="${WDOMS}" target="_blank" rel="noopener noreferrer">World Directory of Medical Schools</a>.`,
    'The <strong>course length and internship</strong> meet the rules of the country where you want to practise.',
    'The course is <strong>taught in English</strong> throughout, if your home regulator requires it.',
    'The degree lets you <strong>register to practise</strong> in the country where you studied.',
    'You know which <strong>licensing exam</strong> you will need afterwards (for example USMLE, PLAB/UKMLA, AMC or FMGE/NExT).'
], true);

/* Indian applicants have extra, specific rules; keep them available without making the page India-only. */
const indiaPanel = `<details class="gp-callout">
  <summary>Applying from India? NEET and NMC rules</summary>
  ${checklist([
        '<strong>NEET-UG qualified.</strong> Required to practise in India after an MBBS abroad; the NMC currently accepts the result for three years.',
        '<strong>PCB marks:</strong> at least 50% in Physics, Chemistry and Biology (40% for SC/ST/OBC, 45% for PwD), plus English.',
        'The course runs at least <strong>54 months</strong>, followed by a <strong>12-month internship at the same university</strong>.',
        'The whole course is <strong>taught in English</strong>, and you finish within <strong>10 years</strong> of joining.',
        'After graduating: pass <strong>FMGE</strong> (to be replaced by <strong>NExT</strong>) and complete a 12-month supervised internship in India.'
    ])}
  <p class="gp-source">Source: <a href="${NMC_REGS}" target="_blank" rel="noopener noreferrer">NMC Foreign Medical Graduate Licentiate Regulations, 2021</a></p>
</details>`;

const admissionSteps = [
    ['Free counselling', 'We look at your marks, budget and plans, including where you want to practise, and explain the trade-offs honestly.'],
    ['Shortlist', 'We compare universities on recognition, clinical training, language support and the total six-year cost.'],
    ['Apply', 'We prepare and check your documents, then submit your application to the universities you choose.'],
    ['Admission letter', 'Once a university admits you, we help you check the offer and the fee schedule before you pay anything.'],
    ['Visa', 'We guide your invitation, visa file and medical tests, and prepare you for embassy steps.'],
    ['Fly and enrol', 'Pre-departure briefing, travel planning and help with hostel, registration and arrival formalities.']
];

const documents = ['School-leaving mark sheets and certificates', 'Entrance or qualifying exam scorecard, where required (NEET-UG for Indian applicants)', 'Passport (valid well beyond your travel date)', 'Passport-size photographs', 'Birth certificate (attested or apostilled if requested)', 'Medical fitness certificate, including HIV test', 'Admission letter or invitation from the university', 'Proof of fee payment and funds, as the embassy requires'];

const commonFaq = [
    ['Will my MBBS abroad be recognised at home?', 'Recognition is decided by the medical regulator in the country where you want to practise, not by the university. Most regulators require a listed university, a minimum course length with internship, and a pass in their own licensing exam. Check those rules before you apply.'],
    ['What is the World Directory of Medical Schools?', `It is the global list of medical schools that regulators such as the ECFMG (USA) rely on. Being <a href="${WDOMS}" target="_blank" rel="noopener noreferrer">listed</a> is necessary but not enough on its own: the programme you join must also meet your home regulator’s rules.`],
    ['Do I have to learn the local language?', 'Lectures are in English, but clinical training means talking to patients. Most universities teach the local language from year one, and students who take it seriously find hospital rotations much easier.']
];

function countryPage(c) {
    const others = countries.filter((o) => o.slug !== c.slug);
    const f = c.facts;
    const body = `${hero({
        crumbs: [['Home', 'index.html'], ['MBBS Abroad', 'mbbs-abroad.html'], [c.name]],
        eyebrow: `MBBS in ${c.name}`,
        title: c.headline,
        intro: c.intro,
        actions: `<a class="gp-btn gp-btn-primary" href="${mbbsConsult(c.slug)}" data-open-consult data-country="${c.slug}">Talk to an MBBS counsellor</a>
        <a class="gp-btn gp-btn-ghost" href="#fees">See fees &amp; costs</a>`,
        form: leadForm({ id: c.slug, interest: 'mbbs-abroad', country: c.slug, eyebrow: 'Free MBBS counselling', title: `Check your fit for MBBS in ${c.name}` })
    })}
<div class="gp-facts" aria-label="MBBS in ${esc(c.name)} at a glance">
  <div><span>Course length</span><strong>${esc(f.duration)}</strong></div>
  <div><span>Teaching language</span><strong>${esc(f.medium)}</strong></div>
  <div><span>Tuition (indicative)</span><strong>${esc(f.tuition)}</strong></div>
  <div><span>Living costs (indicative)</span><strong>${esc(f.living)}</strong></div>
  <div><span>Main intake</span><strong>${esc(f.intake)}</strong></div>
</div>
<nav class="gp-subnav" aria-label="On this page"><div class="gp-subnav-inner">
  <a href="#overview">Overview</a><a href="#universities">Universities</a><a href="#eligibility">Eligibility</a><a href="#admission">Admission</a><a href="#fees">Fees</a><a href="#visa">Visa</a><a href="#student-life">Student life</a><a href="#licensing">After MBBS</a><a href="#faq">FAQs</a>
</div></nav>
<main id="main">
${section({ id: 'overview', tag: `Why ${c.name}`, title: `What makes ${c.name} worth considering`, body: `${cards(c.why)}
  <p class="gp-note"><strong>Know before you go:</strong> ${esc(c.caution)}</p>` })}

${section({ id: 'universities', tag: 'Universities', title: `Medical universities in ${c.name} to look at`,
        lead: 'A starting shortlist, not a ranking. Before applying, we check each programme’s length, teaching language, internship and recognition against the rules of the country where you plan to practise.',
        body: `<div class="gp-uni-grid">
${c.universities.map(([name, city, note]) => `    <article class="gp-uni">
      <span class="gp-uni-city">${esc(city)}, ${esc(c.name)}</span>
      <h3>${esc(name)}</h3>
      <p>${esc(note)}</p>
      <a class="gp-uni-cta" href="${mbbsConsult(c.slug)}" data-open-consult data-country="${c.slug}">Apply with Gradmire <span aria-hidden="true">→</span></a>
    </article>`).join('\n')}
  </div>` })}

${section({ id: 'eligibility', tag: 'Eligibility', title: 'Who can apply', body: `<div class="gp-grid-2">
    <article class="gp-card"><h3>Typical entry requirements</h3>${eligibility}</article>
    <article class="gp-card"><h3>Checks that protect your licence</h3>${licenceChecks}</article>
  </div>
  ${indiaPanel}` })}

${section({ id: 'admission', tag: 'Admission process', title: 'How admission works, step by step', body: `${steps(admissionSteps)}
  <div class="gp-card gp-docs"><h3>Documents you’ll usually need</h3><ul>${documents.map((d) => `<li>${esc(d)}</li>`).join('')}</ul></div>` })}

${section({ id: 'fees', tag: 'Fees & living costs', title: `What MBBS in ${c.name} costs`, body: `<div class="gp-cost">
    <div class="gp-cost-item"><span>Tuition</span><strong>${esc(f.tuition)}</strong><p>Varies by university and city. Some universities charge the first year’s fee plus a one-time admission fee.</p></div>
    <div class="gp-cost-item"><span>Living costs</span><strong>${esc(f.living)}</strong><p>Hostel, food, local transport and day-to-day expenses. Capital cities cost more.</p></div>
    <div class="gp-cost-item"><span>Also budget for</span><strong>One-time costs</strong><p>Flights, visa and medical tests, insurance, document attestation and winter clothing where relevant.</p></div>
  </div>
  <p class="gp-note">These are indicative planning ranges (last reviewed ${REVIEWED}), not a quote. Fees and exchange rates change, so we confirm the current fee schedule with the university before you pay. Try the <a href="tools/roi-calculator.html">study cost calculator</a> to plan a full budget.</p>` })}

${section({ id: 'visa', tag: 'Student visa', title: `Getting your ${c.name} student visa`, lead: c.visa.summary, body: `<div class="gp-grid-2">
    <article class="gp-card"><h3>Typical visa file</h3><ul>${c.visa.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></article>
    <article class="gp-card"><h3>After you arrive</h3><p>${esc(c.visa.after)}</p></article>
  </div>
  <p class="gp-note">Visa rules depend on your nationality and change often. This is a planning summary, not legal advice. Always follow the current checklist from the embassy and your university. <a href="visa-assistance.html">See how we help with visas</a>.</p>` })}

${section({ id: 'student-life', tag: 'Student life', title: `Living in ${c.name} as an international student`, body: cards(c.life) })}

${section({ id: 'licensing', tag: 'After your MBBS', title: 'Clinical training and careers after graduation', body: cards([
        ['Practise at home', 'Most countries ask foreign medical graduates to pass a licensing exam and a period of supervised practice. Check your home regulator’s rules early.'],
        ['Practise elsewhere', 'Graduates can prepare for other countries’ licensing routes, such as the USMLE (USA), the UKMLA/PLAB (UK) or the AMC exams (Australia), each with its own eligibility rules.'],
        ['Postgraduate study', 'Specialisation options depend on where you are licensed. Plan early if you are aiming for a residency or postgraduate seat.']
    ]) })}

${section({ id: 'why-gradmire', tag: 'Why Gradmire', title: 'We help you pick a programme that keeps your options open', cls: 'gp-why', body: `<div class="gp-grid-2">
    ${checklist([
        '<strong>Recognition-first shortlisting.</strong> We check each option against the licensing rules where you plan to practise.',
        '<strong>Transparent costs.</strong> We walk you through the university’s own fee schedule, with no surprise add-ons.',
        '<strong>Documents and visa.</strong> We check every document and guide you through the invitation, visa and embassy steps.',
        '<strong>After arrival.</strong> Pre-departure briefing and help settling in, from hostel to registration.'
    ])}
    <div class="gp-compare"><h3>Comparing countries?</h3><p>See every MBBS destination side by side on one page.</p><a class="gp-btn gp-btn-primary" href="mbbs-abroad.html#compare">Compare MBBS countries</a></div>
  </div>` })}

${section({ id: 'faq', tag: 'FAQs', title: `MBBS in ${c.name}: common questions`, cls: 'gp-faq', body: faq([...c.faq, ...commonFaq]) })}

${section({ id: 'other-countries', tag: 'Other MBBS destinations', title: 'Explore more countries', body: `<div class="gp-pill-links">${others.map((o) => `<a href="mbbs-in-${o.slug}.html">MBBS in ${esc(o.name)}</a>`).join('')}</div>` })}

${cta({ title: `Not sure ${c.name} is the right fit?`, text: 'Talk through your marks, budget and goals with a Gradmire counsellor. Counselling is free and there’s no obligation.', href: mbbsConsult(c.slug), label: 'Book a free consultation', country: c.slug })}
</main>`;
    return shell({
        title: `MBBS in ${c.name}: Fees, Universities, Eligibility & Visa | Gradmire`,
        description: `Study MBBS in ${c.name}: course length, indicative fees, medical universities, entry requirements, admission steps, student visa and licensing guidance for international students.`,
        body
    });
}

function hubPage() {
    const body = `${hero({
        crumbs: [['Home', 'index.html'], ['MBBS Abroad']],
        eyebrow: 'MBBS Abroad',
        title: 'Study medicine abroad with your career plans in view.',
        intro: 'Compare nine popular MBBS destinations on course length, indicative fees and living costs. We check every option against the licensing rules of the country where you want to practise.',
        actions: `<a class="gp-btn gp-btn-primary" href="#compare">Compare countries</a>
        <a class="gp-btn gp-btn-ghost" href="#recognition">How recognition works</a>`,
        form: leadForm({ id: 'hub', interest: 'mbbs-abroad', eyebrow: 'Free MBBS counselling', title: 'Find the right country for your MBBS' })
    })}
<main id="main">
${section({ id: 'countries', tag: 'Destinations', title: 'Choose a country to explore', body: `<div class="gp-tile-grid">
${countries.map((c) => `    <a class="gp-tile" href="mbbs-in-${c.slug}.html">
      <span class="gp-tile-name">${esc(c.name)}</span>
      <span class="gp-tile-meta">${esc(c.facts.tuition)}</span>
      <span class="gp-tile-meta">${esc(c.facts.duration)}</span>
      <span class="gp-tile-go" aria-hidden="true">→</span>
    </a>`).join('\n')}
  </div>` })}

${section({ id: 'compare', tag: 'Side by side', title: 'Compare MBBS countries', body: `<div class="gp-table-wrap" tabindex="0" role="region" aria-label="MBBS country comparison table">
    <table class="gp-table">
      <thead><tr><th scope="col">Country</th><th scope="col">Course length</th><th scope="col">Tuition (indicative)</th><th scope="col">Living (indicative)</th><th scope="col">Patient language</th><th scope="col">Intake</th></tr></thead>
      <tbody>
${countries.map((c) => `        <tr><th scope="row"><a href="mbbs-in-${c.slug}.html">${esc(c.name)}</a></th><td>${esc(c.facts.duration)}</td><td>${esc(c.facts.tuition)}</td><td>${esc(c.facts.living)}</td><td>${esc(c.facts.medium.replace(/^English \((.*) for patient contact\)$/, '$1'))}</td><td>${esc(c.facts.intake)}</td></tr>`).join('\n')}
      </tbody>
    </table>
  </div>
  <p class="gp-note">Indicative planning ranges, last reviewed ${REVIEWED}. Fees vary by university and change from year to year; we confirm the current fee schedule before you apply.</p>` })}

${section({ id: 'recognition', tag: 'Recognition', title: 'Make sure your degree lets you practise where you want',
        lead: 'Recognition is decided by the medical regulator in the country where you plan to practise, so the right programme depends on your plans as much as on the university.',
        body: `<div class="gp-grid-2">
    <article class="gp-card"><h3>Checks before you apply</h3>${licenceChecks}</article>
    <article class="gp-card"><h3>Typical entry requirements</h3>${eligibility}</article>
  </div>
  ${indiaPanel}` })}

${section({ id: 'admission', tag: 'How we help', title: 'From application to your first lecture', body: steps(admissionSteps) })}

${section({ id: 'faq', tag: 'FAQs', title: 'MBBS abroad: common questions', cls: 'gp-faq', body: faq([
        ['Which country is best for MBBS abroad?', 'There is no single best country. The right choice depends on your marks, budget, where you want to practise, how comfortable you are learning a new language for patient care, and climate. Counselling helps you weigh these for your situation.'],
        ...commonFaq
    ]) })}

${cta({ title: 'Talk to an MBBS counsellor', text: 'Get a shortlist that fits your marks, budget and career plans. Counselling is free and there’s no obligation.', href: mbbsConsult(), label: 'Book a free consultation' })}
</main>`;
    return shell({
        title: 'MBBS Abroad: Compare Countries, Fees & Recognition | Gradmire',
        description: 'Compare MBBS abroad in Russia, China, Georgia, Egypt, Uzbekistan, Kazakhstan, Kyrgyzstan, Bulgaria and Moldova: course length, indicative fees, living costs and recognition.',
        body
    });
}

write('mbbs-abroad.html', hubPage());
for (const c of countries) write(`mbbs-in-${c.slug}.html`, countryPage(c));
console.log(`Built mbbs-abroad.html and ${countries.length} country pages.`);
