/* Builds the Student Services pages into frontend/pages/:
   test preparation (overview + one page per exam), visa assistance,
   application assistance and course selection guidance.
   Run from the repository root:  node scripts/build-service-pages.mjs
   Exam formats and visa summaries are planning guides; re-check them against the
   official links on each page when you update REVIEWED. */
import { esc, consultHref, shell, leadForm, hero, section, cards, steps, checklist, faq, cta, write } from './page-shell.mjs';

const REVIEWED = 'October 2026';
const ext = (href, label) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;

/* ── Exam icons (inline, theme-aware via currentColor) ── */
const icons = {
    ielts: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 9h20v14H13l-5 4v-4H6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M11 14h10M11 18h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    toefl: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 20v-3a8 8 0 0 1 16 0v3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="5" y="19" width="5" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="22" y="19" width="5" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    gre: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 12l12-6 12 6-12 6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 15v6c2 2 4.5 3 7 3s5-1 7-3v-6M28 12v7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    gmat: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 25V15M13 25V9M20 25v-8M27 25V6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M4 27h24" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
};

const exams = [
    {
        slug: 'ielts', name: 'IELTS', full: 'International English Language Testing System',
        forWhat: 'English test for study, work and migration, accepted across the UK, Australia, Canada, New Zealand, Ireland and many US universities.',
        headline: 'Prepare for IELTS with a plan built around your target band.',
        intro: 'IELTS Academic is the English test most universities ask for. We start with a diagnostic test, find the skills holding your band back, and coach you to the score your universities need.',
        facts: [['Duration', 'About 2 hrs 45 min'], ['Score', 'Band 0–9 (in 0.5 steps)'], ['Sections', 'Listening, Reading, Writing, Speaking'], ['Valid for', 'Usually 2 years'], ['Format', 'Paper or computer at a test centre']],
        format: [
            ['Listening', '30 min', 'Four recordings with 40 questions: conversations and talks in everyday and academic settings.'],
            ['Reading', '60 min', 'Three long passages with 40 questions (Academic uses texts from books, journals and newspapers).'],
            ['Writing', '60 min', 'Task 1: describe a chart, table or process (150 words). Task 2: an essay (250 words).'],
            ['Speaking', '11–14 min', 'A face-to-face interview with an examiner, in three parts.']
        ],
        scoring: 'Each skill gets a band from 0 to 9; the overall band is the average. Universities usually set an overall band and a minimum per skill, for example 6.5 overall with no band below 6.0.',
        accepted: 'Universities and immigration authorities in the UK, Australia, Canada, New Zealand and Ireland, plus most US universities. Some UK visas need the separate “IELTS for UKVI” version, so check before you book.',
        tips: [
            ['Diagnostic first', 'A full mock test shows which skill is costing you the most bands, so practice time goes where it counts.'],
            ['Writing feedback', 'Marked essays with band-descriptor feedback on task response, coherence, vocabulary and grammar.'],
            ['Speaking practice', 'Mock interviews that build fluency and help you extend answers naturally in Part 2 and 3.'],
            ['Timed practice', 'Full-length, timed tests so the real exam’s pace feels familiar.']
        ],
        book: ext('https://ielts.org/', 'ielts.org'),
        faq: [
            ['Academic or General Training?', 'Choose IELTS Academic for university study. General Training is mainly for work and migration.'],
            ['How soon do I get results?', 'Computer-delivered results usually arrive within a few days; paper-based results take about 13 days. Check the current timing when you book.'],
            ['Can I retake just one skill?', 'In some locations IELTS offers a One Skill Retake for computer-delivered tests. Check whether it is available at your test centre and accepted by your universities.']
        ]
    },
    {
        slug: 'toefl', name: 'TOEFL', full: 'Test of English as a Foreign Language (iBT)',
        forWhat: 'Computer-based English test from ETS, widely accepted by universities in the USA, Canada and around the world.',
        headline: 'Get the TOEFL score your universities need.',
        intro: 'TOEFL iBT is a computer-based academic English test, popular for US and Canadian admissions. We coach all four skills with practice in the same on-screen, adaptive format.',
        facts: [['Duration', 'About 1.5 hours'], ['Score', '1–6 bands (0–120 also reported)'], ['Sections', 'Reading, Listening, Writing, Speaking'], ['Valid for', '2 years'], ['Format', 'Computer, at a centre or at home']],
        format: [
            ['Reading', 'Adaptive', 'Academic and everyday texts. The second part adapts to how you did in the first.'],
            ['Listening', 'Adaptive', 'Lectures, conversations and announcements, also adapting to your performance.'],
            ['Writing', 'Timed', 'Typed tasks, including writing for an academic discussion.'],
            ['Speaking', 'Timed', 'Short spoken responses recorded on the computer.']
        ],
        scoring: 'Since 21 January 2026, each section and the overall score are reported on a 1–6 scale in half-band steps, aligned with CEFR levels. Score reports also show the familiar 0–120 scale during a transition period of about two years, so check which score your universities ask for.',
        accepted: 'Universities across the USA and Canada, and many in the UK, Europe and Australia. Visa acceptance varies by country, so check before you rely on it for a visa.',
        tips: [
            ['On-screen practice', 'Every practice test runs on a computer, so typing, note-taking and timing feel natural on test day.'],
            ['Adaptive sections', 'How the adaptive Reading and Listening sections work, and how to pace them.'],
            ['Speaking templates', 'Clear structures for short timed answers, practised until they feel natural.'],
            ['Score targeting', 'We map each university’s requirement to a section-by-section target.']
        ],
        book: ext('https://www.ets.org/toefl.html', 'ets.org/toefl'),
        faq: [
            ['Can I take TOEFL at home?', 'Yes. The TOEFL iBT Home Edition has the same content, taken online with a remote proctor. Check that your universities accept it.'],
            ['Is TOEFL or IELTS better?', 'Neither is easier for everyone. TOEFL is fully computer-based; IELTS has a face-to-face speaking test. We help you choose based on your universities and your strengths.']
        ]
    },
    {
        slug: 'gre', name: 'GRE', full: 'Graduate Record Examinations (General Test)',
        forWhat: 'Graduate admissions test for master’s and PhD programmes, especially in the USA, and accepted by many business schools.',
        headline: 'Raise your GRE score with focused Quant and Verbal coaching.',
        intro: 'The GRE General Test measures verbal reasoning, quantitative reasoning and analytical writing. We build a study plan from a diagnostic test and target the question types that move your score fastest.',
        facts: [['Duration', 'About 1 hr 58 min'], ['Score', 'Verbal & Quant 130–170 each; Writing 0–6'], ['Sections', 'Analytical Writing, Verbal, Quant'], ['Valid for', '5 years'], ['Format', 'Computer, at a centre or at home']],
        format: [
            ['Analytical Writing', '30 min', 'One “Analyze an Issue” essay.'],
            ['Verbal Reasoning', '41 min', 'Two sections, 27 questions: reading comprehension, text completion and sentence equivalence.'],
            ['Quantitative Reasoning', '47 min', 'Two sections, 27 questions: arithmetic, algebra, geometry and data analysis. An on-screen calculator is provided.']
        ],
        scoring: 'Verbal and Quantitative are each scored 130–170 in 1-point steps; Analytical Writing is scored 0–6 in half-point steps. With ScoreSelect you choose which test dates to send.',
        accepted: 'Master’s and PhD programmes worldwide, especially in the USA, and a growing number of business schools as an alternative to the GMAT.',
        tips: [
            ['Quant foundations', 'Rebuild core maths first, then practise the GRE’s data-interpretation and quantitative-comparison styles.'],
            ['Vocabulary in context', 'Learn high-frequency words through reading, not lists alone.'],
            ['Section-adaptive strategy', 'How the second section adapts to the first, and how to pace both.'],
            ['Essay practice', 'Timed Issue essays with feedback on argument and structure.']
        ],
        book: ext('https://www.ets.org/gre.html', 'ets.org/gre'),
        faq: [
            ['Do all master’s programmes need the GRE?', 'No. Many have made it optional, but a strong score can still help, especially for competitive STEM programmes or scholarships.'],
            ['How long should I prepare?', 'Most students prepare for 6–12 weeks, depending on their starting score and target.']
        ]
    },
    {
        slug: 'gmat', name: 'GMAT', full: 'Graduate Management Admission Test (Focus Edition)',
        forWhat: 'Admissions test for MBA and business master’s programmes worldwide.',
        headline: 'Prepare for the GMAT Focus Edition with a clear score target.',
        intro: 'The GMAT Focus Edition tests quantitative, verbal and data-analysis reasoning for business school admissions. We coach the reasoning behind each question type, not just shortcuts.',
        facts: [['Duration', '2 hrs 15 min'], ['Score', '205–805'], ['Sections', 'Quant, Verbal, Data Insights'], ['Valid for', '5 years'], ['Format', 'Computer, at a centre or online']],
        format: [
            ['Quantitative Reasoning', '45 min', '21 problem-solving questions on arithmetic and algebra. No calculator.'],
            ['Verbal Reasoning', '45 min', '23 questions on reading comprehension and critical reasoning.'],
            ['Data Insights', '45 min', '20 questions interpreting tables, graphs and multi-source data. An on-screen calculator is available.']
        ],
        scoring: 'The total score runs from 205 to 805, with a score for each section. You can review and change up to three answers per section, and choose the order of the sections.',
        accepted: 'MBA, Master in Management, finance and business analytics programmes at business schools worldwide.',
        tips: [
            ['Data Insights focus', 'The newest section, and often the least practised. We build the table and graph skills it needs.'],
            ['Critical reasoning', 'A repeatable method for strengthen, weaken and assumption questions.'],
            ['Section order strategy', 'Choosing the section order that suits your strengths.'],
            ['Review and edit', 'Using the review-and-edit feature wisely without losing time.']
        ],
        book: ext('https://www.mba.com/exams/gmat-exam', 'mba.com'),
        faq: [
            ['GMAT or GRE for an MBA?', 'Most business schools accept both. The GMAT is built for business school; the GRE suits applicants also considering non-business programmes. We help you choose.'],
            ['Is there an essay?', 'No. The GMAT Focus Edition has no essay section.']
        ]
    }
];

