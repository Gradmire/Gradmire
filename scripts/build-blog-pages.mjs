/* Builds the 2027 study-abroad articles and the blog index:
     frontend/pages/<slug>.html for each post in blog-data.mjs, and frontend/pages/blog.html (/blog).
   Run from the repository root, then finish the usual way:
     node scripts/build-blog-pages.mjs
     node scripts/sync-footer.mjs && node scripts/sync-seo-tags.mjs && node scripts/sync-mobile-app.mjs && node scripts/build-sitemap.mjs
   Layout pieces come from page-shell.mjs; the article styles are in frontend/assets/blog.css. */
import { esc, section, faq, cta, shell, write } from './page-shell.mjs';
import { posts, PUBLISHED, MODIFIED, REVIEWED_LABEL } from './blog-data.mjs';

const SITE = 'https://www.gradmire.com';
const BLOG_CSS = 'blog.css?v=3';
const crumbs = (items) => items.map(([label, href], i) => (i === items.length - 1
    ? `<span aria-current="page">${esc(label)}</span>`
    : `<a href="${href}">${esc(label)}</a>`)).join(' <span aria-hidden="true">/</span> ');

const articleSchema = (post) => `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.h1,
    description: post.description,
    keywords: post.keywords.join(', '),
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    inLanguage: 'en-IN',
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE}/${post.slug}` },
    image: `${SITE}/assets/og-cover.jpg`,
    author: { '@type': 'Organization', name: 'Gradmire', url: SITE },
    publisher: { '@type': 'Organization', name: 'Gradmire Education Pvt. Ltd.', url: SITE, logo: { '@type': 'ImageObject', url: `${SITE}/assets/gradmire-logo.png` } }
}).replace(/</g, '\\u003c')}</script>`;

/* ── Articles ─────────────────────────────────────────────── */
function buildPost(post, all) {
    const nav = post.sections.map((s) => `<a href="#${s.id}">${esc(s.tag)}</a>`).join('');
    const sections = post.sections.map((s) => section({
        id: s.id, tag: s.tag, title: s.title, lead: s.lead || '', cls: s.cls || '',
        body: s.body === '__FAQ__' ? faq(post.faq) : s.body
    })).join('\n\n');
    const related = post.related.map(([slug, label]) => `<a href="${slug}">${esc(label)}</a>`).join('');
    const sources = post.sources.map(([label, href]) => `<li><a href="${href}" rel="noopener" target="_blank">${esc(label)}</a></li>`).join('');
    const body = `<header class="gp-hero gp-hero--compact bl-hero">
  <div class="gp-hero-inner gp-hero-inner--single">
    <div class="gp-hero-copy">
      <nav class="gp-crumbs" aria-label="Breadcrumb">${crumbs([['Home', './'], ['Blog', 'blog'], [post.eyebrow]])}</nav>
      <span class="gp-eyebrow">${esc(post.eyebrow)}</span>
      <h1>${esc(post.h1)}</h1>
      <p>${esc(post.intro)}</p>
      <p class="bl-meta"><span>Gradmire guide</span><span>Reviewed ${REVIEWED_LABEL}</span><span>${post.readMins} min read</span></p>
    </div>
  </div>
</header>
<nav class="gp-subnav" aria-label="On this page"><div class="gp-subnav-inner">${nav}<a href="#sources">Sources</a></div></nav>
<main id="main" class="bl-article">
${sections}

<section class="gp-section" id="related">
  <span class="gp-tag">Keep reading</span>
  <h2>More 2027 guides</h2>
  <div class="gp-pill-links">${related}</div>
</section>

<section class="gp-section" id="sources">
  <span class="gp-tag">Sources</span>
  <h2>Where to confirm the details</h2>
  <p class="gp-lead-text">Official sources first. Open these before you rely on a date, fee or rule. We last reviewed this guide on ${REVIEWED_LABEL}.</p>
  <ul class="bl-sources">${sources}</ul>
</section>

