/* Guest "manage my booking" page. The token is read from the URL fragment
   (#token=…), which browsers never send to servers, then removed from the
   address bar and only ever sent in a POST body. */
(function () {
    'use strict';

    const { esc, METHOD_LABELS, formatWhen, createSlotPicker, downloadIcs, googleCalendarUrl, badge, bindDialog, meetingLine } = window.GMBooking;
    const view = document.getElementById('mg-view');
    const errorEl = document.getElementById('mg-error');
    const dialog = bindDialog(document.getElementById('mg-reschedule'));
    const confirmMove = document.getElementById('mg-reschedule-confirm');
    const moveError = document.getElementById('mg-reschedule-error');

    const hash = new URLSearchParams(location.hash.slice(1));
    let token = hash.get('token');
    try {
        if (token) sessionStorage.setItem('gm-manage-token', token);
        else token = sessionStorage.getItem('gm-manage-token');
    } catch (e) { /* storage blocked: keep the in-memory token */ }
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);

    let current = null;
    let picker = null;

    function showError(message) {
        errorEl.textContent = message;
        errorEl.hidden = !message;
    }

    function render(c) {
        current = c;
        view.innerHTML = `<div class="crm-head" style="margin-top:0"><div><h2 style="margin:0">${esc(c.type.name)}</h2><p>Reference ${esc(c.reference)}</p></div>${badge(c.status)}</div>
            <dl class="bk-kv">
              <dt>When</dt><dd>${esc(formatWhen(c.start, c.end, c.timezone))}</dd>
              <dt>How</dt><dd>${esc(METHOD_LABELS[c.meetingMethod])}</dd>
              <dt>Counsellor</dt><dd>${esc(c.counsellor.name)}</dd>
              <dt>Meeting</dt><dd>${c.status === 'cancelled' ? 'Cancelled' : meetingLine(c)}</dd>
              <dt>Booked for</dt><dd>${esc(c.studentName)} · ${esc(c.studentEmail)}</dd>
            </dl>
            ${c.status === 'cancelled' ? '<p class="bk-fine">This consultation was cancelled. <a href="book-consultation">Book a new time</a>.</p>' : ''}
            ${['reserved', 'confirmed'].includes(c.status) && !c.canCancel ? `<p class="bk-fine">Online changes closed 24 hours before the start. Please <a href="contact">contact us</a> if you need to change this booking.</p>` : ''}
            <div class="bk-actions" style="justify-content:flex-start">
              ${c.canReschedule ? '<button type="button" class="gp-btn gp-btn-primary gp-btn-sm" id="mg-move">Reschedule</button>' : ''}
              ${c.canCancel ? '<button type="button" class="gp-btn gp-btn-danger gp-btn-sm" id="mg-cancel">Cancel booking</button>' : ''}
              ${['reserved', 'confirmed'].includes(c.status) ? `<button type="button" class="gp-btn gp-btn-outline gp-btn-sm" id="mg-ics">Add to calendar (.ics)</button><a class="gp-btn gp-btn-outline gp-btn-sm" href="${esc(googleCalendarUrl(c))}" target="_blank" rel="noopener noreferrer">Google Calendar</a>` : ''}
            </div>
            ${c.linkedToAccount ? '<p class="bk-fine">This booking is also in your Gradmire dashboard.</p>' : '<p class="bk-fine">Have a Gradmire account with this email? <button type="button" class="crm-open" id="mg-claim">Add this booking to my dashboard</button></p>'}`;
        const on = (id, handler) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', handler);
        };
        on('mg-ics', () => downloadIcs(c));
        on('mg-cancel', cancel);
        on('mg-move', openMove);
        on('mg-claim', claim);
    }

    async function load() {
        if (!token) {
            view.innerHTML = '<p class="bk-empty">Open this page from the link in your confirmation email.</p>';
            return;
        }
        try {
            render(await GradmireAPI.request('POST', '/api/v1/consultations/manage/lookup', { token }));
        } catch (error) {
            view.innerHTML = `<p class="bk-empty">${esc(error.message)}</p>`;
        }
    }

    async function cancel() {
        if (!window.confirm('Cancel this consultation? This cannot be undone.')) return;
        const reason = window.prompt('Optional: tell us why you are cancelling') || undefined;
        showError('');
        try {
            render(await GradmireAPI.request('POST', '/api/v1/consultations/manage/cancel', { token, reason: reason && reason.slice(0, 500) }));
        } catch (error) {
            showError(error.message);
        }
    }

    function openMove() {
        moveError.hidden = true;
        confirmMove.disabled = true;
        if (!picker) {
            picker = createSlotPicker({
                dates: document.getElementById('mg-dates'), slots: document.getElementById('mg-slots'), tz: document.getElementById('mg-tz'),
                onSelect: (slot) => { confirmMove.disabled = !slot; },
            });
        }
        picker.setType(current.type.id);
        dialog.showModal();
        picker.selectFirstDate();
    }

    confirmMove.addEventListener('click', async () => {
        if (!picker || !picker.slot) return;
        confirmMove.disabled = true;
        try {
            render(await GradmireAPI.request('POST', '/api/v1/consultations/manage/reschedule', { token, start: picker.slot.start, timezone: picker.zone }));
            dialog.close();
        } catch (error) {
            moveError.textContent = error.message;
            moveError.hidden = false;
            picker.refresh();
        }
    });

    async function claim() {
        const session = await GradmireAPI.getSession().catch(() => ({ user: null }));
        if (!session.user) {
            location.href = 'login?next=manage-consultation';
            return;
        }
        try {
            render(await GradmireAPI.request('POST', '/api/v1/me/consultations/claim', { token }));
        } catch (error) {
            showError(error.message);
        }
    }

    load();
})();