const examPills = (current) => `<div class="gp-pill-links">${exams.filter((e) => e.slug !== current).map((e) => `<a href="test-prep-${e.slug}">${e.name} preparation</a>`).join('')}<a href="test-preparation">All tests</a></div>`;

function testPrepOverview() {
    const body = `${hero({
        crumbs: [['Home', './'], ['Test preparation']],
        eyebrow: 'Test preparation',
        title: 'Coaching for the tests that open university doors.',
        intro: 'English proficiency and graduate admissions tests are often the first hurdle in an application. We coach IELTS, TOEFL, GRE and GMAT with diagnostic tests, personalised study plans and full-length practice.',
        actions: `<a class="gp-btn gp-btn-primary" href="#exams">Choose your test</a>
        <a class="gp-btn gp-btn-ghost" href="#which-test">Which test do I need?</a>`,
        form: leadForm({ id: 'test-prep', interest: 'test-preparation', eyebrow: 'Free counselling', title: 'Get a study plan for your test' })
    })}
<main id="main">
${section({ id: 'exams', tag: 'Tests we coach', title: 'Choose your test', body: `<div class="gp-exam-grid">
${exams.map((e) => `    <a class="gp-exam" href="test-prep-${e.slug}">
      <span class="gp-exam-icon">${icons[e.slug]}</span>
      <span class="gp-exam-name">${e.name}</span>
      <span class="gp-exam-full">${esc(e.full)}</span>
      <span class="gp-exam-text">${esc(e.forWhat)}</span>
      <span class="gp-exam-meta">${esc(e.facts[0][1])} · ${esc(e.facts[1][1])}</span>
      <span class="gp-exam-go">Explore ${e.name} <span aria-hidden="true">→</span></span>
    </a>`).join('\n')}
  </div>
  <p class="gp-note">Also preparing for PTE Academic or the Duolingo English Test? <a href="${consultHref('test-preparation')}">Ask a counsellor</a> which test suits your universities.</p>` })}

${section({ id: 'which-test', tag: 'Which test?', title: 'Which test do I need?', lead: 'Your universities decide. As a rule of thumb:', body: cards([
        ['English-taught bachelor’s or master’s', 'An English proficiency test such as IELTS Academic or TOEFL iBT, unless you qualify for an exemption.'],
        ['Master’s or PhD in the USA', 'Often the GRE, plus an English test. Many programmes have made the GRE optional, so check each one.'],
        ['MBA or business master’s', 'The GMAT, or the GRE where accepted, plus an English test.']
    ]) })}

${section({ id: 'how-it-works', tag: 'How coaching works', title: 'From diagnostic test to exam day', body: steps([
        ['Diagnostic test', 'A full-length mock test to find your starting score and the skills to work on.'],
        ['Personal study plan', 'A week-by-week plan built around your test date and target score.'],
        ['Guided sessions', 'Strategy and practice for every section, with doubts cleared as you go.'],
        ['Practice tests', 'Timed, full-length tests to build stamina and track progress.'],
        ['Feedback', 'Detailed feedback on writing and speaking, scored against the official criteria.'],
        ['Booking and exam day', 'Help choosing a test date that fits your application deadlines.']
    ]) })}

${section({ id: 'faq', tag: 'FAQs', title: 'Test preparation: common questions', cls: 'gp-faq', body: faq([
        ['When should I take my test?', 'Aim to have your score at least 2–3 months before your earliest application deadline, so there is time for a retake if needed.'],
        ['Do I need a test if I studied in English?', 'Some universities waive English tests for students taught in English, but many do not, and visas can have their own rules. Check each university and your visa requirements.'],
        ['Where do I book the exam?', 'You book directly with the test provider. Each test page links to the official booking site.']
    ]) })}

${cta({ title: 'Not sure where to start?', text: 'Tell us your universities and timeline, and we’ll recommend the right test and a realistic study plan.', href: consultHref('test-preparation'), label: 'Book a free consultation' })}
</main>`;
    return shell({
        title: 'Test Preparation: IELTS, TOEFL, GRE & GMAT Coaching | Gradmire',
        description: 'IELTS, TOEFL, GRE and GMAT preparation with diagnostic tests, personalised study plans, full-length practice and feedback, from Gradmire.',
        body
    });
}

