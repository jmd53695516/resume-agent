// src/app/admin/(authed)/evals/[runId]/page.tsx
//
// Phase 5 Plan 05-09 Task 2 — Per-run eval detail page (EVAL-14).
//
// Shows the run header (target / judge / status / aggregate counts / cost)
// followed by per-case rows ordered by category then case_id. Each row is
// a <details> disclosure exposing prompt, response, judge_rationale, and
// the raw JSON shape of judge_score / verdict.
//
// Cat6 cases (Playwright UI smoke per Plan 05-07) store the spawn or
// per-spec error in `response`, so we render that field as a code block
// either way — JSON-pretty for the LLM-judged cats and plain monospace
// for cat6. The disclosure widget keeps the page tractable when a run
// has dozens of cases.
//
// Lives under (authed) — parent layout requireAdmin() guards; per-page
// requireAdmin() is D-A-03 belt-and-suspenders.
//
// Freshness: `dynamic = 'force-dynamic'` for fresh per-request SSR.
import { requireAdmin } from '@/lib/admin-auth';
import NotAuthorized from '../../../components/NotAuthorized';
import { supabaseAdmin } from '@/lib/supabase-server';
import { LocalTime } from '../../../components/LocalTime';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type EvalRunRow = {
  id: string;
  started_at: string;
  finished_at: string | null;
  target_url: string;
  judge_model: string;
  git_sha: string | null;
  total_cases: number;
  passed: number;
  failed: number;
  total_cost_cents: number;
  scheduled: boolean;
  status: 'running' | 'passed' | 'failed' | 'error';
};

type EvalCaseRow = {
  id: string;
  run_id: string;
  category: string;
  case_id: string;
  prompt: string;
  response: string | null;
  judge_score: number | null;
  judge_verdict: 'pass' | 'fail' | null;
  judge_rationale: string | null;
  passed: boolean;
  cost_cents: number;
  created_at: string;
};

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function statusColor(passed: boolean): string {
  return passed ? 'text-green-700' : 'text-red-700';
}

function tryPrettyJson(value: string | null): { isJson: boolean; rendered: string } {
  if (!value) return { isJson: false, rendered: '(empty)' };
  // Some judge_rationale values are valid JSON; some are plain text. Try
  // parsing first and pretty-print only if it succeeds — falling back to the
  // raw string preserves judge prose readability without truncation.
  try {
    const parsed = JSON.parse(value);
    return { isJson: true, rendered: JSON.stringify(parsed, null, 2) };
  } catch {
    return { isJson: false, rendered: value };
  }
}

