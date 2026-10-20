/* Google Drive v3 as private document storage
   (https://developers.google.com/workspace/drive/api/guides/manage-uploads).
   Files go into one folder of a Shared Drive that only Gradmire's service
   account (and chosen admins) can open; nothing is shared by link. Uploads are
   multipart (metadata + media in one request); removal moves the file to the
   Shared Drive's trash so an admin can recover it within Google's retention. */
import { googleError, googleJson } from '../google/auth.js';

const SCOPE = 'https://www.googleapis.com/auth/drive';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FILES = 'https://www.googleapis.com/drive/v3/files';

export function createDriveStorage({ accessToken, folderId, impersonate = '' }) {
    const token = () => accessToken(SCOPE, impersonate);

    return {
        name: 'drive',
        configured: true,

        async upload({ name, mimeType, data, properties = {} }) {
            const boundary = `gm_upload_${crypto.randomUUID()}`;
            const metadata = { name, mimeType, parents: [folderId], appProperties: properties };
            const body = Buffer.concat([
                Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
                data,
                Buffer.from(`\r\n--${boundary}--`),
            ]);
            const response = await fetch(`${UPLOAD}?uploadType=multipart&supportsAllDrives=true&fields=id`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
                body,
                signal: AbortSignal.timeout(30_000),
            });
            const json = await response.json().catch(() => ({}));
            if (!response.ok || !json.id) throw googleError('Drive upload', { status: response.status, data: json });
            return { key: json.id };
        },

        async download(key) {
            const response = await fetch(`${FILES}/${encodeURIComponent(key)}?alt=media&supportsAllDrives=true`, {
                headers: { Authorization: `Bearer ${await token()}` },
                signal: AbortSignal.timeout(30_000),
            });
            if (response.status === 404) return null;
            if (!response.ok) throw googleError('Drive download', { status: response.status, data: await response.json().catch(() => ({})) });
            return Buffer.from(await response.arrayBuffer());
        },

        async remove(key) {
            const result = await googleJson(await token(), 'PATCH', `${FILES}/${encodeURIComponent(key)}?supportsAllDrives=true`, { trashed: true });
            if (result.ok || result.status === 404) return { removed: true };
            throw googleError('Drive delete', result);
        },
    };
}