function examPage(e) {
    const body = `${hero({
        crumbs: [['Home', './'], ['Test preparation', 'test-preparation'], [e.name]],
        eyebrow: `${e.name} preparation`,
        title: e.headline,
        intro: e.intro,
        actions: `<a class="gp-btn gp-btn-primary" href="#crack-${e.slug}">Start preparing</a>
        <a class="gp-btn gp-btn-ghost" href="#format">See the test format</a>`,
        form: `<div id="crack-${e.slug}">${leadForm({ id: e.slug, interest: 'test-preparation', exam: e.name, eyebrow: 'Free demo & study plan', title: `Crack ${e.name} with Gradmire`, button: 'Get my study plan' })}</div>`
    })}
<div class="gp-facts" aria-label="${e.name} at a glance">
${e.facts.map(([k, v]) => `  <div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('\n')}
</div>
<main id="main">
${section({ id: 'format', tag: 'Test format', title: `What the ${e.name} tests`, lead: e.full, body: `<div class="gp-table-wrap" tabindex="0" role="region" aria-label="${e.name} sections">
    <table class="gp-table gp-table--compact">
      <thead><tr><th scope="col">Section</th><th scope="col">Time</th><th scope="col">What it covers</th></tr></thead>
      <tbody>
${e.format.map(([name, time, what]) => `        <tr><th scope="row">${esc(name)}</th><td>${esc(time)}</td><td>${esc(what)}</td></tr>`).join('\n')}
      </tbody>
    </table>
  </div>` })}

