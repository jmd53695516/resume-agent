// scripts/reset-eval-rate-limits.ts
// Phase 05.1 Item #6 (deferred-items.md #6). Local-dev ergonomics: clears the
// Upstash rate-limit + ipcost keys for the eval-CLI ipKey resolution chain
// and the eval-CLI email so back-to-back local eval runs don't trip
// ipLimiter10m sliding-window accumulation.
//
// CRITICAL — @upstash/ratelimit storage shape: the SDK does NOT store under
// the bare `<prefix>:<id>` key — it appends a sliding-window timestamp
// suffix like `:2964058` (10-minute window) or `:20583` (day window).
// We have to use a SCAN-style match (redis.keys('<prefix>:<id>:*')) to
// collect all the timestamped windowed keys for an id. Verified live:
// resume-agent:rl:ip10m:::1:2964058 → 20 (the actual in-flight key).
//
// CRITICAL — @upstash/ratelimit ephemeralCache pitfall: each Ratelimit
// instance has an in-process `ephemeralCache` (Map) enabled by default.
// This script clears the source-of-truth Redis keys, but a RUNNING dev
// server's Ratelimit instances will still remember "blocked" for the
// cooldown window. After running this script you MUST restart
// `npm run dev` to flush the in-process cache. See deferred-items.md
// Item #6 (lines 379-384) and 05.1-RESEARCH.md Pitfall 1.
//
// Production /api/chat is NOT modified by this script — script imports
// run at script-execution time only, never at request time (CONTEXT.md
// D-E-01: 'MUST NOT add a runtime read in production code paths').
//
// Run via:   npx tsx scripts/reset-eval-rate-limits.ts
//   or:      npm run eval:reset-rl
import { redis } from '../src/lib/redis';

const PREFIX = 'resume-agent';
// Local dev ipKey resolution chain — covers Vercel @vercel/functions
// ipAddress() returning IPv6/IPv4 localhost, plus the 'dev' literal
// fallback documented in STATE.md (Phase 02-safe-chat-core entry on
// ipKey on Next.js dev server).
const IP_KEYS = ['::1', '127.0.0.1', 'dev'];
const EMAIL = 'eval-cli@joedollinger.dev';

async function expandPattern(pattern: string): Promise<string[]> {
  // Upstash @upstash/redis exposes a variadic `keys(pattern)` that returns
  // an array of matching keys. Used here to expand sliding-window suffixed
  // keys like `resume-agent:rl:ip10m:::1:2964058`. Blast radius bounded by
  // the explicit prefix list — never a wildcard match against unrelated
  // namespaces.
  return await redis.keys(pattern);
}

async function main(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const allKeys = new Set<string>();

  // Per-IP rate-limit prefixes (src/lib/redis.ts:19-31). The Ratelimit SDK
  // stores keys as `<prefix>:<id>:<windowTimestamp>` so we have to expand
  // each base via redis.keys(pattern). Skipping the expansion (just calling
  // redis.del on the bare prefix-id) silently no-ops — the bug that landed
  // in the first cut of this script.
  for (const ip of IP_KEYS) {
    for (const sub of ['ip10m', 'ipday']) {
      const pattern = `${PREFIX}:rl:${sub}:${ip}:*`;
      const found = await expandPattern(pattern);
      for (const k of found) allKeys.add(k);
    }
    // Daily ipcost counter (src/lib/redis.ts:104 ipCostKey) — flat key, no suffix.
    allKeys.add(`${PREFIX}:ipcost:${today}:${ip}`);
  }
  // Per-email rate-limit prefix (src/lib/redis.ts:33-38). Same windowed shape.
  for (const k of await expandPattern(`${PREFIX}:rl:emailday:${EMAIL}:*`)) {
    allKeys.add(k);
  }
  // sessionLimiter (src/lib/redis.ts:40-45) intentionally skipped — the
  // eval CLI mints a fresh session per run via mintEvalSession.

  const keysArr = [...allKeys];
  if (keysArr.length === 0) {
    console.log('reset-eval-rate-limits: no matching keys to clear (clean state).');
    console.log('NOTE: restart `npm run dev` to flush @upstash/ratelimit in-process ephemeralCache (this script alone is NOT enough for a running dev server).');
    return;
  }

  let deleted = 0;
  try {
    // Upstash @upstash/redis del is variadic and accepts multiple keys
    // in a single REST call. Returns the count of keys actually removed.
    deleted = (await redis.del(...keysArr)) as number;
  } catch (err) {
    console.error(`reset-eval-rate-limits: redis.del threw — ${(err as Error).message}`);
    process.exit(1);
  }

  console.log(`reset-eval-rate-limits: cleared ${deleted}/${keysArr.length} keys.`);
  console.log('NOTE: restart `npm run dev` to flush @upstash/ratelimit in-process ephemeralCache (this script alone is NOT enough for a running dev server).');
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
