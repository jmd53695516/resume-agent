// tests/lib/eval/ab-mapping.test.ts
// Phase 5 Plan 05-08 Task 2 — TDD coverage for Cat 4 blind A/B server-side
// mapping (EVAL-05; RESEARCH §10).
//
// vitest discovery: tests/**/*.test.{ts,tsx} (Rule 3 path correction — plan
// frontmatter listed src/lib/__tests__/, but vitest only collects from tests/.
// Identical fix to Plans 05-04..05-07).
//
// Mocks: supabaseAdmin (from @/lib/supabase-server), createRun + writeCase +
// updateRunStatus (from @/lib/eval/storage), childLogger (from @/lib/logger).
// env shim avoids env.ts schema validation failures during test boot.
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

// Supabase mock — supports two shapes used by ab-mapping.ts:
//   .from('eval_ab_sessions').insert({...}) → { error }
//   .from('eval_ab_sessions').select(cols).eq(col, val).single() → { data, error }
//   .from('eval_ab_sessions').update({...}).eq(col, val) → { error }
const insertMock = vi.fn();
const singleMock = vi.fn();
const updateEqMock = vi.fn();

const fromMock = vi.fn((_table: string) => ({
  insert: (row: Record<string, unknown>) => insertMock(_table, row),
  select: (_cols: string) => ({
    eq: (_col: string, _val: unknown) => ({
      single: () => singleMock(_table, _col, _val),
    }),
  }),
  update: (vals: Record<string, unknown>) => ({
    eq: (col: string, val: unknown) => updateEqMock(_table, vals, col, val),
  }),
}));

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: { from: fromMock },
}));

const createRunMock = vi.fn();
const writeCaseMock = vi.fn();
const updateRunStatusMock = vi.fn();
vi.mock('@/lib/eval/storage', () => ({
  createRun: (args: unknown) => createRunMock(args),
  writeCase: (args: unknown) => writeCaseMock(args),
  updateRunStatus: (args: unknown) => updateRunStatusMock(args),
}));

