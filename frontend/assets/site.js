(() => {
    const root = document.documentElement;
    const isToolPage = /\/tools\//.test(window.location.pathname);
    const pagePrefix = isToolPage ? '../' : '';
    const page = (name) => `${pagePrefix}${name}`;

    const navItems = [
        `<li><a href="${page('destinations.html')}">Destinations</a></li>`,
        `<li><a href="${page('find-courses.html')}">Courses</a></li>`,
        `<li><a href="${page('find-universities.html')}">Universities</a></li>`,
        `<li><a href="${page('scholarships.html')}">Scholarships</a></li>`,
        `<li class="nav-dropdown">
      <button type="button" aria-haspopup="true">Explore
        <svg class="nav-dropdown-chevron" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m2.25 4.5 3.75 3 3.75-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="nav-dropdown-menu" role="menu">
        <span class="nav-dropdown-label">Tools</span>
        <a href="${page('tools/roi-calculator.html')}" role="menuitem">ROI calculator</a>
        <a href="${page('tools/comparator.html')}" role="menuitem">University comparator</a>
        <a href="${page('tools/deadline-tracker.html')}" role="menuitem">Deadline tracker</a>
        <span class="nav-dropdown-label">More</span>
        <a href="${page('events.html')}" role="menuitem">Events</a>
        <a href="${page('faq.html')}" role="menuitem">FAQ</a>
      </div>
    </li>`,
        `<li><a href="${page('about.html')}">About</a></li>`
    ];

    const mobileItems = [
        ...navItems,
        `<li><a href="${page('login.html')}">Log in</a></li>`,
        `<li><a href="${page('free-consultation.html')}" class="btn btn-primary">Free consultation</a></li>`
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
        const existing = document.querySelector('.site-theme-toggle');
        if (existing) return;
        const toggle = document.createElement('button');
        toggle.className = 'site-theme-toggle';
        toggle.type = 'button';
        toggle.innerHTML = `${icon('sun')}${icon('moon')}`;
        toggle.addEventListener('click', () => {
            const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
            localStorage.setItem('gradmire-theme', next);
            applyTheme(next);
        });
        const navInner = document.querySelector('.nav-inner');
        const hamburger = navInner ? navInner.querySelector('.nav-ham') : null;
        if (navInner) navInner.insertBefore(toggle, hamburger || null);
    }

    function setupNavigation() {
        const nav = document.querySelector('.nav');
        const navInner = nav ? nav.querySelector('.nav-inner') : null;
        const navTarget = navInner || nav;
        if (navTarget && !navTarget.querySelector('.nav-ham')) {
            const ham = document.createElement('button');
            ham.className = 'nav-ham';
            ham.type = 'button';
            ham.setAttribute('aria-label', 'Open menu');
            ham.setAttribute('aria-expanded', 'false');
            ham.innerHTML = '<svg width="22" height="16" viewBox="0 0 22 16" fill="none" aria-hidden="true"><rect y="0" width="22" height="2" rx="1" fill="currentColor"/><rect y="7" width="22" height="2" rx="1" fill="currentColor"/><rect y="14" width="22" height="2" rx="1" fill="currentColor"/></svg>';
            navTarget.appendChild(ham);
        }

        const links = document.querySelector('.nav-links');
        if (links) links.innerHTML = navItems.join('');

        let mobile = document.querySelector('.nav-mobile');
        if (nav && !mobile) {
            mobile = document.createElement('div');
            mobile.className = 'nav-mobile';
            mobile.setAttribute('aria-label', 'Mobile navigation');
            nav.insertAdjacentElement('afterend', mobile);
        }
        if (mobile) {
            mobile.innerHTML = `<ul class="nav-mobile-links" role="list">${mobileItems.join('')}</ul>`;
        }

        const ham = document.querySelector('.nav-ham');
        const mobilePanel = document.querySelector('.nav-mobile');
        if (ham && mobilePanel) {
            ham.setAttribute('aria-expanded', 'false');
            ham.addEventListener('click', () => {
                const open = mobilePanel.classList.toggle('is-open');
                ham.setAttribute('aria-expanded', String(open));
                ham.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
            });
            mobilePanel.addEventListener('click', (event) => {
                if (event.target.closest('a')) {
                    mobilePanel.classList.remove('is-open');
                    ham.setAttribute('aria-expanded', 'false');
                    ham.setAttribute('aria-label', 'Open menu');
                }
            });
        }
    }

    const savedTheme = localStorage.getItem('gradmire-theme') || 'light';
    applyTheme(savedTheme);
    setupNavigation();
    setupThemeToggle();
    applyTheme(savedTheme);
})();