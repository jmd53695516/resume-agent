// tests/lib/eval/storage.test.ts
// Phase 5 Plan 05-03 Task 2 — TDD coverage for service-role Supabase writes.
// vitest discovery: tests/**/*.test.{ts,tsx} (path deviation from plan spec
// `src/lib/__tests__/eval/X.test.ts` — vitest config wouldn't find that).
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

const insertMock = vi.fn();
const updateEqMock = vi.fn();
const fromMock = vi.fn((_table: string) => ({
  insert: insertMock,
  update: (vals: Record<string, unknown>) => ({
    eq: (col: string, val: unknown) => updateEqMock(_table, vals, col, val),
  }),
}));

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: { from: fromMock },
}));

const childLoggerInfoMock = vi.fn();
vi.mock('@/lib/logger', () => ({
  childLogger: () => ({ info: childLoggerInfoMock }),
}));

beforeEach(() => {
  fromMock.mockClear();
  insertMock.mockReset();
  updateEqMock.mockReset();
  childLoggerInfoMock.mockReset();
});

describe('createRun', () => {
  it('INSERTs an eval_runs row with status=running and returns the runId (string)', async () => {
    insertMock.mockResolvedValueOnce({ error: null });
    const { createRun } = await import('@/lib/eval/storage');
    const runId = await createRun({
      targetUrl: 'http://localhost:3000',
      judgeModel: 'gemini-2.5-flash-preview-09-2025',
      gitSha: 'abc1234',
      scheduled: false,
    });
    expect(typeof runId).toBe('string');
    expect(runId.length).toBeGreaterThan(0);
    expect(fromMock).toHaveBeenCalledWith('eval_runs');
    const insertCall = insertMock.mock.calls[0][0];
    expect(insertCall).toMatchObject({
      id: runId,
      target_url: 'http://localhost:3000',
      judge_model: 'gemini-2.5-flash-preview-09-2025',
      git_sha: 'abc1234',
      scheduled: false,
      status: 'running',
    });
    expect(childLoggerInfoMock).toHaveBeenCalledWith(
      expect.objectContaining({ runId, targetUrl: 'http://localhost:3000', scheduled: false }),
      'eval_run_created',
    );
  });

  it('re-throws createRun INSERT error with helpful context', async () => {
    insertMock.mockResolvedValueOnce({ error: { message: 'duplicate key value violates unique constraint' } });
    const { createRun } = await import('@/lib/eval/storage');
    await expect(
      createRun({
        targetUrl: 'http://localhost:3000',
        judgeModel: 'g',
        gitSha: undefined,
        scheduled: false,
      }),
    ).rejects.toThrow(/createRun failed: duplicate key/);
  });
});

describe('writeCase', () => {
  it('INSERTs an eval_cases row with all fields populated', async () => {
    insertMock.mockResolvedValueOnce({ error: null });
    const { writeCase } = await import('@/lib/eval/storage');
    await writeCase({
      runId: 'run_abc',
      result: {
        category: 'cat1',
        case_id: 'fact-001',
        prompt: 'What did Joe ship?',
        response: 'A forecasting model at Gap.',
        judge_score: 5,
        judge_verdict: 'pass',
        judge_rationale: 'No fabrication.',
        passed: true,
        cost_cents: 2,
      },
    });
    expect(fromMock).toHaveBeenCalledWith('eval_cases');
    const insertCall = insertMock.mock.calls[0][0];
    expect(insertCall).toMatchObject({
      run_id: 'run_abc',
      category: 'cat1',
      case_id: 'fact-001',
      prompt: 'What did Joe ship?',
      response: 'A forecasting model at Gap.',
      judge_score: 5,
      judge_verdict: 'pass',
      judge_rationale: 'No fabrication.',
      passed: true,
      cost_cents: 2,
    });
    expect(insertCall.id).toBeDefined();
    expect(childLoggerInfoMock).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'run_abc', category: 'cat1', caseId: 'fact-001', passed: true }),
      'eval_case_written',
    );
  });

  it('re-throws writeCase INSERT error with runId + case_id context', async () => {
    insertMock.mockResolvedValueOnce({ error: { message: 'check constraint violated' } });
    const { writeCase } = await import('@/lib/eval/storage');
    await expect(
      writeCase({
        runId: 'run_xyz',
        result: {
          category: 'cat1',
          case_id: 'bad-case',
          prompt: 'p',
          response: null,
          judge_score: null,
          judge_verdict: null,
          judge_rationale: null,
          passed: false,
          cost_cents: 0,
        },
      }),
    ).rejects.toThrow(/writeCase failed for runId=run_xyz case=bad-case/);
  });
});

describe('updateRunStatus', () => {
  it('UPDATEs an existing run with finished_at, totals, status', async () => {
    updateEqMock.mockResolvedValueOnce({ error: null });
    const { updateRunStatus } = await import('@/lib/eval/storage');
    await updateRunStatus({
      runId: 'run_abc',
      summary: {
        totalCases: 40,
        passed: 38,
        failed: 2,
        totalCostCents: 130,
        status: 'failed',
      },
    });
    expect(fromMock).toHaveBeenCalledWith('eval_runs');
    expect(updateEqMock).toHaveBeenCalledTimes(1);
    const [, vals, col, val] = updateEqMock.mock.calls[0];
    expect(col).toBe('id');
    expect(val).toBe('run_abc');
    expect(vals).toMatchObject({
      total_cases: 40,
      passed: 38,
      failed: 2,
      total_cost_cents: 130,
      status: 'failed',
    });
    expect(typeof vals.finished_at).toBe('string');
    expect(childLoggerInfoMock).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'run_abc', status: 'failed', totalCostCents: 130 }),
      'eval_run_finalized',
    );
  });

  it('re-throws updateRunStatus error with runId context', async () => {
    updateEqMock.mockResolvedValueOnce({ error: { message: 'row not found' } });
    const { updateRunStatus } = await import('@/lib/eval/storage');
    await expect(
      updateRunStatus({
        runId: 'run_missing',
        summary: { totalCases: 0, passed: 0, failed: 0, totalCostCents: 0, status: 'error' },
      }),
    ).rejects.toThrow(/updateRunStatus failed for runId=run_missing/);
  });
});
