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
  EVAL_CLI_ALLOWLIST,
  isEmailRatelimitAllowlisted,
  isEmailSpendCapAllowlisted,
  isEmailIpRatelimitAllowlisted, // SEED-001 ip-rl half (quick task 260512-sne)
  redis,
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

describe('SEED-001 EVAL_CLI_ALLOWLIST constant (unified, D-A-02)', () => {
  it('is a Set containing exactly the canonical eval-cli email', () => {
    expect(EVAL_CLI_ALLOWLIST).toBeInstanceOf(Set);
    expect(EVAL_CLI_ALLOWLIST.size).toBe(1);
    expect(EVAL_CLI_ALLOWLIST.has('eval-cli@joedollinger.dev')).toBe(true);
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
    // SEED-001 ip-rl half (quick task 260512-sne) UPDATE: ip10m + ipday are
    // also bypassed for the allowlisted email (was NOT the case at r4s landing
    // — pre-sne behavior asserted ip10m + ipday were still called). Session
    // limiter STILL fires (D-A-01 scope boundary).
    expect((ipLimiter10m.limit as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    expect((ipLimiterDay.limit as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
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

// --- SEED-001 spend-cap half (quick task 260512-ro4, D-A-01 + D-A-02) ----
// Mirrors the rate-limit half above but covers the SAFE-04 global spend
// counter bypass. Both halves share the same unified EVAL_CLI_ALLOWLIST Set.

describe('SEED-001 isEmailSpendCapAllowlisted', () => {
  it('returns true for the canonical eval-cli email', () => {
    expect(isEmailSpendCapAllowlisted('eval-cli@joedollinger.dev')).toBe(true);
  });
  it('returns false for pattern-adjacent eval-cli-test email', () => {
    expect(isEmailSpendCapAllowlisted('eval-cli-test@joedollinger.dev')).toBe(false);
  });
  it('returns false for empty string', () => {
    expect(isEmailSpendCapAllowlisted('')).toBe(false);
  });
  it('returns false for an unrelated recruiter email', () => {
    expect(isEmailSpendCapAllowlisted('recruiter@google.com')).toBe(false);
  });
  it('returns false for case-variant (case-sensitive contract)', () => {
    expect(isEmailSpendCapAllowlisted('EVAL-CLI@joedollinger.dev')).toBe(false);
  });
  it('returns false for subdomain-trick email', () => {
    expect(isEmailSpendCapAllowlisted('eval-cli@joedollinger.dev.attacker.com')).toBe(false);
  });
});

describe('SEED-001 unified EVAL_CLI_ALLOWLIST drift detection (D-A-02)', () => {
  it('all three helpers consult the same Set for allowlisted emails', () => {
    for (const e of EVAL_CLI_ALLOWLIST) {
      expect(isEmailRatelimitAllowlisted(e)).toBe(true);
      expect(isEmailSpendCapAllowlisted(e)).toBe(true);
      expect(isEmailIpRatelimitAllowlisted(e)).toBe(true);
    }
  });
  it('all three helpers reject pattern-adjacent emails identically', () => {
    const adjacents = [
      'eval-cli-test@joedollinger.dev',
      'eval-cli2@joedollinger.dev',
      'EVAL-CLI@joedollinger.dev',
      'eval-cli@joedollinger.dev.attacker.com',
      'recruiter@google.com',
      '',
    ];
    for (const e of adjacents) {
      expect(isEmailRatelimitAllowlisted(e)).toBe(false);
      expect(isEmailSpendCapAllowlisted(e)).toBe(false);
      expect(isEmailIpRatelimitAllowlisted(e)).toBe(false);
    }
  });
});

describe('SEED-001 incrementSpend — email-gated skip (D-A-01 full invisibility)', () => {
  beforeEach(async () => {
    // The shared describe-level FakeRedis store persists across tests by
    // module-singleton design (redis.ts imports the module once). Clear
    // any accumulated spend so each test starts at zero.
    // Strategy: import redis directly and clear the store. Cleaner than
    // adding a reset helper to redis.ts production code.
    // FakeRedis is the mocked Redis class — accessing .store is mock-only.
    (redis as unknown as { store: Map<string, number> }).store.clear();
  });

  it('SKIPS increment for allowlisted eval-cli email (D-A-01 full invisibility)', async () => {
    await incrementSpend(50, { email: 'eval-cli@joedollinger.dev' });
    expect(await getSpendToday()).toBe(0);
  });

  it('DOES increment for an unrelated recruiter email', async () => {
    await incrementSpend(50, { email: 'recruiter@google.com' });
    expect(await getSpendToday()).toBe(50);
  });

  it('DOES increment when no opts.email is passed (back-compat)', async () => {
    await incrementSpend(50);
    expect(await getSpendToday()).toBe(50);
  });

  it('still no-ops on zero or negative cents even with allowlisted email', async () => {
    await incrementSpend(0, { email: 'eval-cli@joedollinger.dev' });
    await incrementSpend(-10, { email: 'recruiter@google.com' });
    expect(await getSpendToday()).toBe(0);
  });

  it('DOES increment for pattern-adjacent email (exact-match contract preserved)', async () => {
    await incrementSpend(75, { email: 'eval-cli-test@joedollinger.dev' });
    expect(await getSpendToday()).toBe(75);
  });
});

// --- SEED-001 ip-rate-limit half (quick task 260512-sne, D-A-01 + D-A-02) -
// Mirrors the rate-limit half and spend-cap half above. All three halves
// share the same unified EVAL_CLI_ALLOWLIST Set — this half adds the third
// sibling helper isEmailIpRatelimitAllowlisted and the ip10m/ipday skip in
// checkRateLimits. Per-IP cost cap (SAFE-08) is INTENTIONALLY NOT gated by
// email and serves as the last-line cost backstop (Test Q regression-trap).

describe('SEED-001 isEmailIpRatelimitAllowlisted', () => {
  it('returns true for the canonical eval-cli email', () => {
    expect(isEmailIpRatelimitAllowlisted('eval-cli@joedollinger.dev')).toBe(true);
  });
  it('returns false for pattern-adjacent eval-cli-test email', () => {
    expect(isEmailIpRatelimitAllowlisted('eval-cli-test@joedollinger.dev')).toBe(false);
  });
  it('returns false for empty string', () => {
    expect(isEmailIpRatelimitAllowlisted('')).toBe(false);
  });
  it('returns false for an unrelated recruiter email', () => {
    expect(isEmailIpRatelimitAllowlisted('recruiter@google.com')).toBe(false);
  });
  it('returns false for case-variant (case-sensitive contract)', () => {
    expect(isEmailIpRatelimitAllowlisted('EVAL-CLI@joedollinger.dev')).toBe(false);
  });
  it('returns false for subdomain-trick email', () => {
    expect(isEmailIpRatelimitAllowlisted('eval-cli@joedollinger.dev.attacker.com')).toBe(false);
  });
});

describe('SEED-001 checkRateLimits — allowlisted email (ip-rate-limit half)', () => {
  beforeEach(() => {
    (ipLimiter10m.limit as ReturnType<typeof vi.fn>).mockClear();
    (ipLimiterDay.limit as ReturnType<typeof vi.fn>).mockClear();
    (emailLimiterDay.limit as ReturnType<typeof vi.fn>).mockClear();
    (sessionLimiter.limit as ReturnType<typeof vi.fn>).mockClear();
  });

  it('SKIPS ipLimiter10m.limit() AND ipLimiterDay.limit() for canonical eval-cli email (D-A-01 ip-half bypass; session limiter STILL fires)', async () => {
    const res = await checkRateLimits('1.2.3.4', 'eval-cli@joedollinger.dev', 'sess-iprl');
    expect((ipLimiter10m.limit as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    expect((ipLimiterDay.limit as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    // Email window also exempt (already-shipped r4s) — confirms unified policy:
    expect((emailLimiterDay.limit as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    // Session limiter STILL fires (D-A-01 scope boundary):
    expect((sessionLimiter.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect((sessionLimiter.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('sess-iprl');
    expect(res).toEqual({ ok: true });
  });

  it('DOES call ipLimiter10m + ipLimiterDay for a real recruiter email (back-compat)', async () => {
    const res = await checkRateLimits('1.2.3.4', 'recruiter@google.com', 'sess-r');
    expect((ipLimiter10m.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect((ipLimiter10m.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('1.2.3.4');
    expect((ipLimiterDay.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect((ipLimiterDay.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('1.2.3.4');
    expect(res).toEqual({ ok: true });
  });

  it.each([
    'eval-cli-test@joedollinger.dev',
    'eval-cli2@joedollinger.dev',
    'eval-cli@joedollinger.dev.attacker.com',
    'EVAL-CLI@joedollinger.dev',
  ])('pattern-adjacent email %s DOES hit ip10m + ipday (exact-match contract)', async (evilEmail) => {
    (ipLimiter10m.limit as ReturnType<typeof vi.fn>).mockClear();
    (ipLimiterDay.limit as ReturnType<typeof vi.fn>).mockClear();
    await checkRateLimits('1.2.3.4', evilEmail, 'sess-evil');
    expect((ipLimiter10m.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect((ipLimiter10m.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('1.2.3.4');
    expect((ipLimiterDay.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect((ipLimiterDay.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('1.2.3.4');
  });

  it('SAFE-08 last-line backstop STILL trips for allowlisted email when ipcost >= 150¢ (T-sne-04 regression-trap)', async () => {
    // Pre-populate the FakeRedis store with 150¢ for a distinct ipKey so
    // getIpCostToday returns 150 inside checkRateLimits. The existing
    // per-IP cost describe block above demonstrates the pattern.
    await incrementIpCost('safe-08-ip', 150);
    const res = await checkRateLimits('safe-08-ip', 'eval-cli@joedollinger.dev', 'sess-safe-08');
    expect(res).toEqual({ ok: false, which: 'ipcost' });
    // ip10m + ipday were STILL bypassed for the allowlisted email — the
    // backstop firing is purely the SAFE-08 ipcost check, not a per-IP
    // rate-limit failure leaking through.
    expect((ipLimiter10m.limit as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    expect((ipLimiterDay.limit as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });
});
