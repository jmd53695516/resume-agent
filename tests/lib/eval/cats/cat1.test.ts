// tests/lib/eval/cats/cat1.test.ts
// Phase 5 Plan 05-04 Task 3 — runCat1 hybrid det+judge logic.
// Path deviation per session-trap #2 (vitest config tests/**/*.test.{ts,tsx}).
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

const loadAllowlistMock = vi.fn();
vi.mock('@/lib/eval/fabrication', () => ({
  loadAllowlist: () => loadAllowlistMock(),
  // Real checkAllowlist behavior is verified in fabrication.test.ts; cat1
  // tests pass through. Stub here covers both signature + the verdict shape.
  checkAllowlist: (response: string, allowlist: string[]) => {
    // Simple stub: flag any token that doesn't appear in the allowlist
    // (case-insensitive substring match — coarse but enough for these tests).
    const allowSet = new Set(allowlist.map((s) => s.toLowerCase()));
    const lower = response.toLowerCase();
    if (lower.includes('inventcorp')) {
      return { unverifiedTokens: ['inventcorp'], verdict: 'flag-for-llm-judge' };
    }
    return allowSet.has(lower) || lower.length > 0
      ? { unverifiedTokens: [], verdict: 'pass' }
      : { unverifiedTokens: [], verdict: 'pass' };
  },
}));

const judgeMock = vi.fn();
vi.mock('@/lib/eval/judge', () => ({
  judgeFactualFidelity: (args: unknown) => judgeMock(args),
}));

const writeCaseMock = vi.fn();
vi.mock('@/lib/eval/storage', () => ({
  writeCase: (args: unknown) => writeCaseMock(args),
}));

const callAgentMock = vi.fn();
const mintEvalSessionMock = vi.fn();
vi.mock('@/lib/eval/agent-client', () => ({
  callAgent: (args: unknown) => callAgentMock(args),
  mintEvalSession: (targetUrl: string) => mintEvalSessionMock(targetUrl),
  parseChatStream: (raw: string) => raw,
}));

beforeEach(() => {
  loadCasesMock.mockReset();
  loadAllowlistMock.mockReset();
  judgeMock.mockReset();
  writeCaseMock.mockReset();
  callAgentMock.mockReset();
  mintEvalSessionMock.mockReset();
  writeCaseMock.mockResolvedValue(undefined);
  // Default: mint succeeds with a stable id so the runner can enter the loop.
  // Tests that need to exercise mint-failure can override per-test.
  mintEvalSessionMock.mockResolvedValue('test-session-id-cat1');
});

const fakeCase = (overrides: Record<string, unknown> = {}) => ({
  case_id: 'cat1-fab-001',
  category: 'cat1' as const,
  prompt: 'Tell me about your time at Anthropic.',
  ground_truth_facts: ['Joe has not worked at Anthropic.'],
  ...overrides,
});

const goodVerdict = {
  verdict: {
    score: 5,
    verdict: 'pass' as const,
    fabrication_detected: false,
    rationale: 'No fabrication; agent declined cleanly.',
  },
  cost_cents: 1,
};

const badVerdict = {
  verdict: {
    score: 2,
    verdict: 'fail' as const,
    fabrication_detected: true,
    rationale: 'Agent fabricated a role at Anthropic.',
  },
  cost_cents: 1,
};

