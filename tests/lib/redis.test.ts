// tests/lib/redis.test.ts — in-memory mock for Upstash HTTP client.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@upstash/redis', () => {
  class FakeRedis {
    store = new Map<string, number>();
    async incrby(k: string, n: number) {
      const v = (this.store.get(k) ?? 0) + n;
      this.store.set(k, v);
      return v;
    }
    async expire(_k: string, _s: number) {
      return 1;
    }
    async get<T>(k: string) {
      return (this.store.get(k) ?? null) as T;
    }
    async mget<T>(...ks: string[]) {
      return ks.map((k) => this.store.get(k) ?? null) as T;
    }
    async set(k: string, v: unknown) {
      this.store.set(k, Number(v));
      return 'OK';
    }
  }
  return { Redis: FakeRedis };
});

// SEED-001 (260512-r4s): per-instance Ratelimit mock so we can spy on which
// limiter's .limit() was called for a given checkRateLimits invocation. Prior
// behavior used a single Ratelimit class with one shared `limit` method —
// indistinguishable for the four limiter instances. Each constructor call now
// produces a unique mock instance with its own `vi.fn()` spy on `.limit`.
vi.mock('@upstash/ratelimit', () => {
  // Tag each Ratelimit instance with its constructor prefix so a test can
  // grab the right instance (ipLimiter10m vs emailLimiterDay etc.) by
  // discriminating on the `prefix` arg the constructor was called with.
  return {
    Ratelimit: class {
      prefix: string;
      limit: ReturnType<typeof vi.fn>;
      constructor(args: { prefix?: string }) {
        this.prefix = args?.prefix ?? '';
        this.limit = vi.fn(async (_id: string) => ({
          success: true,
          limit: 60,
          remaining: 59,
          reset: Date.now() + 600000,
          pending: Promise.resolve(),
        }));
      }
      static slidingWindow() {
        return null;
      }
    },
  };
});

// env stub — only the two upstash vars are read by redis.ts at module load.
vi.mock('@/lib/env', () => ({
  env: {
    UPSTASH_REDIS_REST_URL: 'https://fake.upstash.io',
    UPSTASH_REDIS_REST_TOKEN: 'fake-token',
  },
}));

import {
  incrementSpend,
  getSpendToday,
  isOverCap,
  incrementIpCost,
  getIpCostToday,
  checkRateLimits,
  ipLimiter10m,
  ipLimiterDay,
  emailLimiterDay,
  sessionLimiter,
  EVAL_CLI_RATELIMIT_ALLOWLIST,
  isEmailRatelimitAllowlisted,
} from '@/lib/redis';

describe('spend counter', () => {
  it('sums across hourly buckets', async () => {
    await incrementSpend(100);
    await incrementSpend(50);
    expect(await getSpendToday()).toBe(150);
    expect(await isOverCap()).toBe(false);
  });
  it('trips cap at 300', async () => {
    await incrementSpend(300);
    expect(await isOverCap()).toBe(true);
  });
});

describe('per-IP cost', () => {
  beforeEach(() => {
    /* each test gets fresh mock via vi.resetModules if needed */
  });
  it('accumulates per IP', async () => {
    await incrementIpCost('1.2.3.4', 40);
    await incrementIpCost('1.2.3.4', 20);
    expect(await getIpCostToday('1.2.3.4')).toBe(60);
  });
});

describe('checkRateLimits happy path', () => {
  it('returns ok when all limiters green and ipcost under 150', async () => {
    // All four Ratelimit mocks return {success: true} by default per the
    // mock above; getIpCostToday returns 0 from the empty FakeRedis (for a fresh IP).
    const res = await checkRateLimits('fresh-ip-key', 'a@b.com', 'session-id');
    expect(res).toEqual({ ok: true });
  });
});

// --- SEED-001 (quick task 260512-r4s) ---------------------------------------
// Exempt eval-cli email from the per-email 150/day window while keeping
// per-IP + per-session + ipcost backstops intact.

