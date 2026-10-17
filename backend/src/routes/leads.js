import { timingSafeEqual } from 'node:crypto';
import { createLead, listLeads } from '../services/lead-store.js';

const jsonHeaders = { 'Content-Type': 'application/json' };
const MAX_BODY_BYTES = 16 * 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCES = new Set(['consultation', 'contact', 'newsletter']);

const TEXT_FIELDS = {
    firstName: 120,
    lastName: 120,
    email: 320,
    phone: 40,
    primaryDestination: 80,
    intendedIntake: 40,
    studyLevel: 80,
    serviceInterest: 80,
    branch: 80,
    country: 80,
    passportStatus: 120,
    referralSource: 120,
    enquiryType: 120,
    message: 4000,
};

const BOOLEAN_FIELDS = ['contactConsent', 'ageConfirmation', 'marketingOptIn', 'partnerInstitutionOptIn', 'newsletterOptIn'];

export async function leadsRoute(request, response, pathname) {
    if (pathname === '/api/v1/leads' && request.method === 'GET') {
        // Leads hold students' contact details, so listing them needs the admin token.
        if (!isAdmin(request)) {
            response.writeHead(401, jsonHeaders);
            response.end(JSON.stringify({ error: 'Unauthorized' }));
            return true;
        }
        await respondWith(response, 200, async() => listLeads());
        return true;
    }

    if (pathname !== '/api/v1/leads' || request.method !== 'POST') {
        return false;
    }

    let body;
    try {
        body = await readJsonBody(request);
    } catch (error) {
        const status = error.code === 'BODY_TOO_LARGE' ? 413 : 400;
        response.writeHead(status, jsonHeaders);
        response.end(JSON.stringify({ error: status === 413 ? 'Request body is too large' : 'Request body must be valid JSON' }));
        return true;
    }

    const { lead, error } = normaliseLead(body);
    if (error) {
        response.writeHead(400, jsonHeaders);
        response.end(JSON.stringify({ error }));
        return true;
    }

    await respondWith(response, 201, async() => createLead(lead));
    return true;
}

async function respondWith(response, status, load) {
    try {
        const data = await load();
        response.writeHead(status, jsonHeaders);
        response.end(JSON.stringify({ data }));
    } catch (error) {
        console.error('Lead storage failed', error);
        response.writeHead(500, jsonHeaders);
        response.end(JSON.stringify({ error: 'Could not save or load leads. Please try again.' }));
    }
}

function isAdmin(request) {
    const token = process.env.ADMIN_API_TOKEN;
    const header = request.headers.authorization || '';
    if (!token || !header.startsWith('Bearer ')) return false;
    const given = Buffer.from(header.slice('Bearer '.length));
    const expected = Buffer.from(token);
    return given.length === expected.length && timingSafeEqual(given, expected);
}

/* Only known fields are stored, so a client cannot write arbitrary keys (or an id/createdAt) into a lead. */
function normaliseLead(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { error: 'Request body must be a JSON object' };
    }

    const source = SOURCES.has(body.source) ? body.source : 'consultation';
    const lead = { source };

    for (const [field, maxLength] of Object.entries(TEXT_FIELDS)) {
        if (body[field] === undefined || body[field] === null) continue;
        const value = String(body[field]).trim();
        if (value.length > maxLength) return { error: `${field} must be at most ${maxLength} characters` };
        if (value) lead[field] = value;
    }

    for (const field of BOOLEAN_FIELDS) {
        lead[field] = body[field] === true;
    }

    if (!lead.email) {
        return { error: 'email is required' };
    }
    // Newsletter sign-ups from the footer collect only an email address.
    if (source !== 'newsletter' && !lead.firstName) {
        return { error: 'firstName and email are required' };
    }
    if (!EMAIL_PATTERN.test(lead.email)) {
        return { error: 'email must be a valid email address' };
    }
    if (source === 'consultation' && !lead.phone) {
        return { error: 'phone is required for consultation requests' };
    }
    if (source === 'consultation' && !lead.contactConsent) {
        return { error: 'contactConsent is required for consultation requests' };
    }
    if (source === 'newsletter' && !lead.newsletterOptIn) {
        return { error: 'newsletterOptIn is required for newsletter sign-ups' };
    }
    if (source === 'contact' && !lead.message) {
        return { error: 'message is required for contact enquiries' };
    }

    return { lead };
}

function readJsonBody(request) {
    return new Promise((resolve, reject) => {
        let raw = '';
        let tooLarge = false;
        request.setEncoding('utf8');
        request.on('data', (chunk) => {
            if (tooLarge) return;
            raw += chunk;
            if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
                tooLarge = true;
                raw = '';
                const error = new Error('Body too large');
                error.code = 'BODY_TOO_LARGE';
                reject(error);
            }
        });
        request.on('end', () => {
            if (tooLarge) return;
            try {
                resolve(JSON.parse(raw || '{}'));
            } catch (error) {
                reject(error);
            }
        });
        request.on('error', reject);
    });
}
