// src/lib/health.ts
// OBSV-07 / OBSV-10. 5 dependency ping helpers consumed by /api/health.
// Anthropic + classifier use heartbeat-trust (read Redis keys written by
// /api/chat onFinish per Plan 03-02). Supabase + Upstash + Exa use live
// pings with a TIMEOUT_MS guard. HTTP 200 always; helpers never throw.
//
// Heartbeat key names — MUST match Plan 03-02 writes exactly:
//   heartbeat:anthropic    (ex: 120)
//   heartbeat:classifier   (ex: 120)
//
// Heartbeat freshness windows (TTL=120s):
//   <60s    → 'ok'
//   60-120s → 'degraded'
//   absent (TTL expired or never written) → 'degraded'
//   redis.get throws/timeout → 'down' (network failure to Upstash, distinct
//                                     from heartbeat freshness)
import { supabaseAdmin } from './supabase-server';
import { redis } from './redis';

export type DepStatus = 'ok' | 'degraded' | 'down';

const TIMEOUT_MS = 1500; // per ping
const HEARTBEAT_OK_S = 60;
// HEARTBEAT_DEGRADED_S kept as documentation — TTL on the heartbeat key is
// 120s (Plan 03-02), so anything older than 60s but still present is in the
// 60-120s window and reads as 'degraded'.

async function withTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

function classifyHeartbeat(lastOk: string | number | null): DepStatus {
  // Absent (TTL expired or never written) → 'degraded'.
  if (lastOk == null) return 'degraded';
  const ageSec = (Date.now() - Number(lastOk)) / 1000;
  if (ageSec < HEARTBEAT_OK_S) return 'ok';
  // 60s..120s → degraded. After TTL=120s the key is absent (handled above).
  return 'degraded';
}

export async function pingAnthropic(): Promise<DepStatus> {
  try {
    const lastOk = await withTimeout(
      redis.get<string | number | null>('heartbeat:anthropic'),
    );
    return classifyHeartbeat(lastOk);
  } catch {
    // redis.get itself failed (network to Upstash) — distinct from "key absent".
    return 'down';
  }
}

export async function pingClassifier(): Promise<DepStatus> {
  try {
    const lastOk = await withTimeout(
      redis.get<string | number | null>('heartbeat:classifier'),
    );
    return classifyHeartbeat(lastOk);
  } catch {
    return 'down';
  }
}

export async function pingSupabase(): Promise<DepStatus> {
  // W6 fix: explicit .then() chain so the awaitable is unambiguously a Promise.
  // Without .then(), the supabase-js builder is a thenable that can hang in
  // mocks when test setup forgets to resolve the deepest level — under a 5s
  // testTimeout this fails fast rather than hanging vitest indefinitely.
  try {
    // W6: explicit .then() callback — the supabase-js builder returns a
    // PromiseLike (thenable), not a real Promise. Wrap with Promise.resolve()
    // so withTimeout() (which is typed as Promise<T>) gets a real Promise and
    // any thenable-mock infinite-await fails fast under --testTimeout=5000.
    const result = await withTimeout(
      Promise.resolve(
        supabaseAdmin
          .from('sessions')
          .select('id', { count: 'estimated', head: true })
          .limit(1).then((r) => r),
      ),
    );
    if (result && typeof result === 'object' && 'error' in result && result.error) {
      return 'degraded';
    }
    return 'ok';
  } catch {
    return 'down';
  }
}

export async function pingUpstash(): Promise<DepStatus> {
  try {
    const pong = await withTimeout(redis.ping());
    return pong === 'PONG' ? 'ok' : 'degraded';
  } catch {
    return 'down';
  }
}

export async function pingExa(): Promise<DepStatus> {
  try {
    const res = await withTimeout(
      fetch('https://api.exa.ai/', { method: 'HEAD' }),
    );
    return res.ok ? 'ok' : 'degraded';
  } catch {
    return 'down';
  }
}