export default async function EvalRunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) return <NotAuthorized />;

  const { runId } = await params;

  const [runResult, casesResult] = await Promise.all([
    supabaseAdmin
      .from('eval_runs')
      .select(
        'id, started_at, finished_at, target_url, judge_model, git_sha, total_cases, passed, failed, total_cost_cents, scheduled, status',
      )
      .eq('id', runId)
      .single(),
    supabaseAdmin
      .from('eval_cases')
      .select(
        'id, run_id, category, case_id, prompt, response, judge_score, judge_verdict, judge_rationale, passed, cost_cents, created_at',
      )
      .eq('run_id', runId)
      .order('category', { ascending: true })
      .order('case_id', { ascending: true }),
  ]);

  if (runResult.error || !runResult.data) {
    return (
      <div>
        <Link
          href="/admin/evals"
          className="text-sm text-[var(--me)] underline-offset-2 hover:underline"
        >
          ← back to runs
        </Link>
        <h1 className="mb-4 mt-2 text-xl font-semibold">Run not found</h1>
        <p className="text-sm text-destructive">
          No eval_runs row with id <code className="font-mono">{runId}</code>.
          {runResult.error ? ` (${runResult.error.message})` : ''}
        </p>
      </div>
    );
  }

  const run = runResult.data as EvalRunRow;
  const cases = (casesResult.data ?? []) as EvalCaseRow[];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/evals"
          className="text-sm text-[var(--me)] underline-offset-2 hover:underline"
        >
          ← back to runs
        </Link>
      </div>

      {/* Run header */}
      <div className="rounded-lg border border-border bg-[var(--panel)] p-4">
        <h1 className="mb-2 text-xl font-semibold">
          Run <code className="font-mono text-sm">{run.id}</code>
        </h1>
        <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm md:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Started:</span>{' '}
            <LocalTime iso={run.started_at} />
          </div>
          <div>
            <span className="text-muted-foreground">Finished:</span>{' '}
            {run.finished_at ? <LocalTime iso={run.finished_at} /> : '—'}
          </div>
          <div>
            <span className="text-muted-foreground">Target:</span>{' '}
            <code className="font-mono text-xs">{run.target_url}</code>
          </div>
          <div>
            <span className="text-muted-foreground">Judge:</span>{' '}
            <code className="font-mono text-xs">{run.judge_model}</code>
          </div>
          <div>
            <span className="text-muted-foreground">Status:</span>{' '}
            <span className={statusColor(run.status === 'passed')}>{run.status}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Pass/Fail:</span>{' '}
            <span className="font-mono">{run.passed}/{run.total_cases}</span>
            {run.failed > 0 && (
              <span className="ml-2 font-mono text-red-700">({run.failed} failed)</span>
            )}
          </div>
          <div>
            <span className="text-muted-foreground">Cost:</span>{' '}
            {dollars(run.total_cost_cents)}
          </div>
          <div>
            <span className="text-muted-foreground">Mode:</span>{' '}
            {run.scheduled ? 'scheduled (cron)' : 'manual'}
          </div>
          {run.git_sha && (
            <div className="md:col-span-2">
              <span className="text-muted-foreground">Git SHA:</span>{' '}
              <code className="font-mono text-xs">{run.git_sha}</code>
            </div>
          )}
        </div>
      </div>

      {/* Per-case detail */}
      <div>
        <h2 className="mb-2 text-lg font-semibold">Cases</h2>
        {cases.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No cases recorded for this run.
            {run.status === 'running' ? ' Run is still in progress.' : ''}
          </p>
        ) : (
          <ul className="space-y-2">
            {cases.map((c) => {
              const isCat6 = c.category === 'cat6';
              const rationale = tryPrettyJson(c.judge_rationale);
              return (
                <li
                  key={c.id}
                  className="rounded-lg border border-border bg-[var(--panel)]"
                >
                  <details>
                    <summary className="cursor-pointer px-4 py-2 text-sm">
                      <span className={statusColor(c.passed)}>
                        {c.passed ? 'PASS' : 'FAIL'}
                      </span>{' '}
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {c.category}
                      </span>{' '}
                      <span className="ml-2 font-mono text-xs">{c.case_id}</span>
                      {c.judge_score !== null && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          score={c.judge_score}
                        </span>
                      )}
                      {c.judge_verdict !== null && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          verdict={c.judge_verdict}
                        </span>
                      )}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {dollars(c.cost_cents)}
                      </span>
                    </summary>
                    <div className="space-y-3 border-t border-border px-4 py-3 text-xs">
                      <div>
                        <div className="mb-1 font-semibold text-muted-foreground">
                          Prompt
                        </div>
                        <pre className="whitespace-pre-wrap break-words rounded bg-muted/50 p-2 font-mono">
                          {c.prompt}
                        </pre>
                      </div>
                      <div>
                        <div className="mb-1 font-semibold text-muted-foreground">
                          {isCat6 ? 'Playwright output' : 'Response'}
                        </div>
                        <pre className="whitespace-pre-wrap break-words rounded bg-muted/50 p-2 font-mono">
                          {c.response ?? '(no response captured)'}
                        </pre>
                      </div>
                      {c.judge_rationale !== null && (
                        <div>
                          <div className="mb-1 font-semibold text-muted-foreground">
                            Judge rationale {rationale.isJson ? '(JSON)' : ''}
                          </div>
                          <pre className="whitespace-pre-wrap break-words rounded bg-muted/50 p-2 font-mono">
                            {rationale.rendered}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
