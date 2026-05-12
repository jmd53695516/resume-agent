#!/usr/bin/env tsx
// scripts/run-evals.ts
// Phase 5 Plan 05-03 Task 3 — eval CLI entrypoint. Plans 05-04..05-09 fill in
// the per-category runners; this orchestrator handles run lifecycle (create row,
// dispatch runners, aggregate, write summary), cost-warn at $1.50, exit code
// mapping (0 = all pass, 1 = any fail, 2 = orchestration error), Pino structured
// logging.
//
// Invoke via `npm run eval`. Env vars consumed (CLI flags take precedence — see --help):
//   EVAL_TARGET_URL  — preview/prod URL of /api/chat. Override: --target / -t.
//   EVAL_CATS        — comma-separated category filter. Override: --cats / -c.
//                      Valid: cat1, cat2, cat3, cat4-judge, cat5, cat6.
//   EVAL_JUDGE_MODEL — Gemini/Anthropic model override (default: see eval-models.ts)
//   GIT_SHA          — github.event.client_payload.git.sha (CI) or local
//   EVAL_SCHEDULED   — '1' if invoked by /api/cron/run-eval; else '0'
//
// Run `npm run eval -- --help` for full usage.
//
// Env loading: ESM hoists imports above statement-level code, so a runtime
// `dotenvConfig()` call here would run AFTER `@/lib/env`'s zod parse already
// fired at module-init. The `npm run eval` script invokes Node with
// `--env-file-if-exists=.env.local` (Node 20.6+) which loads .env.local into
// process.env BEFORE any module is evaluated. Next.js auto-loads .env.local for
// `next dev`; tsx does not, hence the explicit Node flag.
//
// Direct-run guard (Plan 05-13 W6): the script body fires main() only when
// invoked directly (npm run eval / tsx scripts/run-evals.ts). Plain `import`
// from tests/scripts/run-evals.test.ts does NOT trigger main(), so pure-fn
// helpers (parseEvalArgs / resolveTargetUrl / EVAL_CATS_VALID) can be unit
// tested without spawning a child process. Idiom mirrors scripts/generate-fallback.ts.
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { childLogger } from '@/lib/logger';
import { JUDGE_MODEL } from '@/lib/eval-models';
import { createRun, updateRunStatus } from '@/lib/eval/storage';
import { projectRunCost, WARN_THRESHOLD_CENTS } from '@/lib/eval/cost';
import type { CategoryResult, RunSummary } from '@/lib/eval/types';
// Plan 05-04 wires runCat1; Plan 05-05 wires runCat2 + runCat3; Plan 05-06
// wires runCat4Judge; Plan 05-07 wires runCat5 + runCat6 (final stubs replaced).
// Plan 05-08 will add runCat4BlindAB once the /admin/eval-ab page lands.
import { runCat1 } from '@/lib/eval/cats/cat1';
import { runCat2 } from '@/lib/eval/cats/cat2';
import { runCat3 } from '@/lib/eval/cats/cat3';
import { runCat4Judge } from '@/lib/eval/cats/cat4-judge';
import { runCat5 } from '@/lib/eval/cats/cat5';
import { runCat6 } from '@/lib/eval/cats/cat6';

/**
 * Valid --cats / EVAL_CATS values. Single source of truth shared with main()'s
 * runner roster (lines below). When you add a runner to allRunners, add its
 * name here. Note: cat4-blind-ab is in CategorySchema (src/lib/eval/types.ts)
 * but is NOT an orchestrator runner — it ships via the /admin/eval-ab page
 * (Plan 05-08), not via this CLI.
 */
export const EVAL_CATS_VALID = [
  'cat1',
  'cat2',
  'cat3',
  'cat4-judge',
  'cat5',
  'cat6',
] as const;

export interface ParsedEvalArgs {
  targetUrl: string | undefined;
  cats: string[] | null; // null = "no --cats provided"; [] not possible (empty filtered out)
  help: boolean;
}

/**
 * Pure argv parser. Exported for testing. main() consumes its return values.
 *
 * Precedence chain (applied in main(), NOT here):
 *   argv flag > env var > default
 *
 * --cats values are NOT validated here (separation of concerns). main() validates
 * against EVAL_CATS_VALID and exits 2 on unknown values, matching the existing
 * EVAL_CATS env-validator behavior.
 *
 * --target is NOT shape-validated here (e.g., http(s) prefix check). main() does that.
 *
 * Throws on unknown flags (node:util.parseArgs strict:true). This is intentional:
 * `--cat=1` (singular, the CONTEXT-ADDENDUM D-12-C-02 mis-paste) fails loudly so
 * future readers don't silently get a no-op filter.
 */
