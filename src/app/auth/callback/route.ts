// src/app/auth/callback/route.ts
// Phase 4 D-A-04 — Supabase Auth OAuth callback handler.
// Receives `?code=...` from GitHub OAuth → exchanges for session →
// sets cookies → redirects to /admin/sessions (default landing per D-B-02).
// On exchange failure, redirects to /admin/login?error=oauth_failed.
//
// RESEARCH §1: PKCE flow via @supabase/ssr; cookies must be set on the
// outgoing response, not the request store.
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { log } from '@/lib/logger';
import { env } from '@/lib/env';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/admin/sessions';

  if (!code) {
    return NextResponse.redirect(`${origin}/admin/login?error=oauth_failed`);
  }

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

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) {
    log(
      {
        event: 'oauth_callback_failed',
        error_message: error?.message ?? 'no session returned',
      },
      'warn',
    );
    return NextResponse.redirect(`${origin}/admin/login?error=oauth_failed`);
  }

  // ONE-TIME diagnostic per RESEARCH Open Question 1: log claims shape on
  // first successful login so we can verify user_metadata.user_name path.
  // Remove this log after Joe confirms the shape in production logs (see
  // 04-RESEARCH.md §Open Questions §1).
  try {
    const { data: claimsData } = await supabase.auth.getClaims();
    log({
      event: 'oauth_debug_claims_shape',
      // Stringify-truncate to keep log line bounded; 1000 chars max.
      claims_preview: JSON.stringify(claimsData?.claims ?? null).slice(0, 1000),
    });
  } catch {
    // Diagnostic only — never block the redirect.
  }

  return NextResponse.redirect(`${origin}${next}`);
}
