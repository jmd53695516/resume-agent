// src/app/api/cron/archive/route.ts
// Phase 4 OBSV-15 + D-D-03..04. Daily 03:00 ET via cron-job.org.
//
// Two-step retention:
//   1. Archive: any session with messages > 180d → upload all rows as
//      gzipped JSONL to Supabase Storage, then DELETE the >180d rows. Up
//      to 100 sessions per run (Vercel Hobby 60s timeout, RESEARCH §3).
//   2. Classifier purge: hard-delete classifier-flagged or rate-limit
//      deflected messages older than 90d.
//
// Idempotent: rerun-safe via Storage upsert + already-deleted-no-op semantics.
// Error-resilient: per-session errors don't kill the cron — they're collected
// in `errors[]` and the run reports status: 'partial'. Only a top-level
// throw (e.g. findArchiveCandidates blowing up) returns 500.
import { validateCronAuth } from '@/lib/cron-auth';
import {
  findArchiveCandidates,
  archiveSession,
  deleteClassifierFlags90d,
} from '@/lib/archive';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  if (!validateCronAuth(req)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const started = Date.now();
  try {
    const candidates = await findArchiveCandidates(100);

    let sessions_archived = 0;
    let rows_archived = 0;
    const errors: string[] = [];

    for (const session_id of candidates) {
      try {
        const r = await archiveSession(session_id);
        if (r.uploaded) sessions_archived += 1;
        rows_archived += r.rows_archived;
      } catch (err) {
        errors.push(`${session_id}: ${(err as Error).message}`);
        // Continue — one bad session must not kill the cron
      }
    }

    // Classifier purge runs even when archive candidates are empty — they're
    // independent retention policies on overlapping data.
    const rows_deleted_classifier_90d = await deleteClassifierFlags90d();

    log({
      event: 'archive_run',
      sessions_archived,
      rows_archived,
      rows_deleted_classifier_90d,
      errors,
      duration_ms: Date.now() - started,
    });
    log({
      event: 'cron_run',
      cron_name: 'archive',
      duration_ms: Date.now() - started,
      status: errors.length > 0 ? 'partial' : 'ok',
      items_processed: sessions_archived,
    });

    return Response.json({
      ok: true,
      sessions_archived,
      rows_archived,
      rows_deleted_classifier_90d,
      errors,
    });
  } catch (err) {
    log(
      {
        event: 'cron_run',
        cron_name: 'archive',
        duration_ms: Date.now() - started,
        status: 'error',
        error_message: (err as Error).message,
      },
      'error',
    );
    return Response.json({ error: 'internal' }, { status: 500 });
  }
}
