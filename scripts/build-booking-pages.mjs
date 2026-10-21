/* Builds the consultation booking pages into frontend/pages/:
     book-consultation.html       public booking flow           (/book-consultation)
     manage-consultation.html     guest "manage my booking" link
     dashboard-consultations.html student's consultations       (/dashboard/consultations)
     admin-consultations.html     staff consultations CRM       (/admin/consultations)
   Run from the repository root:  node scripts/build-booking-pages.mjs
   All data is loaded from the API at runtime; nothing here is sample data. */
import { esc, hero, shell, write } from './page-shell.mjs';

const BOOKING_CSS = 'booking.css?v=2';
const API_JS = 'api.js?v=4';
const COMMON_JS = 'booking-common.js?v=1';

/* Adds the booking stylesheet, robots policy and page scripts to a shell page. */
function page({ name, title, description, body, script, bodyClass = '', noindex = false }) {
    let html = shell({ title, description, body, bodyClass });
    html = html.replace('</head>', `<link rel="stylesheet" href="../assets/${BOOKING_CSS}">\n${noindex ? '<meta name="robots" content="noindex, nofollow">\n' : ''}</head>`);
    html = html.replace('</body>', `<script src="../assets/${API_JS}" defer></script>\n<script src="../assets/${COMMON_JS}" defer></script>\n<script src="../assets/${script}" defer></script>\n</body>`);
    write(name, html);
}

const COUNTRY_CODES = [
    ['+91', 'India'], ['+977', 'Nepal'], ['+880', 'Bangladesh'], ['+94', 'Sri Lanka'], ['+92', 'Pakistan'],
    ['+971', 'UAE'], ['+966', 'Saudi Arabia'], ['+974', 'Qatar'], ['+65', 'Singapore'], ['+60', 'Malaysia'],
    ['+44', 'UK'], ['+1', 'USA / Canada'], ['+61', 'Australia'], ['+64', 'New Zealand'], ['+353', 'Ireland'],
    ['+49', 'Germany'], ['+39', 'Italy'], ['+358', 'Finland'], ['+234', 'Nigeria'], ['+254', 'Kenya'],
];
const DESTINATIONS = ['United Kingdom', 'USA', 'Canada', 'Australia', 'Germany', 'Ireland', 'New Zealand', 'Italy', 'Finland', 'MBBS abroad', 'Not sure yet'];
const DEGREES = ['Undergraduate', 'Postgraduate', 'PhD / Research', 'MBBS / Medicine', 'Foundation / Diploma', 'Not sure yet'];

const options = (items, placeholder) => `<option value="">${esc(placeholder)}</option>${items.map((item) => `<option>${esc(item)}</option>`).join('')}`;
const field = (label, control, { wide = false, optional = false, error = '' } = {}) => `<label class="gp-field${wide ? ' bk-wide' : ''}"><span>${esc(label)}${optional ? ' <em>(optional)</em>' : ''}</span>${control}${error ? `<span class="bk-field-error" data-error-for="${error}" hidden></span>` : ''}</label>`;

/* ── /book-consultation ───────────────────────────────────────────────────── */

