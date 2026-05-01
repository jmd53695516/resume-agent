// src/lib/health.ts
// Per-dependency ping helpers consumed by /api/health (Plan 03-04).
// Plan 03-00 ships the SURFACE only — bodies are Plan 03-04 work.
// This split lets Plan 03-04 import { DepStatus } from earlier code without
// racing against this plan's logger swap.

export type DepStatus = 'ok' | 'degraded' | 'down';

const NOT_IMPLEMENTED = 'not implemented — see Plan 03-04';

export async function pingAnthropic(): Promise<DepStatus> {
  throw new Error(NOT_IMPLEMENTED);
}
export async function pingClassifier(): Promise<DepStatus> {
  throw new Error(NOT_IMPLEMENTED);
}
export async function pingSupabase(): Promise<DepStatus> {
  throw new Error(NOT_IMPLEMENTED);
}
export async function pingUpstash(): Promise<DepStatus> {
  throw new Error(NOT_IMPLEMENTED);
}
export async function pingExa(): Promise<DepStatus> {
  throw new Error(NOT_IMPLEMENTED);
}
