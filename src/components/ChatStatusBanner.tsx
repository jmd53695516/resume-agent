// src/components/ChatStatusBanner.tsx
// CLIENT COMPONENT. Dismiss-wrapper for the chat-page banner. Uses
// sessionStorage to remember the dismiss across the active session — fresh
// session re-shows the banner (D-F-05).
'use client';

import { useState, useEffect } from 'react';
import { useIsClient } from '@/hooks/use-is-client';

const DISMISS_KEY = 'status-banner-dismissed';

export function ChatStatusBanner({ messages }: { messages: string[] }) {
  // Initialize from sessionStorage in an effect to avoid SSR/CSR mismatch.
  const [dismissed, setDismissed] = useState(false);
  const isClient = useIsClient();

  useEffect(() => {
    // WR-04 fix: sessionStorage.getItem() throws SecurityError in Safari
    // Private Browsing, iOS Lockdown Mode, and on quota-exceeded. Without
    // this try/catch, the throw inside an effect trips the nearest error
    // boundary (app/error.tsx → PlainHtmlFallback) on /chat — which means a
    // recruiter on iOS Private Mode would land on the fallback just by
    // visiting /chat while a banner is showing.
    try {
      if (typeof window !== 'undefined') {
        // Plan 07-1A deviation: sessionStorage read-on-mount is intentional
        // — we read the dismiss flag once per session to decide initial
        // visibility. setDismissed fires at most once per mount. The
        // eslint-plugin-react-hooks@6 rule fires unconditionally on any
        // setState in an effect, including this canonical browser-storage
        // -initialization pattern. Refactor to useSyncExternalStore would
        // require a synthetic subscribe (sessionStorage does NOT fire
        // storage events for same-tab setItem) — out of scope for this
        // plan; tracked for future hardening if the pattern recurs.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
      }
    } catch {
      // sessionStorage unavailable: show banner (no dismiss memory).
    }
  }, []);

  // Brief flash before hydration. Better than a hydration mismatch warning.
  if (!isClient) return null;
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
          // WR-04 fix: setItem() can throw SecurityError / QuotaExceededError
          // for the same browsers as getItem above. Swallow — the visual
          // dismiss still works for this render, just won't persist.
          try {
            sessionStorage.setItem(DISMISS_KEY, '1');
          } catch {
            // sessionStorage unavailable; dismiss is in-memory only.
          }
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
