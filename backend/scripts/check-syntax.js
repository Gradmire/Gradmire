/* `npm run check`: syntax-checks every backend source, script and test file. */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['src', 'api', 'scripts', 'test'];
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : path.endsWith('.js') ? [path] : [];
});
const files = roots.flatMap((root) => {
    try {
        return walk(root);
    } catch {
        return [];
    }
});
for (const file of files) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
console.log(`Syntax OK (${files.length} files)`);
