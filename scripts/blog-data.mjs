/* Content for the 2027 study-abroad articles (built by build-blog-pages.mjs into frontend/pages/<slug>.html).

   Sourcing rules (docs/rules.md section 3 and docs/claims-source-of-truth.md):
   - No invented fees, visa rules, salaries, scholarship amounts, statistics, authors or testimonials.
   - The only hard dates are the UCAS 2027 entry deadlines, read on ucas.com on 10 November 2026.
   - Test validity and the TOEFL scoring change repeat what test-prep-*.html already say.
   - Intake months are "typical" and mirror the country guides; every article tells readers to confirm on the official source.
   - Scholarship and MBBS facts come from scholarship-data.mjs and mbbs-data.mjs.
   Re-review all of it before 10 May 2027 (six months, per rules.md 3.3). */
import { esc, rich, checklist } from './page-shell.mjs';
import { countries as mbbsCountries } from './mbbs-data.mjs';

export const PUBLISHED = '2026-11-10';
export const MODIFIED = '2026-11-10';
export const REVIEWED_LABEL = '10 November 2026';

const VERIFY = `Dates, fees and visa rules change. We last reviewed this guide on ${REVIEWED_LABEL}. Confirm every date and requirement on the official source before you apply or pay anything.`;
const link = (href, label) => `<a href="${href}">${label}</a>`;
const ext = (href, label) => `<a href="${href}" rel="noopener" target="_blank">${label}</a>`;

/* Table that scrolls on desktop and stacks into labelled cards on phones (see blog.css). */
const table = (label, head, rows) => `<div class="gp-table-wrap" tabindex="0" role="region" aria-label="${esc(label)}">
    <table class="gp-table gp-table--compact gp-table--stack">
      <thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead>
      <tbody>
${rows.map((r) => `        <tr><th scope="row">${r[0]}</th>${r.slice(1).map((c, i) => `<td data-label="${esc(head[i + 1])}">${c}</td>`).join('')}</tr>`).join('\n')}
      </tbody>
    </table>
  </div>`;
/* Local card and step builders: the shared ones escape HTML, and these bodies carry links and lists we wrote ourselves. */
const cards = (items, cols = 3) => `<div class="gp-grid-${cols}">
${items.map(([t, p]) => `    <article class="gp-card"><h3>${esc(t)}</h3>${p.startsWith('<ul>') ? p : `<p>${rich(p)}</p>`}</article>`).join('\n')}
  </div>`;
const steps = (items) => `<ol class="gp-steps">
${items.map(([t, p]) => `    <li><h3>${esc(t)}</h3><p>${rich(p)}</p></li>`).join('\n')}
  </ol>`;
const note = (html) => `<p class="gp-note">${html}</p>`;
const pills = (items) => `<div class="gp-pill-links">${items.map(([href, label]) => `<a href="${href}">${esc(label)}</a>`).join('')}</div>`;

const COUNTRY_GUIDES = [
    ['study-in-uk', 'UK'], ['study-in-usa', 'USA'], ['study-in-canada', 'Canada'], ['study-in-australia', 'Australia'],
    ['study-in-germany', 'Germany'], ['study-in-ireland', 'Ireland'], ['study-in-newzealand', 'New Zealand'],
    ['study-in-italy', 'Italy'], ['study-in-finland', 'Finland']
];

const RELATED_ALL = {
    pillar: ['study-abroad-2027', 'Study abroad in 2027: the plan'],
    intakes: ['study-abroad-intakes-2027', '2027 intakes by country'],
    countries: ['best-countries-to-study-abroad-2027', 'Best countries for 2027'],
    scholarships: ['study-abroad-scholarships-2027', 'Scholarships for 2027'],
    checklist: ['study-abroad-checklist-2027', '2027 checklist'],
    tests: ['study-abroad-tests-2027', 'Tests for 2027'],
    mbbs: ['mbbs-abroad-2027', 'MBBS abroad in 2027']
};
const relatedFor = (...keys) => keys.map((k) => RELATED_ALL[k]);

