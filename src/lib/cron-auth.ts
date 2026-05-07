// src/lib/cron-auth.ts
// Phase 4 D-C-09. Bearer-token + POST-method check for /api/cron/* routes.
// Belt-and-suspenders: rejecting non-POST blocks accidental browser hits
// (GET) on the cron URLs even with a leaked secret — the most likely
// secret-leak path is a screenshot/DM of the curl command, not a programmed
// HTTP call. cron-job.org always issues POST for the configured jobs.
import { env } from './env';

/**
 * Validates a cron request. Caller must reject 401 if this returns false.
 * @returns true when method=POST AND Authorization='Bearer <CRON_SECRET>'.
 */
export function validateCronAuth(req: Request): boolean {
  if (req.method !== 'POST') return false;
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return false;
  const token = auth.slice('Bearer '.length).trim();
  if (token.length === 0) return false;
  // Constant-time compare — overkill at this scale but cheap, dodges naive
  // timing oracles that would otherwise leak the secret one byte at a time.
  return timingSafeEqual(token, env.CRON_SECRET);
}

/** Minimal constant-time string compare to dodge timing oracles. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
