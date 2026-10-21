/* Builds the signed-in pages for application status:
     dashboard.html       the student's dashboard (journey, applications, next consultation)
     admin-students.html  staff: find a student and record their applications
   Run from the repository root:  node scripts/build-dashboard-pages.mjs
   Data comes from the API at runtime (assets/student-dashboard.js, assets/admin-students.js). */
import { shell, write } from './page-shell.mjs';

const BOOKING_CSS = 'booking.css?v=2';
const API_JS = 'api.js?v=5';
const COMMON_JS = 'booking-common.js?v=1';
const WORKSPACE_CSS = 'workspace.css?v=2';
const WORKSPACE_JS = 'workspace.js?v=4';

function page({ name, title, description, body, script, workspace = false }) {
    let html = shell({ title, description, body: workspace ? `<div class="ws-layout"><nav class="ws-nav" id="ws-nav" aria-label="Workspace"></nav>${body}</div>` : body, bodyClass: 'bk-page' });
    html = html.replace('</head>', `<link rel="stylesheet" href="../assets/${BOOKING_CSS}">\n${workspace ? `<link rel="stylesheet" href="../assets/${WORKSPACE_CSS}">\n` : ''}<meta name="robots" content="noindex, nofollow">\n</head>`);
    html = html.replace('</body>', `<script src="../assets/${API_JS}" defer></script>\n<script src="../assets/${COMMON_JS}" defer></script>\n${workspace ? `<script src="../assets/${WORKSPACE_JS}" defer></script>\n` : ''}<script src="../assets/${script}" defer></script>\n</body>`);
    write(name, html);
}

const STAGES = [
    ['account', 'Account created'],
    ['consultation', 'Consultation booked'],
    ['counselled', 'Counselling done'],
    ['applying', 'Applying'],
    ['offer', 'Offer received'],
    ['visa', 'Visa'],
    ['enrolled', 'Enrolled']
];

const dashboardBody = `<main class="bk-main sd-main ws-main" id="main">
  <div class="crm-head">
    <div><h1 id="sd-title">My dashboard</h1><p id="sd-greeting">Loading your account…</p></div>
    <div class="bk-actions"><a class="gp-btn gp-btn-outline gp-btn-sm" href="find-courses">Explore universities</a><a class="gp-btn gp-btn-primary gp-btn-sm" href="book-consultation">Book a consultation</a></div>
  </div>
  <p class="bk-alert" id="sd-alert" role="status" hidden></p>
  <p class="bk-alert" id="ws-alert" role="status" hidden></p>
  <div id="sd-verify" class="bk-alert bk-alert--info" hidden></div>

  <div class="crm-stats" id="sd-stats" aria-label="Your summary"></div>
  <div class="ws-grid">
    <section class="bk-panel" aria-labelledby="sd-steps-title">
      <h2 id="sd-steps-title" class="bk-step-title">Recommended next steps</h2>
      <div class="ws-meter" id="sd-meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="Profile completion"><span></span></div>
      <p class="bk-fine" id="sd-meter-text"></p>
      <ul class="ws-list" id="sd-steps"><li class="bk-empty">Loading…</li></ul>
    </section>
    <section class="bk-panel" aria-labelledby="sd-notes-title">
      <h2 id="sd-notes-title" class="bk-step-title">Recent notifications</h2>
      <ul class="ws-list" id="sd-notes"><li class="bk-empty">Loading…</li></ul>
      <p class="bk-fine"><a href="dashboard-notifications">All notifications</a></p>
    </section>
  </div>

  <section class="bk-panel sd-journey" aria-labelledby="sd-journey-title">
    <h2 id="sd-journey-title" class="bk-step-title">Your study-abroad journey</h2>
    <p class="bk-help" id="sd-journey-summary">Your progress updates as your counsellor records each step.</p>
    <ol class="sd-stages" id="sd-stages">
${STAGES.map(([key, label]) => `      <li class="sd-stage" data-stage="${key}"><span class="sd-dot" aria-hidden="true"></span><span class="sd-stage-label">${label}</span><span class="sr-only sd-stage-state"></span></li>`).join('\n')}
    </ol>
  </section>

  <div class="sd-grid">
    <section class="bk-panel" id="applications" aria-labelledby="sd-apps-title">
      <h2 id="sd-apps-title" class="bk-step-title">Application status</h2>
      <div id="sd-apps" class="sd-apps" aria-live="polite"><p class="bk-empty">Loading your applications…</p></div>
    </section>
    <aside class="sd-side">
      <section class="bk-panel" aria-labelledby="sd-next-title">
        <h2 id="sd-next-title" class="bk-step-title">Next consultation</h2>
        <div id="sd-next"><p class="bk-empty">Loading…</p></div>
      </section>
      <section class="bk-panel" aria-labelledby="sd-tools-title">
        <h2 id="sd-tools-title" class="bk-step-title">Plan your next steps</h2>
        <ul class="sd-links">
          <li><a href="find-courses">Course Finder</a></li>
          <li><a href="scholarships">Scholarships</a></li>
          <li><a href="tools/deadline-tracker">Deadline tracker</a></li>
          <li><a href="tools/roi-calculator">Study cost calculator</a></li>
          <li><a href="tools/comparator">Course comparator</a></li>
        </ul>
      </section>
    </aside>
  </div>
</main>`;

