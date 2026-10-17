(() => {
    const root = document.documentElement;
    /* Strobi, the study buddy: @bible-strong/avatar-web (AGPL-3.0) renders the definition below. */
    const AVATAR_WEB_URL = 'https://cdn.jsdelivr.net/npm/@bible-strong/avatar-web@0.1.0/+esm';
    const ASSETS_URL = new URL('./', document.currentScript?.src || window.location.href).href;
    const AVATAR_DEFINITION_URL = new URL('avatar/strobi.avatar.json', ASSETS_URL).href;

    /* ── Consent: essential storage always; "preferences" and "analytics" only with opt-in.
       The choice itself is essential (it has to be remembered to be respected). ── */
    const CONSENT_KEY = 'gm-consent';
    const CONSENT_VERSION = 1;
    const PREF_KEYS = ['gradmire-theme', 'gm-consult-popup-dismissed'];
    function readConsent() {
        try {
            const c = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null');
            return c && c.v === CONSENT_VERSION ? c : null;
        } catch (_) { return null; }
    }
    const allows = (category) => Boolean(readConsent()?.[category]);
    /* Preference values live in localStorage only with consent; otherwise for this tab only. */
    function savePref(key, value) {
        try { (allows('preferences') ? localStorage : sessionStorage).setItem(key, value); } catch (_) {}
    }
    function readPref(key) {
        try { return (allows('preferences') ? localStorage.getItem(key) : null) ?? sessionStorage.getItem(key); } catch (_) { return null; }
    }
    function writeConsent(choice) {
        const record = { v: CONSENT_VERSION, necessary: true, preferences: Boolean(choice.preferences), analytics: Boolean(choice.analytics), ts: new Date().toISOString() };
        try { localStorage.setItem(CONSENT_KEY, JSON.stringify(record)); } catch (_) {}
        if (!record.preferences) PREF_KEYS.forEach((key) => { try { localStorage.removeItem(key); } catch (_) {} });
        window.dispatchEvent(new CustomEvent('gm:consent', { detail: record }));
        return record;
    }
    /* Hook for any future analytics loader: load only when gradmireConsent.allows('analytics'). */
    window.gradmireConsent = { get: readConsent, allows, set: writeConsent };
    const isToolPage = /\/tools\//.test(window.location.pathname);
    const pagePrefix = isToolPage ? '../' : '';
    const page = (name) => `${pagePrefix}${name}`;
    const chevron = '<svg class="nav-dropdown-chevron" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m2.25 4.5 3.75 3 3.75-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    const destinations = [
        ['United Kingdom', 'uk'], ['United States', 'usa'], ['Canada', 'canada'],
        ['Australia', 'australia'], ['Germany', 'germany'], ['Ireland', 'ireland'],
        ['Italy', 'italy'], ['New Zealand', 'newzealand'], ['Finland', 'finland']
    ];
    const mbbsCountries = [
        ['Russia', 'russia'], ['China', 'china'], ['Georgia', 'georgia'], ['Egypt', 'egypt'],
        ['Uzbekistan', 'uzbekistan'], ['Kazakhstan', 'kazakhstan'], ['Kyrgyzstan', 'kyrgyzstan'],
        ['Bulgaria', 'bulgaria'], ['Moldova', 'moldova']
    ];
    const countryPage = (slug) => page(`study-in-${slug}.html`);
    const scholarshipPage = (slug) => `${page('scholarships.html')}?country=${encodeURIComponent(slug)}`;
    const consultationPage = (interest, country = '') => `${page('free-consultation.html')}?interest=${encodeURIComponent(interest)}${country ? `&country=${encodeURIComponent(country)}` : ''}`;
    const link = (href, label) => `<a href="${href}" role="menuitem">${label.replace(/&/g, '&amp;')}</a>`;
    const dropdown = (label, items, extraClass = '') => `
      <li class="nav-dropdown ${extraClass}">
        <button type="button" aria-expanded="false" aria-haspopup="true">${label} ${chevron}</button>
        <div class="nav-dropdown-menu" role="menu">${items}</div>
      </li>`;

    const courseCategories = [
        ['Business & Management', 'Business and Management'],
        ['Creative Arts, Design & Media', 'Creative Arts, Design and Media'],
        ['Engineering & Technology', 'Engineering and Technology'],
        ['Medicine & Health', 'Medicine and Health'],
        ['Science', 'Science'],
        ['Social Sciences & Humanities', 'Social Sciences and Humanities'],
        ['Tourism & Hospitality', 'Tourism and Hospitality']
    ];
    const studentServices = [
        ['Gradmire free counselling', 'counselling'], ['Test preparation', 'test-preparation'],
        ['Visa assistance', 'visa-assistance'], ['Application assistance', 'application-support'],
        ['Course selection guidance', 'course-selection']
    ];
    const navItems = [
        dropdown('Destinations', `<span class="nav-dropdown-label">Study destinations</span>${destinations.map(([name, slug]) => link(countryPage(slug), name)).join('')}${link(page('destinations.html'), 'All destinations →')}`),
        dropdown('Courses', `<span class="nav-dropdown-label">Explore study areas</span>${courseCategories.map(([label, query]) => link(`${page('find-courses.html')}?course=${encodeURIComponent(query)}`, label)).join('')}${link(page('find-courses.html'), 'Course Finder →')}`),
        dropdown('MBBS Abroad', `<span class="nav-dropdown-label">Countries to explore</span>${mbbsCountries.map(([name, slug]) => link(consultationPage('mbbs-abroad', slug), name)).join('')}${link(consultationPage('mbbs-abroad'), 'Ask about MBBS abroad →')}`),
        dropdown('Student Services', `${studentServices.map(([label, interest]) => link(consultationPage(interest), label)).join('')}`),
        dropdown('Scholarships', `<span class="nav-dropdown-label">Explore by country</span>${destinations.map(([name, slug]) => link(scholarshipPage(slug), `Scholarships in ${name}`)).join('')}${link(page('scholarships.html'), 'All scholarships →')}`),
        dropdown('Student Tools', `${link(page('find-courses.html'), 'Course Finder')}${link(page('tools/roi-calculator.html'), 'Study cost calculator')}${link(page('tools/comparator.html'), 'Course comparator')}${link(page('tools/deadline-tracker.html'), 'Deadline tracker')}${link(page('tools/grade-converter.html'), 'GPA / CGPA / SGPA converter')}`)
    ];

    function icon(kind) {
        if (kind === 'moon') return '<svg class="moon-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.2 15.5A8.5 8.5 0 0 1 8.5 3.8 8.5 8.5 0 1 0 20.2 15.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
        return '<svg class="sun-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3.5" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    }

    function applyTheme(theme) {
        root.dataset.theme = theme;
        const toggle = document.querySelector('.site-theme-toggle');
        if (!toggle) return;
        toggle.setAttribute('aria-pressed', theme === 'dark');
        toggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to day mode' : 'Switch to night mode');
        toggle.title = toggle.getAttribute('aria-label');
    }

    function setupThemeToggle() {
        if (document.querySelector('.site-theme-toggle')) return;
        const toggle = document.createElement('button');
        toggle.className = 'site-theme-toggle';
        toggle.type = 'button';
        toggle.innerHTML = `${icon('sun')}${icon('moon')}`;
        toggle.addEventListener('click', () => {
            const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
            savePref('gradmire-theme', next);
            applyTheme(next);
        });
        const navInner = document.querySelector('.nav-inner');
        const hamburger = navInner?.querySelector('.nav-ham');
        if (navInner) navInner.insertBefore(toggle, hamburger || null);
    }

    function setupDropdowns(scope, mobile = false) {
        scope.querySelectorAll('.nav-dropdown').forEach((item) => {
            const button = item.querySelector(':scope > button');
            const menu = item.querySelector(':scope > .nav-dropdown-menu');
            if (!button || !menu) return;
            button.addEventListener('click', () => {
                const isOpen = item.classList.toggle('is-open');
                button.setAttribute('aria-expanded', String(isOpen));
                if (mobile) menu.classList.toggle('show', isOpen);
            });
            item.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    item.classList.remove('is-open');
                    menu.classList.remove('show');
                    button.setAttribute('aria-expanded', 'false');
                    button.focus();
                }
            });
        });
    }

    function setupNavigation() {
        const nav = document.querySelector('.nav');
        const navInner = nav?.querySelector('.nav-inner');
        if (!nav || !navInner) return;
        if (!navInner.querySelector('.nav-ham')) {
            const ham = document.createElement('button');
            ham.className = 'nav-ham';
            ham.type = 'button';
            ham.setAttribute('aria-label', 'Open menu');
            ham.setAttribute('aria-expanded', 'false');
            ham.innerHTML = '<svg width="22" height="16" viewBox="0 0 22 16" fill="none" aria-hidden="true"><rect y="0" width="22" height="2" rx="1" fill="currentColor"/><rect y="7" width="22" height="2" rx="1" fill="currentColor"/><rect y="14" width="22" height="2" rx="1" fill="currentColor"/></svg>';
            navInner.appendChild(ham);
        }
        const desktop = nav.querySelector('.nav-links');
        if (desktop) desktop.innerHTML = navItems.join('');

        let mobile = document.querySelector('.nav-mobile');
        if (!mobile) {
            mobile = document.createElement('div');
            mobile.className = 'nav-mobile';
            mobile.setAttribute('aria-label', 'Mobile navigation');
            nav.insertAdjacentElement('afterend', mobile);
        }
        mobile.innerHTML = `<ul class="nav-mobile-links" role="list">${navItems.join('')}
          <li><a href="${page('free-consultation.html')}" class="btn btn-primary">Book free consultation</a></li>
        </ul>`;
        mobile.id = mobile.id || 'mobile-nav';
        mobile.setAttribute('role', 'navigation');
        mobile.setAttribute('aria-label', 'Mobile navigation');
        mobile.setAttribute('aria-hidden', 'true');
        mobile.setAttribute('inert', '');
        setupDropdowns(nav, false);
        setupDropdowns(mobile, true);

        const ham = nav.querySelector('.nav-ham');
        ham.setAttribute('aria-controls', mobile.id);
        ham.setAttribute('aria-expanded', 'false');
        const setMobileOpen = (open, restoreFocus = false) => {
            mobile.classList.toggle('is-open', open);
            ham.classList.toggle('is-open', open);
            mobile.setAttribute('aria-hidden', String(!open));
            if (open) mobile.removeAttribute('inert');
            else mobile.setAttribute('inert', '');
            ham.setAttribute('aria-expanded', String(open));
            ham.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
            document.body.classList.toggle('nav-open', open);
            if (open) {
                let attempts = 0;
                const focusFirstVisible = () => {
                    if (!mobile.classList.contains('is-open')) return;
                    const firstVisible = [...mobile.querySelectorAll('a[href], button:not([disabled])')]
                        .find((element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility === 'visible');
                    if (firstVisible) firstVisible.focus();
                    else if (attempts++ < 15) window.setTimeout(focusFirstVisible, 20);
                };
                window.setTimeout(focusFirstVisible, 0);
            }
            else if (restoreFocus) ham.focus();
        };
        ham.addEventListener('click', () => {
            const opening = !mobile.classList.contains('is-open');
            setMobileOpen(opening, !opening);
        });
        mobile.addEventListener('click', (event) => {
            if (event.target.closest('a')) setMobileOpen(false);
        });
        mobile.addEventListener('keydown', (event) => {
            if (event.key !== 'Tab' || !mobile.classList.contains('is-open')) return;
            const focusable = [...mobile.querySelectorAll('a[href], button:not([disabled])')]
                .filter((element) => element.getClientRects().length > 0);
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && mobile.classList.contains('is-open')) {
                setMobileOpen(false, true);
            }
        });
        document.addEventListener('click', (event) => {
            if (mobile.classList.contains('is-open') && !nav.contains(event.target) && !mobile.contains(event.target)) setMobileOpen(false);
            if (!nav.contains(event.target)) {
                nav.querySelectorAll('.nav-dropdown.is-open').forEach((item) => {
                    item.classList.remove('is-open');
                    item.querySelector('button')?.setAttribute('aria-expanded', 'false');
                });
            }
        });
    }

    /* Logo sliders: continuous drift with a cloned set for a seamless loop, prev/next
       buttons, and native swipe. Pauses on hover, focus, touch and when off-screen. */
    function setupLogoSliders() {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        document.querySelectorAll('[data-logo-slider]').forEach((slider) => {
            const viewport = slider.querySelector('.logo-slider-viewport');
            const track = slider.querySelector('.logo-slider-track');
            const originals = track ? [...track.children] : [];
            if (!viewport || originals.length < 2) return;

            originals.forEach((item) => {
                const clone = item.cloneNode(true);
                clone.setAttribute('aria-hidden', 'true');
                clone.querySelector('img')?.setAttribute('alt', '');
                track.appendChild(clone);
            });

            let loopWidth = 0;
            const measure = () => { loopWidth = track.children[originals.length].offsetLeft - track.children[0].offsetLeft; };
            measure();
            new ResizeObserver(measure).observe(track);

            let pos = 0, last = 0, resumeAt = 0, hovering = false, focused = false, visible = true;
            const hold = (ms = 2600) => { resumeAt = performance.now() + ms; };
            const wrapTo = (value) => (loopWidth > 0 ? ((value % loopWidth) + loopWidth) % loopWidth : value);
            const step = () => (originals[0].getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0)) * (window.innerWidth < 641 ? 1 : 2);

            viewport.addEventListener('scroll', () => {
                if (Math.abs(viewport.scrollLeft - pos) <= 2) return;
                pos = viewport.scrollLeft;
                if (loopWidth > 0 && pos >= loopWidth) { pos -= loopWidth; viewport.scrollLeft = pos; }
            }, { passive: true });

            const go = (direction) => {
                hold();
                const distance = step();
                if (direction > 0 && pos + distance >= loopWidth) { pos -= loopWidth; viewport.scrollLeft = pos; }
                if (direction < 0 && pos - distance < 0) { pos += loopWidth; viewport.scrollLeft = pos; }
                viewport.scrollBy({ left: direction * distance, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
            };
            slider.querySelectorAll('.logo-slider-btn').forEach((button) => {
                button.hidden = false;
                button.addEventListener('click', () => go(button.classList.contains('logo-slider-btn--prev') ? -1 : 1));
            });
            viewport.addEventListener('keydown', (event) => {
                if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                    event.preventDefault();
                    go(event.key === 'ArrowRight' ? 1 : -1);
                }
            });

            slider.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') hovering = true; });
            slider.addEventListener('pointerleave', () => { hovering = false; });
            slider.addEventListener('focusin', () => { focused = true; });
            slider.addEventListener('focusout', () => { focused = false; });
            viewport.addEventListener('touchstart', () => hold(1e9), { passive: true });
            viewport.addEventListener('touchend', () => hold(), { passive: true });
            viewport.addEventListener('wheel', () => hold(), { passive: true });
            new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(slider);

            const speed = () => (window.innerWidth < 641 ? 26 : 38);
            (function tick(now) {
                const dt = Math.min(now - (last || now), 64) / 1000;
                last = now;
                if (visible && !hovering && !focused && !document.hidden && !reducedMotion.matches && now >= resumeAt && loopWidth > 0) {
                    pos = wrapTo(pos + speed() * dt);
                    viewport.scrollLeft = pos;
                }
                requestAnimationFrame(tick);
            })(performance.now());
        });
    }

    /* Mobile sliders: card groups marked .m-slider become swipe rows under 640px (CSS);
       this adds the position dots and keeps them in sync. */
    function setupMobileSliders() {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        document.querySelectorAll('.m-slider').forEach((slider) => {
            const items = [...slider.children];
            if (items.length < 2) return;
            /* While it scrolls sideways (phones), the row must be reachable by keyboard. */
            const phone = window.matchMedia('(max-width: 640px)');
            const syncFocus = () => {
                if (phone.matches) { slider.tabIndex = 0; slider.setAttribute('role', 'region'); }
                else { slider.removeAttribute('tabindex'); slider.removeAttribute('role'); }
            };
            syncFocus();
            phone.addEventListener?.('change', syncFocus);
            const dots = document.createElement('div');
            dots.className = 'm-slider-dots';
            const offsetOf = (item) => item.getBoundingClientRect().left - slider.getBoundingClientRect().left - (parseFloat(getComputedStyle(slider).scrollPaddingLeft) || 0);
            const buttons = items.map((item, index) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'm-slider-dot';
                button.setAttribute('aria-label', `Show item ${index + 1} of ${items.length}`);
                button.addEventListener('click', () => {
                    slider.scrollBy({ left: offsetOf(item), behavior: reducedMotion.matches ? 'auto' : 'smooth' });
                });
                dots.appendChild(button);
                return button;
            });
            slider.after(dots);

            let frame = 0;
            const sync = () => {
                frame = 0;
                let current = 0, best = Infinity;
                items.forEach((item, index) => {
                    const distance = Math.abs(offsetOf(item));
                    if (distance < best) { best = distance; current = index; }
                });
                if (slider.scrollLeft + slider.clientWidth >= slider.scrollWidth - 4) current = items.length - 1;
                buttons.forEach((button, index) => button.setAttribute('aria-current', index === current ? 'true' : 'false'));
            };
            slider.addEventListener('scroll', () => { if (!frame) frame = requestAnimationFrame(sync); }, { passive: true });
            sync();
        });
    }

    /* Consultation popup: a split card (student photo + short lead form) that opens once per
       session after 12s, 45% scroll or exit intent, plus a floating button to reopen it.
       Details are handed to the booking page through sessionStorage, never the URL. */
    function setupConsultPopup() {
        const pageName = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
        const skip = ['login.html', 'signup.html', 'free-consultation.html', 'dashboard.html', 'contact.html', '404.html', 'grievance.html', 'privacy.html', 'terms.html'];
        if (skip.includes(pageName)) return;

        const store = (kind) => { try { return window[kind]; } catch (_) { return null; } };
        const session = store('sessionStorage');
        const read = (s, key) => { try { return s ? s.getItem(key) : null; } catch (_) { return null; } };
        const write = (s, key, value) => { try { if (s) s.setItem(key, value); } catch (_) {} };
        const DISMISS_DAYS = 3;
        const recentlyDismissed = Number(readPref('gm-consult-popup-dismissed') || 0) > Date.now() - DISMISS_DAYS * 864e5;
        const photo = 'https://images.unsplash.com/photo-1728141123512-87c415cecc9d?auto=format&fit=crop&w=640&h=820&q=80';
        const options = destinations.map(([name, slug]) => `<option value="${slug}">${name}</option>`).join('');

        const popup = document.createElement('div');
        popup.className = 'gm-popup';
        popup.hidden = true;
        popup.innerHTML = `
          <div class="gm-popup-backdrop" data-popup-close></div>
          <div class="gm-popup-card" role="dialog" aria-modal="true" aria-labelledby="gm-popup-title" aria-describedby="gm-popup-sub">
            <button type="button" class="gm-popup-close" data-popup-close aria-label="Close">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
            </button>
            <div class="gm-popup-media">
              <img src="${photo}" alt="Smiling student looking forward to studying abroad" loading="lazy">
              <p class="gm-popup-media-badge"><strong>47,000+</strong> students placed at universities worldwide</p>
            </div>
            <div class="gm-popup-body">
              <p class="gm-popup-eyebrow"><span aria-hidden="true"></span>Free 1:1 counselling</p>
              <h2 class="gm-popup-title" id="gm-popup-title">Plan your study-abroad journey with an expert.</h2>
              <p class="gm-popup-sub" id="gm-popup-sub">Share a few details and a Gradmire counsellor will call you within 24 hours. No fees, no obligation.</p>
              <form class="gm-popup-form" novalidate>
                <label class="gm-popup-field"><span>Full name</span><input name="name" type="text" autocomplete="name" placeholder="Your name" required></label>
                <label class="gm-popup-field"><span>Phone number</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+91 98765 43210" required></label>
                <label class="gm-popup-field"><span>Email <em>(optional)</em></span><input name="email" type="email" autocomplete="email" placeholder="you@example.com"></label>
                <label class="gm-popup-field"><span>Where do you want to study?</span><select name="destination"><option value="">Not sure yet</option>${options}</select></label>
                <p class="gm-popup-error" role="alert" hidden></p>
                <button type="submit" class="gm-popup-submit">Book my free consultation <span aria-hidden="true">→</span></button>
                <p class="gm-popup-fine">You'll confirm your details and consent on the next step. Under 18? Please ask a parent or guardian first. <a href="${page('privacy.html')}">Privacy policy</a></p>
              </form>
            </div>
          </div>`;
        document.body.appendChild(popup);

        const fab = document.createElement('button');
        fab.type = 'button';
        fab.className = 'gm-consult-fab';
        fab.setAttribute('aria-haspopup', 'dialog');
        fab.innerHTML = `<img src="${photo.replace('w=640&h=820', 'w=96&h=96')}" alt="" width="40" height="40" loading="lazy"><span><strong>Free counselling</strong><span>Talk to an expert</span></span>`;
        document.body.appendChild(fab);

        const card = popup.querySelector('.gm-popup-card');
        const form = popup.querySelector('form');
        const error = popup.querySelector('.gm-popup-error');
        let lastFocus = null;
        let autoDone = false;

        const focusables = () => [...card.querySelectorAll('button, input, select, a[href]')].filter((el) => !el.disabled && el.offsetParent !== null);
        function open(auto) {
            if (!popup.hidden || (auto && autoDone)) return;
            if (auto) {
                const active = document.activeElement;
                if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return;
                if (document.querySelector('.nav-mobile.is-open, .nav-mobile[aria-hidden="false"]')) return;
            }
            autoDone = true;
            write(session, 'gm-consult-popup-shown', '1');
            lastFocus = document.activeElement;
            popup.hidden = false;
            document.documentElement.classList.add('gm-popup-open');
            requestAnimationFrame(() => popup.classList.add('is-visible'));
            setTimeout(() => form.querySelector('input')?.focus({ preventScroll: true }), 60);
        }
        function close() {
            if (popup.hidden) return;
            savePref('gm-consult-popup-dismissed', String(Date.now()));
            popup.classList.remove('is-visible');
            document.documentElement.classList.remove('gm-popup-open');
            setTimeout(() => { popup.hidden = true; }, 220);
            lastFocus?.focus?.({ preventScroll: true });
        }

        window.__gmOpenPopup = open;
        fab.addEventListener('click', () => open(false));
        popup.querySelectorAll('[data-popup-close]').forEach((el) => el.addEventListener('click', close));
        popup.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') { event.preventDefault(); close(); return; }
            if (event.key !== 'Tab') return;
            const items = focusables();
            const first = items[0];
            const last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        });

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(form).entries());
            const problems = [];
            if (!String(data.name || '').trim()) problems.push('your name');
            if (String(data.phone || '').replace(/[^\d]/g, '').length < 10) problems.push('a valid phone number');
            if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email).trim())) problems.push('a valid email or leave it blank');
            form.querySelectorAll('input').forEach((input) => input.removeAttribute('aria-invalid'));
            if (problems.length) {
                error.hidden = false;
                error.textContent = `Please add ${problems.join(', ')}.`;
                const bad = !String(data.name || '').trim() ? form.elements.name : (String(data.phone || '').replace(/[^\d]/g, '').length < 10 ? form.elements.phone : form.elements.email);
                bad.setAttribute('aria-invalid', 'true');
                bad.focus();
                return;
            }
            write(session, 'gradmire-consult-prefill', JSON.stringify({
                name: String(data.name).trim(), phone: String(data.phone).trim(),
                email: String(data.email || '').trim(), destination: data.destination || ''
            }));
            window.location.href = `${page('free-consultation.html')}?interest=counselling${data.destination ? `&country=${encodeURIComponent(data.destination)}` : ''}#book`;
        });

        /* Auto-open: once per session, and not again for a few days after a dismissal. */
        if (read(session, 'gm-consult-popup-shown') || recentlyDismissed) return;
        /* Never stack the popup on top of the cookie banner: start the timers once a choice is made. */
        if (!readConsent()) {
            window.addEventListener('gm:consent', armAutoOpen, { once: true });
            return;
        }
        armAutoOpen();
    }

    /* Strobi, the study buddy: a standalone companion (bottom-left) rendered by
       @bible-strong/avatar-web from avatar/strobi.avatar.json. It reacts to what the visitor
       does: clicks, typing, a field filled in right or wrong, form submits, idling, reaching
       the footer. Animations come from the definition; the inline SVG is only a fallback. */
    function buddySvg() {
        return `<svg class="gm-buddy-fallback" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <circle cx="32" cy="32" r="28" fill="#5b7fe5"/>
          <ellipse cx="22" cy="17" rx="9" ry="4.5" fill="#fff" opacity=".28"/>
          <ellipse class="gm-buddy-eye" cx="26" cy="31" rx="3.2" ry="7.6" fill="#111316"/>
          <ellipse class="gm-buddy-eye" cx="38" cy="31" rx="3.2" ry="7.6" fill="#111316"/>
        </svg>`;
    }

    function setupBuddy() {
        const pageName = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
        if (pageName === 'dashboard.html') return;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
        let session = null;
        try { session = window.sessionStorage; } catch (_) {}
        const sessionGet = (key) => { try { return session?.getItem(key); } catch (_) { return null; } };
        const sessionSet = (key, value) => { try { session?.setItem(key, value); } catch (_) {} };

        const wrap = document.createElement('div');
        wrap.className = 'gm-buddy';
        wrap.innerHTML = `
          <div class="gm-buddy-bubble" role="status" aria-live="polite" hidden>
            <p class="gm-buddy-text"></p>
            <div class="gm-buddy-actions" hidden></div>
            <button type="button" class="gm-buddy-close" aria-label="Dismiss message"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>
          </div>
          <button type="button" class="gm-buddy-avatar" aria-label="Strobi, your study-abroad buddy. Show a tip">${buddySvg()}</button>`;
        document.body.appendChild(wrap);

        const button = wrap.querySelector('.gm-buddy-avatar');
        const bubble = wrap.querySelector('.gm-buddy-bubble');
        const text = wrap.querySelector('.gm-buddy-text');
        const actions = wrap.querySelector('.gm-buddy-actions');

        /* ── Animation state: a resting "base" plus short reactions that fall back to it. ── */
        let live = null;
        let base = pageName === '404.html' ? 'sad' : 'idle';
        let current = base;
        let reactionTimer = 0;
        const show = (animation) => {
            current = animation;
            wrap.dataset.mood = animation;
            live?.play(animation);
        };
        function setBase(animation) {
            base = animation;
            if (!reactionTimer) show(animation);
        }
        function react(animation, ms = 1600) {
            clearTimeout(reactionTimer);
            show(animation);
            reactionTimer = setTimeout(() => { reactionTimer = 0; show(base); }, ms);
        }
        show(base);

        /* ── Speech bubble ── */
        let bubbleTimer = 0;
        function say(message, { ms = 4200, cta = false } = {}) {
            clearTimeout(bubbleTimer);
            text.textContent = message;
            actions.hidden = !cta;
            actions.innerHTML = cta ? '<button type="button" class="gm-buddy-cta">Talk to a counsellor</button>' : '';
            bubble.hidden = false;
            requestAnimationFrame(() => bubble.classList.add('is-visible'));
            if (ms) bubbleTimer = setTimeout(hush, ms);
        }
        function hush() {
            clearTimeout(bubbleTimer);
            bubble.classList.remove('is-visible');
            setTimeout(() => { if (!bubble.classList.contains('is-visible')) bubble.hidden = true; }, 250);
        }
        wrap.querySelector('.gm-buddy-close').addEventListener('click', hush);
        actions.addEventListener('click', (event) => {
            if (!event.target.closest('.gm-buddy-cta')) return;
            hush();
            if (window.__gmOpenPopup) window.__gmOpenPopup(false);
            else window.location.href = page('free-consultation.html');
        });

        /* ── Load the real avatar; keep the SVG if the CDN or JSON is unavailable. ── */
        Promise.all([
            import(AVATAR_WEB_URL),
            fetch(AVATAR_DEFINITION_URL).then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
        ]).then(([{ createAvatar }, definition]) => {
            const mount = document.createElement('span');
            mount.className = 'gm-buddy-live';
            mount.setAttribute('aria-hidden', 'true');
            live = createAvatar(mount, { definition, defaultAnimation: current, size: '100%', onError: () => {} });
            mount.querySelector('.bs-avatar')?.removeAttribute('role');
            button.querySelector('.gm-buddy-fallback')?.replaceWith(mount);
        }).catch((error) => { console.warn('[Gradmire] Strobi fell back to the inline SVG:', error.message); });

        /* ── The buddy itself ── */
        const tips = [
            'Tip: shortlist courses by subject first, then compare countries.',
            'Public universities in Germany charge little or no tuition.',
            'Most UK master’s degrees take just one year.',
            'Start scholarship applications 9–12 months before your intake.',
            'Our counsellors can review your SOP for free.'
        ];
        let tipIndex = Math.floor(Math.random() * tips.length);
        button.addEventListener('click', () => {
            react('laughing', 2200);
            say(tips[tipIndex++ % tips.length], { ms: 7000, cta: true });
        });
        button.addEventListener('pointerenter', () => { if (!reactionTimer) react('playful', 1800); });

        /* ── Fields: listen while focused, work while typing, judge on leaving the field. ── */
        const isField = (el) => el && el.matches?.('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]), textarea, select');
        const ownField = (el) => el.closest?.('.gm-buddy');
        let typingTimer = 0;
        document.addEventListener('focusin', (event) => {
            if (isField(event.target) && !ownField(event.target)) setBase('listening');
        });
        document.addEventListener('focusout', (event) => {
            if (!isField(event.target) || ownField(event.target)) return;
            setTimeout(() => { if (!isField(document.activeElement)) setBase(pageName === '404.html' ? 'sad' : 'idle'); }, 0);
            judge(event.target);
        });
        document.addEventListener('input', (event) => {
            if (!isField(event.target) || ownField(event.target)) return;
            clearTimeout(typingTimer);
            if (current !== 'working') show('working');
            typingTimer = setTimeout(() => { if (!reactionTimer) show(base); }, 900);
        });

        const labelOf = (field) => {
            const label = field.labels?.[0]?.textContent || field.getAttribute('aria-label') || field.placeholder || field.name || 'this field';
            return label.replace(/\(optional\)|\*/gi, '').trim().replace(/\s+/g, ' ').toLowerCase();
        };
        function fieldProblem(field) {
            const value = String(field.value || '').trim();
            if (!value) return null; // empty: no verdict until submit
            if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'That email doesn’t look right. Check for a typo.';
            if (field.type === 'tel' && value.replace(/\D/g, '').length < 10) return 'A phone number needs at least 10 digits.';
            if (!field.checkValidity()) return field.validationMessage || `Please check ${labelOf(field)}.`;
            return '';
        }
        const praise = ['Looks good!', 'Perfect.', 'Got it!', 'Nice, that’s right.'];
        let praiseIndex = 0;
        let lastPraise = 0;
        function judge(field) {
            const problem = fieldProblem(field);
            if (problem === null) return;
            if (problem) {
                react('confused', 2600);
                say(problem, { ms: 4200 });
                return;
            }
            react('happy', 1500);
            /* Praise in words only now and then, so a long form doesn't turn into chatter. */
            if (Date.now() - lastPraise > 8000) { lastPraise = Date.now(); say(praise[praiseIndex++ % praise.length], { ms: 1800 }); }
        }

        /* ── Page scripts mark errors with aria-invalid or role="alert"; mirror those. ── */
        new MutationObserver((records) => {
            for (const record of records) {
                const el = record.target;
                if (ownField(el)) continue;
                if (record.attributeName === 'aria-invalid' && el.getAttribute('aria-invalid') === 'true') {
                    react('sad', 2600);
                    return;
                }
                if (record.attributeName === 'hidden' && el.matches('[role="alert"]') && !el.hidden && el.textContent.trim()) {
                    react('sad', 2800);
                    say(el.textContent.trim(), { ms: 4500 });
                    return;
                }
            }
        }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['aria-invalid', 'hidden'] });

        /* ── Submits: celebrate a clean form, commiserate when the page reports a problem. ── */
        document.addEventListener('submit', (event) => {
            const form = event.target;
            if (ownField(form)) return;
            setTimeout(() => {
                const invalid = form.querySelector('[aria-invalid="true"]') || [...form.querySelectorAll('input, textarea, select')].some((f) => !f.disabled && !f.checkValidity());
                const alert = [...form.querySelectorAll('[role="alert"]')].find((el) => !el.hidden && el.textContent.trim());
                if (invalid || alert) {
                    react('sad', 2800);
                    if (!alert) say('Something’s missing. Check the highlighted fields.', { ms: 4200 });
                } else {
                    react('celebrate', 3200);
                    say('Great, that’s on its way!', { ms: 2600 });
                }
            }, 0);
        }, true);

        /* ── Clicks anywhere else: a quick, light reaction. ── */
        document.addEventListener('click', (event) => {
            const target = event.target.closest?.('a, button, [role="button"], summary, label');
            if (!target || ownField(target) || target.closest('form')) return;
            if (target.matches('.site-theme-toggle, [data-theme-toggle]')) { react('surprised', 1400); return; }
            if (target.matches('.btn-primary, .nav-btn, .gm-consult-fab, [class*="cta"]')) { react('excited', 1800); return; }
            if (target.matches('summary, .faq-q, [aria-expanded]')) { react('curious', 1500); return; }
            react(Math.random() < .5 ? 'happy' : 'curious', 1200);
        });

        /* ── Idle: bored after 40s, drowsy after 90s; any activity wakes it with a start. ── */
        let idleTimer = 0;
        let drowsyTimer = 0;
        let resting = false;
        function wake() {
            clearTimeout(idleTimer);
            clearTimeout(drowsyTimer);
            if (resting) { resting = false; setBase(pageName === '404.html' ? 'sad' : 'idle'); react('surprised', 1200); }
            idleTimer = setTimeout(() => { resting = true; setBase('bored'); }, 40000);
            drowsyTimer = setTimeout(() => { resting = true; setBase('drowsy'); }, 90000);
        }
        ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((type) => window.addEventListener(type, wake, { passive: true }));
        wake();

        /* ── Reaching the footer once: point at the newsletter box. ── */
        const footer = document.querySelector('footer.footer, .footer');
        if (footer && 'IntersectionObserver' in window) {
            const io = new IntersectionObserver((entries) => {
                if (!entries.some((e) => e.isIntersecting)) return;
                io.disconnect();
                react('proud', 2200);
                if (document.querySelector('.footer-subscribe') && !sessionGet('gm-buddy-footer')) {
                    sessionSet('gm-buddy-footer', '1');
                    say('You made it to the end! Leave your email for study-abroad updates.', { ms: 5000 });
                }
            }, { threshold: .25 });
            io.observe(footer);
        }

        /* ── Hello, once per session; tailored on destination pages and the 404 page. ── */
        if (!sessionGet('gm-buddy-greeted')) {
            setTimeout(() => {
                if (root.classList.contains('gm-popup-open') || root.classList.contains('gm-consent-open')) return;
                sessionSet('gm-buddy-greeted', '1');
                const country = pageName.match(/^study-in-([a-z-]+)\.html$/)?.[1];
                const match = country && destinations.find(([, slug]) => slug === country);
                const message = pageName === '404.html'
                    ? 'Oops, this page went missing. Let’s get you back on track.'
                    : match
                        ? `Hi, I’m Strobi! Thinking about studying in ${match[0]}? Tap me for tips.`
                        : 'Hi, I’m Strobi! I’ll keep you company while you explore. Tap me for tips.';
                if (!reduced.matches) react('excited', 2600);
                say(message, { ms: 6500 });
            }, 3500);
        }
    }

    /* Footer email box: subscribes the address as a "newsletter" lead. The leads client
       (api.js) is only on some pages, so it is loaded on first use. */
    function loadApi() {
        if (window.GradmireAPI) return Promise.resolve(window.GradmireAPI);
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = new URL('api.js', ASSETS_URL).href;
            script.onload = () => (window.GradmireAPI ? resolve(window.GradmireAPI) : reject(new Error('API unavailable')));
            script.onerror = () => reject(new Error('API unavailable'));
            document.head.appendChild(script);
        });
    }

    function setupFooterSubscribe() {
        document.querySelectorAll('.footer-subscribe').forEach((form) => {
            const input = form.querySelector('input[type="email"]');
            const button = form.querySelector('button[type="submit"]');
            const msg = form.querySelector('.footer-subscribe-msg');
            const note = `Occasional study-abroad updates by email. Unsubscribe anytime. <a href="${page('privacy.html')}">Privacy</a>`;
            const status = (html, kind = '') => {
                msg.innerHTML = html;
                msg.className = `footer-subscribe-msg${kind ? ` is-${kind}` : ''}`;
                msg.hidden = false;
            };
            input.addEventListener('focus', () => { if (msg.hidden) status(note); });
            input.addEventListener('input', () => {
                if (input.getAttribute('aria-invalid') === 'true') { input.removeAttribute('aria-invalid'); status(note); }
            });
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                const email = input.value.trim();
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    input.setAttribute('aria-invalid', 'true');
                    status(email ? 'That email doesn’t look right.' : 'Please enter your email.', 'error');
                    input.focus();
                    return;
                }
                button.disabled = true;
                try {
                    const api = await loadApi();
                    await api.submitLead({ source: 'newsletter', email, newsletterOptIn: true });
                    form.reset();
                    status('You’re subscribed. Watch your inbox!', 'success');
                } catch (error) {
                    input.setAttribute('aria-invalid', 'true');
                    status('Couldn’t subscribe right now. Please try again in a moment.', 'error');
                } finally {
                    button.disabled = false;
                }
            });
        });
    }

    function armAutoOpen() {
        const popup = document.querySelector('.gm-popup');
        if (!popup || window.__gmPopupArmed) return;
        window.__gmPopupArmed = true;
        const open = (auto) => window.__gmOpenPopup?.(auto);
        setTimeout(() => open(true), 12000);
        const onScroll = () => {
            const depth = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
            if (depth > 0.45) { window.removeEventListener('scroll', onScroll); open(true); }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        document.addEventListener('mouseout', (event) => {
            if (!event.relatedTarget && event.clientY <= 0 && window.matchMedia('(pointer: fine)').matches) open(true);
        });
    }

    /* Cookie / storage consent banner. Accept and Reject carry equal weight; nothing optional
       is stored until a choice is made. Any [data-cookie-settings] link reopens the settings. */
    function setupConsentBanner() {
        const policy = page('cookie-policy.html');
        const banner = document.createElement('section');
        banner.className = 'gm-consent';
        banner.setAttribute('aria-label', 'Cookie preferences');
        banner.hidden = true;
        banner.innerHTML = `
          <div class="gm-consent-main">
            <p class="gm-consent-title">Your privacy choices</p>
            <p class="gm-consent-text">We use essential storage to run this site. With your permission we'll also remember preferences, such as night mode and dismissed pop-ups. We don't use advertising cookies, and no analytics run unless you allow them. <a href="${policy}">Cookie policy</a></p>
            <div class="gm-consent-options" hidden>
              <label class="gm-consent-option"><input type="checkbox" checked disabled><span><strong>Essential</strong>Needed for the site to work and to remember this choice. Always on.</span></label>
              <label class="gm-consent-option"><input type="checkbox" name="preferences"><span><strong>Preferences</strong>Remember night mode and pop-ups you have closed.</span></label>
              <label class="gm-consent-option"><input type="checkbox" name="analytics"><span><strong>Analytics</strong>Anonymous usage statistics. None run today; this choice applies if we add them.</span></label>
            </div>
          </div>
          <div class="gm-consent-actions">
            <button type="button" class="gm-consent-btn" data-consent="reject">Reject non-essential</button>
            <button type="button" class="gm-consent-btn gm-consent-btn--ghost" data-consent="customise" aria-expanded="false">Customise</button>
            <button type="button" class="gm-consent-btn" data-consent="accept">Accept all</button>
          </div>`;
        document.body.appendChild(banner);

        const options = banner.querySelector('.gm-consent-options');
        const customise = banner.querySelector('[data-consent="customise"]');
        const checkbox = (name) => banner.querySelector(`input[name="${name}"]`);
        function show(expand) {
            const current = readConsent();
            checkbox('preferences').checked = Boolean(current?.preferences);
            checkbox('analytics').checked = Boolean(current?.analytics);
            options.hidden = !expand;
            customise.textContent = expand ? 'Save choices' : 'Customise';
            customise.setAttribute('aria-expanded', String(expand));
            banner.hidden = false;
            root.classList.add('gm-consent-open');
        }
        function hide() {
            banner.hidden = true;
            root.classList.remove('gm-consent-open');
        }
        banner.addEventListener('click', (event) => {
            const action = event.target.closest('[data-consent]')?.dataset.consent;
            if (!action) return;
            if (action === 'customise' && options.hidden) { show(true); checkbox('preferences').focus(); return; }
            if (action === 'accept') writeConsent({ preferences: true, analytics: true });
            if (action === 'reject') writeConsent({ preferences: false, analytics: false });
            if (action === 'customise') writeConsent({ preferences: checkbox('preferences').checked, analytics: checkbox('analytics').checked });
            hide();
        });
        document.addEventListener('click', (event) => {
            const trigger = event.target.closest('[data-cookie-settings]');
            if (!trigger) return;
            event.preventDefault();
            show(true);
            checkbox('preferences').focus();
        });
        if (!readConsent()) show(false);
    }

    /* Keyboard: "Skip to content" as the first focusable element on every page. */
    function setupSkipLink() {
        const nav = document.querySelector('nav.nav, .nav, header.topnav, header');
        let target = document.querySelector('main') || nav?.nextElementSibling;
        while (target && /^(SCRIPT|STYLE)$/.test(target.tagName)) target = target.nextElementSibling;
        if (!target) return;
        if (!target.id) target.id = 'main-content';
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        const link = document.createElement('a');
        link.className = 'skip-link';
        link.href = `#${target.id}`;
        link.textContent = 'Skip to content';
        document.body.prepend(link);
    }

    const savedTheme = readPref('gradmire-theme') || 'light';
    applyTheme(savedTheme);
    setupNavigation();
    setupThemeToggle();
    applyTheme(savedTheme);
    setupSkipLink();
    setupLogoSliders();
    setupMobileSliders();
    setupConsentBanner();
    setupConsultPopup();
    setupBuddy();
    setupFooterSubscribe();
})();
