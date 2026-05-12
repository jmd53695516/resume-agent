// tests/lib/eval/cats/cat2.test.ts
// Phase 5 Plan 05-05 Task 2 — runCat2 assertion-based tool-correctness logic.
// Path follows session deviation (vitest config tests/**/*.test.{ts,tsx}).
// Mocks fetch (we don't hit a real /api/chat), redis (spend-cap synthetic),
// loadCases, writeCase. Verifies the 8 behaviors enumerated in the plan.
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const loadCasesMock = vi.fn();
vi.mock('@/lib/eval/yaml-loader', () => ({
  loadCases: (path: string) => loadCasesMock(path),
  EvalCaseSchema: {},
}));

const writeCaseMock = vi.fn();
vi.mock('@/lib/eval/storage', () => ({
  writeCase: (args: unknown) => writeCaseMock(args),
}));

// Track redis calls so we can assert spend-cap synthetic set/reset behavior.
// CR-01 fix: runner now uses redis.mget over 24 hourly buckets matching
// getSpendToday()'s read pattern, not a single YYYY-MM-DD key. Mock mget here.
const redisGetMock = vi.fn();
const redisMgetMock = vi.fn();
const redisSetMock = vi.fn();
const redisDelMock = vi.fn();
vi.mock('@/lib/redis', () => ({
  redis: {
    get: (key: string) => redisGetMock(key),
    mget: (...keys: string[]) => redisMgetMock(...keys),
    set: (key: string, val: unknown) => redisSetMock(key, val),
    del: (key: string) => redisDelMock(key),
  },
}));

// Quick task 260509-q00: stub mintEvalSession so the runner doesn't try to
// hit /api/session through the existing fetch mocks (which only return chat
// SSE bodies). callAgent stays REAL so the existing fetch-spy assertions
// continue to verify the /api/chat call path verbatim.
const mintEvalSessionMock = vi.fn();
vi.mock('@/lib/eval/agent-client', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    mintEvalSession: (targetUrl: string) => mintEvalSessionMock(targetUrl),
  };
});

// WR-RE-01 fix: mock @/lib/logger so spend-cap reset failures (the
// `cat2_spendcap_reset_failed` log line emitted by the per-iteration
// try/catch at cat2.ts:256-266) surface in test mock-call counts. Without
// this mock, a regression where redis.set/del throws during restore would
// be absorbed silently by the log-and-continue catch and the test harness
// would have no signal. Pattern mirrors tests/lib/eval/storage.test.ts:32-35.
const loggerInfoMock = vi.fn();
const loggerWarnMock = vi.fn();
const loggerErrorMock = vi.fn();
vi.mock('@/lib/logger', () => ({
  childLogger: () => ({
    info: loggerInfoMock,
    warn: loggerWarnMock,
    error: loggerErrorMock,
  }),
}));

beforeEach(() => {
  loadCasesMock.mockReset();
  writeCaseMock.mockReset();
  redisGetMock.mockReset();
  redisMgetMock.mockReset();
  redisSetMock.mockReset();
  redisDelMock.mockReset();
  mintEvalSessionMock.mockReset();
  loggerInfoMock.mockReset();
  loggerWarnMock.mockReset();
  loggerErrorMock.mockReset();
  writeCaseMock.mockResolvedValue(undefined);
  redisSetMock.mockResolvedValue('OK');
  redisDelMock.mockResolvedValue(1);
  redisGetMock.mockResolvedValue(null);
  // Default: all 24 hourly buckets empty (null) — runner will del them in finally.
  redisMgetMock.mockResolvedValue(Array.from({ length: 24 }, () => null));
  mintEvalSessionMock.mockResolvedValue('test-session-id-cat2');
  vi.restoreAllMocks();
});

// ---------- Helpers to build mock SSE stream bodies ----------

function ssTextStream(text: string): string {
  return (
    'data: {"type":"text-start","id":"a"}\n\n' +
    `data: {"type":"text-delta","id":"a","delta":${JSON.stringify(text)}}\n\n` +
    'data: {"type":"text-end","id":"a"}\n\n' +
    'data: [DONE]\n'
  );
}

