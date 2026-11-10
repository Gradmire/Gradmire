/* Keeps two homepage details in step with their single sources, so nothing is hand-edited in index.html:
     1. `sameAs` in the Organization JSON-LD = the social profiles in scripts/social.mjs that have a real address.
        (E-mail and WhatsApp are contact channels, not profiles, so they are left out.) With no profiles it writes nothing.
     2. Search Console and Bing Webmaster verification meta tags, from scripts/site-verification.json.
        Leave a value empty and its tag is not written.
   Called by scripts/sync-footer.mjs, so the usual command after changing either file is:  node scripts/sync-footer.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { profiles } from './social.mjs';

const indexFile = path.resolve('frontend/pages/index.html');
const configFile = path.resolve('scripts/site-verification.json');
const FOUNDER_LINE = '      "founder": {"@id": "https://www.gradmire.com/about#aquib-jamal"},';
const TOKEN = /^[A-Za-z0-9_-]{8,100}$/;

export function syncHomepageProfiles() {
    const raw = fs.readFileSync(indexFile, 'utf8');
    const crlf = raw.includes('\r\n');
    let html = raw.replace(/\r\n/g, '\n');

    /* 1. sameAs */
    const urls = profiles.map((p) => p.url).filter((u) => /^https?:\/\//.test(u) && !/^https?:\/\/wa\.me\//.test(u));
    html = html.replace(/\n      "sameAs": \[[^\n]*\],/, '');
    if (urls.length) {
        if (!html.includes(FOUNDER_LINE)) throw new Error('index.html: the founder line that sameAs is placed after was not found');
        html = html.replace(FOUNDER_LINE, `${FOUNDER_LINE}\n      "sameAs": ${JSON.stringify(urls)},`);
    }

    /* 2. verification tags */
    let config = {};
    try { config = JSON.parse(fs.readFileSync(configFile, 'utf8')); } catch (_) { config = {}; }
    const tags = [];
    if (config.google) {
        if (!TOKEN.test(config.google)) throw new Error('scripts/site-verification.json: "google" is not a valid token');
        tags.push(`<meta name="google-site-verification" content="${config.google}">`);
    }
    if (config.bing) {
        if (!TOKEN.test(config.bing)) throw new Error('scripts/site-verification.json: "bing" is not a valid token');
        tags.push(`<meta name="msvalidate.01" content="${config.bing}">`);
    }
    html = html.replace(/<!-- site-verification -->[\s\S]*?<!-- \/site-verification -->\n/, '');
    if (tags.length) {
        const anchor = '<script type="application/ld+json">';
        if (!html.includes(anchor)) throw new Error('index.html: no JSON-LD block to place the verification tags before');
        html = html.replace(anchor, `<!-- site-verification -->\n${tags.join('\n')}\n<!-- /site-verification -->\n${anchor}`);
    }

    if (html !== raw.replace(/\r\n/g, '\n')) fs.writeFileSync(indexFile, crlf ? html.replace(/\n/g, '\r\n') : html);
    return `Homepage profiles: sameAs ${urls.length}, verification tags ${tags.length}.`;
}
