// src/lib/archive.ts
// Phase 4 D-D-01..04 + OBSV-15 — retention + cold archive.
//
// Daily cron flow (src/app/api/cron/archive/route.ts):
//   1. findArchiveCandidates(100) → up to 100 session_ids with messages > 180d old
//   2. for each session_id: archiveSession(id)
//      - SELECT all messages for that session (regardless of age — full transcript)
//      - gzip JSONL → upload to Supabase Storage at archive/<yyyy>/<mm>/<id>.jsonl.gz
//      - DELETE messages WHERE session_id = ? AND created_at < now() - interval '180 days'
//   3. deleteClassifierFlags90d() — hard-purge 90d-old classifier-flagged rows
//
// Idempotent: storage upload uses upsert:true; DELETE on already-deleted rows is no-op.
//
// Pitfall 9: ALWAYS upload-first-then-delete. If upload fails, DELETE must NOT run —
// otherwise a transient Storage outage would silently destroy transcript data.
import { gzipSync } from 'zlib';
import { supabaseAdmin } from './supabase-server';
import { env } from './env';
import { log } from './logger';

const HOT_DAYS = 180;
const CLASSIFIER_RETENTION_DAYS = 90;

type MessageRow = Record<string, unknown>;

/** Build a gzip-compressed Buffer of newline-delimited JSON. */
export function buildJsonlGzip(rows: MessageRow[]): Buffer {
  const jsonl =
    rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length > 0 ? '\n' : '');
  return gzipSync(Buffer.from(jsonl, 'utf8'));
}

function archivePath(session_id: string, now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `archive/${year}/${month}/${session_id}.jsonl.gz`;
}

/** Upload to Supabase Storage. Returns false on error (logged); never throws. */
export async function uploadArchive(path: string, buffer: Buffer): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.storage
      .from(env.SUPABASE_STORAGE_ARCHIVE_BUCKET)
      .upload(path, buffer, {
        contentType: 'application/gzip',
        upsert: true,
      });
    if (error) {
      log(
        { event: 'archive_upload_failed', path, error_message: error.message },
        'error',
      );
      return false;
    }
    return true;
  } catch (err) {
    log(
      { event: 'archive_upload_failed', path, error_message: (err as Error).message },
      'error',
    );
    return false;
  }
}

/**
 * Returns up to maxSessions distinct session_ids that have at least one
 * message older than 180 days. Overshoots the row select to dedupe in Node;
 * the dedupe loop bails as soon as we hit maxSessions distinct values.
 */
export async function findArchiveCandidates(maxSessions = 100): Promise<string[]> {
  const cutoffISO = new Date(Date.now() - HOT_DAYS * 24 * 3600_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('session_id')
    .lt('created_at', cutoffISO)
    .limit(maxSessions * 100); // overshoot — dedupe in Node (we only need distinct ids)

  if (error || !data) {
    log(
      {
        event: 'archive_find_candidates_failed',
        error_message: error?.message ?? 'no data',
      },
      'error',
    );
    return [];
  }
  const seen = new Set<string>();
  for (const row of data as Array<{ session_id: string }>) {
    seen.add(row.session_id);
    if (seen.size >= maxSessions) break;
  }
  return Array.from(seen);
}

/**
 * Archive a single session: upload its full transcript (all messages, all
 * ages) to Storage, then DELETE the >180d-old rows. Idempotent re-runs.
 *
 * Order is upload-first-then-delete (Pitfall 9): a failed Storage upload
 * MUST never be allowed to delete the only copy of recruiter transcripts.
 */
export async function archiveSession(
  session_id: string,
): Promise<{ rows_archived: number; uploaded: boolean }> {
  // SELECT all messages for full transcript context, regardless of age.
  const { data: rows, error: selErr } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('session_id', session_id)
    .order('created_at', { ascending: true });

  if (selErr || !rows) {
    log(
      {
        event: 'archive_session_select_failed',
        session_id,
        error_message: selErr?.message ?? 'no data',
      },
      'error',
    );
    return { rows_archived: 0, uploaded: false };
  }

  if (rows.length === 0) {
    // Nothing to archive — already-archived session in a re-run.
    return { rows_archived: 0, uploaded: false };
  }

  // Step 1: upload to Storage (upsert:true → idempotent)
  const buffer = buildJsonlGzip(rows as MessageRow[]);
  const path = archivePath(session_id);
  const uploaded = await uploadArchive(path, buffer);

  if (!uploaded) {
    // Pitfall 9: do NOT delete if upload failed.
    return { rows_archived: 0, uploaded: false };
  }

  // Step 2: DELETE rows older than 180d (idempotent — already-deleted rows just no-op)
  const cutoffISO = new Date(Date.now() - HOT_DAYS * 24 * 3600_000).toISOString();
  const { error: delErr, count } = await supabaseAdmin
    .from('messages')
    .delete({ count: 'exact' })
    .eq('session_id', session_id)
    .lt('created_at', cutoffISO);

  if (delErr) {
    log(
      {
        event: 'archive_session_delete_failed',
        session_id,
        error_message: delErr.message,
      },
      'error',
    );
    return { rows_archived: 0, uploaded: true };
  }

  return { rows_archived: count ?? 0, uploaded: true };
}

/**
 * Hard-delete classifier-flagged + deflected rows older than 90d.
 *
 * Two parallel deletes — supabase-js doesn't have a clean way to OR across
 * `classifier_verdict NOT IN ('normal')` and `stop_reason LIKE 'deflection:%'`
 * in a single chain. Errors on one path don't kill the other.
 */
export async function deleteClassifierFlags90d(): Promise<number> {
  const cutoffISO = new Date(
    Date.now() - CLASSIFIER_RETENTION_DAYS * 24 * 3600_000,
  ).toISOString();

  const [classifierResult, deflectionResult] = await Promise.all([
    supabaseAdmin
      .from('messages')
      .delete({ count: 'exact' })
      .lt('created_at', cutoffISO)
      .not('classifier_verdict', 'is', null)
      .neq('classifier_verdict', 'normal'),
    supabaseAdmin
      .from('messages')
      .delete({ count: 'exact' })
      .lt('created_at', cutoffISO)
      .like('stop_reason', 'deflection:%'),
  ]);

  let total = 0;
  if (classifierResult.error) {
    log(
      {
        event: 'classifier_purge_failed',
        kind: 'classifier_verdict',
        error_message: classifierResult.error.message,
      },
      'error',
    );
  } else {
    total += classifierResult.count ?? 0;
  }
  if (deflectionResult.error) {
    log(
      {
        event: 'classifier_purge_failed',
        kind: 'deflection',
        error_message: deflectionResult.error.message,
      },
      'error',
    );
  } else {
    total += deflectionResult.count ?? 0;
  }
  return total;
}
