/* /dashboard/consultations: the signed-in student's own bookings, loaded from
   the API (the server only ever returns this student's records). */
(function () {
    'use strict';

    const { esc, METHOD_LABELS, formatWhen, formatDate, formatTime, createSlotPicker, downloadIcs, googleCalendarUrl, badge, bindDialog, meetingLine } = window.GMBooking;
    const list = document.getElementById('mc-list');
    const alertEl = document.getElementById('mc-alert');
    const verifyEl = document.getElementById('mc-verify');
    const detail = bindDialog(document.getElementById('mc-detail'));
    const move = bindDialog(document.getElementById('mc-reschedule'));
    const confirmMove = document.getElementById('mc-reschedule-confirm');
    const moveError = document.getElementById('mc-reschedule-error');
    const tabs = { upcoming: document.getElementById('mc-tab-upcoming'), past: document.getElementById('mc-tab-past') };
    let items = [];
    let tab = 'upcoming';
    let picker = null;
    let moving = null;

    function say(message, ok) {
        alertEl.textContent = message;
        alertEl.className = `bk-alert${ok ? ' bk-alert--ok' : ''}`;
        alertEl.hidden = !message;
    }

    const isUpcoming = (c) => ['reserved', 'confirmed'].includes(c.status) && new Date(c.end) > new Date();

    function card(c) {
        const zone = c.timezone;
        const start = new Date(c.start);
        const month = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: zone }).format(start);
        const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: zone }).format(start);
        const active = isUpcoming(c);
        return `<article class="bk-card">
            <div class="bk-cal" aria-hidden="true"><small>${month}</small><strong>${day}</strong></div>
            <div><h3>${esc(c.type.name)} ${badge(c.status)}</h3>
              <p>${esc(formatWhen(c.start, c.end, zone))}</p>
              <p>${esc(METHOD_LABELS[c.meetingMethod])} with ${esc(c.counsellor.name)}${c.meetingUrl && active ? ` · <a href="${esc(c.meetingUrl)}" target="_blank" rel="noopener noreferrer">Join meeting</a>` : ''}</p></div>
            <div class="bk-card-actions">
              <button type="button" class="gp-btn gp-btn-outline gp-btn-sm" data-action="view" data-id="${c.id}">Details</button>
              ${c.canReschedule ? `<button type="button" class="gp-btn gp-btn-outline gp-btn-sm" data-action="move" data-id="${c.id}">Reschedule</button>` : ''}
              ${c.canCancel ? `<button type="button" class="gp-btn gp-btn-danger gp-btn-sm" data-action="cancel" data-id="${c.id}">Cancel</button>` : ''}
              ${active ? `<button type="button" class="gp-btn gp-btn-outline gp-btn-sm" data-action="ics" data-id="${c.id}">Add to calendar</button>` : ''}
            </div></article>`;
    }

    function render() {
        Object.entries(tabs).forEach(([name, el]) => el.setAttribute('aria-selected', String(name === tab)));
        const shown = items.filter((c) => (tab === 'upcoming' ? isUpcoming(c) : !isUpcoming(c)));
        if (tab === 'upcoming') shown.sort((a, b) => new Date(a.start) - new Date(b.start));
        if (!shown.length) {
            list.innerHTML = tab === 'upcoming'
                ? '<div class="bk-empty-state"><h2>No upcoming consultations</h2><p>Book a free session to talk through countries, courses and your next steps.</p><a class="gp-btn gp-btn-primary" href="book-consultation">Book a consultation</a></div>'
                : '<div class="bk-empty-state"><h2>Nothing here yet</h2><p>Completed, cancelled and missed consultations will appear here.</p></div>';
            return;
        }
        list.innerHTML = shown.map(card).join('');
    }

    async function load() {
        try {
            items = await GradmireAPI.request('GET', '/api/v1/me/consultations');
            render();
        } catch (error) {
            list.innerHTML = `<p class="bk-empty">${esc(error.message)}</p>`;
        }
    }

    function showDetail(c) {
        document.getElementById('mc-detail-body').innerHTML = `<dl class="bk-kv">
            <dt>Status</dt><dd>${badge(c.status)}</dd>
            <dt>Reference</dt><dd>${esc(c.reference)}</dd>
            <dt>Consultation</dt><dd>${esc(c.type.name)} (${c.type.durationMinutes} min)</dd>
            <dt>When</dt><dd>${esc(formatWhen(c.start, c.end, c.timezone))}</dd>
            <dt>How</dt><dd>${esc(METHOD_LABELS[c.meetingMethod])}</dd>
            <dt>Counsellor</dt><dd>${esc(c.counsellor.name)}</dd>
            <dt>Meeting</dt><dd>${c.status === 'cancelled' ? 'Cancelled' : meetingLine(c)}</dd>
            ${c.preferences.destination ? `<dt>Destination</dt><dd>${esc(c.preferences.destination)}</dd>` : ''}
            ${c.preferences.course ? `<dt>Course</dt><dd>${esc(c.preferences.course)}</dd>` : ''}
            ${c.message ? `<dt>Your message</dt><dd>${esc(c.message)}</dd>` : ''}
            ${c.cancellationReason ? `<dt>Cancellation</dt><dd>${esc(c.cancellationReason)}</dd>` : ''}
            ${isUpcoming(c) ? `<dt>Change by</dt><dd>${esc(`${formatDate(c.changeDeadline, c.timezone)}, ${formatTime(c.changeDeadline, c.timezone)}`)}</dd>` : ''}
          </dl>
          ${isUpcoming(c) ? `<p class="bk-fine"><a href="${esc(googleCalendarUrl(c))}" target="_blank" rel="noopener noreferrer">Add to Google Calendar</a></p>` : ''}`;
        detail.showModal();
    }

    async function cancel(c) {
        if (!window.confirm(`Cancel your ${c.type.name} on ${formatWhen(c.start, c.end, c.timezone)}?`)) return;
        const reason = window.prompt('Optional: tell us why you are cancelling') || undefined;
        try {
            await GradmireAPI.request('POST', `/api/v1/me/consultations/${c.id}/cancel`, { reason: reason && reason.slice(0, 500) });
            say('Your consultation was cancelled.', true);
            await load();
        } catch (error) {
            say(error.message);
        }
    }

    function openMove(c) {
        moving = c;
        moveError.hidden = true;
        confirmMove.disabled = true;
        if (!picker) {
            picker = createSlotPicker({
                dates: document.getElementById('mc-dates'), slots: document.getElementById('mc-slots'), tz: document.getElementById('mc-tz'),
                onSelect: (slot) => { confirmMove.disabled = !slot; },
            });
        }
        picker.setType(c.type.id);
        move.showModal();
        picker.selectFirstDate();
    }

    confirmMove.addEventListener('click', async () => {
        if (!moving || !picker.slot) return;
        confirmMove.disabled = true;
        try {
            const updated = await GradmireAPI.request('POST', `/api/v1/me/consultations/${moving.id}/reschedule`, { start: picker.slot.start, timezone: picker.zone });
            move.close();
            say(`Moved to ${formatWhen(updated.start, updated.end, updated.timezone)}.`, true);
            await load();
        } catch (error) {
            moveError.textContent = error.message;
            moveError.hidden = false;
            picker.refresh();
        }
    });

    list.addEventListener('click', (event) => {
        const button = event.target.closest('[data-action]');
        if (!button) return;
        const c = items.find((item) => item.id === button.dataset.id);
        if (!c) return;
        ({ view: showDetail, cancel, move: openMove, ics: downloadIcs })[button.dataset.action](c);
    });
    Object.entries(tabs).forEach(([name, el]) => el.addEventListener('click', () => {
        tab = name;
        render();
    }));
    document.querySelector('.bk-tabs').addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        tab = tab === 'upcoming' ? 'past' : 'upcoming';
        render();
        tabs[tab].focus();
    });

    async function verifyFromLink() {
        const params = new URLSearchParams(location.hash.slice(1));
        const token = params.get('verify');
        if (!token) return;
        history.replaceState(null, '', location.pathname + location.search);
        try {
            const result = await GradmireAPI.request('POST', '/api/v1/auth/verify-email/confirm', { token });
            say(result.linkedConsultations
                ? `Email verified. ${result.linkedConsultations} earlier booking${result.linkedConsultations === 1 ? ' was' : 's were'} added to your dashboard.`
                : 'Email verified.', true);
            await GradmireAPI.getSession(true);
        } catch (error) {
            say(error.message);
        }
    }

    async function init() {
        await verifyFromLink();
        let session;
        try {
            session = await GradmireAPI.getSession();
        } catch (error) {
            list.innerHTML = `<p class="bk-empty">${esc(error.message)}</p>`;
            return;
        }
        const user = session.user;
        if (!user) {
            location.replace('login?next=dashboard-consultations');
            return;
        }
        if (user.role !== 'student') {
            list.innerHTML = `<div class="bk-empty-state"><h2>This page is for students</h2><p>Staff can manage bookings in the consultations CRM.</p><a class="gp-btn gp-btn-primary" href="${esc(GradmireAPI.safeNext(user.home, 'admin-consultations'))}">Open my workspace</a></div>`;
            return;
        }
        document.getElementById('mc-greeting').textContent = `Signed in as ${user.firstName} (${user.email}).`;
        const logout = document.getElementById('mc-logout');
        logout.hidden = false;
        logout.addEventListener('click', async () => {
            await GradmireAPI.logout().catch(() => {});
            location.href = 'login';
        });
        if (!user.emailVerified) {
            verifyEl.innerHTML = 'Verify your email to see consultations you booked before signing up. <button type="button" class="crm-open" id="mc-resend">Send the verification email again</button>';
            verifyEl.hidden = false;
            document.getElementById('mc-resend').addEventListener('click', async () => {
                try {
                    await GradmireAPI.request('POST', '/api/v1/auth/verify-email/request', {});
                    verifyEl.textContent = 'If our email service is set up, a new verification link is on its way. It expires in 48 hours.';
                } catch (error) {
                    verifyEl.textContent = error.message;
                }
            });
        }
        await load();
    }

    init();
})();