${section({ id: 'scoring', tag: 'Scores', title: 'Scoring and who accepts it', body: cards([['How it’s scored', e.scoring], ['Who accepts it', e.accepted]], 2) })}

${section({ id: 'coaching', tag: 'How we prepare you', title: `Our ${e.name} coaching`, body: cards(e.tips, 2) })}

${section({ id: 'faq', tag: 'FAQs', title: `${e.name}: common questions`, cls: 'gp-faq', body: `${faq([...e.faq, ['Where do I book the test?', `Book directly with the test provider at ${e.book}. We help you pick a date that fits your application deadlines.`]])}
  <p class="gp-note">Formats, fees and timings change. This summary was last reviewed in ${REVIEWED}; always confirm the current details at ${e.book} before you book.</p>` })}

${section({ id: 'other-tests', tag: 'Other tests', title: 'Preparing for another test?', body: examPills(e.slug) })}

${cta({ title: `Ready to crack ${e.name}?`, text: 'Book a free session: we’ll assess your level and build a plan around your target score and test date.', href: `${consultHref('test-preparation')}`.replace('#book', `&amp;exam=${e.slug}#book`), label: 'Book a free session', exam: e.name })}
</main>`;
    return shell({
        title: `${e.name} Preparation: Format, Scores & Coaching | Gradmire`,
        description: `${e.name} preparation with Gradmire: test format, scoring, who accepts it, and coaching with diagnostic tests, study plans and practice tests.`,
        body
    });
}

/* ── Visa assistance ── */
const visaCountries = [
    ['United Kingdom', 'Student visa', 'CAS from your university, proof of funds held for 28 days, TB test where required, and the Immigration Health Surcharge.', 'https://www.gov.uk/student-visa', 'study-in-uk.html'],
    ['United States', 'F-1 student visa', 'Form I-20 from your university, SEVIS fee, DS-160 form and a visa interview at the US embassy or consulate.', 'https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html', 'study-in-usa.html'],
    ['Canada', 'Study permit', 'Letter of acceptance, a provincial or territorial attestation letter where required, proof of funds and biometrics.', 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit.html', 'study-in-canada.html'],
    ['Australia', 'Student visa (subclass 500)', 'Confirmation of Enrolment (CoE), Genuine Student requirement, proof of funds, English test and Overseas Student Health Cover.', 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500', 'study-in-australia.html'],
    ['Germany', 'National (D) visa for study', 'Admission letter, blocked account or other proof of funds, health insurance and, for some nationalities, an APS certificate.', 'https://www.make-it-in-germany.com/en/visa-residence/types/studying', 'study-in-germany.html'],
    ['Ireland', 'Study visa (Stamp 2)', 'Letter of acceptance, proof of fees paid, evidence of funds and private medical insurance.', 'https://www.irishimmigration.ie/coming-to-study-in-ireland/', 'study-in-ireland.html'],
    ['New Zealand', 'Student visa', 'Offer of place, proof of tuition payment and living funds, plus health and character requirements.', 'https://www.immigration.govt.nz/new-zealand-visas/visas/visa/student-visa', 'study-in-newzealand.html'],
    ['Italy', 'Type D study visa', 'Pre-enrolment through Universitaly, proof of funds and accommodation, and health insurance.', 'https://www.universitaly.it/', 'study-in-italy.html'],
    ['Finland', 'Residence permit for studies', 'Admission letter, proof of funds, insurance meeting Migri’s rules, and an online application through Enter Finland.', 'https://migri.fi/en/residence-permit-application-for-studies', 'study-in-finland.html']
];

function visaPage() {
    const body = `${hero({
        crumbs: [['Home', './'], ['Visa assistance']],
        eyebrow: 'Visa assistance',
        title: 'A complete, well-prepared student visa application.',
        intro: 'A student visa decision rests on your documents: funds, admission, ties and intent. We help you understand what your destination asks for, organise the evidence, and walk into your interview prepared.',
        actions: `<a class="gp-btn gp-btn-primary" href="${consultHref('visa-assistance')}" data-open-consult>Talk to a visa counsellor</a>
        <a class="gp-btn gp-btn-ghost" href="#countries">Visas by country</a>`,
        form: leadForm({ id: 'visa', interest: 'visa-assistance', eyebrow: 'Free visa consultation', title: 'Get your visa file checked' })
    })}
