/* Creates (or promotes) a staff account. Staff roles are never granted through
   the public API; this script is the controlled way to add them.

   Usage (from backend/):
     DATABASE_URL=... STAFF_PASSWORD='…' npm run create-staff -- \
       --email priya@gradmire.in --first-name Priya --last-name Mehta --role counsellor \
       [--timezone Asia/Kolkata] [--calendar-id priya@gradmire.in] [--buffer 10] [--no-default-hours] [--promote]

   This is the bootstrap path (e.g. the first super_admin). Once two privileged
   people exist, grant and remove access through approval requests in the admin
   workspace instead, so every change has a second approver.

   Without STAFF_PASSWORD a random password is generated and printed once.
   Counsellors get Mon–Sat 10:00–18:00 in their timezone unless --no-default-hours. */
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import pg from 'pg';
import { hashPassword } from '../src/lib/crypto.js';
import { isValidTimeZone } from '../src/lib/time.js';

const { values } = parseArgs({
    options: {
        email: { type: 'string' }, 'first-name': { type: 'string' }, 'last-name': { type: 'string' },
        role: { type: 'string', default: 'counsellor' }, timezone: { type: 'string', default: 'Asia/Kolkata' },
        'calendar-id': { type: 'string' }, buffer: { type: 'string', default: '10' },
        'no-default-hours': { type: 'boolean', default: false }, promote: { type: 'boolean', default: false },
    },
});

const fail = (message) => {
    console.error(message);
    process.exit(1);
};
const email = (values.email || '').trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('--email is required');
if (!values['first-name']) fail('--first-name is required');
if (!['counsellor', 'admin', 'super_admin'].includes(values.role)) fail('--role must be counsellor, admin or super_admin');
if (!isValidTimeZone(values.timezone)) fail('--timezone must be an IANA timezone');
const buffer = Number.parseInt(values.buffer, 10);
if (!(buffer >= 0 && buffer <= 120)) fail('--buffer must be 0–120 minutes');
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) fail('DATABASE_URL is not set');

const generated = !process.env.STAFF_PASSWORD;
const password = process.env.STAFF_PASSWORD || randomBytes(15).toString('base64url');
if (password.length < 12) fail('STAFF_PASSWORD must be at least 12 characters for staff accounts');

const client = new pg.Client({ connectionString });
await client.connect();
try {
    await client.query('BEGIN');
    const existing = (await client.query('SELECT id, role FROM users WHERE LOWER(email) = $1', [email])).rows[0];
    let userId;
    if (existing) {
        if (!values.promote) fail(`A ${existing.role} account already exists for ${email}. Re-run with --promote to make it ${values.role}.`);
        userId = existing.id;
        await client.query('UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1', [userId, values.role]);
        console.log(`Promoted ${email} to ${values.role} (password unchanged).`);
    } else {
        userId = crypto.randomUUID();
        await client.query(
            `INSERT INTO users (id, email, email_verified_at, password_hash, role, first_name, last_name)
             VALUES ($1, $2, NOW(), $3, $4, $5, $6)`,
            [userId, email, await hashPassword(password), values.role, values['first-name'], values['last-name'] || null],
        );
        console.log(`Created ${values.role} ${email}.`);
        if (generated) console.log(`Temporary password (shown once, store it in your password manager): ${password}`);
    }

    // Admins can also take consultations; every staff member gets a counsellor profile.
    const displayName = [values['first-name'], values['last-name']].filter(Boolean).join(' ');
    await client.query(
        `INSERT INTO counsellors (user_id, display_name, timezone, buffer_minutes, calendar_id, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, timezone = EXCLUDED.timezone,
           buffer_minutes = EXCLUDED.buffer_minutes, calendar_id = COALESCE(EXCLUDED.calendar_id, counsellors.calendar_id), updated_at = NOW()`,
        [userId, displayName, values.timezone, buffer, values['calendar-id'] || null, values.role === 'counsellor'],
    );

    const hasRules = (await client.query('SELECT 1 FROM availability_rules WHERE counsellor_id = $1 LIMIT 1', [userId])).rows.length > 0;
    if (values.role === 'counsellor' && !values['no-default-hours'] && !hasRules) {
        for (let weekday = 1; weekday <= 6; weekday += 1) {
            await client.query(
                `INSERT INTO availability_rules (id, counsellor_id, weekday, start_time, end_time, timezone)
                 VALUES ($1, $2, $3, '10:00', '18:00', $4)`,
                [crypto.randomUUID(), userId, weekday, values.timezone],
            );
        }
        console.log(`Added default hours: Mon–Sat 10:00–18:00 ${values.timezone}.`);
    }
    await client.query(
        "INSERT INTO audit_log (action, entity_type, entity_id, details) VALUES ('staff.created_by_cli', 'user', $1, $2)",
        [userId, JSON.stringify({ role: values.role })],
    );
    await client.query('COMMIT');
} catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    fail(`Failed: ${error.message}`);
} finally {
    await client.end();
}
