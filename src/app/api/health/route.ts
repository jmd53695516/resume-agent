// src/app/api/health/route.ts
// OBSV-07 / OBSV-10. Per-dependency status JSON for the StatusBanner SC and
// (Phase 4) the admin tool-health widget. HTTP 200 always (D-J-01); banner
// consumer renders all-green vs some-degraded entirely render-side.
// Route-segment revalidate=30 (D-J-03 — 30s SWR via Next.js fetch cache).
import { NextResponse } from 'next/server';
import {
  pingAnthropic,
  pingClassifier,
  pingSupabase,
  pingUpstash,
  pingExa,
} from '@/lib/health';

export const runtime = 'nodejs';
export const revalidate = 30;

export async function GET() {
  const [anthropic, classifier, supabase, upstash, exa] = await Promise.all([
    pingAnthropic(),
    pingClassifier(),
    pingSupabase(),
    pingUpstash(),
    pingExa(),
  ]);
  return NextResponse.json({ anthropic, classifier, supabase, upstash, exa });
}
