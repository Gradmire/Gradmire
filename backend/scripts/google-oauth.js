/* One-time Google authorization for a personal Google account (for example an
   @gmail.com address). Run it on your own computer:

     GOOGLE_OAUTH_CLIENT_ID=… npm run google-oauth -- --login-hint you@gmail.com --from "Gradmire <info@gradmire.com>"

   The client secret is asked for with hidden input (or taken from
   GOOGLE_OAUTH_CLIENT_SECRET). --from sets the From address printed for
   EMAIL_FROM; it must be a verified "Send mail as" address of the account.

   It opens Google's consent screen, receives the answer on a loopback address
   (127.0.0.1, PKCE-protected), confirms which account consented, creates the
   private "Gradmire documents" folder in that account's Drive (only this app
   can see files it creates there: drive.file scope), and prints the values to
   store as API environment variables. The refresh token is a secret: store it
   with `vercel env add`, never in the repository or a chat.
   The OAuth client must allow the redirect URI http://127.0.0.1:53682 (add it
   under "Authorized redirect URIs" for a Web application client; Desktop app
   clients accept it as is).
   Options: --port N (default 53682), --login-hint EMAIL, --folder-id ID (reuse a folder this app created), --no-folder */
import { createHash, randomBytes } from 'node:crypto';
import { exec } from 'node:child_process';
import { createServer } from 'node:http';
import { parseArgs } from 'node:util';

const SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/calendar',
];

const { values } = parseArgs({ options: { port: { type: 'string', default: '53682' }, from: { type: 'string' }, 'login-hint': { type: 'string' }, 'folder-id': { type: 'string' }, 'no-folder': { type: 'boolean', default: false } } });
/* Reads a line without echoing it, so a secret typed here never shows on screen. */
function askHidden(question) {
    return new Promise((resolve) => {
        process.stdout.write(question);
        const input = process.stdin;
        let value = '';
        input.setRawMode?.(true);
        input.resume();
        input.setEncoding('utf8');
        const onData = (chunk) => {
            for (const char of chunk) {
                if (char === '\r' || char === '\n') {
                    input.setRawMode?.(false);
                    input.pause();
                    input.off('data', onData);
                    process.stdout.write('\n');
                    resolve(value.trim());
                    return;
                }
                if (char === '\u0003') process.exit(1); // Ctrl+C
                if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
                else value += char;
            }
        };
        input.on('data', onData);
    });
}

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || (clientId && process.stdin.isTTY ? await askHidden('OAuth client secret (input hidden): ') : '');
if (!clientId || !clientSecret) {
    console.error('Set GOOGLE_OAUTH_CLIENT_ID (and the client secret, typed when asked) of an OAuth client of type "Desktop app".');
    process.exit(1);
}

const verifier = randomBytes(48).toString('base64url');
const challenge = createHash('sha256').update(verifier).digest('base64url');
const state = randomBytes(24).toString('base64url');

const code = await new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
        const url = new URL(request.url, 'http://127.0.0.1');
        if (url.pathname !== '/') {
            response.writeHead(404).end();
            return;
        }
        const done = (status, message) => {
            response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }).end(message);
            server.close();
        };
        if (url.searchParams.get('state') !== state) return done(400, 'State mismatch. Close this tab and run the script again.') || reject(new Error('State mismatch'));
        if (url.searchParams.get('error')) return done(400, `Google said: ${url.searchParams.get('error')}`) || reject(new Error(url.searchParams.get('error')));
        done(200, 'Gradmire is authorized. You can close this tab and return to the terminal.');
        // The port is fixed (--port), so the redirect URI is known without asking the closed server.
        resolve({ code: url.searchParams.get('code'), redirectUri: `http://127.0.0.1:${values.port}` });
    });
    // A fixed port, because "Web application" clients only accept redirect URIs registered exactly.
    server.on('error', (error) => reject(new Error(`Cannot listen on 127.0.0.1:${values.port} (${error.code}). Close whatever uses it or pass --port.`)));
    server.listen(Number(values.port), '127.0.0.1', () => {
        const redirectUri = `http://127.0.0.1:${server.address().port}`;
        const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        auth.search = new URLSearchParams({
            client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: SCOPES.join(' '),
            access_type: 'offline', prompt: 'consent', state, code_challenge: challenge, code_challenge_method: 'S256',
            ...(values['login-hint'] ? { login_hint: values['login-hint'] } : {}),
        }).toString();
        console.log(`\nOpen this link to authorize Gradmire (it should open by itself):\n\n${auth}\n`);
        const opener = process.platform === 'win32' ? `start "" "${auth}"` : process.platform === 'darwin' ? `open "${auth}"` : `xdg-open "${auth}"`;
        exec(opener, () => {});
    });
    setTimeout(() => reject(new Error('No answer from Google within 5 minutes')), 300_000).unref();
});

