// src/lib/id.ts
// Single canonical ID generator for app-generated message UUIDs (CHAT-12).
// 21-char URL-safe nanoid — collision probability ~1 per billion years at 1000 IDs/hr.
import { nanoid } from 'nanoid';

export function newMessageId(): string {
  return nanoid(21);
}
