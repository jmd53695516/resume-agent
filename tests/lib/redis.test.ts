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

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    constructor(_args: unknown) {}
    static slidingWindow() {
      return null;
    }
    async limit(_id: string) {
      return {
        success: true,
        limit: 60,
        remaining: 59,
        reset: Date.now() + 600000,
        pending: Promise.resolve(),
      };
    }
  },
}));

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
