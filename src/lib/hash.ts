// src/lib/hash.ts
// SHA-256 helper for IP addresses (V6 ASVS — use built-in crypto, never hand-roll).
// Phase 1 stores ip_hash on the sessions row; raw IP is never persisted.
import { createHash } from 'node:crypto';

export function hashIp(ip: string | null | undefined): string {
  if (!ip || ip.length === 0) return 'unknown';
  return createHash('sha256').update(ip).digest('hex');
}

// hashArgs — D-I-04. Pino tool_call lines log args_hash, NEVER raw args.
// The description field of design_metric_framework can contain PII (recruiter
// pasting confidential roadmap). 16 hex chars = collision-safe at Joe's volume.
export function hashArgs(args: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(args))
    .digest('hex')
    .slice(0, 16);
}
