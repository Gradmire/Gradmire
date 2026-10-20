/* "Continue with Google" on the login and sign-up pages, using Google Identity
   Services. Google gives the browser a signed ID token; we send it to our API,
   which verifies it and starts a normal session. Nothing from Google is
   trusted in the browser. If GOOGLE_CLIENT_ID is not set on the API, the
   button explains that Google sign-in is not available yet. */
(function () {
    'use strict';

    const button = document.querySelector('.btn-google');
    if (!button || !window.GradmireAPI) return;
    const isSignup = Boolean(document.getElementById('signup-form'));
    button.type = 'button';

    const status = document.createElement('p');
    status.setAttribute('role', 'alert');
    status.hidden = true;
    status.style.cssText = 'margin:.6rem 0 0;font-size:.82rem;font-weight:600;color:#C0392B;text-align:center;';
    button.insertAdjacentElement('afterend', status);
    const say = (message) => {
        status.textContent = message;
        status.hidden = !message;
    };

    let pendingCredential = null;

    function goHome(user) {
        const next = new URLSearchParams(location.search).get('next');
        window.location.href = GradmireAPI.safeNext(next, user.home || 'dashboard.html');
    }

    /* Login page only: a first-time Google user confirms their age before we create the account. */
    function askForConsent() {
        if (document.getElementById('google-consent')) return;
        const box = document.createElement('div');
        box.id = 'google-consent';
        box.style.cssText = 'margin-top:.8rem;padding:.9rem 1rem;border:1px solid var(--border, #ddd);border-radius:12px;font-size:.85rem;';
        box.innerHTML = '<p style="margin:0 0 .5rem;font-weight:700">New to Gradmire? We will create your account.</p>'
            + '<label style="display:flex;gap:.5rem;align-items:flex-start"><input type="checkbox" id="google-age"> <span>I am 18 or older, or my parent or guardian has agreed to me creating this account.</span></label>'
            + '<button type="button" class="btn btn-primary" id="google-create" style="margin-top:.7rem;width:100%">Create my account</button>';
        status.insertAdjacentElement('afterend', box);
        document.getElementById('google-create').addEventListener('click', () => {
            if (!document.getElementById('google-age').checked) {
                say('Please confirm your age, or ask a parent or guardian to sign up with you.');
                return;
            }
            send(pendingCredential, true);
        });
    }

    async function send(credential, ageConfirmation) {
        say('');
        try {
            const data = await GradmireAPI.request('POST', '/api/v1/auth/google', { credential, ageConfirmation });
            goHome(data.user);
        } catch (error) {
            if (error.code === 'GOOGLE_SIGNUP_NEEDS_CONSENT') {
                pendingCredential = credential;
                if (isSignup) say('Please tick the age confirmation above, then choose Google again.');
                else askForConsent();
                return;
            }
            say(error.message);
        }
    }

    function onCredential(response) {
        if (isSignup) {
            const age = document.getElementById('age-confirm');
            if (age && !age.checked) {
                document.getElementById('age-error').hidden = false;
                age.focus();
                say('Please confirm your age above, then choose Google again.');
                return;
            }
            send(response.credential, true);
        } else {
            send(response.credential, false);
        }
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = resolve;
            script.onerror = () => reject(new Error('Google sign-in could not load. Check your connection or ad blocker.'));
            document.head.appendChild(script);
        });
    }

    function unavailable(message) {
        button.addEventListener('click', () => say(message));
    }

    GradmireAPI.request('GET', '/api/v1/auth/google/config').then(async (config) => {
        if (!config.enabled || !config.clientId) {
            unavailable('Google sign-in is not available yet. Please use your email and password.');
            return;
        }
        try {
            await loadScript('https://accounts.google.com/gsi/client');
        } catch (error) {
            unavailable(error.message);
            return;
        }
        google.accounts.id.initialize({ client_id: config.clientId, callback: onCredential, ux_mode: 'popup', context: isSignup ? 'signup' : 'signin', cancel_on_tap_outside: true });
        const holder = document.createElement('div');
        holder.style.cssText = 'display:flex;justify-content:center;min-height:44px';
        button.insertAdjacentElement('beforebegin', holder);
        google.accounts.id.renderButton(holder, {
            theme: document.documentElement.dataset.theme === 'dark' ? 'filled_black' : 'outline',
            size: 'large', shape: 'pill', text: isSignup ? 'signup_with' : 'continue_with',
            width: Math.min(400, Math.max(240, button.offsetWidth || 320)),
        });
        button.hidden = true;
    }).catch(() => unavailable('Google sign-in is not available right now. Please use your email and password.'));
})();
