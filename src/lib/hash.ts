// src/lib/hash.ts
// SHA-256 helper for IP addresses (V6 ASVS — use built-in crypto, never hand-roll).
// Phase 1 stores ip_hash on the sessions row; raw IP is never persisted.
import { createHash } from 'node:crypto';

export function hashIp(ip: string | null | undefined): string {
  if (!ip || ip.length === 0) return 'unknown';
  return createHash('sha256').update(ip).digest('hex');
}
