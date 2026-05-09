// tests/lib/eval/cats/cat6.test.ts
// Phase 5 Plan 05-07 Task 3 — runCat6 Playwright-subprocess runner.
// Mocks node:child_process spawn + node:fs/promises readFile so we exercise
// runCat6's parse + merge + writeCase logic without actually launching
// Playwright. The RESEARCH §9 spawn pattern + Pitfall 7 BASE_URL diagnostic
// are both verified here.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

vi.mock('@/lib/env', () => {
  const env: Record<string, string> = {};
  env['NEXT_PUBLIC_SUPABASE_URL'] = 'https://fake.supabase.co';
  env['NEXT_PUBLIC_' + 'SUPABASE_ANON_' + 'KEY'] = 'x'.repeat(40);
  env['SUPABASE_SERVICE_ROLE_' + 'KEY'] = 'x'.repeat(40);
  env['ANTHROPIC_API_' + 'KEY'] = 'x'.repeat(40);
  env['UPSTASH_REDIS_REST_URL'] = 'https://fake.upstash.io';
  env['UPSTASH_REDIS_REST_TOKEN'] = 'x'.repeat(40);
  env['EXA_API_' + 'KEY'] = 'x'.repeat(40);
  return { env };
});

const writeCaseMock = vi.fn();
vi.mock('@/lib/eval/storage', () => ({
  writeCase: (args: unknown) => writeCaseMock(args),
}));

// child_process spawn mock — we control exit code + stash spawn args/env
let spawnArgs: { cmd: string; args: string[]; opts: { env?: Record<string, string> } } | null = null;
let spawnExitCode = 0;
let spawnEmitError = false;
const spawnMock = vi.fn().mockImplementation((cmd: string, args: string[], opts: { env?: Record<string, string> }) => {
  spawnArgs = { cmd, args, opts };
  const proc = new EventEmitter() as EventEmitter & { stdio: string };
  proc.stdio = 'inherit';
  // Asynchronously fire either error or exit
  setImmediate(() => {
    if (spawnEmitError) {
      proc.emit('error', new Error('spawn ENOENT npx'));
    } else {
      proc.emit('exit', spawnExitCode);
    }
  });
  return proc;
});
vi.mock('node:child_process', () => ({
  spawn: (cmd: string, args: string[], opts: unknown) => spawnMock(cmd, args, opts),
}));

// fs/promises readFile + mkdir mocks
let readFileResult: string | Error = '';
const readFileMock = vi.fn().mockImplementation(async () => {
  if (readFileResult instanceof Error) throw readFileResult;
  return readFileResult;
});
const mkdirMock = vi.fn().mockResolvedValue(undefined);
vi.mock('node:fs/promises', () => ({
  readFile: (path: string, encoding: string) => readFileMock(path, encoding),
  mkdir: (path: string, opts: unknown) => mkdirMock(path, opts),
}));

beforeEach(() => {
  spawnArgs = null;
  spawnExitCode = 0;
  spawnEmitError = false;
  readFileResult = '';
  spawnMock.mockClear();
  readFileMock.mockClear();
  mkdirMock.mockClear();
  writeCaseMock.mockReset();
  writeCaseMock.mockResolvedValue(undefined);
});

// Synthetic Playwright JSON-reporter output covering the schema subset cat6 cares about.
function buildReport(args: {
  specs: Array<{ title: string; status: 'passed' | 'failed' | 'timedOut' | 'skipped'; duration?: number; errorMessage?: string }>;
}): string {
  return JSON.stringify({
    suites: [
      {
        title: 'cat-06 root',
        file: 'cat-06.spec.ts',
        specs: args.specs.map((s) => ({
          title: s.title,
          ok: s.status === 'passed',
          tests: [
            {
              results: [
                {
                  status: s.status,
                  duration: s.duration ?? 100,
                  error: s.errorMessage ? { message: s.errorMessage } : undefined,
                },
              ],
            },
          ],
        })),
      },
    ],
    stats: { startTime: '2026-05-09T22:00:00Z', duration: 1234, expected: args.specs.length, unexpected: 0 },
  });
}

