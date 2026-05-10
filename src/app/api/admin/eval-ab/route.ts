// src/app/api/admin/eval-ab/route.ts
//
// Phase 5 Plan 05-08 Task 3 — POST handler for the Cat 4 blind A/B page.
//
// Flow (RESEARCH §10):
//   1. requireAdmin() guard (D-A-03 two-layer perimeter — Layer 2 at API).
//   2. Validate request body shape with zod (length-10 boolean array,
//      tester_role enum).
//   3. Cross-check sessionId against the ra_eval_session cookie (Pitfall 6 —
//      defense-in-depth: page sets the cookie, client echoes the sessionId
//      explicitly, server confirms they match).
//   4. validateAndScoreAbSession reads mapping by id, computes pct,
//      writes eval_runs + eval_cases rows tagged 'cat4-blind-ab'.
//
// Cookie-vs-body mismatch returns 400 — surfaces stale-cookie / replay attempts.

import { z } from 'zod';
import { cookies, headers } from 'next/headers';
import { requireAdmin } from '@/lib/admin-auth';
import { validateAndScoreAbSession } from '@/lib/eval/ab-mapping';
import { childLogger } from '@/lib/logger';

const log = childLogger({ event: 'eval_ab_submit' });

const COOKIE_NAME = 'ra_eval_session';

const BodySchema = z.object({
  sessionId: z.string().min(1),
  identifications: z.array(z.boolean()).length(10),
  testerRole: z.enum(['pm', 'non-pm', 'other']),
});

async function resolveTargetUrl(): Promise<string> {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) {
    return explicit.startsWith('http') ? explicit : `https://${explicit}`;
  }
  const h = await headers();
  const host = h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'https';
  if (host) return `${proto}://${host}`;
  return 'http://localhost:3000';
}

export async function POST(req: Request): Promise<Response> {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: `body validation failed: ${parsed.error.message}` },
      { status: 400 },
    );
  }

  // Defense-in-depth: cookie sessionId MUST match body sessionId. Catches
  // replay of an old sessionId from a different A/B run when the cookie has
  // since rotated. Pitfall 6 cookie isolation already prevents collision
  // with @supabase/ssr cookies; this check guards against a separate vector.
  const cookieStore = await cookies();
  const cookieSession = cookieStore.get(COOKIE_NAME)?.value;
  if (!cookieSession) {
    return Response.json(
      { error: 'missing ra_eval_session cookie' },
      { status: 400 },
    );
  }
  if (cookieSession !== parsed.data.sessionId) {
    log.warn(
      {
        cookieSession,
        bodySessionId: parsed.data.sessionId,
        admin: admin.login,
      },
      'eval_ab_session_id_mismatch',
    );
    return Response.json(
      { error: 'sessionId does not match cookie' },
      { status: 400 },
    );
  }

  const targetUrl = await resolveTargetUrl();

  try {
    const result = await validateAndScoreAbSession({
      sessionId: parsed.data.sessionId,
      identifications: parsed.data.identifications,
      testerRole: parsed.data.testerRole,
      targetUrl,
    });
    log.info(
      {
        sessionId: parsed.data.sessionId,
        runId: result.runId,
        pct: result.pct,
        passed: result.passed,
        testerRole: parsed.data.testerRole,
        admin: admin.login,
      },
      'eval_ab_submitted',
    );
    return Response.json(result);
  } catch (err) {
    const message = (err as Error).message;
    log.warn(
      {
        sessionId: parsed.data.sessionId,
        admin: admin.login,
        error: message,
      },
      'eval_ab_score_failed',
    );
    return Response.json({ error: message }, { status: 400 });
  }
}
