/* Student documents and consultant CVs. Content lives in private storage
   (Google Drive); this table holds metadata and who may see it.

   Who can open a document
     - its owner (the student or applicant who uploaded it);
     - staff who may see that student (admins, or the student's consultant),
       except CVs, which are hiring data: only application reviewers see those.
   Every staff download is audited. Files are checked by size and by their
   first bytes (not only the declared type) before they are stored. */
import { createHash } from 'node:crypto';
import { getStorage } from '../integrations/storage/index.js';
import { now } from '../lib/clock.js';
import { query, withTransaction } from '../lib/db.js';
import { badRequest, conflict, HttpError, notFound } from '../lib/http.js';
import { assertStudentAccess } from './access.js';
import { audit } from './audit.js';
import { notifyUser } from './inbox.js';
import { enqueueNotification } from './notification-service.js';
import { can } from './permissions.js';

export const MAX_BYTES = 4 * 1024 * 1024; // under Vercel's 4.5 MB request limit
export const STUDENT_KINDS = ['transcript', 'passport', 'english_test', 'sop', 'recommendation', 'financial', 'offer_letter', 'other'];

const TYPES = {
    'application/pdf': { ext: 'pdf', magic: [[0x25, 0x50, 0x44, 0x46, 0x2d]] },
    'image/jpeg': { ext: 'jpg', magic: [[0xff, 0xd8, 0xff]] },
    'image/png': { ext: 'png', magic: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'docx', magic: [[0x50, 0x4b, 0x03, 0x04]] },
};
export const ALLOWED_TYPES = Object.keys(TYPES);
const CV_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

const iso = (value) => (value ? new Date(value).toISOString() : null);

function view(d) {
    return { id: d.id, kind: d.kind, filename: d.filename, mimeType: d.mime_type, sizeBytes: d.size_bytes, uploadedAt: iso(d.created_at) };
}

function requestView(r) {
    return { id: r.id, kind: r.kind, title: r.title, details: r.details, dueDate: r.due_date, status: r.status, documentId: r.document_id, requestedBy: r.requested_by_name || null, createdAt: iso(r.created_at) };
}

/* A safe display name with the extension that matches the real type. */
function cleanName(filename, mimeType) {
    const ext = TYPES[mimeType].ext;
    const base = String(filename || 'document').replace(/\.[A-Za-z0-9]{1,5}$/, '').normalize('NFKC').replace(/[^\w .()-]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 150) || 'document';
    return `${base}.${ext}`;
}

function checkFile({ mimeType, data }) {
    if (!data?.length) throw badRequest('The file is empty.');
    if (data.length > MAX_BYTES) throw new HttpError(413, 'Files can be at most 4 MB.', 'FILE_TOO_LARGE');
    const type = TYPES[mimeType];
    if (!type) throw new HttpError(415, 'Upload a PDF, JPG, PNG or Word (.docx) file.', 'UNSUPPORTED_FILE_TYPE');
    if (!type.magic.some((sig) => sig.every((byte, i) => data[i] === byte))) {
        throw new HttpError(415, 'The file content does not match its type. Upload a PDF, JPG, PNG or Word (.docx) file.', 'FILE_CONTENT_MISMATCH');
    }
}

function storage() {
    const s = getStorage();
    if (!s.configured) throw new HttpError(503, 'Document storage is not set up yet. Please try again later or email your documents to your counsellor.', 'STORAGE_UNAVAILABLE');
    return s;
}

