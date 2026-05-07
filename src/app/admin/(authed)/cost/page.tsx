// src/app/admin/(authed)/cost/page.tsx
// Phase 4 OBSV-05 — rolling 24h/7d/30d cost dashboard.
// Live SUM queries (D-B-07) — no rollup tables in Phase 4.
//
// Freshness: `force-dynamic` makes every request SSR-fresh. Do NOT set
// `revalidate = 60` (dead code under force-dynamic). Manual refresh via
// AdminNav RefreshButton (Plan 04-03).
import { requireAdmin } from '@/lib/admin-auth';
import NotAuthorized from '../../components/NotAuthorized';
import { supabaseAdmin } from '@/lib/supabase-server';
import { CostCard, type CostWindowData } from '../../components/CostCard';

export const dynamic = 'force-dynamic';

type WindowKey = '24h' | '7d' | '30d';

function windowSinceISO(w: WindowKey): string {
  const now = Date.now();
  const ms =
    w === '24h' ? 24 * 3600_000 : w === '7d' ? 7 * 24 * 3600_000 : 30 * 24 * 3600_000;
  return new Date(now - ms).toISOString();
}

async function buildWindow(w: WindowKey): Promise<CostWindowData> {
  const since = windowSinceISO(w);
  // Pull all relevant assistant + tool rows in the window. At expected free-tier
  // volume (low thousands/month), this is cheap. If page-load > 300ms, switch
  // to pre-aggregated counters (D-B-07 escape hatch).
  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('cost_cents, tool_name, input_tokens, cache_read_tokens, role')
    .gte('created_at', since)
    .in('role', ['assistant', 'tool']);

  if (error || !data) {
    return {
      window: w,
      total_cents: 0,
      request_count: 0,
      per_tool: [],
      cache_read_tokens: 0,
      input_tokens: 0,
    };
  }

  let total_cents = 0;
  let request_count = 0;
  let cache_read_tokens = 0;
  let input_tokens = 0;
  const perTool = new Map<string, number>();

  for (const r of data as Array<{
    cost_cents: number | null;
    tool_name: string | null;
    input_tokens: number | null;
    cache_read_tokens: number | null;
    role: string;
  }>) {
    const cents = r.cost_cents ?? 0;
    total_cents += cents;
    if (r.role === 'assistant') request_count += 1;
    cache_read_tokens += r.cache_read_tokens ?? 0;
    input_tokens += r.input_tokens ?? 0;

    // Bucket by tool_name. Assistant rows without a tool_name go to '(no tool)'.
    const key = r.tool_name && r.tool_name.length > 0 ? r.tool_name : '(no tool)';
    if (cents > 0) {
      perTool.set(key, (perTool.get(key) ?? 0) + cents);
    }
  }

  const per_tool = Array.from(perTool.entries())
    .map(([tool_name, cost_cents]) => ({ tool_name, cost_cents }))
    .sort((a, b) => b.cost_cents - a.cost_cents);

  return { window: w, total_cents, request_count, per_tool, cache_read_tokens, input_tokens };
}

export default async function CostPage() {
  const admin = await requireAdmin();
  if (!admin) return <NotAuthorized />;

  const [w24, w7, w30] = await Promise.all([
    buildWindow('24h'),
    buildWindow('7d'),
    buildWindow('30d'),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Cost</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <CostCard data={w24} />
        <CostCard data={w7} />
        <CostCard data={w30} />
      </div>
    </div>
  );
}
