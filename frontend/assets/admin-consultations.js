/* /admin/consultations: staff CRM. Every permission is enforced by the API;
   hiding a control here is only a convenience (counsellors see their own
   bookings, admins see all). */
(function () {
    'use strict';

    const { esc, METHOD_LABELS, STATUS_LABELS, formatWhen, formatShort, formatTime, badge } = window.GMBooking;
    const $ = (id) => document.getElementById(id);
    const zone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return 'Asia/Kolkata'; } })();
    const state = { staff: null, page: 1, pageSize: 25, total: 0, filters: {}, counsellors: [], types: [], openId: null };
    const WEEKDAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const OUTCOMES = [['', 'No outcome yet'], ['qualified', 'Qualified'], ['follow_up', 'Needs follow-up'], ['application_started', 'Application started'], ['not_interested', 'Not interested'], ['other', 'Other']];
    const isAdmin = () => state.staff && ['admin', 'super_admin'].includes(state.staff.role);

    function say(message, ok) {
        const el = $('crm-alert');
        el.textContent = message;
        el.className = `bk-alert${ok ? ' bk-alert--ok' : ''}`;
        el.hidden = !message;
    }

    /* ── Sign-in ───────────────────────────────────────────────────────── */

    $('crm-login-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.target;
        const error = $('crm-login-error');
        error.hidden = true;
        try {
            const user = await GradmireAPI.login(form.elements.email.value.trim(), form.elements.password.value);
            form.reset();
            if (user.role === 'student') {
                error.textContent = 'This sign-in is for Gradmire staff. Students can see their bookings in My consultations.';
                error.hidden = false;
                return;
            }
            start(user);
        } catch (err) {
            error.textContent = err.message;
            error.hidden = false;
        }
    });

    $('crm-logout').addEventListener('click', async () => {
        await GradmireAPI.logout().catch(() => {});
        location.reload();
    });

    /* ── Overview and list ─────────────────────────────────────────────── */

    async function loadSummary() {
        const s = await GradmireAPI.request('GET', `/api/v1/admin/consultations/summary?timezone=${encodeURIComponent(zone)}`);
        const tiles = [
            ['Today', s.today, {}], ['Upcoming', s.upcoming, { status: '' }], ['Pending', s.pending, { status: 'reserved' }],
            ['Completed', s.completed, { status: 'completed' }], ['Cancelled', s.cancelled, { status: 'cancelled' }], ['No-shows', s.noShow, { status: 'no_show' }],
            ['Calendar issues', s.calendarFailed, { calendar_status: 'failed' }, s.calendarFailed > 0],
        ];
        if (s.failedNotifications !== null) tiles.push(['Undelivered emails', s.failedNotifications, null, s.failedNotifications > 0]);
        $('crm-stats').innerHTML = tiles.map(([label, value, filter, warn], i) => `<button type="button" class="crm-stat${warn ? ' crm-stat--warn' : ''}" data-tile="${i}"${filter ? '' : ' disabled'}><span>${esc(label)}</span><strong>${value}</strong></button>`).join('');
        $('crm-stats').onclick = (event) => {
            const tile = event.target.closest('[data-tile]');
            if (!tile) return;
            const [label, , filter] = tiles[Number(tile.dataset.tile)];
            const form = $('crm-filters');
            form.reset();
            state.filters = { ...filter };
            if (label === 'Today') {
                const today = new Date().toLocaleDateString('en-CA');
                form.elements.from.value = today;
                form.elements.to.value = today;
                state.filters = filtersFromForm();
            } else if (label === 'Upcoming') {
                state.filters.from = new Date().toISOString();
            }
            if (filter && filter.status) form.elements.status.value = filter.status;
            state.page = 1;
            loadList();
        };
    }

    function dayStartIso(value, endOfDay) {
        if (!value) return undefined;
        const d = new Date(`${value}T00:00:00`);
        if (endOfDay) d.setDate(d.getDate() + 1);
        return d.toISOString();
    }

    function filtersFromForm() {
        const f = $('crm-filters').elements;
        return {
            q: f.q.value.trim() || undefined, status: f.status.value || undefined, consultation_type_id: f.type.value || undefined,
            counsellor_id: f.counsellor.value || undefined, from: dayStartIso(f.from.value), to: dayStartIso(f.to.value, true),
        };
    }

    async function loadList() {
        const params = new URLSearchParams({ page: String(state.page), page_size: String(state.pageSize) });
        Object.entries(state.filters).forEach(([k, v]) => { if (v) params.set(k, v); });
        const rows = $('crm-rows');
        try {
            const data = await GradmireAPI.request('GET', `/api/v1/admin/consultations?${params}`);
            state.total = data.total;
            rows.innerHTML = data.items.length ? data.items.map((c) => `<tr data-id="${c.id}">
                <td><button type="button" class="crm-open" data-id="${c.id}">${esc(formatShort(c.start, zone))}, ${esc(formatTime(c.start, zone))}</button><small>${esc(c.reference)}</small></td>
                <td>${esc(c.student.name)}<small>${esc(c.student.email)}</small><small>${esc(c.student.phone)}</small></td>
                <td>${esc(c.type.name)}<small>${esc(METHOD_LABELS[c.meetingMethod])}</small></td>
                <td>${esc(c.counsellor.name)}</td>
                <td>${badge(c.status)}${c.calendarStatus === 'failed' ? `<small>${badge('failed')} calendar</small>` : ''}</td>
                <td>${esc(c.leadSource || c.source)}<small>${c.student.userId ? 'Account' : 'Guest'}</small></td></tr>`).join('')
                : '<tr><td colspan="6">No consultations match these filters.</td></tr>';
            const from = data.total ? (state.page - 1) * state.pageSize + 1 : 0;
            $('crm-count').textContent = `${from}–${Math.min(state.page * state.pageSize, data.total)} of ${data.total}`;
            $('crm-prev').disabled = state.page <= 1;
            $('crm-next').disabled = state.page * state.pageSize >= data.total;
        } catch (error) {
            rows.innerHTML = `<tr><td colspan="6">${esc(error.message)}</td></tr>`;
        }
    }

    $('crm-filters').addEventListener('submit', (event) => {
        event.preventDefault();
        state.filters = filtersFromForm();
        state.page = 1;
        loadList();
    });
    $('crm-filters').addEventListener('reset', () => setTimeout(() => {
        state.filters = {};
        state.page = 1;
        loadList();
    }));
    $('crm-prev').addEventListener('click', () => { state.page -= 1; loadList(); });
    $('crm-next').addEventListener('click', () => { state.page += 1; loadList(); });
    $('crm-refresh').addEventListener('click', () => refreshAll());
    $('crm-rows').addEventListener('click', (event) => {
        const row = event.target.closest('[data-id]');
        if (row) openDetail(row.dataset.id);
    });

    /* ── Detail drawer ─────────────────────────────────────────────────── */

    const drawer = $('crm-drawer');
    let lastFocus = null;
    function closeDrawer() {
        drawer.hidden = true;
        state.openId = null;
        if (location.hash.startsWith('#id=')) history.replaceState(null, '', location.pathname);
        if (lastFocus) lastFocus.focus();
    }
    $('crm-drawer-close').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !drawer.hidden) closeDrawer(); });

    const when = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

    function renderDetail(c) {
        $('crm-drawer-title').textContent = `${c.student.name} — ${c.type.name}`;
        $('crm-drawer-sub').innerHTML = `${esc(c.reference)} · ${badge(c.status)}`;
        const active = ['reserved', 'confirmed'].includes(c.status);
        const started = new Date(c.start) <= new Date();
        const statusButtons = [
            c.status === 'reserved' ? ['confirmed', 'Confirm manually'] : null,
            c.status === 'confirmed' && started ? ['completed', 'Mark completed'] : null,
            c.status === 'confirmed' && started ? ['no_show', 'Mark no-show'] : null,
            c.status === 'completed' ? ['no_show', 'Change to no-show'] : null,
            c.status === 'no_show' ? ['completed', 'Change to completed'] : null,
            active ? ['cancelled', 'Cancel booking'] : null,
        ].filter(Boolean);
        const counsellorOptions = state.counsellors.filter((x) => x.isActive || x.id === c.counsellor.id)
            .map((x) => `<option value="${x.id}"${x.id === c.counsellor.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('');
        $('crm-drawer-body').innerHTML = `
          <section><h3>Appointment</h3><dl class="bk-kv">
            <dt>When</dt><dd>${esc(formatWhen(c.start, c.end, zone))}${c.timezone !== zone ? `<br><small>Student sees ${esc(formatWhen(c.start, c.end, c.timezone))}</small>` : ''}</dd>
            <dt>Method</dt><dd>${esc(METHOD_LABELS[c.meetingMethod])}</dd>
            <dt>Meeting link</dt><dd>${c.meetingUrl ? `<a href="${esc(c.meetingUrl)}" target="_blank" rel="noopener noreferrer">${esc(c.meetingUrl)}</a>` : 'None yet'}</dd>
            <dt>Calendar</dt><dd>${badge(c.calendarStatus)}${c.calendarStatus === 'failed' || c.calendarStatus === 'pending' ? ' <button type="button" class="gp-btn gp-btn-outline gp-btn-sm" id="crm-sync">Retry calendar sync</button>' : ''}</dd>
            ${c.rescheduledFrom ? `<dt>Moved from</dt><dd>${esc(c.rescheduledFrom.reference)} (${esc(when(c.rescheduledFrom.start))})</dd>` : ''}
            ${c.cancellation ? `<dt>Cancelled</dt><dd>by ${esc(c.cancellation.by)}${c.cancellation.reason ? `: ${esc(c.cancellation.reason)}` : ''}</dd>` : ''}
          </dl></section>
          <section><h3>Student</h3><dl class="bk-kv">
            <dt>Name</dt><dd>${esc(c.student.name)}</dd>
            <dt>Email</dt><dd><a href="mailto:${esc(c.student.email)}">${esc(c.student.email)}</a></dd>
            <dt>Phone</dt><dd><a href="tel:${esc(c.student.phone)}">${esc(c.student.phone)}</a></dd>
            <dt>Account</dt><dd>${c.student.userId ? 'Registered student' : 'Guest booking'}</dd>
            ${c.preferences.destination ? `<dt>Destination</dt><dd>${esc(c.preferences.destination)}</dd>` : ''}
            ${c.preferences.degree ? `<dt>Degree</dt><dd>${esc(c.preferences.degree)}</dd>` : ''}
            ${c.preferences.course ? `<dt>Course</dt><dd>${esc(c.preferences.course)}</dd>` : ''}
            ${c.preferences.intake ? `<dt>Intake</dt><dd>${esc(c.preferences.intake)}</dd>` : ''}
            ${c.academicSummary ? `<dt>Academics</dt><dd>${esc(c.academicSummary)}</dd>` : ''}
            ${c.message ? `<dt>Message</dt><dd>${esc(c.message)}</dd>` : ''}
            ${c.lead ? `<dt>Lead</dt><dd>${esc(c.lead.source)} lead since ${esc(when(c.lead.created_at))}${c.lead.marketing_opt_in ? ' · marketing opt-in' : ''}</dd>` : ''}
          </dl></section>
          <section><h3>Manage</h3>
            ${statusButtons.length ? `<div class="bk-actions" style="justify-content:flex-start;margin:0 0 .8rem">${statusButtons.map(([s, l]) => `<button type="button" class="gp-btn ${s === 'cancelled' ? 'gp-btn-danger' : 'gp-btn-outline'} gp-btn-sm" data-status="${s}">${esc(l)}</button>`).join('')}</div>` : ''}
            <div class="crm-row">
              ${isAdmin() && active ? `<label class="gp-field"><span>Counsellor</span><select id="crm-assign">${counsellorOptions}</select></label><button type="button" class="gp-btn gp-btn-outline gp-btn-sm" id="crm-assign-save">Reassign</button>` : `<p class="bk-help" style="margin:0">Counsellor: <strong>${esc(c.counsellor.name)}</strong></p>`}
            </div>
            <div class="crm-row" style="margin-top:.8rem">
              <label class="gp-field"><span>Outcome</span><select id="crm-outcome">${OUTCOMES.map(([v, l]) => `<option value="${v}"${(c.outcome || '') === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
              <button type="button" class="gp-btn gp-btn-outline gp-btn-sm" id="crm-outcome-save">Save outcome</button>
            </div>
            ${active ? `<div class="crm-row" style="margin-top:.8rem"><label class="gp-field"><span>Meeting link (https)</span><input id="crm-link" type="url" maxlength="500" value="${esc(c.meetingUrl || '')}" placeholder="https://…"></label><button type="button" class="gp-btn gp-btn-outline gp-btn-sm" id="crm-link-save">Save link</button></div>` : ''}
          </section>
          <section><h3>Private notes &amp; follow-ups</h3>
            ${c.notes.length ? c.notes.map((n) => `<div class="crm-note">${esc(n.body)}<small>${esc(n.kind.replace('_', '-'))} · ${esc(n.author || 'Staff')} · ${esc(when(n.createdAt))}${n.dueAt ? ` · due ${esc(when(n.dueAt))}` : ''}${n.kind === 'follow_up' ? (n.completedAt ? ' · done' : ` · <button type="button" class="crm-open" data-complete="${n.id}">Mark done</button>`) : ''}</small></div>`).join('') : '<p class="bk-help" style="margin:0 0 .6rem">No notes yet. Notes are never shown to students.</p>'}
            <form id="crm-note-form" style="margin-top:.8rem">
              <div class="crm-row">
                <label class="gp-field"><span>Type</span><select name="kind"><option value="note">Note</option><option value="outcome">Consultation outcome</option><option value="follow_up">Follow-up task</option></select></label>
                <label class="gp-field"><span>Due (follow-ups)</span><input name="dueAt" type="datetime-local"></label>
              </div>
              <label class="gp-field" style="margin-top:.5rem"><span>Note</span><textarea name="body" maxlength="4000" rows="3" required></textarea></label>
              <button type="submit" class="gp-btn gp-btn-primary gp-btn-sm" style="margin-top:.5rem">Add note</button>
            </form>
          </section>
          <section><h3>Messages</h3>
            ${c.notifications.length ? `<ul class="crm-timeline">${c.notifications.map((n) => `<li><time>${esc(when(n.sentAt || n.scheduledFor))}</time><span>${esc(n.template.replace(/_/g, ' '))} → ${esc(n.recipient)} ${badge(n.status)}${n.lastError ? `<small>${esc(n.lastError)}</small>` : ''}${isAdmin() && ['failed', 'skipped'].includes(n.status) ? ` <button type="button" class="crm-open" data-retry="${n.id}">Retry</button>` : ''}</span></li>`).join('')}</ul>` : '<p class="bk-help" style="margin:0">No messages queued.</p>'}
          </section>
          <section><h3>History</h3>
            <ul class="crm-timeline">${c.history.map((h) => `<li><time>${esc(when(h.at))}</time><span>${esc(h.event.replace(/_/g, ' '))} · ${esc(h.actor || h.actorType)}</span></li>`).join('')}</ul>
          </section>`;
    }

    async function openDetail(id) {
        lastFocus = document.activeElement;
        state.openId = id;
        drawer.hidden = false;
        $('crm-drawer-body').innerHTML = '<p class="bk-empty">Loading…</p>';
        try {
            renderDetail(await GradmireAPI.request('GET', `/api/v1/admin/consultations/${id}`));
            history.replaceState(null, '', `${location.pathname}#id=${id}`);
            $('crm-drawer-close').focus();
        } catch (error) {
            $('crm-drawer-body').innerHTML = `<p class="bk-alert">${esc(error.message)}</p>`;
        }
    }

    async function patch(body, message) {
        try {
            renderDetail(await GradmireAPI.request('PATCH', `/api/v1/admin/consultations/${state.openId}`, body));
            say(message, true);
            refreshAll();
        } catch (error) {
            say(error.message);
        }
    }

    $('crm-drawer-body').addEventListener('click', async (event) => {
        const status = event.target.closest('[data-status]');
        if (status) {
            const next = status.dataset.status;
            if (next === 'cancelled') {
                if (!window.confirm('Cancel this consultation? The student will be emailed.')) return;
                const reason = window.prompt('Reason (shared with the student in their booking view)') || undefined;
                return patch({ status: next, cancellationReason: reason }, 'Consultation cancelled.');
            }
            return patch({ status: next }, `Marked ${STATUS_LABELS[next].toLowerCase()}.`);
        }
        if (event.target.id === 'crm-assign-save') return patch({ counsellorId: $('crm-assign').value }, 'Counsellor reassigned.');
        if (event.target.id === 'crm-outcome-save') return patch({ outcome: $('crm-outcome').value || null }, 'Outcome saved.');
        if (event.target.id === 'crm-link-save') return patch({ meetingUrl: $('crm-link').value.trim() || null }, 'Meeting link saved.');
        if (event.target.id === 'crm-sync') {
            try {
                renderDetail(await GradmireAPI.request('POST', `/api/v1/admin/consultations/${state.openId}/calendar-sync`, {}));
                say('Calendar sync retried.', true);
            } catch (error) {
                say(error.message);
            }
            return;
        }
        const retry = event.target.closest('[data-retry]');
        if (retry) {
            try {
                await GradmireAPI.request('POST', `/api/v1/admin/notifications/${retry.dataset.retry}/retry`, {});
                say('Message queued again. It will be sent on the next worker run.', true);
                openDetail(state.openId);
            } catch (error) {
                say(error.message);
            }
            return;
        }
        const complete = event.target.closest('[data-complete]');
        if (complete) {
            try {
                await GradmireAPI.request('POST', `/api/v1/admin/consultations/${state.openId}/notes/${complete.dataset.complete}/complete`, {});
                openDetail(state.openId);
            } catch (error) {
                say(error.message);
            }
        }
    });

    $('crm-drawer-body').addEventListener('submit', async (event) => {
        if (event.target.id !== 'crm-note-form') return;
        event.preventDefault();
        const f = event.target.elements;
        const body = { kind: f.kind.value, body: f.body.value.trim() };
        if (f.dueAt.value && body.kind === 'follow_up') body.dueAt = new Date(f.dueAt.value).toISOString();
        if (!body.body) return;
        try {
            await GradmireAPI.request('POST', `/api/v1/admin/consultations/${state.openId}/notes`, body);
            openDetail(state.openId);
        } catch (error) {
            say(error.message);
        }
    });

    /* ── Availability panel ────────────────────────────────────────────── */

    function availabilityPanel() {
        const main = document.getElementById('crm-app');
        const section = document.createElement('section');
        section.className = 'bk-panel';
        section.style.marginTop = '1.2rem';
        section.setAttribute('aria-labelledby', 'crm-av-title');
        section.innerHTML = `<h2 class="bk-step-title" id="crm-av-title">Availability</h2>
          <div class="crm-row">
            <label class="gp-field"><span>Counsellor</span><select id="crm-av-counsellor">${state.counsellors.map((c) => `<option value="${c.id}">${esc(c.name)}${c.isActive ? '' : ' (not bookable)'}</option>`).join('')}</select></label>
          </div>
          <div id="crm-av-list" style="margin-top:.8rem"></div>
          <form id="crm-av-rule" class="crm-row" style="margin-top:.8rem">
            <label class="gp-field"><span>Weekday</span><select name="weekday">${WEEKDAYS.slice(1).map((d, i) => `<option value="${i + 1}">${d}</option>`).join('')}</select></label>
            <label class="gp-field"><span>From</span><input name="startTime" type="time" value="10:00" required></label>
            <label class="gp-field"><span>To</span><input name="endTime" type="time" value="18:00" required></label>
            <button class="gp-btn gp-btn-outline gp-btn-sm" type="submit">Add weekly hours</button>
          </form>
          <form id="crm-av-exception" class="crm-row" style="margin-top:.8rem">
            <label class="gp-field"><span>Unavailable from</span><input name="startsAt" type="datetime-local" required></label>
            <label class="gp-field"><span>Until</span><input name="endsAt" type="datetime-local" required></label>
            <label class="gp-field"><span>Reason</span><input name="reason" type="text" maxlength="200" placeholder="Leave, holiday…"></label>
            <button class="gp-btn gp-btn-outline gp-btn-sm" type="submit">Block time</button>
          </form>`;
        main.appendChild(section);
        const select = $('crm-av-counsellor');
        const counsellor = () => state.counsellors.find((c) => c.id === select.value);

        async function load() {
            if (!select.value) {
                $('crm-av-list').innerHTML = '<p class="bk-help">No counsellors yet. Create one with <code>npm run create-staff</code>.</p>';
                return;
            }
            try {
                const data = await GradmireAPI.request('GET', `/api/v1/admin/availability?counsellor_id=${select.value}`);
                $('crm-av-list').innerHTML = `<ul class="crm-timeline">${data.rules.map((r) => `<li><time>${WEEKDAYS[r.weekday]}</time><span>${r.startTime}–${r.endTime} ${esc(r.timezone)} <button type="button" class="crm-open" data-del="rule/${r.id}">Remove</button></span></li>`).join('') || '<li>No weekly hours — this counsellor has no bookable slots.</li>'}
                  ${data.exceptions.map((e) => `<li><time>Blocked</time><span>${esc(when(e.startsAt))} → ${esc(when(e.endsAt))}${e.reason ? ` · ${esc(e.reason)}` : ''} <button type="button" class="crm-open" data-del="exception/${e.id}">Remove</button></span></li>`).join('')}</ul>`;
            } catch (error) {
                $('crm-av-list').innerHTML = `<p class="bk-alert">${esc(error.message)}</p>`;
            }
        }
        select.addEventListener('change', load);
        section.addEventListener('click', async (event) => {
            const del = event.target.closest('[data-del]');
            if (!del) return;
            try {
                await GradmireAPI.request('DELETE', `/api/v1/admin/availability/${del.dataset.del}`);
                load();
            } catch (error) {
                say(error.message);
            }
        });
        $('crm-av-rule').addEventListener('submit', async (event) => {
            event.preventDefault();
            const f = event.target.elements;
            try {
                await GradmireAPI.request('POST', '/api/v1/admin/availability', { kind: 'rule', counsellorId: select.value, weekday: Number(f.weekday.value), startTime: f.startTime.value, endTime: f.endTime.value, timezone: counsellor().timezone });
                load();
            } catch (error) {
                say(error.message);
            }
        });
        $('crm-av-exception').addEventListener('submit', async (event) => {
            event.preventDefault();
            const f = event.target.elements;
            try {
                await GradmireAPI.request('POST', '/api/v1/admin/availability', { kind: 'exception', counsellorId: select.value, startsAt: new Date(f.startsAt.value).toISOString(), endsAt: new Date(f.endsAt.value).toISOString(), reason: f.reason.value.trim() || undefined });
                event.target.reset();
                load();
            } catch (error) {
                say(error.message);
            }
        });
        load();
    }

    /* ── Start ─────────────────────────────────────────────────────────── */

    function refreshAll() {
        loadSummary().catch((error) => say(error.message));
        loadList();
    }

    async function start(user) {
        state.staff = user;
        $('crm-login').hidden = true;
        $('crm-app').hidden = false;
        $('crm-who').textContent = `${user.firstName} · ${isAdmin() ? 'Administrator (all consultations)' : 'Counsellor (your assigned consultations)'}`;
        if (user.home && !$('crm-home')) $('crm-who').insertAdjacentHTML('afterend', `<p id="crm-home"><a href="${esc(GradmireAPI.safeNext(user.home, 'dashboard'))}">← Back to my workspace</a></p>`);
        try {
            const [counsellors, types] = await Promise.all([
                GradmireAPI.request('GET', '/api/v1/admin/counsellors'),
                GradmireAPI.request('GET', '/api/v1/admin/consultation-types'),
            ]);
            state.counsellors = counsellors;
            state.types = types;
            $('crm-type').insertAdjacentHTML('beforeend', types.map((t) => `<option value="${t.id}">${esc(t.name)}${t.isActive ? '' : ' (inactive)'}</option>`).join(''));
            const counsellorSelect = $('crm-counsellor');
            if (isAdmin()) counsellorSelect.insertAdjacentHTML('beforeend', counsellors.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join(''));
            else counsellorSelect.closest('label').hidden = true;
        } catch (error) {
            say(error.message);
        }
        refreshAll();
        availabilityPanel();
        const hash = new URLSearchParams(location.hash.slice(1)).get('id');
        if (hash) openDetail(hash);
    }

    GradmireAPI.getSession().then((session) => {
        if (session.user && session.user.role !== 'student') start(session.user);
        else $('crm-login').hidden = false;
    }).catch((error) => {
        $('crm-login').hidden = false;
        $('crm-login-error').textContent = error.message;
        $('crm-login-error').hidden = false;
    });
})();