<main id="main">
${section({ id: 'what-we-do', tag: 'What we do', title: 'How we support your visa application', body: cards([
        ['Eligibility check', 'We review your admission, finances and history, and flag risks before you apply.'],
        ['Document checklist', 'A checklist for your destination and situation, so nothing is missing or out of date.'],
        ['Financial documents', 'Guidance on bank statements, sponsorship letters and education-loan sanction letters, presented clearly.'],
        ['Application filing', 'Help completing forms accurately and booking biometrics or appointments.'],
        ['Interview preparation', 'Mock interviews and practice on the questions officers commonly ask about your course, funding and plans.'],
        ['Pre-departure', 'Once your visa is granted: travel, accommodation, insurance and arrival registration checklists.']
    ]) })}

${section({ id: 'process', tag: 'Process', title: 'Our visa process', body: steps([
        ['Consultation', 'We go through your offer, timeline and any previous refusals or gaps.'],
        ['Checklist', 'You receive a personalised list of documents for your destination.'],
        ['Document review', 'We check every document for consistency, validity and completeness.'],
        ['Application', 'We guide you through the online form, fees and appointment booking.'],
        ['Biometrics or interview', 'Mock interviews and a final review before your appointment.'],
        ['Decision and travel', 'After the decision, we help you plan travel and arrival steps.']
    ]) })}

