/* Consultant and admin workspace pages. The server decides what each person may
   see and do; the page only reflects it (for example, the assign control is
   shown to admins, but the API rejects an assignment from anyone else). */
(function () {
    'use strict';

    const W = window.GMWorkspace;
    const { esc } = W;
    const $ = (id) => document.getElementById(id);
    const api = (method, path, body) => GradmireAPI.request(method, path, body);
    const page = document.body.dataset.page;
    const STAFF = ['counsellor', 'admin', 'super_admin'];
    const ADMINS = ['admin', 'super_admin'];
    const isAdmin = (user) => ADMINS.includes(user.role);
    const zone = (() => {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'; } catch (e) { return 'Asia/Kolkata'; }
    })();

    const stat = (labelText, value, href, warn) => `<a class="crm-stat${warn && value ? ' crm-stat--warn' : ''}" href="${esc(href)}"><span>${esc(labelText)}</span><strong>${esc(value == null ? '—' : value)}</strong></a>`;
    const listOrEmpty = (items, render, empty) => (items.length ? items.map(render).join('') : `<li class="bk-empty">${esc(empty)}</li>`);
    const LEAD_TONE = { new: 'warn', contacted: '', qualified: 'good', consultation_booked: 'good', converted: 'good', not_interested: 'bad', closed: '' };
    const APP_TONE = { approved: 'good', rejected: 'bad', withdrawn: '', info_requested: 'warn', submitted: 'warn' };
    const REQ_TONE = { pending: 'warn', info_requested: 'warn', approved: 'good', rejected: 'bad', cancelled: '' };
    const roleLabel = (role) => W.ROLE_LABELS[role] || role;

    async function counsellorOptions(select, { includeNone = false } = {}) {
        const counsellors = await api('GET', '/api/v1/admin/counsellors').catch(() => []);
        select.insertAdjacentHTML('beforeend', counsellors.filter((c) => c.isActive).map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join(''));
        if (includeNone) select.insertAdjacentHTML('afterbegin', '<option value="">Nobody</option>');
        return counsellors;
    }

    const KIND_LABELS = { transcript: 'Academic transcript', passport: 'Passport', english_test: 'English test score', sop: 'Statement of purpose', recommendation: 'Recommendation letter', financial: 'Financial document', offer_letter: 'Offer letter', other: 'Other' };
    const sizeLabel = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

    /* Documents of one student: download, and ask for new ones. */
    async function documentsPanel(container, studentId) {
        container.innerHTML = '<p class="bk-empty">Loading documents…</p>';
        let data;
        try {
            data = await api('GET', `/api/v1/admin/students/${studentId}/documents`);
        } catch (e) {
            container.innerHTML = `<p class="bk-empty">${esc(e.message)}</p>`;
            return;
        }
        container.innerHTML = `<ul class="ws-list">${data.documents.map((d) => `<li><span><strong>${esc(d.filename)}</strong> <small>${esc(KIND_LABELS[d.kind] || d.kind)} · ${esc(sizeLabel(d.sizeBytes))} · ${esc(W.fmtDate(d.uploadedAt))}</small></span><button type="button" class="gp-btn gp-btn-outline gp-btn-sm" data-doc="${esc(d.id)}">Download</button></li>`).join('') || '<li class="bk-empty">No documents uploaded.</li>'}</ul>
            <h3 style="margin-top:1rem">Requests</h3>
            <ul class="ws-list">${data.requests.map((r) => `<li><span>${esc(r.title)} <small>${esc(W.label(r.status))}${r.dueDate ? ` · due ${esc(W.fmtDate(r.dueDate))}` : ''}</small></span>${r.status === 'open' ? `<button type="button" class="gp-btn gp-btn-outline gp-btn-sm" data-cancel-req="${esc(r.id)}">Cancel</button>` : ''}</li>`).join('') || '<li class="bk-empty">Nothing requested.</li>'}</ul>
            <button type="button" class="gp-btn gp-btn-primary gp-btn-sm" data-new-req style="margin-top:.7rem">Request a document</button>`;
        container.querySelectorAll('[data-doc]').forEach((b) => b.addEventListener('click', () => GradmireAPI.downloadFile(`/api/v1/admin/documents/${b.dataset.doc}/download`).catch((e) => W.say(e.message))));
        container.querySelectorAll('[data-cancel-req]').forEach((b) => b.addEventListener('click', async () => {
            try { await api('POST', `/api/v1/admin/document-requests/${b.dataset.cancelReq}/cancel`, {}); documentsPanel(container, studentId); } catch (e) { W.say(e.message); }
        }));
        container.querySelector('[data-new-req]').addEventListener('click', async () => {
            const values = await W.dialog({
                title: 'Request a document', text: 'The student gets an email and sees the request in My documents.',
                fields: [{ name: 'title', label: 'What should they upload?', required: true, max: 200 }, { name: 'kind', label: 'Type', type: 'select', options: Object.entries(KIND_LABELS) },
                    { name: 'details', label: 'Details for the student', type: 'textarea', max: 1000 }, { name: 'dueDate', label: 'Due date', type: 'date' }],
                confirm: 'Send request',
            });
            if (!values) return;
            try {
                await api('POST', `/api/v1/admin/students/${studentId}/document-requests`, { title: values.title, kind: values.kind, details: values.details || undefined, dueDate: values.dueDate || undefined });
                W.say('Request sent to the student.', 'ok');
                documentsPanel(container, studentId);
            } catch (e) { W.say(e.message); }
        });
    }

    /* Gmail threads with one person, a thread view, and compose/reply. basePath: /api/v1/admin/students/:id or /api/v1/admin/leads/:id */
    async function emailPanel(container, basePath) {
        container.innerHTML = '<p class="bk-empty">Loading email…</p>';
        let data;
        try {
            data = await api('GET', `${basePath}/emails`);
        } catch (e) {
            container.innerHTML = `<p class="bk-empty">${esc(e.message)}</p>`;
            return;
        }
        const notConnected = !data.connected ? '<p class="bk-fine">The shared Gmail inbox is not connected, so only emails sent from this dashboard are listed.</p>' : '';
        container.innerHTML = `${notConnected}
            <ul class="ws-list">${data.threads.map((t) => `<li><span><button type="button" class="crm-open" data-thread="${esc(t.id)}">${esc(t.subject || '(no subject)')}</button> <small>${esc(t.messageCount)} message(s) · last from ${esc(t.lastFrom)}${t.lastDate ? ` · ${esc(W.fmtDateTime(t.lastDate))}` : ''}</small></span></li>`).join('') || (data.connected ? '<li class="bk-empty">No emails with this address in the inbox.</li>' : '')}</ul>
            ${data.sent.length ? `<h3 style="margin-top:1rem">Sent from the dashboard</h3><ul class="ws-list">${data.sent.map((s) => `<li><span>${esc(s.subject)} <small>${esc(s.sentBy)} · ${esc(W.fmtDateTime(s.at))}</small></span>${W.status(s.status, s.status === 'sent' ? 'good' : 'bad')}</li>`).join('')}</ul>` : ''}
            <div id="em-thread"></div>
            ${data.canSend ? '<button type="button" class="gp-btn gp-btn-primary gp-btn-sm" data-compose style="margin-top:.7rem">New email</button>' : '<p class="bk-fine">Sending needs Gmail to be connected by an administrator.</p>'}`;
        const compose = async (threadId, subject) => {
            const fields = threadId ? [] : [{ name: 'subject', label: 'Subject', required: true, max: 200 }];
            fields.push({ name: 'body', label: 'Message', type: 'textarea', required: true, max: 8000 });
            const values = await W.dialog({ title: threadId ? `Reply: ${subject}` : `Email ${data.email}`, text: `Sent from the Gradmire mailbox to ${data.email}, signed with your name, and recorded on this record.`, fields, confirm: 'Send email' });
            if (!values) return;
            try {
                await api('POST', `${basePath}/emails`, { subject: values.subject || undefined, body: values.body, threadId: threadId || undefined });
                W.say('Email sent.', 'ok');
                emailPanel(container, basePath);
            } catch (e) { W.say(e.message); }
        };
        container.querySelectorAll('[data-thread]').forEach((b) => b.addEventListener('click', async () => {
            const box = container.querySelector('#em-thread');
            box.innerHTML = '<p class="bk-empty">Loading…</p>';
            try {
                const thread = await api('GET', `${basePath}/emails/${b.dataset.thread}`);
                const subject = thread.messages[0] ? thread.messages[0].subject : '';
                box.innerHTML = `<h3 style="margin-top:1rem">${esc(subject)}</h3>${thread.messages.map((m) => `<div class="crm-note"><small>${esc(m.from)} → ${esc(m.to)}${m.date ? ` · ${esc(W.fmtDateTime(m.date))}` : ''}</small>${esc(m.text)}</div>`).join('')}
                    ${data.canSend ? '<button type="button" class="gp-btn gp-btn-outline gp-btn-sm" data-reply style="margin-top:.6rem">Reply</button>' : ''}`;
                if (data.canSend) box.querySelector('[data-reply]').addEventListener('click', () => compose(thread.id, subject));
            } catch (e) { box.innerHTML = `<p class="bk-empty">${esc(e.message)}</p>`; }
        }));
        const button = container.querySelector('[data-compose]');
        if (button) button.addEventListener('click', () => compose(null, ''));
    }

    /* ── Consultant overview ────────────────────────────────────────────── */

    async function consultantDashboard() {
        const user = await W.boot({ allow: STAFF });
        if (!user) return;
        if (isAdmin(user)) $('ws-intro').textContent = 'Your own consultations, enquiries and tasks. Platform figures are on the admin overview.';
        try {
            const d = await api('GET', `/api/v1/consultant/dashboard?timezone=${encodeURIComponent(zone)}`);
            $('cd-stats').innerHTML = [
                stat('Today', d.today.length, 'admin-consultations'),
                stat('Next 7 days', d.upcoming.length, 'admin-consultations'),
                stat('My students', d.counts.assignedStudents, 'consultant-students'),
                stat('New enquiries', d.counts.newLeads, 'consultant-leads', true),
                stat('Enquiry follow-ups due', d.counts.leadsFollowUpDue, 'consultant-leads', true),
                stat('Open tasks', d.counts.openFollowUps, 'consultant-follow-ups'),
                stat('Overdue tasks', d.counts.overdueFollowUps, 'consultant-follow-ups', true),
                stat('Outcomes to record', d.counts.outcomesDue, 'admin-consultations', true),
            ].join('');
            const session = (c) => `<li><span><a href="admin-consultations#id=${esc(c.id)}">${esc(c.student)}</a> <small>${esc(c.type)} · ${esc(W.label(c.meetingMethod))}</small></span><small>${esc(W.fmtDateTime(c.start))} · ${esc(W.label(c.status))}${c.meetingUrl ? ` · <a href="${esc(c.meetingUrl)}" target="_blank" rel="noopener noreferrer">Join Meet</a>` : ''}</small></li>`;
            $('cd-today').innerHTML = listOrEmpty(d.today, session, 'Nothing booked today.');
            $('cd-upcoming').innerHTML = listOrEmpty(d.upcoming, session, 'Nothing booked in the next week.');
            $('cd-leads').innerHTML = listOrEmpty(d.newLeads, (l) => `<li><a href="consultant-leads#lead=${esc(l.id)}">${esc(l.name)}</a><small>Received ${esc(W.fmtDate(l.createdAt))}</small></li>`, 'No new enquiries.');
            $('cd-deadlines').innerHTML = listOrEmpty(d.deadlines, (a) => `<li><span><strong>${esc(a.university)}</strong> <small>${esc(a.course)} · ${esc(a.student.name)}</small></span><small>${esc(W.fmtDate(a.deadline))}</small></li>`, 'No deadlines in the next 30 days.');
        } catch (e) {
            W.say(e.message);
        }
    }

    /* ── Students ───────────────────────────────────────────────────────── */

    async function studentsPage() {
        if (!await W.boot({ allow: STAFF })) return;
        const form = $('st-filters');
        const rows = $('st-rows');
        const paging = W.pager('st', load);
        async function load() {
            try {
                const data = await api('GET', `/api/v1/consultant/students?${W.formQuery(form, { page: paging.state.page })}`);
                paging.update(data);
                rows.innerHTML = data.items.length ? data.items.map((s) => `<tr>
                    <td><button type="button" class="crm-open" data-student="${esc(s.id)}" data-name="${esc(s.name)}" data-email="${esc(s.email)}">${esc(s.name)}</button><small>${esc(s.email)}${s.phone ? ` · ${esc(s.phone)}` : ''}</small></td>
                    <td>${esc(s.destinations.join(', ') || '—')}</td><td>${esc(s.intake || '—')}</td>
                    <td>${s.applicationCount ? `${s.applicationCount} <small>${esc(W.label(s.latestApplicationStatus))}</small>` : '—'} <small><a href="admin-students">Manage</a></small></td>
                    <td>${esc(W.fmtDate(s.lastInteraction))}${s.nextConsultation ? `<small>Next: ${esc(W.fmtDate(s.nextConsultation))}</small>` : ''}</td>
                    <td>${esc(W.fmtDate(s.nextFollowUp))}</td><td>${esc(s.consultant || '—')}</td></tr>`).join('') : W.emptyRow(7, 'No students match.');
            } catch (e) {
                rows.innerHTML = W.emptyRow(7, e.message);
            }
        }
        const view = W.drawer('st-drawer');
        rows.addEventListener('click', (event) => {
            const button = event.target.closest('[data-student]');
            if (!button) return;
            view.open(button.dataset.name, button.dataset.email);
            view.body.innerHTML = '<section><h3>Documents</h3><div id="st-docs"></div></section><section><h3>Email</h3><div id="st-email"></div></section>';
            documentsPanel($('st-docs'), button.dataset.student);
            emailPanel($('st-email'), `/api/v1/admin/students/${button.dataset.student}`);
        });
        form.addEventListener('submit', (event) => { event.preventDefault(); paging.reset(); load(); });
        load();
    }

    /* ── Enquiries (leads) ──────────────────────────────────────────────── */

    async function leadsPage() {
        const user = await W.boot({ allow: STAFF });
        if (!user) return;
        if (!isAdmin(user) && /\/admin-leads(\.html)?$/.test(location.pathname)) {
            location.replace('consultant-leads');
            return;
        }
        const admin = isAdmin(user) && /\/admin-leads(\.html)?$/.test(location.pathname);
        const form = $('ld-filters');
        const rows = $('ld-rows');
        const view = W.drawer('ld-drawer');
        const paging = W.pager('ld', load);
        let counsellors = [];
        if (admin) counsellors = await counsellorOptions($('ld-assigned'));
        else form.elements.status.value = 'open';
        prefill(form);

        async function load() {
            try {
                const data = await api('GET', `/api/v1/admin/leads?${W.formQuery(form, { page: paging.state.page })}`);
                paging.update(data);
                rows.innerHTML = data.items.length ? data.items.map((l) => `<tr>
                    <td>${esc(W.fmtDate(l.createdAt))}</td>
                    <td><button type="button" class="crm-open" data-lead="${esc(l.id)}">${esc(l.name || l.email)}</button><small>${esc(l.email)}${l.isGuest ? ' · guest' : ' · has account'}</small></td>
                    <td>${esc(W.label(l.source))}</td><td>${esc([l.destination, l.serviceInterest].filter(Boolean).join(' · ') || '—')}</td>
                    <td>${W.status(l.status, LEAD_TONE[l.status])}</td><td>${esc(l.assignedCounsellor ? l.assignedCounsellor.name : 'Unassigned')}</td>
                    <td>${esc(W.fmtDate(l.nextFollowUpAt))}</td></tr>`).join('') : W.emptyRow(7, 'No enquiries match.');
            } catch (e) {
                rows.innerHTML = W.emptyRow(7, e.message);
            }
        }

        function renderLead(l) {
            const dl = [['Email', l.email], ['Phone', l.phone], ['Destination', l.destination], ['Intake', l.intake], ['Study level', l.studyLevel], ['Course', l.course], ['Interest', l.serviceInterest], ['Message', l.message], ['Consent to contact', l.contactConsent ? 'Yes' : 'No'], ['Last contacted', W.fmtDateTime(l.lastContactedAt)]]
                .filter(([, v]) => v).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
            const statusOptions = ['new', 'contacted', 'qualified', 'consultation_booked', 'converted', 'not_interested', 'closed']
                .map((s) => `<option value="${s}"${s === l.status ? ' selected' : ''}${s === 'converted' && !l.account ? ' disabled' : ''}>${esc(W.label(s))}</option>`).join('');
            const follow = l.nextFollowUpAt ? new Date(new Date(l.nextFollowUpAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
            view.body.innerHTML = `
              <section><h3>Contact</h3><dl class="ws-dl">${dl}</dl>
                ${l.account ? `<p class="bk-fine">Linked to the account ${esc(l.account.email)}${l.account.emailVerified ? ' (verified)' : ''}.</p>` : '<p class="bk-fine">Guest: no account is linked.</p>'}</section>
              <section><h3>Status and follow-up</h3><form id="ld-update" class="crm-row">
                <label class="gp-field"><span>Status</span><select name="status">${statusOptions}</select></label>
                <label class="gp-field"><span>Next follow-up</span><input type="datetime-local" name="nextFollowUpAt" value="${esc(follow)}"></label>
                ${admin ? `<label class="gp-field"><span>Assigned to</span><select name="assignedCounsellorId"><option value="">Nobody</option>${counsellors.filter((c) => c.isActive || (l.assignedCounsellor && c.id === l.assignedCounsellor.id)).map((c) => `<option value="${esc(c.id)}"${l.assignedCounsellor && l.assignedCounsellor.id === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>` : ''}
                <button class="gp-btn gp-btn-primary gp-btn-sm" type="submit">Save</button></form></section>
              <section><h3>Record contact or note</h3><form id="ld-activity" class="crm-row">
                <label class="gp-field"><span>Type</span><select name="kind"><option value="contact_attempt">Contact attempt</option><option value="note">Internal note</option></select></label>
                <label class="gp-field"><span>Channel</span><select name="channel"><option value="phone">Phone</option><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="other">Other</option></select></label>
                <label class="gp-field bk-wide"><span>Outcome or note (staff only)</span><textarea name="body" rows="2" maxlength="2000"></textarea></label>
                <button class="gp-btn gp-btn-primary gp-btn-sm" type="submit">Add</button></form>
                <button type="button" class="gp-btn gp-btn-outline gp-btn-sm" id="ld-task" style="margin-top:.6rem">Create follow-up task</button></section>
              <section><h3>Email</h3><div id="ld-email"></div></section>
              <section><h3>History</h3><ul class="crm-timeline">${l.activities.map((a) => `<li><time datetime="${esc(a.at)}">${esc(W.fmtDateTime(a.at))}</time><span><strong>${esc(W.label(a.kind))}</strong>${a.channel ? ` (${esc(a.channel)})` : ''} · ${esc(a.actor)}${a.body ? `<br>${esc(a.body)}` : ''}${a.details && a.details.to && a.kind === 'status_changed' ? `<br>${esc(W.label(a.details.from))} → ${esc(W.label(a.details.to))}` : ''}</span></li>`).join('') || '<li>No activity yet.</li>'}</ul></section>
              ${l.consultations.length ? `<section><h3>Consultations</h3><ul class="ws-list">${l.consultations.map((c) => `<li><a href="admin-consultations#id=${esc(c.id)}">${esc(c.reference)}</a><small>${esc(W.fmtDateTime(c.start))} · ${esc(W.label(c.status))}</small></li>`).join('')}</ul></section>` : ''}
              ${l.possibleDuplicates.length ? `<section><h3>Other enquiries from the same email or phone</h3><p class="bk-fine">Shown for review; nothing is merged automatically.</p><ul class="ws-list">${l.possibleDuplicates.map((d) => `<li><button type="button" class="crm-open" data-lead="${esc(d.id)}">${esc(W.label(d.source))} · ${esc(W.fmtDate(d.createdAt))}</button><small>${esc(W.label(d.status))}${d.linked ? ' · linked to an account' : ''}</small></li>`).join('')}</ul></section>` : ''}`;
            emailPanel($('ld-email'), `/api/v1/admin/leads/${l.id}`);
            $('ld-update').addEventListener('submit', async (event) => {
                event.preventDefault();
                const f = event.target.elements;
                const body = { status: f.status.value, nextFollowUpAt: f.nextFollowUpAt.value ? new Date(f.nextFollowUpAt.value).toISOString() : null };
                if (admin) body.assignedCounsellorId = f.assignedCounsellorId.value || null;
                try {
                    renderLead(await api('PATCH', `/api/v1/admin/leads/${l.id}`, body));
                    W.say('Enquiry updated.', 'ok');
                    load();
                } catch (e) { W.say(e.message); }
            });
            $('ld-activity').addEventListener('submit', async (event) => {
                event.preventDefault();
                const f = event.target.elements;
                try {
                    renderLead(await api('POST', `/api/v1/admin/leads/${l.id}/activities`, { kind: f.kind.value, channel: f.kind.value === 'contact_attempt' ? f.channel.value : undefined, body: f.body.value.trim() || undefined }));
                    load();
                } catch (e) { W.say(e.message); }
            });
            $('ld-task').addEventListener('click', async () => {
                const values = await W.dialog({ title: 'New follow-up task', fields: [{ name: 'title', label: 'Task', required: true, max: 200 }, { name: 'dueAt', label: 'Due', type: 'datetime' }, { name: 'priority', label: 'Priority', type: 'select', options: [['normal', 'Normal'], ['high', 'High'], ['low', 'Low']] }], confirm: 'Create task' });
                if (!values) return;
                try {
                    await api('POST', '/api/v1/consultant/follow-ups', { title: values.title, dueAt: values.dueAt || undefined, priority: values.priority, leadId: l.id });
                    W.say('Task created. It is on your follow-ups page.', 'ok');
                } catch (e) { W.say(e.message); }
            });
        }

        async function open(id) {
            try {
                const l = await api('GET', `/api/v1/admin/leads/${id}`);
                view.open(l.name || l.email, `${W.label(l.source)} · received ${W.fmtDate(l.createdAt)}`);
                renderLead(l);
            } catch (e) { W.say(e.message); }
        }

        document.addEventListener('click', (event) => {
            const button = event.target.closest('[data-lead]');
            if (button) open(button.dataset.lead);
        });
        form.addEventListener('submit', (event) => { event.preventDefault(); paging.reset(); load(); });
        await load();
        const fromHash = new URLSearchParams(location.hash.slice(1)).get('lead');
        if (fromHash) open(fromHash);
    }

    /* ── Follow-ups ─────────────────────────────────────────────────────── */

    async function followUpsPage() {
        if (!await W.boot({ allow: STAFF })) return;
        let status = 'open';
        const rows = $('fu-rows');
        const PRIORITY_TONE = { high: 'bad', normal: '', low: '' };
        async function load() {
            try {
                const data = await api('GET', `/api/v1/consultant/follow-ups?status=${status}`);
                rows.innerHTML = data.items.length ? data.items.map((t) => {
                    const linked = t.consultation ? `<a href="admin-consultations#id=${esc(t.consultation.id)}">${esc(t.consultation.reference || 'Consultation')}</a>`
                        : t.lead ? `<a href="consultant-leads#lead=${esc(t.lead.id)}">${esc(t.lead.name)}</a>` : t.student ? esc(t.student.name) : '—';
                    const action = t.status === 'open'
                        ? `<button type="button" class="gp-btn gp-btn-outline gp-btn-sm" data-done="${esc(t.id)}" data-source="${esc(t.source)}" data-consultation="${esc(t.consultation ? t.consultation.id : '')}">Mark done</button>`
                        : '';
                    return `<tr><td><strong>${esc(t.title)}</strong>${t.details ? `<small>${esc(t.details)}</small>` : ''}</td>
                        <td>${t.overdue ? W.status('Overdue', 'bad') : ''} ${esc(W.fmtDateTime(t.dueAt))}</td><td>${W.status(t.priority, PRIORITY_TONE[t.priority])}</td>
                        <td>${linked}</td><td>${W.status(t.status, t.status === 'done' ? 'good' : '')}</td><td>${action}</td></tr>`;
                }).join('') : W.emptyRow(6, status === 'open' ? 'No open tasks.' : 'Nothing here.');
            } catch (e) {
                rows.innerHTML = W.emptyRow(6, e.message);
            }
        }
        rows.addEventListener('click', async (event) => {
            const button = event.target.closest('[data-done]');
            if (!button) return;
            button.disabled = true;
            try {
                if (button.dataset.source === 'task') await api('PATCH', `/api/v1/consultant/follow-ups/${button.dataset.done}`, { status: 'done' });
                else await api('POST', `/api/v1/admin/consultations/${button.dataset.consultation}/notes/${button.dataset.done}/complete`, {});
                load();
            } catch (e) {
                W.say(e.message);
                button.disabled = false;
            }
        });
        document.querySelectorAll('[data-status]').forEach((tab) => tab.addEventListener('click', () => {
            status = tab.dataset.status;
            document.querySelectorAll('[data-status]').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
            load();
        }));
        $('fu-new').addEventListener('click', async () => {
            const values = await W.dialog({
                title: 'New follow-up task',
                fields: [{ name: 'title', label: 'Task', required: true, max: 200 }, { name: 'details', label: 'Details', type: 'textarea', max: 2000 }, { name: 'dueAt', label: 'Due', type: 'datetime' },
                    { name: 'priority', label: 'Priority', type: 'select', options: [['normal', 'Normal'], ['high', 'High'], ['low', 'Low']] }],
                confirm: 'Create task',
            });
            if (!values) return;
            try {
                await api('POST', '/api/v1/consultant/follow-ups', { title: values.title, details: values.details || undefined, dueAt: values.dueAt || undefined, priority: values.priority });
                load();
            } catch (e) { W.say(e.message); }
        });
        load();
    }

    /* ── Admin overview ─────────────────────────────────────────────────── */

    async function adminDashboard() {
        if (!await W.boot({ allow: ADMINS })) return;
        try {
            const [d, approvals] = await Promise.all([api('GET', '/api/v1/admin/overview'), api('GET', '/api/v1/admin/approvals?status=pending&page_size=10')]);
            $('ad-stats').innerHTML = [
                stat('Registered students', d.students, 'admin-users?role=student'),
                stat('New students (7 days)', d.newStudents7d, 'admin-users?role=student'),
                stat('New enquiries (7 days)', d.newEnquiries7d, 'admin-leads'),
                stat('Open guest enquiries', d.openGuestEnquiries, 'admin-leads?guest=true&status=open'),
                stat('Unassigned enquiries', d.unassignedEnquiries, 'admin-leads?assigned=none&status=open', true),
                stat('Upcoming consultations', d.upcomingConsultations, 'admin-consultations'),
                stat('Consultant applications', d.openConsultantApplications, 'admin-team', true),
                stat('Approvals waiting', d.openApprovals, 'admin-approvals?status=pending', true),
                stat('Pending invitations', d.pendingInvitations, 'admin-team#invitations'),
                stat('Active consultants', d.activeConsultants, 'admin-team#employees'),
                stat('Overdue follow-ups', d.overdueFollowUps, 'consultant-follow-ups', true),
                stat('Undelivered emails', d.undeliveredEmails, 'admin-consultations', true),
                d.completionRate90d ? stat('Attended (90 days)', `${d.completionRate90d.rate}%`, 'admin-consultations') : '',
            ].join('');
            api('GET', '/api/v1/admin/integrations').then((g) => {
                const row = (label, okay, detail) => `<li><span><strong>${esc(label)}</strong> <small>${esc(detail)}</small></span>${W.status(okay ? 'Connected' : 'Not connected', okay ? 'good' : 'warn')}</li>`;
                const mode = { oauth: 'a personal Google account (OAuth)', service_account: 'a Workspace service account' }[g.google.mode];
                $('ad-integrations').innerHTML = [
                    row('Google sign-in for the API', Boolean(mode), mode ? `uses ${mode}` : 'no Google credentials set'),
                    row('Outgoing email', g.email.sending, `provider: ${g.email.provider}`),
                    row('Gmail for staff', Boolean(g.gmail.sender), g.gmail.sender ? `sends as ${g.gmail.sender}` : 'GMAIL_SENDER not set'),
                    row('Gmail inbox in the CRM', Boolean(g.gmail.inbox), g.gmail.inbox ? `reads ${g.gmail.inbox}` : 'GMAIL_MAILBOX not set'),
                    row('Document storage', g.storage.configured, `provider: ${g.storage.provider}`),
                    row('Google Calendar', g.calendar.configured, `${g.calendar.consultantsWithCalendar} of ${g.calendar.activeConsultants} active consultants have a calendar`),
                    row('Google Meet links', g.calendar.meetLinks, g.calendar.meetLinks ? 'video bookings and interviews get a Meet link' : 'GOOGLE_CALENDAR_CREATE_MEET is off'),
                ].join('');
            }).catch((e) => { $('ad-integrations').innerHTML = `<li class="bk-empty">${esc(e.message)}</li>`; });
            $('ad-approvals').innerHTML = listOrEmpty(approvals.items, (r) => `<li><a href="admin-approvals#request=${esc(r.id)}">${esc(r.target.name)}: ${esc(roleLabel(r.fromRole))} → ${esc(roleLabel(r.requestedRole))}</a><small>${esc(W.label(r.type))} · ${esc(W.fmtDate(r.createdAt))}</small></li>`, 'No requests are waiting.');
        } catch (e) {
            W.say(e.message);
        }
    }

    /* Filter forms can be pre-filled from the query string (links from the overview). */
    function prefill(form) {
        new URLSearchParams(location.search).forEach((value, key) => {
            const input = form.elements[key];
            if (!input) return;
            if (input.type === 'checkbox') input.checked = value === input.value;
            else input.value = value;
        });
    }

    /* ── Users ──────────────────────────────────────────────────────────── */

    async function usersPage() {
        const me = await W.boot({ allow: ADMINS });
        if (!me) return;
        const form = $('us-filters');
        const rows = $('us-rows');
        const view = W.drawer('us-drawer');
        const paging = W.pager('us', load);
        prefill(form);
        async function load() {
            try {
                const data = await api('GET', `/api/v1/admin/users?${W.formQuery(form, { page: paging.state.page })}`);
                paging.update(data);
                rows.innerHTML = data.items.length ? data.items.map((u) => `<tr>
                    <td><button type="button" class="crm-open" data-user="${esc(u.id)}">${esc(u.name)}</button></td><td>${esc(u.email)}</td>
                    <td>${esc(roleLabel(u.role))}</td><td>${W.status(u.status === 'disabled' ? 'Suspended' : 'Active', u.status === 'disabled' ? 'bad' : 'good')}</td>
                    <td>${u.emailVerified ? 'Yes' : 'No'}</td><td>${esc(W.fmtDate(u.createdAt))}</td></tr>`).join('') : W.emptyRow(6, 'No users match.');
            } catch (e) {
                rows.innerHTML = W.emptyRow(6, e.message);
            }
        }

        async function open(id) {
            try {
                render(await api('GET', `/api/v1/admin/users/${id}`));
            } catch (e) { W.say(e.message); }
        }

        function render(u) {
            view.open(u.name, `${roleLabel(u.role)} · ${u.email}`);
            const staff = STAFF.includes(u.role);
            const self = u.id === me.id;
            const privileged = ADMINS.includes(u.role);
            const mayManage = !self && (!privileged || me.role === 'super_admin');
            const dup = u.possibleDuplicates;
            view.body.innerHTML = `
              <section><h3>Account</h3><dl class="ws-dl">
                <dt>Status</dt><dd>${W.status(u.status === 'disabled' ? 'Suspended' : 'Active', u.status === 'disabled' ? 'bad' : 'good')}${u.statusReason ? ` ${esc(u.statusReason)}` : ''}</dd>
                <dt>Email</dt><dd>${esc(u.email)} ${u.emailVerified ? '(verified)' : '(not verified)'}</dd><dt>Phone</dt><dd>${esc(u.phone || '—')}</dd>
                <dt>Registered</dt><dd>${esc(W.fmtDate(u.createdAt))}</dd><dt>Consultations</dt><dd>${esc(u.consultations.total)} (${esc(u.consultations.upcoming)} upcoming)</dd>
                ${u.employeeProfile ? `<dt>Employee</dt><dd>${esc(u.employeeProfile.jobTitle)}, ${esc(u.employeeProfile.department)} · ${esc(W.label(u.employeeProfile.employmentStatus))}</dd>` : ''}
              </dl>
              ${mayManage ? `<div class="bk-actions" style="margin-top:.8rem">
                <button type="button" class="gp-btn gp-btn-outline gp-btn-sm" id="us-status">${u.status === 'disabled' ? 'Reactivate account' : 'Suspend account'}</button>
                ${staff ? '<button type="button" class="gp-btn gp-btn-outline gp-btn-sm" id="us-role">Request role change</button><button type="button" class="gp-btn gp-btn-outline gp-btn-sm" id="us-revoke">Request access removal</button>' : ''}
              </div>` : `<p class="bk-fine">${self ? 'You cannot change your own account here.' : 'Only a super administrator can manage administrator accounts.'}</p>`}
              ${!staff ? '<p class="bk-fine">Students get staff access through an employee invitation on the Team page.</p>' : ''}</section>
              ${(dup.leads.length || dup.consultations.length) ? `<section><h3>Possible records of this person</h3><p class="bk-fine">These guest records share the account's phone number but not its verified email, so they were not linked automatically. Link one only after confirming it belongs to this person.</p>
                <ul class="ws-list">${dup.leads.map((l) => `<li><span>Enquiry from ${esc(l.email)} <small>${esc(W.label(l.source))} · ${esc(W.fmtDate(l.createdAt))}</small></span><button type="button" class="gp-btn gp-btn-outline gp-btn-sm" data-link-lead="${esc(l.id)}">Link</button></li>`).join('')}
                ${dup.consultations.map((c) => `<li><span>Booking ${esc(c.reference)} by ${esc(c.email)} <small>${esc(W.fmtDateTime(c.start))}</small></span><button type="button" class="gp-btn gp-btn-outline gp-btn-sm" data-link-consultation="${esc(c.id)}">Link</button></li>`).join('')}</ul></section>` : ''}
              ${u.accessRequests.length ? `<section><h3>Access requests</h3><ul class="ws-list">${u.accessRequests.map((r) => `<li><a href="admin-approvals#request=${esc(r.id)}">${esc(W.label(r.type))}: ${esc(roleLabel(r.fromRole))} → ${esc(roleLabel(r.requestedRole))}</a>${W.status(r.status, REQ_TONE[r.status])}</li>`).join('')}</ul></section>` : ''}
              <section><h3>History</h3><ul class="crm-timeline">${u.history.map((h) => `<li><time datetime="${esc(h.at)}">${esc(W.fmtDateTime(h.at))}</time><span>${esc(h.action)} · ${esc(h.actor)}</span></li>`).join('') || '<li>No recorded changes.</li>'}</ul></section>`;

            const after = async (work, message) => {
                try {
                    await work();
                    W.say(message, 'ok');
                    load();
                    open(u.id);
                } catch (e) { W.say(e.message); }
            };
            if ($('us-status')) $('us-status').addEventListener('click', async () => {
                const suspend = u.status !== 'disabled';
                const values = await W.dialog({ title: suspend ? `Suspend ${u.name}?` : `Reactivate ${u.name}?`, text: suspend ? 'They are signed out everywhere at once and cannot log in until reactivated. Their records are kept.' : '', fields: [{ name: 'reason', label: 'Reason (recorded in the audit log)', type: 'textarea', required: true, max: 500 }], confirm: suspend ? 'Suspend' : 'Reactivate', danger: suspend });
                if (values) after(() => api('PATCH', `/api/v1/admin/users/${u.id}/status`, { status: suspend ? 'disabled' : 'active', reason: values.reason }), suspend ? 'Account suspended.' : 'Account reactivated.');
            });
            if ($('us-role')) $('us-role').addEventListener('click', async () => {
                const choices = ['counsellor', 'admin', 'super_admin'].filter((r) => r !== u.role).map((r) => [r, roleLabel(r)]);
                const values = await W.dialog({ title: 'Request a role change', text: 'Another administrator must approve it. Changes involving administrator access need a super administrator.', fields: [{ name: 'requestedRole', label: 'New role', type: 'select', options: choices, required: true }, { name: 'reason', label: 'Reason', type: 'textarea', required: true, max: 1000 }], confirm: 'Send for approval' });
                if (values) after(() => api('POST', `/api/v1/admin/users/${u.id}/role-change-requests`, values), 'Request sent for approval.');
            });
            if ($('us-revoke')) $('us-revoke').addEventListener('click', async () => {
                const counsellors = (await api('GET', '/api/v1/admin/counsellors').catch(() => [])).filter((c) => c.isActive && c.id !== u.id);
                const values = await W.dialog({ title: 'Request removal of staff access', text: 'After approval they return to a student account, are signed out, and their upcoming consultations, open enquiries and tasks move to the person you choose. Past records stay.', fields: [{ name: 'reassignToCounsellorId', label: 'Who takes over their work', type: 'select', options: [['', 'Nobody (only if they have no open work)'], ...counsellors.map((c) => [c.id, c.name])] }, { name: 'reason', label: 'Reason', type: 'textarea', required: true, max: 1000 }], confirm: 'Send for approval', danger: true });
                if (values) after(() => api('POST', `/api/v1/admin/users/${u.id}/revocation-requests`, { reason: values.reason, reassignToCounsellorId: values.reassignToCounsellorId || undefined }), 'Request sent for approval.');
            });
            view.body.querySelectorAll('[data-link-lead], [data-link-consultation]').forEach((button) => button.addEventListener('click', async () => {
                const values = await W.dialog({ title: 'Link this record to the account?', text: 'The person will see it in their dashboard. This is recorded in the audit log.', fields: [{ name: 'reason', label: 'How did you confirm it is theirs?', type: 'textarea', required: true, max: 500 }], confirm: 'Link record' });
                if (!values) return;
                const body = button.dataset.linkLead ? { leadId: button.dataset.linkLead } : { consultationId: button.dataset.linkConsultation };
                after(() => api('POST', `/api/v1/admin/users/${u.id}/link-record`, { ...body, reason: values.reason }), 'Record linked.');
            }));
        }

        rows.addEventListener('click', (event) => {
            const button = event.target.closest('[data-user]');
            if (button) open(button.dataset.user);
        });
        form.addEventListener('submit', (event) => { event.preventDefault(); paging.reset(); load(); });
        load();
    }

    /* ── Team and hiring ────────────────────────────────────────────────── */

    const APP_NEXT = {
        submitted: ['under_review', 'info_requested', 'rejected'], info_requested: ['rejected'], under_review: ['shortlisted', 'info_requested', 'rejected'],
        shortlisted: ['interview_scheduled', 'rejected'], interview_scheduled: ['interview_scheduled', 'interview_completed', 'rejected'], interview_completed: ['approved', 'rejected'],
    };
    const ACTION_LABEL = { under_review: 'Start review', info_requested: 'Ask for information', rejected: 'Reject', shortlisted: 'Shortlist', interview_scheduled: 'Schedule interview', interview_completed: 'Interview done', approved: 'Approve (send invitation)' };

    async function teamPage() {
        const me = await W.boot({ allow: ADMINS });
        if (!me) return;
        const view = W.drawer('ap-drawer');
        const staff = await api('GET', '/api/v1/admin/staff').catch(() => []);
        $('iv-manager').insertAdjacentHTML('beforeend', staff.map((s) => `<option value="${esc(s.id)}">${esc(s.name)} (${esc(roleLabel(s.role))})</option>`).join(''));

        function showTab(name) {
            document.querySelectorAll('[data-tab]').forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.tab === name)));
            ['applications', 'invitations', 'employees'].forEach((t) => { $(`tm-${t}`).hidden = t !== name; });
            ({ applications: loadApplications, invitations: loadInvitations, employees: loadEmployees })[name]();
        }
        document.querySelectorAll('[data-tab]').forEach((tab) => tab.addEventListener('click', () => showTab(tab.dataset.tab)));

        async function loadApplications() {
            const rows = $('ap-rows');
            try {
                const data = await api('GET', `/api/v1/admin/consultant-applications?${W.formQuery($('ap-filters'), { page_size: 100 })}`);
                rows.innerHTML = data.items.length ? data.items.map((a) => `<tr><td>${esc(W.fmtDate(a.submittedAt))}</td>
                    <td><button type="button" class="crm-open" data-app="${esc(a.id)}">${esc(a.fullName)}</button><small>${esc(a.location)}</small></td>
                    <td>${esc(a.yearsExperience)} years</td><td>${esc(W.label(a.availability))}</td><td>${W.status(a.statusLabel, APP_TONE[a.status])}</td>
                    <td>${esc(a.reviewer ? a.reviewer.name : '—')}</td></tr>`).join('') : W.emptyRow(6, 'No applications match.');
            } catch (e) { rows.innerHTML = W.emptyRow(6, e.message); }
        }

        async function openApplication(id) {
            let a;
            try { a = await api('GET', `/api/v1/admin/consultant-applications/${id}`); } catch (e) { W.say(e.message); return; }
            view.open(a.fullName, `${a.statusLabel} · submitted ${W.fmtDate(a.submittedAt)}`);
            const next = APP_NEXT[a.status] || [];
            const dl = [['Account', a.accountEmail], ['Phone', a.phone], ['Location', a.location], ['Experience', `${a.yearsExperience} years`], ['Availability', W.label(a.availability)],
                ['Languages', a.languages.join(', ')], ['Expertise', a.expertise.join(', ')], ['Professional experience', a.professionalExperience], ['Education', a.education],
                ['Counselling experience', a.counsellingExperience], ['Additional information', a.additionalInfo], ['Interview', a.interviewAt ? W.fmtDateTime(a.interviewAt) : ''], ['Message to applicant', a.message]]
                .filter(([, v]) => v).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
            view.body.innerHTML = `
              <section><h3>Application</h3><dl class="ws-dl">${dl}${a.cvDocumentId ? '<dt>CV</dt><dd><button type="button" class="crm-open" id="ap-cv">Download the uploaded CV</button></dd>' : ''}${a.cvUrl ? `<dt>CV link</dt><dd><a href="${esc(a.cvUrl)}" target="_blank" rel="noopener noreferrer nofollow">Open the CV link</a> <small>(external site)</small></dd>` : ''}</dl></section>
              ${a.status === 'interview_scheduled' ? `<section><h3>Interview meeting</h3><p>${esc(W.fmtDateTime(a.interviewAt))} · ${a.interviewMeeting.meetUrl ? `<a class="gp-btn gp-btn-primary gp-btn-sm" href="${esc(a.interviewMeeting.meetUrl)}" target="_blank" rel="noopener noreferrer">Join Google Meet</a>` : W.status(a.interviewMeeting.status === 'failed' ? 'Calendar failed' : 'No meeting link', a.interviewMeeting.status === 'failed' ? 'bad' : '')}</p>
                ${a.interviewMeeting.status === 'failed' ? '<button type="button" class="gp-btn gp-btn-outline gp-btn-sm" id="ap-meet-retry">Try creating the meeting again</button>' : ''}
                ${a.interviewMeeting.status === 'not_required' ? '<p class="bk-fine">No calendar is connected for you (or GOOGLE_INTERVIEW_CALENDAR_ID), so send the applicant a link yourself.</p>' : ''}</section>` : ''}
              <section><h3>Decision</h3>${next.length ? `<div class="bk-actions">${next.map((s) => `<button type="button" class="gp-btn ${s === 'rejected' ? 'gp-btn-outline' : 'gp-btn-primary'} gp-btn-sm" data-move="${s}">${esc(ACTION_LABEL[s])}</button>`).join('')}</div>` : '<p class="bk-fine">This application is closed.</p>'}
                <p class="bk-fine">Approving records the hiring decision and emails an invitation. Consultant access starts only after onboarding is approved.</p>
                <label class="gp-field"><span>Reviewer</span><select id="ap-reviewer"><option value="">Choose…</option>${staff.filter((s) => ADMINS.includes(s.role)).map((s) => `<option value="${esc(s.id)}"${a.reviewer && a.reviewer.id === s.id ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label></section>
              <section><h3>Private notes and history</h3><form id="ap-note" class="crm-row"><label class="gp-field bk-wide"><span>Add a private note (never shown to the applicant)</span><textarea name="note" rows="2" maxlength="2000" required></textarea></label><button type="submit" class="gp-btn gp-btn-primary gp-btn-sm">Add note</button></form>
                <ul class="crm-timeline">${a.history.map((h) => `<li><time datetime="${esc(h.at)}">${esc(W.fmtDateTime(h.at))}</time><span>${h.to ? `${esc(W.label(h.from || 'new'))} → ${esc(W.label(h.to))}` : esc(W.label(h.event))} · ${esc(h.actor || '—')}${h.note ? `<br><span class="crm-note">${esc(h.note)}</span>` : ''}</span></li>`).join('')}</ul></section>`;
            view.body.querySelectorAll('[data-move]').forEach((button) => button.addEventListener('click', async () => {
                const to = button.dataset.move;
                const fields = [];
                if (to === 'interview_scheduled') fields.push({ name: 'interviewAt', label: 'Interview date and time', type: 'datetime', required: true });
                if (to === 'approved') fields.push({ name: 'jobTitle', label: 'Job title', required: false, max: 120 }, { name: 'department', label: 'Department', required: false, max: 80 }, { name: 'startDate', label: 'Start date', type: 'date' });
                fields.push({ name: 'message', label: 'Message to the applicant', type: 'textarea', required: to === 'info_requested', max: 1000 }, { name: 'note', label: 'Private note', type: 'textarea', max: 2000 });
                const values = await W.dialog({ title: ACTION_LABEL[to], fields, confirm: ACTION_LABEL[to], danger: to === 'rejected' });
                if (!values) return;
                const body = { status: to, message: values.message || undefined, note: values.note || undefined, interviewAt: values.interviewAt || undefined };
                if (to === 'approved') body.job = { jobTitle: values.jobTitle || undefined, department: values.department || undefined, startDate: values.startDate || undefined };
                try {
                    await api('POST', `/api/v1/admin/consultant-applications/${a.id}/transition`, body);
                    W.say(to === 'approved' ? 'Approved. The invitation is on the Invitations tab.' : 'Application updated.', 'ok');
                    loadApplications();
                    openApplication(a.id);
                } catch (e) { W.say(e.message); }
            }));
            if ($('ap-cv')) $('ap-cv').addEventListener('click', () => GradmireAPI.downloadFile(`/api/v1/admin/consultant-applications/${a.id}/cv`).catch((e) => W.say(e.message)));
            if ($('ap-meet-retry')) $('ap-meet-retry').addEventListener('click', async () => {
                try { await api('POST', `/api/v1/admin/consultant-applications/${a.id}/interview-meeting`, {}); openApplication(a.id); } catch (e) { W.say(e.message); }
            });
            $('ap-reviewer').addEventListener('change', async (event) => {
                if (!event.target.value) return;
                try { await api('POST', `/api/v1/admin/consultant-applications/${a.id}/reviewer`, { reviewerId: event.target.value }); loadApplications(); } catch (e) { W.say(e.message); }
            });
            $('ap-note').addEventListener('submit', async (event) => {
                event.preventDefault();
                const note = event.target.elements.note.value.trim();
                if (!note) return;
                try { await api('POST', `/api/v1/admin/consultant-applications/${a.id}/notes`, { note }); openApplication(a.id); } catch (e) { W.say(e.message); }
            });
        }

        async function loadInvitations() {
            const rows = $('iv-rows');
            try {
                const items = await api('GET', '/api/v1/admin/employees/invitations');
                rows.innerHTML = items.length ? items.map((i) => `<tr><td>${esc(W.fmtDate(i.createdAt))}</td><td>${esc(i.fullName)}</td><td>${esc(i.email)}</td>
                    <td>${esc(roleLabel(i.intendedRole))}</td><td>${esc(i.jobTitle)}<small>${esc(i.department)}</small></td>
                    <td>${W.status(i.status, i.status === 'accepted' ? 'good' : i.status === 'pending' ? 'warn' : '')}${i.status === 'pending' ? `<small>Expires ${esc(W.fmtDate(i.expiresAt))}</small>` : ''}</td>
                    <td>${i.status === 'pending' ? `<button type="button" class="gp-btn gp-btn-outline gp-btn-sm" data-revoke="${esc(i.id)}">Revoke</button>` : ''}</td></tr>`).join('') : W.emptyRow(7, 'No invitations yet.');
            } catch (e) { rows.innerHTML = W.emptyRow(7, e.message); }
        }

        async function loadEmployees() {
            const rows = $('em-rows');
            try {
                const items = await api('GET', '/api/v1/admin/employees');
                rows.innerHTML = items.length ? items.map((e) => `<tr><td><a href="admin-users?q=${encodeURIComponent(e.email)}">${esc(e.name)}</a><small>${esc(e.workEmail || e.email)}${e.employeeCode ? ` · ${esc(e.employeeCode)}` : ''}</small></td>
                    <td>${esc(e.jobTitle)}<small>${esc(e.department)}${e.manager ? ` · reports to ${esc(e.manager.name)}` : ''}</small></td><td>${esc(roleLabel(e.currentRole))}</td>
                    <td>${W.status(e.employmentStatus, e.employmentStatus === 'active' ? 'good' : e.employmentStatus === 'pending' ? 'warn' : '')}</td>
                    <td>${esc(e.upcomingConsultations)}</td><td>${esc(e.openLeads)}</td><td>${esc(W.fmtDate(e.approvedAt || e.startDate))}</td></tr>`).join('') : W.emptyRow(7, 'No employee profiles yet. Staff created with the command-line tool get one at their first approved role change.');
            } catch (e) { rows.innerHTML = W.emptyRow(7, e.message); }
        }

        $('ap-filters').addEventListener('submit', (event) => { event.preventDefault(); loadApplications(); });
        $('ap-rows').addEventListener('click', (event) => {
            const button = event.target.closest('[data-app]');
            if (button) openApplication(button.dataset.app);
        });
        $('iv-rows').addEventListener('click', async (event) => {
            const button = event.target.closest('[data-revoke]');
            if (!button) return;
            if (!await W.dialog({ title: 'Revoke this invitation?', text: 'The link stops working at once.', confirm: 'Revoke', danger: true })) return;
            try { await api('POST', `/api/v1/admin/employees/invitations/${button.dataset.revoke}/revoke`, {}); loadInvitations(); } catch (e) { W.say(e.message); }
        });
        const ivForm = $('iv-form');
        ivForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const f = ivForm.elements;
            const body = { fullName: f.fullName.value.trim(), email: f.email.value.trim(), workEmail: f.workEmail.value.trim() || undefined, employeeCode: f.employeeCode.value.trim() || undefined,
                department: f.department.value.trim(), jobTitle: f.jobTitle.value.trim(), intendedRole: f.intendedRole.value, managerUserId: f.managerUserId.value || undefined, startDate: f.startDate.value || undefined };
            try {
                await api('POST', '/api/v1/admin/employees/invitations', body);
                W.formErrors(ivForm, $('iv-error'), null);
                ivForm.reset();
                W.say('Invitation sent. When it is accepted, the activation appears on the Approvals page for another administrator.', 'ok');
                loadInvitations();
            } catch (e) { W.formErrors(ivForm, $('iv-error'), e); }
        });
        const start = location.hash.slice(1);
        showTab(['invitations', 'employees'].includes(start) ? start : 'applications');
    }

    /* ── Approvals ──────────────────────────────────────────────────────── */

    async function approvalsPage() {
        if (!await W.boot({ allow: ADMINS })) return;
        const form = $('aq-filters');
        const rows = $('aq-rows');
        const view = W.drawer('aq-drawer');
        const paging = W.pager('aq', load);
        prefill(form);
        async function load() {
            try {
                const data = await api('GET', `/api/v1/admin/approvals?${W.formQuery(form, { page: paging.state.page })}`);
                paging.update(data);
                rows.innerHTML = data.items.length ? data.items.map((r) => `<tr><td>${esc(W.fmtDate(r.createdAt))}</td>
                    <td><button type="button" class="crm-open" data-request="${esc(r.id)}">${esc(r.target.name)}</button><small>${esc(r.target.email)}</small></td>
                    <td>${esc(roleLabel(r.fromRole))} → ${esc(roleLabel(r.requestedRole))}</td><td>${esc(W.label(r.type))}</td><td>${esc(r.requestedBy.name)}</td>
                    <td>${W.status(r.status, REQ_TONE[r.status])}</td></tr>`).join('') : W.emptyRow(6, 'No requests match.');
            } catch (e) { rows.innerHTML = W.emptyRow(6, e.message); }
        }

        async function open(id) {
            let r;
            try { r = await api('GET', `/api/v1/admin/approvals/${id}`); } catch (e) { W.say(e.message); return; }
            view.open(`${r.target.name}: ${roleLabel(r.fromRole)} → ${roleLabel(r.requestedRole)}`, `${W.label(r.type)} · ${W.label(r.status)}`);
            const w = r.workload;
            const blocked = r.status === 'pending' && !r.canDecide;
            view.body.innerHTML = `
              <section><h3>Request</h3><dl class="ws-dl"><dt>Person</dt><dd><a href="admin-users?q=${encodeURIComponent(r.target.email)}">${esc(r.target.name)}</a> (${esc(r.target.email)}) · now ${esc(roleLabel(r.target.currentRole))}${r.target.accountStatus === 'disabled' ? ' · suspended' : ''}</dd>
                <dt>Change</dt><dd>${esc(roleLabel(r.fromRole))} → ${esc(roleLabel(r.requestedRole))}</dd><dt>Reason</dt><dd>${esc(r.reason)}</dd>
                <dt>Requested by</dt><dd>${esc(r.requestedBy.name)} on ${esc(W.fmtDateTime(r.createdAt))}</dd>
                ${r.type === 'access_revocation' ? `<dt>Their open work</dt><dd>${esc(w.consultations)} upcoming consultation(s), ${esc(w.leads)} enquiry(ies), ${esc(w.tasks)} task(s)</dd><dt>Moves to</dt><dd>${esc(r.reassignTo ? r.reassignTo.name : 'Nobody')}</dd>` : ''}
                ${r.reviewerComment ? `<dt>Reviewer comment</dt><dd>${esc(r.reviewerComment)}</dd>` : ''}
                ${r.decidedBy ? `<dt>Decided by</dt><dd>${esc(r.decidedBy.name)} on ${esc(W.fmtDateTime(r.decidedAt))}</dd>` : ''}</dl></section>
              <section><h3>Action</h3><div class="bk-actions">
                ${r.canDecide ? '<button type="button" class="gp-btn gp-btn-primary gp-btn-sm" data-act="approve">Approve</button><button type="button" class="gp-btn gp-btn-outline gp-btn-sm" data-act="request-information">Ask for information</button><button type="button" class="gp-btn gp-btn-outline gp-btn-sm" data-act="reject">Reject</button>' : ''}
                ${r.canRespond ? '<button type="button" class="gp-btn gp-btn-primary gp-btn-sm" data-act="respond">Answer the question</button>' : ''}
                ${r.canCancel ? '<button type="button" class="gp-btn gp-btn-outline gp-btn-sm" data-act="cancel">Cancel request</button>' : ''}</div>
                ${blocked ? '<p class="bk-fine">You cannot decide this request: it was made by you, it is about you, or it needs a super administrator.</p>' : ''}
                ${!['pending', 'info_requested'].includes(r.status) ? '<p class="bk-fine">This request is closed.</p>' : ''}</section>
              <section><h3>History</h3><ul class="crm-timeline">${r.history.map((h) => `<li><time datetime="${esc(h.at)}">${esc(W.fmtDateTime(h.at))}</time><span><strong>${esc(W.label(h.action))}</strong> · ${esc(h.actor || '—')}${h.comment ? `<br>${esc(h.comment)}` : ''}</span></li>`).join('')}</ul></section>`;
            view.body.querySelectorAll('[data-act]').forEach((button) => button.addEventListener('click', async () => {
                const act = button.dataset.act;
                const text = {
                    approve: r.type === 'access_revocation' ? 'Their staff access ends now: they are signed out and their open work moves as shown.' : 'Access changes now and they are signed out so their workspace refreshes.',
                    reject: 'The request is closed and nothing changes.', cancel: 'The request is withdrawn.',
                }[act] || '';
                const needsComment = ['reject', 'request-information', 'respond'].includes(act);
                const values = await W.dialog({ title: W.label(act.replace('-', ' ')), text, fields: act === 'cancel' ? [] : [{ name: 'comment', label: act === 'request-information' ? 'What do you need to know?' : 'Comment', type: 'textarea', required: needsComment, max: 1000 }], confirm: W.label(act.replace('-', ' ')), danger: ['reject', 'cancel'].includes(act) || r.type === 'access_revocation' });
                if (!values) return;
                try {
                    await api('POST', `/api/v1/admin/approvals/${r.id}/${act}`, act === 'cancel' ? {} : { comment: values.comment || undefined });
                    W.say('Done.', 'ok');
                    load();
                    open(r.id);
                } catch (e) { W.say(e.message); }
            }));
        }

        rows.addEventListener('click', (event) => {
            const button = event.target.closest('[data-request]');
            if (button) open(button.dataset.request);
        });
        form.addEventListener('submit', (event) => { event.preventDefault(); paging.reset(); load(); });
        await load();
        const fromHash = new URLSearchParams(location.hash.slice(1)).get('request');
        if (fromHash) open(fromHash);
    }

    /* ── Audit log ──────────────────────────────────────────────────────── */

    async function auditPage() {
        if (!await W.boot({ allow: ADMINS })) return;
        const form = $('au-filters');
        const rows = $('au-rows');
        const paging = W.pager('au', load);
        prefill(form);
        async function load() {
            const f = form.elements;
            const extra = { page: paging.state.page, from: f.from.value ? new Date(`${f.from.value}T00:00:00`).toISOString() : '', to: f.to.value ? new Date(`${f.to.value}T23:59:59`).toISOString() : '' };
            const params = new URLSearchParams(W.formQuery(form, extra));
            ['from', 'to'].forEach((key) => { if (!extra[key]) params.delete(key); else params.set(key, extra[key]); });
            try {
                const data = await api('GET', `/api/v1/admin/audit-logs?${params}`);
                paging.update(data);
                rows.innerHTML = data.items.length ? data.items.map((a) => `<tr><td>${esc(W.fmtDateTime(a.at))}</td><td>${esc(a.actor ? a.actor.name || a.actor.email : 'System')}</td>
                    <td><code>${esc(a.action)}</code></td><td>${esc(a.entityType || '—')}<small>${esc(a.entityId || '')}</small></td>
                    <td><small>${esc(JSON.stringify(a.details).slice(0, 400))}</small></td></tr>`).join('') : W.emptyRow(5, 'No events match.');
            } catch (e) { rows.innerHTML = W.emptyRow(5, e.message); }
        }
        form.addEventListener('submit', (event) => { event.preventDefault(); paging.reset(); load(); });
        load();
    }

    const PAGES = {
        'consultant-dashboard': consultantDashboard, 'consultant-students': studentsPage, leads: leadsPage, 'follow-ups': followUpsPage,
        'admin-dashboard': adminDashboard, 'admin-users': usersPage, 'admin-team': teamPage, 'admin-approvals': approvalsPage, 'admin-audit': auditPage,
    };
    if (PAGES[page]) PAGES[page]();
})();