export const posts = [
    /* ───────────────────────────── 1. Pillar ───────────────────────────── */
    {
        slug: 'study-abroad-2027',
        category: 'Planning',
        title: 'Study Abroad 2027: Intakes, Timeline and Plan | Gradmire',
        description: 'Planning to study abroad in 2027? Choose your intake, follow a month-by-month plan from November 2026, and compare countries, tests and scholarships.',
        eyebrow: '2027 intake guide',
        h1: 'Study abroad in 2027: the plan for Indian students',
        intro: 'If you want to start a degree abroad in 2027, the decisions that matter most are happening now: which intake to aim for, which tests to book and which countries to shortlist. This guide puts them in order, starting from November 2026.',
        keywords: ['study abroad 2027', '2027 intake', 'fall 2027', 'september 2027 intake', 'study abroad for Indian students 2027'],
        readMins: 7,
        cardExcerpt: 'The pillar guide: pick your 2027 intake, follow a month-by-month plan and shortlist countries.',
        sections: [
            {
                id: 'summary', tag: 'The short version', title: 'What to know before you start',
                body: `${cards([
                    ['Most 2027 starts are in autumn', 'For the UK, USA, Canada, Ireland, Germany, Italy and Finland the main start is usually September or October 2027. Australia and New Zealand start in February and July.'],
                    ['Some early-2027 intakes are closing now', 'January starts in the UK, USA and Canada, and February starts in Australia and New Zealand, often have application windows that close around now. Ask each university whether it still accepts applications.'],
                    ['Work backwards from the deadline', 'Tests come first because scores take time to arrive. Then shortlist, documents, applications, funding and the visa. The plan below shows the order.']
                ], 3)}
  ${note(`<strong>Check before you rely on this.</strong> ${VERIFY}`)}`
            },
            {
                id: 'intakes', tag: 'Intakes', title: 'Which 2027 intake are you aiming for?',
                lead: `Each country runs its own calendar, and every university sets its own deadlines. Here is how the 2027 year breaks down. For each country in detail, see our ${link('study-abroad-intakes-2027', '2027 intakes guide')}.`,
                body: table('2027 intake windows', ['Intake', 'Common in', 'What to do from November 2026'], [
                    ['Early 2027 (January to March)', 'USA spring, Canada January, UK January (select master’s degrees), Australia and New Zealand February or March', 'Ask admissions today whether applications are still open. If they are not, move to a later 2027 intake instead of rushing your documents.'],
                    ['Spring and mid-2027 (April to August)', 'Australia and New Zealand July, some Canadian college programmes in May, Germany’s summer semester in April (fewer programmes)', 'Book your English test now and apply in the first half of 2027.'],
                    ['Autumn 2027 (August to October)', 'UK, USA, Canada, Ireland, Germany (winter semester), Italy, Finland', 'The main target for most students. Early deadlines and scholarship rounds fall this winter, so start now.']
                ])
            },
            {
                id: 'timeline', tag: 'Timeline', title: 'A month-by-month plan from November 2026',
                lead: 'Use this as a skeleton and move the dates to match your own universities. The detailed document list is in the 2027 checklist.',
                body: `${steps([
                    ['November to December 2026: decide and test', 'Fix your budget, pick two or three countries and book your English test, plus the GRE or GMAT if your course asks for it. Ask your referees for recommendation letters early.'],
                    ['January to February 2027: shortlist and apply early', 'Finish a shortlist of courses and universities. Submit applications for any early-2027 deadlines and early autumn rounds. Draft your statement of purpose and get it reviewed.'],
                    ['March to April 2027: apply and fund', 'Submit your remaining applications. Apply for university scholarships alongside the course, because many close with the application. Prepare proof of funds and any education loan paperwork.'],
                    ['May to June 2027: offers and decisions', 'Compare offers on cost, course content and scholarships. Accept one offer, pay the deposit it asks for, and request the visa document your country uses, for example a UK CAS, a US I-20 or an Australian CoE.'],
                    ['June to August 2027: visa and travel', 'Apply for your student visa as soon as the university issues its documents. Book insurance, accommodation and flights once your visa position is clear.'],
                    ['September 2027: arrive and settle', 'Attend orientation, complete any registration your university or the local authorities need, and set up your bank account and phone.']
                ])}
  ${note('<strong>UK undergraduate applicants:</strong> UCAS lists 18:00 UK time on 13 January 2027 as the main deadline for 2027 entry. Oxford, Cambridge, medicine, dentistry and veterinary courses had an earlier deadline of 15 October 2026. Check your course on UCAS.')}`
            },
            {
                id: 'countries', tag: 'Countries', title: 'Choosing a country for 2027',
                lead: `Start with what you want to study, what you can afford for the whole degree and when you want to begin. Our ${link('best-countries-to-study-abroad-2027', 'guide to the best countries for 2027')} shows how to compare them. Then open the guide for each country you are considering.`,
                body: `${pills(COUNTRY_GUIDES)}
  <p class="gp-lead-text" style="margin-top:1.2rem">Not sure yet? Compare options side by side with the ${link('tools/comparator', 'course comparator')} or open the ${link('destinations', 'destinations overview')}.</p>`
            },
            {
                id: 'budget', tag: 'Budget', title: 'Build your 2027 budget before you apply',
                lead: 'We do not quote tuition or visa fees here because they change every year. Use the university and government pages for the numbers, and cover these items.',
                body: `${checklist([
                    '<strong>Tuition for the whole course,</strong> not only year one.',
                    '<strong>Living costs</strong> in the city you will actually live in.',
                    '<strong>Health cover and visa charges</strong> as listed by the official visa page.',
                    '<strong>One-off costs:</strong> deposit, accommodation advance, flights and first-month setup.',
                    '<strong>A buffer</strong> for the rupee moving against the pound, dollar or euro.'
                ])}
  <p class="gp-lead-text" style="margin-top:1.2rem">Put the numbers into the ${link('tools/roi-calculator', 'study cost calculator')} and compare the total across countries.</p>`
            },
            {
                id: 'faq', tag: 'FAQ', title: 'Questions about studying abroad in 2027', cls: 'gp-faq',
                body: '__FAQ__'
            }
        ],
        faq: [
            ['Is it too late to apply for 2027?', 'No, not for the autumn 2027 intake, which is the main intake in most countries. The January and February 2027 starts are the ones closing now, so ask each university whether it still accepts applications.'],
            ['Which intake is best for 2027?', 'Autumn usually has the widest choice of courses and the most scholarship rounds. Early-year intakes can have fewer seats and less funding but let you start sooner. The right answer depends on your tests, documents and budget.'],
            ['When should I take IELTS or TOEFL for 2027?', 'Early enough to retake before your first deadline. IELTS and TOEFL scores are normally valid for two years, so a test taken this winter should still be valid for autumn 2027 entry. Confirm each university’s rule.'],
            ['Do I need an agent or consultant to apply?', 'No, you can apply directly. A counsellor helps you compare options and avoid mistakes. Gradmire does not earn commission from universities, so our advice does not depend on which university you choose.'],
            ['Will visa rules change before 2027?', 'They can. Countries change student visa and work rules often, so treat any rule you read, including here, as a starting point and check the official government page before you apply.']
        ],
        sources: [
            ['UCAS: 2027 entry deadline for undergraduate courses', 'https://www.ucas.com/events/2027-entry-deadline-for-all-undergraduate-courses-except-those-with-a-15-october-deadline-475546'],
            ['GOV.UK: student visa', 'https://www.gov.uk/student-visa'],
            ['IRCC: study permit documents', 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/get-documents.html'],
            ['Home Affairs: Student visa (subclass 500)', 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500']
        ],
        related: relatedFor('intakes', 'countries', 'scholarships', 'checklist', 'tests'),
        cta: { title: 'Want help turning this into your own 2027 plan?', text: 'Book a free consultation to choose an intake, shortlist countries and set your test dates.', label: 'Book a free consultation' }
    },

    /* ───────────────────────────── 2. Intakes ───────────────────────────── */
    {
        slug: 'study-abroad-intakes-2027',
        category: 'Planning',
        title: 'Study Abroad Intakes 2027: January to September | Gradmire',
        description: 'Compare 2027 intakes by country: when courses start, how September differs from January, and what to do if an early deadline has already passed.',
        eyebrow: '2027 intakes',
        h1: 'Study abroad intakes in 2027: when to apply for each country',
        intro: 'An intake is a start date for a course. Pick the wrong one and you can miss scholarships or wait a year. Here is how the main 2027 intakes compare, and what to do if you are already late for the first one.',
        keywords: ['2027 intake', 'january 2027 intake', 'september 2027 intake', 'fall 2027 intake', 'study abroad intakes 2027'],
        readMins: 6,
        cardExcerpt: 'January, February, July and September 2027: typical start months by country and what to do if you are late.',
        sections: [
            {
                id: 'why', tag: 'Why it matters', title: 'Three things change with the intake',
                body: `${cards([
                    ['Choice of courses', 'The main intake usually has the widest range of courses. Smaller intakes may offer only some programmes, often at master’s level.'],
                    ['Scholarships', 'Many scholarship rounds are tied to the main intake. Early-year intakes can have fewer awards, so ask before you apply.'],
                    ['Timing and housing', 'Visa processing, deposits and accommodation all follow the intake date. A later intake gives you more time to prepare.']
                ], 3)}
  ${note(`<strong>Typical, not guaranteed.</strong> Each university sets its own calendar. ${VERIFY}`)}`
            },
            {
                id: 'by-country', tag: 'By country', title: 'Typical 2027 start months by country',
                body: table('Typical intakes by country', ['Country', 'Main start', 'Other starts', 'Guide'], [
                    ['UK', 'September 2027', 'January (select master’s degrees); a rare May or June start', link('study-in-uk', 'Study in the UK')],
                    ['USA', 'Fall (August or September 2027)', 'Spring (January), common for graduate programmes; limited summer starts', link('study-in-usa', 'Study in the USA')],
                    ['Canada', 'September 2027', 'January, mostly graduate; May at some colleges', link('study-in-canada', 'Study in Canada')],
                    ['Australia', 'February or March 2027', 'July or August; a November start at a few universities', link('study-in-australia', 'Study in Australia')],
                    ['Germany', 'Winter semester (October)', 'Summer semester (April), with fewer programmes', link('study-in-germany', 'Study in Germany')],
                    ['Ireland', 'September 2027', 'Some programmes start in January', link('study-in-ireland', 'Study in Ireland')],
                    ['New Zealand', 'February or March 2027', 'July', link('study-in-newzealand', 'Study in New Zealand')],
                    ['Italy', 'Autumn (September or October)', 'A few programmes start in spring', link('study-in-italy', 'Study in Italy')],
                    ['Finland', 'Autumn (August or September)', 'Some programmes start in January', link('study-in-finland', 'Study in Finland')]
                ])
            },
            {
                id: 'dates', tag: 'Dates', title: 'Dates to watch for 2027 entry',
                lead: 'Most deadlines are set by each university, so the only fixed dates we list are the UCAS ones. For everything else, open the programme page and write the deadline down.',
                body: `${checklist([
                    '<strong>UK undergraduate (UCAS):</strong> 15 October 2026 for Oxford, Cambridge, medicine, dentistry and veterinary courses (already passed), and 18:00 UK time on 13 January 2027 for all other undergraduate courses.',
                    '<strong>UK master’s:</strong> you apply to each university directly. Many programmes fill as they go, so apply early.',
                    '<strong>USA:</strong> undergraduate colleges often have early and regular rounds, and many master’s programmes set deadlines in winter for fall entry. Check each programme.',
                    '<strong>Canada, Ireland, Germany, Italy and Finland:</strong> deadlines for autumn entry usually fall in winter and spring, and some countries add steps such as document evaluation. Start those steps first.',
                    '<strong>Australia and New Zealand:</strong> February intakes close earlier than July intakes, so check which one you can still meet.'
                ])}
  <p class="gp-source">Source: ${ext('https://www.ucas.com/events/2027-entry-deadline-for-all-undergraduate-courses-except-those-with-a-15-october-deadline-475546', 'UCAS 2027 entry deadline')}, checked on ${REVIEWED_LABEL}.</p>`
            },
            {
                id: 'september-vs-january', tag: 'Compare', title: 'September (fall) or January (spring)?',
                body: table('September compared with January', ['Factor', 'September or fall', 'January or spring'], [
                    ['Course choice', 'Widest range at most universities', 'Narrower, often graduate programmes only'],
                    ['Scholarships', 'Most rounds and awards', 'Fewer, so ask the university directly'],
                    ['Seat availability', 'More competitive', 'Often easier at universities that offer it'],
                    ['Time to prepare', 'More time to test, apply and save', 'Less time, so you must be ready now'],
                    ['Best for', 'Students who want the most options', 'Students who are ready and want to start sooner']
                ])
            },
            {
                id: 'missed', tag: 'Running late?', title: 'If you missed an early 2027 deadline',
                body: `${checklist([
                    '<strong>Ask for late or rolling admission.</strong> Some programmes accept applications until seats are full. Email admissions with your profile.',
                    '<strong>Move to the next intake.</strong> A strong application for autumn 2027 beats a rushed one for January.',
                    '<strong>Look at pathway or foundation routes</strong> if your marks or English score are below the direct-entry level.',
                    '<strong>Use the time.</strong> Finish your test, build your scholarship list and prepare funds.',
                    '<strong>Do not pay for “guaranteed” admission.</strong> No agent can guarantee an offer or a visa.'
                ])}`
            },
            {
                id: 'faq', tag: 'FAQ', title: 'Intake questions, answered', cls: 'gp-faq',
                body: '__FAQ__'
            }
        ],
        faq: [
            ['What does “fall 2027 intake” mean?', 'Fall is the American and Canadian word for the autumn start, usually August or September 2027. It is the main intake for most universities in those countries.'],
            ['Is the January 2027 intake still open?', 'For many programmes the January 2027 window has closed or is closing. A few universities accept late applications, so ask admissions directly before you give up on it.'],
            ['Which intake has the most scholarships?', 'Autumn usually has the most scholarship rounds, but some universities also fund January starters. Check the scholarship page of each university.'],
            ['Can I apply for more than one intake?', 'Often yes, but each university has its own rules about changing or deferring an application. Read the programme page or ask admissions.']
        ],
        sources: [
            ['UCAS: 2027 entry deadline for undergraduate courses', 'https://www.ucas.com/events/2027-entry-deadline-for-all-undergraduate-courses-except-those-with-a-15-october-deadline-475546'],
            ['Study Australia', 'https://www.studyaustralia.gov.au/'],
            ['Studyinfo (Finland)', 'https://studyinfo.fi/'],
            ['DAAD (Germany)', 'https://www.daad.de/en/']
        ],
        related: relatedFor('pillar', 'checklist', 'tests', 'scholarships'),
        cta: { title: 'Not sure which intake fits you?', text: 'A counsellor can look at your marks, tests and budget and tell you which 2027 intake is realistic.', label: 'Book a free consultation' }
    },

    /* ───────────────────────────── 3. Best countries ───────────────────────────── */
    {
        slug: 'best-countries-to-study-abroad-2027',
        category: 'Destinations',
        title: 'Best Countries to Study Abroad in 2027 | Gradmire',
        description: 'There is no single best country. Compare the UK, USA, Canada, Australia, Germany, Ireland, New Zealand, Italy and Finland for the 2027 intake.',
        eyebrow: 'Choosing a country',
        h1: 'Best countries to study abroad in 2027 for Indian students',
        intro: 'There is no single best country, only the best country for your course, budget and plans after graduation. Here is how to compare the nine destinations we cover, using questions you can answer before you apply.',
        keywords: ['best countries to study abroad 2027', 'where to study abroad 2027', 'study abroad destinations 2027', 'study abroad for Indian students'],
        readMins: 7,
        cardExcerpt: 'How to compare nine destinations for 2027 by cost, course length, funding and timing.',
        sections: [
            {
                id: 'method', tag: 'How to compare', title: 'Seven questions that decide the best country',
                lead: 'We do not rank countries. Rankings move with exchange rates, visa rules and your own profile. Answer these instead.',
                body: `${checklist([
                    '<strong>What will the whole degree cost,</strong> including living costs, not just yearly tuition?',
                    '<strong>How long is the course?</strong> A one-year master’s changes the total.',
                    '<strong>What funding can you realistically win,</strong> and when do those scholarships close?',
                    '<strong>Which language will you study and live in?</strong>',
                    '<strong>Which intake can you meet</strong> with your tests and documents?',
                    '<strong>What are the work rules</strong> during and after study, today?',
                    '<strong>How predictable is the visa process</strong> for your course level and funds?'
                ], true)}`
            },
            {
                id: 'matrix', tag: 'Quick matrix', title: 'If this matters most to you, look here first',
                body: `${table('Where to look first', ['If you want', 'Look first at', 'Why'], [
                    ['The widest choice of courses', 'USA, UK, Canada, Australia', 'Large systems with many subjects, universities and intakes.'],
                    ['A shorter master’s degree', 'UK, Ireland', 'Many master’s degrees run for one year, which can lower the total even when yearly fees are high.'],
                    ['Low or no tuition at public universities', 'Germany', 'Many public universities charge little or no tuition, but some states charge non-EU students, and you still need proof of funds.'],
                    ['Government scholarships to compete for', 'UK, USA, Germany, Australia, Ireland, New Zealand, Italy', 'Each runs national programmes. They are competitive, so plan for partial funding.'],
                    ['Funded graduate study', 'USA, Germany, Canada', 'US graduate assistantships and research funding can offset costs. Check each department.'],
                    ['A smaller, quieter study city', 'New Zealand, Ireland, Finland', 'Smaller campuses and cities, with English-taught degrees.'],
                    ['An early-2027 start', 'Australia, New Zealand', 'February and March starts, but the application windows are closing now.'],
                    ['Medicine', link('mbbs-abroad', 'MBBS abroad'), 'Recognition and the internship rules matter more than the country.']
                ])}
  ${note(`<strong>Use this as a shortlist, not a verdict.</strong> ${VERIFY}`)}`
            },
            {
                id: 'country-notes', tag: 'Country notes', title: 'What to know about each destination for 2027',
                body: cards([
                    ['UK', `One-year master’s degrees are common and UCAS handles undergraduate applications. September is the main intake. Read the ${ext('https://www.gov.uk/graduate-visa', 'Graduate route rules')} before you plan work after study. ${link('study-in-uk', 'UK guide')}`],
                    ['USA', `Widest choice, with many graduate assistantships. Fall is the main intake. Check student work rules on the ${ext('https://www.ice.gov/sevis/employment', 'official SEVIS page')}. ${link('study-in-usa', 'USA guide')}`],
                    ['Canada', `Study permit limits and provincial rules affect how many applications are accepted, so confirm the current rules with ${ext('https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/get-documents.html', 'IRCC')} before you pay a deposit. ${link('study-in-canada', 'Canada guide')}`],
                    ['Australia', `Two main intakes, February and July, and the subclass 500 student visa. Compare costs city by city. ${link('study-in-australia', 'Australia guide')}`],
                    ['Germany', `Winter semester is the main start. Indian applicants are normally asked for an APS certificate, which can take months, so confirm the current rule with ${ext('https://www.daad.de/en/', 'DAAD')} or your university. ${link('study-in-germany', 'Germany guide')}`],
                    ['Ireland', `One-year master’s degrees are common and September is the main intake. Check the registration steps after you arrive. ${link('study-in-ireland', 'Ireland guide')}`],
                    ['New Zealand', `Two main intakes, February and July, and a small set of universities to compare. ${link('study-in-newzealand', 'New Zealand guide')}`],
                    ['Italy', `Autumn start and regional scholarships. Many non-EU applicants complete a pre-enrolment step, so check the dates for your course. ${link('study-in-italy', 'Italy guide')}`],
                    ['Finland', `English-taught degrees use national application windows on ${ext('https://studyinfo.fi/', 'Studyinfo')}, so check the window for your programme. ${link('study-in-finland', 'Finland guide')}`]
                ], 3)
            },
            {
                id: 'compare', tag: 'Next step', title: 'Compare your shortlist with real numbers',
                body: `<p class="gp-lead-text">Pick two or three countries, then compare the total cost with the ${link('tools/roi-calculator', 'study cost calculator')} and set the courses side by side in the ${link('tools/comparator', 'course comparator')}. Use the ${link('find-courses', 'course finder')} to see example courses and universities in each country.</p>`
            },
            { id: 'faq', tag: 'FAQ', title: 'Choosing a country: common questions', cls: 'gp-faq', body: '__FAQ__' }
        ],
        faq: [
            ['Which country is cheapest to study in?', 'It depends on course length, tuition, city and funding. A country with high yearly fees but a one-year master’s can cost less than a cheaper country with a two-year degree. Compare the total, not the yearly fee.'],
            ['Which country has the easiest student visa?', 'No country guarantees a visa. Outcomes depend on your documents, funds and course. Be careful with anyone who promises approval.'],
            ['Which countries offer the most scholarships?', `Every destination we cover has some, from government awards to university merit awards. See our ${link('study-abroad-scholarships-2027', 'scholarships for 2027 guide')} and the scholarship page for each country.`],
            ['Can I work while I study?', 'Most of these countries allow limited work during study and have separate rules after graduation. The rules change, so read the official government page for your country before you count on income.']
        ],
        sources: [
            ['GOV.UK: Graduate visa', 'https://www.gov.uk/graduate-visa'],
            ['ICE: SEVIS employment', 'https://www.ice.gov/sevis/employment'],
            ['IRCC: study permit', 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/get-documents.html'],
            ['DAAD', 'https://www.daad.de/en/'],
            ['Studyinfo (Finland)', 'https://studyinfo.fi/']
        ],
        related: relatedFor('pillar', 'intakes', 'scholarships', 'mbbs'),
        cta: { title: 'Down to two or three countries?', text: 'Talk to a counsellor about cost, course and intake before you commit to a shortlist.', label: 'Book a free consultation' }
    },

    /* ───────────────────────────── 4. Scholarships ───────────────────────────── */
    {
        slug: 'study-abroad-scholarships-2027',
        category: 'Scholarships',
        title: 'Scholarships for the 2027 Intake: How to Apply | Gradmire',
        description: 'Find and apply for study-abroad scholarships for the 2027 intake: where funding comes from, programmes by country, a shortlist plan and how to spot scams.',
        eyebrow: 'Scholarships for 2027',
        h1: 'Study abroad scholarships for the 2027 intake',
        intro: 'Most scholarship deadlines for autumn 2027 fall between this winter and next spring, and some flagship awards have already closed. Here is where funding comes from, which programmes to look at by country, and how to build a plan that does not depend on a single award.',
        keywords: ['scholarships 2027', 'study abroad scholarships 2027', 'scholarships for Indian students 2027', 'fully funded scholarships 2027'],
        readMins: 6,
        cardExcerpt: 'Where 2027 funding comes from, programmes by country and a scholarship plan that does not rely on one award.',
        sections: [
            {
                id: 'sources', tag: 'Funding sources', title: 'Where scholarship money comes from',
                body: cards([
                    ['Government scholarships', 'National programmes such as Chevening (UK), DAAD (Germany) and Australia Awards. Competitive, with fixed yearly deadlines.'],
                    ['University scholarships', 'Merit and international-student awards from the university itself. Many are decided with your course application.'],
                    ['Need-based aid and assistantships', 'US universities offer need-based aid, and graduate departments offer assistantships with a tuition waiver or stipend.'],
                    ['Indian trusts and foundations', 'For example the Inlaks Shivdasani Foundation, the J N Tata Endowment and the K C Mahindra Education Trust. Several are loan scholarships, so read the terms.']
                ], 2)
            },
            {
                id: 'by-country', tag: 'By country', title: 'Programmes to look at, country by country',
                lead: `These are examples from our country scholarship pages. Eligibility, amounts and official links are on each page. Some awards for 2027 entry may have closed, so note the next opening date as well.`,
                body: `${table('Scholarship examples by country', ['Country', 'Examples to check', 'Details'], [
                    ['UK', 'Chevening, Commonwealth Master’s Scholarships, GREAT Scholarships, Gates Cambridge, Clarendon', link('scholarships-in-uk', 'Scholarships in the UK')],
                    ['USA', 'Fulbright-Nehru Master’s Fellowships, graduate assistantships, need-based aid, university merit awards', link('scholarships-in-usa', 'Scholarships in the USA')],
                    ['Canada', 'Lester B. Pearson (University of Toronto), Karen McKellin (UBC), Ontario Graduate Scholarship', link('scholarships-in-canada', 'Scholarships in Canada')],
                    ['Australia', 'Australia Awards, Destination Australia, Monash International Merit Scholarship', link('scholarships-in-australia', 'Scholarships in Australia')],
                    ['Germany', 'DAAD study scholarships for master’s, Deutschlandstipendium', link('scholarships-in-germany', 'Scholarships in Germany')],
                    ['Ireland', 'Government of Ireland International Education Scholarships, university excellence awards', link('scholarships-in-ireland', 'Scholarships in Ireland')],
                    ['New Zealand', 'New Zealand Excellence Awards (for India), Manaaki New Zealand Scholarships', link('scholarships-in-newzealand', 'Scholarships in New Zealand')],
                    ['Italy', 'Regional DSU scholarships, Invest Your Talent in Italy, MAECI scholarships', link('scholarships-in-italy', 'Scholarships in Italy')],
                    ['Finland', 'University tuition fee waivers and early payment discounts', link('scholarships-in-finland', 'Scholarships in Finland')]
                ])}
  <p class="gp-lead-text" style="margin-top:1.2rem">Browse everything in one place on the ${link('scholarships', 'scholarships hub')}.</p>`
            },
            {
                id: 'plan', tag: 'Plan', title: 'Build a scholarship plan in six steps',
                body: steps([
                    ['List 10 to 15 options', 'Mix government awards, university awards and Indian trusts, so no single decision decides your funding.'],
                    ['Check eligibility first', 'Read nationality, degree level, subject and work-experience rules. Drop what you cannot meet.'],
                    ['Write the deadlines down', 'Many university awards close with the course application, and flagship awards close months before the intake.'],
                    ['Prepare the common documents', 'Transcripts, CV, statement of purpose, recommendation letters and test scores serve most applications.'],
                    ['Tailor each statement', 'Selection panels read many essays. Explain why this award and this course fit your plan.'],
                    ['Track everything', `Use the ${link('tools/deadline-tracker', 'deadline tracker')} so no date slips past.`]
                ])
            },
            {
                id: 'scams', tag: 'Stay safe', title: 'How to spot a scholarship scam',
                body: checklist([
                    'You are asked to <strong>pay a fee</strong> to be “selected” or to “release” a scholarship.',
                    'You get a <strong>message that says you won</strong> something you never applied for.',
                    'The site is <strong>not the provider’s official domain</strong>, or the link comes from a private message.',
                    'The offer <strong>guarantees</strong> an award or a visa.',
                    'Always open the scholarship from the provider’s official website, and keep your passport and bank details off chat apps.'
                ])
            },
            { id: 'faq', tag: 'FAQ', title: 'Scholarship questions for 2027', cls: 'gp-faq', body: '__FAQ__' }
        ],
        faq: [
            ['Can I get a full scholarship?', 'Some awards cover full tuition and living costs, but they are highly competitive. Plan for partial funding and keep a backup budget.'],
            ['Are there still scholarships open for 2027?', 'Yes. Many university awards open with the application for the course, so they are still available while you can apply. Some national awards for 2027 have closed, so note when they open again.'],
            ['Do I apply for the scholarship separately?', 'Often yes, but some universities consider you automatically when you apply. The scholarship page says which.'],
            ['Does Gradmire take money for scholarships?', 'No. Scholarship applications go directly to the provider. We do not earn commission from universities or scholarship providers.']
        ],
        sources: [
            ['Chevening (UK)', 'https://www.chevening.org/'],
            ['USIEF: Fulbright-Nehru fellowships', 'https://www.usief.org.in/'],
            ['DAAD (Germany)', 'https://www.daad.de/en/'],
            ['Study Australia', 'https://www.studyaustralia.gov.au/']
        ],
        related: relatedFor('pillar', 'countries', 'checklist'),
        cta: { title: 'Want a scholarship shortlist for your profile?', text: 'Book a free consultation and we will match your course, marks and budget to awards worth applying for.', label: 'Book a free consultation' }
    },

    /* ───────────────────────────── 5. Checklist ───────────────────────────── */
    {
        slug: 'study-abroad-checklist-2027',
        category: 'Planning',
        title: 'Study Abroad Checklist 2027: Documents and Timeline | Gradmire',
        description: 'A practical study abroad checklist for 2027: what to do in the next 30 days, which documents to collect and the mistakes that delay applications.',
        eyebrow: '2027 checklist',
        h1: 'Study abroad checklist for 2027: documents and your next 30 days',
        intro: 'Documents, not ideas, are what delay applications. Transcripts, recommendation letters and bank papers take weeks. Start with the next 30 days below, then use the document list to check nothing is missing.',
        keywords: ['study abroad checklist 2027', 'documents required for study abroad', 'study abroad timeline 2027', 'study abroad application checklist'],
        readMins: 6,
        cardExcerpt: 'Your next 30 days, the documents to gather and the mistakes that delay applications.',
        sections: [
            {
                id: 'next-30-days', tag: 'Start today', title: 'Your next 30 days',
                body: checklist([
                    '<strong>Write down your plan:</strong> course, two or three countries, intake and total budget.',
                    '<strong>Book your English test</strong> (and the GRE or GMAT if your programme needs it).',
                    '<strong>Ask two or three referees</strong> for recommendation letters, and send them your CV and plans.',
                    '<strong>Order marksheets, transcripts and your degree certificate.</strong> These can take weeks from your institution.',
                    '<strong>Check your passport:</strong> validity, and that your name matches your certificates.',
                    '<strong>Build a shortlist of six to ten courses</strong> and record each deadline in the ' + link('tools/deadline-tracker', 'deadline tracker') + '.',
                    '<strong>Outline your statement of purpose</strong> and talk with your family about funding.'
                ], true)
            },
            {
                id: 'documents', tag: 'Documents', title: 'The document checklist',
                lead: 'What you need depends on the country and course, so treat this as the common set and confirm the rest on each programme page.',
                body: cards([
                    ['Identity', '<ul><li>Passport with enough validity</li><li>Passport-size photographs to each country’s specification</li><li>Aadhaar or other ID if the portal asks</li></ul>'],
                    ['Academic', '<ul><li>Class 10 and 12 marksheets</li><li>University transcripts and degree or provisional certificate</li><li>Medium-of-instruction letter, if requested</li></ul>'],
                    ['Tests', '<ul><li>IELTS, TOEFL or another accepted English test</li><li>GRE or GMAT, only if the programme asks</li></ul>'],
                    ['Application', '<ul><li>CV</li><li>Statement of purpose</li><li>Recommendation letters</li><li>Portfolio or work samples, if relevant</li></ul>'],
                    ['Financial', '<ul><li>Bank statements and income proof</li><li>Sponsor documents</li><li>Education loan sanction letter, if used</li><li>Scholarship award letters</li></ul>'],
                    ['Visa and travel', '<ul><li>Offer letter and the visa document the university issues</li><li>Health insurance</li><li>Medical or police certificates, when required</li></ul>']
                ], 3)
            },
            {
                id: 'mistakes', tag: 'Avoid delays', title: 'Mistakes that delay applications',
                body: checklist([
                    '<strong>Name or date mismatches</strong> between passport, marksheets and application forms.',
                    '<strong>An expiring passport.</strong> Many visas need validity beyond the course end.',
                    '<strong>Assuming requirements are the same everywhere.</strong> Each course sets its own tests and documents.',
                    '<strong>Relying on one deadline.</strong> Apply to a spread of courses and intakes.',
                    '<strong>Leaving funding papers to the end.</strong> Loans and bank letters take time.',
                    '<strong>Paying for “guaranteed” admission.</strong> Nobody can promise an offer or a visa.'
                ])
            },
            {
                id: 'timeline', tag: 'Timeline', title: 'See the full 2027 timeline',
                body: `<p class="gp-lead-text">For the full plan from November 2026 to arrival in September 2027, read ${link('study-abroad-2027', 'Study abroad in 2027: the plan for Indian students')}. For test dates, see our ${link('study-abroad-tests-2027', '2027 test plan')}.</p>`
            },
            { id: 'faq', tag: 'FAQ', title: 'Document questions, answered', cls: 'gp-faq', body: '__FAQ__' }
        ],
        faq: [
            ['How early should I start collecting documents?', 'Now. Transcripts, certificates and recommendation letters often take weeks, and some deadlines fall in winter.'],
            ['Do I need attested or translated documents?', 'Some countries and universities ask for attested copies or translations of certificates. The programme page or visa page says which.'],
            ['How many recommendation letters do I need?', 'It varies by programme. Many ask for two or three. Check the requirement before you ask your referees.'],
            ['Where do I upload documents for the visa?', 'On the official visa portal of the country you are going to. Never send your documents through unofficial links.']
        ],
        sources: [
            ['GOV.UK: student visa', 'https://www.gov.uk/student-visa'],
            ['IRCC: study permit documents', 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/get-documents.html'],
            ['Home Affairs: Student visa (subclass 500)', 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500']
        ],
        related: relatedFor('pillar', 'tests', 'scholarships', 'intakes'),
        cta: { title: 'Want someone to check your documents?', text: 'Book a free consultation and a counsellor will go through your list and flag gaps.', label: 'Book a free consultation' }
    },

    /* ───────────────────────────── 6. Tests ───────────────────────────── */
    {
        slug: 'study-abroad-tests-2027',
        category: 'Test prep',
        title: 'IELTS, TOEFL, GRE & GMAT for 2027 Intakes | Gradmire',
        description: 'Plan IELTS, TOEFL, GRE and GMAT for the 2027 intake: which tests you need, how long scores stay valid and how to work back from your first deadline.',
        eyebrow: 'Tests for 2027',
        h1: 'IELTS, TOEFL, GRE and GMAT: your test plan for the 2027 intake',
        intro: 'Tests are the first thing to book because everything else waits for your scores. This guide shows which tests apply, how long scores last and how to work back from your earliest deadline so you still have room for a retake.',
        keywords: ['IELTS 2027', 'TOEFL 2027', 'GRE 2027', 'GMAT 2027', 'test plan for 2027 intake'],
        readMins: 6,
        cardExcerpt: 'Which tests apply, how long scores last and how to leave room for a retake before your first deadline.',
        sections: [
            {
                id: 'which', tag: 'Which tests', title: 'Which test do you need for 2027?',
                body: `${table('Tests, use and validity', ['Test', 'Mostly used for', 'Scores valid for', 'Prep guide'], [
                    ['IELTS', 'Proof of English for study and some visas', 'Usually 2 years', link('test-prep-ielts', 'IELTS preparation')],
                    ['TOEFL iBT', 'Proof of English, widely accepted in the USA and elsewhere. Since 21 January 2026 scores use a 1–6 scale in half-band steps.', '2 years', link('test-prep-toefl', 'TOEFL preparation')],
                    ['GRE', 'Some graduate and master’s programmes, mostly in the USA. Many programmes make it optional.', '5 years', link('test-prep-gre', 'GRE preparation')],
                    ['GMAT', 'MBA and business master’s programmes', '5 years', link('test-prep-gmat', 'GMAT preparation')]
                ])}
  ${note(`<strong>Check each programme.</strong> Some universities waive English tests for students who studied in English, or accept other tests. Some programmes do not ask for the GRE. Read the programme page instead of assuming. ${VERIFY}`)}`
            },
            {
                id: 'backwards', tag: 'Schedule', title: 'Work back from your first deadline',
                body: steps([
                    ['Find your earliest deadline', 'Look at your shortlist and note the first date, including scholarship deadlines that close before the course.'],
                    ['Leave time for the score report', 'Test providers need time to release and send scores. Check their current turnaround before you plan.'],
                    ['Plan a retake', 'If your earliest deadline is in mid-January, aim to have a first result by early December, so a second attempt still fits.'],
                    ['Book early', 'Popular winter dates fill up. Book your slot as soon as you know your window.'],
                    ['Check validity at the visa stage', 'Scores must be valid when you apply to the university and sometimes when you apply for the visa.']
                ])
            },
            {
                id: 'visa-note', tag: 'Visa', title: 'Make sure it is the right version of the test',
                body: `<p class="gp-lead-text">Some visa routes accept only a specific, approved version of an English test. For example, certain UK visa routes need an approved secure English language test, and the university or the ${ext('https://www.gov.uk/student-visa', 'GOV.UK student visa page')} says whether yours does. Confirm this before you book.</p>`
            },
            {
                id: 'prep', tag: 'Preparation', title: 'A simple preparation plan',
                body: checklist([
                    '<strong>Take a diagnostic test</strong> to see where you stand on each section.',
                    '<strong>Set a target score</strong> from your programmes’ requirements, not a general number.',
                    '<strong>Practise every week</strong> and keep a log of mistakes by section.',
                    '<strong>Sit full-length mock tests</strong> under real time limits.',
                    '<strong>Get feedback on writing and speaking,</strong> where self-study is hardest.',
                    '<strong>Decide your retake date</strong> before you sit the first test.'
                ], true)
            },
            { id: 'faq', tag: 'FAQ', title: 'Test questions for 2027', cls: 'gp-faq', body: '__FAQ__' }
        ],
        faq: [
            ['Should I take IELTS or TOEFL?', 'Both are widely accepted. Check which tests your shortlisted universities and visa route accept, then choose the format you are more comfortable with.'],
            ['Do I need the GRE for 2027?', 'Only if your programmes ask for it. Many programmes make the GRE optional, so check each programme page before you spend months preparing.'],
            ['Will a test taken now still be valid for autumn 2027?', 'IELTS and TOEFL scores are normally valid for two years, and GRE and GMAT scores for five, so a test taken this winter should still be valid. Confirm the rule at each university.'],
            ['Can I retake a test?', 'Yes, tests can be retaken, subject to the provider’s rules. Plan the gap before your earliest deadline.']
        ],
        sources: [
            ['IELTS', 'https://ielts.org/'],
            ['ETS: TOEFL iBT', 'https://www.ets.org/toefl.html'],
            ['ETS: GRE', 'https://www.ets.org/gre.html'],
            ['GMAC: GMAT', 'https://www.mba.com/'],
            ['GOV.UK: student visa', 'https://www.gov.uk/student-visa']
        ],
        related: relatedFor('pillar', 'checklist', 'intakes', 'countries'),
        cta: { title: 'Need a test plan built around your deadlines?', text: 'Our test preparation team can set a study plan and practice schedule that fits your 2027 timeline.', label: 'Book a free consultation' }
    },

    /* ───────────────────────────── 7. MBBS ───────────────────────────── */
    {
        slug: 'mbbs-abroad-2027',
        category: 'MBBS',
        title: 'MBBS Abroad 2027: NEET, Eligibility and Planning | Gradmire',
        description: 'Planning MBBS abroad for 2027? See NEET and eligibility basics, what licensing bodies look for, programme lengths by country and red flags to avoid.',
        eyebrow: 'MBBS abroad in 2027',
        h1: 'MBBS abroad in 2027: eligibility, NEET and how to plan',
        intro: 'Studying medicine abroad is a licensing decision as much as an admissions one. This guide covers who can apply, what India’s National Medical Commission looks for, how long programmes run in each country we cover, and the red flags that cost students years.',
        keywords: ['MBBS abroad 2027', 'NEET 2027 MBBS abroad', 'study MBBS abroad for Indian students', 'MBBS abroad eligibility'],
        readMins: 6,
        cardExcerpt: 'NEET, NMC rules, programme length by country and the red flags to avoid when planning MBBS abroad.',
        sections: [
            {
                id: 'eligibility', tag: 'Eligibility', title: 'Who can apply',
                body: `${checklist([
                    '<strong>A qualifying NEET score.</strong> Indian applicants need one to study medicine abroad. Confirm the NEET UG 2027 schedule and rules on the official NTA website.',
                    '<strong>School-leaving marks in biology and chemistry.</strong> Most universities admit on these, and some also run a short interview or test. Check each university’s own admission rules.',
                    '<strong>Age and documents.</strong> Requirements differ by university and country, so confirm them on the university’s international admissions page.'
                ])}
  ${note(`<strong>Check before you pay anything.</strong> ${VERIFY}`)}`
            },
            {
                id: 'nmc', tag: 'Licensing', title: 'What India’s licensing body looks for',
                lead: `If you plan to practise in India, the ${ext('https://www.nmc.org.in/rules-regulations/foreign-medical-graduate-licentiate-regulations-2021/', 'NMC Foreign Medical Graduate Licentiate Regulations 2021')} apply. As summarised in our country guides:`,
                body: checklist([
                    'A programme of about six years in total, with at least 54 months of study plus a 12-month internship.',
                    'The internship done at the <strong>same university</strong> where you studied.',
                    'A university listed in the ' + ext('https://www.wdoms.org/', 'World Directory of Medical Schools') + ', teaching an authorised programme.',
                    'Clinical training in hospitals, not only classroom teaching.'
                ])
            },
            {
                id: 'countries', tag: 'By country', title: 'Programme length in each country we cover',
                lead: 'Lengths come from our MBBS country guides. Always confirm with the university.',
                body: table('MBBS programme length by country', ['Country', 'Programme length', 'Teaching language', 'Guide'], mbbsCountries.map((c) => [
                    esc(c.name), esc(c.facts.duration), esc(c.facts.medium), link(`mbbs-in-${c.slug}`, `MBBS in ${esc(c.name)}`)
                ]))
            },
            {
                id: 'plan', tag: 'Plan', title: 'A planning timeline for 2027',
                body: steps([
                    ['Now to January 2027: research', 'Shortlist countries and universities. Check each against the NMC rules and the World Directory of Medical Schools.'],
                    ['Before NEET UG 2027: prepare', 'NEET is normally held in the first half of the year. Confirm the dates and registration window with NTA.'],
                    ['After results: apply', 'Apply to your shortlisted universities. Many MBBS programmes abroad start in autumn, and some have more than one intake.'],
                    ['Offer to visa', 'Accept one offer, pay only what the offer letter says, and apply for the student visa through the official route.'],
                    ['Before you fly', 'Confirm accommodation, health cover and how the 12-month internship will be done at the university.']
                ])
            },
            {
                id: 'red-flags', tag: 'Stay safe', title: 'Red flags when you plan MBBS abroad',
                body: checklist([
                    'Admission is promised <strong>without NEET.</strong>',
                    'The university is <strong>not in the World Directory of Medical Schools,</strong> or the programme is not the English-taught one authorised for international students.',
                    'The <strong>internship cannot be done at the same university.</strong>',
                    'A very <strong>low fee is the only selling point.</strong> Compare clinical training, not just price.',
                    'You are asked to <strong>send money before you have an official offer letter.</strong>'
                ])
            },
            { id: 'faq', tag: 'FAQ', title: 'MBBS abroad questions for 2027', cls: 'gp-faq', body: '__FAQ__' }
        ],
        faq: [
            ['Do I need NEET to study MBBS abroad?', 'Indian applicants need a qualifying NEET score. Confirm the current rule on the NTA and NMC websites.'],
            ['Which country is best for MBBS abroad?', 'It depends on recognition, programme length, teaching language, the internship and your budget. Compare the country guides and verify each university before you apply.'],
            ['Can I do the internship in India?', 'Usually not. Many licensing bodies, including India’s NMC, require the internship at the same university where you studied. Confirm the university offers it before you enrol.'],
            ['Does Gradmire charge commission?', 'No. We do not earn commission from universities, so our advice is independent of which university you pick.']
        ],
        sources: [
            ['NMC: Foreign Medical Graduate Licentiate Regulations 2021', 'https://www.nmc.org.in/rules-regulations/foreign-medical-graduate-licentiate-regulations-2021/'],
            ['World Directory of Medical Schools', 'https://www.wdoms.org/'],
            ['National Testing Agency (NEET UG)', 'https://nta.ac.in/']
        ],
        related: relatedFor('pillar', 'checklist', 'countries'),
        cta: { title: 'Planning MBBS abroad?', text: 'Book a free consultation to compare countries, check recognition and plan the 2027 timeline.', label: 'Book a free consultation' }
    }
];

/* Order shown on the blog index. */
export const bySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));
