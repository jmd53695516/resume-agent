// src/lib/admin-auth.ts
// Phase 4 D-A-03 / D-H-02 — admin auth helpers (Layer 2 of two-layer
// perimeter). Layer 1 is src/proxy.ts; Layer 2 is invoked at top of every
// /admin/* server component AND every /api/admin/* route handler.
//
// requireAdmin() — call from server components & route handlers. Returns
//   { login: string } if authed AND in ADMIN_GITHUB_LOGINS; null otherwise.
//   When the user IS authenticated but NOT allowlisted, also calls
//   supabase.auth.signOut() to clear the session cookie (D-A-04).
//
// getCurrentAdmin() — pure read variant. Returns the same shape but does
//   NOT side-effect (no signOut call). Used by the proxy.ts allowlist
//   check, where we redirect rather than sign out.
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { env } from './env';
import { log } from './logger';

type Admin = { login: string };

function parseAllowlist(): string[] {
  return env.ADMIN_GITHUB_LOGINS
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function readGitHubLogin(): Promise<{
  login: string | null;
  supabase: ReturnType<typeof createServerClient>;
}> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getClaims();
  if (error) return { login: null, supabase };

  // Path verified by RESEARCH §1 (MEDIUM confidence): GitHub OAuth maps
  // login → user_metadata.user_name. If this returns null on the first
  // real login, add a one-time debug log in /auth/callback to inspect
  // the actual claims shape and adjust here.
  const raw = (data?.claims as { user_metadata?: { user_name?: string } } | null | undefined)
    ?.user_metadata?.user_name;
  const login = typeof raw === 'string' && raw.length > 0
    ? raw.toLowerCase()
    : null;

  return { login, supabase };
}

export async function getCurrentAdmin(): Promise<Admin | null> {
  const { login } = await readGitHubLogin();
  if (!login) return null;
  const allow = parseAllowlist();
  if (!allow.includes(login)) return null;
  return { login };
}

export async function requireAdmin(): Promise<Admin | null> {
  const { login, supabase } = await readGitHubLogin();
  if (!login) return null; // unauthenticated — nothing to sign out
  const allow = parseAllowlist();
  if (!allow.includes(login)) {
    // Authenticated but not allowlisted — clear the session.
    try {
      await supabase.auth.signOut();
    } catch (err) {
      log(
        {
          event: 'admin_403',
          github_login: login,
          reason: 'signout_failed',
          error_message: (err as Error).message,
        },
        'warn',
      );
    }
    log({ event: 'admin_403', github_login: login, reason: 'not_in_allowlist' }, 'warn');
    return null;
  }
  log({ event: 'admin_access', github_login: login });
  return { login };
}
