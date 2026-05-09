// src/lib/eval/cats/cat6.ts
// Phase 5 Plan 05-07 Task 3.
//
// Cat 6: UX smoke (EVAL-08). Spawns Playwright as a subprocess (RESEARCH §9
// lines 596-622), parses its JSON-reporter output, merges the per-spec results
// into one CategoryResult so cat 6 shows up alongside cats 1-5 in the same
// eval_runs row.
//
// **Pitfall 7 mitigation:** logs `cat6_spawn_start_BASE_URL` BEFORE invoking
// spawn(). When EVAL_TARGET_URL → BASE_URL forwarding fails, Playwright would
// silently default to localhost (per playwright.config.ts) and the failure mode
// (connection-refused against nothing) would be opaque. The log surfaces the
// effective target before spawn so the failure mode is diagnosable.
//
// **T-05-07-03 mitigation:** sets CI=1 in spawn env to disable Playwright's
// auto-webServer (which would launch `npm run dev` if BASE_URL is unreachable)
// and retries (faster fail-loop in CI).
//
// **Schema:** Playwright's JSON reporter is undocumented but stable since 2023
// (RESEARCH §9 — github.com/microsoft/playwright/issues/26954 is the
// acknowledged-gap citation). We pin to the subset we need: suites[].specs[]
// with title + tests[0].results[last].status. flattenSpecs handles nested
// suites (Playwright wraps each spec file in a top-level suite).
import path from 'node:path';
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { childLogger } from '@/lib/logger';
import { writeCase } from '@/lib/eval/storage';
import type { CategoryResult, EvalCaseResult } from '@/lib/eval/types';

const log = childLogger({ event: 'eval_cat6' });

interface PlaywrightResult {
  status: 'passed' | 'failed' | 'timedOut' | 'skipped';
  duration: number;
  error?: { message: string };
}
interface PlaywrightTest {
  results: PlaywrightResult[];
}
interface PlaywrightSpec {
  title: string;
  ok: boolean;
  tests: PlaywrightTest[];
}
interface PlaywrightSuite {
  title: string;
  file?: string;
  specs: PlaywrightSpec[];
  suites?: PlaywrightSuite[];
}
interface PlaywrightJsonReport {
  suites: PlaywrightSuite[];
  stats: { startTime: string; duration: number; expected: number; unexpected: number };
}

function flattenSpecs(suites: PlaywrightSuite[]): PlaywrightSpec[] {
  const out: PlaywrightSpec[] = [];
  for (const s of suites) {
    out.push(...s.specs);
    if (s.suites && s.suites.length > 0) {
      out.push(...flattenSpecs(s.suites));
    }
  }
  return out;
}

export async function runCat6(targetUrl: string, runId: string): Promise<CategoryResult> {
  const tmpDir = path.join(process.cwd(), '.eval-tmp');
  await mkdir(tmpDir, { recursive: true });
  const outputPath = path.join(tmpDir, `playwright-${runId}.json`);

  // Pitfall 7: log effective BASE_URL BEFORE spawning so localhost-fallback
  // failures are immediately visible in CI logs.
  log.info(
    { runId, targetUrl, outputPath },
    'cat6_spawn_start_BASE_URL',
  );

  const exitCode: number = await new Promise((resolve) => {
    const proc = spawn(
      'npx',
      ['playwright', 'test', '--grep', 'cat-06', '--reporter', 'json'],
      {
        env: {
          ...process.env,
          BASE_URL: targetUrl,
          PLAYWRIGHT_JSON_OUTPUT_NAME: outputPath,
          // CI=1 disables auto-webServer (T-05-07-03) and trims retries to
          // playwright.config.ts's CI=2 retry count, but more importantly
          // prevents Playwright from booting a local `npm run dev` if the
          // BASE_URL forwarding silently broke.
          CI: '1',
        },
        stdio: 'inherit', // forward Playwright stdout/stderr to CI logs
      },
    );
    proc.on('exit', (code: number | null) => resolve(code ?? 1));
    proc.on('error', (e: Error) => {
      log.error({ runId, err: e.message }, 'cat6_spawn_error');
      resolve(1);
    });
  });

  // Parse JSON reporter output. If readFile or JSON.parse fails, emit one
  // synthetic error case so the CategoryResult tells the story (vs. silently
  // returning an empty cases array which would falsely report cat6=passed).
  let report: PlaywrightJsonReport;
  try {
    const raw = await readFile(outputPath, 'utf8');
    report = JSON.parse(raw) as PlaywrightJsonReport;
  } catch (e) {
    log.error(
      { runId, outputPath, err: (e as Error).message, exitCode },
      'cat6_json_parse_error',
    );
    const errCase: EvalCaseResult = {
      case_id: 'cat6-spawn-error',
      category: 'cat6',
      prompt: '(playwright spawn)',
      response: null,
      judge_score: null,
      judge_verdict: 'fail',
      judge_rationale: `spawn exit=${exitCode}; cannot read JSON: ${(e as Error).message}`,
      passed: false,
      cost_cents: 0,
    };
    await writeCase({ runId, result: errCase });
    return { category: 'cat6', cases: [errCase], passed: false, cost_cents: 0 };
  }

  const specs = flattenSpecs(report.suites ?? []);
  const results: EvalCaseResult[] = [];

  for (const spec of specs) {
    // Use the LAST result (Playwright records retries; final result is the
    // verdict that counts).
    const lastTest = spec.tests[0];
    const lastResult = lastTest?.results[lastTest.results.length - 1];
    const passed = lastResult?.status === 'passed';
    const result: EvalCaseResult = {
      case_id: spec.title,
      category: 'cat6',
      prompt: '(playwright)',
      response: lastResult?.error?.message ?? null,
      judge_score: null,
      judge_verdict: passed ? 'pass' : 'fail',
      judge_rationale: JSON.stringify({
        status: lastResult?.status,
        duration: lastResult?.duration,
      }),
      passed,
      cost_cents: 0,
    };
    await writeCase({ runId, result });
    results.push(result);
  }

  // CategoryResult.passed = every spec passed AND spawn exited cleanly.
  // Spawn nonzero with a parsable JSON could happen if specs failed but the
  // reporter still wrote — every-spec-passed will be false anyway, so the
  // composite gate stays correct.
  const allPassed = results.every((r) => r.passed) && exitCode === 0;
  log.info(
    {
      runId,
      specCount: specs.length,
      passed: results.filter((r) => r.passed).length,
      exitCode,
    },
    'cat6_complete',
  );
  return { category: 'cat6', cases: results, passed: allPassed, cost_cents: 0 };
}