/* Stores the file, then records it; if recording fails the stored file is removed again. */
async function store(owner, actor, { kind, filename, mimeType, data }, work) {
    checkFile({ mimeType, data });
    const s = storage();
    const id = crypto.randomUUID();
    const name = cleanName(filename, mimeType);
    const { key } = await s.upload({ name: `${id}-${name}`, mimeType, data, properties: { gradmireDocumentId: id, ownerUserId: owner.id, kind } });
    try {
        return await withTransaction(async (client) => {
            const { rows } = await client.query(
                `INSERT INTO documents (id, owner_user_id, kind, filename, mime_type, size_bytes, sha256, storage_provider, storage_key, uploaded_by, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
                [id, owner.id, kind, name, mimeType, data.length, createHash('sha256').update(data).digest('hex'), s.name, key, actor.id, now()],
            );
            await audit(client, { actorUserId: actor.id, action: 'document.uploaded', entityType: 'document', entityId: id, details: { kind, ownerUserId: owner.id, sizeBytes: data.length } });
            return work(client, rows[0]);
        });
    } catch (error) {
        await s.remove(key).catch(() => {});
        throw error;
    }
}

/* ── Students ─────────────────────────────────────────────────────────────── */

export async function uploadMine(user, { kind, filename, mimeType, data, requestId = null }) {
    if (!STUDENT_KINDS.includes(kind)) throw badRequest('Choose what kind of document this is.', { fields: { kind: 'Choose a document type' } });
    return store(user, user, { kind, filename, mimeType, data }, async (client, doc) => {
        if (requestId) {
            const r = (await client.query("SELECT * FROM document_requests WHERE id = $1 AND student_user_id = $2 AND status = 'open' FOR UPDATE", [requestId, user.id])).rows[0];
            if (!r) throw notFound('That document request is not open.');
            await client.query("UPDATE document_requests SET status = 'fulfilled', document_id = $2, updated_at = NOW() WHERE id = $1", [requestId, doc.id]);
            if (r.requested_by) await notifyUser(client, r.requested_by, { kind: 'document_uploaded', title: 'Requested document uploaded', body: `${user.first_name} uploaded "${r.title}".`, link: 'consultant-students' });
        }
        return view(doc);
    });
}

export async function listMine(user) {
    const [docs, requests] = await Promise.all([
        query("SELECT * FROM documents WHERE owner_user_id = $1 AND status = 'active' ORDER BY created_at DESC", [user.id]),
        query(
            `SELECT r.*, u.first_name || COALESCE(' ' || u.last_name, '') AS requested_by_name FROM document_requests r
             LEFT JOIN users u ON u.id = r.requested_by WHERE r.student_user_id = $1 AND r.status <> 'cancelled' ORDER BY r.status = 'open' DESC, r.created_at DESC`,
            [user.id],
        ),
    ]);
    return { documents: docs.rows.map(view), requests: requests.rows.map(requestView), maxBytes: MAX_BYTES, allowedTypes: ALLOWED_TYPES };
}

export async function removeMine(user, id) {
    let key = null;
    let provider = null;
    await withTransaction(async (client) => {
        const d = (await client.query("SELECT * FROM documents WHERE id = $1 AND owner_user_id = $2 AND status = 'active' FOR UPDATE", [id, user.id])).rows[0];
        if (!d) throw notFound('Document not found');
        const inUse = (await client.query(
            "SELECT 1 FROM consultant_applications WHERE cv_document_id = $1 AND status NOT IN ('approved', 'rejected', 'withdrawn')",
            [id],
        )).rows.length;
        if (inUse) throw conflict('This CV is part of an open consultant application. Replace it there first.', 'DOCUMENT_IN_USE');
        await client.query("UPDATE documents SET status = 'deleted', deleted_by = $2, deleted_at = $3 WHERE id = $1", [id, user.id, now()]);
        // A deleted upload no longer answers the request it fulfilled.
        await client.query("UPDATE document_requests SET status = 'open', document_id = NULL, updated_at = NOW() WHERE document_id = $1 AND status = 'fulfilled'", [id]);
        await audit(client, { actorUserId: user.id, action: 'document.deleted', entityType: 'document', entityId: id });
        key = d.storage_key;
        provider = d.storage_provider;
    });
    const s = getStorage();
    if (s.configured && s.name === provider) await s.remove(key).catch((error) => console.warn('Stored file not removed; remove it manually:', error.message));
    return { deleted: true };
}

/* ── CVs for consultant applications ──────────────────────────────────────── */

export async function uploadCv(user, { filename, mimeType, data }) {
    if (!CV_TYPES.includes(mimeType)) throw new HttpError(415, 'Upload your CV as a PDF or Word (.docx) file.', 'UNSUPPORTED_FILE_TYPE');
    return store(user, user, { kind: 'cv', filename, mimeType, data }, async (client, doc) => view(doc));
}

/* Confirms a CV document belongs to the applicant (used when saving an application). */
export async function assertOwnCv(client, userId, documentId) {
    const ok = (await client.query("SELECT 1 FROM documents WHERE id = $1 AND owner_user_id = $2 AND kind = 'cv' AND status = 'active'", [documentId, userId])).rows.length;
    if (!ok) throw badRequest('Upload your CV again.', { fields: { cvDocumentId: 'CV not found' } });
}

/* ── Staff ────────────────────────────────────────────────────────────────── */

export async function listForStudent(staff, studentId) {
    await assertStudentAccess({ query }, staff, studentId);
    const [docs, requests] = await Promise.all([
        query("SELECT * FROM documents WHERE owner_user_id = $1 AND status = 'active' AND kind <> 'cv' ORDER BY created_at DESC", [studentId]),
        query(
            `SELECT r.*, u.first_name || COALESCE(' ' || u.last_name, '') AS requested_by_name FROM document_requests r
             LEFT JOIN users u ON u.id = r.requested_by WHERE r.student_user_id = $1 ORDER BY r.status = 'open' DESC, r.created_at DESC`,
            [studentId],
        ),
    ]);
    return { documents: docs.rows.map(view), requests: requests.rows.map(requestView) };
}

export async function requestDocument(staff, studentId, { kind, title, details, dueDate }) {
    return withTransaction(async (client) => {
        await assertStudentAccess(client, staff, studentId);
        const student = (await client.query('SELECT id, email, first_name FROM users WHERE id = $1', [studentId])).rows[0];
        const id = crypto.randomUUID();
        const { rows } = await client.query(
            `INSERT INTO document_requests (id, student_user_id, requested_by, kind, title, details, due_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [id, studentId, staff.id, kind || 'other', title, details || null, dueDate || null],
        );
        await notifyUser(client, studentId, { kind: 'document_requested', title: `Document requested: ${title}`, body: details || 'Upload it in My documents.', link: 'dashboard-documents' });
        await enqueueNotification(client, {
            userId: studentId, template: 'document_requested', recipient: student.email, dedupeKey: `document_request:${id}`,
            payload: { firstName: student.first_name, title, details: details || '', dueDate: dueDate || null },
        });
        await audit(client, { actorUserId: staff.id, action: 'document.requested', entityType: 'user', entityId: studentId, details: { requestId: id, kind: kind || 'other' } });
        return requestView(rows[0]);
    });
}

export async function cancelRequest(staff, requestId) {
    return withTransaction(async (client) => {
        const r = (await client.query('SELECT * FROM document_requests WHERE id = $1 FOR UPDATE', [requestId])).rows[0];
        if (!r) throw notFound('Request not found');
        await assertStudentAccess(client, staff, r.student_user_id);
        if (r.status !== 'open') throw conflict('Only an open request can be cancelled.', 'NOT_OPEN');
        const { rows } = await client.query("UPDATE document_requests SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *", [requestId]);
        await audit(client, { actorUserId: staff.id, action: 'document.request_cancelled', entityType: 'user', entityId: r.student_user_id, details: { requestId } });
        return requestView(rows[0]);
    });
}

/* ── Downloads ────────────────────────────────────────────────────────────── */

async function readContent(d) {
    const s = getStorage();
    if (!s.configured || s.name !== d.storage_provider) throw new HttpError(503, 'Document storage is not available right now.', 'STORAGE_UNAVAILABLE');
    const data = await s.download(d.storage_key);
    if (!data) throw notFound('This file is no longer in storage.');
    return { filename: d.filename, mimeType: d.mime_type, data };
}

export async function downloadForOwner(user, id) {
    const d = (await query("SELECT * FROM documents WHERE id = $1 AND owner_user_id = $2 AND status = 'active'", [id, user.id])).rows[0];
    if (!d) throw notFound('Document not found');
    return readContent(d);
}

export async function downloadForStaff(staff, id) {
    const d = (await query("SELECT * FROM documents WHERE id = $1 AND status = 'active'", [id])).rows[0];
    if (!d) throw notFound('Document not found');
    if (d.kind === 'cv') {
        // Hiring data: reviewers only, and only CVs attached to an application.
        if (!can(staff, 'consultant_application.review')) throw notFound('Document not found');
        const attached = (await query('SELECT 1 FROM consultant_applications WHERE cv_document_id = $1', [id])).rows.length;
        if (!attached) throw notFound('Document not found');
    } else {
        await assertStudentAccess({ query }, staff, d.owner_user_id);
    }
    const content = await readContent(d);
    await withTransaction((client) => audit(client, { actorUserId: staff.id, action: 'document.downloaded', entityType: 'document', entityId: id, details: { ownerUserId: d.owner_user_id, kind: d.kind } }));
    return content;
}

