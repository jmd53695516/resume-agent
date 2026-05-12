// scripts/reset-eval-spend-cap.ts
// Plan 05-12 Task 0 — local-dev utility to clear today's rolling-24h spend
// hourly buckets so cat1 preview verification can re-run without tripping
// the 300¢ SAFE-04 cap. Spawned because the shared Upstash Redis between
// local-CLI / Vercel-preview / Vercel-prod accumulates real Sonnet costs
// from every eval run (~8¢ cache-write per call when 5-min cache is cold,
// + ~1¢ per output) — a few iterations of the cat1 verification cycle
// trips the cap.
//
// SAFETY POSTURE — read before running:
//
//   1. This script clears the 24 hourly buckets for the CURRENT UTC day
//      (`resume-agent:spend:YYYY-MM-DDT00..23`). Tomorrow's buckets are
//      untouched. The 300¢ rolling-24h cap continues to enforce against
//      future spend.
//
//   2. The Upstash Redis is SHARED between local CLI / Vercel preview /
//      Vercel production. Resetting the spend cap here also resets it
//      for prod traffic. For Plan 05-12 this is acceptable because the
//      resume link has not been distributed yet (Tasks 1/3 are pending),
//      so prod traffic is essentially zero.
//
//   3. Once the resume link goes live (Plan 05-12 Task 4 paper print),
//      DO NOT run this script — the spend cap is a real backstop against
//      recruiter-traffic spikes and should accumulate naturally.
//
//   4. The SAFE-12 Anthropic-org-level $20/mo cap (Task 2 of this plan)
//      is the deeper backstop — Joe sets it in console.anthropic.com
//      and it cannot be bypassed by Redis state.
//
// Run via:   npx tsx scripts/reset-eval-spend-cap.ts
//
// Related: scripts/reset-eval-rate-limits.ts clears per-IP / per-email
// sliding-window rate-limit keys (different concern; kept separate so
// rate-limit resets don't accidentally weaken the spend cap).
import { redis } from '../src/lib/redis';

const PREFIX = 'resume-agent';

async function main(): Promise<void> {
  // Build the SAME 24 keys getSpendToday() reads (src/lib/redis.ts:82-88):
  // a rolling window walking backward 1h at a time from `now`. The previous
  // current-UTC-day approach silently missed yesterday's buckets when the
  // operator ran the script after midnight UTC but inside the cap's rolling
  // window. Format mirrors hourBucketKey(): `${PREFIX}:spend:YYYY-MM-DDTHH`.
  const now = Date.now();
  const buckets = Array.from({ length: 24 }, (_, i) => {
    const iso = new Date(now - i * 3_600_000).toISOString().slice(0, 13);
    return { iso, key: `${PREFIX}:spend:${iso}` };
  });
  const keys = buckets.map((b) => b.key);

  // Read first so the operator sees the cumulative spend before deletion.
  const vals = await redis.mget<(string | number | null)[]>(...keys);
  const totalCents = vals.reduce<number>((a, v) => a + Number(v ?? 0), 0);

  // Surface the per-bucket distribution so any anomalous bucket is visible.
  const populated = vals
    .map((v, i) => ({ iso: buckets[i].iso, cents: Number(v ?? 0) }))
    .filter((b) => b.cents > 0);

  console.log(`reset-eval-spend-cap: window = last 24h (UTC, rolling)`);
  console.log(`reset-eval-spend-cap: cumulative spend before reset = ${totalCents}¢ (cap = 300¢)`);
  if (populated.length > 0) {
    console.log('reset-eval-spend-cap: populated hourly buckets:');
    for (const b of populated) {
      console.log(`  - ${b.iso}  ${b.cents}¢`);
    }
  }

  if (totalCents === 0) {
    console.log('reset-eval-spend-cap: nothing to clear (already at 0¢).');
    return;
  }

  let deleted = 0;
  try {
    // Variadic del — single REST round-trip.
    deleted = (await redis.del(...keys)) as number;
  } catch (err) {
    console.error(`reset-eval-spend-cap: redis.del threw — ${(err as Error).message}`);
    process.exit(1);
  }

  console.log(`reset-eval-spend-cap: cleared ${deleted}/${keys.length} buckets (${totalCents}¢ removed).`);
  console.log('reset-eval-spend-cap: cap is now 0¢/300¢. Future Sonnet calls will accumulate normally.');
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
