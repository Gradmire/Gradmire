/* Touch polish for the mobile app layer (phones only, loaded with defer by scripts/sync-mobile-app.mjs).
   Everything here is optional: the tab bar, layout and press feedback are plain HTML and CSS and work without it.
   Ports of React Bits patterns: Spotlight Card (glow follows the finger) and Animated List (staggered reveal).
   It runs when the browser is idle and reads layout only through IntersectionObserver, so it never forces a reflow. */
(function () {
    'use strict';
    var phone = window.matchMedia('(max-width: 760px)');
    if (!phone.matches) return;
    var root = document.documentElement;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var idle = window.requestIdleCallback ? function (fn) { window.requestIdleCallback(fn, { timeout: 2500 }); } : function (fn) { window.setTimeout(fn, 200); };

    /* ── Tab bar (handlers are cheap and wired straight away) ── */
    var bar = document.querySelector('.gm-tabbar');
    if (bar) {
        bar.addEventListener('click', function (event) {
            var tab = event.target.closest('.gm-tab');
            if (!tab) return;
            if (navigator.vibrate && !reduce) { try { navigator.vibrate(6); } catch (_) { /* ignore */ } }
            /* "Menu" opens the site menu (hamburger) when there is one; without it the link goes to About. */
            if (tab.hasAttribute('data-gm-menu')) {
                var ham = document.querySelector('.nav-ham');
                /* stopPropagation: the menu closes on any click outside it, and this tab sits outside it. */
                if (ham) { event.preventDefault(); event.stopPropagation(); ham.click(); }
                return;
            }
            /* Tapping the current tab scrolls to the top. */
            if (tab.getAttribute('aria-current') === 'page' && !tab.hasAttribute('data-open-consult')) {
                event.preventDefault();
                window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
            }
        });
    }

    /* The Menu tab shows an open/closed state, because the header has no menu button on phones. */
    var menuTab = bar && bar.querySelector('[data-gm-menu]');
    if (menuTab && 'MutationObserver' in window) {
        var syncMenuTab = function () {
            var open = root.classList.contains('nav-open');
            menuTab.classList.toggle('is-open', open);
            menuTab.setAttribute('aria-expanded', String(open));
            menuTab.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
        };
        new MutationObserver(syncMenuTab).observe(root, { attributes: true, attributeFilter: ['class'] });
        syncMenuTab();
    }

    /* ── Keyboard: hide the tab bar while a field is being typed in, so it never floats over the keyboard ── */
    if (window.visualViewport) {
        var base = window.innerHeight;
        var vv = window.visualViewport;
        var check = function () {
            if (window.innerHeight > base) base = window.innerHeight;
            root.classList.toggle('gm-kb', vv.height < base * 0.75);
        };
        vv.addEventListener('resize', check);
        window.addEventListener('orientationchange', function () { setTimeout(function () { base = window.innerHeight; check(); }, 400); });
    }

    idle(function () {
        /* ── Spotlight Card: a soft glow under the finger ── */
        document.querySelectorAll('.gp-card, .bl-card, .gp-tile, .uni-card').forEach(function (el) { el.classList.add('gm-spot'); });
        var lit = null, litTimer = 0;
        var glow = function (event) {
            var el = event.target.closest && event.target.closest('.gm-spot');
            if (!el) return;
            var box = el.getBoundingClientRect();
            el.style.setProperty('--mx', (event.clientX - box.left) + 'px');
            el.style.setProperty('--my', (event.clientY - box.top) + 'px');
            if (lit !== el) { if (lit) lit.classList.remove('is-lit'); lit = el; }
            el.classList.add('is-lit');
            clearTimeout(litTimer);
        };
        var dim = function () {
            clearTimeout(litTimer);
            litTimer = setTimeout(function () { if (lit) { lit.classList.remove('is-lit'); lit = null; } }, 280);
        };
        document.addEventListener('pointerdown', glow, { passive: true });
        document.addEventListener('pointermove', function (e) { if (lit && e.pressure > 0) glow(e); }, { passive: true });
        ['pointerup', 'pointercancel'].forEach(function (type) { document.addEventListener(type, dim, { passive: true }); });

        /* ── Animated List: cards that start below the first screen rise in one by one.
              The first observer callback tells us which cards are below the fold; only those are hidden, so nothing
              on the first screen is ever delayed, and no layout is read synchronously. ── */
        if (reduce || !('IntersectionObserver' in window)) return;
        var run = 0, lastParent = null;
        var seen = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                var el = entry.target;
                if (entry.isIntersecting) {
                    if (el.classList.contains('gm-pre')) {
                        el.style.setProperty('--i', String(Math.min(Number(el.dataset.gmI || 0), 4)));
                        el.classList.add('gm-in');
                    }
                    seen.unobserve(el);
                } else if (entry.boundingClientRect.top > (entry.rootBounds ? entry.rootBounds.height : window.innerHeight) && !el.classList.contains('gm-pre')) {
                    el.dataset.gmI = String(run = el.parentNode === lastParent ? run + 1 : 0);
                    lastParent = el.parentNode;
                    el.classList.add('gm-pre');
                }
            });
        }, { rootMargin: '0px 0px -8% 0px' });
        document.querySelectorAll('.bl-card, .gp-card, .gp-tile, .gp-steps > li').forEach(function (el) { seen.observe(el); });
    });
})();
