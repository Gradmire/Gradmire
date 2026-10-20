/* One pass of background work. Safe to run concurrently from several places
   (cron, worker, inline after a booking): every queue is claimed with
   FOR UPDATE SKIP LOCKED and every external call is idempotent. */
import { query } from '../lib/db.js';
import { processCalendarJobs, reconcileCalendar } from './calendar-sync.js';
import { processNotifications } from './notification-service.js';
import { purgeOldRateLimits } from './rate-limit.js';

export async function runDueJobs({ maxBatches = 5 } = {}) {
    const totals = { calendarRequeued: 0, calendar: { done: 0, failed: 0, skipped: 0 }, notifications: { sent: 0, failed: 0, skipped: 0, cancelled: 0 } };
    totals.calendarRequeued = await reconcileCalendar();
    for (let i = 0; i < maxBatches; i += 1) {
        const calendar = await processCalendarJobs({ limit: 10 });
        const notifications = await processNotifications({ limit: 25 });
        for (const key of Object.keys(calendar)) totals.calendar[key] += calendar[key];
        for (const key of Object.keys(notifications)) totals.notifications[key] += notifications[key];
        const handled = Object.values(calendar).reduce((a, b) => a + b, 0) + Object.values(notifications).reduce((a, b) => a + b, 0);
        if (!handled) break;
    }
    await purgeOldRateLimits({ query });
    await query("DELETE FROM sessions WHERE expires_at < NOW() - INTERVAL '7 days' OR revoked_at < NOW() - INTERVAL '7 days'");
    return totals;
}
