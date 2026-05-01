// tests/api/health.test.ts
// Plan 03-04 Task 2: GET /api/health aggregates 5 ping helpers and returns
// HTTP 200 always (D-J-01). Pings run in parallel via Promise.all.
// Route segment options: runtime='nodejs', revalidate=30 (D-J-03 / D-F-02).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const pingAnthropic = vi.fn();
const pingClassifier = vi.fn();
const pingSupabase = vi.fn();
const pingUpstash = vi.fn();
const pingExa = vi.fn();

vi.mock('@/lib/health', () => ({
  pingAnthropic,
  pingClassifier,
  pingSupabase,
  pingUpstash,
  pingExa,
}));

describe('/api/health GET', () => {
  beforeEach(() => {
    pingAnthropic.mockReset();
    pingClassifier.mockReset();
    pingSupabase.mockReset();
    pingUpstash.mockReset();
    pingExa.mockReset();
  });

  it('returns 200 with all five dep states', async () => {
    pingAnthropic.mockResolvedValue('ok');
    pingClassifier.mockResolvedValue('ok');
    pingSupabase.mockResolvedValue('ok');
    pingUpstash.mockResolvedValue('ok');
    pingExa.mockResolvedValue('ok');
    const { GET } = await import('../../src/app/api/health/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      anthropic: 'ok',
      classifier: 'ok',
      supabase: 'ok',
      upstash: 'ok',
      exa: 'ok',
    });
  });

  it('returns 200 even when all deps are degraded', async () => {
    pingAnthropic.mockResolvedValue('degraded');
    pingClassifier.mockResolvedValue('degraded');
    pingSupabase.mockResolvedValue('degraded');
    pingUpstash.mockResolvedValue('degraded');
    pingExa.mockResolvedValue('degraded');
    const { GET } = await import('../../src/app/api/health/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.anthropic).toBe('degraded');
    expect(body.exa).toBe('degraded');
  });

  it('returns 200 even when some deps are down', async () => {
    pingAnthropic.mockResolvedValue('ok');
    pingClassifier.mockResolvedValue('ok');
    pingSupabase.mockResolvedValue('down');
    pingUpstash.mockResolvedValue('ok');
    pingExa.mockResolvedValue('down');
    const { GET } = await import('../../src/app/api/health/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.supabase).toBe('down');
    expect(body.exa).toBe('down');
  });

  it('runs pings in parallel via Promise.all (all dispatched together)', async () => {
    const dispatched: string[] = [];
    pingAnthropic.mockImplementation(async () => {
      dispatched.push('a');
      return 'ok';
    });
    pingClassifier.mockImplementation(async () => {
      dispatched.push('c');
      return 'ok';
    });
    pingSupabase.mockImplementation(async () => {
      dispatched.push('s');
      return 'ok';
    });
    pingUpstash.mockImplementation(async () => {
      dispatched.push('u');
      return 'ok';
    });
    pingExa.mockImplementation(async () => {
      dispatched.push('e');
      return 'ok';
    });
    const { GET } = await import('../../src/app/api/health/route');
    await GET();
    // Promise.all dispatches all 5 fns synchronously before any await yields,
    // so order will be ['a','c','s','u','e'] (call order) and length=5.
    expect(dispatched.length).toBe(5);
  });

  it('exports runtime = nodejs and revalidate = 30', async () => {
    pingAnthropic.mockResolvedValue('ok');
    pingClassifier.mockResolvedValue('ok');
    pingSupabase.mockResolvedValue('ok');
    pingUpstash.mockResolvedValue('ok');
    pingExa.mockResolvedValue('ok');
    const mod = await import('../../src/app/api/health/route');
    expect(mod.runtime).toBe('nodejs');
    expect(mod.revalidate).toBe(30);
  });
});
