/* Private file storage boundary. A provider implements:
     name, configured
     upload({ name, mimeType, data: Buffer, properties }) → { key }
     download(key)                                        → Buffer | null (null = gone)
     remove(key)                                          → { removed }
   Files are never public: the API streams them to people who pass its access
   checks. STORAGE_PROVIDER:
     drive — Google Drive (a Shared Drive folder), see drive.js
     local — development only: files under backend/.local-uploads (refused in production) */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../../config.js';
import { googleAuthFromEnv } from '../google/auth.js';
import { createDriveStorage } from './drive.js';

const none = { name: 'none', configured: false };
const localDir = fileURLToPath(new URL('../../../.local-uploads/', import.meta.url));

const localStorage = {
    name: 'local',
    configured: true,
    async upload({ data }) {
        await mkdir(localDir, { recursive: true });
        const key = crypto.randomUUID();
        await writeFile(join(localDir, key), data);
        return { key };
    },
    async download(key) {
        if (!/^[0-9a-f-]{36}$/.test(key)) return null;
        return readFile(join(localDir, key)).catch(() => null);
    },
    async remove(key) {
        if (/^[0-9a-f-]{36}$/.test(key)) await rm(join(localDir, key), { force: true });
        return { removed: true };
    },
};

let override = null;
let drive = null;

export function getStorage() {
    if (override) return override;
    const choice = (process.env.STORAGE_PROVIDER || '').toLowerCase();
    if (choice === 'drive') {
        const accessToken = googleAuthFromEnv();
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        if (!accessToken || !folderId) return none;
        drive ||= createDriveStorage({ accessToken, folderId, impersonate: process.env.GOOGLE_DRIVE_IMPERSONATE || '' });
        return drive;
    }
    if (choice === 'local') {
        if (!config.isProduction()) return localStorage;
        console.warn('STORAGE_PROVIDER=local is ignored in production.');
    }
    return none;
}

/* Tests inject an in-memory store; pass null to restore the environment-based choice. */
export function setStorage(provider) {
    override = provider;
}
