'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ChatUI } from '@/components/ChatUI';
import { ViewToggle } from '@/components/ViewToggle';
import { useIsClient } from '@/hooks/use-is-client';

// Lazy import — code-split out of default chat-mode bundle (CD-02).
// ssr: false is valid here because chat/page.tsx is 'use client'
// (Pitfall 4 in RESEARCH — ssr: false rejects in Server Components).
// The fade-in is opacity-only via inline transition (matrix-stage), so
// a flash of nothing on first frame is invisible — loading: () => null.
const MatrixRain = dynamic(
  () => import('@/components/MatrixRain').then((m) => ({ default: m.MatrixRain })),
  { ssr: false, loading: () => null },
);

/**
 * Phase 05.2 (D-A-04, D-B-01..03): view-toggle state lives at this page
 * level so the ViewToggle pill (sibling of ChatUI) and ChatUI can both
 * read it. Initial state is the LITERAL 'chat' — no client storage,
 * no system-preference integration (D-B-03). Resets on reload.
 *
 * Body-class side effect adds 'matrix-mode' to <body> when view==='matrix'.
 * Cleanup function strips it on unmount (route change to /admin/* etc.) so
 * the class doesn't leak across navigations (Pitfall 2 in RESEARCH).
 *
 * D-B-02: pill labels are "Light Mode" / "Dark Mode" — the cheeky
 * double-meaning IS the design payoff. DO NOT flatten.
 *
 * Plan 05.2-05: MatrixRain canvas lazy-mounted via next/dynamic (CD-02).
 * Conditionally rendered when view === 'matrix' so the RAF loop only
 * exists when the user has actively chosen matrix view. CD-03 a11y +
 * viewport gates are inside MatrixRain itself (canvas mounts but RAF
 * skips on prefers-reduced-motion or viewport <768px).
 */
export default function ChatPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const isClient = useIsClient();
  const [view, setView] = useState<'chat' | 'matrix'>('chat');

  useEffect(() => {
    const id = typeof window !== 'undefined' ? sessionStorage.getItem('session_id') : null;
    if (!id) {
      router.replace('/');
      return;
    }
    setSessionId(id);
  }, [router]);

  // D-B-01 + Pitfall 2: toggle body class with cleanup. The cleanup is
  // CRITICAL — without it, navigating to /admin/* leaves body.matrix-mode
  // set and the admin page paints itself green.
  useEffect(() => {
    if (view === 'matrix') {
      document.body.classList.add('matrix-mode');
      return () => document.body.classList.remove('matrix-mode');
    }
  }, [view]);

  if (!isClient || !sessionId) {
    // Brief flash before hydration / redirect. Avoids hydration mismatch
    // (Pitfall 3 — initial 'chat' literal state matches server render).
    return null;
  }

  return (
    <>
      {view === 'matrix' && <MatrixRain visible />}
      <ViewToggle view={view} onChange={setView} />
      <ChatUI sessionId={sessionId} />
    </>
  );
}
