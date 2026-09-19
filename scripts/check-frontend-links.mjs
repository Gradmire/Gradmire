import fs from 'node:fs';
import path from 'node:path';

const pagesRoot = path.resolve('frontend/pages');
const references = /(?:href|src)=["']([^"']+)["']/gi;
const ignoredPrefixes = ['#', 'data:', 'http:', 'https:', 'mailto:', 'tel:', 'javascript:', '//', '/'];
const missing = [];

function isLocalReference(reference) {
  return reference && !ignoredPrefixes.some((prefix) => reference.startsWith(prefix));
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

for (const pagePath of walk(pagesRoot).filter((filePath) => filePath.endsWith('.html'))) {
  const html = fs.readFileSync(pagePath, 'utf8');
  for (const match of html.matchAll(references)) {
    const reference = match[1].split('#')[0].split('?')[0];
    if (!isLocalReference(reference)) continue;

    const target = path.resolve(path.dirname(pagePath), decodeURIComponent(reference));
    if (!fs.existsSync(target)) {
      missing.push(`${path.relative(process.cwd(), pagePath)} -> ${reference}`);
    }
  }
}

if (missing.length > 0) {
  console.error('Missing local frontend references:');
  console.error(missing.join('\n'));
  process.exit(1);
}

console.log('All local frontend references resolve.');
