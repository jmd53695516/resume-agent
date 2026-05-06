// src/lib/fetch-health.ts
// Shared SC helper for the /api/health-equivalent shape with the 30s revalidate
// pattern. Used by both src/components/StatusBanner.tsx (Plan 03-04) and
// src/app/page.tsx (Plan 03-05 branched-render fallback trigger).
//
// WR-01 fix: previously this issued an HTTP self-fetch to ${proto}://${host}/api/health
// from inside a Server Component. That caused (a) double-billed serverless
// invocations on Vercel (one for the page render, one for the self-fetch),
// (b) cold-start cascade risk, and (c) self-DDoS risk if /api/health ever
// fans out to multiple deps. We now invoke the ping helpers directly in-process
// and wrap the fan-out in next/cache's unstable_cache so the 30s revalidate
// behavior is preserved without an HTTP hop.
//
// /api/health still exists for external monitors and the Phase 4 admin widget —
// both legitimate consumers — but the SC stops self-fetching.
import { unstable_cache } from 'next/cache';
import {
  pingAnthropic,
  pingClassifier,
  pingSupabase,
  pingUpstash,
  pingExa,
} from './health';
import type { DepStatus } from './health';

export type HealthShape = {
  anthropic: DepStatus;
  classifier: DepStatus;
  supabase: DepStatus;
  upstash: DepStatus;
  exa: DepStatus;
};

export const fetchHealth = unstable_cache(
  async (): Promise<HealthShape | null> => {
    try {
      const [anthropic, classifier, supabase, upstash, exa] = await Promise.all([
        pingAnthropic(),
        pingClassifier(),
        pingSupabase(),
        pingUpstash(),
        pingExa(),
      ]);
      return { anthropic, classifier, supabase, upstash, exa };
    } catch {
      return null;
    }
  },
  ['health-status'],
  { revalidate: 30 }, // D-F-02
);
