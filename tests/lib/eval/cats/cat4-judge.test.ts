// tests/lib/eval/cats/cat4-judge.test.ts
// Phase 5 Plan 05-06 Task 3 — runCat4Judge LLM-judge voice-fidelity logic.
//
// Mirrors the cat3 test pattern (LLM-judge), but the pass logic is two-gate:
//   per-case: judge.verdict.average >= 4.0
//   category: results.every(c => c.passed) AND aggregate-avg >= 4.0
// Loads voice samples from kb/voice.md (real file read; small fixture suffices
// because we mock judgeVoiceFidelity).
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

const judgeMock = vi.fn();
vi.mock('@/lib/eval/judge', () => ({
  judgeVoiceFidelity: (args: unknown) => judgeMock(args),
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
  judgeMock.mockReset();
  writeCaseMock.mockReset();
  callAgentMock.mockReset();
  mintEvalSessionMock.mockReset();
  writeCaseMock.mockResolvedValue(undefined);
  mintEvalSessionMock.mockResolvedValue('test-session-id-cat4-judge');
});

const fakeCase = (overrides: Record<string, unknown> = {}) => ({
  case_id: 'cat4-prompt-001',
  category: 'cat4-judge' as const,
  prompt: 'Tell me about a time you made the wrong call.',
  tags: ['voice-elicit', 'retrospective'],
  ...overrides,
});

const verdictWithAvg = (avg: number) => ({
  verdict: {
    diction: Math.round(avg),
    hedge_density: Math.round(avg),
    sentence_rhythm: Math.round(avg),
    concreteness: Math.round(avg),
    filler_absence: Math.round(avg),
    average: avg,
    rationale: `avg=${avg}`,
  },
  cost_cents: 1,
});

const fiveCases = [
  fakeCase({ case_id: 'cat4-prompt-001' }),
  fakeCase({ case_id: 'cat4-prompt-002' }),
  fakeCase({ case_id: 'cat4-prompt-003' }),
  fakeCase({ case_id: 'cat4-prompt-004' }),
  fakeCase({ case_id: 'cat4-prompt-005' }),
];

describe('runCat4Judge', () => {
  // ---- Behavior 1: loads cases from evals/cat-04-prompts.yaml
  it('loads cases from evals/cat-04-prompts.yaml', async () => {
    loadCasesMock.mockResolvedValue([fakeCase()]);
    callAgentMock.mockResolvedValue({ response: 'r', httpStatus: 200, rawBody: '' });
    judgeMock.mockResolvedValue(verdictWithAvg(5));
    const { runCat4Judge } = await import('@/lib/eval/cats/cat4-judge');
    await runCat4Judge('http://localhost:3000', 'run_t1');
    expect(loadCasesMock).toHaveBeenCalledWith(expect.stringContaining('cat-04-prompts.yaml'));
  });

  // ---- Behavior 2: loads voice samples from kb/voice.md (real file read)
  it('loads voice samples from kb/voice.md and passes them to judgeVoiceFidelity', async () => {
    loadCasesMock.mockResolvedValue([fakeCase()]);
    callAgentMock.mockResolvedValue({ response: 'r', httpStatus: 200, rawBody: '' });
    judgeMock.mockResolvedValue(verdictWithAvg(5));

    const { runCat4Judge } = await import('@/lib/eval/cats/cat4-judge');
    await runCat4Judge('http://localhost:3000', 'run_t2');

    const judgeCall = judgeMock.mock.calls[0][0];
    expect(Array.isArray(judgeCall.voiceSamples)).toBe(true);
    expect(judgeCall.voiceSamples.length).toBeGreaterThan(0);
    expect(judgeCall.voiceSamples.length).toBeLessThanOrEqual(8);
    // Filtering must skip HTML-comment blocks AND italic *Source: lines
    judgeCall.voiceSamples.forEach((s: string) => {
      expect(s.startsWith('<!--')).toBe(false);
      expect(s.startsWith('*Source:')).toBe(false);
      expect(s.startsWith('#')).toBe(false);
    });
  });

  // ---- Behavior 3: per-case judgeVoiceFidelity called with response + caseId
  it('calls judgeVoiceFidelity per case with response + caseId', async () => {
    loadCasesMock.mockResolvedValue([fakeCase({ case_id: 'cp-1', prompt: 'voice prompt' })]);
    callAgentMock.mockResolvedValue({ response: 'agent reply text', httpStatus: 200, rawBody: '' });
    judgeMock.mockResolvedValue(verdictWithAvg(5));

    const { runCat4Judge } = await import('@/lib/eval/cats/cat4-judge');
    await runCat4Judge('http://localhost:3000', 'run_t3');

    expect(callAgentMock).toHaveBeenCalledWith({
      targetUrl: 'http://localhost:3000',
      prompt: 'voice prompt',
      // Quick task 260509-q00: synthetic id replaced with minted session id.
      sessionId: 'test-session-id-cat4-judge',
    });
    const judgeCall = judgeMock.mock.calls[0][0];
    expect(judgeCall.response).toBe('agent reply text');
    expect(judgeCall.caseId).toBe('cp-1');
  });

  // ---- Behavior 4: per-case pass = (avg >= 4.0)
  it('per-case passes when verdict.average >= 4.0', async () => {
    loadCasesMock.mockResolvedValue([fakeCase()]);
    callAgentMock.mockResolvedValue({ response: 'r', httpStatus: 200, rawBody: '' });
    judgeMock.mockResolvedValue(verdictWithAvg(4.0));

    const { runCat4Judge } = await import('@/lib/eval/cats/cat4-judge');
    const result = await runCat4Judge('http://localhost:3000', 'run_t4');
    expect(result.cases[0].passed).toBe(true);
    expect(result.cases[0].judge_score).toBe(4.0);
  });

  it('per-case fails when verdict.average < 4.0', async () => {
    loadCasesMock.mockResolvedValue([fakeCase()]);
    callAgentMock.mockResolvedValue({ response: 'r', httpStatus: 200, rawBody: '' });
    judgeMock.mockResolvedValue(verdictWithAvg(3.8));

    const { runCat4Judge } = await import('@/lib/eval/cats/cat4-judge');
    const result = await runCat4Judge('http://localhost:3000', 'run_t5');
    expect(result.cases[0].passed).toBe(false);
  });

  // ---- Behavior 5: category passed = ALL per-case pass AND aggregate-avg >= 4.0
  it('category passes when all 5 cases >= 4.0 and aggregate >= 4.0', async () => {
    loadCasesMock.mockResolvedValue(fiveCases);
    callAgentMock.mockResolvedValue({ response: 'r', httpStatus: 200, rawBody: '' });
    judgeMock
      .mockResolvedValueOnce(verdictWithAvg(4.2))
      .mockResolvedValueOnce(verdictWithAvg(4.0))
      .mockResolvedValueOnce(verdictWithAvg(4.5))
      .mockResolvedValueOnce(verdictWithAvg(4.1))
      .mockResolvedValueOnce(verdictWithAvg(4.0));

    const { runCat4Judge } = await import('@/lib/eval/cats/cat4-judge');
    const result = await runCat4Judge('http://localhost:3000', 'run_t6');
    expect(result.cases.length).toBe(5);
    expect(result.passed).toBe(true);
  });

  it('category fails if any single case < 4.0 even when aggregate would be >= 4.0', async () => {
    loadCasesMock.mockResolvedValue(fiveCases);
    callAgentMock.mockResolvedValue({ response: 'r', httpStatus: 200, rawBody: '' });
    // Aggregate would be (5+5+5+5+3)/5 = 4.6, but case 5 < 4.0 -> fail
    judgeMock
      .mockResolvedValueOnce(verdictWithAvg(5))
      .mockResolvedValueOnce(verdictWithAvg(5))
      .mockResolvedValueOnce(verdictWithAvg(5))
      .mockResolvedValueOnce(verdictWithAvg(5))
      .mockResolvedValueOnce(verdictWithAvg(3));

    const { runCat4Judge } = await import('@/lib/eval/cats/cat4-judge');
    const result = await runCat4Judge('http://localhost:3000', 'run_t7');
    expect(result.passed).toBe(false);
    expect(result.cases.filter((c) => c.passed).length).toBe(4);
  });

  // ---- Behavior 6: writes one eval_cases row per case with judge_score = avg, full verdict JSON in rationale
  it('writes one eval_cases row per case with judge_score = avg + full verdict JSON in rationale', async () => {
    loadCasesMock.mockResolvedValue([fakeCase({ case_id: 'a' }), fakeCase({ case_id: 'b' })]);
    callAgentMock.mockResolvedValue({ response: 'r', httpStatus: 200, rawBody: '' });
    judgeMock.mockResolvedValue(verdictWithAvg(4.5));

    const { runCat4Judge } = await import('@/lib/eval/cats/cat4-judge');
    await runCat4Judge('http://localhost:3000', 'run_t8');
    expect(writeCaseMock).toHaveBeenCalledTimes(2);
    const firstWrite = writeCaseMock.mock.calls[0][0];
    expect(firstWrite.result.judge_score).toBe(4.5);
    expect(firstWrite.result.category).toBe('cat4-judge');
    // Full per-dim JSON, not just the rationale string
    const parsed = JSON.parse(firstWrite.result.judge_rationale);
    expect(parsed.diction).toBeGreaterThanOrEqual(1);
    expect(parsed.average).toBe(4.5);
    expect(parsed.rationale).toMatch(/avg=/);
  });

  // ---- Behavior 7: cost aggregation
  it('returns CategoryResult with cost_cents = sum of judge calls', async () => {
    loadCasesMock.mockResolvedValue([fakeCase({ case_id: 'a' }), fakeCase({ case_id: 'b' })]);
    callAgentMock.mockResolvedValue({ response: 'r', httpStatus: 200, rawBody: '' });
    judgeMock
      .mockResolvedValueOnce({ ...verdictWithAvg(5), cost_cents: 2 })
      .mockResolvedValueOnce({ ...verdictWithAvg(5), cost_cents: 3 });

    const { runCat4Judge } = await import('@/lib/eval/cats/cat4-judge');
    const result = await runCat4Judge('http://localhost:3000', 'run_t9');
    expect(result.cost_cents).toBe(5);
  });

  // ---- Per-case errors don't abort whole category (parallels cat1 / cat3)
  it('handles per-case errors without aborting; writes a fail row', async () => {
    loadCasesMock.mockResolvedValue([fakeCase({ case_id: 'a' }), fakeCase({ case_id: 'b' })]);
    callAgentMock
      .mockRejectedValueOnce(new Error('callAgent network error: ECONNREFUSED'))
      .mockResolvedValueOnce({ response: 'r', httpStatus: 200, rawBody: '' });
    judgeMock.mockResolvedValue(verdictWithAvg(5));

    const { runCat4Judge } = await import('@/lib/eval/cats/cat4-judge');
    const result = await runCat4Judge('http://localhost:3000', 'run_t10');
    expect(result.cases.length).toBe(2);
    expect(result.cases[0].response).toBeNull();
    expect(result.cases[0].passed).toBe(false);
    expect(result.cases[0].judge_rationale).toContain('error');
    expect(result.cases[1].passed).toBe(true);
    expect(writeCaseMock).toHaveBeenCalledTimes(2);
  });

  // ---- Returns category 'cat4-judge'
  it('returns category cat4-judge', async () => {
    loadCasesMock.mockResolvedValue([fakeCase()]);
    callAgentMock.mockResolvedValue({ response: 'r', httpStatus: 200, rawBody: '' });
    judgeMock.mockResolvedValue(verdictWithAvg(5));

    const { runCat4Judge } = await import('@/lib/eval/cats/cat4-judge');
    const result = await runCat4Judge('http://localhost:3000', 'run_t11');
    expect(result.category).toBe('cat4-judge');
  });
});
