/* Long-running background worker for hosts that keep a process alive
   (a VM, Render, Railway, a container). On Vercel use the cron endpoint
   instead: GET /api/v1/internal/jobs/run with "Authorization: Bearer $CRON_SECRET".
   Usage: DATABASE_URL=... npm run worker   (WORKER_INTERVAL_SECONDS, default 60) */
import { runDueJobs } from '../src/services/jobs.js';

const interval = Math.max(15, Number(process.env.WORKER_INTERVAL_SECONDS || 60)) * 1000;
let stopping = false;
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });

console.log(`Gradmire worker running every ${interval / 1000}s`);
while (!stopping) {
    try {
        const totals = await runDueJobs();
        const busy = totals.calendar.done + totals.calendar.failed + totals.notifications.sent + totals.notifications.failed + totals.notifications.skipped;
        if (busy) console.log(new Date().toISOString(), JSON.stringify(totals));
    } catch (error) {
        console.error('Worker pass failed:', error.message);
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
}
process.exit(0);