${cta({ title: post.cta.title, text: post.cta.text, href: 'free-consultation?interest=counselling#book', label: post.cta.label })}
</main>`;
    write(`${post.slug}.html`, shell({
        title: post.title, description: post.description, body, bodyClass: 'blog-page', css: [BLOG_CSS], head: articleSchema(post)
    }));
}

/* ── Blog index ───────────────────────────────────────────── */
const GUIDES = [
    ['study-in-uk', 'Destinations', 'Study in the UK: Costs, Visa and Universities', 'Costs, scholarships, intakes, English tests, the student visa and part-time work for students from India.', '../assets/uk/city-london.jpg', 'View of London'],
    ['study-in-usa', 'Destinations', 'Study in the USA: Costs, Visa and Universities', 'Costs, scholarships, intakes, required tests, the F-1 visa and part-time work for students from India.', '../assets/usa/city-new-york-city.jpg', 'View of New York City'],
    ['study-in-canada', 'Destinations', 'Study in Canada: Costs, Visa and Universities', 'Courses, universities, costs, scholarships, intakes, study permit documents, the PGWP and the pathway to PR.', '../assets/canada/city-toronto.jpg', 'View of Toronto'],
    ['study-in-australia', 'Destinations', 'Study in Australia: Costs, Visa and Universities', 'Costs, scholarships, intakes, the subclass 500 student visa and career pathways for students from India.', '../assets/australia/city-sydney.jpg', 'View of Sydney'],
    ['study-in-germany', 'Destinations', 'Study in Germany: Costs, Visa and Universities', 'Courses, universities, estimated annual budget, scholarships, intakes, eligibility and the student visa process.', '../assets/germany/berlin-brandenburg-gate-web.jpg', 'Brandenburg Gate in Berlin'],
    ['study-in-ireland', 'Destinations', 'Study in Ireland: Costs, Visa and Universities', 'Courses, universities, estimated annual budget, scholarships, intakes, eligibility and the student visa process.', '../assets/ireland/city-dublin.jpg', 'View of Dublin'],
    ['scholarships', 'Scholarships', 'Study Abroad Scholarships by Country', 'Compare scholarships by country, degree level and eligibility, with official sources and application guidance.', null, ''],
    ['test-preparation', 'Test prep', 'Test Preparation: IELTS, TOEFL, GRE and GMAT', 'Diagnostic tests, personalised study plans, full-length practice and feedback for the exams universities ask for.', null, ''],
    ['find-universities', 'Tools', 'University Finder: Search Universities Abroad', 'Search universities abroad by destination, see example courses and plan your study-abroad shortlist.', '../assets/uk/uni-university-of-cambridge.jpg', 'University of Cambridge campus']
];
const CATEGORIES = ['Planning', 'Destinations', 'Scholarships', 'Test prep', 'MBBS', 'Tools'];

const postCard = (p) => `<a class="bl-card bl-card--2027" href="${p.slug}" data-cat="${esc(p.category)}">
      <span class="bl-card-cover" aria-hidden="true"><strong>2027</strong><em>${esc(p.category)}</em></span>
      <span class="bl-card-body">
        <span class="bl-card-kicker">${esc(p.eyebrow)} · ${p.readMins} min read</span>
        <span class="bl-card-title">${esc(p.h1)}</span>
        <span class="bl-card-text">${esc(p.cardExcerpt)}</span>
      </span>
    </a>`;
const guideCard = ([slug, cat, title, text, img, alt]) => `<a class="bl-card" href="${slug}" data-cat="${esc(cat)}">
      ${img ? `<span class="bl-card-img"><img src="${img}" alt="${esc(alt)}" width="640" height="360" loading="lazy" decoding="async"></span>` : `<span class="bl-card-cover bl-card-cover--plain" aria-hidden="true"><em>${esc(cat)}</em></span>`}
      <span class="bl-card-body">
        <span class="bl-card-kicker">${esc(cat)}</span>
        <span class="bl-card-title">${esc(title)}</span>
        <span class="bl-card-text">${esc(text)}</span>
      </span>
    </a>`;

function buildIndex() {
    const [pillar, ...spokes] = posts;
    const body = `<header class="gp-hero gp-hero--compact bl-hero">
  <div class="gp-hero-inner gp-hero-inner--single">
    <div class="gp-hero-copy">
      <nav class="gp-crumbs" aria-label="Breadcrumb">${crumbs([['Home', './'], ['Blog']])}</nav>
      <span class="gp-eyebrow">Study guides and blog</span>
      <h1>Study abroad guides, with the 2027 plan</h1>
      <p>Practical guides on intakes, countries, scholarships, tests and documents for students in India planning to start in 2027. Written by the Gradmire team, with official sources to check every date.</p>
    </div>
  </div>
</header>
<main id="main" class="bl-index">
  <section class="bl-feature" aria-labelledby="bl-feature-title">
    <a class="bl-feature-card" href="${pillar.slug}">
      <span class="bl-feature-badge">Start here · 2027</span>
      <span class="bl-feature-title" id="bl-feature-title">${esc(pillar.h1)}</span>
      <span class="bl-feature-text">${esc(pillar.intro)}</span>
      <span class="bl-feature-go">Read the guide <span aria-hidden="true">→</span></span>
    </a>
  </section>

  <div class="bl-filter" role="group" aria-label="Filter guides by topic">
    <button type="button" class="bl-chip" aria-pressed="true" data-filter="all">All</button>
${CATEGORIES.map((c) => `    <button type="button" class="bl-chip" aria-pressed="false" data-filter="${esc(c)}">${esc(c)}</button>`).join('\n')}
  </div>

  <section class="bl-section" aria-labelledby="bl-2027-title">
    <h2 id="bl-2027-title">2027 planning guides</h2>
    <div class="bl-grid">
    ${spokes.map(postCard).join('\n    ')}
    </div>
  </section>

  <section class="bl-section" aria-labelledby="bl-guides-title">
    <h2 id="bl-guides-title">Destination and tool guides</h2>
    <div class="bl-grid">
    ${GUIDES.map(guideCard).join('\n    ')}
    </div>
  </section>
  <p class="bl-empty" role="status" hidden>No guides in this topic yet.</p>
</main>
<script>
(function(){var bar=document.querySelector('.bl-filter');if(!bar)return;bar.classList.add('is-ready');
var cards=document.querySelectorAll('.bl-card'),secs=document.querySelectorAll('.bl-section'),empty=document.querySelector('.bl-empty');
bar.addEventListener('click',function(e){var b=e.target.closest('.bl-chip');if(!b)return;var f=b.getAttribute('data-filter'),shown=0;
bar.querySelectorAll('.bl-chip').forEach(function(c){c.setAttribute('aria-pressed',String(c===b));});
cards.forEach(function(c){var on=f==='all'||c.getAttribute('data-cat')===f;c.hidden=!on;if(on)shown++;});
secs.forEach(function(s){s.hidden=!s.querySelector('.bl-card:not([hidden])');});
empty.hidden=shown>0;});})();
</script>`;
    write('blog.html', shell({
        title: 'Study Abroad Blog and 2027 Guides | Gradmire',
        description: 'Study abroad guides for the 2027 intake: intakes, best countries, scholarships, tests, documents and MBBS abroad, with official sources for Indian students.',
        body, bodyClass: 'blog-page', css: [BLOG_CSS]
    }));
}

posts.forEach((p) => buildPost(p, posts));
buildIndex();
console.log(`Blog: ${posts.length} articles and the blog index written.`);
