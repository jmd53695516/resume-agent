// src/app/admin/(authed)/sessions/page.tsx
// Phase 4 OBSV-03 + D-B-05 + 04-UI-SPEC §3.
// Last 100 sessions; URL-driven sort by created_at | email_domain.
//
// Lives under (authed) route group — the parent layout calls requireAdmin()
// so unauthenticated visitors hit NotAuthorized; per-page requireAdmin()
// here is D-A-03 belt-and-suspenders (parallel routes / loading boundaries
// can skip layouts; the per-page check is authoritative).
//
// Freshness: `dynamic = 'force-dynamic'` ensures every navigation queries
// Supabase fresh. Do NOT add `revalidate = 60` — it's dead code under
// force-dynamic. AdminNav's manual Refresh re-renders on demand.
import { requireAdmin } from '@/lib/admin-auth';
import NotAuthorized from '../../components/NotAuthorized';
import { supabaseAdmin } from '@/lib/supabase-server';
import { SessionsTable, type SessionRow } from '../../components/SessionsTable';

export const dynamic = 'force-dynamic';

type SortBy = 'created_at' | 'email_domain';
type Dir = 'asc' | 'desc';

function parseSort(sp: Record<string, string | string[] | undefined>): {
  sort: SortBy;
  dir: Dir;
} {
  const raw = (Array.isArray(sp.sort) ? sp.sort[0] : sp.sort) ?? 'date';
  const rawDir = (Array.isArray(sp.dir) ? sp.dir[0] : sp.dir) ?? 'desc';
  const sort: SortBy = raw === 'domain' ? 'email_domain' : 'created_at';
  const dir: Dir = rawDir === 'asc' ? 'asc' : 'desc';
  return { sort, dir };
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  if (!admin) return <NotAuthorized />;

  const sp = await searchParams;
  const { sort, dir } = parseSort(sp);

  const { data, error } = await supabaseAdmin
    .from('sessions')
    .select('id, email, email_domain, created_at, flagged, total_cost_cents, turn_count')
    .order(sort, { ascending: dir === 'asc' })
    .limit(100);

  if (error) {
    return (
      <div>
        <h1 className="mb-4 text-xl font-semibold">Sessions</h1>
        <p className="text-sm text-destructive">Failed to load sessions: {error.message}</p>
      </div>
    );
  }

  const sessions = (data ?? []) as SessionRow[];

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Sessions</h1>
      <SessionsTable sessions={sessions} sort={sort} dir={dir} />
    </div>
  );
}
