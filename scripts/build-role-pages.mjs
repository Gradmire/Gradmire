/* Builds the role-based workspace pages into frontend/pages/:
     Student:    dashboard-profile, dashboard-notifications, dashboard-become-consultant
     Public:     join-team (employee invitation), find-booking (resend a guest booking link)
     Consultant: consultant-dashboard, consultant-students, consultant-leads, consultant-follow-ups
     Admin:      admin, admin-users, admin-leads, admin-team, admin-approvals, admin-audit
   Run from the repository root:  node scripts/build-role-pages.mjs
   Pages are shells: data comes from the API at runtime and every endpoint checks
   permissions on the server. The sidebar only shows links the role may use. */
import { esc, shell, write } from './page-shell.mjs';

const BOOKING_CSS = 'booking.css?v=2';
const WORKSPACE_CSS = 'workspace.css?v=1';
const API_JS = 'api.js?v=2';
const COMMON_JS = 'booking-common.js?v=1';
const WORKSPACE_JS = 'workspace.js?v=1';

function page({ name, title, description, body, script, area, workspace = true }) {
    let html = shell({ title, description, body: workspace ? `<div class="ws-layout"><nav class="ws-nav" id="ws-nav" aria-label="Workspace"></nav>${body}</div>` : body, bodyClass: 'bk-page crm-page ws-page' });
    html = html.replace('</head>', `<link rel="stylesheet" href="../assets/${BOOKING_CSS}">\n<link rel="stylesheet" href="../assets/${WORKSPACE_CSS}">\n<meta name="robots" content="noindex, nofollow">\n</head>`);
    html = html.replace('<body ', `<body data-page="${area}" `);
    html = html.replace('</body>', `<script src="../assets/${API_JS}" defer></script>\n<script src="../assets/${COMMON_JS}" defer></script>\n<script src="../assets/${WORKSPACE_JS}" defer></script>\n<script src="../assets/${script}" defer></script>\n</body>`);
    write(name, html);
}

const head = (title, intro, actions = '') => `<div class="crm-head"><div><h1>${esc(title)}</h1><p id="ws-intro">${esc(intro)}</p></div>${actions ? `<div class="bk-actions">${actions}</div>` : ''}</div>
  <p class="bk-alert" id="ws-alert" role="status" hidden></p>`;
const main = (inner) => `<main class="bk-main crm-main ws-main" id="main" tabindex="-1">
  ${inner}
</main>`;
const field = (label, control, { optional = false, wide = false } = {}) => `<label class="gp-field${wide ? ' bk-wide' : ''}"><span>${esc(label)}${optional ? ' <em>(optional)</em>' : ''}</span>${control}</label>`;
const options = (items, placeholder) => `${placeholder !== undefined ? `<option value="">${esc(placeholder)}</option>` : ''}${items.map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join('')}`;
const table = (id, columns, caption) => `<div class="crm-table-wrap"><table class="crm-table"><caption class="sr-only">${esc(caption)}</caption>
      <thead><tr>${columns.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>
      <tbody id="${id}"><tr><td colspan="${columns.length}">Loading…</td></tr></tbody></table></div>`;
const pager = (prefix) => `<div class="crm-pager"><span id="${prefix}-count" aria-live="polite"></span><span class="bk-actions"><button type="button" class="gp-btn gp-btn-outline gp-btn-sm" id="${prefix}-prev">Previous</button><button type="button" class="gp-btn gp-btn-outline gp-btn-sm" id="${prefix}-next">Next</button></span></div>`;
const drawer = (id) => `<div class="crm-drawer" id="${id}" role="dialog" aria-modal="true" aria-labelledby="${id}-title" hidden>
    <div class="crm-drawer-head"><div><h2 id="${id}-title">Details</h2><p class="bk-fine" id="${id}-sub"></p></div><button type="button" class="gp-btn gp-btn-outline gp-btn-sm" data-close-drawer>Close</button></div>
    <div class="crm-drawer-body" id="${id}-body"></div>
  </div>`;

