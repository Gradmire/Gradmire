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

    async function profilePage() {
        if (!await W.boot({ allow: ['student'] })) return;
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
            form.elements.fullName.focus();
        }

        function render(applications) {
            const current = applications[0];
            form.hidden = true;
            if (!user.emailVerified) {
                box.innerHTML = '<div class="bk-alert bk-alert--info">Verify your email address before applying. Use the link we emailed you, or resend it from <a href="dashboard.html">your dashboard</a>.</div>';
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
                ${current.interviewAt ? `<p>Interview: <strong>${esc(W.fmtDateTime(current.interviewAt))}</strong></p>` : ''}
                <dl class="ws-dl"><dt>Submitted</dt><dd>${esc(W.fmtDate(current.submittedAt))}</dd><dt>Last update</dt><dd>${esc(W.fmtDate(current.updatedAt))}</dd>
                  <dt>Location</dt><dd>${esc(current.location)}</dd><dt>Experience</dt><dd>${esc(current.yearsExperience)} years</dd><dt>Availability</dt><dd>${esc(W.label(current.availability))}</dd></dl>
                <p class="bk-fine">${current.canEdit ? 'You can edit your answers until review starts.' : 'Your application is being reviewed, so it can no longer be edited.'}</p>
                <div class="bk-actions">${current.canEdit ? '<button type="button" class="gp-btn gp-btn-primary gp-btn-sm" id="bc-edit">Edit application</button>' : ''}<button type="button" class="gp-btn gp-btn-outline gp-btn-sm" id="bc-withdraw">Withdraw application</button></div>
              </section>`;
            if (current.canEdit) $('bc-edit').addEventListener('click', () => showForm(current));
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
                if (editing) await api('PATCH', `/api/v1/me/consultant-applications/${editing.id}`, body);
                else await api('POST', '/api/v1/me/consultant-applications', body);
                W.formErrors(form, error, null);
                W.say(editing ? 'Your application was updated.' : 'Thank you. Your application was submitted.', 'ok');
                load();
            } catch (e) {
                W.formErrors(form, error, e);
            } finally {
                button.disabled = false;
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
        if (!token) {
            box.innerHTML = '<p>Open the invitation link from your email to continue.</p>';
            return;
        }
        let invite;
        try {
            invite = await api('POST', '/api/v1/employee-invitations/lookup', { token });
        } catch (e) {
            box.innerHTML = `<p class="bk-alert">${esc(e.message)}</p>`;
            return;
        }
        const role = invite.intendedRole === 'admin' ? 'administrator' : 'consultant';
        const intro = `<p>You are invited to join Gradmire as <strong>${esc(invite.jobTitle)}</strong> (${esc(invite.department)}), with ${role} access.</p>
            <p class="bk-fine">The invitation was sent to ${esc(invite.invitedEmail)} and expires ${esc(W.fmtDate(invite.expiresAt))}.</p>`;
        const session = await GradmireAPI.getSession().catch(() => ({ user: null }));
        const user = session.user;
        if (!user) {
            box.innerHTML = `${intro}<p>Log in, or create an account, with the email address the invitation was sent to.</p>
                <div class="bk-actions"><a class="gp-btn gp-btn-primary" href="login.html?next=join-team.html">Log in</a><a class="gp-btn gp-btn-outline" href="signup.html?next=join-team.html">Create an account</a></div>`;
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
                await api('POST', '/api/v1/me/employee-invitations/accept', { token });
                try { sessionStorage.removeItem('gm-invite'); } catch (e) { /* ignore */ }
                box.innerHTML = '<h2 class="bk-step-title">Invitation accepted</h2><p>Your onboarding is now waiting for approval. We will email you and you will see your workspace the next time you log in after it is approved.</p><a class="gp-btn gp-btn-outline" href="dashboard.html">Back to my dashboard</a>';
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

    const PAGES = { 'student-profile': profilePage, notifications: notificationsPage, 'become-consultant': becomeConsultantPage, 'join-team': joinTeamPage, 'find-booking': findBookingPage };
    if (PAGES[page]) PAGES[page]();
})();
