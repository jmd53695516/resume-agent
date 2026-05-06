'use client';

// src/app/admin/components/NotAuthorized.tsx
// Phase 4 D-A-04 — 403 page for authenticated-but-not-allowlisted users.
// Shown when requireAdmin() returns null at the per-route layer.
//
// On mount, calls supabase.auth.signOut() to clear the session cookie. The
// server-side requireAdmin() also calls signOut(), but the cookie clear is
// belt-and-suspenders — if the user lands here via a stale client-side
// navigation, this ensures the session is truly cleared.
//
// UI contract: 04-UI-SPEC.md §9.
import { useEffect } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase-browser';

export default function NotAuthorized() {
  useEffect(() => {
    supabaseBrowser.auth.signOut().catch(() => {
      // Already in a denied state; a failed signOut is non-fatal —
      // the session cookie may already be gone.
    });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-page)] px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="mb-2 text-xl font-semibold">Access denied</h1>
        <p className="mb-2 text-sm text-muted-foreground">
          Your GitHub account is not on the admin allowlist.
        </p>
        <p className="mb-6 text-sm text-muted-foreground">
          If you believe this is an error, contact Joe.
        </p>
        <Link
          href="/"
          className="text-sm text-[var(--me)] underline underline-offset-2 hover:opacity-80"
        >
          Go to homepage
        </Link>
      </div>
    </main>
  );
}
