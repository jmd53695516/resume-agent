#!/usr/bin/env tsx
// scripts/run-evals.ts
// Phase 5 Plan 05-03 Task 3 — eval CLI entrypoint. Plans 05-04..05-09 fill in
// the per-category runners; this orchestrator handles run lifecycle (create row,
// dispatch runners, aggregate, write summary), cost-warn at $1.50, exit code
// mapping (0 = all pass, 1 = any fail, 2 = orchestration error), Pino structured
// logging.
//
// Invoke via `npm run eval`. Env vars consumed:
//   EVAL_TARGET_URL  — preview/prod URL of /api/chat (CI-injected; default localhost)
//   EVAL_JUDGE_MODEL — Gemini model override (default: gemini-2.5-flash snapshot)
//   GIT_SHA          — github.event.client_payload.git.sha (CI) or local
//   EVAL_SCHEDULED   — '1' if invoked by /api/cron/run-eval (Plan 05-13); else '0'
//
// Env loading: ESM hoists imports above statement-level code, so a runtime
// `dotenvConfig()` call here would run AFTER `@/lib/env`'s zod parse already
// fired at module-init. The `npm run eval` script invokes Node with
// `--env-file=.env.local` (Node 20.6+) which loads .env.local into process.env
// BEFORE any module is evaluated. Next.js auto-loads .env.local for `next dev`;
// tsx does not, hence the explicit Node flag.
import { childLogger } from '@/lib/logger';
import { JUDGE_MODEL } from '@/lib/eval-models';
import { createRun, updateRunStatus } from '@/lib/eval/storage';
import { projectRunCost, WARN_THRESHOLD_CENTS } from '@/lib/eval/cost';
import type { CategoryResult, RunSummary } from '@/lib/eval/types';
// Plan 05-04 wires runCat1; Plan 05-05 wires runCat2 + runCat3; Plan 05-06
// wires runCat4Judge; Plan 05-07 wires runCat5 (Task 1) + runCat6 (Task 3 — replaces stub below).
import { runCat1 } from '@/lib/eval/cats/cat1';
import { runCat2 } from '@/lib/eval/cats/cat2';
import { runCat3 } from '@/lib/eval/cats/cat3';
import { runCat4Judge } from '@/lib/eval/cats/cat4-judge';
import { runCat5 } from '@/lib/eval/cats/cat5';

// runCat6 stub — replaced by Plan 05-07 Task 3.
async function runCat6(_targetUrl: string, _runId: string): Promise<CategoryResult> {
  return { category: 'cat6', cases: [], passed: true, cost_cents: 0 };
}

async function main(): Promise<void> {
  const targetUrl = process.env.EVAL_TARGET_URL ?? 'http://localhost:3000';
  const gitSha = process.env.GIT_SHA;
  const scheduled = process.env.EVAL_SCHEDULED === '1';
  const startedAt = new Date();

  const log = childLogger({ event: 'eval_run', targetUrl, judgeModel: JUDGE_MODEL });

  // 1. Create eval_runs row → get runId
  const runId = await createRun({
    targetUrl,
    judgeModel: JUDGE_MODEL,
    gitSha,
    scheduled,
  });
  const runLog = log.child({ runId });

  runLog.info({ status: 'started' }, 'eval_run_started');

  // 2. Project cost
  const projectedCost = projectRunCost(40);
  runLog.info(
    { projectedCostCents: projectedCost, warnThresholdCents: WARN_THRESHOLD_CENTS },
    'projected_cost',
  );

  // 3. Run all categories — Plans 05-04..05-09 fill in (current stubs run instantly)
  let results: CategoryResult[];
  try {
    results = await Promise.all([
      runCat1(targetUrl, runId),
      runCat2(targetUrl, runId),
      runCat3(targetUrl, runId),
      runCat4Judge(targetUrl, runId),
      runCat5(targetUrl, runId),
      runCat6(targetUrl, runId),
    ]);
  } catch (e) {
    runLog.error({ err: (e as Error).message }, 'eval_run_error');
    await updateRunStatus({
      runId,
      summary: { totalCases: 0, passed: 0, failed: 0, totalCostCents: 0, status: 'error' },
    });
    process.exit(2);
  }

  // 4. Aggregate
  const totalCases = results.reduce((s, r) => s + r.cases.length, 0);
  const passed = results.reduce((s, r) => s + r.cases.filter((c) => c.passed).length, 0);
  const failed = totalCases - passed;
  const totalCostCents = results.reduce((s, r) => s + r.cost_cents, 0);
  const allPassed = results.every((r) => r.passed);
  const status: RunSummary['status'] = allPassed ? 'passed' : 'failed';

  // 5. Write summary
  await updateRunStatus({
    runId,
    summary: { totalCases, passed, failed, totalCostCents, status },
  });

  // 6. Cost-warn
  if (totalCostCents > WARN_THRESHOLD_CENTS) {
    runLog.warn(
      { totalCostCents, threshold: WARN_THRESHOLD_CENTS },
      `cost_over_threshold ($${(totalCostCents / 100).toFixed(2)} > $${(WARN_THRESHOLD_CENTS / 100).toFixed(2)})`,
    );
  }

  // 7. Final summary line
  runLog.info(
    {
      status,
      totalCases,
      passed,
      failed,
      totalCostCents,
      durationMs: Date.now() - startedAt.getTime(),
      perCategory: results.map((r) => ({
        category: r.category,
        cases: r.cases.length,
        passed: r.passed,
        cost_cents: r.cost_cents,
      })),
    },
    'eval_run_summary',
  );

  process.exit(allPassed ? 0 : 1);
}

main().catch((e) => {
  // Pino logger may not yet be initialized if env.ts threw; fall back to stderr.
  // Using console.error here is acceptable: this catch runs OUTSIDE the route
  // handler / persistence helper paths that WR-02 governs (CLI fatal-exit).
  // eslint-disable-next-line no-console
  console.error(`eval CLI fatal: ${(e as Error).message}`);
  // eslint-disable-next-line no-console
  console.error((e as Error).stack);
  process.exit(2);
});
