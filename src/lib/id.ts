// src/lib/id.ts
// Single canonical ID generator for app-generated message UUIDs (CHAT-12).
// 21-char URL-safe nanoid — collision probability ~1 per billion years at 1000 IDs/hr.
import { nanoid } from 'nanoid';

export function newMessageId(): string {
  return nanoid(21);
}

/**
 * nanoid-based id for `public.alarms_fired.id` (text PK).
 * `alm_` prefix keeps alarm ids visually distinct from message ids in logs +
 * dashboard SQL queries. 21-char body matches `newMessageId` so collision
 * probability is identical (~1 per billion years at 1000 IDs/hr).
 *
 * Phase 4 Plan 04-06 / D-G-01.
 */
export function newAlarmId(): string {
  return `alm_${nanoid(21)}`;
}
