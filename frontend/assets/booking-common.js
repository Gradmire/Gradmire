/* Shared helpers for the booking pages: formatting, the date/time slot picker,
   status labels and "add to calendar". Everything shown comes from the API. */
(function () {
    'use strict';

    const METHOD_LABELS = { video: 'Video call', phone: 'Phone call', in_person: 'In person' };
    const STATUS_LABELS = {
        reserved: 'Reserved', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled',
        no_show: 'Missed', rescheduled: 'Rescheduled',
    };
    const COMMON_ZONES = ['Asia/Kolkata', 'Asia/Kathmandu', 'Asia/Dhaka', 'Asia/Colombo', 'Asia/Karachi', 'Asia/Dubai', 'Asia/Riyadh',
        'Asia/Singapore', 'Europe/London', 'Europe/Dublin', 'Europe/Berlin', 'Europe/Rome', 'Europe/Helsinki', 'America/New_York',
        'America/Chicago', 'America/Los_Angeles', 'America/Toronto', 'Australia/Sydney', 'Australia/Perth', 'Pacific/Auckland', 'Africa/Lagos', 'Africa/Nairobi', 'UTC'];

    const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function browserZone() {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
        } catch (e) {
            return 'Asia/Kolkata';
        }
    }

    function fillZones(select, selected) {
        const zones = COMMON_ZONES.includes(selected) ? COMMON_ZONES : [selected].concat(COMMON_ZONES);
        select.innerHTML = zones.map((z) => `<option value="${esc(z)}"${z === selected ? ' selected' : ''}>${esc(z.replace(/_/g, ' '))}</option>`).join('');
    }

    const fmt = (iso, zone, options) => new Intl.DateTimeFormat('en-GB', Object.assign({ timeZone: zone }, options)).format(new Date(iso));
    const formatTime = (iso, zone) => fmt(iso, zone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const formatDate = (iso, zone) => fmt(iso, zone, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const formatShort = (iso, zone) => fmt(iso, zone, { weekday: 'short', day: 'numeric', month: 'short' });
    const formatWhen = (start, end, zone) => `${formatDate(start, zone)}, ${formatTime(start, zone)}–${formatTime(end, zone)} (${zone.replace(/_/g, ' ')})`;

    /* YYYY-MM-DD of "today + n days" in a zone. */
    function zoneDate(zone, offsetDays) {
        const d = new Date(Date.now() + offsetDays * 86400000);
        const parts = {};
        new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d).forEach((p) => { parts[p.type] = p.value; });
        return `${parts.year}-${parts.month}-${parts.day}`;
    }

    /* A date strip + slot grid bound to the availability API.
       options: { dates, slots, tz, typeId(), onSelect(slot|null), days } */
    function createSlotPicker(options) {
        const state = { zone: browserZone(), date: null, slot: null, typeId: null, requestId: 0 };
        const days = options.days || 21;
        fillZones(options.tz, state.zone);

        function renderDates() {
            const buttons = [];
            for (let i = 0; i < days; i += 1) {
                const value = zoneDate(state.zone, i);
                const noon = new Date(`${value}T12:00:00Z`);
                const label = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(noon);
                const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'UTC' }).format(noon);
                const month = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(noon);
                buttons.push(`<button type="button" class="bk-date" data-date="${value}" aria-pressed="${value === state.date}" aria-label="${esc(new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(noon))}"><small>${label}</small><strong>${day}</strong><small>${month}</small></button>`);
            }
            options.dates.innerHTML = buttons.join('');
        }

        async function loadSlots() {
            const typeId = state.typeId;
            state.slot = null;
            options.onSelect(null);
            if (!typeId) {
                options.slots.innerHTML = '<p class="bk-empty">Choose a consultation type first.</p>';
                return;
            }
            if (!state.date) {
                options.slots.innerHTML = '<p class="bk-empty">Choose a date to see available times.</p>';
                return;
            }
            const requestId = ++state.requestId;
            options.slots.innerHTML = '<p class="bk-empty">Checking availability…</p>';
            try {
                const params = new URLSearchParams({ consultation_type_id: typeId, date: state.date, timezone: state.zone });
                const data = await GradmireAPI.request('GET', `/api/v1/availability?${params}`);
                if (requestId !== state.requestId) return;
                if (!data.slots.length) {
                    options.slots.innerHTML = '<p class="bk-empty">No times left on this day. Try another date.</p>';
                    return;
                }
                options.slots.innerHTML = data.slots.map((s) => `<button type="button" class="bk-slot" data-start="${s.start}" data-end="${s.end}" aria-pressed="false">${formatTime(s.start, state.zone)}</button>`).join('');
            } catch (error) {
                if (requestId !== state.requestId) return;
                options.slots.innerHTML = `<p class="bk-empty">${esc(error.message)}</p>`;
            }
        }

        options.dates.addEventListener('click', (event) => {
            const button = event.target.closest('.bk-date');
            if (!button) return;
            state.date = button.dataset.date;
            options.dates.querySelectorAll('.bk-date').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
            loadSlots();
        });
        options.slots.addEventListener('click', (event) => {
            const button = event.target.closest('.bk-slot');
            if (!button) return;
            options.slots.querySelectorAll('.bk-slot').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
            state.slot = { start: button.dataset.start, end: button.dataset.end, zone: state.zone };
            options.onSelect(state.slot);
        });
        options.tz.addEventListener('change', () => {
            state.zone = options.tz.value;
            renderDates();
            loadSlots();
        });

        renderDates();
        return {
            get zone() { return state.zone; },
            get slot() { return state.slot; },
            setType(typeId) {
                state.typeId = typeId;
                loadSlots();
            },
            refresh: loadSlots,
            selectFirstDate() {
                const first = options.dates.querySelector('.bk-date');
                if (first) first.click();
            },
        };
    }

    /* ── Add to calendar ───────────────────────────────────────────────── */

    const icsDate = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const icsText = (value) => String(value || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`);

    function downloadIcs(c) {
        const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gradmire//Consultations//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
            `UID:${c.id}@gradmire.com`, `DTSTAMP:${icsDate(new Date().toISOString())}`, `DTSTART:${icsDate(c.start)}`, `DTEND:${icsDate(c.end)}`,
            `SUMMARY:${icsText(`Gradmire: ${c.type.name}`)}`,
            `DESCRIPTION:${icsText(`${METHOD_LABELS[c.meetingMethod] || ''} with ${c.counsellor.name}. Reference ${c.reference}.${c.meetingUrl ? ` Join: ${c.meetingUrl}` : ''}`)}`,
            ...(c.meetingUrl ? [`URL:${icsText(c.meetingUrl)}`] : []),
            'END:VEVENT', 'END:VCALENDAR'];
        const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `gradmire-${c.reference}.ics`;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            URL.revokeObjectURL(link.href);
            link.remove();
        }, 0);
    }

    function googleCalendarUrl(c) {
        const params = new URLSearchParams({
            action: 'TEMPLATE', text: `Gradmire: ${c.type.name}`, dates: `${icsDate(c.start)}/${icsDate(c.end)}`,
            details: `${METHOD_LABELS[c.meetingMethod] || ''} with ${c.counsellor.name}. Reference ${c.reference}.${c.meetingUrl ? `\nJoin: ${c.meetingUrl}` : ''}`,
        });
        return `https://calendar.google.com/calendar/render?${params}`;
    }

    const badge = (status) => `<span class="bk-badge bk-badge--${esc(status)}">${esc(STATUS_LABELS[status] || status)}</span>`;

    /* Wires [data-close] buttons and backdrop clicks for a <dialog>. */
    function bindDialog(dialog) {
        dialog.addEventListener('click', (event) => {
            if (event.target === dialog || event.target.closest('[data-close]')) dialog.close();
        });
        return dialog;
    }

    function meetingLine(c) {
        if (c.meetingUrl) return `<a href="${esc(c.meetingUrl)}" target="_blank" rel="noopener noreferrer">Join meeting</a>`;
        if (c.status === 'reserved') return 'Your slot is held. We are finalising the calendar invite and will email you when it is confirmed.';
        if (c.meetingMethod === 'video') return 'Your counsellor will send the video-call link before the session.';
        if (c.meetingMethod === 'phone') return 'Your counsellor will call you on the number you gave.';
        return 'Your counsellor will confirm the location.';
    }

    window.GMBooking = {
        esc, METHOD_LABELS, STATUS_LABELS, browserZone, fillZones, formatTime, formatDate, formatShort, formatWhen,
        createSlotPicker, downloadIcs, googleCalendarUrl, badge, bindDialog, meetingLine,
    };
})();
