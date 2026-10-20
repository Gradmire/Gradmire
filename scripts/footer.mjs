/* The one site footer. scripts/sync-footer.mjs writes it into every page and the
   page builders use it directly; styles live in assets/site.css (.gm-footer).
   `prefix` is the path from the page to frontend/pages/ ('' or '../'). */

const columns = [
    ['Destinations', [
        ['United Kingdom', 'study-in-uk.html'], ['USA', 'study-in-usa.html'], ['Canada', 'study-in-canada.html'],
        ['Australia', 'study-in-australia.html'], ['Germany', 'study-in-germany.html'], ['Ireland', 'study-in-ireland.html'],
        ['New Zealand', 'study-in-newzealand.html'], ['Italy', 'study-in-italy.html'], ['Finland', 'study-in-finland.html'],
        ['MBBS abroad', 'mbbs-abroad.html']
    ]],
    ['Services', [
        ['Free counselling', 'free-consultation.html?interest=counselling'], ['Test preparation', 'test-preparation.html'],
        ['Visa assistance', 'visa-assistance.html'], ['Application assistance', 'application-assistance.html'],
        ['Course selection guidance', 'course-selection-guidance.html'], ['Scholarships', 'scholarships.html']
    ]],
    ['Tools', [
        ['Course finder', 'find-courses.html'], ['Study cost calculator', 'tools/roi-calculator.html'],
        ['Course comparator', 'tools/comparator.html'], ['Deadline tracker', 'tools/deadline-tracker.html'],
        ['GPA / CGPA / SGPA converter', 'tools/grade-converter.html']
    ]],
    ['Company', [
        ['About us', 'about.html'], ['Blog', 'blog.html'], ['Events', 'events.html'],
        ['FAQs', 'faq.html'], ['Contact', 'contact.html'], ['Student login', 'login.html']
    ]]
];

const legal = [
    ['Privacy', 'privacy.html'], ['Terms', 'terms.html'], ['Refunds &amp; fees', 'refund-policy.html'],
    ['Cookies', 'cookie-policy.html'], ['Your data rights', 'data-request.html'], ['Grievance', 'grievance.html']
];

export function footerHtml(prefix = '') {
    const href = (path) => `${prefix}${path}`;
    const cols = columns.map(([title, links]) => `    <nav class="gm-footer-col" aria-label="${title}">
      <h2 class="gm-footer-title">${title}</h2>
      <ul class="gm-footer-links">
${links.map(([label, path]) => `        <li><a href="${href(path)}">${label}</a></li>`).join('\n')}
      </ul>
    </nav>`).join('\n');
    return `<footer class="gm-footer" aria-label="Site footer">
  <div class="gm-footer-inner">
    <div class="gm-footer-brand">
      <a class="gm-footer-logo" href="${href('index.html')}" aria-label="Gradmire home"><img src="${prefix}../assets/gradmire-logo-white.png" alt="Gradmire" width="200" height="54" loading="lazy" decoding="async"></a>
      <p class="gm-footer-tagline">Study abroad, organized by subject — not by flag.</p>
      <form class="footer-subscribe" novalidate><label class="sr-only" for="footer-email">Email address for study-abroad updates</label><input id="footer-email" type="email" name="email" autocomplete="email" placeholder="you@email.com" required><button type="submit" aria-label="Subscribe to updates"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><p class="footer-subscribe-msg" role="status" hidden></p></form>
    </div>
${cols}
  </div>
  <div class="gm-legal-bar gm-legal-bar--dark"><p class="gm-legal-entity">© 2026 Gradmire Education Pvt. Ltd. · Registered office: World Trade Tower, Barakhamba Lane, New Delhi 110001, India · <a href="mailto:privacy@gradmire.in">privacy@gradmire.in</a></p><nav class="gm-legal-links" aria-label="Legal">${legal.map(([label, path]) => `<a href="${href(path)}">${label}</a>`).join('')}<button type="button" data-cookie-settings>Cookie settings</button></nav></div>
</footer>`;
}