const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: code.code, redirect_uri: code.redirectUri, client_id: clientId, client_secret: clientSecret, code_verifier: verifier }),
});
const tokens = await tokenResponse.json();
if (!tokenResponse.ok || !tokens.refresh_token) {
    console.error(`Google did not return a refresh token (${tokenResponse.status} ${tokens.error || ''}). Remove Gradmire's access at https://myaccount.google.com/permissions and run again.`);
    process.exit(1);
}
const granted = new Set(String(tokens.scope || '').split(' '));
const missing = SCOPES.filter((scope) => !granted.has(scope));
if (missing.length) console.warn(`\nWarning: these permissions were not granted, so their features stay off:\n  ${missing.join('\n  ')}`);

const api = async (method, url, body) => {
    const response = await fetch(url, { method, headers: { Authorization: `Bearer ${tokens.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { ok: response.ok, status: response.status, data: await response.json().catch(() => ({})) };
};

const profile = await api('GET', 'https://gmail.googleapis.com/gmail/v1/users/me/profile');
const account = profile.ok ? profile.data.emailAddress : null;
if (values['login-hint'] && account && account.toLowerCase() !== values['login-hint'].toLowerCase()) {
    console.warn(`\nWarning: you authorized ${account}, not ${values['login-hint']}.`);
}

let folderId = values['folder-id'] || null;
if (!folderId && !values['no-folder'] && granted.has('https://www.googleapis.com/auth/drive.file')) {
    const folder = await api('POST', 'https://www.googleapis.com/drive/v3/files?fields=id', {
        name: 'Gradmire documents (private)', mimeType: 'application/vnd.google-apps.folder', appProperties: { gradmire: 'documents' },
    });
    if (!folder.ok) console.warn(`\nCould not create the Drive folder (${folder.status}). Run again with --no-folder and create it later.`);
    folderId = folder.data.id || null;
}

console.log(`
Authorized account: ${account || '(unknown: Gmail permission not granted)'}

Store these on the API (from backend/):  vercel env add <NAME> production
──────────────────────────────────────────────────────────────────────────
GOOGLE_OAUTH_CLIENT_ID=${clientId}
GOOGLE_OAUTH_CLIENT_SECRET=(the client secret you used here)
GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}
EMAIL_PROVIDER=gmail
EMAIL_FROM=${values.from || `Gradmire <${account || 'you@gmail.com'}>`}
EMAIL_REPLY_TO=${values.from ? values.from.replace(/^.*<([^>]+)>.*$/, '$1') : ''}
GMAIL_SENDER=${account || 'you@gmail.com'}
STORAGE_PROVIDER=drive
GOOGLE_DRIVE_FOLDER_ID=${folderId || '(not created)'}
CALENDAR_PROVIDER=google
GOOGLE_CALENDAR_CREATE_MEET=true
GOOGLE_CALENDAR_INVITE_ATTENDEES=true
GOOGLE_INTERVIEW_CALENDAR_ID=primary
──────────────────────────────────────────────────────────────────────────
The refresh token above is a password for this Google account's mail, Drive
and calendar: store it only with \`vercel env add\`, then clear this terminal.
`);
