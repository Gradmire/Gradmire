/* Builds the Course Finder (frontend/pages/find-courses.html): universities with their
   example courses, filtered by study level (UG/PG), subject, country and institution type.
   Run from the repository root:  node scripts/build-course-finder.mjs
   Data lives in course-data.mjs. ?course=, ?country= and ?level= preset the filters. */
import { subjects, countries, universities, uniSlug, REVIEWED } from './course-data.mjs';
import { esc, consultHref, shell, write } from './page-shell.mjs';

const levelName = { ug: 'Bachelor’s (UG)', pg: 'Master’s (PG)' };
const subjectLabel = Object.fromEntries(subjects.map((s) => [s.key, s.label]));
const VISIBLE_COURSES = 3;
const totalCourses = universities.reduce((n, u) => n + u.courses.length, 0);

function courseRow(u, [subject, title, level], index) {
    const c = countries[u.country];
    return `<li class="gp-course${index >= VISIBLE_COURSES ? ' gp-course--extra' : ''}" data-subject="${subject}" data-level="${level}"${index >= VISIBLE_COURSES ? ' hidden' : ''}>
          <div class="gp-course-main">
            <h4>${esc(title)}</h4>
            <span class="gp-course-subject">${esc(subjectLabel[subject])}</span>
          </div>
          <dl class="gp-course-facts">
            <div><dt>Level</dt><dd>${levelName[level]}</dd></div>
            <div><dt>Typical length</dt><dd>${esc(level === 'ug' ? c.ug : c.pg)}</dd></div>
            <div><dt>Intake</dt><dd>${esc(c.intakes)}</dd></div>
          </dl>
          <div class="gp-course-actions">
            <a class="gp-btn gp-btn-primary gp-btn-sm" href="${consultHref('course-selection', u.country)}" data-open-consult data-country="${u.country}" data-course="${esc(`${title} (${level === 'ug' ? 'UG' : 'PG'}), ${u.name}`)}">Apply</a>
            <a class="gp-course-link" href="${u.url}" target="_blank" rel="noopener noreferrer">Course details <span aria-hidden="true">↗</span><span class="sr-only"> on the ${esc(u.name)} website (opens in a new tab)</span></a>
          </div>
        </li>`;
}

