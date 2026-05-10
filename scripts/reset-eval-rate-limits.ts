// scripts/reset-eval-rate-limits.ts
// Phase 05.1 Item #6 (deferred-items.md #6). Local-dev ergonomics: clears the
// Upstash rate-limit + ipcost keys for the eval-CLI ipKey resolution chain
// and the eval-CLI email so back-to-back local eval runs don't trip
// ipLimiter10m sliding-window accumulation.
//
// CRITICAL — @upstash/ratelimit pitfall: each Ratelimit instance has an
// in-process `ephemeralCache` (Map) enabled by default. This script clears
// the source-of-truth Redis keys, but a RUNNING dev server's Ratelimit
// instances will still remember "blocked" for the cooldown window. After
// running this script you MUST restart `npm run dev` to flush the
// in-process cache. See deferred-items.md Item #6 (lines 379-384) and
// 05.1-RESEARCH.md Pitfall 1.
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

async function main(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const keys: string[] = [];

  // Per-IP rate-limit prefixes (src/lib/redis.ts:19-31).
  for (const ip of IP_KEYS) {
    keys.push(`${PREFIX}:rl:ip10m:${ip}`);
    keys.push(`${PREFIX}:rl:ipday:${ip}`);
    // Daily ipcost counter (src/lib/redis.ts:104 ipCostKey).
    keys.push(`${PREFIX}:ipcost:${today}:${ip}`);
  }
  // Per-email rate-limit prefix (src/lib/redis.ts:33-38).
  keys.push(`${PREFIX}:rl:emailday:${EMAIL}`);
  // sessionLimiter (src/lib/redis.ts:40-45) intentionally skipped — the
  // eval CLI mints a fresh session per run via mintEvalSession.

  let deleted = 0;
  try {
    // Upstash @upstash/redis del is variadic and accepts multiple keys
    // in a single REST call. Returns the count of keys actually removed.
    deleted = (await redis.del(...keys)) as number;
  } catch (err) {
    console.error(`reset-eval-rate-limits: redis.del threw — ${(err as Error).message}`);
    process.exit(1);
  }

  console.log(`reset-eval-rate-limits: cleared ${deleted}/${keys.length} keys.`);
  console.log('NOTE: restart `npm run dev` to flush @upstash/ratelimit in-process ephemeralCache (this script alone is NOT enough for a running dev server).');
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
