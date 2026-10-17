/* Gradmire API client.
   The base URL comes from <meta name="gm-api-base" content="https://api.example.com">
   when a page sets one; local previews talk to the dev API on port 4000, and the
   deployed site calls the gradmire-api Vercel project, which allows this site's
   origin through FRONTEND_ORIGIN. */
(function () {
    'use strict';

    const PRODUCTION_API = 'https://gradmire-api.vercel.app';

    function apiBase() {
        const meta = document.querySelector('meta[name="gm-api-base"]');
        if (meta && meta.content) return meta.content.replace(/\/+$/, '');
        const host = location.hostname;
        if (location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1') return 'http://localhost:4000';
        return PRODUCTION_API;
    }

    async function submitLead(payload) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch(`${apiBase()}/api/v1/leads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
            return body.data;
        } finally {
            clearTimeout(timer);
        }
    }

    window.GradmireAPI = { submitLead };
})();
