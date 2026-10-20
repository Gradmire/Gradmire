/* /dashboard: the signed-in student's journey, applications (recorded by their
   counsellor) and next consultation. Everything comes from the API, which only
   ever returns this student's own records. */
(function () {
    'use strict';

    const { esc, formatWhen, badge: consultationBadge } = window.GMBooking;
    const $ = (id) => document.getElementById(id);

    const APP_STATUS = {
        shortlisted: ['Shortlisted', 'neutral'], preparing: ['Preparing application', 'progress'], submitted: ['Submitted', 'progress'],
        offer_conditional: ['Conditional offer', 'good'], offer_unconditional: ['Unconditional offer', 'good'], accepted: ['Offer accepted', 'good'],
        visa_applied: ['Visa applied', 'progress'], visa_granted: ['Visa granted', 'good'], enrolled: ['Enrolled', 'good'],
        rejected: ['Unsuccessful', 'bad'], withdrawn: ['Withdrawn', 'neutral']
    };
    const STAGE_ORDER = ['account', 'consultation', 'counselled', 'applying', 'offer', 'visa', 'enrolled'];
    const OFFER = ['offer_conditional', 'offer_unconditional', 'accepted', 'visa_applied', 'visa_granted', 'enrolled'];
    const VISA = ['visa_applied', 'visa_granted', 'enrolled'];

    function say(message, ok) {
        const el = $('sd-alert');
        el.textContent = message;
        el.className = `bk-alert${ok ? ' bk-alert--ok' : ''}`;
        el.hidden = !message;
    }

    /* The furthest stage reached, from consultations and applications. */
    function reachedStage(consultations, applications) {
        const statuses = applications.map((a) => a.status);
        if (statuses.includes('enrolled')) return 'enrolled';
        if (statuses.some((s) => VISA.includes(s))) return 'visa';
        if (statuses.some((s) => OFFER.includes(s))) return 'offer';
        if (statuses.some((s) => ['preparing', 'submitted'].includes(s))) return 'applying';
        if (consultations.some((c) => c.status === 'completed') || applications.length) return 'counselled';
        if (consultations.some((c) => !['cancelled', 'rescheduled'].includes(c.status))) return 'consultation';
        return 'account';
    }

    function renderJourney(stage) {
        const index = STAGE_ORDER.indexOf(stage);
        document.querySelectorAll('.sd-stage').forEach((li) => {
            const i = STAGE_ORDER.indexOf(li.dataset.stage);
            const state = i < index ? 'done' : i === index ? 'current' : 'todo';
            li.dataset.state = state;
            if (state === 'current') li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
            li.querySelector('.sd-stage-state').textContent = state === 'done' ? ' (done)' : state === 'current' ? ' (current step)' : '';
        });
        const next = {
            account: 'Next step: book a free consultation so a counsellor can plan your options.',
            consultation: 'Next step: attend your consultation. Your counsellor will then shortlist universities with you.',
            counselled: 'Next step: your counsellor will start preparing applications with you.',
            applying: 'Your applications are in progress. Watch for notes from your counsellor below.',
            offer: 'Congratulations on your offer. Next comes accepting it and preparing your visa.',
            visa: 'Your visa is in progress. We will help you plan travel and arrival.',
            enrolled: 'You are enrolled. Wishing you a great start to your studies.'
        }[stage];
        $('sd-journey-summary').textContent = next;
    }

    function daysLeft(date) {
        const end = new Date(`${date}T23:59:59`);
        return Math.ceil((end - new Date()) / 86400000);
    }

    function renderApplications(applications) {
        const box = $('sd-apps');
        if (!applications.length) {
            box.innerHTML = `<div class="bk-empty-state"><h3>No applications yet</h3><p>After your consultation, your counsellor adds the universities you apply to here, so you can follow each one’s status.</p><a class="gp-btn gp-btn-primary" href="find-courses.html">Explore courses</a></div>`;
            return;
        }
        box.innerHTML = applications.map((a) => {
            const [label, tone] = APP_STATUS[a.status] || [a.status, 'neutral'];
            const left = a.deadline ? daysLeft(a.deadline) : null;
            const deadline = a.deadline
                ? `<span class="sd-deadline${left !== null && left <= 14 && left >= 0 ? ' is-soon' : ''}">Deadline ${esc(new Date(`${a.deadline}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }))}${left !== null ? ` · ${left < 0 ? 'passed' : left === 0 ? 'today' : `${left} day${left === 1 ? '' : 's'} left`}` : ''}</span>`
                : '';
            return `<article class="sd-app">
              <div class="sd-app-head"><h3>${esc(a.university)}</h3><span class="sd-status sd-status--${tone}">${esc(label)}</span></div>
              <p class="sd-app-course">${esc(a.course)}${a.country || a.intake ? ` · ${esc([a.country, a.intake].filter(Boolean).join(' · '))}` : ''}</p>
              ${deadline}
              ${a.studentNote ? `<p class="sd-note"><strong>From your counsellor:</strong> ${esc(a.studentNote)}</p>` : ''}
              <p class="sd-updated">Updated ${esc(new Date(a.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }))}</p>
            </article>`;
        }).join('');
    }

    function renderNext(consultations) {
        const upcoming = consultations
            .filter((c) => ['reserved', 'confirmed'].includes(c.status) && new Date(c.end) > new Date())
            .sort((a, b) => new Date(a.start) - new Date(b.start))[0];
        $('sd-next').innerHTML = upcoming
            ? `<p class="sd-next-type">${esc(upcoming.type.name)} ${consultationBadge(upcoming.status)}</p>
               <p>${esc(formatWhen(upcoming.start, upcoming.end, upcoming.timezone))}</p>
               <p>With ${esc(upcoming.counsellor.name)}${upcoming.meetingUrl ? ` · <a href="${esc(upcoming.meetingUrl)}" target="_blank" rel="noopener noreferrer">Join meeting</a>` : ''}</p>
               <a class="gp-btn gp-btn-outline gp-btn-sm" href="dashboard-consultations.html">Manage consultations</a>`
            : `<p class="bk-fine">No consultation booked.</p><a class="gp-btn gp-btn-primary gp-btn-sm" href="book-consultation.html">Book a free consultation</a>`;
    }

    async function init() {
        let session;
        try {
            session = await GradmireAPI.getSession();
        } catch (error) {
            $('sd-greeting').textContent = error.message;
            return;
        }
        const user = session.user;
        if (!user) {
            location.replace('login.html?next=dashboard.html');
            return;
        }
        if (user.role !== 'student') {
            location.replace('admin-students.html');
            return;
        }
        $('sd-title').textContent = `Hi ${user.firstName}`;
        $('sd-greeting').textContent = `Signed in as ${user.email}.`;
        const logout = $('sd-logout');
        logout.hidden = false;
        logout.addEventListener('click', async () => {
            await GradmireAPI.logout().catch(() => {});
            location.href = 'login.html';
        });
        if (!user.emailVerified) {
            const verify = $('sd-verify');
            verify.innerHTML = 'Please verify your email address. <button type="button" class="crm-open" id="sd-resend">Send the verification email again</button>';
            verify.hidden = false;
            $('sd-resend').addEventListener('click', async () => {
                try {
                    await GradmireAPI.request('POST', '/api/v1/auth/verify-email/request', {});
                    verify.textContent = 'If our email service is set up, a new verification link is on its way. It expires in 48 hours.';
                } catch (error) {
                    verify.textContent = error.message;
                }
            });
        }
        const [consultations, applications] = await Promise.all([
            GradmireAPI.request('GET', '/api/v1/me/consultations').catch((error) => { say(error.message); return []; }),
            GradmireAPI.request('GET', '/api/v1/me/applications').catch((error) => { say(error.message); return []; })
        ]);
        renderJourney(reachedStage(consultations, applications));
        renderApplications(applications);
        renderNext(consultations);
    }

    init();
})();
