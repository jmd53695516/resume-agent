// tests/lib/tools/design-metric-framework.test.ts
// Plan 03-01 Task 4: design_metric_framework AI SDK v6 tool() instance.
// TOOL-05/11. Mocks @/lib/anthropic + @/lib/logger; no real Haiku call.
// Asserts forced-tool-output (tool_choice + strict:true) and zod post-validation.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { z } from 'zod';

const create = vi.fn();
const anthropicClient = vi.fn(() => ({ messages: { create } }));
const log = vi.fn();
vi.mock('@/lib/anthropic', () => ({
  anthropicClient,
  MODELS: { MAIN: 'claude-sonnet-4-6', CLASSIFIER: 'claude-haiku-4-5' },
}));
vi.mock('@/lib/logger', () => ({ log }));

function asZod(s: unknown): z.ZodTypeAny {
  return s as z.ZodTypeAny;
}

const VALID_INPUT = {
  north_star: 'weekly active paid users',
  input_metrics: ['signup completion rate'],
  counter_metrics: ['churn rate'],
  guardrails: ['support load'],
  proposed_experiment: 'A/B test on onboarding flow with 50/50 split for 14 days',
  open_questions: ['what is the payment friction baseline?'],
};

describe('design_metric_framework tool', () => {
  let toolModule: typeof import('../../../src/lib/tools/design-metric-framework');

  beforeEach(async () => {
    vi.clearAllMocks();
    toolModule = await import('../../../src/lib/tools/design-metric-framework');
  });

  // -- inputSchema --
  it('inputSchema rejects short description (<10 chars)', () => {
    const r = asZod(toolModule.design_metric_framework.inputSchema).safeParse({
      description: 'short',
    });
    expect(r.success).toBe(false);
  });
  it('inputSchema accepts a valid description', () => {
    const r = asZod(toolModule.design_metric_framework.inputSchema).safeParse({
      description: 'reduce churn on paid plans',
    });
    expect(r.success).toBe(true);
  });
  it('inputSchema rejects 1001-char description', () => {
    const r = asZod(toolModule.design_metric_framework.inputSchema).safeParse({
      description: 'X'.repeat(1001),
    });
    expect(r.success).toBe(false);
  });

  // -- forced tool-output wiring --
  it('uses tool_choice forced-output with strict:true', async () => {
    create.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'tu_1',
          name: 'output_metric_framework',
          input: VALID_INPUT,
        },
      ],
    });
    await toolModule.design_metric_framework.execute!(
      { description: 'reduce churn on paid plans' },
      {} as any,
    );
    expect(create).toHaveBeenCalled();
    const call = create.mock.calls[0][0];
    expect(call.model).toBe('claude-haiku-4-5');
    expect(call.tool_choice).toEqual({ type: 'tool', name: 'output_metric_framework' });
    expect(call.tools[0].name).toBe('output_metric_framework');
    expect(call.tools[0].strict).toBe(true);
  });

  // -- happy path --
  it('returns parsed object on success', async () => {
    create.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'tu_1',
          name: 'output_metric_framework',
          input: VALID_INPUT,
        },
      ],
    });
    const r = await toolModule.design_metric_framework.execute!(
      { description: 'reduce churn on paid plans' },
      {} as any,
    );
    expect((r as any).north_star).toBe('weekly active paid users');
    expect((r as any).input_metrics).toEqual(['signup completion rate']);
  });

  // -- error paths --
  it('returns failure copy when no tool_use block in response', async () => {
    create.mockResolvedValue({
      content: [{ type: 'text', text: 'no tools used' }],
    });
    const r = await toolModule.design_metric_framework.execute!(
      { description: 'reduce churn on paid plans' },
      {} as any,
    );
    expect((r as any).error).toBeDefined();
    expect((r as any).error).toContain('Metric tool');
  });

  it('returns failure copy when Haiku output fails zod schema', async () => {
    create.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'tu_1',
          name: 'output_metric_framework',
          input: { north_star: 'x' /* missing required fields */ },
        },
      ],
    });
    const r = await toolModule.design_metric_framework.execute!(
      { description: 'reduce churn on paid plans' },
      {} as any,
    );
    expect((r as any).error).toBeDefined();
    expect((r as any).error).toContain('Metric tool');
  });

  it('returns failure copy when Haiku rejects request', async () => {
    create.mockRejectedValue(new Error('haiku 503'));
    const r = await toolModule.design_metric_framework.execute!(
      { description: 'reduce churn on paid plans' },
      {} as any,
    );
    expect((r as any).error).toBeDefined();
    expect((r as any).error).toContain('Metric tool');
  });

  // -- logging (PII protection) --
  it('logs args_hash, never raw description', async () => {
    create.mockRejectedValue(new Error('haiku down'));
    await toolModule.design_metric_framework.execute!(
      { description: 'super secret roadmap details about new product launch' },
      {} as any,
    );
    expect(log).toHaveBeenCalled();
    const call = log.mock.calls[0][0] as any;
    expect(call.event).toBe('tool_call');
    expect(call.tool_name).toBe('design_metric_framework');
    expect(call.args_hash).toMatch(/^[0-9a-f]{16}$/);
    expect(JSON.stringify(call)).not.toContain('super secret');
    expect(JSON.stringify(call)).not.toContain('roadmap');
  });

  it('logs status=ok with latency_ms on success', async () => {
    create.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'tu_1',
          name: 'output_metric_framework',
          input: VALID_INPUT,
        },
      ],
    });
    await toolModule.design_metric_framework.execute!(
      { description: 'reduce churn on paid plans' },
      {} as any,
    );
    const okCall = log.mock.calls.find((c) => (c[0] as any).status === 'ok');
    expect(okCall).toBeDefined();
    expect((okCall![0] as any).latency_ms).toBeGreaterThanOrEqual(0);
  });
});
