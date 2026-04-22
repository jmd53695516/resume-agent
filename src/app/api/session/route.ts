// src/app/api/session/route.ts
// GATE-03: create a session row per email-submit. Node runtime (not Edge) —
// matches Phase 2's /api/chat which must be Node for tool use + AI SDK.
// Source: RESEARCH.md Code Example + CONTEXT.md GATE-03 + Plan 01-03.
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
});

function emailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() ?? '';
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