${section({ id: 'countries', tag: 'Visas by country', title: 'What each destination asks for', lead: 'A summary of the main student visa routes. Requirements depend on your nationality and change often, so always use the official checklist.', body: `<div class="gp-visa-grid">
${visaCountries.map(([country, route, need, official, page]) => `    <article class="gp-visa">
      <h3>${esc(country)}</h3>
      <span class="gp-visa-route">${esc(route)}</span>
      <p>${esc(need)}</p>
      <div class="gp-visa-links"><a href="${official}" target="_blank" rel="noopener noreferrer">Official guidance</a><a href="${page}">Study in ${esc(country)}</a></div>
    </article>`).join('\n')}
  </div>
  <p class="gp-note">Last reviewed ${REVIEWED}. This is a planning summary, not legal or immigration advice; the official government guidance always takes precedence. Gradmire does not guarantee visa outcomes, which are decided by the immigration authorities.</p>` })}

${section({ id: 'mistakes', tag: 'Avoid refusals', title: 'Common reasons applications go wrong', body: cards([
        ['Unclear funds', 'Funds that don’t meet the required amount or holding period, or large unexplained deposits.'],
        ['Inconsistent details', 'Dates, names or study plans that don’t match across documents and forms.'],
        ['Weak study plan', 'Not being able to explain why this course, this university and this country fit your goals.'],
        ['Late applications', 'Applying too close to your course start, leaving no time for delays or extra checks.']
    ], 2) })}

${section({ id: 'faq', tag: 'FAQs', title: 'Visa assistance: common questions', cls: 'gp-faq', body: faq([
        ['When should I apply for my visa?', 'As soon as you have the document your destination requires (such as a CAS, I-20, CoE or letter of acceptance) and your funds are ready. Processing times vary by country and season.'],
        ['Can you guarantee my visa?', 'No one can. Decisions are made by the immigration authorities. We help you submit a complete, consistent application and prepare well for any interview.'],
        ['I had a visa refused before. Can you help?', 'Yes. We review the refusal reasons and help you address them before you reapply.']
    ]) })}