vi.mock('@/lib/logger', () => ({
  childLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

beforeEach(() => {
  fromMock.mockClear();
  insertMock.mockReset();
  singleMock.mockReset();
  updateEqMock.mockReset();
  createRunMock.mockReset();
  writeCaseMock.mockReset();
  updateRunStatusMock.mockReset();
  insertMock.mockResolvedValue({ error: null });
  updateEqMock.mockResolvedValue({ error: null });
  writeCaseMock.mockResolvedValue(undefined);
  updateRunStatusMock.mockResolvedValue(undefined);
  createRunMock.mockResolvedValue('run_test_123');
});

const fakeAgent = (i: number) => ({
  source_id: `cat4-prompt-00${i}`,
  snippet: `agent paragraph ${i}`,
});
const fakeJoe = (i: number) => ({
  source_id: `cat4-real-00${i}`,
  snippet: `real joe excerpt ${i}`,
});

const fiveAgent = [fakeAgent(1), fakeAgent(2), fakeAgent(3), fakeAgent(4), fakeAgent(5)];
const fiveJoe = [fakeJoe(1), fakeJoe(2), fakeJoe(3), fakeJoe(4), fakeJoe(5)];

describe('createAbSession', () => {
  // ---- Test 1: shuffles, INSERTs eval_ab_sessions, returns sessionId
  it('INSERTs an eval_ab_sessions row and returns sessionId + renderedSnippets', async () => {
    const { createAbSession } = await import('@/lib/eval/ab-mapping');
    const result = await createAbSession({
      agentParagraphs: fiveAgent,
      realJoeExcerpts: fiveJoe,
    });

    expect(typeof result.sessionId).toBe('string');
    expect(result.sessionId.length).toBeGreaterThan(0);
    expect(fromMock).toHaveBeenCalledWith('eval_ab_sessions');
    expect(insertMock).toHaveBeenCalledTimes(1);

    const inserted = insertMock.mock.calls[0][1] as { id: string; shuffled_snippets: unknown };
    expect(inserted.id).toBe(result.sessionId);
    expect(Array.isArray(inserted.shuffled_snippets)).toBe(true);
  });

  // ---- Test 2: shuffled_snippets has exactly 10 elements with unique positions 0-9
  it('produces shuffled_snippets with exactly 10 elements and unique positions 0-9', async () => {
    const { createAbSession } = await import('@/lib/eval/ab-mapping');
    await createAbSession({
      agentParagraphs: fiveAgent,
      realJoeExcerpts: fiveJoe,
    });

    const inserted = insertMock.mock.calls[0][1] as {
      shuffled_snippets: Array<{ position: number }>;
    };
    expect(inserted.shuffled_snippets).toHaveLength(10);
    const positions = inserted.shuffled_snippets.map((s) => s.position).sort((a, b) => a - b);
    expect(positions).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  // ---- Test 3: each element has fields {kind, source_id, snippet, position}; 5 ai + 5 joe
  it('each element has {kind, source_id, snippet, position}; exactly 5 ai + 5 joe', async () => {
    const { createAbSession } = await import('@/lib/eval/ab-mapping');
    await createAbSession({
      agentParagraphs: fiveAgent,
      realJoeExcerpts: fiveJoe,
    });

    const inserted = insertMock.mock.calls[0][1] as {
      shuffled_snippets: Array<{
        kind: 'ai' | 'joe';
        source_id: string;
        snippet: string;
        position: number;
      }>;
    };
    inserted.shuffled_snippets.forEach((s) => {
      expect(['ai', 'joe']).toContain(s.kind);
      expect(typeof s.source_id).toBe('string');
      expect(typeof s.snippet).toBe('string');
      expect(typeof s.position).toBe('number');
    });
    const aiCount = inserted.shuffled_snippets.filter((s) => s.kind === 'ai').length;
    const joeCount = inserted.shuffled_snippets.filter((s) => s.kind === 'joe').length;
    expect(aiCount).toBe(5);
    expect(joeCount).toBe(5);
  });

  // ---- Test 3b: renderedSnippets exposed to caller MUST NOT include `kind` field (T-05-08-01)
  it('renderedSnippets returned to caller omits kind (T-05-08-01 — no DOM leak)', async () => {
    const { createAbSession } = await import('@/lib/eval/ab-mapping');
    const result = await createAbSession({
      agentParagraphs: fiveAgent,
      realJoeExcerpts: fiveJoe,
    });
    expect(result.renderedSnippets).toHaveLength(10);
    result.renderedSnippets.forEach((s) => {
      expect(s).toHaveProperty('position');
      expect(s).toHaveProperty('snippet');
      expect(s).not.toHaveProperty('kind');
      expect(s).not.toHaveProperty('source_id');
    });
  });

  // ---- Test 3c: rejects wrong-length inputs
  it('throws when agentParagraphs length !== 5', async () => {
    const { createAbSession } = await import('@/lib/eval/ab-mapping');
    await expect(
      createAbSession({
        agentParagraphs: [fakeAgent(1), fakeAgent(2)],
        realJoeExcerpts: fiveJoe,
      }),
    ).rejects.toThrow(/exactly 5/);
  });

  it('throws when realJoeExcerpts length !== 5', async () => {
    const { createAbSession } = await import('@/lib/eval/ab-mapping');
    await expect(
      createAbSession({
        agentParagraphs: fiveAgent,
        realJoeExcerpts: [fakeJoe(1)],
      }),
    ).rejects.toThrow(/exactly 5/);
  });

  it('propagates supabase insert errors', async () => {
    insertMock.mockResolvedValueOnce({ error: { message: 'insert failed: duplicate id' } });
    const { createAbSession } = await import('@/lib/eval/ab-mapping');
    await expect(
      createAbSession({ agentParagraphs: fiveAgent, realJoeExcerpts: fiveJoe }),
    ).rejects.toThrow(/insert failed/);
  });
});

describe('validateAndScoreAbSession', () => {
  // Build a deterministic mapping: positions 0,2,4,6,8 are AI; 1,3,5,7,9 are joe.
  const buildMapping = () => {
    const m: Array<{
      kind: 'ai' | 'joe';
      source_id: string;
      snippet: string;
      position: number;
    }> = [];
    for (let i = 0; i < 10; i++) {
      m.push({
        kind: i % 2 === 0 ? 'ai' : 'joe',
        source_id: i % 2 === 0 ? `cat4-prompt-00${i}` : `cat4-real-00${i}`,
        snippet: `snippet ${i}`,
        position: i,
      });
    }
    return m;
  };

  const futureExpiresAt = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

  // ---- Test 4: identification_pct = correctAi / 5; passed = pct < 0.70
  it('computes pct = correctAi / 5 and passed when pct < 0.70', async () => {
    // Identifications: tester says ALL positions are AI (true on all 10).
    // correctAi = 5 (all 5 AI snippets correctly identified) → pct=1.0 → passed=false.
    singleMock.mockResolvedValueOnce({
      data: {
        shuffled_snippets: buildMapping(),
        expires_at: futureExpiresAt(),
        submitted_at: null,
      },
      error: null,
    });

    const { validateAndScoreAbSession } = await import('@/lib/eval/ab-mapping');
    const result = await validateAndScoreAbSession({
      sessionId: 'sess_t4',
      identifications: [true, true, true, true, true, true, true, true, true, true],
      testerRole: 'pm',
      targetUrl: 'http://localhost:3000',
    });

    expect(result.pct).toBe(1.0);
    expect(result.passed).toBe(false);
    expect(result.runId).toBe('run_test_123');
  });

  it('passes when correctAi / 5 < 0.70 (tester guesses badly)', async () => {
    // Tester says ALL are joe (all false). correctAi = 0 → pct=0 → passed=true.
    singleMock.mockResolvedValueOnce({
      data: {
        shuffled_snippets: buildMapping(),
        expires_at: futureExpiresAt(),
        submitted_at: null,
      },
      error: null,
    });

    const { validateAndScoreAbSession } = await import('@/lib/eval/ab-mapping');
    const result = await validateAndScoreAbSession({
      sessionId: 'sess_t4b',
      identifications: [false, false, false, false, false, false, false, false, false, false],
      testerRole: 'non-pm',
      targetUrl: 'http://localhost:3000',
    });

    expect(result.pct).toBe(0);
    expect(result.passed).toBe(true);
  });

  it('boundary: pct = 0.6 (3/5 AI picks correct) → passed=true (< 0.70)', async () => {
    // Pick AI at positions 0,2,4 (correct: 3 ai); pick joe at 6,8 (wrong-AI miss);
    // pick joe at all odd positions (correctly NOT calling them AI).
    // correctAi = 3 → pct = 0.6 → passed = true (0.6 < 0.70).
    singleMock.mockResolvedValueOnce({
      data: {
        shuffled_snippets: buildMapping(),
        expires_at: futureExpiresAt(),
        submitted_at: null,
      },
      error: null,
    });

    const { validateAndScoreAbSession } = await import('@/lib/eval/ab-mapping');
    const ids = [true, false, true, false, true, false, false, false, false, false];
    const result = await validateAndScoreAbSession({
      sessionId: 'sess_t4c',
      identifications: ids,
      testerRole: 'other',
      targetUrl: 'http://localhost:3000',
    });

    expect(result.pct).toBeCloseTo(0.6, 5);
    expect(result.passed).toBe(true);
  });

  // ---- Test 4b: judge_rationale carries both pct AND overall correct (10-position)
  it('judge_rationale JSON contains pct, passed, correctAi, correct, testerRole', async () => {
    singleMock.mockResolvedValueOnce({
      data: {
        shuffled_snippets: buildMapping(),
        expires_at: futureExpiresAt(),
        submitted_at: null,
      },
      error: null,
    });

    const { validateAndScoreAbSession } = await import('@/lib/eval/ab-mapping');
    // ids: AI on all even positions (correct AI), joe on all odd (correct joe)
    // correctAi = 5; correct (10-position match) = 10
    const ids = [true, false, true, false, true, false, true, false, true, false];
    await validateAndScoreAbSession({
      sessionId: 'sess_t4d',
      identifications: ids,
      testerRole: 'pm',
      targetUrl: 'http://localhost:3000',
    });

    const writeCall = writeCaseMock.mock.calls[0][0] as {
      result: { judge_rationale: string };
    };
    const rationale = JSON.parse(writeCall.result.judge_rationale) as {
      pct: number;
      passed: boolean;
      correctAi: number;
      correct: number;
      testerRole: string;
    };
    expect(rationale.pct).toBe(1.0);
    expect(rationale.passed).toBe(false);
    expect(rationale.correctAi).toBe(5);
    expect(rationale.correct).toBe(10);
    expect(rationale.testerRole).toBe('pm');
  });

  // ---- Test 5: writes eval_runs row with category cat4-blind-ab; passed flag mirrors result
  it('writes eval_cases row with category=cat4-blind-ab and passed flag matches', async () => {
    singleMock.mockResolvedValueOnce({
      data: {
        shuffled_snippets: buildMapping(),
        expires_at: futureExpiresAt(),
        submitted_at: null,
      },
      error: null,
    });

    const { validateAndScoreAbSession } = await import('@/lib/eval/ab-mapping');
    await validateAndScoreAbSession({
      sessionId: 'sess_t5',
      identifications: [false, false, false, false, false, false, false, false, false, false],
      testerRole: 'non-pm',
      targetUrl: 'http://localhost:3000',
    });

    expect(createRunMock).toHaveBeenCalledTimes(1);
    expect(writeCaseMock).toHaveBeenCalledTimes(1);
    expect(updateRunStatusMock).toHaveBeenCalledTimes(1);

    const writeArgs = writeCaseMock.mock.calls[0][0] as {
      runId: string;
      result: { category: string; passed: boolean };
    };
    expect(writeArgs.runId).toBe('run_test_123');
    expect(writeArgs.result.category).toBe('cat4-blind-ab');
    expect(writeArgs.result.passed).toBe(true); // pct=0 < 0.70

    const updateArgs = updateRunStatusMock.mock.calls[0][0] as {
      runId: string;
      summary: { status: string; passed: number; failed: number };
    };
    expect(updateArgs.runId).toBe('run_test_123');
    expect(updateArgs.summary.status).toBe('passed');

    // Marks eval_ab_session as submitted
    const updateAbCall = updateEqMock.mock.calls.find(
      (c) => c[0] === 'eval_ab_sessions',
    );
    expect(updateAbCall).toBeDefined();
    const updateAbVals = updateAbCall![1] as Record<string, unknown>;
    expect(updateAbVals.submitted_at).toBeDefined();
    expect(updateAbVals.tester_role).toBe('non-pm');
    expect(updateAbVals.eval_run_id).toBe('run_test_123');
    expect(updateAbVals.identifications).toEqual([
      false, false, false, false, false, false, false, false, false, false,
    ]);
  });

  // ---- Test 6: rejects expired sessions
  it('rejects expired sessions (expires_at < now())', async () => {
    singleMock.mockResolvedValueOnce({
      data: {
        shuffled_snippets: buildMapping(),
        expires_at: new Date(Date.now() - 60 * 1000).toISOString(),
        submitted_at: null,
      },
      error: null,
    });

    const { validateAndScoreAbSession } = await import('@/lib/eval/ab-mapping');
    await expect(
      validateAndScoreAbSession({
        sessionId: 'sess_t6',
        identifications: new Array(10).fill(true),
        testerRole: 'pm',
        targetUrl: 'http://localhost:3000',
      }),
    ).rejects.toThrow(/expired/);

    expect(createRunMock).not.toHaveBeenCalled();
    expect(writeCaseMock).not.toHaveBeenCalled();
  });

  // ---- Test 7: rejects already-submitted sessions
  it('rejects already-submitted sessions', async () => {
    singleMock.mockResolvedValueOnce({
      data: {
        shuffled_snippets: buildMapping(),
        expires_at: futureExpiresAt(),
        submitted_at: new Date().toISOString(),
      },
      error: null,
    });

    const { validateAndScoreAbSession } = await import('@/lib/eval/ab-mapping');
    await expect(
      validateAndScoreAbSession({
        sessionId: 'sess_t7',
        identifications: new Array(10).fill(true),
        testerRole: 'pm',
        targetUrl: 'http://localhost:3000',
      }),
    ).rejects.toThrow(/already submitted/);

    expect(createRunMock).not.toHaveBeenCalled();
  });

  // ---- Edge: rejects non-10 identifications array
  it('throws when identifications.length !== 10', async () => {
    const { validateAndScoreAbSession } = await import('@/lib/eval/ab-mapping');
    await expect(
      validateAndScoreAbSession({
        sessionId: 'sess_e1',
        identifications: [true, false],
        testerRole: 'pm',
        targetUrl: 'http://localhost:3000',
      }),
    ).rejects.toThrow(/length 10/);
  });

  // ---- Edge: rejects unknown sessionId (supabase returns error or null data)
  it('throws when session not found', async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: { message: 'no rows' } });
    const { validateAndScoreAbSession } = await import('@/lib/eval/ab-mapping');
    await expect(
      validateAndScoreAbSession({
        sessionId: 'missing',
        identifications: new Array(10).fill(true),
        testerRole: 'pm',
        targetUrl: 'http://localhost:3000',
      }),
    ).rejects.toThrow(/session not found/);
  });
});