const bookBody = `${hero({
    crumbs: [['Home', './'], ['Book a consultation', '']],
    eyebrow: 'Book a consultation',
    title: 'Pick a time to talk with a Gradmire counsellor',
    intro: 'Choose what you want to cover, pick a slot that suits you and tell us a little about your plans. You do not need an account to book.',
    actions: '<ul class="bk-facts"><li>Real-time availability</li><li>Video or phone</li><li>Reschedule or cancel online</li></ul>',
    form: '',
}).replace('class="gp-hero"', 'class="gp-hero bk-hero"')}
<main class="bk-main" id="main">
  <noscript><p class="bk-alert">Booking needs JavaScript. You can also <a href="free-consultation">send a consultation request</a> and we will call you back.</p></noscript>
  <div id="bk-flow">
  <form id="bk-form" class="bk-layout" method="post" novalidate>
    <div>
      <p class="bk-alert" id="bk-error" role="alert" hidden></p>
      <section class="bk-panel" aria-labelledby="bk-step-type">
        <h2 class="bk-step-title" id="bk-step-type"><span class="bk-step-num">1</span>What would you like to discuss?</h2>
        <fieldset class="bk-fieldset">
          <legend class="sr-only">Consultation type</legend>
          <div class="bk-types" id="bk-types" aria-live="polite"><p class="bk-empty">Loading consultation types…</p></div>
        </fieldset>
        <fieldset class="bk-fieldset">
          <legend class="sr-only">Meeting method</legend>
          <div class="bk-methods" id="bk-methods"></div>
        </fieldset>
      </section>

      <section class="bk-panel" aria-labelledby="bk-step-time">
        <h2 class="bk-step-title" id="bk-step-time"><span class="bk-step-num">2</span>Choose a date and time</h2>
        <div class="bk-dates" id="bk-dates" role="group" aria-label="Dates"></div>
        <div class="bk-tz"><label for="bk-tz">Times shown in</label><select id="bk-tz"></select></div>
        <div class="bk-slots" id="bk-slots" role="group" aria-label="Available times" aria-live="polite"></div>
        <span class="bk-field-error" data-error-for="start" hidden></span>
      </section>

      <section class="bk-panel" aria-labelledby="bk-step-details">
        <h2 class="bk-step-title" id="bk-step-details"><span class="bk-step-num">3</span>Your details</h2>
        <div id="bk-signed-in" class="bk-signed-in" hidden></div>
        <div class="bk-grid" id="bk-contact">
          ${field('Full name', '<input name="fullName" type="text" autocomplete="name" maxlength="240" required>', { wide: true, error: 'fullName' })}
          ${field('Email address', '<input name="email" type="email" autocomplete="email" maxlength="320" required>', { error: 'email' })}
          ${field('Phone number', `<span class="bk-phone"><select name="phoneCode" aria-label="Country code">${COUNTRY_CODES.map(([code, country]) => `<option value="${code}">${esc(`${code} ${country}`)}</option>`).join('')}</select><input name="phoneNumber" type="tel" inputmode="tel" autocomplete="tel-national" maxlength="20" required aria-label="Phone number"></span>`, { error: 'phone' })}
        </div>
        <div class="bk-grid" style="margin-top:.8rem">
          ${field('Preferred destination', `<select name="destination">${options(DESTINATIONS, 'Select a destination')}</select>`, { optional: true })}
          ${field('Intended degree', `<select name="degree">${options(DEGREES, 'Select a level')}</select>`, { optional: true })}
          ${field('Preferred course', '<input name="course" type="text" maxlength="200" placeholder="e.g. MSc Data Science, or not sure yet">', { optional: true })}
          ${field('Intended intake', '<select name="intake" id="bk-intake"><option value="">Select an intake</option></select>', { optional: true })}
          ${field('Academic background', '<input name="academicSummary" type="text" maxlength="500" placeholder="e.g. B.Tech CSE, 8.1 CGPA, IELTS 7.0">', { wide: true, optional: true })}
          ${field('Anything we should know?', '<textarea name="message" maxlength="2000" rows="3"></textarea>', { wide: true, optional: true, error: 'message' })}
        </div>
        <div class="bk-hp" aria-hidden="true"><label>Leave this empty<input name="website" type="text" tabindex="-1" autocomplete="off"></label></div>
        <label class="bk-check"><input type="checkbox" name="contactConsent" required><span>Gradmire may contact me by email and phone about this consultation. (Required)</span></label>
        <span class="bk-field-error" data-error-for="contactConsent" hidden></span>
        <label class="bk-check"><input type="checkbox" name="remindersOptIn" checked><span>Email me reminders 24 hours and 1 hour before the session.</span></label>
        <label class="bk-check"><input type="checkbox" name="marketingOptIn"><span>Send me occasional scholarship tips and event invites.</span></label>
        <p class="bk-fine">We only ask for what we need to prepare for your consultation. Please do not share passport or bank details here. Under 18? Ask a parent or guardian to join you. <a href="privacy">Privacy policy</a></p>
      </section>
    </div>

    <aside class="bk-panel bk-summary" aria-labelledby="bk-summary-title">
      <h2 id="bk-summary-title">Your booking</h2>
      <dl>
        <div><dt>Consultation</dt><dd id="bk-sum-type">Not chosen yet</dd></div>
        <div><dt>When</dt><dd id="bk-sum-when">Not chosen yet</dd></div>
        <div><dt>How</dt><dd id="bk-sum-method">—</dd></div>
      </dl>
      <button type="submit" class="gp-btn gp-btn-primary" id="bk-submit">Confirm booking</button>
      <p class="bk-fine">Free of charge. You can reschedule or cancel online up to 24 hours before. <span id="bk-account-note">Have an account? <a href="login?next=book-consultation">Log in</a> to see bookings in your dashboard.</span></p>
    </aside>
  </form>
  </div>
  <section id="bk-done" class="bk-panel bk-done" hidden tabindex="-1" aria-live="polite"></section>
</main>`;

