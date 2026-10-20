/* Google Calendar v3 over plain HTTPS with a service account (no SDK).
   - Auth: OAuth 2.0 JWT bearer grant signed with the service account key. With
     GOOGLE_CALENDAR_IMPERSONATE set (Workspace domain-wide delegation) calls run
     as that user, which is also what allows Meet links and attendee invites.
   - Idempotency: each event uses a deterministic id, so a retried insert gets
     409 and we fetch the existing event instead of creating a duplicate.
   Credentials stay server-side; nothing here is returned to clients. */
import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/calendar/v3';
const SCOPE = 'https://www.googleapis.com/auth/calendar';

const b64url = (value) => Buffer.from(value).toString('base64url');

export function createGoogleCalendarProvider({ clientEmail, privateKey, impersonate, createMeet, inviteAttendees }) {
    let cached = null;

    async function accessToken() {
        if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;
        const issuedAt = Math.floor(Date.now() / 1000);
        const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
        const claims = b64url(JSON.stringify({
            iss: clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: issuedAt, exp: issuedAt + 3600,
            ...(impersonate ? { sub: impersonate } : {}),
        }));
        const signer = createSign('RSA-SHA256');
        signer.update(`${header}.${claims}`);
        const assertion = `${header}.${claims}.${signer.sign(privateKey).toString('base64url')}`;
        const response = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
            signal: AbortSignal.timeout(8000),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body.access_token) throw new Error(`Google token request failed (${response.status} ${body.error || ''})`.trim());
        cached = { token: body.access_token, expiresAt: Date.now() + (body.expires_in || 3600) * 1000 };
        return cached.token;
    }

    async function call(method, path, body) {
        const response = await fetch(`${API}${path}`, {
            method,
            headers: { Authorization: `Bearer ${await accessToken()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(8000),
        });
        const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
        return { status: response.status, ok: response.ok, data };
    }

    const meetUrlOf = (event) => event?.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video')?.uri || null;
    const fail = (what, result) => new Error(`Google Calendar ${what} failed (${result.status} ${result.data?.error?.message || ''})`.trim().slice(0, 300));

    return {
        name: 'google',
        configured: true,

        async getBusy(calendarId, from, to) {
            const result = await call('POST', '/freeBusy', { timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: calendarId }] });
            if (!result.ok) throw fail('free/busy', result);
            const calendar = result.data.calendars?.[calendarId];
            if (calendar?.errors?.length) throw new Error(`Google Calendar free/busy error: ${calendar.errors[0].reason}`);
            return (calendar?.busy || []).map((busy) => ({ start: new Date(busy.start), end: new Date(busy.end) }));
        },

        async createEvent({ calendarId, eventId, summary, description, start, end, timeZone, attendeeEmail, withMeet }) {
            const path = `/calendars/${encodeURIComponent(calendarId)}/events`;
            const wantMeet = withMeet && createMeet;
            const event = {
                id: eventId,
                summary,
                description,
                start: { dateTime: start.toISOString(), timeZone },
                end: { dateTime: end.toISOString(), timeZone },
                ...(inviteAttendees && attendeeEmail ? { attendees: [{ email: attendeeEmail }] } : {}),
                ...(wantMeet ? { conferenceData: { createRequest: { requestId: eventId, conferenceSolutionKey: { type: 'hangoutsMeet' } } } } : {}),
                extendedProperties: { private: { gradmire: 'consultation' } },
            };
            const query = `?conferenceDataVersion=${wantMeet ? 1 : 0}&sendUpdates=${inviteAttendees ? 'all' : 'none'}`;
            let result = await call('POST', `${path}${query}`, event);
            if (result.status === 409) {
                // Already created by an earlier attempt: reuse it.
                result = await call('GET', `${path}/${encodeURIComponent(eventId)}`);
                if (!result.ok) throw fail('event lookup', result);
                if (result.data.status === 'cancelled') throw Object.assign(new Error('Calendar event id was used by a cancelled event'), { permanent: true });
            } else if (!result.ok) {
                throw Object.assign(fail('event insert', result), { permanent: result.status === 400 || result.status === 404 });
            }
            return { eventId: result.data.id, meetUrl: meetUrlOf(result.data) };
        },

        async deleteEvent({ calendarId, eventId }) {
            const result = await call('DELETE', `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=${inviteAttendees ? 'all' : 'none'}`);
            if (result.ok || result.status === 404 || result.status === 410) return { deleted: true };
            throw fail('event delete', result);
        },
    };
}
