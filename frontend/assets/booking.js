/* /book-consultation: choose a type, a slot and enter details. Availability
   comes from the API and is re-checked by the server when the booking is made. */
(function () {
    'use strict';

    const { esc, METHOD_LABELS, formatWhen, createSlotPicker, downloadIcs, googleCalendarUrl, meetingLine } = window.GMBooking;
    const form = document.getElementById('bk-form');
    const typesEl = document.getElementById('bk-types');
    const methodsEl = document.getElementById('bk-methods');
    const errorEl = document.getElementById('bk-error');
    const submit = document.getElementById('bk-submit');
    const summary = { type: document.getElementById('bk-sum-type'), when: document.getElementById('bk-sum-when'), method: document.getElementById('bk-sum-method') };
    let types = [];
    let user = null;
    // One key per attempt: a retried or double-clicked submit cannot create two bookings.
    let idempotencyKey = GradmireAPI.newIdempotencyKey();

    const selectedType = () => types.find((t) => t.id === (form.querySelector('input[name="type"]:checked') || {}).value);
    const selectedMethod = () => (form.querySelector('input[name="meetingMethod"]:checked') || {}).value;

    const picker = createSlotPicker({
        dates: document.getElementById('bk-dates'),
        slots: document.getElementById('bk-slots'),
        tz: document.getElementById('bk-tz'),
        onSelect: () => {
            idempotencyKey = GradmireAPI.newIdempotencyKey();
            updateSummary();
        },
    });

    function updateSummary() {
        const type = selectedType();
        summary.type.textContent = type ? `${type.name} · ${type.durationMinutes} min` : 'Not chosen yet';
        summary.when.textContent = picker.slot ? formatWhen(picker.slot.start, picker.slot.end, picker.zone) : 'Not chosen yet';
        summary.method.textContent = METHOD_LABELS[selectedMethod()] || '—';
    }

    function renderMethods(type) {
        const current = selectedMethod();
        methodsEl.innerHTML = type.meetingMethods.map((m, i) => `<label class="bk-pill"><input type="radio" name="meetingMethod" value="${m}"${(current ? current === m : i === 0) ? ' checked' : ''}>${esc(METHOD_LABELS[m] || m)}</label>`).join('');
        if (!methodsEl.querySelector('input:checked')) methodsEl.querySelector('input').checked = true;
    }

    function renderTypes() {
        const wanted = new URLSearchParams(location.search).get('type');
        typesEl.innerHTML = types.map((t, i) => `<label class="bk-choice"><input type="radio" name="type" value="${t.id}"${(wanted ? wanted === t.slug : i === 0) ? ' checked' : ''}>
            <span class="bk-meta">${t.durationMinutes} min · ${t.meetingMethods.map((m) => METHOD_LABELS[m]).join(' / ')}</span>
            <strong>${esc(t.name)}</strong><span>${esc(t.description)}</span></label>`).join('');
        if (!typesEl.querySelector('input:checked') && types[0]) typesEl.querySelector('input').checked = true;
        const type = selectedType();
        if (type) {
            renderMethods(type);
            picker.setType(type.id);
        }
        updateSummary();
    }

    function fillIntakes() {
        const select = document.getElementById('bk-intake');
        const now = new Date();
        const options = [];
        for (let year = now.getFullYear(); options.length < 6 && year < now.getFullYear() + 4; year += 1) {
            for (const month of ['January', 'May', 'September']) {
                const index = ['January', 'May', 'September'].indexOf(month) * 4;
                if (year === now.getFullYear() && index <= now.getMonth()) continue;
                if (options.length < 6) options.push(`${month} ${year}`);
            }
        }
        options.push('Not sure yet');
        select.insertAdjacentHTML('beforeend', options.map((o) => `<option>${esc(o)}</option>`).join(''));
    }

    function showFieldErrors(fields) {
        form.querySelectorAll('[data-error-for]').forEach((el) => {
            const message = fields[el.dataset.errorFor];
            el.hidden = !message;
            el.textContent = message || '';
        });
        form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
        const map = { fullName: 'fullName', email: 'email', phone: 'phoneNumber', message: 'message', contactConsent: 'contactConsent' };
        let first = null;
        Object.keys(fields).forEach((name) => {
            const input = form.elements[map[name] || name];
            if (input && input.setAttribute) {
                input.setAttribute('aria-invalid', 'true');
                first = first || input;
            }
        });
        return first;
    }

    function validate() {
        const fields = {};
        if (!selectedType()) fields.type = 'Choose a consultation type';
        if (!picker.slot) fields.start = 'Choose a time';
        if (!user) {
            const name = form.elements.fullName.value.trim();
            if (name.length < 2) fields.fullName = 'Enter your full name';
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.elements.email.value.trim())) fields.email = 'Enter a valid email address';
        }
        const digits = form.elements.phoneNumber.value.replace(/[\s().-]/g, '');
        if (!user || !user.phone || digits) {
            if (!/^\d{6,14}$/.test(digits.replace(/^0+/, ''))) fields.phone = 'Enter your phone number (digits only, without the country code)';
        }
        if (!form.elements.contactConsent.checked) fields.contactConsent = 'Please agree so we can contact you about this consultation';
        return fields;
    }

    function phoneValue() {
        const digits = form.elements.phoneNumber.value.replace(/[\s().-]/g, '').replace(/^0+/, '');
        return digits ? `${form.elements.phoneCode.value}${digits}` : undefined;
    }

    function showDone(result) {
        const c = result.consultation;
        const flow = document.getElementById('bk-flow');
        const done = document.getElementById('bk-done');
        const confirmed = c.status === 'confirmed';
        const manageLink = result.manageToken ? `manage-consultation.html#token=${encodeURIComponent(result.manageToken)}` : null;
        done.innerHTML = `<div class="bk-done-icon" aria-hidden="true">${confirmed ? '✓' : '⏳'}</div>
            <h2>${confirmed ? 'Your consultation is booked' : 'Your slot is reserved'}</h2>
            <p>${confirmed
                ? `We have saved your booking. A confirmation will be sent to <strong>${esc(c.studentEmail)}</strong> once our email service delivers it.`
                : 'We are holding this time for you while we finish creating the calendar invite. You will receive an email as soon as it is confirmed.'}</p>
            <dl>
              <dt>Reference</dt><dd>${esc(c.reference)}</dd>
              <dt>Consultation</dt><dd>${esc(c.type.name)}</dd>
              <dt>When</dt><dd>${esc(formatWhen(c.start, c.end, c.timezone))}</dd>
              <dt>How</dt><dd>${esc(METHOD_LABELS[c.meetingMethod])}</dd>
              <dt>Counsellor</dt><dd>${esc(c.counsellor.name)}</dd>
              <dt>Meeting</dt><dd>${meetingLine(c)}</dd>
            </dl>
            <p class="bk-fine">Need to change it? You can reschedule or cancel up to 24 hours before the start.</p>
            <div class="bk-actions">
              ${c.status !== 'cancelled' ? '<button type="button" class="gp-btn gp-btn-outline" id="bk-ics">Add to calendar (.ics)</button>' : ''}
              <a class="gp-btn gp-btn-outline" href="${esc(googleCalendarUrl(c))}" target="_blank" rel="noopener noreferrer">Add to Google Calendar</a>
              ${user ? '<a class="gp-btn gp-btn-primary" href="dashboard-consultations.html">View in my dashboard</a>' : manageLink ? `<a class="gp-btn gp-btn-primary" href="${esc(manageLink)}">Manage this booking</a>` : ''}
            </div>
            ${user ? '' : '<p class="bk-fine">Bookmark the manage link — it is also in your email. To see bookings in a dashboard, <a href="signup.html">create an account</a> with this same email and verify it.</p>'}
            ${result.replayed ? '<p class="bk-fine">This booking was already saved from an earlier attempt; we did not create a second one.</p>' : ''}`;
        flow.hidden = true;
        done.hidden = false;
        const ics = document.getElementById('bk-ics');
        if (ics) ics.addEventListener('click', () => downloadIcs(c));
        done.focus();
        window.scrollTo({ top: done.offsetTop - 90, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }

    form.addEventListener('change', (event) => {
        if (event.target.name === 'type') {
            const type = selectedType();
            renderMethods(type);
            picker.setType(type.id);
            idempotencyKey = GradmireAPI.newIdempotencyKey();
        }
        updateSummary();
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorEl.hidden = true;
        const fields = validate();
        const first = showFieldErrors(fields);
        if (Object.keys(fields).length) {
            errorEl.textContent = Object.values(fields)[0];
            errorEl.hidden = false;
            (first || errorEl).focus();
            return;
        }
        const payload = {
            consultationTypeId: selectedType().id,
            meetingMethod: selectedMethod(),
            start: picker.slot.start,
            timezone: picker.zone,
            phone: phoneValue(),
            destination: form.elements.destination.value || undefined,
            degree: form.elements.degree.value || undefined,
            course: form.elements.course.value.trim() || undefined,
            intake: form.elements.intake.value || undefined,
            academicSummary: form.elements.academicSummary.value.trim() || undefined,
            message: form.elements.message.value.trim() || undefined,
            contactConsent: form.elements.contactConsent.checked,
            remindersOptIn: form.elements.remindersOptIn.checked,
            marketingOptIn: form.elements.marketingOptIn.checked,
            website: form.elements.website.value || undefined,
        };
        if (!user) {
            payload.fullName = form.elements.fullName.value.trim();
            payload.email = form.elements.email.value.trim();
        }
        submit.disabled = true;
        submit.textContent = 'Booking…';
        try {
            const result = await GradmireAPI.request('POST', '/api/v1/consultations', payload, { 'Idempotency-Key': idempotencyKey });
            showDone(result);
        } catch (error) {
            showFieldErrors(error.fields || {});
            errorEl.textContent = error.message;
            errorEl.hidden = false;
            errorEl.focus();
            if (error.code === 'SLOT_UNAVAILABLE') {
                idempotencyKey = GradmireAPI.newIdempotencyKey();
                picker.refresh();
            }
        } finally {
            submit.disabled = false;
            submit.textContent = 'Confirm booking';
        }
    });
    errorEl.tabIndex = -1;

    async function init() {
        fillIntakes();
        try {
            const session = await GradmireAPI.getSession();
            user = session.user && session.user.role === 'student' ? session.user : null;
        } catch (e) {
            user = null;
        }
        if (user) {
            const box = document.getElementById('bk-signed-in');
            box.innerHTML = `<span>Booking as <strong>${esc([user.firstName, user.lastName].filter(Boolean).join(' '))}</strong> (${esc(user.email)})</span>${user.phone ? `<span>Phone ${esc(user.phone)}</span>` : ''}`;
            box.hidden = false;
            document.getElementById('bk-contact').querySelectorAll('label').forEach((label) => {
                const input = label.querySelector('input[name="fullName"], input[name="email"]');
                if (input) {
                    label.hidden = true;
                    input.required = false;
                }
            });
            if (user.phone) {
                const phone = form.elements.phoneNumber;
                phone.required = false;
                phone.placeholder = 'Leave empty to use your account number';
            }
            document.getElementById('bk-account-note').textContent = 'This booking will appear in your dashboard.';
        }
        try {
            types = await GradmireAPI.request('GET', '/api/v1/consultation-types');
            if (!types.length) {
                typesEl.innerHTML = '<p class="bk-empty">Online booking is not open right now. Please <a href="free-consultation.html">send a request</a> and we will call you.</p>';
                return;
            }
            renderTypes();
            picker.selectFirstDate();
        } catch (error) {
            typesEl.innerHTML = `<p class="bk-empty">${esc(error.message)} You can also <a href="free-consultation.html">send a request</a> instead.</p>`;
        }
    }

    init();
})();