const DESTINATIONS = ['United Kingdom', 'USA', 'Canada', 'Australia', 'Germany', 'Ireland', 'New Zealand', 'Italy', 'Finland', 'MBBS abroad'];
const LEAD_STATUSES = [['new', 'New'], ['contacted', 'Contacted'], ['qualified', 'Qualified'], ['consultation_booked', 'Consultation booked'], ['converted', 'Converted'], ['not_interested', 'Not interested'], ['closed', 'Closed']];

/* ── Student ──────────────────────────────────────────────────────────────── */

page({
    name: 'dashboard-profile.html', area: 'student-profile', script: 'student-area.js?v=1',
    title: 'My profile | Gradmire', description: 'Your study-abroad preferences and contact details.',
    body: main(`${head('My profile', 'Your counsellor uses these details to plan your options. We only ask for what counselling needs.')}
  <section class="bk-panel" aria-labelledby="pf-progress-title"><h2 id="pf-progress-title" class="bk-step-title">Profile completion</h2>
    <div class="ws-meter" id="pf-meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-labelledby="pf-progress-title"><span></span></div><p class="bk-fine" id="pf-meter-text"></p></section>
  <form id="pf-form" class="bk-panel" novalidate>
    <h2 class="bk-step-title">About you</h2>
    <div class="bk-grid">
      ${field('First name', '<input name="firstName" maxlength="120" autocomplete="given-name" required>')}
      ${field('Last name', '<input name="lastName" maxlength="120" autocomplete="family-name">', { optional: true })}
      ${field('Email', '<input name="email" type="email" readonly aria-describedby="pf-email-help">')}
      ${field('Phone (with country code)', '<input name="phone" type="tel" maxlength="30" autocomplete="tel" placeholder="+91 98765 43210">')}
    </div>
    <p class="bk-fine" id="pf-email-help">To change your email address, contact Gradmire support so we can verify the new one.</p>
    <h2 class="bk-step-title">Study plans</h2>
    <fieldset class="bk-fieldset"><legend class="bk-help">Preferred destinations (up to 5)</legend>
      <div class="ws-checks">${DESTINATIONS.map((d) => `<label class="bk-check"><input type="checkbox" name="destinations" value="${esc(d)}"> ${esc(d)}</label>`).join('')}</div></fieldset>
    <div class="bk-grid">
      ${field('Intended intake', '<input name="intendedIntake" maxlength="40" placeholder="e.g. September 2027">')}
      ${field('Study level', `<select name="studyLevel">${options([['Undergraduate', 'Undergraduate'], ['Postgraduate', 'Postgraduate'], ['PhD / Research', 'PhD / Research'], ['MBBS / Medicine', 'MBBS / Medicine'], ['Foundation / Diploma', 'Foundation / Diploma']], 'Choose…')}</select>`)}
      ${field('Preferred course or field', '<input name="preferredCourse" maxlength="200">', { wide: true })}
      ${field('Highest qualification', '<input name="highestQualification" maxlength="200" placeholder="e.g. B.Tech Computer Science">')}
      ${field('Score', '<input name="academicScore" maxlength="80" placeholder="e.g. 8.1 CGPA">', { optional: true })}
      ${field('English test', `<select name="englishTest">${options([['IELTS', 'IELTS'], ['TOEFL', 'TOEFL'], ['PTE', 'PTE'], ['Duolingo', 'Duolingo'], ['Not taken yet', 'Not taken yet'], ['Not required', 'Not required']], 'Choose…')}</select>`)}
      ${field('English score', '<input name="englishScore" maxlength="40">', { optional: true })}
      ${field('Budget per year', `<select name="budgetRange">${options([['Under ₹10 lakh', 'Under ₹10 lakh'], ['₹10–20 lakh', '₹10–20 lakh'], ['₹20–35 lakh', '₹20–35 lakh'], ['Over ₹35 lakh', 'Over ₹35 lakh'], ['Not sure yet', 'Not sure yet']], 'Choose…')}</select>`)}
      ${field('Consultation language', `<select name="consultationLanguage">${options([['English', 'English'], ['Hindi', 'Hindi'], ['Either', 'English or Hindi']], 'Choose…')}</select>`)}
    </div>
    <p class="bk-alert" id="pf-error" role="alert" hidden></p>
    <div class="bk-actions"><button type="submit" class="gp-btn gp-btn-primary">Save profile</button></div>
  </form>`),
});

