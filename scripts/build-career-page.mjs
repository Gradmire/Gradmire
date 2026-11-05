/* Builds the Careers page into frontend/pages/career.html (/career): the study-abroad
   counsellor role and the student ambassador role, how hiring works, and how to apply.
   Run from the repository root:  node scripts/build-career-page.mjs
   Counsellors apply through the existing consultant application (dashboard-become-consultant,
   reviewed by staff); student ambassadors apply by email. Layout pieces come from page-shell.mjs. */
import { esc, hero, section, steps, checklist, faq, shell, write } from './page-shell.mjs';

const MAIL = 'info@gradmire.com';
const ambassadorMail = `mailto:${MAIL}?subject=${encodeURIComponent('Student ambassador application')}&body=${encodeURIComponent(
    'Name:\nUniversity and course:\nCountry and city:\nYear you started or start:\nWhy you would like to be a Gradmire student ambassador:\n'
)}`.replace(/&/g, '&amp;');
const enquiryMail = `mailto:${MAIL}?subject=${encodeURIComponent('Career enquiry')}`;

const chips = (items) => `<ul class="cr-meta" aria-label="Role details">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
const twoCards = (left, right) => `<div class="gp-grid-2">
    <article class="gp-card"><h3>${esc(left[0])}</h3>${checklist(left[1])}</article>
    <article class="gp-card"><h3>${esc(right[0])}</h3>${checklist(right[1])}</article>
  </div>`;
const apply = ({ title, text, buttons }) => `<div class="cr-apply">
    <h3>${esc(title)}</h3>
    <p>${text}</p>
    <div class="cr-apply-actions">${buttons}</div>
  </div>`;

const heroAside = `<aside class="gp-lead cr-aside" aria-labelledby="cr-aside-title">
  <p class="gp-lead-eyebrow">Two ways to join</p>
  <h2 class="gp-lead-title" id="cr-aside-title">Pick the role that fits you</h2>
  <a class="cr-aside-link" href="#counsellor"><strong>Study-abroad counsellor</strong><span>Advise students and families, full time, part time or on contract.</span></a>
  <a class="cr-aside-link" href="#student-ambassador"><strong>Student ambassador</strong><span>Share what studying abroad is really like.</span></a>
  <p class="gp-lead-fine">There is no fee to apply for either role.</p>
</aside>`;

const body = `${hero({
    crumbs: [['Home', './'], ['Careers']],
    eyebrow: 'Careers at Gradmire',
    title: 'Help students choose where to study abroad.',
    intro: 'Gradmire guides students and families through choosing a course, a country and a university. We are looking for study-abroad counsellors and student ambassadors who give honest, student-first advice.',
    actions: `<a class="gp-btn gp-btn-primary" href="#counsellor">Counsellor role</a>
        <a class="gp-btn gp-btn-ghost" href="#student-ambassador">Student ambassador role</a>`,
    form: heroAside
})}
<main id="main">
${section({ id: 'roles', tag: 'Roles', title: 'Two ways to work with Gradmire', lead: 'Both roles are about the same thing: giving students clear, truthful information before they make one of the biggest decisions of their lives.', body: `<div class="gp-grid-2 cr-roles">
    <article class="gp-card"><h3>Study-abroad counsellor</h3><p>Guide students from their first question to their offer letter, across courses, destinations and applications.</p>${chips(['Full time', 'Part time', 'Contract'])}</article>
    <article class="gp-card"><h3>Student ambassador</h3><p>Talk to prospective students about your own course, university and city, including the parts that are hard.</p>${chips(['Current or recent student', 'Share your experience'])}</article>
  </div>` })}

