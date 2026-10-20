/* Employee invitation links. The token is HMAC(APP_SECRET, 'invite:' + id):
   the email worker re-derives it, and the database holds only its hash, so a
   database copy alone cannot produce a working invitation. */
import { config } from '../config.js';
import { hmac, sha256 } from '../lib/crypto.js';

export const invitationToken = (id) => hmac(config.appSecret(), `invite:${id}`);
export const invitationTokenHash = (token) => sha256(String(token));
