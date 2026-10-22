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

const ACCOUNT_FOOTER = 'This is a service message about your Gradmire account.';
const BOOKING_FOOTER = 'This is a transactional message about your consultation.';

function layout(title, paragraphs, rows = [], action = null, footer = BOOKING_FOOTER) {
    const text = [title, '', ...paragraphs, '', ...rows.map(([label, value]) => `${label}: ${value}`), ...(action ? ['', `${action.label}: ${action.url}`] : []), '', '— Gradmire'].join('\n');
    const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#0E1420;line-height:1.55;max-width:560px;margin:auto;padding:24px">
<h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>
${paragraphs.map((p) => `<p style="margin:0 0 12px">${esc(p)}</p>`).join('\n')}
${rows.length ? `<table style="border-collapse:collapse;margin:8px 0 16px">${rows.map(([label, value]) => `<tr><td style="padding:4px 16px 4px 0;color:#556270">${esc(label)}</td><td style="padding:4px 0"><strong>${esc(value)}</strong></td></tr>`).join('')}</table>` : ''}
${action ? `<p><a href="${esc(action.url)}" style="display:inline-block;background:#007A5A;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700">${esc(action.label)}</a></p>` : ''}
<p style="color:#556270;font-size:13px;margin-top:24px">Gradmire Education Pvt. Ltd. · ${esc(footer)}</p>
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
    const manage = p.manageToken ? { label: 'View or change your booking', url: pageUrl('manage-consultation', `#token=${encodeURIComponent(p.manageToken)}`) } : null;
    switch (template) {
        case 'booking_confirmed':
            return { subject: `Confirmed: ${p.typeName} on ${formatWhen(p.start, p.end, p.timeZone).date}`, ...layout('Your consultation is confirmed', [`Hi ${p.firstName},`, `Your ${p.typeName} with Gradmire is booked.`, linkNote(p), policy(p.cutoffHours)], bookingRows(p), manage) };
        case 'booking_rescheduled':
            return { subject: `Rescheduled: ${p.typeName} on ${formatWhen(p.start, p.end, p.timeZone).date}`, ...layout('Your consultation has a new time', [`Hi ${p.firstName},`, 'Your consultation has been moved. The new details are below; the previous time is no longer reserved.', linkNote(p), policy(p.cutoffHours)], bookingRows(p), manage) };
        case 'booking_cancelled':
            return { subject: `Cancelled: ${p.typeName} (${p.reference})`, ...layout('Your consultation was cancelled', [`Hi ${p.firstName},`, `Your ${p.typeName} on ${formatWhen(p.start, p.end, p.timeZone).date} has been cancelled.`, 'You can book a new time whenever suits you.'], [['Reference', p.reference]], { label: 'Book a new consultation', url: pageUrl('book-consultation') }) };
        case 'reminder_24h':
        case 'reminder_1h':
            return { subject: `Reminder: ${p.typeName} ${template === 'reminder_1h' ? 'starts in 1 hour' : 'is tomorrow'}`, ...layout('Consultation reminder', [`Hi ${p.firstName},`, `This is a reminder of your upcoming ${p.typeName}.`, linkNote(p)], bookingRows(p), manage) };
        case 'counsellor_new_booking':
            return { subject: `New consultation: ${p.typeName}, ${formatWhen(p.start, p.end, p.counsellorTimeZone).date}`, ...layout('A consultation was assigned to you', [`Student: ${p.studentName}`], bookingRows({ ...p, timeZone: p.counsellorTimeZone }), { label: 'Open in the consultations dashboard', url: pageUrl('admin-consultations', `#id=${p.consultationId}`) }) };
        case 'counsellor_cancelled':
            return { subject: `Cancelled: ${p.typeName} with ${p.studentName}`, ...layout('A consultation was cancelled', [`${p.studentName}'s ${p.typeName} has been cancelled or moved.`], bookingRows({ ...p, timeZone: p.counsellorTimeZone }), null) };
        case 'staff_calendar_failed':
            return { subject: `Action needed: calendar sync failed (${p.reference})`, ...layout('Calendar sync failed', ['A booking is reserved but its calendar event could not be created after several attempts. Confirm it manually or retry the sync.', `Last error: ${p.error}`], [['Reference', p.reference]], { label: 'Open booking', url: pageUrl('admin-consultations', `#id=${p.consultationId}`) }) };
        case 'email_verification':
            return { subject: 'Verify your Gradmire email address', ...layout('Confirm your email address', [`Hi ${p.firstName},`, 'Confirm this address to finish setting up your account. Once it is verified, consultations you booked with this email appear in your dashboard.', 'The link expires in 48 hours. If you did not create a Gradmire account, ignore this email.'], [], { label: 'Verify email', url: pageUrl('dashboard-consultations', `#verify=${encodeURIComponent(p.token)}`) }) };
        case 'booking_link':
            return { subject: `Your Gradmire booking: ${p.typeName} on ${formatWhen(p.start, p.end, p.timeZone).date}`, ...layout('Here is your booking link', [`Hi ${p.firstName},`, 'You asked us to resend the link for your consultation. Use it to view, reschedule or cancel. If you did not ask for this, you can ignore this email; the link only works for this booking.'], bookingRows(p), manage) };
        case 'consultant_application_update':
            return { subject: `Your Gradmire consultant application: ${p.statusLabel}`, ...layout('Your application was updated', [`Hi ${p.firstName},`, `The status of your application to join Gradmire as a consultant is now: ${p.statusLabel}.`, ...(p.message ? [p.message] : []), 'You can follow your application in your dashboard.'], [], { label: 'View my application', url: pageUrl('dashboard-become-consultant') }, ACCOUNT_FOOTER) };
        case 'employee_invitation':
            return { subject: 'You are invited to join the Gradmire team', ...layout('Join the Gradmire team', [`Hi ${p.fullName},`, `You have been invited to join Gradmire as ${p.jobTitle} (${p.department}).`, 'Open the link to review your invitation; opening it does not accept the invitation. After you sign in or create an account with this email address and verify it, click Accept the invitation on the page. An administrator must approve your onboarding before staff access is enabled.', `The invitation expires on ${new Date(p.expiresAt).toUTCString().slice(0, 16)}. If you were not expecting it, ignore this email.`], [], { label: 'Review invitation', url: pageUrl('join-team', `#token=${encodeURIComponent(p.token)}`) }, ACCOUNT_FOOTER) };
        case 'access_changed':
            return { subject: p.subject, ...layout(p.subject, [`Hi ${p.firstName},`, p.message, 'Log in again to see your updated workspace.'], [], { label: 'Log in', url: pageUrl('login') }, ACCOUNT_FOOTER) };
        case 'password_reset':
            return { subject: 'Reset your Gradmire password', ...layout('Reset your password', [`Hi ${p.firstName},`, 'We received a request to reset the password for your Gradmire account. Use the button below to choose a new password.', `The link works once and expires in ${p.minutes} minutes. If you did not ask for this, ignore this email; your password stays the same.`], [], { label: 'Choose a new password', url: pageUrl('reset-password', `#token=${encodeURIComponent(p.token)}`) }, ACCOUNT_FOOTER) };
        case 'password_changed':
            return { subject: 'Your Gradmire password was changed', ...layout('Your password was changed', [`Hi ${p.firstName},`, 'The password for your Gradmire account was just changed and every device was signed out.', 'If this was not you, reset your password straight away and contact info@gradmire.com.'], [], { label: 'Log in', url: pageUrl('login') }, ACCOUNT_FOOTER) };
        case 'email_change_confirm':
            return { subject: 'Confirm your new Gradmire email address', ...layout('Confirm your new email address', [`Hi ${p.firstName},`, 'You asked to use this address to log in to Gradmire. Confirm it with the button below. After confirming, you will be signed out everywhere and log in with this address.', 'The link expires in 24 hours. If you did not ask for this, ignore this email; nothing changes.'], [], { label: 'Confirm new email', url: pageUrl('dashboard-profile', `#email-change=${encodeURIComponent(p.token)}`) }, ACCOUNT_FOOTER) };
        case 'email_change_notice':
            return { subject: 'Your Gradmire login email is being changed', ...layout('Email change requested', [`Hi ${p.firstName},`, `Someone signed in to your account asked to change its login email to ${p.newEmail}. The change only happens if that address confirms it.`, 'If this was not you, change your password now and contact Gradmire support.'], [], { label: 'Log in', url: pageUrl('login') }, ACCOUNT_FOOTER) };
        case 'email_changed':
            return { subject: 'Your Gradmire login email was changed', ...layout('Login email changed', [`Hi ${p.firstName},`, `Your account now logs in with ${p.newEmail}. You have been signed out on all devices.`, 'If this was not you, contact Gradmire support immediately.'], [], null, ACCOUNT_FOOTER) };
        case 'document_requested':
            return { subject: `Document requested: ${p.title}`, ...layout('Your counsellor needs a document', [`Hi ${p.firstName},`, `Please upload: ${p.title}.`, ...(p.details ? [p.details] : []), ...(p.dueDate ? [`Please upload it by ${p.dueDate}.`] : [])], [], { label: 'Upload in My documents', url: pageUrl('dashboard-documents') }, ACCOUNT_FOOTER) };
        case 'follow_up_reminder': {
            const zone = p.timeZone || 'Asia/Kolkata';
            const due = new Intl.DateTimeFormat('en-GB', { timeZone: zone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(p.dueAt));
            return { subject: `Follow-up due: ${p.title}`, ...layout('Follow-up reminder', [p.title, `Due ${due} (${zone}).`, ...(p.details ? [p.details] : [])], [], { label: 'Open my follow-ups', url: pageUrl(p.page || 'consultant-follow-ups') }, ACCOUNT_FOOTER) };
        }
        case 'lead_assigned':
            return { subject: `New enquiry assigned to you: ${p.leadName}`, ...layout('An enquiry was assigned to you', [`${p.leadName} has been assigned to you. Please make contact and record the outcome.`], [], { label: 'Open my workspace', url: pageUrl('consultant-dashboard') }, ACCOUNT_FOOTER) };
        default:
            throw Object.assign(new Error(`Unknown template ${template}`), { permanent: true });
    }
}