page({ name: 'book-consultation.html', title: 'Book a consultation | Gradmire', description: 'Book a free study-abroad consultation with a Gradmire counsellor: pick a topic, a date and a time that suits you.', body: bookBody, script: 'booking.js?v=2', bodyClass: 'bk-page' });

/* ── Guest manage link ────────────────────────────────────────────────────── */

const manageBody = `<main class="bk-main" id="main">
  <div class="crm-head"><div><h1>Your consultation</h1><p>Opened from the link in your confirmation email.</p></div></div>
  <p class="bk-alert" id="mg-error" role="alert" hidden></p>
  <section class="bk-panel" id="mg-view" aria-live="polite"><p class="bk-empty">Loading your booking…</p></section>
</main>
<dialog class="bk-modal" id="mg-reschedule" aria-labelledby="mg-reschedule-title">
  <form method="dialog" class="bk-modal-body" id="mg-reschedule-form">
    <h2 id="mg-reschedule-title">Choose a new time</h2>
    <div class="bk-dates" id="mg-dates" role="group" aria-label="Dates"></div>
    <div class="bk-tz"><label for="mg-tz">Times shown in</label><select id="mg-tz"></select></div>
    <div class="bk-slots" id="mg-slots" role="group" aria-label="Available times" aria-live="polite"></div>
    <p class="bk-alert" id="mg-reschedule-error" role="alert" hidden></p>
  </form>
  <div class="bk-modal-foot"><button type="button" class="gp-btn gp-btn-outline" data-close>Keep current time</button><button type="button" class="gp-btn gp-btn-primary" id="mg-reschedule-confirm" disabled>Move booking</button></div>
</dialog>`;

page({ name: 'manage-consultation.html', title: 'Manage your consultation | Gradmire', description: 'View, reschedule or cancel your Gradmire consultation.', body: manageBody, script: 'manage-consultation.js?v=2', bodyClass: 'bk-page', noindex: true });

/* ── /dashboard/consultations ─────────────────────────────────────────────── */

