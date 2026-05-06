// src/lib/fetch-health.ts
// Shared SC helper for fetching /api/health with the 30s revalidate pattern.
// Used by both src/components/StatusBanner.tsx (Plan 03-04 — extracted here)
// and src/app/page.tsx (Plan 03-05 branched-render fallback trigger).
//
// headers() returns keys in lowercase form, so we always look them up that way.
// Vercel sets x-forwarded-host + x-forwarded-proto; local dev falls back to
// the host header.
import { headers } from 'next/headers';
import type { DepStatus } from './health';

export type HealthShape = {
  anthropic: DepStatus;
  classifier: DepStatus;
  supabase: DepStatus;
  upstash: DepStatus;
  exa: DepStatus;
};

export async function fetchHealth(): Promise<HealthShape | null> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  try {
    const res = await fetch(`${proto}://${host}/api/health`, {
      next: { revalidate: 30 }, // D-F-02
    });
    if (!res.ok) return null;
    return (await res.json()) as HealthShape;
  } catch {
    return null;
  }
}
