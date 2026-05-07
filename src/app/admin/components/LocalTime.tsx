'use client';

// src/app/admin/components/LocalTime.tsx
// Renders an ISO timestamp as a localized string in Joe's browser timezone.
// SSR-safe via suppressHydrationWarning — server renders ISO, client
// replaces with toLocaleString() on hydration.
import { useEffect, useState } from 'react';

export function LocalTime({
  iso,
  format = 'datetime',
}: {
  iso: string;
  format?: 'datetime' | 'date' | 'time';
}) {
  const [text, setText] = useState(iso);
  useEffect(() => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      setText(iso);
      return;
    }
    if (format === 'date') setText(d.toLocaleDateString());
    else if (format === 'time') setText(d.toLocaleTimeString());
    else setText(d.toLocaleString());
  }, [iso, format]);
  return <span suppressHydrationWarning>{text}</span>;
}
