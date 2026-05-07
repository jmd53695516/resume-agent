// src/app/admin/(authed)/health/page.tsx
// Phase 4 OBSV-13 link surface + D-B-09.
// Server-renders fresh dep status + heartbeat ages + last 5 alarms.
//
// Freshness: `force-dynamic` makes every request SSR-fresh. Do NOT set
// `revalidate = 60` (dead code under force-dynamic).
import { requireAdmin } from '@/lib/admin-auth';
import NotAuthorized from '../../components/NotAuthorized';
import { supabaseAdmin } from '@/lib/supabase-server';
import { redis } from '@/lib/redis';
import {
  pingAnthropic,
  pingClassifier,
  pingSupabase,
  pingUpstash,
  pingExa,
} from '@/lib/health';
import { env } from '@/lib/env';
import { HealthGrid, type DepRow, type Heartbeat, type AlarmRow } from '../../components/HealthGrid';

export const dynamic = 'force-dynamic';

export default async function HealthPage() {
  const admin = await requireAdmin();
  if (!admin) return <NotAuthorized />;

  const [
    anthropic,
    classifier,
    supabase,
    upstash,
    exa,
    hbAnthropic,
    hbClassifier,
    lastTurn,
    alarms,
  ] = await Promise.all([
    pingAnthropic(),
    pingClassifier(),
    pingSupabase(),
    pingUpstash(),
    pingExa(),
    redis.get<string | number | null>('heartbeat:anthropic'),
    redis.get<string | number | null>('heartbeat:classifier'),
    supabaseAdmin
      .from('messages')
      .select('created_at')
      .eq('role', 'assistant')
      .not('stop_reason', 'like', 'deflection:%')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('alarms_fired')
      .select('id, condition, fired_at')
      .order('fired_at', { ascending: false })
      .limit(5),
  ]);

  const deps: DepRow[] = [
    { name: 'anthropic', status: anthropic },
    { name: 'classifier', status: classifier },
    { name: 'supabase', status: supabase },
    { name: 'upstash', status: upstash },
    { name: 'exa', status: exa },
  ];

  const heartbeats: Heartbeat[] = [
    {
      name: 'Anthropic cache',
      lastIso: hbAnthropic ? new Date(Number(hbAnthropic)).toISOString() : null,
    },
    {
      name: 'Classifier',
      lastIso: hbClassifier ? new Date(Number(hbClassifier)).toISOString() : null,
    },
  ];

  const lastSuccessfulTurnIso =
    (lastTurn.data as { created_at: string } | null)?.created_at ?? null;
  const alarmRows = (alarms.data ?? []) as AlarmRow[];

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Health</h1>
      <HealthGrid
        deps={deps}
        heartbeats={heartbeats}
        lastSuccessfulTurnIso={lastSuccessfulTurnIso}
        alarms={alarmRows}
        betterstackUrl={env.BETTERSTACK_DASHBOARD_URL ?? null}
      />
    </div>
  );
}
