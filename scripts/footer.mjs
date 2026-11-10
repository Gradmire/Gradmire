/* The one site footer. scripts/sync-footer.mjs writes it into every page and the
   page builders use it directly; styles live in assets/site.css (.gm-footer).
   `prefix` is the path from the page to frontend/pages/ ('' or '../'). */

import { socialHtml } from './social.mjs';

const columns = [
    ['Destinations', [
        ['United Kingdom', 'study-in-uk'], ['USA', 'study-in-usa'], ['Canada', 'study-in-canada'],
        ['Australia', 'study-in-australia'], ['Germany', 'study-in-germany'], ['Ireland', 'study-in-ireland'],
        ['New Zealand', 'study-in-newzealand'], ['Italy', 'study-in-italy'], ['Finland', 'study-in-finland'],
        ['MBBS abroad', 'mbbs-abroad']
    ]],
    ['Services', [
        ['Free counselling', 'free-consultation?interest=counselling'], ['Test preparation', 'test-preparation'],
        ['Visa assistance', 'visa-assistance'], ['Application assistance', 'application-assistance'],
        ['Course selection guidance', 'course-selection-guidance'], ['Scholarships', 'scholarships']
    ]],
    ['Tools and guides', [
        ['Course finder', 'find-courses'], ['Study cost calculator', 'tools/roi-calculator'],
        ['Course comparator', 'tools/comparator'], ['Deadline tracker', 'tools/deadline-tracker'],
        ['GPA / CGPA / SGPA converter', 'tools/grade-converter'],
        ['Study abroad 2027 plan', 'study-abroad-2027'], ['2027 intakes by country', 'study-abroad-intakes-2027']
    ]],
    ['Company', [
        ['About us', 'about'], ['Blog', 'blog'], ['Careers', 'career'],
        ['FAQs', 'faq'], ['Contact', 'contact'], ['Press kit', 'press'], ['Student login', 'login']
    ]]
];

/* The third value marks links that phones hide in the footer (they are in the phone menu instead). */
const legal = [
    ['Privacy', 'privacy'], ['Terms', 'terms'], ['Refunds &amp; fees', 'refund-policy', true],
    ['Cookies', 'cookie-policy', true], ['Your data rights', 'data-request', true], ['Grievance', 'grievance', true], ['Photo credits', 'photo-credits', true]
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
      <a class="gm-footer-logo" href="${prefix || './'}" aria-label="Gradmire home"><img src="${prefix}../assets/gradmire-logo-white-sm.png" alt="Gradmire" width="200" height="54" loading="lazy" decoding="async"></a>
      <p class="gm-footer-tagline">Study abroad, organized by subject — not by flag.</p>
      <form class="footer-subscribe" novalidate><label class="sr-only" for="footer-email">Email address for study-abroad updates</label><input id="footer-email" type="email" name="email" autocomplete="email" placeholder="you@email.com" required><button type="submit" aria-label="Subscribe to updates"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><p class="footer-subscribe-msg" role="status" hidden></p></form>
      ${socialHtml()}
    </div>
${cols}
  </div>
  <div class="gm-legal-bar gm-legal-bar--dark"><p class="gm-legal-entity">© 2026 Gradmire Education Pvt. Ltd. · Offices: Kanpur (Near Halim College, Prem Nagar) and Greater Noida (N2 Tower, Supertech Ecovillage 1) · Email: <a href="mailto:info@gradmire.com">info@gradmire.com</a></p><nav class="gm-legal-links" aria-label="Legal">${legal.map(([label, path, more]) => `<a${more ? ' class="gm-legal-more"' : ''} href="${href(path)}">${label}</a>`).join('')}<button type="button" data-cookie-settings>Cookie settings</button></nav></div>
</footer>`;
}
