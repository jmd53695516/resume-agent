// src/components/ChatStatusBanner.tsx
// CLIENT COMPONENT. Dismiss-wrapper for the chat-page banner. Uses
// sessionStorage to remember the dismiss across the active session — fresh
// session re-shows the banner (D-F-05).
'use client';

import { useState, useEffect } from 'react';

const DISMISS_KEY = 'status-banner-dismissed';

export function ChatStatusBanner({ messages }: { messages: string[] }) {
  // Initialize from sessionStorage in an effect to avoid SSR/CSR mismatch.
  const [dismissed, setDismissed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    if (typeof window !== 'undefined') {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
    }
  }, []);

  // Brief flash before hydration. Better than a hydration mismatch warning.
  if (!hydrated) return null;
  if (dismissed) return null;

  return (
    <div
      className="sticky top-0 z-40 flex items-start justify-between bg-amber-100 px-4 py-2 text-sm text-amber-900"
      data-testid="status-banner-chat"
    >
      <span>{messages.join(' ')}</span>
      <button
        type="button"
        aria-label="Dismiss banner"
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, '1');
          setDismissed(true);
        }}
        className="ml-2 font-bold"
        data-testid="status-banner-dismiss"
      >
        ×
      </button>
    </div>
  );
}
