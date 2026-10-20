/* Google Calendar + Meet for consultant interviews. Runs after the status change
   has committed, so a rejected request never leaves an orphan event. The event
   goes on the reviewer's calendar (their counsellor calendar id) or, failing
   that, GOOGLE_INTERVIEW_CALENDAR_ID. Event ids are deterministic per
   (application, generation): rescheduling bumps the generation, removes the old
   event and creates a new one, and a retried create reuses the same event.
   Without a calendar the interview simply has no link (status not_required),
   and a failure is recorded (failed) for staff to retry; it never blocks the
   decision itself. */
import { getCalendarProvider } from '../integrations/calendar/index.js';
import { query } from '../lib/db.js';

const minutes = () => Math.min(240, Math.max(15, Number.parseInt(process.env.INTERVIEW_DURATION_MINUTES || '45', 10) || 45));
export const interviewEventId = (applicationId, generation) => `gi${applicationId.replace(/-/g, '')}g${generation}`;

async function calendarFor(a) {
    if (a.reviewer_user_id) {
        const c = (await query('SELECT calendar_id FROM counsellors WHERE user_id = $1', [a.reviewer_user_id])).rows[0];
        if (c?.calendar_id) return c.calendar_id;
    }
    return process.env.GOOGLE_INTERVIEW_CALENDAR_ID || null;
}

/* Brings the calendar in line with the application's current state. Returns the fresh row. */
export async function syncInterviewMeeting(applicationId) {
    const a = (await query('SELECT * FROM consultant_applications WHERE id = $1', [applicationId])).rows[0];
    if (!a) return null;
    const provider = getCalendarProvider();
    const wanted = a.status === 'interview_scheduled' && a.interview_at;
    const currentId = wanted ? interviewEventId(a.id, a.interview_generation) : null;

    // An event for an older time, or for an interview that is no longer happening, goes.
    if (a.interview_event_id && a.interview_event_id !== currentId) {
        if (provider.configured && a.interview_calendar_id) {
            try {
                await provider.deleteEvent({ calendarId: a.interview_calendar_id, eventId: a.interview_event_id });
            } catch (error) {
                console.warn('Interview event not removed; remove it in Google Calendar:', error.message);
            }
        }
        await query(
            "UPDATE consultant_applications SET interview_event_id = NULL, interview_meet_url = NULL, interview_calendar_id = NULL, interview_calendar_status = 'not_required' WHERE id = $1",
            [a.id],
        );
    }
    if (!wanted) return (await query('SELECT * FROM consultant_applications WHERE id = $1', [a.id])).rows[0];

    const calendarId = await calendarFor(a);
    if (!provider.configured || !calendarId) {
        await query("UPDATE consultant_applications SET interview_calendar_status = 'not_required' WHERE id = $1", [a.id]);
        return (await query('SELECT * FROM consultant_applications WHERE id = $1', [a.id])).rows[0];
    }
    try {
        const start = new Date(a.interview_at);
        const result = await provider.createEvent({
            calendarId,
            eventId: currentId,
            summary: `Gradmire consultant interview: ${a.full_name}`,
            description: `Interview for the Gradmire consultant role.\nApplicant: ${a.full_name}\nDetails are in the Gradmire admin workspace (Team and hiring).`,
            start,
            end: new Date(start.getTime() + minutes() * 60_000),
            timeZone: 'UTC',
            attendeeEmail: a.email,
            withMeet: true,
        });
        await query(
            "UPDATE consultant_applications SET interview_event_id = $2, interview_meet_url = $3, interview_calendar_id = $4, interview_calendar_status = 'synced' WHERE id = $1",
            [a.id, result.eventId, result.meetUrl || null, calendarId],
        );
    } catch (error) {
        console.warn('Interview calendar event failed:', error.message);
        await query("UPDATE consultant_applications SET interview_calendar_status = 'failed', interview_calendar_id = $2 WHERE id = $1", [a.id, calendarId]);
    }
    return (await query('SELECT * FROM consultant_applications WHERE id = $1', [a.id])).rows[0];
}
