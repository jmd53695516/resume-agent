// src/lib/supabase-browser.ts
// Phase 4 D-H-03 — Supabase browser client singleton for /admin/login OAuth
// button and client-side signOut() in <NotAuthorized /> + admin top-bar.
//
// CLIENT-ONLY. Server contexts (proxy.ts, route handlers, server components)
// must use src/lib/supabase-server.ts (service role) OR a per-request
// createServerClient with cookie sync (see src/lib/admin-auth.ts).
//
// Anon key is public-by-design per Supabase docs.
'use client';

import { createBrowserClient } from '@supabase/ssr';

// env.ts cannot be imported into a client module without leaking server
// env vars to the bundle. Read NEXT_PUBLIC_* directly here.
// Next.js inlines literal process.env.NEXT_PUBLIC_* reads at build time;
// dynamic indexing would NOT be inlined and would be undefined client-side.
// The Supabase anon key is public-by-design per Supabase docs.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabaseBrowser = createBrowserClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
);