const dashboardBody = `<main class="bk-main" id="main">
  <div class="crm-head">
    <div><h1>My consultations</h1><p id="mc-greeting">Your booked sessions with Gradmire counsellors.</p></div>
    <div class="bk-actions"><a class="gp-btn gp-btn-outline gp-btn-sm" href="dashboard">Dashboard</a><a class="gp-btn gp-btn-primary gp-btn-sm" href="book-consultation">Book a consultation</a><button type="button" class="gp-btn gp-btn-outline gp-btn-sm" id="mc-logout" hidden>Log out</button></div>
  </div>
  <p class="bk-alert" id="mc-alert" role="status" hidden></p>
  <div id="mc-verify" class="bk-alert bk-alert--info" hidden></div>
  <div class="bk-tabs" role="tablist" aria-label="Consultations">
    <button class="bk-tab" role="tab" id="mc-tab-upcoming" aria-selected="true" aria-controls="mc-list">Upcoming</button>
    <button class="bk-tab" role="tab" id="mc-tab-past" aria-selected="false" aria-controls="mc-list">Previous</button>
  </div>
  <div class="bk-list" id="mc-list" role="tabpanel" aria-live="polite"><p class="bk-empty">Loading your consultations…</p></div>
</main>
<dialog class="bk-modal" id="mc-detail" aria-labelledby="mc-detail-title">
  <div class="bk-modal-body"><h2 id="mc-detail-title">Consultation details</h2><div id="mc-detail-body"></div></div>
  <div class="bk-modal-foot"><button type="button" class="gp-btn gp-btn-outline" data-close>Close</button></div>
</dialog>
<dialog class="bk-modal" id="mc-reschedule" aria-labelledby="mc-reschedule-title">
  <div class="bk-modal-body">
    <h2 id="mc-reschedule-title">Choose a new time</h2>
    <div class="bk-dates" id="mc-dates" role="group" aria-label="Dates"></div>
    <div class="bk-tz"><label for="mc-tz">Times shown in</label><select id="mc-tz"></select></div>
    <div class="bk-slots" id="mc-slots" role="group" aria-label="Available times" aria-live="polite"></div>
    <p class="bk-alert" id="mc-reschedule-error" role="alert" hidden></p>
  </div>
  <div class="bk-modal-foot"><button type="button" class="gp-btn gp-btn-outline" data-close>Keep current time</button><button type="button" class="gp-btn gp-btn-primary" id="mc-reschedule-confirm" disabled>Move booking</button></div>
</dialog>`;

page({ name: 'dashboard-consultations.html', title: 'My consultations | Gradmire', description: 'Your upcoming and previous Gradmire consultations.', body: dashboardBody, script: 'my-consultations.js?v=2', bodyClass: 'bk-page', noindex: true });

/* ── /admin/consultations ─────────────────────────────────────────────────── */

const STATUS_OPTIONS = [['', 'Any status'], ['reserved', 'Reserved (pending)'], ['confirmed', 'Confirmed'], ['completed', 'Completed'], ['no_show', 'No-show'], ['cancelled', 'Cancelled'], ['rescheduled', 'Rescheduled']];

