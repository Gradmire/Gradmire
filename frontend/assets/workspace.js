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
        ['dashboard', 'Overview'], ['dashboard-consultations', 'My consultations'], ['dashboard#applications', 'My applications'],
        ['find-courses', 'Universities and courses'], ['dashboard-documents', 'My documents'], ['dashboard-profile', 'My profile'], ['dashboard-notifications', 'Notifications', 'unread'],
        ['dashboard-become-consultant', 'Become a consultant'], ['contact', 'Support'],
    ];
    const CONSULTANT_NAV = [
        ['consultant-dashboard', 'My workspace'], ['admin-consultations', 'Consultations and availability'], ['consultant-students', 'Students'],
        ['consultant-leads', 'My enquiries'], ['consultant-follow-ups', 'Follow-ups'], ['admin-students', 'Student applications'],
        ['dashboard-notifications', 'Notifications', 'unread'],
    ];
    const ADMIN_NAV = [
        ['admin', 'Overview'], ['admin-users', 'Users'], ['admin-leads', 'Enquiries'], ['admin-consultations', 'Consultations'],
        ['admin-team', 'Team and hiring'], ['admin-approvals', 'Approvals'], ['admin-audit', 'Audit log'],
    ];
    const ADMIN_OWN_NAV = [['consultant-dashboard', 'My work'], ['consultant-follow-ups', 'My follow-ups'], ['dashboard-notifications', 'Notifications', 'unread']];

    function navFor(role) {
        if (role === 'student') return [['', STUDENT_NAV]];
        if (role === 'counsellor') return [['', CONSULTANT_NAV]];
        return [['Administration', ADMIN_NAV], ['My work', ADMIN_OWN_NAV]];
    }

    const currentPage = () => (location.pathname.split('/').pop() || 'index').replace(/\.html$/, '');

    /* The four pages each role uses most, shown as tabs in the bottom bar on phones (the rest are under "More"). */
    const TAB_ICONS = {
        home: '<path d="M3.5 11.2 12 4l8.5 7.2V19a1.5 1.5 0 0 1-1.5 1.5h-4v-5.5h-6v5.5H5A1.5 1.5 0 0 1 3.5 19z"/>',
        calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M8.5 3.5v4M15.5 3.5v4M4 10h16"/>',
        clipboard: '<rect x="5" y="4.5" width="14" height="16" rx="2.5"/><path d="M9 4.5h6M9 11l2 2 4-4M9 16.5h6"/>',
        bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
        users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.8a3.2 3.2 0 0 1 0 5.4M18 14.5a5.5 5.5 0 0 1 2.5 4.5"/>',
        inbox: '<path d="M4 13l2.2-7.5h11.6L20 13v5.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z"/><path d="M4 13h4.5l1 2.5h5l1-2.5H20"/>',
        clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
        more: '<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>'
    };
    const TABS = {
        student: [['dashboard', 'Overview', 'home'], ['dashboard-consultations', 'Meetings', 'calendar'], ['dashboard#applications', 'Applications', 'clipboard'], ['dashboard-notifications', 'Alerts', 'bell', 'unread']],
        counsellor: [['consultant-dashboard', 'Workspace', 'home'], ['consultant-students', 'Students', 'users'], ['consultant-leads', 'Enquiries', 'inbox'], ['consultant-follow-ups', 'Follow-ups', 'clock']],
        admin: [['admin', 'Overview', 'home'], ['admin-users', 'Users', 'users'], ['admin-leads', 'Enquiries', 'inbox'], ['admin-consultations', 'Meetings', 'calendar']]
    };
    const tabsFor = (role) => TABS[role] || TABS.admin;
    const tabIcon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${TAB_ICONS[name]}</svg>`;

    /* The sidebar's links, shared by the sidebar (laptops and tablets) and the "More" sheet (phones). */
    function navGroups(user, unread) {
        const here = currentPage();
        return navFor(user.role).map(([title, links]) => `${title ? `<p class="ws-nav-group">${esc(title)}</p>` : ''}<ul>${links.map(([href, label, badge]) => {
            const active = href === here || (href.split('#')[0] === here && !href.includes('#'));
            const count = badge === 'unread' && unread ? `<span class="ws-count" aria-label="${unread} unread">${unread}</span>` : '';
            return `<li><a href="${esc(href)}"${active ? ' aria-current="page"' : ''}>${esc(label)}${count}</a></li>`;
        }).join('')}</ul>`).join('');
    }

    async function logOut() {
        await GradmireAPI.logout().catch(() => {});
        location.href = 'login';
    }

    /* Phones: a bottom tab bar (the four main pages and "More") plus a sheet with every link and Log out.
       The sidebar is hidden there (workspace.css). */
    let tabState = null;
    function renderTabs(user, unread) {
        tabState = { user, unread };
        const who =`<div class="ws-nav-who"><strong>${esc([user.firstName, user.lastName].filter(Boolean).join(' '))}</strong><span>${esc(ROLE_LABELS[user.role] || user.role)}</span></div>`;
        let bar = $('ws-tabbar');
        let sheet = $('ws-sheet');
        if (!bar) {
            bar = document.createElement('nav');
            bar.id = 'ws-tabbar';
            bar.className = 'ws-tabbar';
            bar.setAttribute('aria-label', 'Workspace tabs');
            document.body.appendChild(bar);
            sheet = document.createElement('div');
            sheet.id = 'ws-sheet';
            sheet.className = 'ws-sheet';
            sheet.hidden = true;
            document.body.appendChild(sheet);
            const setSheet = (open) => {
                sheet.hidden = !open;
                $('ws-more')?.setAttribute('aria-expanded', String(open));
                document.documentElement.classList.toggle('ws-sheet-open', open);
                if (open) sheet.querySelector('a, button')?.focus();
            };
            bar.addEventListener('click', (event) => {
                if (event.target.closest('#ws-more')) setSheet(sheet.hidden);
            });
            sheet.addEventListener('click', (event) => {
                if (event.target === sheet || event.target.closest('[data-ws-close]') || event.target.closest('a')) setSheet(false);
                if (event.target.closest('#ws-sheet-logout')) logOut();
            });
            document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !sheet.hidden) { setSheet(false); $('ws-more')?.focus(); } });
            /* "Overview" and "Applications" are the same page with and without #applications. */
            window.addEventListener('hashchange', () => { if (tabState) renderTabs(tabState.user, tabState.unread); });
        }
        const here = currentPage();
        const hash = location.hash;
        bar.innerHTML = `${tabsFor(user.role).map(([href, label, icon, badge]) => {
            const [path, anchor] = href.split('#');
            const active = path === here && (anchor ? hash === `#${anchor}` : !hash || hash !== '#applications');
            const count = badge === 'unread' && unread ? `<span class="ws-tab-count" aria-label="${unread} unread">${unread > 9 ? '9+' : unread}</span>` : '';
            return `<a class="ws-tab" href="${esc(href)}"${active ? ' aria-current="page"' : ''}>${tabIcon(icon)}<span>${esc(label)}</span>${count}</a>`;
        }).join('')}<button type="button" class="ws-tab" id="ws-more" aria-expanded="${sheet.hidden ? 'false' : 'true'}" aria-controls="ws-sheet">${tabIcon('more')}<span>More</span></button>`;
        sheet.innerHTML = `<div class="ws-sheet-card" role="dialog" aria-label="All pages">${who}${navGroups(user, unread)}<button type="button" class="gp-btn gp-btn-outline gp-btn-sm ws-sheet-logout" id="ws-sheet-logout">Log out</button><button type="button" class="ws-sheet-close" data-ws-close aria-label="Close menu">Close</button></div>`;
    }

    function renderNav(user, unread) {
        renderTabs(user, unread);
        const nav = $('ws-nav');
        if (!nav) return;
        nav.innerHTML = `<div class="ws-nav-who"><strong>${esc([user.firstName, user.lastName].filter(Boolean).join(' '))}</strong><span>${esc(ROLE_LABELS[user.role] || user.role)}</span></div>${navGroups(user, unread)}
            <button type="button" class="gp-btn gp-btn-outline gp-btn-sm ws-nav-logout" id="ws-logout">Log out</button>`;
        $('ws-logout').addEventListener('click', logOut);
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
            location.replace(`login?next=${encodeURIComponent(currentPage())}`);
            return null;
        }
        if (allow && !allow.includes(user.role)) {
            // Not your page: go to your own workspace without revealing anything here.
            location.replace(user.home || 'dashboard');
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