page({ name: 'dashboard.html', title: 'My dashboard | Gradmire', description: 'Your study-abroad journey, application status and consultations with Gradmire.', body: dashboardBody, script: 'student-dashboard.js?v=3', workspace: true });

const STATUS_OPTIONS = [
    ['shortlisted', 'Shortlisted'], ['preparing', 'Preparing application'], ['submitted', 'Submitted'],
    ['offer_conditional', 'Conditional offer'], ['offer_unconditional', 'Unconditional offer'], ['accepted', 'Offer accepted'],
    ['visa_applied', 'Visa applied'], ['visa_granted', 'Visa granted'], ['enrolled', 'Enrolled'],
    ['rejected', 'Unsuccessful'], ['withdrawn', 'Withdrawn']
];

const adminBody = `<main class="bk-main crm-main" id="main">
  <div class="crm-head">
    <div><h1>Student applications</h1><p id="as-greeting">Record each student’s applications. Students see the status and the note on their dashboard.</p></div>
    <div class="bk-actions"><a class="gp-btn gp-btn-outline gp-btn-sm" href="admin-consultations">Consultations CRM</a></div>
  </div>
  <p class="bk-alert" id="as-alert" role="status" hidden></p>
  <div class="as-layout">
    <section class="bk-panel" aria-labelledby="as-find-title">
      <h2 id="as-find-title" class="bk-step-title">Find a student</h2>
      <form id="as-search" class="as-search" role="search">
        <label class="sr-only" for="as-q">Search students by name or email</label>
        <input id="as-q" type="search" placeholder="Name or email" autocomplete="off">
        <button type="submit" class="gp-btn gp-btn-primary gp-btn-sm">Search</button>
      </form>
      <p class="bk-fine">Counsellors see students who have booked a consultation with them.</p>
      <ul id="as-students" class="as-students" aria-live="polite"></ul>
    </section>
    <section class="bk-panel" aria-labelledby="as-student-title">
      <h2 id="as-student-title" class="bk-step-title">Select a student</h2>
      <div id="as-apps"><p class="bk-empty">Choose a student to see and edit their applications.</p></div>
      <form id="as-form" class="as-form" hidden novalidate>
        <h3 id="as-form-title">Add an application</h3>
        <input type="hidden" name="id">
        <div class="bk-grid">
          <label class="gp-field"><span>University</span><input name="university" maxlength="200" required></label>
          <label class="gp-field"><span>Course</span><input name="course" maxlength="200" required></label>
          <label class="gp-field"><span>Country <em>(optional)</em></span><input name="country" maxlength="80"></label>
          <label class="gp-field"><span>Intake <em>(optional)</em></span><input name="intake" maxlength="40" placeholder="e.g. Sep 2027"></label>
          <label class="gp-field"><span>Status</span><select name="status">${STATUS_OPTIONS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
          <label class="gp-field"><span>Deadline <em>(optional)</em></span><input name="deadline" type="date"></label>
          <label class="gp-field bk-wide"><span>Note for the student <em>(shown on their dashboard)</em></span><textarea name="studentNote" maxlength="1000" rows="3"></textarea></label>
        </div>
        <p class="bk-alert" id="as-form-error" role="alert" hidden></p>
        <div class="bk-actions"><button type="button" class="gp-btn gp-btn-outline" id="as-cancel">Cancel</button><button type="submit" class="gp-btn gp-btn-primary" id="as-save">Save application</button></div>
      </form>
    </section>
  </div>
</main>`;

page({ name: 'admin-students.html', title: 'Student applications | Gradmire staff', description: 'Record and update student applications.', body: adminBody, script: 'admin-students.js?v=2' });

console.log('Built dashboard.html and admin-students.html');
