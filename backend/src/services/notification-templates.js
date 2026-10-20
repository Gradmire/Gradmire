/* Plain, factual email templates. Every value is escaped for HTML. A meeting
   link is only mentioned when one was actually generated or entered by staff. */
import { config } from '../config.js';

const esc = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const METHOD = { video: 'Video call', phone: 'Phone call', in_person: 'In person' };

export function formatWhen(startIso, endIso, timeZone) {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const date = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(start);
    const time = (d) => new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
    return { date, time: `${time(start)}–${time(end)}`, timeZone };
}

const pageUrl = (page, hash = '') => `${config.siteUrl()}${config.pagesPath()}/${page}${hash}`;

function layout(title, paragraphs, rows = [], action = null) {
    const text = [title, '', ...paragraphs, '', ...rows.map(([label, value]) => `${label}: ${value}`), ...(action ? ['', `${action.label}: ${action.url}`] : []), '', '— Gradmire'].join('\n');
    const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#0E1420;line-height:1.55;max-width:560px;margin:auto;padding:24px">
<h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>
${paragraphs.map((p) => `<p style="margin:0 0 12px">${esc(p)}</p>`).join('\n')}
${rows.length ? `<table style="border-collapse:collapse;margin:8px 0 16px">${rows.map(([label, value]) => `<tr><td style="padding:4px 16px 4px 0;color:#556270">${esc(label)}</td><td style="padding:4px 0"><strong>${esc(value)}</strong></td></tr>`).join('')}</table>` : ''}
${action ? `<p><a href="${esc(action.url)}" style="display:inline-block;background:#007A5A;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700">${esc(action.label)}</a></p>` : ''}
<p style="color:#556270;font-size:13px;margin-top:24px">Gradmire Education Pvt. Ltd. · This is a transactional message about your consultation.</p>
</body></html>`;
    return { text, html };
}

function bookingRows(p) {
    const when = formatWhen(p.start, p.end, p.timeZone);
    return [
        ['Consultation', p.typeName],
        ['Date', when.date],
        ['Time', `${when.time} (${when.timeZone})`],
        ['Method', METHOD[p.meetingMethod] || p.meetingMethod],
        ['Counsellor', p.counsellorName],
        ['Reference', p.reference],
        ...(p.meetingUrl ? [['Meeting link', p.meetingUrl]] : []),
    ];
}

function linkNote(p) {
    if (p.meetingUrl) return 'Join with the meeting link below at the scheduled time.';
    if (p.meetingMethod === 'video') return 'Your counsellor will send the video-call link before the session.';
    if (p.meetingMethod === 'phone') return `Your counsellor will call you on ${p.phone || 'the number you gave us'}.`;
    return 'Your counsellor will confirm the meeting location with you.';
}

const policy = (hours) => `You can reschedule or cancel up to ${hours} hours before the start time.`;

export function renderTemplate(template, p) {
    const manage = p.manageToken ? { label: 'View or change your booking', url: pageUrl('manage-consultation.html', `#token=${encodeURIComponent(p.manageToken)}`) } : null;
    switch (template) {
        case 'booking_confirmed':
            return { subject: `Confirmed: ${p.typeName} on ${formatWhen(p.start, p.end, p.timeZone).date}`, ...layout('Your consultation is confirmed', [`Hi ${p.firstName},`, `Your ${p.typeName} with Gradmire is booked.`, linkNote(p), policy(p.cutoffHours)], bookingRows(p), manage) };
        case 'booking_rescheduled':
            return { subject: `Rescheduled: ${p.typeName} on ${formatWhen(p.start, p.end, p.timeZone).date}`, ...layout('Your consultation has a new time', [`Hi ${p.firstName},`, 'Your consultation has been moved. The new details are below; the previous time is no longer reserved.', linkNote(p), policy(p.cutoffHours)], bookingRows(p), manage) };
        case 'booking_cancelled':
            return { subject: `Cancelled: ${p.typeName} (${p.reference})`, ...layout('Your consultation was cancelled', [`Hi ${p.firstName},`, `Your ${p.typeName} on ${formatWhen(p.start, p.end, p.timeZone).date} has been cancelled.`, 'You can book a new time whenever suits you.'], [['Reference', p.reference]], { label: 'Book a new consultation', url: pageUrl('book-consultation.html') }) };
        case 'reminder_24h':
        case 'reminder_1h':
            return { subject: `Reminder: ${p.typeName} ${template === 'reminder_1h' ? 'starts in 1 hour' : 'is tomorrow'}`, ...layout('Consultation reminder', [`Hi ${p.firstName},`, `This is a reminder of your upcoming ${p.typeName}.`, linkNote(p)], bookingRows(p), manage) };
        case 'counsellor_new_booking':
            return { subject: `New consultation: ${p.typeName}, ${formatWhen(p.start, p.end, p.counsellorTimeZone).date}`, ...layout('A consultation was assigned to you', [`Student: ${p.studentName}`], bookingRows({ ...p, timeZone: p.counsellorTimeZone }), { label: 'Open in the consultations dashboard', url: pageUrl('admin-consultations.html', `#id=${p.consultationId}`) }) };
        case 'counsellor_cancelled':
            return { subject: `Cancelled: ${p.typeName} with ${p.studentName}`, ...layout('A consultation was cancelled', [`${p.studentName}'s ${p.typeName} has been cancelled or moved.`], bookingRows({ ...p, timeZone: p.counsellorTimeZone }), null) };
        case 'staff_calendar_failed':
            return { subject: `Action needed: calendar sync failed (${p.reference})`, ...layout('Calendar sync failed', ['A booking is reserved but its calendar event could not be created after several attempts. Confirm it manually or retry the sync.', `Last error: ${p.error}`], [['Reference', p.reference]], { label: 'Open booking', url: pageUrl('admin-consultations.html', `#id=${p.consultationId}`) }) };
        case 'email_verification':
            return { subject: 'Verify your Gradmire email address', ...layout('Confirm your email address', [`Hi ${p.firstName},`, 'Confirm this address to finish setting up your account. Once it is verified, consultations you booked with this email appear in your dashboard.', 'The link expires in 48 hours. If you did not create a Gradmire account, ignore this email.'], [], { label: 'Verify email', url: pageUrl('dashboard-consultations.html', `#verify=${encodeURIComponent(p.token)}`) }) };
        default:
            throw Object.assign(new Error(`Unknown template ${template}`), { permanent: true });
    }
}
