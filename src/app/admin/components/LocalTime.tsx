'use client';

// src/app/admin/components/LocalTime.tsx
// Renders an ISO timestamp as a localized string in Joe's browser timezone.
// SSR-safe via useSyncExternalStore: server snapshot returns the raw ISO,
// client snapshot returns the formatted localized string. React's hydration
// phase reconciles the two without a setState-in-effect cycle (Phase 7
// Plan 07-1A D-A-03; eslint-plugin-react-hooks@6 conformant).
//
// suppressHydrationWarning on the <span> preserves the existing UX: the
// server-emitted ISO is briefly visible until client hydration replaces it
// with the locale-formatted string. Without suppressHydrationWarning, React
// would log a hydration mismatch warning even though the mismatch is
// deliberate (different snapshots is exactly what we want).
import { useSyncExternalStore } from 'react';

function formatIso(iso: string, format: 'datetime' | 'date' | 'time'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (format === 'date') return d.toLocaleDateString();
  if (format === 'time') return d.toLocaleTimeString();
  return d.toLocaleString();
}

export function LocalTime({
  iso,
  format = 'datetime',
}: {
  iso: string;
  format?: 'datetime' | 'date' | 'time';
}) {
  const text = useSyncExternalStore(
    () => () => {}, // subscribe: no-op (no external store; value is derived from props)
    () => formatIso(iso, format), // client snapshot: locale-formatted string
    () => iso, // server snapshot: raw ISO (matches pre-hydration server render)
  );
  return <span suppressHydrationWarning>{text}</span>;
}
