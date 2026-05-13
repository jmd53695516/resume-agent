// scripts/clear-ipcost-today.ts
// One-off: clear all SAFE-08 per-IP cost cap counters for today.
// Used after PR #4 CI exposed that legitimate eval-cli volume can poison
// the per-IP cost counters of GH Actions runner IPs (each run ~30¢; 5 runs
// = 150¢ = SAFE-08 trips at gate 5). See SEED-001 ip-rate-limit half discussion.
import { redis } from '../src/lib/redis';

async function main() {
  const day = new Date().toISOString().slice(0, 10);
  const keys = await redis.keys(`resume-agent:ipcost:${day}:*`);
  console.log(`Found ${keys.length} ipcost keys for ${day}`);
  for (const k of keys) {
    const v = await redis.get<number | string>(k);
    await redis.del(k);
    console.log(`  CLEARED ${k} (was ${v})`);
  }
  console.log('done');
}

main().catch((e: unknown) => { console.error(e); process.exit(1); });
