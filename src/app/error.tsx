// src/app/error.tsx
// CLIENT COMPONENT — Next.js error.tsx requirement. Catches render-time
// exceptions (e.g., kb file unreadable, unexpected runtime errors during
// page render). Renders the same minimal fallback content as the OBSV-12
// explicit branch in app/page.tsx. NOT the OBSV-12 trigger surface
// (/api/chat 500 + classifier=down are runtime triggers, not render
// errors) — this is belt-and-suspenders so an uncaught render exception
// still lands the recruiter on the safety net rather than a blank page.
'use client';

import { useEffect } from 'react';
import { PlainHtmlFallback } from '@/components/PlainHtmlFallback';

export default function ErrorBoundary({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Pino is server-side; client surface goes to console for browser logs.
    // T-03-05-06: never render the Error object to user-visible DOM.
    console.error('error.tsx caught render exception:', error);
  }, [error]);

  return <PlainHtmlFallback />;
}
