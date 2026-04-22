// src/lib/supabase-server.ts
// Service-role Supabase client singleton. Server-only.
// NEVER import this from a Client Component or from any file under src/components/
// except through a Server Action. @supabase/ssr is for cookie-aware auth flows (Phase 4);
// for Phase 1's server-initiated INSERT we want vanilla supabase-js with the service role.
// Source: RESEARCH.md Pattern 3 + Pitfall 7.
import { createClient } from '@supabase/supabase-js';
import { env } from './env';

export const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);
