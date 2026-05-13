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

// --- Eval-cli allowlist (SEED-001 unified, D-A-02) ----------------------
//
// Exact-match Set of emails that BYPASS three gates:
//   - the per-email 150/day rate limiter (consumed by isEmailRatelimitAllowlisted)
//   - the SAFE-04 300¢/24h global spend cap (consumed by isEmailSpendCapAllowlisted)
//   - the per-IP rate limiters: ip10m=20/10min + ipday=60/day (consumed by
//     isEmailIpRatelimitAllowlisted; ADDED in quick task 260512-sne)
//
// Designed to unblock the eval CLI from CI without creating a blanket bypass.
//
// SECURITY (SEED-001 threat-model — STRIDE registers in
// .planning/quick/260512-r4s-.../260512-r4s-PLAN.md (rate-limit half),
// .planning/quick/260512-ro4-.../260512-ro4-PLAN.md (spend-cap half),
// .planning/quick/260512-sne-.../260512-sne-PLAN.md (ip-rate-limit half)):
//   - Exact match only. NOT suffix, NOT regex, NOT case-insensitive.
//     `eval-cli-test@joedollinger.dev` does NOT bypass.
//     `EVAL-CLI@joedollinger.dev` does NOT bypass.
//   - Per-IP cost cap (SAFE-08, 150¢/day per IP at `resume-agent:ipcost:
//     YYYY-MM-DD:<ipKey>`) STILL applies — this is the ONLY remaining
//     cost-based last-line backstop for eval-cli traffic after sne lands.
//   - Session limiter (sessionLimiter, 200 msg/7d) STILL applies (D-A-01
//     explicit scope boundary; safety net preserved).
//   - The canonical eval-cli email literal is duplicated in
//     src/lib/eval/agent-client.ts mintEvalSession(); drift between the
//     two is caught by tests/lib/redis.test.ts (3-helper drift-detection).
//
// To extend: prefer adding a new exact email here. If a use case ever
// needs env-var-driven flexibility, add a second Set built from
// `process.env.EVAL_CLI_ALLOWLIST_EXTRA` (comma-separated) and union them
// — but DO NOT replace the hardcoded baseline (the drift detection test
// would no longer catch updates to the eval CLI literal).
export const EVAL_CLI_ALLOWLIST: ReadonlySet<string> = new Set([
  'eval-cli@joedollinger.dev',
]);

/**
 * Returns true if the given email is exempt from the per-email rate
 * limiter. Per-IP / spend-cap / session checks are NOT affected.
 */
export function isEmailRatelimitAllowlisted(email: string): boolean {
  return EVAL_CLI_ALLOWLIST.has(email);
}

/**
 * Returns true if the given email is exempt from the SAFE-04 global
 * 24h rolling spend cap (`isOverCap()` is short-circuited AND
 * `incrementSpend()` skips its increment when called with this email).
 *
 * Per-IP cost cap (SAFE-08, 150¢/day per IP) and per-IP rate limits
 * (ip10m, ipday) are NOT affected — those are the last-line backstops
 * for eval-cli traffic.
 */
export function isEmailSpendCapAllowlisted(email: string): boolean {
  return EVAL_CLI_ALLOWLIST.has(email);
}

/**
 * Returns true if the given email is exempt from the per-IP rate limiters
 * `ipLimiter10m` (20/10min per IP) and `ipLimiterDay` (60/day per IP).
 *
 * Session limiter (`sessionLimiter`, 200/7d) and per-IP cost cap
 * (SAFE-08, 150¢/day per IP) are NOT affected — those are the last-line
 * backstops for eval-cli traffic after all three SEED-001 halves land.
 * SAFE-08 in particular is INTENTIONALLY NOT gated by email and is the
 * regression-trap target for tests/lib/redis.test.ts Test Q.
 */
export function isEmailIpRatelimitAllowlisted(email: string): boolean {
  return EVAL_CLI_ALLOWLIST.has(email);
}

export type RateLimitCheck =
  | { ok: true }
  | { ok: false; which: 'ip10m' | 'ipday' | 'email' | 'session' | 'ipcost' };

export async function checkRateLimits(
  ipKey: string,
  email: string,
  sessionId: string,
): Promise<RateLimitCheck> {
  const emailExempt = isEmailRatelimitAllowlisted(email);
  // SEED-001 / D-A-01 / quick task 260512-sne: allowlisted emails skip the
  // per-IP rate limiters (ip10m + ipday) entirely. Session limiter still
  // fires (D-A-01 scope boundary) and per-IP cost cap (SAFE-08, 150¢/day
  // per IP) still applies via `getIpCostToday` below — that's the last-
  // line cost backstop for eval-cli traffic and is INTENTIONALLY NOT
  // gated by email. Future executor noticing the asymmetry "we bypass
  // ip10m + ipday but not ipcost" — read the SECURITY comment above.
  const ipRlExempt = isEmailIpRatelimitAllowlisted(email);

  const [ip10, ipDay, emailRes, sessionRes, ipCostCents] = await Promise.all([
    ipRlExempt
      ? Promise.resolve({ success: true } as const)
      : ipLimiter10m.limit(ipKey),
    ipRlExempt
      ? Promise.resolve({ success: true } as const)
      : ipLimiterDay.limit(ipKey),
    // SEED-001: allowlisted emails skip the per-email window. Returning a
    // synthetic success preserves the Promise.all shape and the precedence
    // ordering below (ip10m → ipday → email → session → ipcost) unchanged.
    emailExempt
      ? Promise.resolve({ success: true } as const)
      : emailLimiterDay.limit(email),
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

/**
 * Increment the global 24h-rolling spend counter by `cents`. Skipped if
 * `cents <= 0` (no-op for free deflection paths). SEED-001 / D-A-01:
 * skipped entirely when `opts.email` is in the eval-cli allowlist — eval
 * traffic must be fully invisible to the global counter. Per-IP cost
 * counter (incrementIpCost) is NOT gated here; it still increments for
 * eval-cli traffic since SAFE-08 is the new last-line cost backstop.
 */
export async function incrementSpend(
  cents: number,
  opts?: { email?: string },
): Promise<void> {
  if (cents <= 0) return;
  if (opts?.email && isEmailSpendCapAllowlisted(opts.email)) return;
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
