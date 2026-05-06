// src/proxy.ts
// Phase 4 D-A-03 (Layer 1) — admin perimeter for Next.js 16.
//
// CRITICAL: This file MUST be named `proxy.ts`, not `middleware.ts`. Next.js
// 16 deprecated the middleware.ts convention and renamed it. Creating
// middleware.ts would emit a deprecation warning on every build (RESEARCH
// Pitfall 1). Default runtime is now Node.js (RESEARCH §8) — no edge
// constraints to work around for @supabase/ssr.
//
// Layer 1 redirects unauthorized requests to /admin/login. Layer 2 lives in
// src/lib/admin-auth.ts and is invoked at the top of every /admin/* server
// component and every /api/admin/* route handler (D-A-03 belt-and-
// suspenders).
//
// Matcher excludes /admin/login so the unauthenticated user can render the
// sign-in button (D-A-05).
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function parseAllowlist(): string[] {
  return (process.env.ADMIN_GITHUB_LOGINS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  // Build a response we can attach refreshed Supabase cookies to.
  const response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // RESEARCH Pitfall 2: getClaims() validates JWT, getSession() does not.
  const { data } = await supabase.auth.getClaims();
  const rawLogin = (data?.claims as { user_metadata?: { user_name?: string } } | null | undefined)
    ?.user_metadata?.user_name;
  const login = typeof rawLogin === 'string' && rawLogin.length > 0
    ? rawLogin.toLowerCase()
    : null;

  const allow = parseAllowlist();
  const authorized = login !== null && allow.includes(login);

  if (!authorized) {
    const loginUrl = new URL('/admin/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // /admin/* EXCEPT /admin/login (so unauthed users can reach the sign-in
  // button). All /api/admin/* paths are protected (no exclusion).
  matcher: ['/admin/((?!login).*)', '/api/admin/:path*'],
};
