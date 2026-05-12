import { redis } from '../src/lib/redis';

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const email = 'eval-cli@joedollinger.dev';

  const emailKeys = await redis.keys(`resume-agent:rl:emailday:${email}*`);
  console.log(`\n# email limiter (limit: 150/day for ${email})`);
  let emailTotal = 0;
  for (const k of emailKeys) {
    const v = await redis.get<number>(k);
    console.log(`  ${k} = ${v}`);
    emailTotal += Number(v ?? 0);
  }
  console.log(`  total: ${emailTotal} / 150`);

  const allIpKeys10m = await redis.keys(`resume-agent:rl:ip10m:*`);
  const allIpKeysDay = await redis.keys(`resume-agent:rl:ipday:*`);
  console.log(`\n# active IP 10m windows (limit: 20/10min per IP)`);
  for (const k of allIpKeys10m) {
    const v = await redis.get<number>(k);
    console.log(`  ${k} = ${v}`);
  }
  console.log(`\n# active IP day windows (limit: 60/day per IP)`);
  for (const k of allIpKeysDay) {
    const v = await redis.get<number>(k);
    console.log(`  ${k} = ${v}`);
  }

  console.log(`\n# ipcost today (limit: 300¢/day per IP)`);
  const ipCostKeys = await redis.keys(`resume-agent:ipcost:${today}:*`);
  for (const k of ipCostKeys) {
    const v = await redis.get<number>(k);
    console.log(`  ${k} = ${v}`);
  }
}

main().catch((e: unknown) => { console.error(e); process.exit(1); });
