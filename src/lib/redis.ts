// src/lib/redis.ts
// Multi-key rate limits + spend counters. HTTP-based (edge+node safe).
// D-D-02..08 locked these thresholds.
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env } from './env';

// Module singleton — Redis.fromEnv() would work but we take explicit control so
// env.ts stays the single oracle and missing-var errors surface early.
export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

// --- Rate limits (SAFE-05/06/07) -----------------------------------------

const PREFIX = 'resume-agent';

export const ipLimiter10m = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '10 m'), // 20 messages / 10 min per IP
  prefix: `${PREFIX}:rl:ip10m`,
  analytics: false,
});

export const ipLimiterDay = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 d'), // 60 messages / day per IP
  prefix: `${PREFIX}:rl:ipday`,
  analytics: false,
});

export const emailLimiterDay = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(150, '1 d'), // 150 messages / day per email
  prefix: `${PREFIX}:rl:emailday`,
  analytics: false,
});

export const sessionLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(200, '7 d'), // 200 messages / session (safety net)
  prefix: `${PREFIX}:rl:session`,
  analytics: false,
});

export type RateLimitCheck =
  | { ok: true }
  | { ok: false; which: 'ip10m' | 'ipday' | 'email' | 'session' | 'ipcost' };

export async function checkRateLimits(
  ipKey: string,
  email: string,
  sessionId: string,
): Promise<RateLimitCheck> {
  const [ip10, ipDay, emailRes, sessionRes, ipCostCents] = await Promise.all([
    ipLimiter10m.limit(ipKey),
    ipLimiterDay.limit(ipKey),
    emailLimiterDay.limit(email),
    sessionLimiter.limit(sessionId),
    getIpCostToday(ipKey),
  ]);

  if (!ip10.success) return { ok: false, which: 'ip10m' };
  if (!ipDay.success) return { ok: false, which: 'ipday' };
  if (!emailRes.success) return { ok: false, which: 'email' };
  if (!sessionRes.success) return { ok: false, which: 'session' };
  if (ipCostCents >= 150) return { ok: false, which: 'ipcost' }; // D-D-05

  return { ok: true };
}

// --- Spend cap (SAFE-04/09) ----------------------------------------------

// Rolling 24h spend counter. We keep per-hour buckets and sum the last 24
// on read; simpler than server-side Lua for the overshoot tolerance D-D-08 gives us.
function hourBucketKey(ts = Date.now()): string {
  const iso = new Date(ts).toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
  return `${PREFIX}:spend:${iso}`;
}

export async function getSpendToday(): Promise<number> {
  // Last 24 hourly keys
  const now = Date.now();
  const keys = Array.from({ length: 24 }, (_, i) => hourBucketKey(now - i * 3_600_000));
  const vals = await redis.mget<(string | number | null)[]>(...keys);
  return vals.reduce<number>((a, v) => a + Number(v ?? 0), 0);
}

export async function isOverCap(): Promise<boolean> {
  return (await getSpendToday()) >= 300; // D-D-07: 300 cents rolling 24h
}

export async function incrementSpend(cents: number): Promise<void> {
  if (cents <= 0) return;
  const key = hourBucketKey();
  // EXPIRE 25h so the key outlives its 24h relevance window by a safety margin.
  await redis.incrby(key, cents);
  await redis.expire(key, 25 * 3600);
}

// --- Per-IP cost accumulator (SAFE-08) -----------------------------------

function ipCostKey(ipKey: string): string {
  const day = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  return `${PREFIX}:ipcost:${day}:${ipKey}`;
}

export async function getIpCostToday(ipKey: string): Promise<number> {
  const v = await redis.get<string | number | null>(ipCostKey(ipKey));
  return Number(v ?? 0);
}

export async function incrementIpCost(ipKey: string, cents: number): Promise<void> {
  if (cents <= 0) return;
  const key = ipCostKey(ipKey);
  await redis.incrby(key, cents);
  await redis.expire(key, 25 * 3600);
}
