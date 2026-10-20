import { createHash, createHmac, randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
// N=2^15, r=8 ≈ 32 MB per hash: slow enough to resist offline guessing.
const SCRYPT = { N: 32768, r: 8, p: 1, keyLength: 64 };

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export const hmac = (secret, value) => createHmac('sha256', secret).update(value).digest('base64url');

export function safeEqual(a, b) {
    const left = Buffer.from(String(a));
    const right = Buffer.from(String(b));
    return left.length === right.length && timingSafeEqual(left, right);
}

export async function hashPassword(password) {
    const salt = randomBytes(16);
    const key = await scrypt(password.normalize('NFKC'), salt, SCRYPT.keyLength, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 64 * 1024 * 1024 });
    return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
    const parts = String(stored || '').split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, N, r, p, saltB64, keyB64] = parts;
    const expected = Buffer.from(keyB64, 'base64');
    const key = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
        N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
    });
    return timingSafeEqual(key, expected);
}

/* A hash of a fixed password, used to spend the same time on unknown emails. */
let dummyHash;
export async function dummyPasswordCheck(password) {
    dummyHash ||= await hashPassword('not-a-real-password-placeholder');
    await verifyPassword(password, dummyHash);
    return false;
}

/* Human-friendly booking reference, e.g. GM-7KQ2XD4M (Crockford base32, no I/L/O/U). */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function bookingReference() {
    let code = '';
    for (let i = 0; i < 8; i += 1) code += ALPHABET[randomInt(ALPHABET.length)];
    return `GM-${code}`;
}