page({
    name: 'dashboard-notifications.html', area: 'notifications', script: 'student-area.js?v=1',
    title: 'Notifications | Gradmire', description: 'Updates about your account, bookings and applications.',
    body: main(`${head('Notifications', 'Updates about your account, consultations and applications.', '<button type="button" class="gp-btn gp-btn-outline gp-btn-sm" id="nt-read-all">Mark all as read</button>')}
  <div class="bk-tabs" role="tablist" aria-label="Filter notifications"><button type="button" class="bk-tab" role="tab" aria-selected="true" data-filter="all">All</button><button type="button" class="bk-tab" role="tab" aria-selected="false" data-filter="unread">Unread</button></div>
  <ul class="ws-feed" id="nt-list" aria-live="polite"><li class="bk-empty">Loading…</li></ul>`),
});

page({
    name: 'dashboard-become-consultant.html', area: 'become-consultant', script: 'student-area.js?v=1',
    title: 'Become a Gradmire consultant | Gradmire', description: 'Apply to join Gradmire as a study-abroad consultant.',
    body: main(`${head('Become a consultant', 'Apply to join Gradmire as a study-abroad consultant. Applying does not change your account; access is given only after hiring and onboarding are approved.')}
  <div id="bc-status"></div>
  <form id="bc-form" class="bk-panel" novalidate hidden>
    <h2 class="bk-step-title" id="bc-form-title">Your application</h2>
    <div class="bk-grid">
      ${field('Full name', '<input name="fullName" maxlength="240" autocomplete="name" required>')}
      ${field('Phone (with country code)', '<input name="phone" type="tel" maxlength="30" autocomplete="tel" required>')}
      ${field('Current location', '<input name="location" maxlength="120" placeholder="City, country" required>')}
      ${field('Years of relevant experience', '<input name="yearsExperience" type="number" min="0" max="60" step="1" required>')}
      ${field('Availability', `<select name="availability" required>${options([['full_time', 'Full time'], ['part_time', 'Part time'], ['contract', 'Contract']], 'Choose…')}</select>`)}
      ${field('Languages you speak', '<input name="languages" maxlength="300" placeholder="e.g. English, Hindi, Punjabi">')}
      ${field('Professional experience', '<textarea name="professionalExperience" rows="4" maxlength="3000" required></textarea>', { wide: true })}
      ${field('Education and qualifications', '<textarea name="education" rows="3" maxlength="2000" required></textarea>', { wide: true })}
      ${field('Study-abroad or counselling experience', '<textarea name="counsellingExperience" rows="3" maxlength="3000"></textarea>', { wide: true, optional: true })}
      ${field('Areas of expertise', '<input name="expertise" maxlength="300" placeholder="e.g. UK, Canada, MBBS abroad, visas">', { wide: true, optional: true })}
      ${field('Link to your CV (https://)', '<input name="cvUrl" type="url" maxlength="500" placeholder="https://drive.example.com/…" aria-describedby="bc-cv-help">', { wide: true, optional: true })}
      ${field('Anything else we should know', '<textarea name="additionalInfo" rows="3" maxlength="2000"></textarea>', { wide: true, optional: true })}
    </div>
    <p class="bk-fine" id="bc-cv-help">We cannot store uploaded files yet. Share a link that only people with the link can open; only Gradmire reviewers see it.</p>
    <label class="bk-check" id="bc-consent-row"><input type="checkbox" name="consent"> I agree that Gradmire may use these details to assess my application and contact me about it.</label>
    <p class="bk-alert" id="bc-error" role="alert" hidden></p>
    <div class="bk-actions"><button type="button" class="gp-btn gp-btn-outline" id="bc-cancel" hidden>Cancel</button><button type="submit" class="gp-btn gp-btn-primary" id="bc-submit">Submit application</button></div>
  </form>`),
});

