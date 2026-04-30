// src/app/api/session/route.ts
// GATE-03: create a session row per email-submit. Node runtime (not Edge) —
// matches Phase 2's /api/chat which must be Node for tool use + AI SDK.
// Source: RESEARCH.md Code Example + CONTEXT.md GATE-03 + Plan 01-03.
//
// Plan 02-04 (SAFE-13): Conditional Cloudflare Turnstile verification.
// When NEXT_PUBLIC_TURNSTILE_ENABLED='true', the submitted `turnstile_token`
// is verified against Cloudflare's siteverify endpoint BEFORE creating the
// session row. Failure paths return clear error strings:
//   - turnstile_misconfigured (500): flag on but server secret missing
//   - turnstile_missing      (400): flag on but client sent no token
//   - turnstile_failed       (400): Cloudflare rejected the token
// When the flag is off (default), verification is skipped entirely and the
// route behaves identically to Plan 01-03.
//
// Threat notes (from plan threat_model):
// - T-03-01 (spoofed x-forwarded-for) — Phase 1 accepts the raw header; Phase 2
//   switches to @vercel/functions ipAddress() which validates upstream.
// - T-03-02 (malformed body) — mitigated by req.json().catch + zod safeParse.
// - T-03-03 (DB error leaked) — client gets a generic message; real error
//   goes to server-side console.error only.
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-server';
import { hashIp } from '@/lib/hash';

export const runtime = 'nodejs';

const BodySchema = z.object({
  email: z.email(),
  turnstile_token: z.string().optional(),
});

function emailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() ?? '';
}

type TurnstileVerifyResponse = {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
};

// Plan 02-04: server-side Turnstile token verification.
// Posts to Cloudflare's documented siteverify endpoint with the server-only
// secret. Network/HTTP failures fail closed (success: false) so a Cloudflare
// outage cannot bypass the gate — preferred over fail-open for an abuse
// control. Cost is one fetch per session create when the flag is on.
async function verifyTurnstileToken(
  secret: string,
  token: string,
  remoteIp?: string | null,
): Promise<TurnstileVerifyResponse> {
  const params = new URLSearchParams({ secret, response: token });
  if (remoteIp) params.set('remoteip', remoteIp);
  let res: Response;
  try {
    res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
  } catch (e) {
    console.error('[api/session] Turnstile siteverify fetch threw', e);
    return { success: false, 'error-codes': ['siteverify_network_error'] };
  }
  if (!res.ok) {
    return { success: false, 'error-codes': [`siteverify_http_${res.status}`] };
  }
  return (await res.json()) as TurnstileVerifyResponse;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email.' }, { status: 400 });
  }

  // Phase 1 uses the raw x-forwarded-for header; Phase 2 switches to
  // @vercel/functions ipAddress() helper for spoofing resistance (SAFE-05).
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = req.headers.get('user-agent') ?? '';

  // Plan 02-04: conditional Turnstile preflight.
  // Read process.env at call time (not module scope) so test suites can
  // toggle the flag per-test without re-importing the module.
  const turnstileEnabled = process.env.NEXT_PUBLIC_TURNSTILE_ENABLED === 'true';
  if (turnstileEnabled) {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
      // Misconfiguration: flag on but secret missing. Fail CLOSED with a
      // clear 500 — silently letting traffic through would defeat the
      // entire purpose of having the flag.
      console.error(
        '[api/session] TURNSTILE_SECRET_KEY missing while NEXT_PUBLIC_TURNSTILE_ENABLED=true',
      );
      return NextResponse.json({ error: 'turnstile_misconfigured' }, { status: 500 });
    }
    const token = parsed.data.turnstile_token;
    if (typeof token !== 'string' || !token) {
      return NextResponse.json({ error: 'turnstile_missing' }, { status: 400 });
    }
    const result = await verifyTurnstileToken(secret, token, ip);
    if (!result.success) {
      return NextResponse.json(
        { error: 'turnstile_failed', errorCodes: result['error-codes'] ?? [] },
        { status: 400 },
      );
    }
  }

  const session = {
    id: nanoid(),
    email: parsed.data.email,
    email_domain: emailDomain(parsed.data.email),
    ip_hash: hashIp(ip),
    user_agent: userAgent,
    // created_at is set by the database default NOW().
  };

  const { error } = await supabaseAdmin.from('sessions').insert(session);
  if (error) {
    // Log server-side only — don't leak Postgres error details to client.
    console.error('session insert failed', error);
    return NextResponse.json({ error: 'Could not start session.' }, { status: 500 });
  }

  return NextResponse.json({ id: session.id });
}
