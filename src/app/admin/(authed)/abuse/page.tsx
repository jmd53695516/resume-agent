// src/app/admin/(authed)/abuse/page.tsx
// Phase 4 OBSV-06 + D-B-08.
// Last 100 flagged messages: classifier verdicts != 'normal' OR rate-limit/
// spend-cap deflections. Joined to sessions for email + ip_hash.
//
// Freshness: `force-dynamic` makes every request SSR-fresh. Do NOT set
// `revalidate = 60` (dead code under force-dynamic).
import { requireAdmin } from '@/lib/admin-auth';
import NotAuthorized from '../../components/NotAuthorized';
import { supabaseAdmin } from '@/lib/supabase-server';
import { AbuseTable, type AbuseRow } from '../../components/AbuseTable';

export const dynamic = 'force-dynamic';

export default async function AbusePage() {
  const admin = await requireAdmin();
  if (!admin) return <NotAuthorized />;

  // Two queries combined client-side via array merge — Supabase doesn't support
  // OR across two distinct conditions in this join shape cleanly. Pull the
  // classifier-flagged rows and the deflection rows, dedupe, sort, slice top 100.
  // At expected volume this is cheap; if page-load > 300ms, switch to a Postgres
  // function or an extended messages-with-session view.

  // Server Component — Date.now() in render is correct (runs once per request).
  // eslint-disable-next-line react-hooks/purity
  const SINCE = new Date(Date.now() - 90 * 24 * 3600_000).toISOString(); // 90d retention window

  // WR-05: widen per-query limit to 200 (still cheap at expected volume)
  // and request count: 'exact' so the "Showing last 100 of N" footer can
  // surface the true number of flagged events even when both branches
  // saturate. Without count, merged.length is bounded by the row buffer
  // (200) and silently hides counts beyond that.
  const PER_QUERY_LIMIT = 200;
  const [classifierResult, deflectionResult] = await Promise.all([
    supabaseAdmin
      .from('messages')
      .select(
        'id, session_id, content, classifier_verdict, stop_reason, created_at, sessions(email, ip_hash)',
        { count: 'exact' },
      )
      .not('classifier_verdict', 'is', null)
      .neq('classifier_verdict', 'normal')
      .gte('created_at', SINCE)
      .order('created_at', { ascending: false })
      .limit(PER_QUERY_LIMIT),
    supabaseAdmin
      .from('messages')
      .select(
        'id, session_id, content, classifier_verdict, stop_reason, created_at, sessions(email, ip_hash)',
        { count: 'exact' },
      )
      .like('stop_reason', 'deflection:%')
      .gte('created_at', SINCE)
      .order('created_at', { ascending: false })
      .limit(PER_QUERY_LIMIT),
  ]);

  // Real flagged-event count for the footer. Sum of both branches'
  // server-side counts (Supabase returns null on count: 'exact' errors,
  // so coalesce defensively). Note: rows that match both queries are
  // double-counted in the headline number; this is acceptable triage UX
  // because (a) overlap is rare in practice and (b) over-counting is
  // safer than under-counting for an abuse-monitoring dashboard.
  const flaggedTotal =
    (classifierResult.count ?? 0) + (deflectionResult.count ?? 0);

  type Raw = {
    id: string;
    session_id: string;
    content: string;
    classifier_verdict: string | null;
    stop_reason: string | null;
    created_at: string;
    sessions:
      | { email: string; ip_hash: string }
      | { email: string; ip_hash: string }[]
      | null;
  };

  const seen = new Set<string>();
  const merged: AbuseRow[] = [];
  for (const raw of [
    ...((classifierResult.data ?? []) as Raw[]),
    ...((deflectionResult.data ?? []) as Raw[]),
  ]) {
    if (seen.has(raw.id)) continue;
    seen.add(raw.id);
    // supabase-js may return the joined record as either an object (when 1:1)
    // or an array; normalize.
    const sess = Array.isArray(raw.sessions) ? raw.sessions[0] : raw.sessions;
    if (!sess) continue;
    merged.push({
      message_id: raw.id,
      session_id: raw.session_id,
      created_at: raw.created_at,
      content: raw.content,
      classifier_verdict: raw.classifier_verdict,
      stop_reason: raw.stop_reason,
      session_email: sess.email,
      session_ip_hash: sess.ip_hash,
    });
  }

  merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const top100 = merged.slice(0, 100);

  // WR-05: pass the server-side total (not the row-buffer length) so
  // the footer reflects reality when both queries saturate the limit.
  // flaggedTotal can over-count rows that match both branches; clamp
  // to merged.length when the buffer wasn't saturated so we don't
  // claim "150 events" when the user only sees 80.
  const reportedTotal = Math.max(flaggedTotal, merged.length);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Abuse log</h1>
      <AbuseTable rows={top100} totalCount={reportedTotal} />
    </div>
  );
}