page({
    name: 'join-team.html', area: 'join-team', script: 'student-area.js?v=1', workspace: false,
    title: 'Join the Gradmire team | Gradmire', description: 'Accept your invitation to join Gradmire.',
    body: main(`${head('Join the Gradmire team', 'Accept the invitation you received by email.')}
  <section class="bk-panel ws-narrow" aria-live="polite" id="jt-box"><p class="bk-empty">Checking your invitation…</p></section>`),
});

page({
    name: 'find-booking.html', area: 'find-booking', script: 'student-area.js?v=1', workspace: false,
    title: 'Find my booking | Gradmire', description: 'Get the link to view, reschedule or cancel your consultation.',
    body: main(`${head('Find my booking', 'Booked without an account and lost the confirmation email? We will send the booking link again.')}
  <form id="fb-form" class="bk-panel ws-narrow" novalidate>
    ${field('The email address you booked with', '<input name="email" type="email" autocomplete="email" required>')}
    <input class="bk-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <p class="bk-alert" id="fb-result" role="status" hidden></p>
    <div class="bk-actions"><button type="submit" class="gp-btn gp-btn-primary">Send my booking link</button></div>
    <p class="bk-fine">For your security, the link goes only to the email address used for the booking. Have an account? <a href="login.html?next=dashboard-consultations.html">Log in</a> to see every booking.</p>
  </form>`),
});

/* ── Consultant ───────────────────────────────────────────────────────────── */

page({
    name: 'consultant-dashboard.html', area: 'consultant-dashboard', script: 'staff-area.js?v=1',
    title: 'My workspace | Gradmire staff', description: 'Your consultations, students, enquiries and follow-ups.',
    body: main(`${head('My workspace', 'Your consultations, students, enquiries and follow-ups.')}
  <div class="crm-stats" id="cd-stats" aria-label="Your workload"></div>
  <div class="ws-grid">
    <section class="bk-panel" aria-labelledby="cd-today-title"><h2 id="cd-today-title" class="bk-step-title">Today</h2><ul class="ws-list" id="cd-today"><li class="bk-empty">Loading…</li></ul></section>
    <section class="bk-panel" aria-labelledby="cd-next-title"><h2 id="cd-next-title" class="bk-step-title">Next 7 days</h2><ul class="ws-list" id="cd-upcoming"><li class="bk-empty">Loading…</li></ul></section>
    <section class="bk-panel" aria-labelledby="cd-leads-title"><h2 id="cd-leads-title" class="bk-step-title">New enquiries assigned to you</h2><ul class="ws-list" id="cd-leads"><li class="bk-empty">Loading…</li></ul></section>
    <section class="bk-panel" aria-labelledby="cd-deadlines-title"><h2 id="cd-deadlines-title" class="bk-step-title">Application deadlines (30 days)</h2><ul class="ws-list" id="cd-deadlines"><li class="bk-empty">Loading…</li></ul></section>
  </div>`),
});

