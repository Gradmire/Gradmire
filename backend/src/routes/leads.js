import { createLead, listLeads } from '../services/lead-store.js';

const jsonHeaders = { 'Content-Type': 'application/json' };

export async function leadsRoute(request, response) {
    if (request.url === '/api/v1/leads' && request.method === 'GET') {
        response.writeHead(200, jsonHeaders);
        response.end(JSON.stringify({ data: listLeads() }));
        return true;
    }

    if (request.url !== '/api/v1/leads' || request.method !== 'POST') {
        return false;
    }

    try {
        const body = await readJsonBody(request);
        if (!body.email || !body.firstName || !body.phone) {
            response.writeHead(400, jsonHeaders);
            response.end(JSON.stringify({ error: 'firstName, email, and phone are required' }));
            return true;
        }

        const lead = createLead(body);
        response.writeHead(201, jsonHeaders);
        response.end(JSON.stringify({ data: lead }));
    } catch {
        response.writeHead(400, jsonHeaders);
        response.end(JSON.stringify({ error: 'Request body must be valid JSON' }));
    }

    return true;
}

function readJsonBody(request) {
    return new Promise((resolve, reject) => {
        let raw = '';
        request.setEncoding('utf8');
        request.on('data', (chunk) => { raw += chunk; });
        request.on('end', () => {
            try {
                resolve(JSON.parse(raw || '{}'));
            } catch (error) {
                reject(error);
            }
        });
        request.on('error', reject);
    });
}