${cta({ title: 'Get your visa application right first time', text: 'Talk to a Gradmire counsellor about your destination, documents and timeline.', href: consultHref('visa-assistance'), label: 'Book a free visa consultation' })}
</main>`;
    return shell({
        title: 'Student Visa Assistance: UK, USA, Canada, Australia & More | Gradmire',
        description: 'Student visa help from Gradmire: eligibility checks, document checklists, financial evidence, application filing and interview preparation for major study destinations.',
        body
    });
}

/* ── Application assistance ── */
function applicationPage() {
    const body = `${hero({
        crumbs: [['Home', './'], ['Application assistance']],
        eyebrow: 'Application assistance',
        title: 'Strong, on-time applications to the right universities.',
        intro: 'From shortlisting to accepting your offer, we help you build applications that show who you are: clear statements of purpose, well-chosen references and complete documents, sent before every deadline.',
        actions: `<a class="gp-btn gp-btn-primary" href="${consultHref('application-support')}" data-open-consult>Talk to an application counsellor</a>
        <a class="gp-btn gp-btn-ghost" href="#process">See how it works</a>`,
        form: leadForm({ id: 'application', interest: 'application-support', eyebrow: 'Free application review', title: 'Start your application with an expert' })
    })}
<main id="main">
${section({ id: 'what-we-do', tag: 'What we help with', title: 'Every part of your application', body: cards([
        ['University shortlist', 'A balanced list of ambitious, target and safer choices that match your profile, budget and goals.'],
        ['Statement of purpose', 'We help you plan, structure and refine your SOP or personal statement. The story and the words stay yours.'],
        ['Recommendation letters', 'Advice on choosing referees and briefing them on what admissions teams look for.'],
        ['CV and portfolio', 'An academic CV that highlights the right experience, and portfolio guidance for creative courses.'],
        ['Forms and portals', 'Help with university portals and systems such as UCAS, Common App and uni-assist.'],
        ['Offers and next steps', 'Comparing offers, meeting conditions, paying deposits and getting your CAS, I-20 or CoE.']
    ]) })}

${section({ id: 'process', tag: 'Process', title: 'How application support works', body: steps([
        ['Profile review', 'We look at your academics, test scores, experience and goals.'],
        ['Shortlist', 'Together we agree the universities and courses you’ll apply to.'],
        ['Document plan', 'A checklist and timeline for every application, working back from each deadline.'],
        ['Drafting and review', 'Rounds of feedback on your SOP, CV and other written material.'],
        ['Submission', 'A final check of every form and upload before you submit.'],
        ['Offers', 'Help understanding offers, meeting conditions and accepting your place.']
    ]) })}

${section({ id: 'documents', tag: 'Documents', title: 'What you’ll usually need', body: `<div class="gp-grid-2">
    <article class="gp-card"><h3>Undergraduate applications</h3><ul><li>Class 10 and 12 (or equivalent) mark sheets</li><li>English test score, unless exempt</li><li>Personal statement</li><li>One or two references</li><li>Passport copy</li></ul></article>
    <article class="gp-card"><h3>Postgraduate applications</h3><ul><li>Degree transcripts and certificates</li><li>English test score; GRE or GMAT where required</li><li>Statement of purpose</li><li>Two or three references</li><li>CV, plus portfolio or work experience letters where relevant</li></ul></article>
  </div>
  <p class="gp-note">Track every deadline in one place with the <a href="tools/deadline-tracker">deadline tracker</a>.</p>` })}

${section({ id: 'faq', tag: 'FAQs', title: 'Application assistance: common questions', cls: 'gp-faq', body: faq([
        ['Will you write my SOP for me?', 'No. Admissions teams want your own voice, and many check for authenticity. We help you plan, structure and improve your own writing.'],
        ['How many universities should I apply to?', 'Usually five to eight, balanced between ambitious, target and safer choices. The right number depends on the country and course.'],
        ['When should I start?', 'Ideally 9–12 months before your intended start date, so there is time for tests, documents and early deadlines.']
    ]) })}

