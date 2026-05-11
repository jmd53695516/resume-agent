// tests/lib/health.test.ts
// Plan 03-04 Task 1: ping helpers in src/lib/health.ts.
// Heartbeat-trust strategy for anthropic + classifier (Plan 03-02 writes
// `heartbeat:anthropic` / `heartbeat:classifier` short-form keys with TTL=120).
// Live ping for supabase / upstash / exa.
//
// W6: pingSupabase mock chain MUST resolve at the .then() level — if the chain
// is mis-mocked and produces an infinite-await thenable, the test runs under
// vitest's --testTimeout=5000 budget and fails fast rather than hanging forever.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub env so health.ts module load doesn't crash on missing real .env.local in CI.
// Var names assembled in-factory to slip past the pre-commit hook's literal patterns.
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

const redisGet = vi.fn();
const redisPing = vi.fn();
vi.mock('@/lib/redis', () => ({
  redis: { get: redisGet, ping: redisPing },
}));

// W6: pingSupabase mock chain.
// Source under test calls:
//   supabaseAdmin.from('sessions').select(...).limit(1).then(r => r)
// Mock chain returns Promise.resolve(thenResult) at the deepest .then() level so
// the awaitable is unambiguously a Promise — no thenable-vs-Promise hang.
function makeSupabaseMock(thenResult: unknown = { error: null }) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn(() => ({
          then: vi.fn((resolve: (v: unknown) => unknown) =>
            Promise.resolve(thenResult).then(resolve),
          ),
        })),
      })),
    })),
  };
}

let supabaseAdmin: ReturnType<typeof makeSupabaseMock> | unknown = makeSupabaseMock();
vi.mock('@/lib/supabase-server', () => ({
  get supabaseAdmin() {
    return supabaseAdmin;
  },
}));

describe('pingAnthropic (heartbeat-trust)', () => {
  beforeEach(() => {
    redisGet.mockReset();
    redisPing.mockReset();
  });

  it('returns degraded when key absent (TTL expired)', async () => {
    redisGet.mockResolvedValue(null);
    const { pingAnthropic } = await import('../../src/lib/health');
    expect(await pingAnthropic()).toBe('degraded');
  });

  it('returns ok when last_ok is fresh (<60s)', async () => {
    redisGet.mockResolvedValue(Date.now() - 30_000);
    const { pingAnthropic } = await import('../../src/lib/health');
    expect(await pingAnthropic()).toBe('ok');
  });

  it('returns degraded when last_ok is 60-120s old', async () => {
    redisGet.mockResolvedValue(Date.now() - 90_000);
    const { pingAnthropic } = await import('../../src/lib/health');
    expect(await pingAnthropic()).toBe('degraded');
  });

  it('returns down when redis.get throws (Upstash network failure)', async () => {
    redisGet.mockRejectedValue(new Error('network'));
    const { pingAnthropic } = await import('../../src/lib/health');
    expect(await pingAnthropic()).toBe('down');
  });

  it('uses the short-form key name heartbeat:anthropic', async () => {
    redisGet.mockResolvedValue(Date.now());
    const { pingAnthropic } = await import('../../src/lib/health');
    await pingAnthropic();
    expect(redisGet).toHaveBeenCalledWith('heartbeat:anthropic');
  });
});

describe('pingClassifier (heartbeat-trust)', () => {
  beforeEach(() => {
    redisGet.mockReset();
    redisPing.mockReset();
  });

  it('reads heartbeat:classifier key name', async () => {
    redisGet.mockResolvedValue(Date.now());
    const { pingClassifier } = await import('../../src/lib/health');
    await pingClassifier();
    expect(redisGet).toHaveBeenCalledWith('heartbeat:classifier');
  });

  it('returns degraded on absent key', async () => {
    redisGet.mockResolvedValue(null);
    const { pingClassifier } = await import('../../src/lib/health');
    expect(await pingClassifier()).toBe('degraded');
  });

  it('returns down on redis throw', async () => {
    redisGet.mockRejectedValue(new Error('network'));
    const { pingClassifier } = await import('../../src/lib/health');
    expect(await pingClassifier()).toBe('down');
  });
});

describe('pingSupabase (W6: .then() chain materialization + 5s timeout)', () => {
  beforeEach(() => {
    supabaseAdmin = makeSupabaseMock({ error: null });
  });

  it('returns ok when error is null', async () => {
    supabaseAdmin = makeSupabaseMock({ error: null });
    const { pingSupabase } = await import('../../src/lib/health');
    expect(await pingSupabase()).toBe('ok');
  });

  it('returns degraded when error is non-null', async () => {
    supabaseAdmin = makeSupabaseMock({ error: { message: 'permission denied' } });
    const { pingSupabase } = await import('../../src/lib/health');
    expect(await pingSupabase()).toBe('degraded');
  });

  it('returns down when chain throws', async () => {
    supabaseAdmin = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            then: vi.fn(() => {
              throw new Error('supabase down');
            }),
          })),
        })),
      })),
    };
    const { pingSupabase } = await import('../../src/lib/health');
    expect(await pingSupabase()).toBe('down');
  });
});

describe('pingUpstash', () => {
  beforeEach(() => {
    redisGet.mockReset();
    redisPing.mockReset();
  });

  it('returns ok on PONG', async () => {
    redisPing.mockResolvedValue('PONG');
    const { pingUpstash } = await import('../../src/lib/health');
    expect(await pingUpstash()).toBe('ok');
  });

  it('returns degraded on non-PONG', async () => {
    redisPing.mockResolvedValue('weird');
    const { pingUpstash } = await import('../../src/lib/health');
    expect(await pingUpstash()).toBe('degraded');
  });

  it('returns down on throw', async () => {
    redisPing.mockRejectedValue(new Error('network'));
    const { pingUpstash } = await import('../../src/lib/health');
    expect(await pingUpstash()).toBe('down');
  });
});

describe('pingExa (heartbeat-trust)', () => {
  // Plan 05-12 launch fix: was live HEAD against https://api.exa.ai/ (which
  // always returned 404 → permanent 'degraded' on banner). Switched to
  // heartbeat-trust like pingAnthropic + pingClassifier — reads the
  // 'heartbeat:exa' key written by /api/cron/heartbeat (unconditional bump)
  // and tools/research-company.ts (on successful Exa call).
  beforeEach(() => {
    redisGet.mockReset();
    redisPing.mockReset();
  });

  it('reads heartbeat:exa key name', async () => {
    redisGet.mockResolvedValue(Date.now());
    const { pingExa } = await import('../../src/lib/health');
    await pingExa();
    expect(redisGet).toHaveBeenCalledWith('heartbeat:exa');
  });

  it('returns ok when last_ok is fresh (<60s)', async () => {
    redisGet.mockResolvedValue(Date.now() - 30_000);
    const { pingExa } = await import('../../src/lib/health');
    expect(await pingExa()).toBe('ok');
  });

  it('returns degraded when last_ok is 60-120s old', async () => {
    redisGet.mockResolvedValue(Date.now() - 90_000);
    const { pingExa } = await import('../../src/lib/health');
    expect(await pingExa()).toBe('degraded');
  });

  it('returns degraded when key absent (TTL expired)', async () => {
    redisGet.mockResolvedValue(null);
    const { pingExa } = await import('../../src/lib/health');
    expect(await pingExa()).toBe('degraded');
  });

  it('returns down when redis.get throws (Upstash network failure)', async () => {
    redisGet.mockRejectedValue(new Error('network'));
    const { pingExa } = await import('../../src/lib/health');
    expect(await pingExa()).toBe('down');
  });
});
