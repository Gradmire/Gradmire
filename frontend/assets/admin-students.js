/* /admin/students: staff find a student and record their university applications.
   The API scopes results: admins see every student, counsellors only their own. */
(function () {
    'use strict';

    const { esc } = window.GMBooking;
    const $ = (id) => document.getElementById(id);
    const form = $('as-form');
    const LABELS = {
        shortlisted: 'Shortlisted', preparing: 'Preparing application', submitted: 'Submitted', offer_conditional: 'Conditional offer',
        offer_unconditional: 'Unconditional offer', accepted: 'Offer accepted', visa_applied: 'Visa applied', visa_granted: 'Visa granted',
        enrolled: 'Enrolled', rejected: 'Unsuccessful', withdrawn: 'Withdrawn'
    };
    let student = null;
    let applications = [];

    function say(message, ok) {
        const el = $('as-alert');
        el.textContent = message;
        el.className = `bk-alert${ok ? ' bk-alert--ok' : ''}`;
        el.hidden = !message;
    }

    async function search(q) {
        const list = $('as-students');
        list.innerHTML = '<li class="bk-fine">Searching…</li>';
        try {
            const students = await GradmireAPI.request('GET', `/api/v1/admin/students?q=${encodeURIComponent(q)}`);
            list.innerHTML = students.length
                ? students.map((s) => `<li><button type="button" class="as-student" data-id="${esc(s.id)}" data-name="${esc(s.name)}" data-email="${esc(s.email)}"><strong>${esc(s.name)}</strong><span>${esc(s.email)} · ${s.applicationCount} application${s.applicationCount === 1 ? '' : 's'}</span></button></li>`).join('')
                : '<li class="bk-fine">No students found.</li>';
        } catch (error) {
            list.innerHTML = `<li class="bk-fine">${esc(error.message)}</li>`;
        }
    }

    function renderApps() {
        $('as-student-title').textContent = `${student.name} · applications`;
        const rows = applications.map((a) => `<tr>
            <th scope="row">${esc(a.university)}<span>${esc(a.course)}</span></th>
            <td>${esc(LABELS[a.status] || a.status)}</td>
            <td>${esc([a.country, a.intake].filter(Boolean).join(' · ') || '—')}</td>
            <td>${esc(a.deadline || '—')}</td>
            <td class="as-row-actions"><button type="button" class="gp-btn gp-btn-outline gp-btn-sm" data-edit="${esc(a.id)}">Edit</button><button type="button" class="gp-btn gp-btn-danger gp-btn-sm" data-delete="${esc(a.id)}">Delete</button></td>
          </tr>`).join('');
        $('as-apps').innerHTML = `${applications.length
            ? `<div class="gp-table-wrap"><table class="gp-table as-table"><thead><tr><th scope="col">University · course</th><th scope="col">Status</th><th scope="col">Country · intake</th><th scope="col">Deadline</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows}</tbody></table></div>`
            : '<p class="bk-empty">No applications recorded yet.</p>'}
          <p><button type="button" class="gp-btn gp-btn-primary gp-btn-sm" id="as-add">Add an application</button></p>`;
        $('as-add').addEventListener('click', () => openForm());
    }

    async function selectStudent(s) {
        student = s;
        form.hidden = true;
        try {
            applications = await GradmireAPI.request('GET', `/api/v1/admin/students/${s.id}/applications`);
            renderApps();
        } catch (error) {
            say(error.message);
        }
    }

    function openForm(app) {
        form.reset();
        $('as-form-error').hidden = true;
        $('as-form-title').textContent = app ? 'Edit application' : 'Add an application';
        form.elements.id.value = app ? app.id : '';
        if (app) {
            for (const name of ['university', 'course', 'country', 'intake', 'status', 'deadline', 'studentNote']) form.elements[name].value = app[name] || '';
        }
        form.hidden = false;
        form.elements.university.focus();
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(form).entries());
        const id = values.id;
        delete values.id;
        if (!values.university.trim() || !values.course.trim()) {
            $('as-form-error').textContent = 'University and course are required.';
            $('as-form-error').hidden = false;
            return;
        }
        $('as-save').disabled = true;
        try {
            if (id) await GradmireAPI.request('PATCH', `/api/v1/admin/applications/${id}`, values);
            else await GradmireAPI.request('POST', `/api/v1/admin/students/${student.id}/applications`, values);
            say(id ? 'Application updated. The student sees the change on their dashboard.' : 'Application added to the student’s dashboard.', true);
            await selectStudent(student);
        } catch (error) {
            $('as-form-error').textContent = error.message;
            $('as-form-error').hidden = false;
        } finally {
            $('as-save').disabled = false;
        }
    });
    $('as-cancel').addEventListener('click', () => { form.hidden = true; });

    $('as-apps').addEventListener('click', async (event) => {
        const edit = event.target.closest('[data-edit]');
        const del = event.target.closest('[data-delete]');
        if (edit) openForm(applications.find((a) => a.id === edit.dataset.edit));
        if (del) {
            const app = applications.find((a) => a.id === del.dataset.delete);
            if (!window.confirm(`Delete the ${app.university} application? The student will no longer see it.`)) return;
            try {
                await GradmireAPI.request('DELETE', `/api/v1/admin/applications/${app.id}`);
                say('Application deleted.', true);
                await selectStudent(student);
            } catch (error) {
                say(error.message);
            }
        }
    });

    $('as-students').addEventListener('click', (event) => {
        const button = event.target.closest('.as-student');
        if (button) selectStudent({ id: button.dataset.id, name: button.dataset.name, email: button.dataset.email });
    });
    $('as-search').addEventListener('submit', (event) => { event.preventDefault(); search($('as-q').value.trim()); });

    async function init() {
        let session;
        try {
            session = await GradmireAPI.getSession();
        } catch (error) {
            say(error.message);
            return;
        }
        if (!session.user) { location.replace('login.html?next=admin-students.html'); return; }
        if (session.user.role === 'student') { location.replace('dashboard.html'); return; }
        $('as-greeting').textContent = `Signed in as ${session.user.firstName} (${session.user.role}). Students see each application’s status and note on their dashboard.`;
        search('');
    }

    init();
})();
