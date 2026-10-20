/* Calendar provider boundary. A provider implements:
     name, configured
     getBusy(calendarId, from, to)                → [{ start, end }]
     createEvent({ calendarId, eventId, summary, description, start, end, timeZone, attendeeEmail, withMeet })
                                                  → { eventId, meetUrl|null }   (must be idempotent per eventId)
     deleteEvent({ calendarId, eventId })         → { deleted }                 (404/410 count as deleted)
   With no provider configured, bookings are confirmed from the database alone
   and no meeting link is generated. */
import { createGoogleCalendarProvider } from './google.js';

const noneProvider = { name: 'none', configured: false };
let override = null;
let google = null;

export function getCalendarProvider() {
    if (override) return override;
    if ((process.env.CALENDAR_PROVIDER || '').toLowerCase() !== 'google') return noneProvider;
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    if (!clientEmail || !privateKey.includes('PRIVATE KEY')) return noneProvider;
    google ||= createGoogleCalendarProvider({
        clientEmail,
        privateKey,
        impersonate: process.env.GOOGLE_CALENDAR_IMPERSONATE || '',
        createMeet: process.env.GOOGLE_CALENDAR_CREATE_MEET === 'true',
        inviteAttendees: process.env.GOOGLE_CALENDAR_INVITE_ATTENDEES === 'true',
    });
    return google;
}

export function setCalendarProvider(provider) {
    override = provider;
}

/* Google event ids allow a–v and 0–9. A new generation (e.g. after reassignment
   to another counsellor's calendar) gets a new id. */
export const calendarEventId = (consultationId, generation) => `gm${consultationId.replace(/-/g, '')}g${generation}`;