describe('runCat6', () => {
  // ---- Behavior 1: spawns npx playwright test --grep cat-06 --reporter json
  it('spawns npx playwright test --grep cat-06 with json reporter', async () => {
    readFileResult = buildReport({ specs: [{ title: 'spec-a', status: 'passed' }] });
    const { runCat6 } = await import('@/lib/eval/cats/cat6');
    await runCat6('https://preview-url.vercel.app', 'run_t1');
    expect(spawnMock).toHaveBeenCalled();
    expect(spawnArgs!.cmd).toBe('npx');
    expect(spawnArgs!.args[0]).toBe('playwright');
    expect(spawnArgs!.args).toContain('test');
    expect(spawnArgs!.args).toContain('--grep');
    expect(spawnArgs!.args).toContain('cat-06');
    expect(spawnArgs!.args).toContain('--reporter');
    expect(spawnArgs!.args.some((a) => a.includes('json'))).toBe(true);
  });

  // ---- Behavior 2: BASE_URL forwarded to spawn env (Pitfall 7)
  it('forwards EVAL_TARGET_URL to BASE_URL via spawn env', async () => {
    readFileResult = buildReport({ specs: [{ title: 'spec-a', status: 'passed' }] });
    const { runCat6 } = await import('@/lib/eval/cats/cat6');
    await runCat6('https://preview-url.vercel.app', 'run_t2');
    expect(spawnArgs!.opts.env!.BASE_URL).toBe('https://preview-url.vercel.app');
  });

  // ---- Behavior 3: PLAYWRIGHT_JSON_OUTPUT_NAME set; readFile reads from that path
  it('sets PLAYWRIGHT_JSON_OUTPUT_NAME and reads JSON from that path', async () => {
    readFileResult = buildReport({ specs: [{ title: 'spec-a', status: 'passed' }] });
    const { runCat6 } = await import('@/lib/eval/cats/cat6');
    await runCat6('https://preview-url.vercel.app', 'run_t3');
    const outputPath = spawnArgs!.opts.env!.PLAYWRIGHT_JSON_OUTPUT_NAME;
    expect(outputPath).toBeTruthy();
    expect(outputPath).toMatch(/run_t3/);
    expect(readFileMock).toHaveBeenCalledWith(outputPath, 'utf8');
  });

  // ---- Behavior 4: each spec → one EvalCaseResult; case_id = spec.title; passed iff status passed
  it('produces one EvalCaseResult per spec; passed reflects status', async () => {
    readFileResult = buildReport({
      specs: [
        { title: 'spec-pass-a', status: 'passed' },
        { title: 'spec-fail-b', status: 'failed', errorMessage: 'expected to be visible' },
        { title: 'spec-timeout-c', status: 'timedOut' },
      ],
    });
    const { runCat6 } = await import('@/lib/eval/cats/cat6');
    const result = await runCat6('https://preview-url.vercel.app', 'run_t4');
    expect(result.cases.length).toBe(3);
    expect(result.cases[0].case_id).toBe('spec-pass-a');
    expect(result.cases[0].passed).toBe(true);
    expect(result.cases[1].case_id).toBe('spec-fail-b');
    expect(result.cases[1].passed).toBe(false);
    expect(result.cases[2].case_id).toBe('spec-timeout-c');
    expect(result.cases[2].passed).toBe(false);
  });

  // ---- Behavior 5: writeCase called once per spec with category='cat6'
  it('writes one eval_cases row per spec with category=cat6', async () => {
    readFileResult = buildReport({
      specs: [
        { title: 'spec-1', status: 'passed' },
        { title: 'spec-2', status: 'failed', errorMessage: 'fail' },
      ],
    });
    const { runCat6 } = await import('@/lib/eval/cats/cat6');
    await runCat6('https://preview-url.vercel.app', 'run_t5');
    expect(writeCaseMock).toHaveBeenCalledTimes(2);
    const firstWrite = writeCaseMock.mock.calls[0][0];
    expect(firstWrite.runId).toBe('run_t5');
    expect(firstWrite.result.category).toBe('cat6');
  });

  // ---- Behavior 6: returns CategoryResult; passed = all specs passed; cost_cents=0
  it('returns CategoryResult with passed = every-spec passed; cost_cents=0', async () => {
    readFileResult = buildReport({
      specs: [
        { title: 'a', status: 'passed' },
        { title: 'b', status: 'passed' },
      ],
    });
    const { runCat6 } = await import('@/lib/eval/cats/cat6');
    const result = await runCat6('https://preview-url.vercel.app', 'run_t6');
    expect(result.category).toBe('cat6');
    expect(result.passed).toBe(true);
    expect(result.cost_cents).toBe(0);
  });

  it('passed=false when any spec failed', async () => {
    readFileResult = buildReport({
      specs: [
        { title: 'a', status: 'passed' },
        { title: 'b', status: 'failed' },
      ],
    });
    const { runCat6 } = await import('@/lib/eval/cats/cat6');
    const result = await runCat6('https://preview-url.vercel.app', 'run_t7');
    expect(result.passed).toBe(false);
  });

  // ---- Behavior 7: spawn-error path → graceful degradation, one synthetic error case
  it('on spawn error: returns CategoryResult with passed=false and one synthetic error case', async () => {
    spawnEmitError = true;
    readFileResult = new Error('ENOENT: no such file');
    const { runCat6 } = await import('@/lib/eval/cats/cat6');
    const result = await runCat6('https://preview-url.vercel.app', 'run_t8');
    expect(result.category).toBe('cat6');
    expect(result.passed).toBe(false);
    expect(result.cases.length).toBe(1);
    expect(result.cases[0].passed).toBe(false);
    expect(result.cases[0].case_id).toMatch(/spawn|error/i);
    expect(writeCaseMock).toHaveBeenCalledTimes(1);
  });

  it('on JSON parse failure: returns CategoryResult with passed=false and synthetic error case', async () => {
    spawnExitCode = 1;
    readFileResult = new Error('ENOENT: no such file');
    const { runCat6 } = await import('@/lib/eval/cats/cat6');
    const result = await runCat6('https://preview-url.vercel.app', 'run_t9');
    expect(result.passed).toBe(false);
    expect(result.cases.length).toBe(1);
    expect(result.cases[0].judge_rationale).toMatch(/spawn|json/i);
  });

  // ---- Pitfall 7: BASE_URL log fires before spawn returns
  it('logs BASE_URL before invoking spawn (Pitfall 7 diagnostic)', async () => {
    readFileResult = buildReport({ specs: [{ title: 'a', status: 'passed' }] });
    // Capture stdout via vitest spy on process.stdout.write — Pino writes JSON
    // events through stdout per Phase 3 D-I.
    const stdoutSpy = vi.spyOn(process.stdout, 'write');
    const { runCat6 } = await import('@/lib/eval/cats/cat6');
    await runCat6('https://preview-url.vercel.app', 'run_t10');
    // The BASE_URL log fires before the spawn callback — it's recorded.
    const writes = stdoutSpy.mock.calls.flat().map(String).join('\n');
    expect(writes).toMatch(/cat6_spawn_start_BASE_URL|BASE_URL/);
    stdoutSpy.mockRestore();
  });

  // ---- CI=1 disables Playwright auto-webServer (T-05-07-03 mitigation)
  it('sets CI=1 in spawn env to disable Playwright auto-webServer + retries', async () => {
    readFileResult = buildReport({ specs: [{ title: 'a', status: 'passed' }] });
    const { runCat6 } = await import('@/lib/eval/cats/cat6');
    await runCat6('https://preview-url.vercel.app', 'run_t11');
    expect(spawnArgs!.opts.env!.CI).toBe('1');
  });
});
