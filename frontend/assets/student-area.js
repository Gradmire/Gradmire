/* Student pages (profile, notifications, become a consultant) and two public
   pages (accept an employee invitation, resend a guest booking link). Every
   value shown comes from the API and is escaped before it is inserted. */
(function () {
    'use strict';

    const W = window.GMWorkspace;
    const { esc } = W;
    const $ = (id) => document.getElementById(id);
    const api = (method, path, body) => GradmireAPI.request(method, path, body);
    const page = document.body.dataset.page;

    /* ── Profile ────────────────────────────────────────────────────────── */

    const PROFILE_TEXT = ['firstName', 'lastName', 'phone', 'intendedIntake', 'studyLevel', 'preferredCourse', 'highestQualification', 'academicScore', 'englishTest', 'englishScore', 'budgetRange', 'consultationLanguage'];

    function showCompletion(value) {
        const meter = $('pf-meter');
        meter.setAttribute('aria-valuenow', value);
        meter.querySelector('span').style.width = `${value}%`;
        $('pf-meter-text').textContent = value === 100 ? 'Your profile is complete.' : `${value}% complete. A fuller profile helps your counsellor prepare.`;
    }

    function fillProfile(form, p) {
        PROFILE_TEXT.forEach((name) => {
            if (form.elements[name]) form.elements[name].value = p[name] || '';
        });
        form.elements.email.value = p.email;
        form.querySelectorAll('input[name="destinations"]').forEach((box) => { box.checked = p.destinations.includes(box.value); });
        showCompletion(p.completion);
    }

    /* The confirmation link from the email lands here as #email-change=TOKEN (works signed in or out). */
    async function confirmEmailChangeFromLink() {
        const token = new URLSearchParams(location.hash.slice(1)).get('email-change');
        if (!token) return false;
        history.replaceState(null, '', location.pathname);
        try {
            const result = await api('POST', '/api/v1/auth/email-change/confirm', { token });
            await GradmireAPI.getSession(true).catch(() => null);
            W.say(`Your login email is now ${result.email}. You have been signed out everywhere; please log in again.`, 'ok');
            setTimeout(() => { location.href = `login?next=${encodeURIComponent('dashboard-profile')}`; }, 3500);
        } catch (e) {
            W.say(e.message);
        }
        return true;
    }

    function emailChangeForm() {
        const form = $('em-form');
        const error = $('em-error');
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const newEmail = form.elements.newEmail.value.trim();
            const password = form.elements.password.value;
            if (!newEmail || !password) {
                W.formErrors(form, error, { message: 'Enter the new address and your current password.', fields: { [!newEmail ? 'newEmail' : 'password']: true } });
                return;
            }
            const button = form.querySelector('[type="submit"]');
            button.disabled = true;
            try {
                await api('POST', '/api/v1/me/email-change', { newEmail, password });
                W.formErrors(form, error, null);
                form.reset();
                W.say(`We sent a confirmation link to ${newEmail}. Your email changes only after you open it (within 24 hours).`, 'ok');
            } catch (e) {
                W.formErrors(form, error, e);
            } finally {
                button.disabled = false;
            }
        });
    }

    async function profilePage() {
        if (await confirmEmailChangeFromLink()) return;
        if (!await W.boot({ allow: ['student'] })) return;
        emailChangeForm();
        const form = $('pf-form');
        const error = $('pf-error');
        try {
            fillProfile(form, await api('GET', '/api/v1/me/profile'));
        } catch (e) {
            W.say(e.message);
        }
        form.querySelectorAll('input[name="destinations"]').forEach((box) => box.addEventListener('change', () => {
            const checked = form.querySelectorAll('input[name="destinations"]:checked');
            if (checked.length > 5) {
                box.checked = false;
                W.say('Choose up to five destinations.', 'info');
            }
        }));
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const body = {};
            PROFILE_TEXT.forEach((name) => { body[name] = form.elements[name].value.trim(); });
            if (!body.firstName) {
                W.formErrors(form, error, { message: 'First name is required.', fields: { firstName: true } });
                return;
            }
            body.destinations = [...form.querySelectorAll('input[name="destinations"]:checked')].map((box) => box.value);
            const button = form.querySelector('[type="submit"]');
            button.disabled = true;
            try {
                fillProfile(form, await api('PATCH', '/api/v1/me/profile', body));
                W.formErrors(form, error, null);
                W.say('Your profile was saved.', 'ok');
            } catch (e) {
                W.formErrors(form, error, e);
            } finally {
                button.disabled = false;
            }
        });
    }

    /* ── Notifications (every signed-in role) ───────────────────────────── */

    async function notificationsPage() {
        if (!await W.boot({})) return;
        let filter = 'all';
        const list = $('nt-list');
        async function load() {
            try {
                const data = await api('GET', `/api/v1/me/notifications${filter === 'unread' ? '?unread=true' : ''}`);
                list.innerHTML = data.items.length ? data.items.map((n) => {
                    const href = n.link ? GradmireAPI.safeNext(n.link, null) : null;
                    return `<li class="${n.read ? '' : 'is-unread'}"><h3>${href ? `<a href="${esc(href)}" data-read="${esc(n.id)}">${esc(n.title)}</a>` : esc(n.title)}${n.read ? '' : ' <span class="sr-only">(unread)</span>'}</h3>
                        ${n.body ? `<p>${esc(n.body)}</p>` : ''}<time datetime="${esc(n.createdAt)}">${esc(W.fmtDateTime(n.createdAt))}</time></li>`;
                }).join('') : `<li class="bk-empty">${filter === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}</li>`;
                $('nt-read-all').disabled = !data.unread;
            } catch (e) {
                list.innerHTML = `<li class="bk-empty">${esc(e.message)}</li>`;
            }
        }
        list.addEventListener('click', (event) => {
            const link = event.target.closest('[data-read]');
            if (link) api('POST', '/api/v1/me/notifications/read', { ids: [link.dataset.read] }).catch(() => {});
        });
        $('nt-read-all').addEventListener('click', async () => {
            await api('POST', '/api/v1/me/notifications/read', {}).catch((e) => W.say(e.message));
            load();
        });
        document.querySelectorAll('[data-filter]').forEach((tab) => tab.addEventListener('click', () => {
            filter = tab.dataset.filter;
            document.querySelectorAll('[data-filter]').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
            load();
        }));
        load();
    }

    /* ── Become a consultant ────────────────────────────────────────────── */

    const TONE = { approved: 'good', rejected: 'bad', withdrawn: '', info_requested: 'warn' };
    const listField = (value) => value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 10);

    async function becomeConsultantPage() {
        const user = await W.boot({ allow: ['student'] });
        if (!user) return;
        const form = $('bc-form');
        const error = $('bc-error');
        const box = $('bc-status');
        let editing = null;

        function showForm(application) {
            editing = application;
            form.hidden = false;
            $('bc-form-title').textContent = application ? 'Update your application' : 'Your application';
            $('bc-consent-row').hidden = Boolean(application);
            $('bc-cancel').hidden = !application;
            $('bc-submit').textContent = application ? (application.status === 'info_requested' ? 'Send the update' : 'Save changes') : 'Submit application';
            const a = application || { fullName: [user.firstName, user.lastName].filter(Boolean).join(' '), phone: user.phone || '' };
            ['fullName', 'phone', 'location', 'yearsExperience', 'availability', 'professionalExperience', 'education', 'counsellingExperience', 'cvUrl', 'additionalInfo']
                .forEach((name) => { form.elements[name].value = a[name] == null ? '' : a[name]; });
            form.elements.languages.value = (a.languages || []).join(', ');
            form.elements.expertise.value = (a.expertise || []).join(', ');
            form.elements.cvFile.value = '';
            $('bc-cv-current').textContent = a.cvDocumentId ? 'A CV is attached; choose a file only to replace it. ' : '';
            form.elements.fullName.focus();
        }

        function render(applications) {
            const current = applications[0];
            form.hidden = true;
            if (!user.emailVerified) {
                box.innerHTML = '<div class="bk-alert bk-alert--info">Verify your email address before applying. Use the link we emailed you, or resend it from <a href="dashboard">your dashboard</a>.</div>';
                return;
            }
            if (!current || !current.canWithdraw) {
                box.innerHTML = current ? `<section class="bk-panel"><h2 class="bk-step-title">Your last application</h2><p>${W.status(current.statusLabel, TONE[current.status])}</p>${current.message ? `<p class="crm-note">${esc(current.message)}</p>` : ''}<p class="bk-fine">Decided ${esc(W.fmtDate(current.decidedAt))}. You can apply again below.</p></section>` : '';
                showForm(null);
                return;
            }
            box.innerHTML = `<section class="bk-panel" aria-labelledby="bc-current-title">
                <h2 class="bk-step-title" id="bc-current-title">Application status</h2>
                <p>${W.status(current.statusLabel, TONE[current.status])}</p>
                ${current.message ? `<p class="crm-note"><strong>Message from the Gradmire team:</strong> ${esc(current.message)}</p>` : ''}
                ${current.interviewAt ? `<p>Interview: <strong>${esc(W.fmtDateTime(current.interviewAt))}</strong>${current.interviewMeetUrl ? ` · <a class="gp-btn gp-btn-primary gp-btn-sm" href="${esc(current.interviewMeetUrl)}" target="_blank" rel="noopener noreferrer">Join with Google Meet</a>` : ' · The meeting link will be sent before the interview.'}</p>` : ''}
                ${current.cvDocumentId ? `<p><button type="button" class="crm-open" id="bc-cv-download">Download the CV you uploaded</button></p>` : ''}
                <dl class="ws-dl"><dt>Submitted</dt><dd>${esc(W.fmtDate(current.submittedAt))}</dd><dt>Last update</dt><dd>${esc(W.fmtDate(current.updatedAt))}</dd>
                  <dt>Location</dt><dd>${esc(current.location)}</dd><dt>Experience</dt><dd>${esc(current.yearsExperience)} years</dd><dt>Availability</dt><dd>${esc(W.label(current.availability))}</dd></dl>
                <p class="bk-fine">${current.canEdit ? 'You can edit your answers until review starts.' : 'Your application is being reviewed, so it can no longer be edited.'}</p>
                <div class="bk-actions">${current.canEdit ? '<button type="button" class="gp-btn gp-btn-primary gp-btn-sm" id="bc-edit">Edit application</button>' : ''}<button type="button" class="gp-btn gp-btn-outline gp-btn-sm" id="bc-withdraw">Withdraw application</button></div>
              </section>`;
            if (current.canEdit) $('bc-edit').addEventListener('click', () => showForm(current));
            if ($('bc-cv-download')) $('bc-cv-download').addEventListener('click', () => GradmireAPI.downloadFile(`/api/v1/me/consultant-application-cv/${current.cvDocumentId}`).catch((e) => W.say(e.message)));
            $('bc-withdraw').addEventListener('click', async () => {
                const ok = await W.dialog({ title: 'Withdraw your application?', text: 'This closes your application. You can apply again later.', confirm: 'Withdraw', danger: true });
                if (!ok) return;
                try {
                    await api('POST', `/api/v1/me/consultant-applications/${current.id}/withdraw`, {});
                    W.say('Your application was withdrawn.', 'ok');
                    load();
                } catch (e) {
                    W.say(e.message);
                }
            });
        }

        async function load() {
            try {
                render(await api('GET', '/api/v1/me/consultant-applications'));
            } catch (e) {
                W.say(e.message);
            }
        }

        $('bc-cancel').addEventListener('click', () => load());
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const f = form.elements;
            const body = {
                fullName: f.fullName.value.trim(), phone: f.phone.value.trim(), location: f.location.value.trim(),
                yearsExperience: f.yearsExperience.value === '' ? undefined : Number(f.yearsExperience.value),
                availability: f.availability.value || undefined, professionalExperience: f.professionalExperience.value.trim(),
                education: f.education.value.trim(), counsellingExperience: f.counsellingExperience.value.trim(),
                languages: listField(f.languages.value), expertise: listField(f.expertise.value),
                cvUrl: f.cvUrl.value.trim(), additionalInfo: f.additionalInfo.value.trim(),
            };
            if (!editing) body.consent = f.consent.checked;
            const button = $('bc-submit');
            button.disabled = true;
            try {
                const cv = f.cvFile.files[0];
                if (cv) {
                    if (cv.size > 4 * 1024 * 1024) throw Object.assign(new Error('Your CV can be at most 4 MB.'), { fields: { cvFile: true } });
                    button.textContent = 'Uploading CV…';
                    const uploaded = await GradmireAPI.uploadFile(`/api/v1/me/consultant-application-cv?filename=${encodeURIComponent(cv.name)}`, cv);
                    body.cvDocumentId = uploaded.id;
                }
                if (editing) await api('PATCH', `/api/v1/me/consultant-applications/${editing.id}`, body);
                else await api('POST', '/api/v1/me/consultant-applications', body);
                W.formErrors(form, error, null);
                W.say(editing ? 'Your application was updated.' : 'Thank you. Your application was submitted.', 'ok');
                load();
            } catch (e) {
                W.formErrors(form, error, e);
            } finally {
                button.disabled = false;
                button.textContent = editing ? 'Save changes' : 'Submit application';
            }
        });
        load();
    }

    /* ── My documents ───────────────────────────────────────────────────── */

    const KIND_LABELS = { transcript: 'Academic transcript', passport: 'Passport', english_test: 'English test score', sop: 'Statement of purpose', recommendation: 'Recommendation letter', financial: 'Financial document', offer_letter: 'Offer letter', cv: 'CV (consultant application)', other: 'Other' };
    const size = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

    async function documentsPage() {
        if (!await W.boot({ allow: ['student'] })) return;
        const form = $('dc-form');
        const error = $('dc-error');
        const rows = $('dc-rows');
        const select = $('dc-request-select');

        async function load() {
            try {
                const data = await api('GET', '/api/v1/me/documents');
                const open = data.requests.filter((r) => r.status === 'open');
                $('dc-requests').innerHTML = data.requests.length ? data.requests.map((r) => `<li><span><strong>${esc(r.title)}</strong>${r.details ? ` <small>${esc(r.details)}</small>` : ''}<small>${r.requestedBy ? `Asked by ${esc(r.requestedBy)}` : ''}${r.dueDate ? ` · due ${esc(W.fmtDate(r.dueDate))}` : ''}</small></span>${r.status === 'open' ? `<button type="button" class="gp-btn gp-btn-primary gp-btn-sm" data-for-request="${esc(r.id)}" data-kind="${esc(r.kind)}">Upload</button>` : W.status('Received', 'good')}</li>`).join('') : '<li class="bk-empty">Nothing has been requested.</li>';
                select.innerHTML = `<option value="">Not for a specific request</option>${open.map((r) => `<option value="${esc(r.id)}">${esc(r.title)}</option>`).join('')}`;
                rows.innerHTML = data.documents.length ? data.documents.map((d) => `<tr><td><strong>${esc(d.filename)}</strong></td><td>${esc(KIND_LABELS[d.kind] || d.kind)}</td><td>${esc(size(d.sizeBytes))}</td><td>${esc(W.fmtDate(d.uploadedAt))}</td>
                    <td><span class="bk-actions"><button type="button" class="gp-btn gp-btn-outline gp-btn-sm" data-download="${esc(d.id)}">Download</button>${d.kind === 'cv' ? '' : `<button type="button" class="gp-btn gp-btn-outline gp-btn-sm" data-delete="${esc(d.id)}" data-name="${esc(d.filename)}">Delete</button>`}</span></td></tr>`).join('') : W.emptyRow(5, 'You have not uploaded any documents yet.');
            } catch (e) {
                if (e.code === 'STORAGE_UNAVAILABLE') form.hidden = true;
                W.say(e.message);
                rows.innerHTML = W.emptyRow(5, e.message);
            }
        }

        $('dc-requests').addEventListener('click', (event) => {
            const button = event.target.closest('[data-for-request]');
            if (!button) return;
            select.value = button.dataset.forRequest;
            if (form.elements.kind.querySelector(`option[value="${button.dataset.kind}"]`)) form.elements.kind.value = button.dataset.kind;
            form.elements.file.focus();
        });
        rows.addEventListener('click', async (event) => {
            const dl = event.target.closest('[data-download]');
            if (dl) {
                GradmireAPI.downloadFile(`/api/v1/me/documents/${dl.dataset.download}/download`).catch((e) => W.say(e.message));
                return;
            }
            const del = event.target.closest('[data-delete]');
            if (!del) return;
            if (!await W.dialog({ title: `Delete ${del.dataset.name}?`, text: 'Your counsellor will no longer be able to open it. If it answered a request, the request opens again.', confirm: 'Delete', danger: true })) return;
            try {
                await api('DELETE', `/api/v1/me/documents/${del.dataset.delete}`);
                W.say('Document deleted.', 'ok');
                load();
            } catch (e) { W.say(e.message); }
        });
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const file = form.elements.file.files[0];
            const kind = form.elements.kind.value;
            if (!kind || !file) {
                W.formErrors(form, error, { message: !kind ? 'Choose the document type.' : 'Choose a file to upload.', fields: { [!kind ? 'kind' : 'file']: true } });
                return;
            }
            if (file.size > 4 * 1024 * 1024) {
                W.formErrors(form, error, { message: 'Files can be at most 4 MB. Try a smaller scan or a PDF.', fields: { file: true } });
                return;
            }
            const button = form.querySelector('[type="submit"]');
            button.disabled = true;
            button.textContent = 'Uploading…';
            try {
                const params = new URLSearchParams({ kind, filename: file.name });
                if (select.value) params.set('request_id', select.value);
                await GradmireAPI.uploadFile(`/api/v1/me/documents?${params}`, file);
                W.formErrors(form, error, null);
                form.reset();
                W.say('Uploaded. Your counsellor can now open it.', 'ok');
                load();
            } catch (e) {
                W.formErrors(form, error, e);
            } finally {
                button.disabled = false;
                button.textContent = 'Upload';
            }
        });
        load();
    }

    /* ── Join the team (invitation) ─────────────────────────────────────── */

    async function joinTeamPage() {
        const box = $('jt-box');
        // Keep the token out of the address bar and out of any login/sign-up URL.
        const fromHash = new URLSearchParams(location.hash.slice(1)).get('token');
        try {
            if (fromHash) sessionStorage.setItem('gm-invite', fromHash);
        } catch (e) { /* storage blocked: keep it in memory only */ }
        let token = fromHash;
        try {
            token = token || sessionStorage.getItem('gm-invite');
        } catch (e) { /* ignore */ }
        if (fromHash) history.replaceState(null, '', location.pathname);
        const session = await GradmireAPI.getSession().catch(() => ({ user: null }));
        const user = session.user;
        let invite;
        try {
            if (token) {
                invite = await api('POST', '/api/v1/employee-invitations/lookup', { token });
            } else if (user) {
                // Opened from the dashboard notification: the account's own pending invitation.
                invite = (await api('GET', '/api/v1/me/employee-invitations/pending')).invitation;
            }
        } catch (e) {
            box.innerHTML = `<p class="bk-alert">${esc(e.message)}</p>`;
            return;
        }
        if (!invite) {
            box.innerHTML = user
                ? '<p>There is no pending invitation for this account. It may have expired or been revoked; ask an administrator to send a new one.</p>'
                : '<p>Open the invitation link from your email, or <a href="login?next=join-team">log in</a> with the invited email address, to continue.</p>';
            return;
        }
        const role = invite.intendedRole === 'admin' ? 'administrator' : 'consultant';
        const intro = `<p>You are invited to join Gradmire as <strong>${esc(invite.jobTitle)}</strong> (${esc(invite.department)}), with ${role} access.</p>
            <p class="bk-fine">The invitation was sent to ${esc(invite.invitedEmail)} and expires ${esc(W.fmtDate(invite.expiresAt))}.</p>`;
        if (!user) {
            box.innerHTML = `${intro}<p>Log in, or create an account, with the email address the invitation was sent to.</p>
                <div class="bk-actions"><a class="gp-btn gp-btn-primary" href="login?next=join-team">Log in</a><a class="gp-btn gp-btn-outline" href="signup?next=join-team">Create an account</a></div>`;
            return;
        }
        if (user.role !== 'student') {
            box.innerHTML = `${intro}<p class="bk-alert bk-alert--info">You are signed in with a staff account. Ask an administrator for a role change instead.</p>`;
            return;
        }
        if (!user.emailVerified) {
            box.innerHTML = `${intro}<p class="bk-alert bk-alert--info">Verify your email address first, then open this page again.</p><button type="button" class="gp-btn gp-btn-outline" id="jt-resend">Send the verification email again</button>`;
            $('jt-resend').addEventListener('click', async () => {
                await api('POST', '/api/v1/auth/verify-email/request', {}).catch(() => {});
                $('jt-resend').replaceWith(Object.assign(document.createElement('p'), { className: 'bk-fine', textContent: 'If our email service is set up, a verification link is on its way.' }));
            });
            return;
        }
        box.innerHTML = `${intro}<p>Signed in as <strong>${esc(user.email)}</strong>.</p><p class="bk-fine">Accepting does not switch on staff access by itself: an administrator approves your onboarding first. Your account, bookings and history stay as they are.</p>
            <p class="bk-alert" id="jt-error" role="alert" hidden></p><div class="bk-actions"><button type="button" class="gp-btn gp-btn-primary" id="jt-accept">Accept the invitation</button></div>`;
        $('jt-accept').addEventListener('click', async () => {
            $('jt-accept').disabled = true;
            try {
                await api('POST', '/api/v1/me/employee-invitations/accept', token ? { token } : {});
                try { sessionStorage.removeItem('gm-invite'); } catch (e) { /* ignore */ }
                box.innerHTML = '<h2 class="bk-step-title">Invitation accepted</h2><p>Your onboarding is now waiting for approval. We will email you and you will see your workspace the next time you log in after it is approved.</p><a class="gp-btn gp-btn-outline" href="dashboard">Back to my dashboard</a>';
            } catch (e) {
                $('jt-error').textContent = e.message;
                $('jt-error').hidden = false;
                $('jt-accept').disabled = false;
            }
        });
    }

    /* ── Find my booking (guests) ───────────────────────────────────────── */

    function findBookingPage() {
        const form = $('fb-form');
        const result = $('fb-result');
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const email = form.elements.email.value.trim();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                result.textContent = 'Enter the email address you booked with.';
                result.className = 'bk-alert';
                result.hidden = false;
                form.elements.email.focus();
                return;
            }
            const button = form.querySelector('[type="submit"]');
            button.disabled = true;
            try {
                const data = await api('POST', '/api/v1/consultations/manage/resend', { email, website: form.elements.website.value });
                result.textContent = data.message;
                result.className = 'bk-alert bk-alert--ok';
            } catch (e) {
                result.textContent = e.message;
                result.className = 'bk-alert';
            } finally {
                result.hidden = false;
                button.disabled = false;
            }
        });
    }

    const PAGES = { 'student-profile': profilePage, notifications: notificationsPage, 'become-consultant': becomeConsultantPage, documents: documentsPage, 'join-team': joinTeamPage, 'find-booking': findBookingPage };
    if (PAGES[page]) PAGES[page]();
    // A link to this same page with a new token (#email-change=… or #token=…) only changes the hash; start over so it is read.
    if (page === 'student-profile' || page === 'join-team') {
        window.addEventListener('hashchange', () => {
            if (/(^|[#&])(email-change|token)=/.test(location.hash)) location.reload();
        });
    }
})();
