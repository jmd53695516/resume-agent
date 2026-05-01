// tests/lib/tools/depth-cap.test.ts
// Plan 03-01 Task 1: TOOL-07 (≤3 tool calls per turn) + SAFE-15 (duplicate-arg stop).
// Returns activeTools:[] (cache-friendly) NOT toolChoice:'none' (cache-invalidating).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const log = vi.fn();
vi.mock('@/lib/logger', () => ({ log }));

describe('enforceToolCallDepthCap', () => {
  let enforce: typeof import('../../../src/lib/tools/depth-cap').enforceToolCallDepthCap;

  beforeEach(async () => {
    log.mockReset();
    const mod = await import('../../../src/lib/tools/depth-cap');
    enforce = mod.enforceToolCallDepthCap;
  });

  it('returns {} when no tool calls have happened', async () => {
    const r = await enforce({ steps: [], stepNumber: 0, messages: [], model: {} } as any);
    expect(r).toEqual({});
  });

  it('returns {} after one tool call', async () => {
    const r = await enforce({
      steps: [{ toolCalls: [{ toolCallId: '1', toolName: 'research_company', input: { name: 'A' } }] }],
      stepNumber: 1,
      messages: [],
      model: {},
    } as any);
    expect(r).toEqual({});
  });

  it('returns {} after two distinct tool calls', async () => {
    const r = await enforce({
      steps: [
        { toolCalls: [{ toolCallId: '1', toolName: 'research_company', input: { name: 'A' } }] },
        { toolCalls: [{ toolCallId: '2', toolName: 'get_case_study', input: { slug: 's1' } }] },
      ],
      stepNumber: 2,
      messages: [],
      model: {},
    } as any);
    expect(r).toEqual({});
  });

  it('returns activeTools:[] at 3 tool calls (TOOL-07 cap)', async () => {
    const r = await enforce({
      steps: [
        { toolCalls: [{ toolCallId: '1', toolName: 'research_company', input: { name: 'A' } }] },
        { toolCalls: [{ toolCallId: '2', toolName: 'get_case_study', input: { slug: 's1' } }] },
        { toolCalls: [{ toolCallId: '3', toolName: 'design_metric_framework', input: { description: 'churn metric for paid plans please' } }] },
      ],
      stepNumber: 3,
      messages: [],
      model: {},
    } as any);
    expect(r).toEqual({ activeTools: [] });
    // Should log a warning event
    expect(log).toHaveBeenCalled();
    const call = log.mock.calls[0];
    expect(call[0]).toMatchObject({ event: 'tool_depth_cap', total_tool_calls: 3 });
    expect(call[1]).toBe('warn');
  });

  it('returns activeTools:[] above 3 tool calls', async () => {
    const r = await enforce({
      steps: [
        { toolCalls: [{ toolCallId: '1', toolName: 'a', input: {} }, { toolCallId: '2', toolName: 'b', input: {} }] },
        { toolCalls: [{ toolCallId: '3', toolName: 'c', input: {} }, { toolCallId: '4', toolName: 'd', input: {} }] },
      ],
      stepNumber: 4,
      messages: [],
      model: {},
    } as any);
    expect(r).toEqual({ activeTools: [] });
  });

  it('returns activeTools:[] when last 2 calls have same toolName + same input (SAFE-15)', async () => {
    const r = await enforce({
      steps: [
        { toolCalls: [{ toolCallId: '1', toolName: 'research_company', input: { name: 'Notion' } }] },
        { toolCalls: [{ toolCallId: '2', toolName: 'research_company', input: { name: 'Notion' } }] },
      ],
      stepNumber: 2,
      messages: [],
      model: {},
    } as any);
    expect(r).toEqual({ activeTools: [] });
    // Should log a SAFE-15 warning
    expect(log).toHaveBeenCalled();
    const call = log.mock.calls[0];
    expect(call[0]).toMatchObject({ event: 'safe_15_trip', tool_name: 'research_company' });
    expect(call[1]).toBe('warn');
  });

  it('does NOT trip SAFE-15 when same toolName but different input', async () => {
    const r = await enforce({
      steps: [
        { toolCalls: [{ toolCallId: '1', toolName: 'research_company', input: { name: 'Notion' } }] },
        { toolCalls: [{ toolCallId: '2', toolName: 'research_company', input: { name: 'Anthropic' } }] },
      ],
      stepNumber: 2,
      messages: [],
      model: {},
    } as any);
    expect(r).toEqual({});
  });

  it('does NOT trip SAFE-15 when same input but different toolName', async () => {
    const r = await enforce({
      steps: [
        { toolCalls: [{ toolCallId: '1', toolName: 'a', input: { x: 1 } }] },
        { toolCalls: [{ toolCallId: '2', toolName: 'b', input: { x: 1 } }] },
      ],
      stepNumber: 2,
      messages: [],
      model: {},
    } as any);
    expect(r).toEqual({});
  });

  it('handles steps without toolCalls (treats as empty)', async () => {
    const r = await enforce({
      steps: [
        { toolCalls: undefined },
        { toolCalls: [] },
      ],
      stepNumber: 2,
      messages: [],
      model: {},
    } as any);
    expect(r).toEqual({});
  });
});
