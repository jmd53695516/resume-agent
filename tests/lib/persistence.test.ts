// tests/lib/persistence.test.ts
// Plan 03-02 Task 1 — persistToolCallTurn (TOOL-08 / D-E-04).
// Schema column is `tool_result` (NOT `tool_response`) — the migration's actual
// column name. These tests pin the column name and the multi-step flattening
// behavior so a future executor cannot silently regress to the wrong key.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const insert = vi.fn();
const supabaseAdmin = {
  from: vi.fn(() => ({ insert })),
};
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin }));

describe('persistToolCallTurn', () => {
  let persistToolCallTurn: typeof import('../../src/lib/persistence').persistToolCallTurn;

  beforeEach(async () => {
    vi.clearAllMocks();
    insert.mockResolvedValue({ error: null });
    persistToolCallTurn = (await import('../../src/lib/persistence')).persistToolCallTurn;
  });

  it('makes zero db calls when steps array is empty', async () => {
    await persistToolCallTurn({ session_id: 'sess_1', steps: [] });
    expect(insert).not.toHaveBeenCalled();
  });

  it('makes zero db calls when steps have no tool calls', async () => {
    await persistToolCallTurn({
      session_id: 'sess_1',
      steps: [{ toolCalls: [], toolResults: [] }],
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it('inserts one row per tool call with correct field names (tool_result, NOT tool_response)', async () => {
    await persistToolCallTurn({
      session_id: 'sess_1',
      steps: [
        {
          toolCalls: [
            { toolCallId: 'tc_1', toolName: 'research_company', input: { name: 'Notion' } },
          ],
          toolResults: [{ toolCallId: 'tc_1', output: { recent: false, results: [] } }],
        },
      ],
    });
    expect(insert).toHaveBeenCalledTimes(1);
    const rows = insert.mock.calls[0][0];
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe('tool');
    expect(rows[0].tool_name).toBe('research_company');
    expect(rows[0].tool_args).toEqual({ name: 'Notion' });
    expect(rows[0].tool_result).toEqual({ recent: false, results: [] });
    // Schema column-name guard (D-E-04 correction):
    expect(rows[0]).not.toHaveProperty('tool_response');
    expect(rows[0]).toHaveProperty('tool_result');
    // Trace correlation:
    expect(rows[0].sdk_message_id).toBe('tc_1');
    expect(rows[0].session_id).toBe('sess_1');
    // Tokens/cost zeroed (rolled up on assistant row):
    expect(rows[0].input_tokens).toBe(0);
    expect(rows[0].output_tokens).toBe(0);
    expect(rows[0].cost_cents).toBe(0);
    expect(rows[0].cache_read_tokens).toBe(0);
    expect(rows[0].cache_creation_tokens).toBe(0);
  });

  it('flattens multi-step tool calls into a single insert', async () => {
    await persistToolCallTurn({
      session_id: 'sess_1',
      steps: [
        {
          toolCalls: [{ toolCallId: 'a', toolName: 'research_company', input: {} }],
          toolResults: [{ toolCallId: 'a', output: { ok: true } }],
        },
        {
          toolCalls: [{ toolCallId: 'b', toolName: 'get_case_study', input: { slug: 'foo' } }],
          toolResults: [{ toolCallId: 'b', output: { kind: 'menu' } }],
        },
      ],
    });
    expect(insert).toHaveBeenCalledTimes(1);
    const rows = insert.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows.map((r: { tool_name: string }) => r.tool_name)).toEqual([
      'research_company',
      'get_case_study',
    ]);
  });

  it('writes tool_result: null when no matched result', async () => {
    await persistToolCallTurn({
      session_id: 'sess_1',
      steps: [
        {
          toolCalls: [{ toolCallId: 'tc_1', toolName: 'research_company', input: {} }],
          toolResults: [],
        },
      ],
    });
    expect(insert).toHaveBeenCalledTimes(1);
    const rows = insert.mock.calls[0][0];
    expect(rows[0].tool_result).toBeNull();
  });

  it('does not throw on supabase insert error (D-G-05 — persistence failure must not block UX)', async () => {
    insert.mockResolvedValueOnce({ error: { message: 'db down' } });
    await expect(
      persistToolCallTurn({
        session_id: 'sess_1',
        steps: [
          {
            toolCalls: [{ toolCallId: 'a', toolName: 'research_company', input: {} }],
            toolResults: [],
          },
        ],
      }),
    ).resolves.toBeUndefined();
  });

  it('generates unique app-generated nanoids per row', async () => {
    await persistToolCallTurn({
      session_id: 'sess_1',
      steps: [
        {
          toolCalls: [
            { toolCallId: 'a', toolName: 'research_company', input: {} },
            { toolCallId: 'b', toolName: 'get_case_study', input: {} },
          ],
          toolResults: [
            { toolCallId: 'a', output: {} },
            { toolCallId: 'b', output: {} },
          ],
        },
      ],
    });
    const rows = insert.mock.calls[0][0];
    expect(rows[0].id).not.toBe(rows[1].id);
    // nanoid(21) length:
    expect(rows[0].id.length).toBeGreaterThanOrEqual(15);
    expect(rows[1].id.length).toBeGreaterThanOrEqual(15);
  });

  it('matches results to calls by toolCallId (out-of-order results still pair correctly)', async () => {
    await persistToolCallTurn({
      session_id: 'sess_1',
      steps: [
        {
          toolCalls: [
            { toolCallId: 'a', toolName: 'research_company', input: { x: 1 } },
            { toolCallId: 'b', toolName: 'get_case_study', input: { x: 2 } },
          ],
          toolResults: [
            // Reversed order on purpose:
            { toolCallId: 'b', output: { kind: 'menu' } },
            { toolCallId: 'a', output: { recent: true } },
          ],
        },
      ],
    });
    const rows = insert.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows[0].tool_name).toBe('research_company');
    expect(rows[0].tool_result).toEqual({ recent: true });
    expect(rows[1].tool_name).toBe('get_case_study');
    expect(rows[1].tool_result).toEqual({ kind: 'menu' });
  });
});
