// src/components/StatusBanner.tsx
// SERVER COMPONENT. Fetches /api/health via absolute URL constructed from
// headers() and renders per-impaired-dep copy. D-F-01 (mounted on / and /chat),
// D-F-02 (SC fetch with 30s revalidate), D-F-03 (null when all green),
// D-F-04 (per-impaired-dep specific copy), D-F-05 (framing sticky / chat dismissible).
//
// W10: STATUS_COPY is exported DIRECTLY with the typed annotation — no
// intermediate-identifier-then-aliased pattern. The export is the in-file source
// of truth and is what consumers (and tests) import.
//
// Plan 03-05 NOTE: this file ships fetchHealth() INLINE. Plan 03-05 will extract
// fetchHealth into src/lib/fetch-health.ts and update this file's import.
import { headers } from 'next/headers';
import type { DepStatus } from '@/lib/health';
import { ChatStatusBanner } from './ChatStatusBanner';

type HealthShape = {
  anthropic: DepStatus;
  classifier: DepStatus;
  supabase: DepStatus;
  upstash: DepStatus;
  exa: DepStatus;
};

// D-F-04: per-dep specific copy. Joe reviews/edits in PR per the same flow as
// Phase 2 deflection copy. W10: declared directly with the typed annotation.
export const STATUS_COPY: Record<keyof HealthShape, { label: string; degraded: string }> = {
  anthropic: {
    label: 'Chat',
    degraded: 'Chat may be slow right now — Anthropic is having a moment.',
  },
  classifier: {
    label: 'Safety check',
    // Empty: classifier=down triggers full fallback in Plan 03-05. Banner stays
    // silent for that dep so the fallback UI is the single channel.
    degraded: '',
  },
  supabase: {
    label: 'Sessions',
    degraded: "Session history is offline — chat still works, just won't save.",
  },
  upstash: {
    label: 'Rate limiter',
    degraded: 'Rate limiting is offline — usage caps may be approximate.',
  },
  exa: {
    label: 'Pitch tool',
    degraded: 'Pitch tool offline right now — case study and metric design still work.',
  },
};

async function fetchHealth(): Promise<HealthShape | null> {
  const h = await headers();
  // Vercel sets x-forwarded-host + x-forwarded-proto. headers() returns keys
  // in lowercase form, so we always look them up that way.
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

export async function StatusBanner({ page }: { page: 'framing' | 'chat' }) {
  const health = await fetchHealth();
  // T-03-04-06: silent over alarming when /api/health itself is unreachable.
  if (!health) return null;

  const degradedEntries = (Object.entries(health) as [keyof HealthShape, DepStatus][]).filter(
    ([, s]) => s !== 'ok',
  );
  if (degradedEntries.length === 0) return null; // D-F-03

  const messages = degradedEntries
    .map(([dep]) => STATUS_COPY[dep].degraded)
    .filter((m) => m.length > 0);
  if (messages.length === 0) return null;

  // D-F-05: framing sticky non-dismissible; chat delegated to client wrapper.
  if (page === 'framing') {
    return (
      <div
        className="sticky top-0 z-40 bg-amber-100 px-4 py-2 text-sm text-amber-900"
        data-testid="status-banner-framing"
      >
        {messages.join(' ')}
      </div>
    );
  }
  return <ChatStatusBanner messages={messages} />;
}
