/* Timezone arithmetic with Intl only (no dependency). Every instant is a UTC
   Date; wall-clock values are { year, month, day, hour, minute } in a named
   IANA zone. */

const formatters = new Map();
function formatter(timeZone) {
    let value = formatters.get(timeZone);
    if (!value) {
        value = new Intl.DateTimeFormat('en-US', {
            timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
        });
        formatters.set(timeZone, value);
    }
    return value;
}

const validZones = new Map();
export function isValidTimeZone(timeZone) {
    if (typeof timeZone !== 'string' || timeZone.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(timeZone)) return false;
    if (validZones.has(timeZone)) return validZones.get(timeZone);
    let valid;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone }).format(0);
        valid = true;
    } catch {
        valid = false;
    }
    validZones.set(timeZone, valid);
    return valid;
}

const WEEKDAYS = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/* Wall-clock parts of an instant in a zone; weekday is ISO (1 = Monday). */
export function zonedParts(date, timeZone) {
    const parts = {};
    for (const { type, value } of formatter(timeZone).formatToParts(date)) parts[type] = value;
    return {
        year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
        hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second),
        weekday: WEEKDAYS[parts.weekday],
    };
}

function offsetMs(date, timeZone) {
    const p = zonedParts(date, timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return asUtc - (date.getTime() - date.getMilliseconds());
}

/* The UTC instant for a wall-clock time in a zone. Returns null when that wall
   time does not exist (skipped by a daylight-saving jump). */
export function zonedTimeToUtc({ year, month, day, hour = 0, minute = 0 }, timeZone) {
    const guess = Date.UTC(year, month - 1, day, hour, minute);
    let instant = guess - offsetMs(new Date(guess), timeZone);
    const second = guess - offsetMs(new Date(instant), timeZone);
    if (second !== instant) instant = second;
    const check = zonedParts(new Date(instant), timeZone);
    if (check.hour !== hour || check.minute !== minute || check.day !== day) return null;
    return new Date(instant);
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
export function parseDateOnly(value) {
    const match = DATE_PATTERN.exec(String(value || ''));
    if (!match) return null;
    const [year, month, day] = match.slice(1).map(Number);
    const check = new Date(Date.UTC(year, month - 1, day));
    if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
    return { year, month, day };
}

export const formatDateOnly = ({ year, month, day }) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export function addDays({ year, month, day }, days) {
    const date = new Date(Date.UTC(year, month - 1, day + days));
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/* ISO weekday (1 = Monday) of a calendar date. */
export function isoWeekday({ year, month, day }) {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return weekday === 0 ? 7 : weekday;
}

/* 'HH:MM' or 'HH:MM:SS' → { hour, minute } */
export function parseTimeOfDay(value) {
    const match = /^([01]\d|2[0-3]):([0-5]\d)(?::00)?$/.exec(String(value || ''));
    return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
}

/* Start and end (exclusive) instants of a calendar date in a zone. */
export function dayBounds(date, timeZone) {
    const start = zonedTimeToUtc({ ...date, hour: 0, minute: 0 }, timeZone) || zonedTimeToUtc({ ...date, hour: 1, minute: 0 }, timeZone);
    const next = addDays(date, 1);
    const end = zonedTimeToUtc({ ...next, hour: 0, minute: 0 }, timeZone) || zonedTimeToUtc({ ...next, hour: 1, minute: 0 }, timeZone);
    return { start, end };
}

export const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60_000);
export const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;