page({
    name: 'consultant-students.html', area: 'consultant-students', script: 'staff-area.js?v=1',
    title: 'My students | Gradmire staff', description: 'Students assigned to you.',
    body: main(`${head('Students', 'Students who booked with you or whose enquiry is assigned to you.')}
  <form class="crm-filters" id="st-filters" role="search" aria-label="Filter students">
    ${field('Search', '<input name="q" type="search" maxlength="100" placeholder="Name or email">').replace('gp-field', 'gp-field crm-search')}
    ${field('Destination', `<select name="destination">${options(DESTINATIONS.map((d) => [d, d]), 'Any destination')}</select>`)}
    ${field('Sort by', `<select name="sort">${options([['recent', 'Last interaction'], ['follow_up', 'Next follow-up'], ['name', 'Name']])}</select>`)}
    <button class="gp-btn gp-btn-primary gp-btn-sm" type="submit">Apply</button>
  </form>
  ${table('st-rows', ['Student', 'Destinations', 'Intake', 'Applications', 'Last interaction', 'Next follow-up', 'Consultant'], 'Students')}
  ${pager('st')}`),
});

const leadsBody = (admin) => main(`${head('Enquiries', admin ? 'Every enquiry from the website forms and bookings. Assign each one to a consultant.' : 'Enquiries assigned to you. Record each contact attempt and the outcome.')}
  <form class="crm-filters" id="ld-filters" role="search" aria-label="Filter enquiries">
    ${field('Search', '<input name="q" type="search" maxlength="100" placeholder="Name, email or phone">').replace('gp-field', 'gp-field crm-search')}
    ${field('Status', `<select name="status">${options([['open', 'Open'], ...LEAD_STATUSES], 'Any status')}</select>`)}
    ${field('Source', `<select name="source">${options([['consultation', 'Consultation request'], ['contact', 'Contact form'], ['booking', 'Booking'], ['newsletter', 'Newsletter']], 'Any source')}</select>`)}
    ${admin ? field('Assigned to', '<select name="assigned" id="ld-assigned"><option value="">Anyone</option><option value="none">Unassigned</option></select>') : ''}
    <label class="bk-check"><input type="checkbox" name="guest" value="true"> Guests only</label>
    <label class="bk-check"><input type="checkbox" name="follow_up_due" value="true"> Follow-up due</label>
    <button class="gp-btn gp-btn-primary gp-btn-sm" type="submit">Apply</button>
  </form>
  ${table('ld-rows', ['Received', 'Name', 'Source', 'Interest', 'Status', 'Assigned', 'Next follow-up'], 'Enquiries')}
  ${pager('ld')}
  ${drawer('ld-drawer')}`);

page({ name: 'consultant-leads.html', area: 'leads', script: 'staff-area.js?v=1', title: 'My enquiries | Gradmire staff', description: 'Enquiries assigned to you.', body: leadsBody(false) });
page({ name: 'admin-leads.html', area: 'leads', script: 'staff-area.js?v=1', title: 'Enquiries | Gradmire admin', description: 'Manage enquiries and assign them to consultants.', body: leadsBody(true) });

page({
    name: 'consultant-follow-ups.html', area: 'follow-ups', script: 'staff-area.js?v=1',
    title: 'Follow-ups | Gradmire staff', description: 'Your follow-up tasks.',
    body: main(`${head('Follow-ups', 'Tasks for you, including follow-ups added on consultations.', '<button type="button" class="gp-btn gp-btn-primary gp-btn-sm" id="fu-new">New task</button>')}
  <div class="bk-tabs" role="tablist" aria-label="Filter tasks"><button type="button" class="bk-tab" role="tab" aria-selected="true" data-status="open">Open</button><button type="button" class="bk-tab" role="tab" aria-selected="false" data-status="done">Done</button><button type="button" class="bk-tab" role="tab" aria-selected="false" data-status="all">All</button></div>
  ${table('fu-rows', ['Task', 'Due', 'Priority', 'Linked to', 'Status', ''], 'Follow-up tasks')}`),
});

/* ── Admin ────────────────────────────────────────────────────────────────── */