${cta({ title: 'Ready to start your applications?', text: 'Book a free session to review your profile and build your application plan.', href: consultHref('application-support'), label: 'Book a free consultation' })}
</main>`;
    return shell({
        title: 'University Application Assistance: SOP, LOR & Submissions | Gradmire',
        description: 'University application support from Gradmire: shortlisting, statement of purpose guidance, references, CV, forms and portals, deadlines and offers.',
        body
    });
}

/* ── Course selection guidance ── */
function courseSelectionPage() {
    const body = `${hero({
        crumbs: [['Home', './'], ['Course selection guidance']],
        eyebrow: 'Course selection guidance',
        title: 'Choose a course that fits your goals, not just a ranking.',
        intro: 'The right course balances what you enjoy, where you want your career to go, what you can afford and where you can get in. We help you weigh all four before you apply.',
        actions: `<a class="gp-btn gp-btn-primary" href="${consultHref('course-selection')}" data-open-consult>Talk to a course counsellor</a>
        <a class="gp-btn gp-btn-ghost" href="find-courses">Browse the Course Finder</a>`,
        form: leadForm({ id: 'course-selection', interest: 'course-selection', eyebrow: 'Free course guidance', title: 'Find the right course for you' })
    })}
<main id="main">
${section({ id: 'factors', tag: 'What we look at', title: 'The factors behind a good course choice', body: cards([
        ['Your interests and strengths', 'Subjects you enjoy and do well in, from your academic record and experience.'],
        ['Career goals', 'Where the course leads: typical roles, accreditation and the industries that hire graduates.'],
        ['Course content', 'Modules, specialisations, projects, placements and internships, not just the course title.'],
        ['Entry requirements', 'Academic, English and test requirements, so your shortlist is realistic.'],
        ['Cost and return', 'Tuition, living costs and likely earnings, compared over the full course.'],
        ['Post-study options', 'Post-study work rights and pathways in each destination.']
    ]) })}

${section({ id: 'process', tag: 'Process', title: 'How we guide your choice', body: steps([
        ['Discovery session', 'We talk through your interests, strengths, goals and constraints.'],
        ['Explore options', 'We map subjects and course types that fit, including some you may not have considered.'],
        ['Compare courses', 'Side-by-side comparison of curriculum, outcomes, costs and entry requirements.'],
        ['Shortlist', 'A balanced shortlist of ambitious, target and safer options.'],
        ['Decide', 'A final review so you can apply with confidence.']
    ]) })}

${section({ id: 'tools', tag: 'Tools', title: 'Explore on your own too', body: cards([
        ['Course Finder', 'Search sample courses by subject, level and country. <a href="find-courses">Open the Course Finder</a>'],
        ['Course Comparator', 'Compare up to three courses side by side. <a href="tools/comparator">Compare courses</a>'],
        ['Study cost calculator', 'Estimate the total cost of a course and when it pays back. <a href="tools/roi-calculator">Calculate costs</a>']
    ]) })}

${section({ id: 'faq', tag: 'FAQs', title: 'Course selection: common questions', cls: 'gp-faq', body: faq([
        ['Should I choose the course or the country first?', 'Usually the course. Your subject and career goals narrow down the countries and universities that suit you, and the destination follows.'],
        ['Are rankings important?', 'They are one signal. Course content, accreditation, location, cost and graduate outcomes often matter more for your career.'],
        ['Can I switch fields for a master’s?', 'Often, yes. Some master’s programmes are designed for career changers, while others need a related degree. We help you find realistic options.']
    ]) })}

${cta({ title: 'Not sure which course is right?', text: 'Book a free session and leave with a shortlist that fits your goals and budget.', href: consultHref('course-selection'), label: 'Book a free consultation' })}
</main>`;
    return shell({
        title: 'Course Selection Guidance: Choose the Right Course Abroad | Gradmire',
        description: 'Course selection guidance from Gradmire: compare course content, careers, entry requirements, costs and post-study options to choose the right course abroad.',
        body
    });
}

write('test-preparation.html', testPrepOverview());
for (const e of exams) write(`test-prep-${e.slug}.html`, examPage(e));
write('visa-assistance.html', visaPage());
write('application-assistance.html', applicationPage());
write('course-selection-guidance.html', courseSelectionPage());
console.log(`Built ${4 + exams.length} Student Services pages.`);
