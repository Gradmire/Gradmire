(() => {
    const root = document.documentElement;
    /* Strobi, the study buddy: @bible-strong/avatar-web (AGPL-3.0) renders the definition below. */
    const AVATAR_WEB_URL = 'https://cdn.jsdelivr.net/npm/@bible-strong/avatar-web@0.1.0/+esm';
    const ASSETS_URL = new URL('./', document.currentScript?.src || window.location.href).href;
    /* ?v= changes whenever the avatar file does (new faces were added in v2), so cached copies never miss an animation. */
    const AVATAR_DEFINITION_URL = new URL('avatar/strobi.avatar.json?v=2', ASSETS_URL).href;

    /* ── Consent: essential storage always; "preferences" and "analytics" only with opt-in.
       The choice itself is essential (it has to be remembered to be respected). ── */
    const CONSENT_KEY = 'gm-consent';
    const CONSENT_VERSION = 1;
    /* One remembered "closed" timestamp per promo card (see setupPromoCards); cleared when preferences are refused. */
    const PROMO_IDS = ['plan', 'cost', 'schol', 'courses', 'deadlines', 'visa', 'tests', 'mbbs', 'counsel', 'wa', 'scholc', 'mbbsx', 'office', 'convert', 'compare'];
    const PREF_KEYS = ['gradmire-theme', 'gm-consult-popup-dismissed', ...PROMO_IDS.map((id) => `gm-promo-${id}`)];
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
    /* Keep Tab / Shift+Tab cycling inside `items` (a dialog or open menu). */
    function trapTab(event, items) {
        if (event.key !== 'Tab' || !items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
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
    const countryPage = (slug) => page(`study-in-${slug}`);
    const scholarshipPage = (slug) => page(`scholarships-in-${slug}`);
    const consultationPage = (interest, country = '') => `${page('free-consultation')}?interest=${encodeURIComponent(interest)}${country ? `&country=${encodeURIComponent(country)}` : ''}`;
    const link = (href, label) => `<a href="${href}" role="menuitem">${label.replace(/&/g, '&amp;')}</a>`;
    const dropdown = (label, items, extraClass = '') => `
      <li class="nav-dropdown ${extraClass}">
        <button type="button" aria-expanded="false" aria-haspopup="true">${label} ${chevron}</button>
        <div class="nav-dropdown-menu" role="menu">${items}</div>
      </li>`;

    /* Popular courses (AECC-style list); each opens the Course Finder filtered to that subject. */
    const popularCourses = [
        ['MBA & Management', 'business'], ['Computer Science & IT', 'computer science'], ['Data Science & AI', 'data science'],
        ['Business Analytics', 'business analytics'], ['Engineering', 'engineering'], ['Medicine, Health & Nursing', 'medicine'],
        ['Economics & Finance', 'economics'], ['Law', 'law'], ['Psychology', 'psychology'],
        ['Architecture & Design', 'design'], ['Natural Sciences', 'science'], ['Social Sciences & Humanities', 'social sciences']
    ];
    const studentServices = [
        ['Gradmire free counselling', consultationPage('counselling')], ['Test preparation', page('test-preparation')],
        ['Visa assistance', page('visa-assistance')], ['Application assistance', page('application-assistance')],
        ['Course selection guidance', page('course-selection-guidance')]
    ];
    const navItems = [
        dropdown('Destinations', `<span class="nav-dropdown-label">Study destinations</span>${destinations.map(([name, slug]) => link(countryPage(slug), name)).join('')}${link(page('destinations'), 'All destinations →')}`),
        dropdown('Courses', `<span class="nav-dropdown-label">Popular courses</span><div class="nav-dropdown-grid">${popularCourses.map(([label, query]) => link(`${page('find-courses')}?course=${encodeURIComponent(query)}`, label)).join('')}</div>${link(`${page('find-courses')}?level=ug`, 'Bachelor’s (UG) courses')}${link(`${page('find-courses')}?level=pg`, 'Master’s (PG) courses')}${link(page('find-courses'), 'Open the Course Finder →')}`, 'nav-dropdown--wide'),
        dropdown('MBBS Abroad', `<span class="nav-dropdown-label">Countries to explore</span>${mbbsCountries.map(([name, slug]) => link(page(`mbbs-in-${slug}`), `MBBS in ${name}`)).join('')}${link(page('mbbs-abroad'), 'Compare MBBS countries →')}`),
        dropdown('Student Services', `${studentServices.map(([label, href]) => link(href, label)).join('')}`),
        dropdown('Scholarships', `<span class="nav-dropdown-label">Explore by country</span>${destinations.map(([name, slug]) => link(scholarshipPage(slug), `Scholarships in ${name}`)).join('')}${link(page('scholarships'), 'All scholarships →')}`),
        dropdown('Student Tools', `${link(page('find-courses'), 'Course Finder')}${link(page('tools/roi-calculator'), 'Study cost calculator')}${link(page('tools/comparator'), 'Course comparator')}${link(page('tools/deadline-tracker'), 'Deadline tracker')}${link(page('tools/grade-converter'), 'GPA / CGPA / SGPA converter')}`)
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
        /* Student login, next to the consultation button, unless the page's nav already links to it (sign-up page). */
        const cta = navInner.querySelector('.nav-btn');
        const hasLogin = [...navInner.querySelectorAll('a[href]')].some((a) => /\/login(\.html)?$/.test(new URL(a.href, location.href).pathname));
        if (cta && !hasLogin) cta.insertAdjacentHTML('beforebegin', `<a class="nav-login" href="${page('login')}">Log in</a>`);

        let mobile = document.querySelector('.nav-mobile');
        if (!mobile) {
            mobile = document.createElement('div');
            mobile.className = 'nav-mobile';
            mobile.setAttribute('aria-label', 'Mobile navigation');
            nav.insertAdjacentElement('afterend', mobile);
        }
        /* The 2027 guides sit in the phone menu only: the desktop bar is already full. */
        const guides2027 = dropdown('2027 Guides', `<span class="nav-dropdown-label">Study abroad in 2027</span>${[
            ['Study abroad in 2027: the plan', 'study-abroad-2027'], ['2027 intakes by country', 'study-abroad-intakes-2027'],
            ['Best countries for 2027', 'best-countries-to-study-abroad-2027'], ['Scholarships for 2027', 'study-abroad-scholarships-2027'],
            ['IELTS, TOEFL, GRE and GMAT plan', 'study-abroad-tests-2027'], ['2027 documents checklist', 'study-abroad-checklist-2027'],
            ['MBBS abroad in 2027', 'mbbs-abroad-2027']
        ].map(([label, slug]) => link(page(slug), label)).join('')}${link(page('blog'), 'All guides')}`);
        /* What the footer shows on a desktop, so the phone footer can stay small: company and legal links,
           the registered office, e-mail and social icons. */
        const socialIcon = (paths) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
        /* The icons are copied from the footer, whose list lives in scripts/social.mjs (the one place to add a profile),
           so the menu and the footer never disagree. Each one opens the real profile page in a new tab. */
        const emailIcon = '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4.5 7.5 7.5 5.8 7.5-5.8"/>';
        const socialRow = [...document.querySelectorAll('.gm-footer-social > *')].map((el) => (el.tagName === 'A'
            ? `<a class="nav-mobile-social-link" href="${el.getAttribute('href')}" aria-label="${el.getAttribute('aria-label')}"${el.target ? ' target="_blank" rel="noopener noreferrer"' : ''}>${el.innerHTML}</a>`
            : `<span class="nav-mobile-social-link is-soon" title="${el.getAttribute('title') || ''}" aria-hidden="true">${el.innerHTML}</span>`)).join('')
            || `<a class="nav-mobile-social-link" href="mailto:info@gradmire.com" aria-label="Email Gradmire">${socialIcon(emailIcon)}</a>`;
        const infoList = (items) => items.map(([label, slug]) => `<li><a href="${page(slug)}">${label}</a></li>`).join('');
        const mobileInfo = `<li class="nav-mobile-info">
            <div class="nav-mobile-cols">
              <div><p class="nav-mobile-h">Company</p><ul role="list">${infoList([['About us', 'about'], ['Blog', 'blog'], ['Careers', 'career'], ['FAQs', 'faq'], ['Contact', 'contact'], ['Press kit', 'press']])}</ul></div>
              <div><p class="nav-mobile-h">Legal</p><ul role="list">${infoList([['Privacy', 'privacy'], ['Terms', 'terms'], ['Refunds &amp; fees', 'refund-policy'], ['Cookies', 'cookie-policy'], ['Your data rights', 'data-request'], ['Grievance', 'grievance'], ['Photo credits', 'photo-credits']])}<li><button type="button" class="nav-mobile-linkbtn" data-cookie-settings>Cookie settings</button></li></ul></div>
            </div>
            <p class="nav-mobile-contact">Gradmire Education Pvt. Ltd.<br>Kanpur: Near Halim College, Prem Nagar<br>Greater Noida: N2 Tower, Supertech Ecovillage 1</p>
            <div class="nav-mobile-social" role="group" aria-label="Contact and social links">${socialRow}</div>
          </li>`;
        mobile.innerHTML = `<ul class="nav-mobile-links" role="list">${navItems.join('')}${guides2027}
          <li><a href="${page('login')}" class="nav-login-mobile">Login</a></li>
          <li><a href="${page('free-consultation')}" class="btn btn-primary">Book free consultation</a></li>
          ${mobileInfo}
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
            document.documentElement.classList.toggle('nav-open', open);
            // Keep the logo bar on screen above the menu, and start the menu exactly
            // below it. An in-flow header is pinned with matching body padding so
            // the page underneath does not jump.
            if (open) {
                const height = nav.getBoundingClientRect().height;
                document.documentElement.style.setProperty('--gm-nav-h', `${height}px`);
                if (getComputedStyle(nav).position !== 'fixed') {
                    nav.classList.add('nav-pinned');
                    document.body.style.paddingTop = `${parseFloat(getComputedStyle(document.body).paddingTop) + height}px`;
                }
            } else if (nav.classList.contains('nav-pinned')) {
                nav.classList.remove('nav-pinned');
                document.body.style.paddingTop = '';
            }
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
            trapTab(event, [...mobile.querySelectorAll('a[href], button:not([disabled])')]
                .filter((element) => element.getClientRects().length > 0));
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
                clone.querySelectorAll('a').forEach((a) => a.setAttribute('tabindex', '-1'));
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
        const pageName = (window.location.pathname.split('/').pop() || 'index').replace(/\.html$/i, '').toLowerCase();
        const skip = ['login', 'signup', 'free-consultation', 'dashboard', 'contact', '404', 'grievance', 'privacy', 'terms'];
        /* Signed-in workspaces (student, consultant, admin) are not sales pages: no popup and no floating button there. */
        if (skip.includes(pageName) || document.querySelector('.ws-layout')) return;

        const store = (kind) => { try { return window[kind]; } catch (_) { return null; } };
        const session = store('sessionStorage');
        const read = (s, key) => { try { return s ? s.getItem(key) : null; } catch (_) { return null; } };
        const write = (s, key, value) => { try { if (s) s.setItem(key, value); } catch (_) {} };
        const DISMISS_DAYS = 3;
        const recentlyDismissed = Number(readPref('gm-consult-popup-dismissed') || 0) > Date.now() - DISMISS_DAYS * 864e5;
        const photo = 'https://images.unsplash.com/photo-1728141123512-87c415cecc9d?auto=format&fit=crop&w=640&h=820&q=80';
        const optionList = (list) => list.map(([name, slug]) => `<option value="${slug}">${name}</option>`).join('');
        const options = `<optgroup label="Study destinations">${optionList(destinations)}</optgroup><optgroup label="MBBS destinations">${optionList(mbbsCountries)}</optgroup>`;

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
              <p class="gm-popup-media-badge"><strong>Free</strong> first consultation, no obligation</p>
            </div>
            <div class="gm-popup-body">
              <p class="gm-popup-eyebrow"><span aria-hidden="true"></span>Free 1:1 counselling</p>
              <h2 class="gm-popup-title" id="gm-popup-title">Plan your study-abroad journey with an expert.</h2>
              <p class="gm-popup-sub" id="gm-popup-sub">Share a few details and a Gradmire counsellor will call you within 24 hours. No fees, no obligation.</p>
              <div class="gm-popup-chosen" hidden>
                <p class="gm-popup-chosen-label"></p>
                <p class="gm-popup-chosen-name"></p>
                <p class="gm-popup-chosen-where"></p>
              </div>
              <form class="gm-popup-form" novalidate>
                <label class="gm-popup-field"><span>Full name</span><input name="name" type="text" autocomplete="name" placeholder="Your name" required></label>
                <label class="gm-popup-field"><span>Phone number</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+91 98765 43210" required></label>
                <label class="gm-popup-field"><span>Email <em>(optional)</em></span><input name="email" type="email" autocomplete="email" placeholder="you@example.com"></label>
                <label class="gm-popup-field"><span>Where do you want to study?</span><select name="destination"><option value="">Not sure yet</option>${options}</select></label>
                <p class="gm-popup-error" role="alert" hidden></p>
                <button type="submit" class="gm-popup-submit">Book my free consultation <span aria-hidden="true">→</span></button>
                <p class="gm-popup-fine">You'll confirm your details and consent on the next step. Under 18? Please ask a parent or guardian first. <a href="${page('privacy')}">Privacy policy</a></p>
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
        /* When "Apply" (or a scholarship or test button) opened the popup, say what was chosen and where it goes,
           so the visitor is never left wondering what happened to it. */
        const chosenBox = popup.querySelector('.gm-popup-chosen');
        function showChosen() {
            const [label, name, where] = context.course
                ? ['Course you chose', context.course, 'Where it goes: after your free consultation, your counsellor adds this course to Application status on your Gradmire dashboard, so you can follow every step there.']
                : context.scholarship
                    ? ['Scholarship you chose', context.scholarship, 'Your counsellor will cover it in your free consultation and plan its deadline with you.']
                    : context.exam
                        ? ['Test you chose', String(context.exam).toUpperCase(), 'Your counsellor will cover it in your free consultation.']
                        : [];
            chosenBox.hidden = !name;
            if (!name) return;
            chosenBox.querySelector('.gm-popup-chosen-label').textContent = label;
            chosenBox.querySelector('.gm-popup-chosen-name').textContent = name;
            const whereEl = chosenBox.querySelector('.gm-popup-chosen-where');
            whereEl.textContent = `${where} `;
            if (context.course) {
                const dashboardLink = document.createElement('a');
                dashboardLink.href = page('dashboard');
                dashboardLink.textContent = 'Open my dashboard';
                whereEl.append(dashboardLink, ' (sign in to see it).');
                window.dispatchEvent(new CustomEvent('gm:saved'));
            }
        }
        function open(auto) {
            if (!popup.hidden || (auto && autoDone)) return;
            if (auto) {
                const active = document.activeElement;
                if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return;
                if (document.querySelector('.nav-mobile.is-open, .nav-mobile[aria-hidden="false"]')) return;
            }
            autoDone = true;
            window.__gmPopupAt = Date.now();
            write(session, 'gm-consult-popup-shown', '1');
            showChosen();
            lastFocus = document.activeElement;
            popup.hidden = false;
            document.documentElement.classList.add('gm-popup-open');
            requestAnimationFrame(() => popup.classList.add('is-visible'));
            setTimeout(() => form.querySelector('input')?.focus({ preventScroll: true }), 60);
        }
        function close() {
            if (popup.hidden) return;
            window.__gmPopupAt = Date.now();
            savePref('gm-consult-popup-dismissed', String(Date.now()));
            popup.classList.remove('is-visible');
            document.documentElement.classList.remove('gm-popup-open');
            setTimeout(() => { popup.hidden = true; }, 220);
            lastFocus?.focus?.({ preventScroll: true });
        }

        /* What the button that opened the popup was about (service, test, scholarship), passed on to the booking page. */
        let context = {};
        window.__gmOpenPopup = (auto) => { if (popup.hidden) context = {}; open(auto); };
        fab.addEventListener('click', () => { if (popup.hidden) context = {}; open(false); });
        /* "Apply" / "Talk to a counsellor" links open the popup with their country preselected;
           without JavaScript they still go to the booking page. */
        document.addEventListener('click', (event) => {
            const trigger = event.target.closest('[data-open-consult]');
            if (!trigger || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
            event.preventDefault();
            const select = form.elements.destination;
            if (select && trigger.dataset.country) select.value = trigger.dataset.country;
            let interest = '';
            try { interest = new URL(trigger.href, window.location.href).searchParams.get('interest') || ''; } catch (_) {}
            context = { interest, exam: trigger.dataset.exam || '', scholarship: trigger.dataset.scholarship || '', course: trigger.dataset.course || '' };
            open(false);
        });
        popup.querySelectorAll('[data-popup-close]').forEach((el) => el.addEventListener('click', close));
        popup.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') { event.preventDefault(); close(); return; }
            if (event.key === 'Tab') trapTab(event, focusables());
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
                email: String(data.email || '').trim(), destination: data.destination || '',
                exam: context.exam || '', scholarship: context.scholarship || '', course: context.course || ''
            }));
            const interest = context.interest || (mbbsCountries.some(([, slug]) => slug === data.destination) ? 'mbbs-abroad' : 'counselling');
            window.location.href = `${consultationPage(interest, data.destination || '')}#book`;
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

    /* Promo cards: small, closable offers for Gradmire's own free tools, guides and counselling. First-party only: no ad
       network and no tracking. They are never a full-screen blocker. One card slides in from the corner (above the tab bar on
       phones) once the visitor has spent a while on the page, at most twice per session and once per page view, never over the
       cookie banner, the consultation popup, the menu or the keyboard. Closing one keeps that card away for 7 days (remembered
       only if the visitor allowed preferences; otherwise for this tab). The card picked depends on the page being read. */
    function setupPromoCards() {
        const slug = (window.location.pathname.split('/').filter(Boolean).pop() || 'index').replace(/\.html$/i, '').toLowerCase();
        const skip = ['login', 'signup', 'free-consultation', 'book-consultation', 'dashboard', 'contact', '404', 'grievance', 'privacy', 'terms', 'cookie-policy'];
        if (skip.includes(slug) || document.querySelector('.ws-layout')) return;

        const DAY = 864e5, DISMISS_DAYS = 7, MAX_PER_SESSION = 3;
        const session = (fn) => { try { return fn(window.sessionStorage); } catch (_) { return null; } };
        const shownCount = () => Number(session((s) => s.getItem('gm-promo-count')) || 0);
        if (shownCount() >= MAX_PER_SESSION) return;
        const dismissed = (id) => Number(readPref(`gm-promo-${id}`) || 0) > Date.now() - DISMISS_DAYS * DAY;

        const match = slug.match(/^(study-in|mbbs-in|scholarships-in)-(.+)$/);
        const place = match ? [...destinations, ...mbbsCountries].find(([, code]) => code === match[2]) : null;
        const isMbbs = /^mbbs/.test(slug);
        const withThe = (name) => (/^United /.test(name) ? `the ${name}` : name);

        const cards = {
            plan: { eyebrow: '2027 guide', title: 'Planning for the 2027 intake?', text: 'Choose your intake and follow a month-by-month plan, with sources listed.', href: page('study-abroad-2027'), cta: 'Open the 2027 plan', icon: 'calendar' },
            cost: { eyebrow: 'Free tool', title: 'What will your degree really cost?', text: 'Add tuition, living and test costs, then see your break-even against expected salary.', href: page('tools/roi-calculator'), cta: 'Use the cost calculator', icon: 'calc' },
            schol: { eyebrow: 'Funding', title: 'Find scholarships that fit', text: 'Compare awards by country, degree level and eligibility, with official sources.', href: page('scholarships'), cta: 'Browse scholarships', icon: 'award' },
            courses: { eyebrow: 'Free tool', title: 'Start with the course', text: 'Search bachelor’s and master’s courses by subject, country and level.', href: page('find-courses'), cta: 'Open the Course Finder', icon: 'search' },
            deadlines: { eyebrow: 'Free tool', title: 'Never miss a deadline', text: 'Track university application deadlines and see which are urgent.', href: page('tools/deadline-tracker'), cta: 'Track deadlines', icon: 'clock' },
            visa: { eyebrow: 'Visa help', title: 'Student visa paperwork', text: 'Eligibility, document checklists, financial evidence and interview preparation.', href: page('visa-assistance'), cta: 'See visa help', icon: 'file' },
            tests: { eyebrow: 'Test prep', title: 'IELTS, TOEFL, GRE or GMAT?', text: 'Practice tests, study plans and feedback from Gradmire for the 2027 intake.', href: page('test-preparation'), cta: 'See test prep', icon: 'pencil' },
            mbbs: { eyebrow: 'MBBS abroad', title: 'Compare MBBS countries', text: 'Fees, course length and recognition for nine countries, side by side.', href: `${page('mbbs-abroad')}#compare`, cta: 'Compare countries', icon: 'cross' },
            mbbsx: { eyebrow: 'MBBS abroad', title: 'Planning MBBS abroad?', text: 'Compare nine countries on fees, course length and recognition.', href: page('mbbs-abroad'), cta: 'See MBBS destinations', icon: 'cross' },
            wa: { eyebrow: 'WhatsApp', title: 'Prefer WhatsApp?', text: 'Message a Gradmire counsellor. Replies usually come within 2 hours.', href: 'https://wa.me/918577909702?text=Hi+Gradmire%2C+I+have+a+query+about+studying+abroad.', cta: 'Chat on WhatsApp', icon: 'chat', external: true },
            office: { eyebrow: 'Visit us', title: 'Kanpur and Greater Noida', text: 'Meet a counsellor in person at one of our two offices, or talk online.', href: page('contact'), cta: 'See our offices', icon: 'pin' },
            convert: { eyebrow: 'Free tool', title: 'Convert your CGPA or GPA', text: 'Estimate your percentage or GPA on another scale as a starting point.', href: page('tools/grade-converter'), cta: 'Open the converter', icon: 'calc' },
            compare: { eyebrow: 'Free tool', title: 'Compare courses side by side', text: 'Line courses up on cost, length and entry requirements.', href: page('tools/comparator'), cta: 'Open the comparator', icon: 'search' },
            scholc: place && !isMbbs
                ? { eyebrow: 'Funding', title: `Scholarships in ${withThe(place[0])}`, text: 'See the awards, who can apply and what they cover, with official sources.', href: scholarshipPage(place[1]), cta: 'See scholarships', icon: 'award' }
                : null,
            counsel: place
                ? { eyebrow: 'Free 1:1 counselling', title: `Questions about ${isMbbs ? 'MBBS in ' : ''}${withThe(place[0])}?`, text: 'Free first consultation, no obligation. A counsellor replies within 24 business hours.', href: consultationPage(isMbbs ? 'mbbs-abroad' : 'counselling', place[1]), cta: 'Talk to a counsellor', icon: 'chat', open: true, country: place[1] }
                : { eyebrow: 'Free 1:1 counselling', title: 'Talk to a counsellor', text: 'Free first consultation, no obligation. A counsellor replies within 24 business hours.', href: consultationPage('counselling'), cta: 'Book free consultation', icon: 'chat', open: true }
        };
        const order = isMbbs ? (slug === 'mbbs-abroad' ? ['counsel', 'visa', 'deadlines', 'wa'] : ['mbbs', 'counsel', 'deadlines', 'wa'])
            : /^(study-in|scholarships-in)-/.test(slug) ? ['counsel', 'scholc', 'cost', 'schol', 'tests', 'wa']
            : /^test-prep|tests/.test(slug) ? ['counsel', 'plan', 'schol', 'wa']
            : isToolPage ? ['counsel', 'courses', 'compare', 'convert', 'plan', 'office']
            : slug === 'index' ? ['plan', 'cost', 'schol', 'mbbsx', 'wa']
            : ['plan', 'cost', 'courses', 'convert', 'mbbsx', 'office', 'counsel'];
        const here = window.location.pathname.replace(/\.html$/i, '').replace(/\/$/, '');
        const samePage = (card) => { try { return new URL(card.href, window.location.href).pathname.replace(/\.html$/i, '').replace(/\/$/, '') === here; } catch (_) { return false; } };
        /* Cards already shown earlier this session come last, so the next page offers something different. */
        let seenIds = [];
        try { seenIds = JSON.parse(session((s) => s.getItem('gm-promo-seen')) || '[]'); } catch (_) { seenIds = []; }
        const usable = order.filter((key) => cards[key] && !dismissed(key) && !samePage(cards[key]));
        const id = usable.find((key) => !seenIds.includes(key)) || usable[0];
        if (!id) return;
        const card = cards[id];

        const icons = {
            calc: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
            calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M8.5 3.5v4M15.5 3.5v4M4 10h16"/>',
            award: '<circle cx="12" cy="9" r="5"/><path d="M9 13.5 7.5 21l4.5-2.5 4.5 2.5-1.5-7.5"/>',
            search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
            clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
            file: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M9.5 12h5M9.5 16h5"/>',
            pencil: '<path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19z"/><path d="M14.5 6.5l3 3"/>',
            cross: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 7.5v9M7.5 12h9"/>',
            pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
            chat: '<path d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 17 16h-6l-4.5 4v-4H7a2.5 2.5 0 0 1-2.5-2.5z"/>'
        };
        const el = document.createElement('aside');
        el.className = 'gm-promo';
        el.setAttribute('aria-label', 'Gradmire offer');
        const consultAttrs = (card.open ? ` data-open-consult${card.country ? ` data-country="${card.country}"` : ''}` : '')
            + (card.external ? ' target="_blank" rel="noopener noreferrer"' : '');
        el.innerHTML = `
          <button type="button" class="gm-promo-close" aria-label="Close offer"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>
          <span class="gm-promo-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[card.icon]}</svg></span>
          <div class="gm-promo-body">
            <p class="gm-promo-eyebrow">${card.eyebrow}</p>
            <p class="gm-promo-title">${card.title}</p>
            <p class="gm-promo-text">${card.text}</p>
            <a class="gm-promo-cta" href="${card.href}"${consultAttrs}>${card.cta} <span aria-hidden="true">→</span></a>
          </div>`;

        const started = Date.now();
        let timer = 0, hideTimer = 0, shown = false;
        const quiet = () => {
            const active = document.activeElement;
            return !['gm-popup-open', 'gm-consent-open', 'nav-open', 'gm-kb'].some((name) => root.classList.contains(name))
                && document.visibilityState === 'visible'
                && !(active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))
                && Date.now() - (window.__gmPopupAt || 0) > 20000;
        };
        function hide(close) {
            clearTimeout(hideTimer);
            if (close) savePref(`gm-promo-${id}`, String(Date.now()));
            el.classList.remove('is-visible');
            setTimeout(() => el.remove(), 320);
        }
        function show() {
            shown = true;
            session((s) => s.setItem('gm-promo-count', String(shownCount() + 1)));
            seenIds.push(id);
            session((s) => s.setItem('gm-promo-seen', JSON.stringify(seenIds)));
            document.body.appendChild(el);
            requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-visible')));
            window.dispatchEvent(new CustomEvent('gm:promo'));
            /* Fades away by itself after a while, but never while it is being read (pointer, touch or keyboard focus on it). */
            hideTimer = setTimeout(() => hide(false), 24000);
            ['mouseenter', 'focusin', 'touchstart'].forEach((type) => el.addEventListener(type, () => clearTimeout(hideTimer), { passive: true }));
        }
        el.querySelector('.gm-promo-close').addEventListener('click', () => hide(true));
        el.querySelector('.gm-promo-cta').addEventListener('click', () => hide(true));
        el.addEventListener('keydown', (event) => { if (event.key === 'Escape') hide(true); });

        /* Not before 20 s on the page, and then once the visitor has scrolled a third of it (or after 45 s). */
        const check = () => {
            if (shown) return;
            const age = Date.now() - started;
            const depth = (window.scrollY + window.innerHeight) / Math.max(1, document.documentElement.scrollHeight);
            if (age > 20000 && (depth > 0.3 || age > 45000) && quiet()) { show(); return; }
            if (age < 240000) timer = setTimeout(check, 3000);
        };
        timer = setTimeout(check, 20000);

        /* Desktop only: when the mouse heads out of the top of the window, show the card once (after 8 s on the page).
           The consultation popup gets the first exit-intent of a session, so this only runs once that has had its turn. */
        document.addEventListener('mouseout', (event) => {
            if (shown || event.relatedTarget || event.clientY > 0 || !window.matchMedia('(pointer: fine)').matches) return;
            if (!session((s) => s.getItem('gm-consult-popup-shown'))) return;
            if (Date.now() - started > 8000 && quiet()) show();
        });
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
        const pageName = (window.location.pathname.split('/').pop() || 'index').replace(/\.html$/i, '').toLowerCase();
        if (pageName === 'dashboard') return;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
        let session = null;
        try { session = window.sessionStorage; } catch (_) {}
        const sessionGet = (key) => { try { return session?.getItem(key); } catch (_) { return null; } };
        const sessionSet = (key, value) => { try { session?.setItem(key, value); } catch (_) {} };

        const wrap = document.createElement('div');
        wrap.className = 'gm-buddy';
        wrap.innerHTML = `
          <div class="gm-buddy-bubble" role="status" aria-live="polite" hidden>
            <p class="gm-buddy-title" hidden></p>
            <p class="gm-buddy-text"></p>
            <div class="gm-buddy-actions" hidden></div>
            <button type="button" class="gm-buddy-close" aria-label="Dismiss message"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>
          </div>
          <button type="button" class="gm-buddy-avatar" aria-label="Strobi, your study-abroad buddy. Drag me, or use the arrow keys, onto any part of the page and I’ll explain it. Press for a tip.">${buddySvg()}</button>`;
        document.body.appendChild(wrap);

        const button = wrap.querySelector('.gm-buddy-avatar');
        const bubble = wrap.querySelector('.gm-buddy-bubble');
        const text = wrap.querySelector('.gm-buddy-text');
        const titleEl = wrap.querySelector('.gm-buddy-title');
        const actions = wrap.querySelector('.gm-buddy-actions');

        /* ── Animation state: a resting "base" plus short reactions that fall back to it. ── */
        let live = null;
        let base = pageName === '404' ? 'sad' : 'idle';
        let current = base;
        let reactionTimer = 0;
        const show = (animation) => {
            current = animation;
            wrap.dataset.mood = animation;
            try { live?.play(animation); } catch (_) { /* an animation the loaded file does not know: keep the current face */ }
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
        function say(message, { ms = 4200, cta = false, title = '', home = false } = {}) {
            clearTimeout(bubbleTimer);
            titleEl.textContent = title;
            titleEl.hidden = !title;
            text.textContent = message;
            actions.hidden = !cta && !home;
            actions.innerHTML = `${cta ? '<button type="button" class="gm-buddy-cta">Talk to a counsellor</button>' : ''}${home && wrap.classList.contains('is-placed') ? '<button type="button" class="gm-buddy-home">Send Strobi home</button>' : ''}`;
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
            else window.location.href = page('free-consultation');
        });

        /* ── Load the real avatar; keep the SVG if the CDN or JSON is unavailable.
              The third-party module is kept off the critical path: it starts when the browser is idle after the
              page has loaded, and on phones only after the first touch, scroll or key press (about 650 ms of script
              on a mid-range phone). The inline SVG shows meanwhile. ── */
        const startAvatar = () => Promise.all([
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
        const whenIdle = (fn) => ('requestIdleCallback' in window ? window.requestIdleCallback(fn, { timeout: 6000 }) : window.setTimeout(fn, 3000));
        const afterLoad = (fn) => (document.readyState === 'complete' ? fn() : window.addEventListener('load', fn, { once: true }));
        if (document.documentElement.classList.contains('gm-lite')) {
            /* Data Saver or a 2G connection: keep the inline SVG mascot and skip the third-party module. */
        } else if (window.matchMedia('(max-width: 760px)').matches) {
            let started = false;
            const go = () => { if (started) return; started = true; ['pointerdown', 'scroll', 'keydown'].forEach((type) => window.removeEventListener(type, go)); afterLoad(() => whenIdle(startAvatar)); };
            ['pointerdown', 'scroll', 'keydown'].forEach((type) => window.addEventListener(type, go, { once: true, passive: true }));
        } else {
            afterLoad(() => whenIdle(startAvatar));
        }

        /* ── Drag me anywhere: drop Strobi on any part of the page and it explains that part,
           using avatar/strobi-knowledge.json plus what the page itself says. Arrow keys move
           it too, and Enter explains what is underneath. ── */
        let knowledge = null;
        const loadKnowledge = () => knowledge || (knowledge = fetch(new URL('avatar/strobi-knowledge.json', ASSETS_URL).href)
            .then((res) => (res.ok ? res.json() : {})).catch(() => ({})));
        const pageStem = pageName;
        const countrySlug = pageName.match(/^study-in-([a-z-]+)$/)?.[1];
        const countryName = (countrySlug && destinations.find(([, slug]) => slug === countrySlug)?.[0]) || '';
        const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
        const firstSentence = (value) => {
            const s = clean(value);
            const m = s.match(/^.{20,220}?[.!?](?=\s|$)/);
            return m ? m[0] : (s.length > 200 ? `${s.slice(0, 197)}…` : s);
        };
        const capital = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
        const fill = (s) => s.replace(/\{country\}/g, countryName || 'this country');

        let target = null;
        /* Remembers what Strobi is over (no visual outline) so a drop can fall back to it. */
        const mark = (el) => { target = el; };
        function orient() {
            const r = button.getBoundingClientRect();
            wrap.classList.toggle('is-below', r.top < 220);
            wrap.classList.toggle('is-flip', r.left + 280 > window.innerWidth);
        }
        function place(x, y) {
            const size = button.offsetWidth;
            x = Math.max(8, Math.min(window.innerWidth - size - 8, x));
            y = Math.max(8, Math.min(window.innerHeight - size - 8, y));
            wrap.style.left = `${x}px`;
            wrap.style.top = `${y}px`;
            wrap.classList.add('is-placed');
            orient();
        }
        function goHome() {
            mark(null);
            wrap.classList.remove('is-placed', 'is-below', 'is-flip');
            wrap.style.left = wrap.style.top = '';
            sessionSet('gm-buddy-pos', '');
        }
        const saved = (sessionGet('gm-buddy-pos') || '').split(',').map(Number);
        if (saved.length === 2 && saved.every(Number.isFinite)) place(saved[0] * window.innerWidth, saved[1] * window.innerHeight);
        window.addEventListener('resize', () => { if (wrap.classList.contains('is-placed')) place(parseFloat(wrap.style.left), parseFloat(wrap.style.top)); });

        /* Sample Strobi's centre plus a small cross around it, skip invisible layers, and prefer a
           control or field so small targets (nav buttons, footer links) are easy to hit. */
        const interactive = 'input, select, textarea, button, a[href], summary, [role="button"]';
        const visible = (el) => !el.checkVisibility || el.checkVisibility({ visibilityProperty: true });
        function elementUnder() {
            const r = button.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const hits = [[0, 0], [0, -14], [0, 14], [-14, 0], [14, 0]].map(([dx, dy]) => document.elementsFromPoint(cx + dx, cy + dy)
                .find((el) => !wrap.contains(el) && el !== document.documentElement && el !== document.body && visible(el)) || null);
            return hits.find((el) => el?.closest(interactive)) || hits[0] || hits.find(Boolean) || null;
        }
        const subjectOf = (el) => el && (el.closest('input, select, textarea, button, a[href], summary, img, table, .gm-consult-fab')
            || el.closest('h1, h2, h3, h4, li, p, [class*="card"], [class*="stat"], form, section, article, aside, nav, footer, header')
            || el);

        function sectionFor(el, kb) {
            for (let node = el; node && node !== document.body; node = node.parentElement) {
                if (node.id && kb.sections?.[node.id]) return { key: node.id, node };
            }
            return null;
        }
        function glossaryFor(textValue, kb) {
            const terms = Object.keys(kb.glossary || {}).sort((a, b) => b.length - a.length);
            for (const term of terms) {
                const acronym = term === term.toUpperCase();
                const re = new RegExp(`(^|[^A-Za-z])${term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(?![A-Za-z])`, acronym ? '' : 'i');
                if (re.test(textValue)) return kb.glossary[term];
            }
            return '';
        }
        function describe(el, kb) {
            const pageInfo = kb.pages?.[pageStem] || 'A Gradmire page to help you plan your studies abroad.';
            if (!el) return { title: 'This page', text: pageInfo };
            const near = el.closest('section, article, li, [class*="card"], form, nav, footer, header, aside, p') || el;
            const tip = glossaryFor(clean(el.textContent).length > 30 ? el.textContent : near.textContent, kb);
            const withTip = (text) => (tip && !text.includes(tip) ? `${text} Good to know: ${tip}` : text);

            const field = el.closest('input, select, textarea');
            if (field && !field.closest('.gm-buddy')) {
                const label = labelOf(field);
                let textValue = kb.fields?.[field.name] || kb.fields?.[field.id] || kb.fields?.[field.type] || `Fill in ${label} here.`;
                const problem = fieldProblem(field);
                if (problem) textValue += ` ${problem}`;
                else if (problem === '') textValue += ' What you entered looks right.';
                return { title: capital(label), text: textValue, mood: problem ? 'confused' : 'happy' };
            }
            if (el.closest('.gm-consult-fab')) return { title: 'Free counselling', text: kb.elements?.['consult-fab'], cta: true };
            if (el.closest('.site-theme-toggle')) return { title: 'Light or dark', text: kb.elements?.theme };
            if (el.closest('.footer-subscribe')) return { title: 'Study-abroad updates', text: kb.elements?.['footer-subscribe'] };
            if (el.closest('.gm-consent')) return { title: 'Cookie choices', text: kb.elements?.consent };
            if (el.closest('[data-logo-slider]')) return { title: 'Where our students go', text: kb.elements?.['logo-slider'] };

            const control = el.closest('a[href], button, summary, [role="button"]');
            if (control) {
                const label = clean(control.getAttribute('aria-label') || control.textContent) || 'This button';
                const href = control.getAttribute('href') || '';
                let textValue;
                if (href.startsWith('#')) {
                    const dest = document.getElementById(href.slice(1));
                    const heading = clean(dest?.querySelector('h1, h2, h3')?.textContent);
                    textValue = `Jumps to ${heading ? `“${heading}”` : 'that section'} on this page.`;
                } else if (href.startsWith('mailto:')) {
                    textValue = `Opens your email app to write to ${href.slice(7)}.`;
                } else if (href.startsWith('tel:')) {
                    textValue = `Calls ${href.slice(4)}.`;
                } else if (href) {
                    const url = new URL(href, window.location.href);
                    const stem = url.pathname.split('/').pop().replace(/\.html$/, '');
                    textValue = url.origin !== window.location.origin
                        ? `Opens ${url.hostname.replace(/^www\./, '')}, an outside website.`
                        : kb.pages?.[stem] ? `Opens: ${kb.pages[stem]}`
                            : stem.startsWith('study-in-') ? `Opens the full guide to studying in ${destinations.find(([, slug]) => `study-in-${slug}` === stem)?.[0] || 'this country'}: costs, visas, intakes and careers.`
                                : 'Opens another Gradmire page.';
                } else if (control.matches('[type="submit"]')) {
                    textValue = 'Sends this form. I’ll tell you if anything needs fixing.';
                } else if (control.hasAttribute('aria-expanded') || control.matches('summary')) {
                    textValue = 'Shows or hides more detail. Tap it to expand.';
                } else {
                    textValue = 'Tap it to use it.';
                }
                return { title: label.length > 48 ? `${label.slice(0, 45)}…` : label, text: withTip(textValue) };
            }
            if (el.closest('table')) {
                const heads = [...el.closest('table').querySelectorAll('th')].map((th) => clean(th.textContent)).filter(Boolean).slice(0, 4);
                return { title: 'Table', text: withTip(`${kb.elements?.table}${heads.length ? ` Columns: ${heads.join(', ')}.` : ''}`) };
            }
            if (el.matches('img')) return { title: clean(el.alt) || 'Photo', text: kb.elements?.image };
            const hero = el.closest('.dest-hero, .hero') || el.closest('[class*="hero"]');
            if (hero && !el.closest('form')) {
                const h1 = clean((el.closest('h1') || hero.querySelector('h1') || hero.closest('section, header')?.querySelector('h1'))?.textContent);
                return { title: h1 || 'Welcome', text: withTip(countryName ? fill(kb.elements?.hero || '') : (kb.pages?.[pageStem] || '')) };
            }

            const section = sectionFor(el, kb);
            const heading = clean((el.matches('h1, h2, h3, h4') ? el : near.querySelector('h1, h2, h3, h4') || section?.node.querySelector('h1, h2, h3'))?.textContent);
            if (section) {
                const info = kb.sections[section.key];
                const local = el !== section.node && clean(el.textContent).length > 25 ? ` Here: “${firstSentence(el.textContent)}”` : '';
                return { title: heading || info.title, text: withTip(`${fill(info.text)}${local}`), cta: ['cost', 'scholarships', 'visa', 'eligibility', 'intakes', 'courses', 'pr'].includes(section.key) };
            }
            if (el.closest('footer')) return { title: 'Footer', text: kb.elements?.footer };
            if (el.closest('nav, .nav')) return { title: 'Menu', text: kb.elements?.nav };
            if (el.closest('h1') && kb.pages?.[pageStem]) return { title: heading, text: withTip(kb.pages[pageStem]) };
            const body = clean((near.matches('p') ? near : near.querySelector('p'))?.textContent || near.textContent).replace(heading, '').trim();
            if (heading || body.length > 25) {
                return { title: heading || 'On this page', text: withTip(body.length > 25 ? firstSentence(body) : `This part is about ${heading.replace(/[.!?]+$/, '')}.`) };
            }
            return { title: 'This page', text: withTip(pageInfo) };
        }

        async function explain() {
            const el = subjectOf(elementUnder()) || target;
            mark(el);
            show('thinking');
            const kb = await loadKnowledge();
            const info = describe(el, kb);
            react(info.mood || 'happy', 2600);
            say(info.text || 'Hmm, I don’t know much about this part yet.', { title: info.title, ms: 14000, cta: info.cta, home: true });
            setTimeout(() => { if (!drag) mark(null); }, 3000);
        }

        let drag = null;
        let justDragged = false;
        let frame = 0;
        button.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            const r = button.getBoundingClientRect();
            drag = { x: event.clientX, y: event.clientY, ox: event.clientX - r.left, oy: event.clientY - r.top, moved: false };
            mark(null);
            try { button.setPointerCapture(event.pointerId); } catch (_) { /* synthetic or already-released pointer */ }
            loadKnowledge();
        });
        button.addEventListener('pointermove', (event) => {
            if (!drag) return;
            if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return;
            if (!drag.moved) {
                drag.moved = true;
                wrap.classList.add('is-dragging');
                hush();
                clearTimeout(reactionTimer);
                reactionTimer = 0;
                show('searching');
            }
            place(event.clientX - drag.ox, event.clientY - drag.oy);
            if (!frame) frame = requestAnimationFrame(() => { frame = 0; if (drag) mark(subjectOf(elementUnder())); });
        });
        const endDrag = (event, drop) => {
            if (!drag) return;
            const moved = drag.moved;
            drag = null;
            wrap.classList.remove('is-dragging');
            try { if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId); } catch (_) {}
            if (!moved) return;
            justDragged = true;
            setTimeout(() => { justDragged = false; }, 0);
            const r = button.getBoundingClientRect();
            sessionSet('gm-buddy-pos', `${(r.left / window.innerWidth).toFixed(4)},${(r.top / window.innerHeight).toFixed(4)}`);
            if (drop) explain(); else { mark(null); show(base); }
        };
        button.addEventListener('pointerup', (event) => endDrag(event, true));
        button.addEventListener('pointercancel', (event) => endDrag(event, false));
        button.addEventListener('keydown', (event) => {
            const step = event.shiftKey ? 72 : 24;
            const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
            if (moves[event.key]) {
                event.preventDefault();
                const r = button.getBoundingClientRect();
                place(r.left + moves[event.key][0], r.top + moves[event.key][1]);
                mark(subjectOf(elementUnder()));
                return;
            }
            if ((event.key === 'Enter' || event.key === ' ') && wrap.classList.contains('is-placed')) { event.preventDefault(); explain(); }
            if (event.key === 'Escape' && wrap.classList.contains('is-placed')) { event.preventDefault(); hush(); goHome(); }
        });
        actions.addEventListener('click', (event) => {
            if (!event.target.closest('.gm-buddy-home')) return;
            hush();
            goHome();
            button.focus();
        });

        /* ── The buddy itself ── */
        const tips = [
            'Drag me onto any part of the page and I’ll explain it.',
            'Tip: shortlist courses by subject first, then compare countries.',
            'Public universities in Germany charge little or no tuition.',
            'Most UK master’s degrees take just one year.',
            'Start scholarship applications 9–12 months before your intake.',
            'Our counsellors can review your SOP for free.'
        ];
        let tipIndex = 0;
        /* Poking Strobi pulls a different face each time (a step of 1 to 3 along the list, so never the same one twice running). */
        const pokeFaces = [['laughing', 2200], ['wink', 2400], ['love', 2600], ['surprised', 1800], ['shy', 2400], ['dizzy', 2000], ['smug', 2400], ['playful', 2000], ['proud', 2200]];
        let pokeIndex = Math.floor(Math.random() * pokeFaces.length);
        button.addEventListener('click', () => {
            if (justDragged) return;
            pokeIndex = (pokeIndex + 1 + Math.floor(Math.random() * 3)) % pokeFaces.length;
            react(...pokeFaces[pokeIndex]);
            say(tips[tipIndex++ % tips.length], { ms: 7000, cta: true });
        });
        button.addEventListener('pointerenter', () => { if (!reactionTimer) react('playful', 1800); });

        /* ── Fields: listen while focused, work while typing, judge on leaving the field. ── */
        const isField = (el) => el && el.matches?.('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]), textarea, select');
        const ownField = (el) => el.closest?.('.gm-buddy');
        let typingTimer = 0;
        /* Each kind of field gets its own face: a password makes Strobi look away, a search makes it scan, a long message makes it concentrate. */
        const isSearch = (el) => el.type === 'search' || Boolean(el.closest?.('[role="search"]')) || /search/i.test(`${el.name || ''} ${el.id || ''} ${el.className || ''} ${el.getAttribute?.('aria-label') || ''}`);
        const fieldMood = (el) => (el.type === 'password' ? 'shy' : isSearch(el) ? 'searching' : el.tagName === 'TEXTAREA' ? 'focused' : 'listening');
        document.addEventListener('focusin', (event) => {
            if (isField(event.target) && !ownField(event.target)) setBase(fieldMood(event.target));
        });
        document.addEventListener('focusout', (event) => {
            if (!isField(event.target) || ownField(event.target)) return;
            setTimeout(() => { if (!isField(document.activeElement)) setBase(pageName === '404' ? 'sad' : 'idle'); }, 0);
            judge(event.target);
        });
        document.addEventListener('input', (event) => {
            if (!isField(event.target) || ownField(event.target)) return;
            clearTimeout(typingTimer);
            /* Plain fields: "working" while typing. Password, search and long-message fields keep their own face. */
            const mood = fieldMood(event.target);
            const typing = mood === 'listening' ? 'working' : mood;
            if (current !== typing) show(typing);
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
            if (target.matches('.site-theme-toggle, [data-theme-toggle]')) {
                /* The page has already switched theme by now: night mode makes Strobi yawn, day mode earns a wink. */
                const night = root.dataset.theme ? root.dataset.theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
                react(night ? 'yawn' : 'wink', night ? 2800 : 2000);
                return;
            }
            if (target.matches('.btn-primary, .nav-btn, .gm-consult-fab, [class*="cta"]')) { react('excited', 1800); return; }
            if (target.matches('summary, .faq-q, [aria-expanded]')) { react('curious', 1500); return; }
            react(Math.random() < .5 ? 'happy' : 'curious', 1200);
        });

        /* ── Idle: bored after 40s, a yawn at 65s, drowsy after 90s, asleep after 2.5 minutes.
              Any activity wakes it: a start from a doze, a stretch and blink from real sleep. ── */
        let idleTimer = 0;
        let yawnTimer = 0;
        let drowsyTimer = 0;
        let sleepTimer = 0;
        let resting = false;
        let asleep = false;
        function wake() {
            clearTimeout(idleTimer);
            clearTimeout(yawnTimer);
            clearTimeout(drowsyTimer);
            clearTimeout(sleepTimer);
            if (resting) {
                const wasAsleep = asleep;
                resting = false;
                asleep = false;
                setBase(pageName === '404' ? 'sad' : 'idle');
                react(wasAsleep ? 'waking' : 'surprised', wasAsleep ? 2000 : 1200);
            }
            idleTimer = setTimeout(() => { resting = true; setBase('bored'); }, 40000);
            yawnTimer = setTimeout(() => { if (resting) react('yawn', 3000); }, 65000);
            drowsyTimer = setTimeout(() => { resting = true; setBase('drowsy'); }, 90000);
            sleepTimer = setTimeout(() => { resting = true; asleep = true; setBase('sleeping'); }, 150000);
        }
        ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((type) => window.addEventListener(type, wake, { passive: true }));
        wake();

        /* ── Scrolling very fast (about five screens in a second) makes Strobi dizzy; at most once every 15 s. ── */
        let lastY = window.scrollY;
        let dist = 0;
        let distSince = 0;
        let dizzyAt = 0;
        window.addEventListener('scroll', () => {
            const now = performance.now();
            const y = window.scrollY;
            if (now - distSince > 1200) { distSince = now; dist = 0; }
            dist += Math.abs(y - lastY);
            lastY = y;
            if (dist > window.innerHeight * 5 && now - dizzyAt > 15000) { dizzyAt = now; dist = 0; react('dizzy', 2000); }
        }, { passive: true });

        /* ── Mouse heading out of the top of the window (about to leave): a nervous look. Desktop only. ── */
        document.addEventListener('mouseout', (event) => {
            if (!event.relatedTarget && event.clientY <= 0 && window.matchMedia('(pointer: fine)').matches && !reactionTimer) react('nervous', 1800);
        });

        /* ── Events from other parts of the site: a promo card slides in (wink), something was saved (love). ── */
        window.addEventListener('gm:promo', () => react('wink', 2400));
        window.addEventListener('gm:saved', () => react('love', 2800));

        /* ── Reaching the footer once: point at the newsletter box. ── */
        const footer = document.querySelector('footer.gm-footer, footer.footer, .footer');
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
                const country = pageName.match(/^study-in-([a-z-]+)$/)?.[1];
                const match = country && destinations.find(([, slug]) => slug === country);
                const message = pageName === '404'
                    ? 'Oops, this page went missing. Let’s get you back on track.'
                    : match
                        ? `Hi, I’m Strobi! Thinking about studying in ${match[0]}? Drag me onto any section and I’ll explain it.`
                        : 'Hi, I’m Strobi! Drag me onto anything on the page and I’ll explain it.';
                if (!reduced.matches) react('excited', 2600);
                say(message, { ms: 6500 });
            }, 3500);
        }
    }

    /* "Link to this tool": on each tool page, a ready-made plain HTML link and a citation line that other sites can paste into
       a resource page or blog post. A plain link (not an iframe) so the page that adds it really links to us. */
    function setupToolShare() {
        if (!isToolPage) return;
        const host = document.querySelector('main') || document.body;
        if (host.querySelector('.gm-share')) return;
        const url = document.querySelector('link[rel="canonical"]')?.href || window.location.href.split(/[?#]/)[0];
        const name = document.title.replace(/\s*[—|–-]\s*Gradmire.*$/i, '').trim() || 'Gradmire tool';
        const snippet = `<a href="${url}">${name} by Gradmire</a>`;
        const box = document.createElement('section');
        box.className = 'gm-share';
        box.setAttribute('aria-labelledby', 'gm-share-title');
        box.innerHTML = `
          <h2 id="gm-share-title">Link to this tool</h2>
          <p>Found it useful? Add it to a resource page, a blog post or a pre-arrival guide for students.</p>
          <label class="gm-share-label" for="gm-share-html">HTML link</label>
          <div class="gm-share-row">
            <textarea id="gm-share-html" readonly rows="2"></textarea>
            <button type="button" class="gm-share-copy">Copy link</button>
          </div>
          <p class="gm-share-note">Or cite it as: <span class="gm-share-cite"></span></p>
          <p class="gm-share-status" role="status" aria-live="polite"></p>`;
        box.querySelector('textarea').value = snippet;
        box.querySelector('.gm-share-cite').textContent = `“${name}”, Gradmire, ${url}`;
        const status = box.querySelector('.gm-share-status');
        box.querySelector('.gm-share-copy').addEventListener('click', async () => {
            const area = box.querySelector('textarea');
            try {
                await navigator.clipboard.writeText(area.value);
                status.textContent = 'Link copied.';
            } catch (_) {
                area.select();
                status.textContent = 'Press Ctrl+C (or Cmd+C) to copy the selected link.';
            }
        });
        box.querySelector('textarea').addEventListener('focus', (event) => event.target.select());
        host.appendChild(box);
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

    /* Inline lead forms (e.g. the MBBS pages): same checks and hand-off as the consult popup. */
    function setupInlineConsultForms() {
        document.querySelectorAll('form[data-consult-form]').forEach((form) => {
            const error = form.querySelector('[role="alert"]');
            form.addEventListener('submit', (event) => {
                event.preventDefault();
                const data = Object.fromEntries(new FormData(form).entries());
                const name = String(data.name || '').trim();
                const phoneOk = String(data.phone || '').replace(/[^\d]/g, '').length >= 10;
                const email = String(data.email || '').trim();
                const emailOk = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
                form.querySelectorAll('input').forEach((input) => input.removeAttribute('aria-invalid'));
                const bad = !name ? form.elements.name : !phoneOk ? form.elements.phone : !emailOk ? form.elements.email : null;
                if (bad) {
                    const problems = [!name && 'your name', !phoneOk && 'a valid phone number', !emailOk && 'a valid email or leave it blank'].filter(Boolean);
                    error.hidden = false;
                    error.textContent = `Please add ${problems.join(', ')}.`;
                    bad.setAttribute('aria-invalid', 'true');
                    bad.focus();
                    return;
                }
                const country = form.dataset.country || '';
                try {
                    sessionStorage.setItem('gradmire-consult-prefill', JSON.stringify({ name, phone: String(data.phone).trim(), email, destination: country, exam: form.dataset.exam || '', scholarship: form.dataset.scholarship || '' }));
                } catch (_) {}
                window.location.href = `${consultationPage(form.dataset.interest || 'counselling', country)}#book`;
            });
        });
    }

    /* Bachelor's / Master's filter on the scholarship pages. */
    function setupLevelFilters() {
        document.querySelectorAll('[data-level-filter]').forEach((group) => {
            const section = group.closest('section') || document;
            const items = [...section.querySelectorAll('[data-levels]')];
            const empty = section.querySelector('.gp-level-empty');
            group.addEventListener('click', (event) => {
                const button = event.target.closest('button[data-level]');
                if (!button) return;
                const level = button.dataset.level;
                group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
                let shown = 0;
                items.forEach((item) => {
                    const match = !level || item.dataset.levels.split(' ').includes(level);
                    item.hidden = !match;
                    if (match) shown += 1;
                });
                if (empty) empty.hidden = shown > 0;
            });
        });
    }

    function setupFooterSubscribe() {
        document.querySelectorAll('.footer-subscribe').forEach((form) => {
            const input = form.querySelector('input[type="email"]');
            const button = form.querySelector('button[type="submit"]');
            const msg = form.querySelector('.footer-subscribe-msg');
            const note = `Occasional study-abroad updates by email. Unsubscribe anytime. <a href="${page('privacy')}">Privacy</a>`;
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
        const policy = page('cookie-policy');
        const banner = document.createElement('section');
        banner.className = 'gm-consent';
        banner.setAttribute('aria-label', 'Cookie preferences');
        banner.hidden = true;
        banner.innerHTML = `
          <div class="gm-consent-main">
            <p class="gm-consent-title">Your privacy choices</p>
            <p class="gm-consent-text">We use essential storage to run this site. With your permission we'll also remember preferences, such as night mode and dismissed pop-ups. <span class="gm-consent-more">We don't use advertising cookies, and no analytics run unless you allow them.</span> <a href="${policy}">Cookie policy</a></p>
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
    setupPromoCards();
    setupToolShare();
    setupBuddy();
    setupFooterSubscribe();
    setupInlineConsultForms();
    setupLevelFilters();
})();