describe('runCat1', () => {
  it('loads cases from evals/cat-01-fabrication.yaml and the allowlist from kb/profile.yml', async () => {
    loadCasesMock.mockResolvedValue([fakeCase()]);
    loadAllowlistMock.mockResolvedValue(['joe', 'dollinger']);
    callAgentMock.mockResolvedValue({ response: 'I have not worked at Anthropic.', httpStatus: 200, rawBody: '', deflection: null });
    judgeMock.mockResolvedValue(goodVerdict);
    const { runCat1 } = await import('@/lib/eval/cats/cat1');
    await runCat1('http://localhost:3000', 'run_test');
    expect(loadCasesMock).toHaveBeenCalledWith(
      expect.stringContaining('cat-01-fabrication.yaml'),
    );
    expect(loadAllowlistMock).toHaveBeenCalledTimes(1);
  });

  it('calls callAgent for each case and captures the assistant response', async () => {
    loadCasesMock.mockResolvedValue([fakeCase({ case_id: 'a' }), fakeCase({ case_id: 'b' })]);
    loadAllowlistMock.mockResolvedValue([]);
    callAgentMock.mockResolvedValue({ response: 'I have not worked there.', httpStatus: 200, rawBody: '', deflection: null });
    judgeMock.mockResolvedValue(goodVerdict);
    const { runCat1 } = await import('@/lib/eval/cats/cat1');
    await runCat1('http://localhost:3000', 'run_test');
    expect(callAgentMock).toHaveBeenCalledTimes(2);
    const firstCall = callAgentMock.mock.calls[0][0];
    expect(firstCall.targetUrl).toBe('http://localhost:3000');
    // Quick task 260509-q00: sessionId is now the minted real session id,
    // shared across all cases in the category. Both calls must use the same
    // sessionId (one mint at runner start).
    expect(firstCall.sessionId).toBe('test-session-id-cat1');
    const secondCall = callAgentMock.mock.calls[1][0];
    expect(secondCall.sessionId).toBe('test-session-id-cat1');
    // Mint was called exactly once per runner invocation, not per case.
    expect(mintEvalSessionMock).toHaveBeenCalledTimes(1);
    expect(mintEvalSessionMock).toHaveBeenCalledWith('http://localhost:3000');
  });

  it('runs LLM judge for every case and combines with deterministic check', async () => {
    loadCasesMock.mockResolvedValue([fakeCase()]);
    loadAllowlistMock.mockResolvedValue([]);
    callAgentMock.mockResolvedValue({ response: 'OK no fabrication.', httpStatus: 200, rawBody: '', deflection: null });
    judgeMock.mockResolvedValue(goodVerdict);
    const { runCat1 } = await import('@/lib/eval/cats/cat1');
    const result = await runCat1('http://localhost:3000', 'run_test');
    expect(judgeMock).toHaveBeenCalledTimes(1);
    expect(result.cases[0].judge_score).toBe(5);
    expect(result.cases[0].judge_verdict).toBe('pass');
    // judge_rationale is JSON-stringified combo of llm_judge + deterministic
    const rationale = JSON.parse(result.cases[0].judge_rationale ?? '{}');
    expect(rationale.llm_judge).toBeDefined();
    expect(rationale.deterministic).toBeDefined();
  });

  it('hybrid pass: det=flag-for-llm-judge + judge=pass → overall pass (judge breaks tie)', async () => {
    // RESEARCH §15: deterministic 'flag-for-llm-judge' is the "needs second
    // opinion" signal. The judge breaks the tie. Pre-fix bug treated 'flag'
    // as auto-fail regardless of judge — surfaced by smoke runId
    // BJ-ktbmzmyJYp0vW7vpfa where 14/15 cases had judge=pass but failed.
    loadCasesMock.mockResolvedValue([fakeCase()]);
    loadAllowlistMock.mockResolvedValue([]);
    callAgentMock.mockResolvedValue({ response: 'I worked at InventCorp.', httpStatus: 200, rawBody: '', deflection: null });
    judgeMock.mockResolvedValue(goodVerdict);
    const { runCat1 } = await import('@/lib/eval/cats/cat1');
    const result = await runCat1('http://localhost:3000', 'run_test');
    expect(result.cases[0].passed).toBe(true);
    expect(result.passed).toBe(true);
  });

  it('hybrid fail: det=flag-for-llm-judge + judge=fail → overall fail (both layers disagree with response)', async () => {
    loadCasesMock.mockResolvedValue([fakeCase()]);
    loadAllowlistMock.mockResolvedValue([]);
    callAgentMock.mockResolvedValue({ response: 'I worked at InventCorp.', httpStatus: 200, rawBody: '', deflection: null });
    judgeMock.mockResolvedValue(badVerdict);
    const { runCat1 } = await import('@/lib/eval/cats/cat1');
    const result = await runCat1('http://localhost:3000', 'run_test');
    expect(result.cases[0].passed).toBe(false);
    expect(result.passed).toBe(false);
  });

  it('writes one eval_cases row per case via writeCase', async () => {
    loadCasesMock.mockResolvedValue([
      fakeCase({ case_id: 'a' }),
      fakeCase({ case_id: 'b' }),
      fakeCase({ case_id: 'c' }),
    ]);
    loadAllowlistMock.mockResolvedValue([]);
    callAgentMock.mockResolvedValue({ response: 'r', httpStatus: 200, rawBody: '', deflection: null });
    judgeMock.mockResolvedValue(goodVerdict);
    const { runCat1 } = await import('@/lib/eval/cats/cat1');
    await runCat1('http://localhost:3000', 'run_test');
    expect(writeCaseMock).toHaveBeenCalledTimes(3);
  });

  it('returns CategoryResult with passed = cases.every(c.passed)', async () => {
    loadCasesMock.mockResolvedValue([fakeCase({ case_id: 'a' }), fakeCase({ case_id: 'b' })]);
    loadAllowlistMock.mockResolvedValue([]);
    // Both responses contain "InventCorp" → det='flag-for-llm-judge', so the
    // judge is the arbiter (post-fix hybrid semantics). A 'pass' response
    // requires judge=pass; judge=fail propagates to category fail.
    callAgentMock.mockResolvedValue({ response: 'I worked at InventCorp.', httpStatus: 200, rawBody: '', deflection: null });
    // First case judge passes; second judge fails
    judgeMock.mockResolvedValueOnce(goodVerdict).mockResolvedValueOnce(badVerdict);
    const { runCat1 } = await import('@/lib/eval/cats/cat1');
    const result = await runCat1('http://localhost:3000', 'run_test');
    expect(result.cases.length).toBe(2);
    expect(result.passed).toBe(false);
    expect(result.cases[0].passed).toBe(true);
    expect(result.cases[1].passed).toBe(false);
  });

  it('handles per-case errors without aborting the whole category (writes a fail row)', async () => {
    loadCasesMock.mockResolvedValue([
      fakeCase({ case_id: 'a' }),
      fakeCase({ case_id: 'b' }),
    ]);
    loadAllowlistMock.mockResolvedValue([]);
    // First call: callAgent throws (network error); second succeeds
    callAgentMock
      .mockRejectedValueOnce(new Error('callAgent network error: ECONNREFUSED'))
      .mockResolvedValueOnce({ response: 'good', httpStatus: 200, rawBody: '', deflection: null });
    judgeMock.mockResolvedValue(goodVerdict);
    const { runCat1 } = await import('@/lib/eval/cats/cat1');
    const result = await runCat1('http://localhost:3000', 'run_test');
    expect(result.cases.length).toBe(2);
    expect(result.cases[0].response).toBeNull();
    expect(result.cases[0].passed).toBe(false);
    expect(result.cases[0].judge_rationale).toContain('error:');
    expect(result.cases[1].passed).toBe(true);
    // Both rows still got written (failure path still calls writeCase)
    expect(writeCaseMock).toHaveBeenCalledTimes(2);
  });

  // Phase 05.1 Item #7: when callAgent returns deflection !== null, the case
  // is marked passed:false with a 'skipped: <reason> deflection' rationale and
  // the judge is NOT called (saves cost; environmental signal not real fab).
  it('skips deflected cases without calling judge; writes a fail row with skipped: rationale', async () => {
    loadCasesMock.mockResolvedValue([fakeCase()]);
    loadAllowlistMock.mockResolvedValue([]);
    callAgentMock.mockResolvedValue({
      response: "You've been at this a bit",
      httpStatus: 200,
      rawBody: '',
      deflection: { reason: 'ratelimit' },
    });
    const { runCat1 } = await import('@/lib/eval/cats/cat1');
    const result = await runCat1('http://localhost:3000', 'run_test_deflect');
    // Judge MUST NOT be called for a deflected case.
    expect(judgeMock).not.toHaveBeenCalled();
    expect(result.cases[0].passed).toBe(false);
    expect(result.cases[0].judge_score).toBeNull();
    expect(result.cases[0].judge_verdict).toBeNull();
    expect(result.cases[0].judge_rationale).toBe('skipped: ratelimit deflection');
    expect(writeCaseMock).toHaveBeenCalledTimes(1);
  });

  it('aggregates cost_cents from agent + judge across all cases', async () => {
    loadCasesMock.mockResolvedValue([fakeCase({ case_id: 'a' }), fakeCase({ case_id: 'b' })]);
    loadAllowlistMock.mockResolvedValue([]);
    callAgentMock.mockResolvedValue({ response: 'ok', httpStatus: 200, rawBody: '', deflection: null });
    judgeMock
      .mockResolvedValueOnce({ ...goodVerdict, cost_cents: 2 })
      .mockResolvedValueOnce({ ...goodVerdict, cost_cents: 3 });
    const { runCat1 } = await import('@/lib/eval/cats/cat1');
    const result = await runCat1('http://localhost:3000', 'run_test');
    expect(result.cost_cents).toBe(5);
  });
});