const adminBody = `<main class="bk-main crm-main" id="main">
  <section id="crm-login" class="bk-panel crm-login" hidden aria-labelledby="crm-login-title">
    <h1 id="crm-login-title" class="bk-step-title">Staff sign-in</h1>
    <p class="bk-help">For Gradmire counsellors and administrators.</p>
    <form id="crm-login-form" method="post" novalidate>
      ${field('Email', '<input name="email" type="email" autocomplete="username" required>')}
      ${field('Password', '<input name="password" type="password" autocomplete="current-password" required>')}
      <p class="bk-alert" id="crm-login-error" role="alert" hidden></p>
      <button class="gp-btn gp-btn-primary" type="submit" style="width:100%;margin-top:.8rem">Sign in</button>
    </form>
  </section>

  <div id="crm-app" hidden>
    <div class="crm-head">
      <div><h1>Consultations</h1><p id="crm-who"></p></div>
      <div class="bk-actions"><button type="button" class="gp-btn gp-btn-outline gp-btn-sm" id="crm-refresh">Refresh</button><button type="button" class="gp-btn gp-btn-outline gp-btn-sm" id="crm-logout">Log out</button></div>
    </div>
    <p class="bk-alert" id="crm-alert" role="status" hidden></p>
    <div class="crm-stats" id="crm-stats" aria-label="Overview"></div>
    <form class="crm-filters" id="crm-filters" role="search" aria-label="Filter consultations">
      ${field('Search', '<input name="q" type="search" placeholder="Name, email, phone or reference" maxlength="100">').replace('class="gp-field"', 'class="gp-field crm-search"')}
      ${field('Status', `<select name="status">${STATUS_OPTIONS.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select>`)}
      ${field('Type', '<select name="type" id="crm-type"><option value="">Any type</option></select>')}
      ${field('Counsellor', '<select name="counsellor" id="crm-counsellor"><option value="">Anyone</option></select>')}
      ${field('From', '<input name="from" type="date">')}
      ${field('To', '<input name="to" type="date">')}
      <button class="gp-btn gp-btn-primary gp-btn-sm" type="submit">Apply</button>
      <button class="gp-btn gp-btn-outline gp-btn-sm" type="reset">Clear</button>
    </form>
    <div class="crm-table-wrap">
      <table class="crm-table">
        <caption class="sr-only">Consultations</caption>
        <thead><tr><th scope="col">When</th><th scope="col">Student</th><th scope="col">Type</th><th scope="col">Counsellor</th><th scope="col">Status</th><th scope="col">Source</th></tr></thead>
        <tbody id="crm-rows"><tr><td colspan="6">Loading…</td></tr></tbody>
      </table>
    </div>
    <div class="crm-pager"><span id="crm-count" aria-live="polite"></span><span class="bk-actions"><button type="button" class="gp-btn gp-btn-outline gp-btn-sm" id="crm-prev">Previous</button><button type="button" class="gp-btn gp-btn-outline gp-btn-sm" id="crm-next">Next</button></span></div>
  </div>
</main>
<aside class="crm-drawer" id="crm-drawer" hidden aria-labelledby="crm-drawer-title" role="dialog" aria-modal="false">
  <div class="crm-drawer-head"><div><h2 id="crm-drawer-title">Consultation</h2><p class="bk-help" id="crm-drawer-sub" style="margin:0"></p></div><button type="button" class="gp-btn gp-btn-outline gp-btn-sm" id="crm-drawer-close">Close</button></div>
  <div class="crm-drawer-body" id="crm-drawer-body"></div>
</aside>`;

page({ name: 'admin-consultations.html', title: 'Consultations CRM | Gradmire staff', description: 'Gradmire staff consultations dashboard.', body: adminBody, script: 'admin-consultations.js?v=2', bodyClass: 'bk-page crm-page', noindex: true });

/* ── Password reset ───────────────────────────────────────────────────────── */

const resetBody = `<main class="bk-main" id="main">
  <section class="bk-panel crm-login" aria-labelledby="rp-title">
    <h1 class="bk-step-title" id="rp-title">Reset your password</h1>
    <p class="bk-alert" id="rp-alert" role="status" hidden></p>
    <form id="rp-request" method="post" novalidate>
      <p class="bk-help">Enter the email address of your Gradmire account. If it exists, we will email you a link to choose a new password. The link works once and expires in 60 minutes.</p>
      ${field('Email address', '<input name="email" type="email" autocomplete="email" maxlength="320" required>')}
      <button class="gp-btn gp-btn-primary" type="submit" style="width:100%;margin-top:.8rem">Email me a reset link</button>
    </form>
    <form id="rp-confirm" method="post" novalidate hidden>
      <p class="bk-help">Choose a new password with at least 8 characters. Every device signed in to your account will be signed out.</p>
      ${field('New password', '<input name="password" type="password" autocomplete="new-password" minlength="8" maxlength="200" required>')}
      ${field('Repeat new password', '<input name="repeat" type="password" autocomplete="new-password" minlength="8" maxlength="200" required>')}
      <button class="gp-btn gp-btn-primary" type="submit" style="width:100%;margin-top:.8rem">Save new password</button>
    </form>
    <p class="bk-fine"><a href="login">Back to log in</a></p>
  </section>
</main>`;

page({ name: 'reset-password.html', title: 'Reset your password | Gradmire', description: 'Reset the password for your Gradmire account.', body: resetBody, script: 'reset-password.js?v=1', bodyClass: 'bk-page', noindex: true });

console.log('Built booking pages: book-consultation, manage-consultation, dashboard-consultations, admin-consultations, reset-password');
