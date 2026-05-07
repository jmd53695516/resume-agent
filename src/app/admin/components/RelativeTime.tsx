'use client';

// src/app/admin/components/RelativeTime.tsx
// Renders an ISO timestamp as a relative string ("5 min ago", "2 hours ago",
// "yesterday"). SSR-safe — server emits the ISO, client replaces on hydrate.
import { useEffect, useState } from 'react';

function relative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diffSec = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (abs < 60) return rtf.format(diffSec, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 30 * 86400) return rtf.format(Math.round(diffSec / 86400), 'day');
  if (abs < 365 * 86400) return rtf.format(Math.round(diffSec / (30 * 86400)), 'month');
  return rtf.format(Math.round(diffSec / (365 * 86400)), 'year');
}

export function RelativeTime({ iso }: { iso: string }) {
  const [text, setText] = useState(iso);
  useEffect(() => {
    setText(relative(iso));
  }, [iso]);
  return <span suppressHydrationWarning>{text}</span>;
}
