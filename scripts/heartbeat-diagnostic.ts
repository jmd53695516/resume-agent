import { redis } from '../src/lib/redis';

async function main() {
  const keys = ['heartbeat:anthropic', 'heartbeat:classifier', 'heartbeat:exa'];
  const now = Date.now();
  console.log(`\n# heartbeat keys (now = ${new Date(now).toISOString()})`);
  for (const k of keys) {
    const [val, ttl] = await Promise.all([
      redis.get<string | number | null>(k),
      redis.ttl(k),
    ]);
    if (val == null) {
      console.log(`  ${k} = ABSENT (ttl=${ttl}) → degraded`);
      continue;
    }
    const ageSec = Math.round((now - Number(val)) / 1000);
    const status = ageSec < 60 ? 'ok' : 'degraded';
    console.log(
      `  ${k} = ${val} (${new Date(Number(val)).toISOString()}) age=${ageSec}s ttl=${ttl}s → ${status}`,
    );
  }
}

main().catch((e: unknown) => { console.error(e); process.exit(1); });