export function parseEvalArgs(argv: string[]): ParsedEvalArgs {
  const { values } = parseArgs({
    args: argv,
    options: {
      target: { type: 'string', short: 't' },
      cats: { type: 'string', short: 'c' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
    allowPositionals: false,
  });

  const cats =
    values.cats !== undefined
      ? values.cats
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : null;

  return {
    targetUrl: values.target,
    cats,
    help: Boolean(values.help),
  };
}

/**
 * Pure precedence resolver for the eval CLI target URL.
 * argv flag wins over env var; env wins over default. Empty / whitespace-only
 * argv is treated as 'not provided' so callers can fall through to env.
 * Exported for testing — proves the 'argv-overrides-env' must_have without
 * needing to spawn a child process or hit the network.
 */
export function resolveTargetUrl(
  argvTarget: string | undefined,
  envTarget: string | undefined,
  defaultUrl: string = 'http://localhost:3000',
): string {
  const argv = argvTarget?.trim() || undefined;
  const env = envTarget?.trim() || undefined;
  return argv ?? env ?? defaultUrl;
}

const HELP_TEXT = `Usage: npm run eval -- [options]

Options:
  -t, --target=<url>   Target URL for /api/chat (overrides EVAL_TARGET_URL env)
  -c, --cats=<csv>     Comma-separated category filter (overrides EVAL_CATS env)
                       Valid: ${EVAL_CATS_VALID.join(', ')}
  -h, --help           Show this help

Examples:
  npm run eval -- --target=https://joe-dollinger-chat.com --cats=cat1,cat4-judge
  EVAL_TARGET_URL=https://preview.vercel.app npm run eval
`;

async function main(): Promise<void> {
  let parsed: ParsedEvalArgs;
  try {
    parsed = parseEvalArgs(process.argv.slice(2));
  } catch (err) {
    // node:util.parseArgs strict:true throws on unknown flags / malformed input.
    // eslint-disable-next-line no-console
    console.error(`eval CLI: ${(err as Error).message}`);
    // eslint-disable-next-line no-console
    console.error(HELP_TEXT);
    process.exit(2);
  }

  if (parsed.help) {
    // eslint-disable-next-line no-console
    console.log(HELP_TEXT);
    process.exit(0);
  }

  // argv wins; env is fallback; default 'http://localhost:3000'. Precedence
  // resolution extracted to exported pure helper so argv-overrides-env is
  // unit-testable without spawning a child process.
  const targetUrl = resolveTargetUrl(parsed.targetUrl, process.env.EVAL_TARGET_URL);

  // Shape-validate the resolved URL (closes 'malformed --target exits 2'
  // must_have). Blocks file:// / javascript: / shell-injection strings before
  // any network call. childLogger initialized BEFORE the runId-bearing
  // runLog so the early-exit path still produces structured signal.
  if (!/^https?:\/\//.test(targetUrl)) {
    const log = childLogger({ event: 'eval_run', targetUrl });
    log.error({ targetUrl }, 'eval_target_invalid');
    // eslint-disable-next-line no-console
    console.error(`eval CLI: --target must be an http(s) URL, got: ${targetUrl}`);
    process.exit(2);
  }

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
  const allRunners: Array<[string, () => Promise<CategoryResult>]> = [
    ['cat1', () => runCat1(targetUrl, runId)],
    ['cat2', () => runCat2(targetUrl, runId)],
    ['cat3', () => runCat3(targetUrl, runId)],
    ['cat4-judge', () => runCat4Judge(targetUrl, runId)],
    ['cat5', () => runCat5(targetUrl, runId)],
    ['cat6', () => runCat6(targetUrl, runId)],
  ];

  // Category filter: argv (parsed.cats) wins; env (EVAL_CATS) is fallback;
  // both absent = all 6 runners (existing behavior). Single source of truth
  // for valid values via EVAL_CATS_VALID prevents argv- and env-validators
  // from drifting (T-05-13-03 mitigation).
  const envCatsRaw = process.env.EVAL_CATS?.trim();
  const envCats = envCatsRaw
    ? envCatsRaw.split(',').map((c) => c.trim()).filter(Boolean)
    : null;

  const filterList = parsed.cats ?? envCats;
  const filter = filterList ? new Set(filterList) : null;

  if (filter) {
    const valid = new Set<string>(EVAL_CATS_VALID);
    const unknown = [...filter].filter((c) => !valid.has(c));
    if (unknown.length > 0) {
      runLog.error({ unknown, valid: [...valid] }, 'eval_cats_invalid');
      await updateRunStatus({
        runId,
        summary: { totalCases: 0, passed: 0, failed: 0, totalCostCents: 0, status: 'error' },
      });
      process.exit(2);
    }
    runLog.info(
      { filter: [...filter], source: parsed.cats ? 'argv' : 'env' },
      'eval_cats_filter_active',
    );
  }

  const runners = filter
    ? allRunners.filter(([name]) => filter.has(name))
    : allRunners;

  let results: CategoryResult[];
  try {
    results = await Promise.all(runners.map(([, run]) => run()));
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

// Direct-run guard (Plan 05-13 W6): only fire main() when this file is the
// process entrypoint. Plain `import` from a test file (tests/scripts/run-evals.test.ts)
// MUST NOT trigger main() because that would (a) hit the network via createRun
// and (b) call process.exit. Mirrors scripts/generate-fallback.ts's WR-06
// import.meta.url-vs-argv[1] self-detection idiom. The env-var override
// (EVAL_RUN=1) exists as a safety hatch for environments where the comparison
// fails (e.g., npm wrapper layers); not currently needed but cheap to keep.
const isDirectRun = (() => {
  try {
    return (
      typeof process !== 'undefined' &&
      typeof process.argv[1] === 'string' &&
      import.meta.url === pathToFileURL(process.argv[1]).href
    );
  } catch {
    return false;
  }
})();

if (process.env.EVAL_RUN === '1' || isDirectRun) {
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
}
