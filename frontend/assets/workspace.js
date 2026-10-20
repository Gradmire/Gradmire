/* Shared shell for the role workspaces: checks the session, sends people who
   may not use the page to their own home page, draws the sidebar for their role
   and offers small helpers (formatting, alerts, dialogs, form errors, paging).
   Hiding a link is a convenience only; every API endpoint checks permissions. */
(function () {
    'use strict';

    const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const $ = (id) => document.getElementById(id);

    const ROLE_LABELS = { student: 'Student', counsellor: 'Consultant', admin: 'Administrator', super_admin: 'Super administrator' };
    const STUDENT_NAV = [
        ['dashboard.html', 'Overview'], ['dashboard-consultations.html', 'My consultations'], ['dashboard.html#applications', 'My applications'],
        ['find-courses.html', 'Universities and courses'], ['dashboard-documents.html', 'My documents'], ['dashboard-profile.html', 'My profile'], ['dashboard-notifications.html', 'Notifications', 'unread'],
        ['dashboard-become-consultant.html', 'Become a consultant'], ['contact.html', 'Support'],
    ];
    const CONSULTANT_NAV = [
        ['consultant-dashboard.html', 'My workspace'], ['admin-consultations.html', 'Consultations and availability'], ['consultant-students.html', 'Students'],
        ['consultant-leads.html', 'My enquiries'], ['consultant-follow-ups.html', 'Follow-ups'], ['admin-students.html', 'Student applications'],
        ['dashboard-notifications.html', 'Notifications', 'unread'],
    ];
    const ADMIN_NAV = [
        ['admin.html', 'Overview'], ['admin-users.html', 'Users'], ['admin-leads.html', 'Enquiries'], ['admin-consultations.html', 'Consultations'],
        ['admin-team.html', 'Team and hiring'], ['admin-approvals.html', 'Approvals'], ['admin-audit.html', 'Audit log'],
    ];
    const ADMIN_OWN_NAV = [['consultant-dashboard.html', 'My work'], ['consultant-follow-ups.html', 'My follow-ups'], ['dashboard-notifications.html', 'Notifications', 'unread']];

    function navFor(role) {
        if (role === 'student') return [['', STUDENT_NAV]];
        if (role === 'counsellor') return [['', CONSULTANT_NAV]];
        return [['Administration', ADMIN_NAV], ['My work', ADMIN_OWN_NAV]];
    }

    const currentPage = () => location.pathname.split('/').pop() || 'index.html';

    function renderNav(user, unread) {
        const nav = $('ws-nav');
        if (!nav) return;
        const here = currentPage();
        const groups = navFor(user.role).map(([title, links]) => `${title ? `<p class="ws-nav-group">${esc(title)}</p>` : ''}<ul>${links.map(([href, label, badge]) => {
            const active = href === here || (href.split('#')[0] === here && !href.includes('#'));
            const count = badge === 'unread' && unread ? `<span class="ws-count" aria-label="${unread} unread">${unread}</span>` : '';
            return `<li><a href="${esc(href)}"${active ? ' aria-current="page"' : ''}>${esc(label)}${count}</a></li>`;
        }).join('')}</ul>`).join('');
        nav.innerHTML = `<div class="ws-nav-who"><strong>${esc([user.firstName, user.lastName].filter(Boolean).join(' '))}</strong><span>${esc(ROLE_LABELS[user.role] || user.role)}</span></div>${groups}
            <button type="button" class="gp-btn gp-btn-outline gp-btn-sm ws-nav-logout" id="ws-logout">Log out</button>`;
        $('ws-logout').addEventListener('click', async () => {
            await GradmireAPI.logout().catch(() => {});
            location.href = 'login.html';
        });
    }

    function say(message, tone) {
        const el = $('ws-alert');
        if (!el) return;
        el.textContent = message || '';
        el.className = `bk-alert${tone === 'ok' ? ' bk-alert--ok' : tone === 'info' ? ' bk-alert--info' : ''}`;
        el.hidden = !message;
        if (message && tone !== 'ok') el.scrollIntoView({ block: 'nearest' });
    }

    /* Starts a page. allow: roles that may use it. Returns the user, or null after redirecting. */
    async function boot({ allow, nav = true }) {
        let session;
        try {
            session = await GradmireAPI.getSession();
        } catch (error) {
            say(error.message);
            return null;
        }
        const user = session.user;
        if (!user) {
            location.replace(`login.html?next=${encodeURIComponent(currentPage())}`);
            return null;
        }
        if (allow && !allow.includes(user.role)) {
            // Not your page: go to your own workspace without revealing anything here.
            location.replace(user.home || 'dashboard.html');
            return null;
        }
        if (nav) {
            renderNav(user, 0);
            GradmireAPI.request('GET', '/api/v1/me/notifications?unread=true').then((data) => renderNav(user, data.unread)).catch(() => {});
        }
        return user;
    }

    const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
    const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
    const label = (value) => (value ? String(value).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '—');
    const status = (value, tone) => `<span class="ws-status${tone ? ` ws-status--${tone}` : ''}">${esc(label(value))}</span>`;

    /* Shows field errors from an ApiError next to the inputs, plus a summary. */
    function formErrors(form, errorEl, error) {
        form.querySelectorAll('[aria-invalid]').forEach((input) => input.removeAttribute('aria-invalid'));
        if (!error) {
            errorEl.hidden = true;
            return;
        }
        Object.keys(error.fields || {}).forEach((name) => {
            const input = form.elements[name];
            if (input && input.setAttribute) input.setAttribute('aria-invalid', 'true');
        });
        errorEl.textContent = error.message;
        errorEl.hidden = false;
        const first = Object.keys(error.fields || {}).map((name) => form.elements[name]).find((el) => el && el.focus);
        if (first) first.focus();
    }

    /* A modal dialog. fields: [{ name, label, type: 'text'|'textarea'|'select'|'datetime', required, options: [[value, label]] }].
       Resolves with the values, or null when cancelled. */
    function dialog({ title, text = '', fields = [], confirm = 'Confirm', danger = false }) {
        return new Promise((resolve) => {
            const el = document.createElement('dialog');
            el.className = 'bk-modal';
            el.setAttribute('aria-labelledby', 'ws-dialog-title');
            const control = (f) => {
                const attrs = `name="${esc(f.name)}"${f.required ? ' required' : ''}${f.max ? ` maxlength="${f.max}"` : ''}`;
                if (f.type === 'textarea') return `<textarea ${attrs} rows="3"></textarea>`;
                if (f.type === 'select') return `<select ${attrs}>${(f.options || []).map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select>`;
                if (f.type === 'datetime') return `<input type="datetime-local" ${attrs}>`;
                if (f.type === 'date') return `<input type="date" ${attrs}>`;
                return `<input ${attrs}>`;
            };
            el.innerHTML = `<form method="dialog" novalidate><div class="bk-modal-body"><h2 id="ws-dialog-title">${esc(title)}</h2>${text ? `<p class="bk-help">${esc(text)}</p>` : ''}
                ${fields.map((f) => `<label class="gp-field"><span>${esc(f.label)}${f.required ? '' : ' <em>(optional)</em>'}</span>${control(f)}</label>`).join('')}
                <p class="bk-alert" role="alert" hidden></p></div>
                <div class="bk-modal-foot"><button type="button" class="gp-btn gp-btn-outline" value="cancel">Cancel</button><button type="submit" class="gp-btn ${danger ? 'gp-btn-outline' : 'gp-btn-primary'}" value="ok">${esc(confirm)}</button></div></form>`;
            document.body.appendChild(el);
            const form = el.querySelector('form');
            const finish = (value) => {
                el.close();
                el.remove();
                resolve(value);
            };
            el.querySelector('[value="cancel"]').addEventListener('click', () => finish(null));
            el.addEventListener('cancel', (event) => {
                event.preventDefault();
                finish(null);
            });
            form.addEventListener('submit', (event) => {
                event.preventDefault();
                const missing = fields.find((f) => f.required && !String(form.elements[f.name].value).trim());
                if (missing) {
                    const alert = form.querySelector('.bk-alert');
                    alert.textContent = `${missing.label} is required.`;
                    alert.hidden = false;
                    form.elements[missing.name].focus();
                    return;
                }
                const values = {};
                fields.forEach((f) => {
                    const raw = form.elements[f.name].value.trim();
                    values[f.name] = f.type === 'datetime' && raw ? new Date(raw).toISOString() : raw;
                });
                finish(values);
            });
            el.showModal();
        });
    }

    /* Drawer open/close with focus return and Escape. */
    function drawer(id) {
        const el = $(id);
        let opener = null;
        const close = () => {
            el.hidden = true;
            if (opener && opener.focus) opener.focus();
        };
        el.querySelector('[data-close-drawer]').addEventListener('click', close);
        el.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') close();
        });
        return {
            open(title, sub = '') {
                opener = document.activeElement;
                $(`${id}-title`).textContent = title;
                $(`${id}-sub`).textContent = sub;
                el.hidden = false;
                el.querySelector('[data-close-drawer]').focus();
            },
            close,
            body: $(`${id}-body`),
            get isOpen() { return !el.hidden; },
        };
    }

    /* Paged table helper: pager('us', load) wires Previous/Next and the count. */
    function pager(prefix, load) {
        const state = { page: 1, pageSize: 25, total: 0 };
        $(`${prefix}-prev`).addEventListener('click', () => {
            if (state.page > 1) { state.page -= 1; load(); }
        });
        $(`${prefix}-next`).addEventListener('click', () => {
            if (state.page * state.pageSize < state.total) { state.page += 1; load(); }
        });
        return {
            state,
            update(data) {
                state.total = data.total;
                const from = data.total ? (data.page - 1) * data.pageSize + 1 : 0;
                $(`${prefix}-count`).textContent = `${from}–${Math.min(data.page * data.pageSize, data.total)} of ${data.total}`;
                $(`${prefix}-prev`).disabled = data.page <= 1;
                $(`${prefix}-next`).disabled = data.page * data.pageSize >= data.total;
            },
            reset() { state.page = 1; },
        };
    }

    /* Query string from a filter form, skipping empty values. */
    function formQuery(form, extra = {}) {
        const params = new URLSearchParams();
        new FormData(form).forEach((value, key) => {
            if (String(value).trim()) params.set(key, String(value).trim());
        });
        Object.entries(extra).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') params.set(key, value);
        });
        return params.toString();
    }

    const emptyRow = (cols, text) => `<tr><td colspan="${cols}">${esc(text)}</td></tr>`;

    window.GMWorkspace = { boot, say, esc, fmtDate, fmtDateTime, label, status, formErrors, dialog, drawer, pager, formQuery, emptyRow, ROLE_LABELS };
})();
