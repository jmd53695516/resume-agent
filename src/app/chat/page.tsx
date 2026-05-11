'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChatUI } from '@/components/ChatUI';
import { ViewToggle } from '@/components/ViewToggle';

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
 */
export default function ChatPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<'chat' | 'matrix'>('chat');

  useEffect(() => {
    setHydrated(true);
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

  if (!hydrated || !sessionId) {
    // Brief flash before hydration / redirect. Avoids hydration mismatch
    // (Pitfall 3 — initial 'chat' literal state matches server render).
    return null;
  }

  return (
    <>
      <ViewToggle view={view} onChange={setView} />
      <ChatUI sessionId={sessionId} />
    </>
  );
}