page({
    name: 'admin.html', area: 'admin-dashboard', script: 'staff-area.js?v=1',
    title: 'Admin overview | Gradmire', description: 'Platform overview for Gradmire administrators.',
    body: main(`${head('Admin overview', 'Live figures from the database. Select a figure to open the matching list.')}
  <div class="crm-stats ws-stats-lg" id="ad-stats" aria-label="Platform figures"></div>
  <section class="bk-panel" aria-labelledby="ad-approvals-title"><h2 id="ad-approvals-title" class="bk-step-title">Waiting for a decision</h2><ul class="ws-list" id="ad-approvals"><li class="bk-empty">Loading…</li></ul></section>`),
});

page({
    name: 'admin-users.html', area: 'admin-users', script: 'staff-area.js?v=1',
    title: 'Users | Gradmire admin', description: 'Search accounts, suspend or reactivate them and request access changes.',
    body: main(`${head('Users', 'Accounts, their roles and history. Roles change only through approved requests.')}
  <form class="crm-filters" id="us-filters" role="search" aria-label="Filter users">
    ${field('Search', '<input name="q" type="search" maxlength="100" placeholder="Name, email or phone">').replace('gp-field', 'gp-field crm-search')}
    ${field('Role', `<select name="role">${options([['student', 'Student'], ['counsellor', 'Consultant'], ['admin', 'Administrator'], ['super_admin', 'Super administrator']], 'Any role')}</select>`)}
    ${field('Status', `<select name="status">${options([['active', 'Active'], ['disabled', 'Suspended']], 'Any status')}</select>`)}
    <button class="gp-btn gp-btn-primary gp-btn-sm" type="submit">Apply</button>
  </form>
  ${table('us-rows', ['Name', 'Email', 'Role', 'Status', 'Email verified', 'Registered'], 'Users')}
  ${pager('us')}
  ${drawer('us-drawer')}`),
});

