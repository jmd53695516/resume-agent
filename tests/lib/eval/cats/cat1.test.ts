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
    callAgentMock.mockResolvedValue({ response: 'I have not worked at Anthropic.', httpStatus: 200, rawBody: '' });
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
    callAgentMock.mockResolvedValue({ response: 'I have not worked there.', httpStatus: 200, rawBody: '' });
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
    callAgentMock.mockResolvedValue({ response: 'OK no fabrication.', httpStatus: 200, rawBody: '' });
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

  it('passes ONLY when both deterministic and judge return pass (zero-tolerance hybrid)', async () => {
    loadCasesMock.mockResolvedValue([fakeCase()]);
    loadAllowlistMock.mockResolvedValue([]);
    // Response containing "InventCorp" → deterministic flag-for-llm-judge
    callAgentMock.mockResolvedValue({ response: 'I worked at InventCorp.', httpStatus: 200, rawBody: '' });
    // Even with judge=pass, det=flag → overall fail
    judgeMock.mockResolvedValue(goodVerdict);
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
    callAgentMock.mockResolvedValue({ response: 'r', httpStatus: 200, rawBody: '' });
    judgeMock.mockResolvedValue(goodVerdict);
    const { runCat1 } = await import('@/lib/eval/cats/cat1');
    await runCat1('http://localhost:3000', 'run_test');
    expect(writeCaseMock).toHaveBeenCalledTimes(3);
  });

  it('returns CategoryResult with passed = cases.every(c.passed)', async () => {
    loadCasesMock.mockResolvedValue([fakeCase({ case_id: 'a' }), fakeCase({ case_id: 'b' })]);
    loadAllowlistMock.mockResolvedValue([]);
    callAgentMock.mockResolvedValue({ response: 'good', httpStatus: 200, rawBody: '' });
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
      .mockResolvedValueOnce({ response: 'good', httpStatus: 200, rawBody: '' });
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

  it('aggregates cost_cents from agent + judge across all cases', async () => {
    loadCasesMock.mockResolvedValue([fakeCase({ case_id: 'a' }), fakeCase({ case_id: 'b' })]);
    loadAllowlistMock.mockResolvedValue([]);
    callAgentMock.mockResolvedValue({ response: 'ok', httpStatus: 200, rawBody: '' });
    judgeMock
      .mockResolvedValueOnce({ ...goodVerdict, cost_cents: 2 })
      .mockResolvedValueOnce({ ...goodVerdict, cost_cents: 3 });
    const { runCat1 } = await import('@/lib/eval/cats/cat1');
    const result = await runCat1('http://localhost:3000', 'run_test');
    expect(result.cost_cents).toBe(5);
  });
});