function uniCard(u) {
    const c = countries[u.country];
    const extra = u.courses.length - VISIBLE_COURSES;
    return `<article class="gp-uni-result" id="uni-${uniSlug(u.name)}" data-slug="${uniSlug(u.name)}" data-country="${u.country}" data-type="${u.type.toLowerCase()}" data-qs="${u.qs ?? 9999}" data-name="${esc(u.name)}" data-founded="${parseInt(u.founded.replace(/\D/g, ''), 10)}">
      <header class="gp-uni-result-head">
        <div>
          <h3>${esc(u.name)}</h3>
          <p class="gp-uni-result-place">${esc(u.city)}, ${esc(c.name)}</p>
        </div>${u.qs ? `
        <span class="gp-qs" title="QS World University Rankings 2026">QS 2026 · #${u.qs}</span>` : ''}
      </header>
      <dl class="gp-uni-result-facts">
        <div><dt>Founded</dt><dd>${esc(u.founded)}</dd></div>
        <div><dt>Institution type</dt><dd>${esc(u.type)}</dd></div>
        <div><dt>QS world rank</dt><dd>${u.qs ? `#${u.qs}` : 'Not confirmed'}</dd></div>
        <div><dt>Destination guide</dt><dd><a href="study-in-${u.country}.html">Study in ${esc(c.name)}</a></dd></div>
      </dl>
      <ul class="gp-course-list">
        ${u.courses.map((course, i) => courseRow(u, course, i)).join('\n        ')}
      </ul>${extra > 0 ? `
      <button type="button" class="gp-show-more" aria-expanded="false">Show ${extra} more course${extra === 1 ? '' : 's'}</button>` : ''}
    </article>`;
}

const checkbox = (group, value, label) => `<label class="gp-filter-option"><input type="checkbox" name="${group}" value="${value}"> <span>${esc(label)}</span></label>`;

const filters = `<aside class="gp-filters" aria-label="Course filters">
    <details class="gp-filter-panel" open>
      <summary>Filters <span class="gp-filter-count" aria-live="polite"></span></summary>
      <fieldset><legend>Study level</legend>${checkbox('level', 'ug', 'Bachelor’s (UG)')}${checkbox('level', 'pg', 'Master’s (PG)')}</fieldset>
      <fieldset><legend>Subject area</legend>${subjects.map((s) => checkbox('subject', s.key, s.label)).join('')}</fieldset>
      <fieldset><legend>Country</legend>${Object.entries(countries).map(([key, c]) => checkbox('country', key, c.name)).join('')}</fieldset>
      <fieldset><legend>Institution type</legend>${checkbox('type', 'public', 'Public')}${checkbox('type', 'private', 'Private')}</fieldset>
      <button type="button" class="gp-filter-reset">Clear all filters</button>
    </details>
  </aside>`;

/* Subject aliases for ?course= links, keyed by the normalised phrase. */
const aliasMap = Object.fromEntries(subjects.flatMap((s) => [s.key, ...s.aliases].map((a) => [a, s.key])));

const script = `<script>
(() => {
  const ALIASES = ${JSON.stringify(aliasMap)};
  const root = document.querySelector('.gp-finder');
  const cards = [...root.querySelectorAll('.gp-uni-result')];
  const list = root.querySelector('.gp-results-list');
  const search = document.getElementById('finder-search');
  const sort = root.querySelector('#finder-sort');
  const count = root.querySelector('.gp-results-count');
  const empty = root.querySelector('.gp-results-empty');
  const badge = root.querySelector('.gp-filter-count');
  const uniBar = root.querySelector('.gp-uni-filter');
  /* ?university=<slug> (from destination pages and the homepage logos) shows one university. */
  let uniFilter = '';
  const checked = (name) => [...root.querySelectorAll('input[name="' + name + '"]:checked')].map((i) => i.value);
  const norm = (s) => s.toLowerCase().replace(/[&/+]+/g, ' and ').replace(/\\s+/g, ' ').trim();

  function apply() {
    const levels = checked('level'), subjects = checked('subject'), countries = checked('country'), types = checked('type');
    const q = norm(search.value);
    let unis = 0, courses = 0;
    cards.forEach((card) => {
      const cardMatch = (!uniFilter || card.dataset.slug === uniFilter) && (!countries.length || countries.includes(card.dataset.country)) && (!types.length || types.includes(card.dataset.type));
      const filtering = levels.length || subjects.length || q || uniFilter;
      let shown = 0;
      card.querySelectorAll('.gp-course').forEach((row) => {
        const text = norm(row.textContent + ' ' + card.dataset.name);
        const match = cardMatch && (!levels.length || levels.includes(row.dataset.level)) && (!subjects.length || subjects.includes(row.dataset.subject)) && (!q || text.includes(q));
        row.classList.toggle('is-filtered-out', !match);
        if (match) shown += 1;
      });
      /* While filtering, show every matching course; otherwise keep long lists collapsed. */
      const more = card.querySelector('.gp-show-more');
      card.classList.toggle('is-filtering', Boolean(filtering));
      card.querySelectorAll('.gp-course').forEach((row) => {
        row.hidden = row.classList.contains('is-filtered-out') || (!filtering && row.classList.contains('gp-course--extra') && !card.classList.contains('is-expanded'));
      });
      if (more) more.hidden = Boolean(filtering);
      card.hidden = !shown;
      if (shown) { unis += 1; courses += shown; }
    });
    count.innerHTML = '<strong>' + unis + '</strong> universit' + (unis === 1 ? 'y' : 'ies') + ' · <strong>' + courses + '</strong> course' + (courses === 1 ? '' : 's');
    empty.hidden = unis > 0;
    const active = levels.length + subjects.length + countries.length + types.length + (q ? 1 : 0) + (uniFilter ? 1 : 0);
    uniBar.hidden = !uniFilter;
    badge.textContent = active ? '(' + active + ')' : '';
  }

  function order() {
    const key = sort.value;
    const by = {
      rank: (a, b) => Number(a.dataset.qs) - Number(b.dataset.qs),
      name: (a, b) => a.dataset.name.localeCompare(b.dataset.name),
      oldest: (a, b) => Number(a.dataset.founded) - Number(b.dataset.founded)
    }[key];
    cards.slice().sort(by).forEach((card) => list.appendChild(card));
  }

  /* Preset filters from the URL (nav dropdown, destination pages, older links). */
  const params = new URLSearchParams(location.search);
  const tick = (name, value) => { const box = root.querySelector('input[name="' + name + '"][value="' + value + '"]'); if (box) box.checked = true; return Boolean(box); };
  const courseParam = norm(params.get('course') || params.get('subject') || params.get('q') || '');
  if (courseParam) { if (!tick('subject', ALIASES[courseParam] || '')) search.value = params.get('course') || params.get('subject') || params.get('q'); }
  const countryParam = (params.get('country') || '').toLowerCase().replace(/[^a-z]/g, '');
  if (countryParam) tick('country', { unitedkingdom: 'uk', us: 'usa', unitedstates: 'usa' }[countryParam] || countryParam);
  const uniParam = (params.get('university') || '').toLowerCase();
  const uniCard = cards.find((c) => c.dataset.slug === uniParam);
  if (uniCard) {
    uniFilter = uniParam;
    root.querySelector('.gp-uni-filter-name').textContent = uniCard.dataset.name;
  }
  const levelParam = (params.get('level') || '').toLowerCase();
  if (levelParam === 'ug' || levelParam === 'pg') tick('level', levelParam);

  root.addEventListener('change', (e) => { if (e.target.matches('input[type="checkbox"]')) apply(); if (e.target === sort) { order(); } });
  search.addEventListener('input', apply);
  const clearUni = () => {
    uniFilter = '';
    const url = new URL(location.href);
    url.searchParams.delete('university');
    history.replaceState(null, '', url.pathname + url.search);
  };
  uniBar.querySelector('.gp-uni-filter-clear').addEventListener('click', () => { clearUni(); apply(); search.focus(); });
  root.querySelector('.gp-filter-reset').addEventListener('click', () => {
    clearUni();
    root.querySelectorAll('.gp-filters input').forEach((i) => { i.checked = false; });
    search.value = '';
    history.replaceState(null, '', location.pathname);
    apply();
  });
  root.addEventListener('click', (e) => {
    const more = e.target.closest('.gp-show-more');
    if (!more) return;
    const card = more.closest('.gp-uni-result');
    const open = !card.classList.contains('is-expanded');
    card.classList.toggle('is-expanded', open);
    more.setAttribute('aria-expanded', String(open));
    more.textContent = open ? 'Show fewer courses' : more.dataset.label;
    apply();
  });
  root.querySelectorAll('.gp-show-more').forEach((b) => { b.dataset.label = b.textContent; });
  /* On small screens start with the filter panel closed so results come first. */
  if (window.matchMedia('(max-width: 860px)').matches) root.querySelector('.gp-filter-panel').open = false;
  order();
  apply();
})();
</script>`;

const body = `<header class="gp-hero gp-hero--compact">
  <div class="gp-hero-inner gp-hero-inner--single">
    <div class="gp-hero-copy">
      <nav class="gp-crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a> <span aria-hidden="true">/</span> <span aria-current="page">Course Finder</span></nav>
      <span class="gp-eyebrow">Course Finder</span>
      <h1>Find bachelor’s and master’s courses abroad.</h1>
      <p>Browse ${universities.length} leading universities in ${Object.keys(countries).length} countries. Filter by level, subject and destination, then apply with a counsellor’s help.</p>
      <form class="gp-finder-search" role="search" onsubmit="return false">
        <label class="sr-only" for="finder-search">Search by course or university</label>
        <input id="finder-search" type="search" placeholder="Search a course or university, e.g. Data Science" autocomplete="off">
      </form>
    </div>
  </div>
</header>
<main id="main" class="gp-finder">
  <div class="gp-finder-layout">
    ${filters}
    <section class="gp-results" aria-labelledby="results-title">
      <h2 id="results-title" class="sr-only">Results</h2>
      <div class="gp-results-bar">
        <p class="gp-results-count" aria-live="polite"><strong>${universities.length}</strong> universities · <strong>${totalCourses}</strong> courses</p>
        <label class="gp-sort">Sort by <select id="finder-sort"><option value="rank">QS rank (high to low)</option><option value="name">University name (A–Z)</option><option value="oldest">Oldest first</option></select></label>
      </div>
      <div class="gp-uni-filter" role="status" hidden>
        <p>Showing courses at <strong class="gp-uni-filter-name"></strong></p>
        <button type="button" class="gp-uni-filter-clear">Show all universities</button>
      </div>
      <div class="gp-results-empty" hidden>
        <h3>No courses match those filters</h3>
        <p>Try removing a filter, or <a href="${consultHref('course-selection')}" data-open-consult>ask a counsellor</a>. We can search well beyond these example listings.</p>
      </div>
      <div class="gp-results-list">
${universities.map(uniCard).join('\n')}
      </div>
      <p class="gp-note">Example programmes at leading universities, with typical course lengths and intakes for each country. QS ranks are from the QS World University Rankings 2026. Always confirm the exact course title, fees, entry requirements and intake on the university’s website. Last reviewed ${REVIEWED}.</p>
    </section>
  </div>
</main>
${script}`;

write('find-courses.html', shell({
    title: 'Course Finder: Bachelor’s & Master’s Courses Abroad | Gradmire',
    description: 'Find bachelor’s and master’s courses at leading universities in the UK, USA, Canada, Australia, Germany, Ireland, New Zealand, Italy and Finland. Filter by level, subject and country.',
    body
}));
console.log(`Built find-courses.html: ${universities.length} universities, ${totalCourses} courses.`);
