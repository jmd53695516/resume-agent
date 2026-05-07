// src/app/api/cron/check-alarms/route.ts
// Phase 4 D-C-07 + OBSV-09. Runs the 4-condition alarm sweep.
// Invoked every 5 min by cron-job.org (D-C-08). POST + Bearer-auth required.
//
// Idempotent at the alarm-fire layer (per-condition Redis NX suppression key
// with 1h TTL — see src/lib/alarms.ts claimAlarmSuppression). Multiple
// overlapping cron invocations or retries cannot send duplicate emails.
import { validateCronAuth } from '@/lib/cron-auth';
import { runAllAlarms } from '@/lib/alarms';
import { log } from '@/lib/logger';

// Vercel Hobby max function duration is 60s (RESEARCH §3 — `archive` cron
// constraint applies here too, though check-alarms is well under).
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  if (!validateCronAuth(req)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const started = Date.now();
  try {
    const results = await runAllAlarms();
    const fired_count = results.filter((r) => r.fired).length;
    log({
      event: 'cron_run',
      cron_name: 'check-alarms',
      duration_ms: Date.now() - started,
      status: 'ok',
      items_processed: fired_count,
    });
    return Response.json({ ok: true, results, fired_count });
  } catch (err) {
    log(
      {
        event: 'cron_run',
        cron_name: 'check-alarms',
        duration_ms: Date.now() - started,
        status: 'error',
        error_message: (err as Error).message,
      },
      'error',
    );
    return Response.json({ error: 'internal' }, { status: 500 });
  }
}
