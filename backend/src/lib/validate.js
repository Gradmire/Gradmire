/* Field-by-field validation that collects every problem, so forms can show
   errors next to the right inputs. Only whitelisted fields are ever read. */
import { badRequest } from './http.js';
import { isValidTimeZone } from './time.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Control characters other than tab/newline are stripped from free text.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const isUuid = (value) => typeof value === 'string' && UUID_PATTERN.test(value);

export function createValidator(body) {
    const fields = {};
    const out = {};
    const source = body && typeof body === 'object' ? body : {};

    const fail = (name, message) => {
        if (!fields[name]) fields[name] = message;
    };

    const api = {
        text(name, { required = false, max = 200, min = 0, label = name, as = name } = {}) {
            const raw = source[name];
            if (raw === undefined || raw === null || raw === '') {
                if (required) fail(name, `${label} is required`);
                return api;
            }
            if (typeof raw !== 'string' && typeof raw !== 'number') {
                fail(name, `${label} must be text`);
                return api;
            }
            const value = String(raw).replace(CONTROL, '').trim();
            if (!value) {
                if (required) fail(name, `${label} is required`);
            } else if (value.length > max) {
                fail(name, `${label} must be at most ${max} characters`);
            } else if (value.length < min) {
                fail(name, `${label} must be at least ${min} characters`);
            } else {
                out[as] = value;
            }
            return api;
        },
        email(name, { required = true, label = 'Email address' } = {}) {
            api.text(name, { required, max: 320, label });
            if (out[name] !== undefined) {
                if (!EMAIL_PATTERN.test(out[name])) {
                    fail(name, 'Enter a valid email address');
                    delete out[name];
                } else {
                    out[name] = out[name].toLowerCase();
                }
            }
            return api;
        },
        /* International format: + then 7–15 digits (spaces, dashes, dots and brackets are ignored). */
        phone(name, { required = true, label = 'Phone number' } = {}) {
            api.text(name, { required, max: 30, label });
            if (out[name] !== undefined) {
                const digits = out[name].replace(/[\s().-]/g, '');
                if (!/^\+[1-9]\d{6,14}$/.test(digits)) {
                    fail(name, 'Enter the phone number with its country code, e.g. +91 98765 43210');
                    delete out[name];
                } else {
                    out[name] = digits;
                }
            }
            return api;
        },
        oneOf(name, allowed, { required = false, label = name } = {}) {
            const raw = source[name];
            if (raw === undefined || raw === null || raw === '') {
                if (required) fail(name, `${label} is required`);
            } else if (!allowed.includes(raw)) {
                fail(name, `${label} is not a valid option`);
            } else {
                out[name] = raw;
            }
            return api;
        },
        uuid(name, { required = false, label = name } = {}) {
            const raw = source[name];
            if (raw === undefined || raw === null || raw === '') {
                if (required) fail(name, `${label} is required`);
            } else if (!isUuid(raw)) {
                fail(name, `${label} is not valid`);
            } else {
                out[name] = raw.toLowerCase();
            }
            return api;
        },
        boolean(name, { mustBeTrue = false, message, defaultValue = false } = {}) {
            const raw = source[name];
            if (raw === undefined || raw === null) {
                out[name] = defaultValue;
            } else if (typeof raw !== 'boolean') {
                fail(name, `${name} must be true or false`);
            } else {
                out[name] = raw;
            }
            if (mustBeTrue && out[name] !== true) fail(name, message || `${name} is required`);
            return api;
        },
        instant(name, { required = true, label = 'Time' } = {}) {
            const raw = source[name];
            if (raw === undefined || raw === null || raw === '') {
                if (required) fail(name, `${label} is required`);
                return api;
            }
            // Require an explicit offset so the client's local time is never guessed.
            if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(raw)) {
                fail(name, `${label} must be an ISO 8601 date-time with a timezone offset`);
                return api;
            }
            const date = new Date(raw);
            if (Number.isNaN(date.getTime())) fail(name, `${label} is not a valid date-time`);
            else out[name] = date;
            return api;
        },
        timeZone(name, { required = true } = {}) {
            const raw = source[name];
            if (raw === undefined || raw === null || raw === '') {
                if (required) fail(name, 'Timezone is required');
            } else if (!isValidTimeZone(raw)) {
                fail(name, 'Timezone is not a recognised IANA timezone, e.g. Asia/Kolkata');
            } else {
                out[name] = raw;
            }
            return api;
        },
        password(name) {
            const raw = source[name];
            if (typeof raw !== 'string' || raw.length === 0) fail(name, 'Password is required');
            else if (raw.length < 8) fail(name, 'Password must be at least 8 characters');
            else if (raw.length > 200) fail(name, 'Password must be at most 200 characters');
            else out[name] = raw;
            return api;
        },
        check(condition, name, message) {
            if (!condition) fail(name, message);
            return api;
        },
        get value() {
            return out;
        },
        get errors() {
            return fields;
        },
        /* Throws a 400 listing every field problem, or returns the clean values. */
        done() {
            const names = Object.keys(fields);
            if (names.length) throw badRequest(fields[names[0]], { fields });
            return out;
        },
    };
    return api;
}
