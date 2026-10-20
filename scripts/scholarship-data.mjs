/* Scholarships for bachelor's and master's study, by destination (built by
   build-scholarship-pages.mjs). Values and timings are summaries: each entry links to
   its official page, which is authoritative. Update REVIEWED when you re-check them.
   level: 'ug' (bachelor's), 'pg' (master's) or both. */

export const REVIEWED = 'October 2026';

export const destinations = [
    {
        slug: 'uk', name: 'UK', fullName: 'United Kingdom', page: 'study-in-uk.html',
        intro: 'UK funding for international students is mostly for master’s study, from the UK government, the British Council and individual universities. Bachelor’s scholarships exist but are usually partial and set by each university.',
        scholarships: [
            { name: 'Chevening Scholarships', provider: 'UK government (FCDO)', level: ['pg'], value: 'Full tuition, a monthly living allowance, return flights and visa costs', who: 'Future leaders from Chevening-eligible countries (including India) with at least two years of work experience, for a one-year master’s at any UK university.', timing: 'Applications usually open in August and close in early November, a year before study.', url: 'https://www.chevening.org/scholarships/' },
            { name: 'Commonwealth Master’s Scholarships', provider: 'Commonwealth Scholarship Commission', level: ['pg'], value: 'Tuition, airfare and a living allowance', who: 'Citizens of eligible low- and middle-income Commonwealth countries, for master’s study in development-related subjects. Some countries apply through a national nominating body.', timing: 'Usually opens in the autumn, with deadlines set by each country’s nominating route.', url: 'https://cscuk.fcdo.gov.uk/scholarships/' },
            { name: 'GREAT Scholarships', provider: 'British Council and UK universities', level: ['pg'], value: 'At least £10,000 towards tuition', who: 'Students from selected countries (India is one) with an offer for a one-year taught master’s at a participating university. Participating universities change every year.', timing: 'Usually announced early in the year, with university deadlines in spring.', url: 'https://study-uk.britishcouncil.org/scholarships/great-scholarships' },
            { name: 'Gates Cambridge Scholarships', provider: 'Gates Cambridge Trust', level: ['pg'], value: 'Full cost of study at Cambridge, including a maintenance allowance', who: 'Outstanding applicants from outside the UK applying for a full-time postgraduate degree, including some master’s courses, at the University of Cambridge.', timing: 'Applied for through the Cambridge course application, usually by October or December.', url: 'https://www.gatescambridge.org/' },
            { name: 'Clarendon Scholarships', provider: 'University of Oxford', level: ['pg'], value: 'Full course fees and a grant for living expenses', who: 'Academically excellent graduate applicants to Oxford, including master’s courses. You are considered automatically when you apply by the relevant deadline.', timing: 'Considered with your Oxford application, usually by the December or January deadline.', url: 'https://www.ox.ac.uk/clarendon' },
            { name: 'University international scholarships', provider: 'Individual UK universities', level: ['ug', 'pg'], value: 'Usually partial tuition discounts', who: 'Many universities offer merit-based awards to international bachelor’s and master’s students, sometimes automatically with your offer.', timing: 'Set by each university; often tied to your offer or a spring deadline.', url: 'https://study-uk.britishcouncil.org/scholarships' }
        ]
    },
    {
        slug: 'usa', name: 'USA', fullName: 'United States', page: 'study-in-usa.html',
        intro: 'In the USA, most funding comes from universities themselves: need-based aid and merit scholarships for bachelor’s students, and scholarships or assistantships for master’s students. Some country-specific programmes such as Fulbright add government funding.',
        scholarships: [
            { name: 'Fulbright-Nehru Master’s Fellowships', provider: 'USIEF (US and Indian governments)', level: ['pg'], value: 'Tuition, living costs, travel and accident and sickness cover', who: 'Indian citizens with a relevant bachelor’s degree and at least three years’ work experience, for a master’s in selected fields at a US university.', timing: 'Usually opens in early spring for study starting the following year.', url: 'https://www.usief.org.in/' },
            { name: 'Need-based financial aid', provider: 'US universities', level: ['ug'], value: 'Up to the full cost of attendance, depending on family income', who: 'A small number of universities meet the full demonstrated need of admitted international students; many others offer limited need-based aid.', timing: 'Applied for alongside admission (CSS Profile or the university’s own form).', url: 'https://educationusa.state.gov/your-5-steps-us-study/finance-your-studies' },
            { name: 'Merit scholarships', provider: 'US universities', level: ['ug', 'pg'], value: 'Partial to full tuition', who: 'Many US universities award merit scholarships to international students based on academics, test scores or talent, often considered automatically.', timing: 'Usually considered with your application; early deadlines can matter.', url: 'https://educationusa.state.gov/your-5-steps-us-study/finance-your-studies' },
            { name: 'Graduate assistantships', provider: 'US university departments', level: ['pg'], value: 'Tuition waiver and/or a stipend in return for teaching or research work', who: 'Master’s students in some departments, especially STEM. More common for research-based programmes.', timing: 'Ask the department when you apply; offers often come with or after admission.', url: 'https://educationusa.state.gov/your-5-steps-us-study/finance-your-studies' },
            { name: 'Tata Scholarship at Cornell', provider: 'Cornell University and Tata Education and Development Trust', level: ['ug'], value: 'Need-based aid for undergraduate study at Cornell', who: 'Undergraduate students from India admitted to Cornell University who qualify for financial aid.', timing: 'Applied for with your Cornell application and financial aid forms.', url: 'https://finaid.cornell.edu/' }
        ]
    },
    {
        slug: 'canada', name: 'Canada', fullName: 'Canada', page: 'study-in-canada.html',
        intro: 'Canadian universities fund international students mainly through entrance scholarships for bachelor’s students and awards or teaching positions for master’s students.',
        scholarships: [
            { name: 'Lester B. Pearson International Scholarships', provider: 'University of Toronto', level: ['ug'], value: 'Tuition, books, incidental fees and full residence support for four years', who: 'Exceptional international students in their final year of secondary school. Your school must nominate you; each school can nominate one student.', timing: 'School nominations and applications usually close in October–November, a year before study.', url: 'https://future.utoronto.ca/pearson/' },
            { name: 'Karen McKellin International Leader of Tomorrow Award', provider: 'University of British Columbia', level: ['ug'], value: 'Need-based award that can cover tuition and living costs', who: 'International students entering undergraduate study at UBC with strong academics, leadership and financial need.', timing: 'Usually applied for with your UBC application, by early December.', url: 'https://you.ubc.ca/financial-planning/scholarships-awards-international-students/' },
            { name: 'University entrance scholarships', provider: 'Canadian universities', level: ['ug'], value: 'Usually one-time or renewable partial awards', who: 'Many universities consider international bachelor’s applicants for entrance scholarships automatically, based on grades.', timing: 'Considered with your admission application.', url: 'https://www.educanada.ca/scholarships-bourses/index.aspx?lang=eng' },
            { name: 'Ontario Graduate Scholarship', provider: 'Province of Ontario and universities', level: ['pg'], value: 'Merit award for master’s and doctoral study', who: 'Graduate students at Ontario universities; a limited number of awards are available to international students.', timing: 'Set by each university, usually in the year before study.', url: 'https://osap.gov.on.ca/OSAPPortal/en/A-ZListofAid/PRDR019245.html' }
        ]
    },
    {
        slug: 'australia', name: 'Australia', fullName: 'Australia', page: 'study-in-australia.html',
        intro: 'In Australia, most scholarships for international bachelor’s and master’s students are partial tuition awards from universities. Government programmes exist but have specific eligibility.',
        scholarships: [
            { name: 'Destination Australia', provider: 'Australian government, through participating institutions', level: ['ug', 'pg'], value: 'Up to AUD 15,000 a year', who: 'Domestic and international students studying at participating campuses in regional Australia.', timing: 'Applied for through the participating institution; rounds vary.', url: 'https://www.education.gov.au/destination-australia' },
            { name: 'Australia Awards Scholarships', provider: 'Australian government (DFAT)', level: ['ug', 'pg'], value: 'Full tuition, travel, living allowance and health cover', who: 'Citizens of participating developing countries in the Indo-Pacific. India is not currently a participating country, so check your country’s eligibility first.', timing: 'Usually opens in February and closes on 30 April for study the following year.', url: 'https://www.dfat.gov.au/people-to-people/australia-awards/australia-awards-scholarships' },
            { name: 'Monash International Merit Scholarship', provider: 'Monash University', level: ['ug', 'pg'], value: 'An annual award towards tuition for the length of the degree', who: 'High-achieving international students with an offer for an on-campus bachelor’s or master’s by coursework at Monash.', timing: 'Usually two rounds a year, for semester 1 and semester 2 entry.', url: 'https://www.monash.edu/study/fees-scholarships/scholarships' },
            { name: 'University merit scholarships', provider: 'Australian universities', level: ['ug', 'pg'], value: 'Usually 15–50% off tuition', who: 'Most Australian universities offer merit-based tuition discounts to international students, often considered with your offer.', timing: 'Set by each university; often linked to the intake.', url: 'https://www.studyaustralia.gov.au/en/plan-your-studies/scholarships' }
        ]
    },
    {
        slug: 'germany', name: 'Germany', fullName: 'Germany', page: 'study-in-germany.html',
        intro: 'Public universities in Germany charge little or no tuition for most programmes (Baden-Württemberg charges non-EU students), so scholarships in Germany mainly help with living costs.',
        scholarships: [
            { name: 'DAAD Study Scholarships for master’s', provider: 'German Academic Exchange Service (DAAD)', level: ['pg'], value: 'A monthly stipend (about €934–€992), plus health insurance and travel allowances', who: 'International graduates applying for a master’s at a German university. Some programmes target specific fields or development-related courses (EPOS).', timing: 'Deadlines vary by programme and country, often autumn of the year before study.', url: 'https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/' },
            { name: 'Deutschlandstipendium', provider: 'German government and private sponsors', level: ['ug', 'pg'], value: '€300 a month', who: 'High-achieving students, including international students, at participating universities. Social commitment counts as well as grades.', timing: 'Each university runs its own application window, often in summer for the winter semester.', url: 'https://www.deutschlandstipendium.de/deutschlandstipendium/en/home/home_node.html' },
            { name: 'Heinrich Böll Foundation scholarships', provider: 'Heinrich Böll Stiftung', level: ['ug', 'pg'], value: 'A monthly stipend plus allowances', who: 'International students enrolled at a German university with strong grades and social or political engagement.', timing: 'Usually two application windows a year.', url: 'https://www.boell.de/en/scholarships' },
            { name: 'Konrad Adenauer Foundation scholarships', provider: 'Konrad-Adenauer-Stiftung', level: ['pg'], value: 'A monthly stipend plus allowances', who: 'International graduates with excellent grades and social commitment, for master’s study in Germany.', timing: 'Check the foundation’s website for the current application window.', url: 'https://www.kas.de/en/web/begabtenfoerderung-und-kultur/international-students' }
        ]
    },
    {
        slug: 'ireland', name: 'Ireland', fullName: 'Ireland', page: 'study-in-ireland.html',
        intro: 'Ireland’s government scholarship is for postgraduate study. For bachelor’s students, funding comes mainly from individual universities.',
        scholarships: [
            { name: 'Government of Ireland International Education Scholarships', provider: 'Higher Education Authority (HEA)', level: ['pg'], value: 'A €10,000 stipend and a full tuition fee waiver for one year', who: 'Students from outside the EU/EEA, Switzerland and the UK with an offer for a master’s or PhD at an eligible Irish institution. Sixty awards a year.', timing: 'Usually opens early in the year and closes in March.', url: 'https://hea.ie/policy/international-education/goi-ies/' },
            { name: 'University global excellence scholarships', provider: 'Irish universities', level: ['ug', 'pg'], value: 'Partial or full tuition reductions', who: 'Most Irish universities (for example UCD, Trinity and University of Galway) offer merit scholarships to non-EU bachelor’s and master’s students.', timing: 'Set by each university, often with your application or offer.', url: 'https://www.educationinireland.com/en/how-do-i-apply-/scholarships/' }
        ]
    },
    {
        slug: 'newzealand', name: 'New Zealand', fullName: 'New Zealand', page: 'study-in-newzealand.html',
        intro: 'New Zealand offers a government–university scholarship for Indian students, and each university has its own awards for international students.',
        scholarships: [
            { name: 'New Zealand Excellence Awards (for India)', provider: 'Education New Zealand and all eight NZ universities', level: ['ug', 'pg'], value: 'Partial tuition awards (amounts vary by university)', who: 'Indian citizens starting a bachelor’s or master’s at a New Zealand university.', timing: 'Rounds are announced by Education New Zealand; check each university’s page.', url: 'https://www.studywithnewzealand.govt.nz/en/study-options/scholarships' },
            { name: 'Manaaki New Zealand Scholarships', provider: 'New Zealand government (MFAT)', level: ['ug', 'pg'], value: 'Full tuition, living allowance, travel and insurance', who: 'Citizens of eligible developing countries, mostly in the Pacific, Asia and Africa. Check your country’s eligibility first.', timing: 'Usually opens in February each year.', url: 'https://www.nzscholarships.govt.nz/' },
            { name: 'University international scholarships', provider: 'New Zealand universities', level: ['ug', 'pg'], value: 'Usually partial tuition awards', who: 'All eight universities offer merit-based awards to international students, such as excellence scholarships at Auckland and Wellington.', timing: 'Set by each university.', url: 'https://www.studywithnewzealand.govt.nz/en/study-options/scholarships' }
        ]
    },
    {
        slug: 'italy', name: 'Italy', fullName: 'Italy', page: 'study-in-italy.html',
        intro: 'Italy combines low public-university fees with need-based regional scholarships and government programmes for master’s students.',
        scholarships: [
            { name: 'Regional DSU scholarships', provider: 'Italian regional study-support agencies (e.g. DiSCo Lazio, ER.GO, EDISU Piemonte)', level: ['ug', 'pg'], value: 'Fee waiver, cash grant and often meals or housing', who: 'Students, including international students, who meet income and merit criteria. Family income is assessed through an ISEE-equivalent document.', timing: 'Usually applied for in summer, before the academic year starts.', url: 'https://www.universitaly.it/' },
            { name: 'Invest Your Talent in Italy', provider: 'Italian Ministry of Foreign Affairs and partners', level: ['pg'], value: 'A monthly stipend and tuition waiver at participating universities', who: 'Graduates from eligible countries (India is included) for English-taught master’s courses in engineering, technology, architecture, design, economics and management.', timing: 'Usually closes in spring for study starting that autumn.', url: 'https://investyourtalentitaly.esteri.it/' },
            { name: 'Italian government scholarships for foreign students', provider: 'Italian Ministry of Foreign Affairs (MAECI)', level: ['pg'], value: 'A monthly stipend and possible fee exemption', who: 'International students applying for master’s programmes at Italian universities and institutions.', timing: 'Calls are usually published in spring.', url: 'https://studyinitaly.esteri.it/en/call-for-procedure' },
            { name: 'University merit awards', provider: 'Italian universities (e.g. Bocconi, Politecnico di Milano)', level: ['ug', 'pg'], value: 'Partial or full tuition waivers', who: 'High-achieving international applicants, often considered with admission.', timing: 'Set by each university.', url: 'https://www.universitaly.it/' }
        ]
    },
    {
        slug: 'finland', name: 'Finland', fullName: 'Finland', page: 'study-in-finland.html',
        intro: 'Finnish universities charge tuition to non-EU/EEA students and fund them through their own scholarships, usually tuition waivers. The government’s Finland Scholarship ended after the 2024 admissions round.',
        scholarships: [
            { name: 'University tuition fee waivers', provider: 'Finnish universities (e.g. Helsinki, Aalto, Tampere, Turku)', level: ['ug', 'pg'], value: 'Usually 50–100% of tuition, sometimes renewable', who: 'Fee-paying non-EU/EEA students admitted to English-taught bachelor’s or master’s programmes. Applied for with your study application.', timing: 'Applied for with your admission application in the joint application round.', url: 'https://www.studyinfinland.fi/funding-your-studies/bachelors-and-masters-scholarships' },
            { name: 'Early payment discounts', provider: 'Finnish universities of applied sciences', level: ['ug', 'pg'], value: 'A discount on first-year tuition', who: 'Some universities of applied sciences reduce first-year fees for students who accept and pay early.', timing: 'Offered with your study place.', url: 'https://www.studyinfinland.fi/funding-your-studies' }
        ]
    }
];

/* Indian-funded programmes that support study in several countries. */
export const multiCountry = [
    { name: 'Inlaks Shivdasani Scholarships', provider: 'Inlaks Shivdasani Foundation', level: ['pg'], value: 'Tuition, living expenses and travel, up to a set ceiling', who: 'Indian citizens under 30 with an offer from a top university in the USA, UK or Europe, for master’s or other postgraduate study.', timing: 'Usually opens in January and closes in spring.', url: 'https://www.inlaksfoundation.org/scholarships/' },
    { name: 'J N Tata Endowment loan scholarships', provider: 'J N Tata Endowment', level: ['pg'], value: 'A loan scholarship (to be repaid), with possible travel grants', who: 'Indian graduates going abroad for postgraduate study in any field.', timing: 'Usually one application round a year, early in the year.', url: 'https://www.jntataendowment.org/' },
    { name: 'K C Mahindra Scholarships for Post-Graduate Studies Abroad', provider: 'K C Mahindra Education Trust', level: ['pg'], value: 'Interest-free loan scholarships', who: 'Indian graduates with an admission offer or application for postgraduate study abroad.', timing: 'Usually opens in February and closes in March.', url: 'https://www.kcmet.org/' }
];