describe('SEED-001 EVAL_CLI_RATELIMIT_ALLOWLIST constant', () => {
  it('is a Set containing exactly the canonical eval-cli email', () => {
    expect(EVAL_CLI_RATELIMIT_ALLOWLIST).toBeInstanceOf(Set);
    expect(EVAL_CLI_RATELIMIT_ALLOWLIST.size).toBe(1);
    expect(EVAL_CLI_RATELIMIT_ALLOWLIST.has('eval-cli@joedollinger.dev')).toBe(true);
  });
});

describe('SEED-001 isEmailRatelimitAllowlisted', () => {
  it('returns true for the canonical eval-cli email', () => {
    expect(isEmailRatelimitAllowlisted('eval-cli@joedollinger.dev')).toBe(true);
  });
  it('returns false for pattern-adjacent eval-cli-test email', () => {
    expect(isEmailRatelimitAllowlisted('eval-cli-test@joedollinger.dev')).toBe(false);
  });
  it('returns false for empty string', () => {
    expect(isEmailRatelimitAllowlisted('')).toBe(false);
  });
  it('returns false for an unrelated recruiter email', () => {
    expect(isEmailRatelimitAllowlisted('recruiter@google.com')).toBe(false);
  });
  it('returns false for case-variant (case-sensitive contract)', () => {
    expect(isEmailRatelimitAllowlisted('EVAL-CLI@joedollinger.dev')).toBe(false);
  });
  it('returns false for subdomain-trick email', () => {
    expect(isEmailRatelimitAllowlisted('eval-cli@joedollinger.dev.attacker.com')).toBe(false);
  });
});

describe('SEED-001 checkRateLimits — allowlisted email', () => {
  beforeEach(() => {
    // Reset the per-instance .limit spies before each assertion-bearing test
    // so call counts come back to zero.
    (ipLimiter10m.limit as ReturnType<typeof vi.fn>).mockClear();
    (ipLimiterDay.limit as ReturnType<typeof vi.fn>).mockClear();
    (emailLimiterDay.limit as ReturnType<typeof vi.fn>).mockClear();
    (sessionLimiter.limit as ReturnType<typeof vi.fn>).mockClear();
  });

  it('SKIPS emailLimiterDay.limit() for canonical eval-cli email', async () => {
    const res = await checkRateLimits('1.2.3.4', 'eval-cli@joedollinger.dev', 'sess-123');
    expect((emailLimiterDay.limit as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    // Per-IP + session still fire — the protections SEED-001 explicitly preserves.
    expect((ipLimiter10m.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect((ipLimiter10m.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('1.2.3.4');
    expect((ipLimiterDay.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect((ipLimiterDay.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('1.2.3.4');
    expect((sessionLimiter.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect((sessionLimiter.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('sess-123');
    expect(res).toEqual({ ok: true });
  });

  it('DOES call emailLimiterDay.limit() for a real recruiter email', async () => {
    const res = await checkRateLimits('1.2.3.4', 'recruiter@google.com', 'sess-456');
    expect((emailLimiterDay.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect((emailLimiterDay.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      'recruiter@google.com',
    );
    expect(res).toEqual({ ok: true });
  });

  it.each([
    'eval-cli-test@joedollinger.dev',
    'eval-cli2@joedollinger.dev',
    'eval-cli@joedollinger.dev.attacker.com',
    'EVAL-CLI@joedollinger.dev',
  ])('pattern-adjacent email %s DOES hit emailLimiterDay (exact-match contract)', async (evilEmail) => {
    (emailLimiterDay.limit as ReturnType<typeof vi.fn>).mockClear();
    await checkRateLimits('1.2.3.4', evilEmail, 'sess-evil');
    expect((emailLimiterDay.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect((emailLimiterDay.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(evilEmail);
  });
});
