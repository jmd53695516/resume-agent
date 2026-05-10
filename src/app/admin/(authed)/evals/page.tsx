// src/app/admin/(authed)/evals/page.tsx
//
// Phase 5 Plan 05-09 Task 2 — Admin eval-runs index (EVAL-14 storage UI).
//
// Path correction (Rule 3 — execute-plan.md): plan frontmatter listed
// `src/app/(authed)/admin/evals/page.tsx`. Actual repo convention since
// Phase 4 is `src/app/admin/(authed)/evals/page.tsx` (the admin layout
// at `src/app/admin/(authed)/layout.tsx` provides the requireAdmin gate).
// Same correction Plan 05-08 documented. URLs unaffected by route groups.
//
// Per CONTEXT D-A-03 (two-layer admin perimeter), this page also calls
// requireAdmin() per-page as belt-and-suspenders.
//
// Lists the last 30 eval_runs with per-category pass/total counts, judge
// model, status, and total cost. Each row links to /admin/evals/[runId].
//
// Per-cat counts: separate query per run (N+1 at 30-row scale is negligible
// — Supabase free-tier accommodates this comfortably; adding a SQL view or
// a denormalized counter would be premature optimization). If we ever pump
// hundreds of runs into this view, switch to a single grouped query
// returning (run_id, category, count(*) filter (where passed), count(*)).
//
// Freshness: `dynamic = 'force-dynamic'` for fresh per-request SSR. Do NOT
// add `revalidate = 60` — dead code under force-dynamic. AdminNav's manual
// Refresh re-renders on demand (matches sessions/cost/abuse pattern).
import { requireAdmin } from '@/lib/admin-auth';
import NotAuthorized from '../../components/NotAuthorized';
import { supabaseAdmin } from '@/lib/supabase-server';
import { LocalTime } from '../../components/LocalTime';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type EvalRunRow = {
  id: string;
  started_at: string;
  finished_at: string | null;
  target_url: string;
  judge_model: string;
  total_cases: number;
  passed: number;
  failed: number;
  total_cost_cents: number;
  scheduled: boolean;
  status: 'running' | 'passed' | 'failed' | 'error';
};

type CategoryCounts = Record<string, { passed: number; total: number }>;

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function statusBadgeClass(status: EvalRunRow['status']): string {
  switch (status) {
    case 'passed':
      return 'text-green-700';
    case 'failed':
      return 'text-red-700';
    case 'error':
      return 'text-amber-800';
    case 'running':
      return 'text-blue-700';
    default:
      return 'text-muted-foreground';
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

// Order categories deterministically so two runs render the same column
// sequence regardless of insertion order in eval_cases.
const CATEGORY_ORDER = ['cat1', 'cat2', 'cat3', 'cat4-judge', 'cat4-blind-ab', 'cat5', 'cat6'] as const;

function renderCategoryCounts(byCat: CategoryCounts): string {
  // Build "cat1:14/15 cat2:5/5 ..." string in canonical order, omitting
  // categories with zero cases for this run (e.g., cat4-blind-ab is
  // tester-driven and most runs won't have it).
  const parts: string[] = [];
  for (const cat of CATEGORY_ORDER) {
    if (byCat[cat] && byCat[cat].total > 0) {
      parts.push(`${cat}:${byCat[cat].passed}/${byCat[cat].total}`);
    }
  }
  // Surface any unexpected category (future-proof against schema drift).
  for (const cat of Object.keys(byCat)) {
    if (!CATEGORY_ORDER.includes(cat as typeof CATEGORY_ORDER[number]) && byCat[cat].total > 0) {
      parts.push(`${cat}:${byCat[cat].passed}/${byCat[cat].total}`);
    }
  }
  return parts.length > 0 ? parts.join(' ') : '—';
}

export default async function EvalsIndexPage() {
  // D-A-03 belt-and-suspenders: per-page guard in addition to (authed) layout.
  const admin = await requireAdmin();
  if (!admin) return <NotAuthorized />;

  const { data: runsData, error: runsError } = await supabaseAdmin
    .from('eval_runs')
    .select(
      'id, started_at, finished_at, target_url, judge_model, total_cases, passed, failed, total_cost_cents, scheduled, status',
    )
    .order('started_at', { ascending: false })
    .limit(30);

  if (runsError) {
    return (
      <div>
        <h1 className="mb-4 text-xl font-semibold">Eval Runs</h1>
        <p className="text-sm text-destructive">
          Failed to load eval_runs: {runsError.message}
        </p>
      </div>
    );
  }

  const runs = (runsData ?? []) as EvalRunRow[];

  // Fetch per-cat counts in parallel for all runs (N+1 acceptable at 30 rows).
  const runIds = runs.map((r) => r.id);
  const allCases = runIds.length > 0
    ? (await supabaseAdmin
        .from('eval_cases')
        .select('run_id, category, passed')
        .in('run_id', runIds)
      ).data ?? []
    : [];

  // Group cases by run_id then by category.
  const byRun = new Map<string, CategoryCounts>();
  for (const c of allCases as Array<{ run_id: string; category: string; passed: boolean }>) {
    let counts = byRun.get(c.run_id);
    if (!counts) {
      counts = {};
      byRun.set(c.run_id, counts);
    }
    if (!counts[c.category]) {
      counts[c.category] = { passed: 0, total: 0 };
    }
    counts[c.category].total += 1;
    if (c.passed) counts[c.category].passed += 1;
  }

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">Eval Runs</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Last 30 runs from <code className="font-mono">eval_runs</code> ordered
        by start time. Click a row to drill into per-case detail.
      </p>

      {runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No eval runs yet. Run <code className="font-mono">npm run eval</code>{' '}
          to create one.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Started</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Judge</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Per-cat pass/total</TableHead>
              <TableHead className="text-right">Pass/Fail</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Sched</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((r) => {
              const byCat = byRun.get(r.id) ?? {};
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      href={`/admin/evals/${r.id}`}
                      className="text-[var(--me)] underline-offset-2 hover:underline"
                    >
                      <LocalTime iso={r.started_at} />
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {truncate(r.target_url, 40)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.judge_model}
                  </TableCell>
                  <TableCell className={statusBadgeClass(r.status)}>
                    {r.status}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {renderCategoryCounts(byCat)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {r.passed}/{r.total_cases}
                  </TableCell>
                  <TableCell className="text-right">
                    {dollars(r.total_cost_cents)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {r.scheduled ? 'cron' : 'manual'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
