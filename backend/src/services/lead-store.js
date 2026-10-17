import { getPool } from './db.js';

/* Lead fields (camelCase, as the API speaks) mapped to their columns. */
const COLUMNS = {
    id: 'id',
    source: 'source',
    firstName: 'first_name',
    lastName: 'last_name',
    email: 'email',
    phone: 'phone',
    primaryDestination: 'primary_destination',
    intendedIntake: 'intended_intake',
    studyLevel: 'study_level',
    serviceInterest: 'service_interest',
    branch: 'branch',
    country: 'country',
    passportStatus: 'passport_status',
    referralSource: 'referral_source',
    enquiryType: 'enquiry_type',
    message: 'message',
    contactConsent: 'contact_consent',
    ageConfirmation: 'age_confirmation',
    marketingOptIn: 'marketing_opt_in',
    partnerInstitutionOptIn: 'partner_institution_opt_in',
    newsletterOptIn: 'newsletter_opt_in',
};

const SELECT_LIST = [...Object.entries(COLUMNS), ['createdAt', 'created_at']]
    .map(([field, column]) => `${column} AS "${field}"`)
    .join(', ');

// Used when DATABASE_URL is not set (local development and CI without a database).
const memoryLeads = [];

export async function createLead(input) {
    const lead = { id: crypto.randomUUID(), ...input };
    const pool = getPool();

    if (!pool) {
        const stored = { ...lead, createdAt: new Date().toISOString() };
        memoryLeads.push(stored);
        return stored;
    }

    const fields = Object.keys(COLUMNS).filter((field) => lead[field] !== undefined);
    const columns = fields.map((field) => COLUMNS[field]).join(', ');
    const placeholders = fields.map((_, index) => `$${index + 1}`).join(', ');
    const { rows } = await pool.query(
        `INSERT INTO leads (${columns}) VALUES (${placeholders}) RETURNING ${SELECT_LIST}`,
        fields.map((field) => lead[field]),
    );
    return rows[0];
}

export async function listLeads({ limit = 100 } = {}) {
    const pool = getPool();
    if (!pool) return [...memoryLeads].reverse().slice(0, limit);

    const { rows } = await pool.query(`SELECT ${SELECT_LIST} FROM leads ORDER BY created_at DESC LIMIT $1`, [limit]);
    return rows;
}
