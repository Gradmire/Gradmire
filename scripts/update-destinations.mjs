/* Applies destination-data.mjs to the nine study-in-*.html pages:
   - a QS rank badge on each university picture (no badge where no rank is confirmed),
   - a university-count badge on each city picture,
   - subject links that open the Course Finder filtered to that country.
   Safe to re-run: it replaces what it added before.
   Run from the repository root:  node scripts/update-destinations.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { pages, RANK_LABEL, finderNames } from './destination-data.mjs';
import { universities, uniSlug } from './course-data.mjs';

const dir = path.resolve('frontend/pages');
const badge = (rank) => `<span class="gm-rank-badge" aria-label="${RANK_LABEL} world rank ${rank}">${RANK_LABEL} · #${rank}</span>`;
const countBadge = (list, override) => `<span class="gm-city-count">${override || `${list.length}${list.length > 1 ? '+' : ''}`} ${list.length === 1 && !override ? 'university' : 'universities'}</span>`;
const finderSet = new Set(universities.map((u) => u.name));
/* Link to the Course Finder filtered to this university, or null if it is not listed there. */
const finderHref = (name) => {
    const target = finderNames[name] || name.replace(/&amp;/g, '&');
    return finderSet.has(target) ? `find-courses.html?university=${uniSlug(target)}` : null;
};
const uniLink = (name) => {
    const href = finderHref(name.trim());
    return href ? `<a class="gm-uni-link" href="${href}"><span class="sr-only">See courses at ${name.trim()} in the Course Finder</span></a>` : '';
};
const strip = (html) => html.replace(/<a class="gm-uni-link"[^>]*><span class="sr-only">[^<]*<\/span><\/a>/g, '').replace(/<span class="gm-rank-badge"[^>]*>[^<]*<\/span>/g, '').replace(/<span class="gm-city-count">[^<]*<\/span>/g, '');

for (const [slug, data] of Object.entries(pages)) {
    const file = path.join(dir, data.file);
    let html = strip(fs.readFileSync(file, 'utf8'));
    const missing = [];

    for (const [from, to] of Object.entries(data.rename || {})) html = html.split(from).join(to);

    /* Template A: <div class="uni-thumb"><img …><div class="uni-thumb-name">Name</div> */
    html = html.replace(/(<div class="uni-thumb">\s*<img[^>]*>)(\s*<div class="uni-thumb-name">)([^<]*)(<\/div>)/g, (m, img, open, name, close) => {
        const rank = data.ranks[name.trim()];
        if (!finderHref(name.trim())) missing.push(`finder:${name}`);
        return `${img}${rank ? badge(rank) : ''}${open}${name}${close}${uniLink(name)}`;
    });
    /* Template B: <div class="uni-card-img"><img …></div><div class="uni-card-body"><div class="uni-card-rank">…</div><div class="uni-card-name">Name</div> */
    html = html.replace(/(<div class="uni-card-img"><img[^>]*>)(<\/div>\s*<div class="uni-card-body"><div class="uni-card-rank">)([^<]*)(<\/div><div class="uni-card-name">)([^<]*)/g, (m, img, mid, label, mid2, name) => {
        const rank = data.ranks[name.trim()];
        /* Keep the descriptive part of the old label ("TU9", "Founded 1592"); the rank moves onto the picture. */
        const descriptor = label.split('·').map((s) => s.trim()).filter((s) => !/^QS\s*#/i.test(s)).join(' · ') || (rank ? 'Ranked university' : label);
        if (!finderHref(name.trim())) missing.push(`finder:${name}`);
        return `${img}${rank ? badge(rank) : ''}${mid}${rank ? descriptor : label.replace(/QS\s*#[\d–-]+\s*·?\s*/i, '').trim() || label}${mid2}${name}${uniLink(name)}`;
    });
    /* Finland: plain list items. */
    html = html.replace(/<a class="gm-uni-name-link" href="[^"]*">([^<]*)<\/a>/g, '$1');
    html = html.replace(/<div class="university">([^<]*)<\/div>/g, (m, name) => {
        const rank = data.ranks[name.trim()];
        const href = finderHref(name.trim());
        if (!href) missing.push(`finder:${name}`);
        return `<div class="university">${href ? `<a class="gm-uni-name-link" href="${href}">${name}</a>` : name}${rank ? badge(rank) : ''}</div>`;
    });
    for (const name of Object.keys(data.ranks)) if (!html.includes(`aria-label="${RANK_LABEL} world rank ${data.ranks[name]}"`)) missing.push(`rank:${name}`);

    /* Template A cities: city-name + city-meta → count badge, meta lists the universities. */
    html = html.replace(/(<div class="city-card">\s*<img[^>]*>)(\s*<div class="city-overlay"><div class="city-name">)([^<]*)(<\/div><div class="city-meta">)[^<]*(<\/div>)/g, (m, img, open, city, metaOpen, close) => {
        const list = data.cities[city.trim()];
        if (!list) { missing.push(`city:${city}`); return m; }
        return `${img}${list.length ? countBadge(list, data.cityCounts?.[city.trim()]) : ''}${open}${city}${metaOpen}${list.join(' · ')}${close}`;
    });
    /* Template B cities: <article class="city-card"><img …><div class="city-card-label">City — note</div> */
    html = html.replace(/(<article class="city-card[^"]*"[^>]*>\s*<img[^>]*>)(\s*<div class="city-card-label">)([^<—]*)/g, (m, img, open, city) => {
        const list = data.cities[city.trim()];
        if (!list) { missing.push(`city:${city}`); return m; }
        return `${img}${list.length ? countBadge(list) : ''}${open}${city}`;
    });
    /* Finland cities: text cards with an h3. */
    html = html.replace(/(<article class="card"><h3>)([^<]*)(<\/h3>)/g, (m, open, city, close) => {
        const list = data.cities[city.trim()];
        return list ? `${open}${city}${close}${countBadge(list)}` : m;
    });

    /* Subject links → Course Finder pre-filtered to this country. */
    html = html.replace(/href="find-courses\.html\?course=([^"&]*)(?:&amp;country=[a-z]+)?"/g, `href="find-courses?course=$1&amp;country=${slug}"`);

    fs.writeFileSync(file, html);
    console.log(`${data.file}: updated${missing.length ? ` (not found: ${missing.join(', ')})` : ''}`);
}
