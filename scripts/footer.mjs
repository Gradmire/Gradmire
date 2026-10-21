/* The one site footer. scripts/sync-footer.mjs writes it into every page and the
   page builders use it directly; styles live in assets/site.css (.gm-footer).
   `prefix` is the path from the page to frontend/pages/ ('' or '../'). */

const columns = [
    ['Destinations', [
        ['United Kingdom', 'study-in-uk'], ['USA', 'study-in-usa'], ['Canada', 'study-in-canada'],
        ['Australia', 'study-in-australia'], ['Germany', 'study-in-germany'], ['Ireland', 'study-in-ireland'],
        ['New Zealand', 'study-in-newzealand'], ['Italy', 'study-in-italy'], ['Finland', 'study-in-finland'],
        ['MBBS abroad', 'mbbs-abroad']
    ]],
    ['Services', [
        ['Free counselling', 'free-consultation.html?interest=counselling'], ['Test preparation', 'test-preparation'],
        ['Visa assistance', 'visa-assistance'], ['Application assistance', 'application-assistance'],
        ['Course selection guidance', 'course-selection-guidance'], ['Scholarships', 'scholarships']
    ]],
    ['Tools', [
        ['Course finder', 'find-courses'], ['Study cost calculator', 'tools/roi-calculator'],
        ['Course comparator', 'tools/comparator'], ['Deadline tracker', 'tools/deadline-tracker'],
        ['GPA / CGPA / SGPA converter', 'tools/grade-converter']
    ]],
    ['Company', [
        ['About us', 'about'], ['Blog', 'blog'], ['Events', 'events'],
        ['FAQs', 'faq'], ['Contact', 'contact'], ['Student login', 'login']
    ]]
];

const legal = [
    ['Privacy', 'privacy'], ['Terms', 'terms'], ['Refunds &amp; fees', 'refund-policy'],
    ['Cookies', 'cookie-policy'], ['Your data rights', 'data-request'], ['Grievance', 'grievance']
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
  <div class="gm-legal-bar gm-legal-bar--dark"><p class="gm-legal-entity">© 2026 Gradmire Education Pvt. Ltd. · Registered office: World Trade Tower, Barakhamba Lane, New Delhi 110001, India · Email: <a href="mailto:info@gradmire.com">info@gradmire.com</a></p><nav class="gm-legal-links" aria-label="Legal">${legal.map(([label, path]) => `<a href="${href(path)}">${label}</a>`).join('')}<button type="button" data-cookie-settings>Cookie settings</button></nav></div>
</footer>`;
}
