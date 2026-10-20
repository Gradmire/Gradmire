/* Guest "manage your booking" links. The token is HMAC(APP_SECRET, seed); the
   consultation stores the seed (to re-render emails) and the token's hash (to
   look it up). Someone with only a database copy cannot build working links. */
import { config } from '../config.js';
import { hmac, randomToken, sha256 } from '../lib/crypto.js';

export const manageTokenFromSeed = (seed) => hmac(config.appSecret(), `manage:${seed}`);

export function newManageToken() {
    const seed = randomToken(32);
    const token = manageTokenFromSeed(seed);
    return { seed, token, hash: sha256(token) };
}

export const manageTokenHash = (token) => sha256(String(token));
