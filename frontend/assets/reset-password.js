/* Password reset: ask for a link, or (opened from the email, #token=…) set a
   new password. The token is read from the URL fragment, removed from the
   address bar and only sent in a POST body. */
(function () {
    'use strict';

    const alertEl = document.getElementById('rp-alert');
    const requestForm = document.getElementById('rp-request');
    const confirmForm = document.getElementById('rp-confirm');
    const say = (message, ok) => {
        alertEl.textContent = message;
        alertEl.className = `bk-alert${ok ? ' bk-alert--ok' : ''}`;
        alertEl.hidden = !message;
    };

    const token = new URLSearchParams(location.hash.slice(1)).get('token');
    if (location.hash) history.replaceState(null, '', location.pathname);
    if (token) {
        requestForm.hidden = true;
        confirmForm.hidden = false;
    }

    requestForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = requestForm.elements.email.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say('Enter a valid email address.');
        const button = requestForm.querySelector('button');
        button.disabled = true;
        try {
            await GradmireAPI.request('POST', '/api/v1/auth/password-reset/request', { email });
            say('If an account uses that address, a reset link is on its way. Check your inbox and spam folder.', true);
            requestForm.reset();
        } catch (error) {
            say(error.message);
        } finally {
            button.disabled = false;
        }
    });

    confirmForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const password = confirmForm.elements.password.value;
        if (password.length < 8) return say('Use a password of at least 8 characters.');
        if (password !== confirmForm.elements.repeat.value) return say('The two passwords do not match.');
        const button = confirmForm.querySelector('button');
        button.disabled = true;
        try {
            await GradmireAPI.request('POST', '/api/v1/auth/password-reset/confirm', { token, password });
            confirmForm.hidden = true;
            say('Your password was changed and every device was signed out. You can log in with the new password now.', true);
        } catch (error) {
            say(error.message);
            if (error.code === 'INVALID_TOKEN') {
                confirmForm.hidden = true;
                requestForm.hidden = false;
            }
        } finally {
            button.disabled = false;
        }
    });
})();