${section({ id: 'counsellor', tag: 'Counsellor', title: 'Study-abroad counsellor', lead: 'You help students decide what to study, where, and how to apply, and you stay with them through the process.', body: `${twoCards(
    ['What you will do', [
        'Speak with students and parents about courses, universities and destinations, including the UK, USA, Canada, Australia, Germany, Ireland, New Zealand, Italy, Finland and MBBS abroad.',
        'Run booked consultations and follow up on enquiries so no student is left waiting.',
        'Keep each student’s details, follow-ups and documents up to date in the Gradmire counsellor workspace.',
        'Tell families plainly what a course costs and what it does not guarantee.'
    ]],
    ['What we look for', [
        'Experience in study-abroad counselling, university admissions, visas or education advising. Tell us about it in your application.',
        'Solid knowledge of one or more destinations, or of the MBBS abroad route.',
        'Clear spoken and written English, and the other languages you speak with students.',
        'Honest, patient communication with students who are anxious or unsure.'
    ]]
)}
  ${apply({
        title: 'How to apply as a counsellor',
        text: 'Log in or create a Gradmire account, then fill in the consultant application: your experience, languages, areas of expertise and an optional CV. Applying does not change your account. Access to the counsellor workspace is given only after hiring and onboarding are approved. Your CV is stored privately and only Gradmire’s hiring reviewers can open it.',
        buttons: '<a class="gp-btn gp-btn-primary" href="dashboard-become-consultant">Apply as a counsellor</a>'
    })}` })}

${section({ id: 'student-ambassador', tag: 'Student ambassador', title: 'Student ambassador', lead: 'Prospective students trust people who have already done it. As an ambassador you tell them what your course, university and city are really like.', body: `${twoCards(
    ['What you will do', [
        'Answer questions from prospective students about your course, campus, city, costs and daily life.',
        'Give a balanced view, including what surprised you and what you would do differently.',
        'Point students to a Gradmire counsellor for admissions, visa and application advice, which is a counsellor’s job.',
        'Help us spot where our destination guides no longer match what you see on the ground.'
    ]],
    ['Who it suits', [
        'You are studying abroad now, or finished recently, or you hold an offer for an upcoming intake.',
        'You are comfortable talking to students and parents you have never met.',
        'You can describe your experience honestly, not as a sales pitch.',
        'You can give a little time on a regular basis, alongside your studies.'
    ]]
)}
  ${apply({
        title: 'How to apply as a student ambassador',
        text: `Email <a href="mailto:${MAIL}">${MAIL}</a> with your name, university and course, country and city, the year you started or start, and a few lines on why you would like to be an ambassador. The button below opens an email with these prompts filled in.`,
        buttons: `<a class="gp-btn gp-btn-primary" href="${ambassadorMail}">Email your application</a>`
    })}` })}

${section({ id: 'hiring', tag: 'Hiring', title: 'How hiring works', body: steps([
    ['Apply', 'Counsellors submit the consultant application. Student ambassadors send us an email.'],
    ['Review', 'Our hiring reviewers read your application.'],
    ['Conversation', 'We talk with shortlisted candidates about their experience and the role.'],
    ['Onboarding', 'If we offer you the role, you are invited by email to join. Team access is approved by a second person before it starts.']
]) })}

${section({ id: 'faq', tag: 'FAQs', title: 'Careers: common questions', cls: 'gp-faq', body: faq([
    ['Do I have to pay to apply or to join?', `No. Neither role has an application fee. If anyone asks you for money in Gradmire’s name, please tell us at ${MAIL}.`],
    ['Where is the work based?', 'Gradmire guides students online across India, with branches in Delhi/NCR, Greater Noida, Lucknow and Kanpur. Tell us where you are based and what availability you can offer.'],
    ['What happens after I apply?', 'We use the details you give us to assess your application and to contact you about it. Counsellor applications are tracked in our hiring system and reviewed by staff.'],
    ['I do not see a role that fits. Can I still write to you?', `Yes. Send your CV and a few lines about the work you would like to do to ${MAIL}.`]
]) })}

<div class="gp-cta">
  <h2>Not sure which role fits?</h2>
  <p>Write to us with your background and the kind of work you would like to do.</p>
  <a class="gp-btn gp-btn-primary" href="${enquiryMail}">Email the team</a>
</div>
</main>`;

const html = shell({
    title: 'Careers at Gradmire: Counsellor & Student Ambassador',
    description: 'Join Gradmire as a study-abroad counsellor or student ambassador. See what each role involves, what we look for and how to apply.',
    body
}).replace('</head>', '<link rel="stylesheet" href="../assets/career.css?v=1">\n</head>');

write('career.html', html);
console.log('Built the Careers page.');
