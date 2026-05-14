'use client';

import { useSyncExternalStore } from 'react';

/**
 * Client-detection hook. Returns `false` during SSR / first server render,
 * `true` after hydration on the client. Backed by useSyncExternalStore
 * (React 18+ idiomatic; satisfies eslint-plugin-react-hooks@6
 * `react-hooks/set-state-in-effect` rule by avoiding setState in effect
 * entirely).
 *
 * Subscribe is a no-op because there is no external store to subscribe to —
 * the "store" is the synchronous fact of being on the client vs the server.
 * Client snapshot is constant `true`; server snapshot is constant `false`.
 * React's hydration phase reconciles the two automatically (no flicker,
 * no setState-after-mount).
 *
 * Replaces the canonical Next App Router hydration pattern:
 *   const [hydrated, setHydrated] = useState(false);
 *   useEffect(() => setHydrated(true), []);
 *
 * Phase 7 Plan 07-1A — D-A-02. See 07-1A-CONTEXT.md.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {}, // subscribe: no-op (returns unsubscribe no-op)
    () => true, // client snapshot: always true
    () => false, // server snapshot: always false
  );
}
