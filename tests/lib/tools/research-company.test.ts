// tests/lib/tools/research-company.test.ts
// Plan 03-01 Task 2: research_company AI SDK v6 tool() instance.
// TOOL-01/02/09/11. Mocks @/lib/exa + @/lib/logger; no real network.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const researchCompany = vi.fn();
const log = vi.fn();
vi.mock('@/lib/exa', () => ({ researchCompany }));
vi.mock('@/lib/logger', () => ({ log }));

describe('research_company tool', () => {
  let toolModule: typeof import('../../../src/lib/tools/research-company');

  beforeEach(async () => {
    vi.clearAllMocks();
    toolModule = await import('../../../src/lib/tools/research-company');
  });

  // -- inputSchema --
  it('inputSchema accepts valid name', () => {
    const r = toolModule.research_company.inputSchema.safeParse({ name: 'Notion' });
    expect(r.success).toBe(true);
  });
  it('inputSchema rejects empty name', () => {
    const r = toolModule.research_company.inputSchema.safeParse({ name: '' });
    expect(r.success).toBe(false);
  });
  it('inputSchema rejects 101-char name', () => {
    const r = toolModule.research_company.inputSchema.safeParse({ name: 'X'.repeat(101) });
    expect(r.success).toBe(false);
  });
  it('inputSchema accepts valid name + website', () => {
    const r = toolModule.research_company.inputSchema.safeParse({
      name: 'Notion',
      website: 'https://notion.so',
    });
    expect(r.success).toBe(true);
  });
  it('inputSchema rejects invalid URL website', () => {
    const r = toolModule.research_company.inputSchema.safeParse({
      name: 'Notion',
      website: 'not-a-url',
    });
    expect(r.success).toBe(false);
  });

  // -- execute happy path --
  it('execute wraps fetched content in <fetched-content> tags', async () => {
    researchCompany.mockResolvedValue({
      recent: true,
      results: [
        { url: 'https://x', title: 'X', published_date: '2026-04-01', text: 'hello' },
      ],
      cost_dollars: 0.01,
    });
    const r = await toolModule.research_company.execute!({ name: 'Notion' }, {} as any);
    expect((r as any).results[0].text).toBe('<fetched-content>\nhello\n</fetched-content>');
    expect((r as any).recent).toBe(true);
  });

  it('execute returns recent:false when Exa has zero results', async () => {
    researchCompany.mockResolvedValue({ recent: false, results: [] });
    const r = await toolModule.research_company.execute!({ name: 'Notion' }, {} as any);
    expect(r).toEqual({ recent: false, results: [] });
  });

  // -- execute error path --
  it('execute returns failure copy on Exa error', async () => {
    researchCompany.mockRejectedValue(new Error('exa down'));
    const r = await toolModule.research_company.execute!({ name: 'Notion' }, {} as any);
    expect((r as any).error).toBeDefined();
    expect((r as any).error).toContain('Research tool');
  });

  it('execute logs error event with error_class on Exa error', async () => {
    researchCompany.mockRejectedValue(new Error('exa down'));
    await toolModule.research_company.execute!({ name: 'Notion' }, {} as any);
    const errCalls = log.mock.calls.filter((c) => c[1] === 'error');
    expect(errCalls.length).toBeGreaterThanOrEqual(1);
    expect(errCalls[0][0]).toMatchObject({
      event: 'tool_call',
      tool_name: 'research_company',
      status: 'error',
    });
    expect((errCalls[0][0] as any).error_class).toBe('Error');
  });

  // -- logging shape (PII protection) --
  it('logs args_hash, never raw name or website', async () => {
    researchCompany.mockResolvedValue({ recent: false, results: [] });
    await toolModule.research_company.execute!(
      { name: 'Notion', website: 'https://notion.so' },
      {} as any,
    );
    expect(log).toHaveBeenCalled();
    const call = log.mock.calls[0][0] as any;
    expect(call.event).toBe('tool_call');
    expect(call.tool_name).toBe('research_company');
    expect(call.args_hash).toMatch(/^[0-9a-f]{16}$/);
    expect(typeof call.latency_ms).toBe('number');
    expect(call.status).toBe('ok');
    // Raw args MUST NOT appear in the log payload (D-I-04).
    expect(JSON.stringify(call)).not.toContain('Notion');
    expect(JSON.stringify(call)).not.toContain('notion.so');
  });
});