function ssToolCallStream(args: { toolName: string; input: unknown; text: string }): string {
  // AI SDK v6 emits tool-input-available with the full input object.
  return (
    'data: {"type":"start"}\n\n' +
    `data: {"type":"tool-input-start","toolCallId":"t1","toolName":${JSON.stringify(args.toolName)}}\n\n` +
    `data: {"type":"tool-input-available","toolCallId":"t1","toolName":${JSON.stringify(args.toolName)},"input":${JSON.stringify(args.input)}}\n\n` +
    'data: {"type":"text-start","id":"a"}\n\n' +
    `data: {"type":"text-delta","id":"a","delta":${JSON.stringify(args.text)}}\n\n` +
    'data: {"type":"text-end","id":"a"}\n\n' +
    'data: [DONE]\n'
  );
}

function fetchOk(body: string): Response {
  return new Response(body, { status: 200, statusText: 'OK' });
}

const fakeCase = (overrides: Record<string, unknown> = {}) => ({
  case_id: 'cat2-tool-research-001',
  category: 'cat2' as const,
  prompt: 'Pitch me on Anthropic',
  tool_expected: 'research_company',
  tags: ['tool-correctness', 'happy-path', 'research_company'],
  ...overrides,
});

describe('runCat2', () => {
  // ---- Behavior 1: loads cases from evals/cat-02-tools.yaml
  it('loads cases from evals/cat-02-tools.yaml', async () => {
    loadCasesMock.mockResolvedValue([
      fakeCase({
        prompt: 'Pitch',
        tool_expected: 'research_company',
      }),
    ]);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      fetchOk(
        ssToolCallStream({
          toolName: 'research_company',
          input: { name: 'Anthropic' },
          text:
            'Anthropic is a frontier AI lab.\n\n' +
            'They built Claude — and a lot of the safety research literature behind it.\n\n' +
            'Joe would fit because he ships AI things and writes about how he products them. https://anthropic.com',
        }),
      ),
    );

    const { runCat2 } = await import('@/lib/eval/cats/cat2');
    await runCat2('http://localhost:3000', 'run_test_1');
    expect(loadCasesMock).toHaveBeenCalledWith(expect.stringContaining('cat-02-tools.yaml'));
  });

  // ---- Behavior 2: calls /api/chat against targetUrl with each case prompt
  it('calls /api/chat against targetUrl for each case', async () => {
    loadCasesMock.mockResolvedValue([
      fakeCase({ case_id: 'a' }),
      fakeCase({ case_id: 'b' }),
    ]);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      fetchOk(
        ssToolCallStream({
          toolName: 'research_company',
          input: { name: 'X' },
          text:
            'P1.\n\nP2 has https://example.com link.\n\nP3 wraps it up with another sentence to clear the 30-char per-paragraph filter.',
        }),
      ),
    );
    const { runCat2 } = await import('@/lib/eval/cats/cat2');
    await runCat2('http://localhost:3000', 'run_test_2');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3000/api/chat',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  // ---- Behavior 3 & 4: parses streaming response → extracts tool_call → asserts expected tool fired
  it('asserts the expected tool fired (research_company happy-path)', async () => {
    loadCasesMock.mockResolvedValue([
      fakeCase({
        case_id: 'happy-research',
        tool_expected: 'research_company',
        prompt: 'Pitch me on Anthropic',
      }),
    ]);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      fetchOk(
        ssToolCallStream({
          toolName: 'research_company',
          input: { name: 'Anthropic' },
          text:
            'Anthropic is a frontier AI lab building Claude.\n\n' +
            'Their safety research is well-known and well-published.\n\n' +
            'Joe would fit because he ships and writes — see https://anthropic.com for context.',
        }),
      ),
    );
    const { runCat2 } = await import('@/lib/eval/cats/cat2');
    const result = await runCat2('http://localhost:3000', 'run_test_3');
    expect(result.cases[0].passed).toBe(true);
    expect(result.cases[0].judge_verdict).toBe('pass');
  });

  // ---- Behavior 5: response shape assertions for each tool type
  it('fails research_company when paragraphs <3 (shape assertion)', async () => {
    loadCasesMock.mockResolvedValue([fakeCase({ tool_expected: 'research_company' })]);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      fetchOk(
        ssToolCallStream({
          toolName: 'research_company',
          input: { name: 'X' },
          text: 'Just one short paragraph with https://x.com link.',
        }),
      ),
    );
    const { runCat2 } = await import('@/lib/eval/cats/cat2');
    const result = await runCat2('http://localhost:3000', 'run_test_4');
    expect(result.cases[0].passed).toBe(false);
  });

  it('passes get_case_study happy-path with closing line + word count in range', async () => {
    loadCasesMock.mockResolvedValue([
      fakeCase({
        case_id: 'walkthrough-001',
        tool_expected: 'get_case_study',
        prompt: 'Walk me through cortex-ai-client-win',
      }),
    ]);
    // ~280 words narration ending with the closing line
    const narration = (
      'I shipped a Cortex AI forecasting capability at SEI from mid-onsite ideation to production in four months. '
      + 'The client wanted cash-flow forecasting that lived outside Excel and rolled up across their fund-services book. '
      + 'I scoped it as a Snowflake Cortex AI use case mid-onsite and got buy-in by demoing a tiny prototype against their real data. '
      + 'The biggest risk was AI governance — the legal and privacy partners wanted to see model lineage and how training data flowed in and out. '
      + 'We worked through that by leaning into Snowflake-managed Cortex services, which meant we did not have to defend an in-house training pipeline to the audit folks. '
      + 'I partnered with a small data-engineering team to wire the feature into the existing semantic layer, '
      + 'and I built up the dashboard scaffolding in Power BI so users could compare model output against the existing Excel baseline side-by-side. '
      + 'The demo at the end of month four landed — the analyst literally smiled when they saw their cash-flow forecast running live against the live data set. '
      + 'That smile mattered: it was the social proof we needed to greenlight the next two AI features on the SEI Data Cloud roadmap, '
      + 'and it gave the executive sponsor an easy story to tell upward inside their own org. '
      + 'The lessons I took away were about scoping AI work as PM rather than as ML engineer, '
      + 'about leaning on managed services to avoid governance fights with legal teams who rightfully want lineage, '
      + 'and about the importance of getting prototypes into real-data demo as fast as possible to shake loose stakeholder buy-in.\n\n'
      + 'Want to go deeper, or hear a different story?'
    );
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      fetchOk(
        ssToolCallStream({
          toolName: 'get_case_study',
          input: { slug: 'cortex-ai-client-win' },
          text: narration,
        }),
      ),
    );
    const { runCat2 } = await import('@/lib/eval/cats/cat2');
    const result = await runCat2('http://localhost:3000', 'run_test_5');
    expect(result.cases[0].passed).toBe(true);
  });

  it('passes get_case_study edge-case (unknown slug → menu)', async () => {
    loadCasesMock.mockResolvedValue([
      fakeCase({
        case_id: 'walkthrough-002',
        tool_expected: 'get_case_study',
        prompt: 'Walk me through bigfoot',
      }),
    ]);
    // Menu response: short, lists case-study slugs
    const menu = 'Here are the case studies I have on hand: cortex-ai-client-win, snowflake-edw-migration, ua-project-rescue.';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      fetchOk(
        ssToolCallStream({
          toolName: 'get_case_study',
          input: { slug: 'bigfoot' },
          text: menu,
        }),
      ),
    );
    const { runCat2 } = await import('@/lib/eval/cats/cat2');
    const result = await runCat2('http://localhost:3000', 'run_test_6');
    expect(result.cases[0].passed).toBe(true);
  });

  it('passes design_metric_framework when ≥4 of 6 sections present', async () => {
    loadCasesMock.mockResolvedValue([
      fakeCase({
        case_id: 'metric-001',
        tool_expected: 'design_metric_framework',
        prompt: 'Design a metric for onboarding',
      }),
    ]);
    const framework = (
      'Here is a metric framework.\n\n'
      + 'north_star: % of users completing onboarding in their first session.\n'
      + 'input_metrics: time-to-first-action, % users hitting step 3.\n'
      + 'counter_metrics: tickets opened during onboarding.\n'
      + 'guardrails: NPS does not regress.\n'
      + 'experiment: A/B test the new onboarding flow.\n'
      + 'open_questions: do we count partial completion?'
    );
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      fetchOk(
        ssToolCallStream({
          toolName: 'design_metric_framework',
          input: { description: 'onboarding completion' },
          text: framework,
        }),
      ),
    );
    const { runCat2 } = await import('@/lib/eval/cats/cat2');
    const result = await runCat2('http://localhost:3000', 'run_test_7');
    expect(result.cases[0].passed).toBe(true);
  });

  // ---- Behavior 6: spend-cap synthetic test sets/resets Redis
  // CR-01 fix: runner now SETs the current-hour bucket key matching
  // getSpendToday's hourBucketKey() pattern (`resume-agent:spend:YYYY-MM-DDTHH`).
  // Previously SET a YYYY-MM-DD-only key that the production gate never read,
  // so the case never actually exercised /api/chat's isOverCap() branch.
  it('spend-cap case: sets hourly-bucket key to 350 BEFORE call (matches getSpendToday), resets AFTER', async () => {
    loadCasesMock.mockResolvedValue([
      {
        case_id: 'cat2-tool-metric-003',
        category: 'cat2' as const,
        prompt: 'Design a metric for renewal risk',
        tool_expected: 'design_metric_framework',
        tags: ['tool-correctness', 'spend-cap', 'synthetic'],
      },
    ]);
    // Original buckets all empty → after the test, redis.del should be called for each.
    redisMgetMock.mockResolvedValue(Array.from({ length: 24 }, () => null));
    // Deflection text from /api/chat (DEFLECTIONS.spendcap pattern)
    const deflection = "I'm taking a breather for the day — back tomorrow, or email Joe directly at joe.dollinger@gmail.com.";
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(fetchOk(ssTextStream(deflection)));

    const { runCat2 } = await import('@/lib/eval/cats/cat2');
    const result = await runCat2('http://localhost:3000', 'run_test_8');

    // SET to 350 must have been called with the current-hour-bucket key
    // (YYYY-MM-DDTHH format matching src/lib/redis.ts hourBucketKey).
    const currentHourIso = new Date().toISOString().slice(0, 13);
    const expectedHourKey = `resume-agent:spend:${currentHourIso}`;
    expect(redisSetMock).toHaveBeenCalledWith(expectedHourKey, 350);
    // mget was called with all 24 hour-bucket keys to capture originals
    expect(redisMgetMock).toHaveBeenCalled();
    const mgetArgs = redisMgetMock.mock.calls[0] as string[];
    expect(mgetArgs).toHaveLength(24);
    // First arg is the current-hour bucket; format check.
    expect(mgetArgs[0]).toMatch(/^resume-agent:spend:\d{4}-\d{2}-\d{2}T\d{2}$/);
    // After the test, redis.del should have been called for each bucket (all originals were null).
    expect(redisDelMock).toHaveBeenCalledWith(expectedHourKey);
    // The case should pass: deflection text + no tool fired + 200 status
    expect(result.cases[0].passed).toBe(true);
  });

  it('spend-cap reset still runs when assertion fails (finally block)', async () => {
    loadCasesMock.mockResolvedValue([
      {
        case_id: 'cat2-tool-metric-003',
        category: 'cat2' as const,
        prompt: 'X',
        tool_expected: 'design_metric_framework',
        tags: ['spend-cap', 'synthetic'],
      },
    ]);
    redisMgetMock.mockResolvedValue(Array.from({ length: 24 }, () => null));
    // Response is NOT a deflection — assertion will fail. Reset must still run.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      fetchOk(
        ssToolCallStream({
          toolName: 'design_metric_framework',
          input: { description: 'X' },
          text: 'Here is a metric (this means the spend-cap gate did NOT fire as expected).',
        }),
      ),
    );

    const { runCat2 } = await import('@/lib/eval/cats/cat2');
    const result = await runCat2('http://localhost:3000', 'run_test_9');
    const currentHourIso = new Date().toISOString().slice(0, 13);
    const expectedHourKey = `resume-agent:spend:${currentHourIso}`;
    // Reset must run even though assertion failed (all 24 hourly buckets del'd)
    expect(redisDelMock).toHaveBeenCalledWith(expectedHourKey);
    expect(redisDelMock).toHaveBeenCalledTimes(24);
    expect(result.cases[0].passed).toBe(false);
  });

  // WR-RE-01: verify the per-iteration try/catch inside the finally block
  // (cat2.ts:249-267) is resilient — when one bucket's reset throws, the
  // remaining 23 buckets still get restored AND the failure surfaces via the
  // mocked logger.error. This guards against a regression where a future
  // change accidentally re-aborts the loop on first throw, silently leaving
  // the spend-cap stuck on for subsequent eval runs.
  it('spend-cap reset continues across remaining buckets when one redis.del throws (log-and-continue)', async () => {
    loadCasesMock.mockResolvedValue([
      {
        case_id: 'cat2-tool-metric-003',
        category: 'cat2' as const,
        prompt: 'X',
        tool_expected: 'design_metric_framework',
        tags: ['spend-cap', 'synthetic'],
      },
    ]);
    // All 24 buckets originally null → finally will DEL each.
    redisMgetMock.mockResolvedValue(Array.from({ length: 24 }, () => null));
    // Make the SECOND del call throw (index 1 — first non-current-hour bucket).
    // The first del (current-hour bucket, index 0) succeeds; the 22 that
    // follow must still run.
    let delCallIndex = 0;
    redisDelMock.mockImplementation(async () => {
      const idx = delCallIndex++;
      if (idx === 1) {
        throw new Error('redis transient: ECONNRESET');
      }
      return 1;
    });
    const deflection = "I'm taking a breather for the day — email Joe directly.";
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(fetchOk(ssTextStream(deflection)));

    const { runCat2 } = await import('@/lib/eval/cats/cat2');
    const result = await runCat2('http://localhost:3000', 'run_test_wrre01');

    // All 24 del attempts ran despite the mid-loop throw.
    expect(redisDelMock).toHaveBeenCalledTimes(24);
    // The failure was surfaced via logger.error with the expected event tag
    // (cat2.ts emits 'cat2_spendcap_reset_failed' from the catch).
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.stringContaining('ECONNRESET') }),
      'cat2_spendcap_reset_failed',
    );
    expect(loggerErrorMock).toHaveBeenCalledTimes(1);
    // Case-level assertion still passes (deflection text + no tool fired);
    // the run does not fail just because one reset bucket glitched.
    expect(result.cases[0].passed).toBe(true);
  });

  it('spend-cap reset restores original value when one was present', async () => {
    loadCasesMock.mockResolvedValue([
      {
        case_id: 'cat2-tool-metric-003',
        category: 'cat2' as const,
        prompt: 'X',
        tool_expected: 'design_metric_framework',
        tags: ['spend-cap', 'synthetic'],
      },
    ]);
    // Pre-existing spend value of 42 in the current-hour bucket (index 0);
    // remaining 23 buckets empty. After test, current-hour bucket restored to
    // 42 via SET; remaining 23 buckets DEL'd (they were null originally).
    const originals: (number | null)[] = Array.from({ length: 24 }, (_, i) => (i === 0 ? 42 : null));
    redisMgetMock.mockResolvedValue(originals);
    const deflection = "I'm taking a breather for the day — email Joe directly.";
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(fetchOk(ssTextStream(deflection)));

    const { runCat2 } = await import('@/lib/eval/cats/cat2');
    await runCat2('http://localhost:3000', 'run_test_10');
    const currentHourIso = new Date().toISOString().slice(0, 13);
    const expectedHourKey = `resume-agent:spend:${currentHourIso}`;
    // Sets 350 first (synthetic threshold), then restores to 42 in finally
    expect(redisSetMock).toHaveBeenCalledWith(expectedHourKey, 350);
    expect(redisSetMock).toHaveBeenCalledWith(expectedHourKey, 42);
    // 23 other buckets were null → DEL'd in finally (current-hour was restored via SET)
    expect(redisDelMock).toHaveBeenCalledTimes(23);
  });

  // ---- Behavior 7: writes one eval_cases row per case
  it('writes one eval_cases row per case via writeCase', async () => {
    loadCasesMock.mockResolvedValue([
      fakeCase({ case_id: 'a' }),
      fakeCase({ case_id: 'b' }),
      fakeCase({ case_id: 'c' }),
    ]);
    // mockImplementation returns a fresh Response per call — Response.text()
    // can only be consumed once, so mockResolvedValue (which returns the SAME
    // instance on every call) breaks on the 2nd .text() with "Body unusable".
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      fetchOk(
        ssToolCallStream({
          toolName: 'research_company',
          input: { name: 'X' },
          text:
            'Para one with content beyond thirty chars to clear filter.\n\n'
            + 'Para two with content beyond thirty chars to clear filter and a https://x.com.\n\n'
            + 'Para three with content beyond thirty chars to clear the filter as well.',
        }),
      ),
    );
    const { runCat2 } = await import('@/lib/eval/cats/cat2');
    await runCat2('http://localhost:3000', 'run_test_11');
    expect(writeCaseMock).toHaveBeenCalledTimes(3);
  });

  // ---- Behavior 8: returns CategoryResult with passed = cases.every(passed)
  it('returns CategoryResult with passed = cases.every(c.passed)', async () => {
    loadCasesMock.mockResolvedValue([
      fakeCase({ case_id: 'a' }),
      fakeCase({ case_id: 'b' }),
    ]);
    // First call: passes shape assertion
    // Second call: fails (only 1 paragraph)
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(
      fetchOk(
        ssToolCallStream({
          toolName: 'research_company',
          input: { name: 'X' },
          text:
            'Para one with content beyond thirty chars to clear filter.\n\n'
            + 'Para two with content beyond thirty chars and https://x.com.\n\n'
            + 'Para three with content beyond thirty chars to clear filter.',
        }),
      ),
    );
    fetchSpy.mockResolvedValueOnce(
      fetchOk(
        ssToolCallStream({
          toolName: 'research_company',
          input: { name: 'X' },
          text: 'Single short para.',
        }),
      ),
    );
    const { runCat2 } = await import('@/lib/eval/cats/cat2');
    const result = await runCat2('http://localhost:3000', 'run_test_12');
    expect(result.cases.length).toBe(2);
    expect(result.cases[0].passed).toBe(true);
    expect(result.cases[1].passed).toBe(false);
    expect(result.passed).toBe(false);
  });

  it('handles network errors per-case without aborting the whole category', async () => {
    loadCasesMock.mockResolvedValue([
      fakeCase({ case_id: 'a' }),
      fakeCase({ case_id: 'b' }),
    ]);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockRejectedValueOnce(new TypeError('fetch failed: ECONNREFUSED'));
    fetchSpy.mockResolvedValueOnce(
      fetchOk(
        ssToolCallStream({
          toolName: 'research_company',
          input: { name: 'X' },
          text:
            'Para one with content beyond thirty chars to clear filter.\n\n'
            + 'Para two with content beyond thirty chars and https://x.com.\n\n'
            + 'Para three with content beyond thirty chars to clear filter.',
        }),
      ),
    );
    const { runCat2 } = await import('@/lib/eval/cats/cat2');
    const result = await runCat2('http://localhost:3000', 'run_test_13');
    expect(result.cases.length).toBe(2);
    expect(result.cases[0].passed).toBe(false);
    expect(result.cases[0].judge_rationale).toContain('error');
    expect(result.cases[1].passed).toBe(true);
    // Both rows still written
    expect(writeCaseMock).toHaveBeenCalledTimes(2);
  });
});