page({
    name: 'admin-team.html', area: 'admin-team', script: 'staff-area.js?v=1',
    title: 'Team and hiring | Gradmire admin', description: 'Consultant applications, employee invitations and the team.',
    body: main(`${head('Team and hiring', 'Review consultant applications, invite employees and see the team.')}
  <div class="bk-tabs" role="tablist" aria-label="Team sections">
    <button type="button" class="bk-tab" role="tab" aria-selected="true" aria-controls="tm-applications" id="tm-tab-applications" data-tab="applications">Applications</button>
    <button type="button" class="bk-tab" role="tab" aria-selected="false" aria-controls="tm-invitations" id="tm-tab-invitations" data-tab="invitations">Invitations</button>
    <button type="button" class="bk-tab" role="tab" aria-selected="false" aria-controls="tm-employees" id="tm-tab-employees" data-tab="employees">Employees</button>
  </div>
  <section id="tm-applications" role="tabpanel" aria-labelledby="tm-tab-applications">
    <form class="crm-filters" id="ap-filters" aria-label="Filter applications">
      ${field('Status', `<select name="status">${options([['submitted', 'Submitted'], ['info_requested', 'Information requested'], ['under_review', 'Under review'], ['shortlisted', 'Shortlisted'], ['interview_scheduled', 'Interview scheduled'], ['interview_completed', 'Interview completed'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['withdrawn', 'Withdrawn']], 'Any status')}</select>`)}
      <button class="gp-btn gp-btn-primary gp-btn-sm" type="submit">Apply</button>
    </form>
    ${table('ap-rows', ['Submitted', 'Applicant', 'Experience', 'Availability', 'Status', 'Reviewer'], 'Consultant applications')}
  </section>
  <section id="tm-invitations" role="tabpanel" aria-labelledby="tm-tab-invitations" hidden>
    <form id="iv-form" class="bk-panel" novalidate>
      <h2 class="bk-step-title">Invite an employee</h2>
      <p class="bk-help">The person accepts with the emailed link while logged in to an account with this verified email. A second administrator then approves their access (a super administrator for admin access).</p>
      <div class="bk-grid">
        ${field('Full name', '<input name="fullName" maxlength="240" required>')}
        ${field('Email the invitation is sent to', '<input name="email" type="email" maxlength="320" required>')}
        ${field('Work email', '<input name="workEmail" type="email" maxlength="320">', { optional: true })}
        ${field('Employee ID', '<input name="employeeCode" maxlength="40">', { optional: true })}
        ${field('Department', '<input name="department" maxlength="80" value="Counselling" required>')}
        ${field('Job title', '<input name="jobTitle" maxlength="120" value="Study-abroad consultant" required>')}
        ${field('System role', `<select name="intendedRole">${options([['counsellor', 'Consultant'], ['admin', 'Administrator']])}</select>`)}
        ${field('Reporting manager', '<select name="managerUserId" id="iv-manager"><option value="">None</option></select>', { optional: true })}
        ${field('Start date', '<input name="startDate" type="date">', { optional: true })}
      </div>
      <p class="bk-alert" id="iv-error" role="alert" hidden></p>
      <div class="bk-actions"><button type="submit" class="gp-btn gp-btn-primary">Send invitation</button></div>
    </form>
    ${table('iv-rows', ['Sent', 'Name', 'Email', 'Role', 'Job', 'Status', ''], 'Invitations')}
  </section>
  <section id="tm-employees" role="tabpanel" aria-labelledby="tm-tab-employees" hidden>
    ${table('em-rows', ['Name', 'Job', 'Role', 'Employment', 'Upcoming consultations', 'Open enquiries', 'Since'], 'Employees')}
  </section>
  ${drawer('ap-drawer')}`),
});

page({
    name: 'admin-approvals.html', area: 'admin-approvals', script: 'staff-area.js?v=1',
    title: 'Approvals | Gradmire admin', description: 'Access requests waiting for a decision.',
    body: main(`${head('Approvals', 'Every grant, change or removal of staff access. A request is decided by someone other than the requester and the person it affects.')}
  <form class="crm-filters" id="aq-filters" aria-label="Filter requests">
    ${field('Status', `<select name="status">${options([['pending', 'Pending'], ['info_requested', 'Information requested'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['cancelled', 'Cancelled']], 'Any status')}</select>`)}
    ${field('Type', `<select name="type">${options([['employee_activation', 'Employee activation'], ['role_change', 'Role change'], ['access_revocation', 'Access revocation']], 'Any type')}</select>`)}
    <button class="gp-btn gp-btn-primary gp-btn-sm" type="submit">Apply</button>
  </form>
  ${table('aq-rows', ['Requested', 'Person', 'Change', 'Type', 'Requested by', 'Status'], 'Approval requests')}
  ${pager('aq')}
  ${drawer('aq-drawer')}`),
});

page({
    name: 'admin-audit.html', area: 'admin-audit', script: 'staff-area.js?v=1',
    title: 'Audit log | Gradmire admin', description: 'Who did what, and when.',
    body: main(`${head('Audit log', 'Sensitive account and staff actions. Passwords, tokens and one-time codes are never recorded.')}
  <form class="crm-filters" id="au-filters" role="search" aria-label="Filter the audit log">
    ${field('Action starts with', '<input name="action" maxlength="60" placeholder="e.g. role. or user.suspended">')}
    ${field('Record type', `<select name="entity_type">${options([['user', 'User'], ['consultation', 'Consultation'], ['lead', 'Enquiry'], ['consultant_application', 'Consultant application'], ['employee_invitation', 'Invitation'], ['follow_up_task', 'Follow-up task']], 'Any')}</select>`)}
    ${field('Record id', '<input name="entity_id" maxlength="64">')}
    ${field('From', '<input name="from" type="date">')}
    ${field('To', '<input name="to" type="date">')}
    <button class="gp-btn gp-btn-primary gp-btn-sm" type="submit">Apply</button>
  </form>
  ${table('au-rows', ['When', 'Who', 'Action', 'Record', 'Details'], 'Audit events')}
  ${pager('au')}`),
});

console.log('Built role-based workspace pages');
