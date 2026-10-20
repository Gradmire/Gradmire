/* Unit tests for the timezone helpers (no database). */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayBounds, isValidTimeZone, parseDateOnly, zonedParts, zonedTimeToUtc } from '../src/lib/time.js';

test('wall-clock to UTC in fixed and DST zones', () => {
    assert.equal(zonedTimeToUtc({ year: 2026, month: 11, day: 3, hour: 10, minute: 0 }, 'Asia/Kolkata').toISOString(), '2026-11-03T04:30:00.000Z');
    assert.equal(zonedTimeToUtc({ year: 2026, month: 7, day: 1, hour: 9, minute: 0 }, 'Europe/London').toISOString(), '2026-07-01T08:00:00.000Z');
    assert.equal(zonedTimeToUtc({ year: 2026, month: 12, day: 1, hour: 9, minute: 0 }, 'Europe/London').toISOString(), '2026-12-01T09:00:00.000Z');
    // 02:30 on 8 March 2026 does not exist in New York (clocks jump 02:00 → 03:00).
    assert.equal(zonedTimeToUtc({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }, 'America/New_York'), null);
    // 01:30 on 1 Nov 2026 happens twice in New York; we pick a real instant that reads 01:30.
    const ambiguous = zonedTimeToUtc({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }, 'America/New_York');
    assert.equal(zonedParts(ambiguous, 'America/New_York').hour, 1);
});

test('day bounds cover 23- and 25-hour days', () => {
    const spring = dayBounds({ year: 2026, month: 3, day: 8 }, 'America/New_York');
    assert.equal((spring.end - spring.start) / 3600_000, 23);
    const autumn = dayBounds({ year: 2026, month: 11, day: 1 }, 'America/New_York');
    assert.equal((autumn.end - autumn.start) / 3600_000, 25);
});

test('validation of dates and zones', () => {
    assert.ok(isValidTimeZone('Asia/Kolkata'));
    assert.ok(!isValidTimeZone('Asia/Atlantis'));
    assert.ok(!isValidTimeZone('../etc/passwd'));
    assert.deepEqual(parseDateOnly('2026-11-03'), { year: 2026, month: 11, day: 3 });
    assert.equal(parseDateOnly('2026-02-29'), null);
    assert.equal(parseDateOnly('03/11/2026'), null);
});
