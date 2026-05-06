// src/app/page.tsx
// Landing page per GATE-01, GATE-05. Server Component — zero JS for framing
// and disclaimer; EmailGate adds the minimum client bundle.
// Layout: StatusBanner (sticky, framing variant) -> FramingCopy ->
// DisclaimerBanner -> EmailGate, all above-fold at 1280x800.
// Plan 03-04 D-F-01: StatusBanner mounted on both / and /chat.
//
// Plan 03-05 OBSV-12 / D-G-04 — branched render to PlainHtmlFallback when:
//   1. ?fallback=1 query param is present (ChatUI redirects here on
//      persistent /api/chat 500s — that redirect logic lives in Plan 03-03).
//   2. health.classifier === 'down' — no message would get through anyway,
//      so the agent UX would be broken; recruiter lands on the safety net.
// All other dep failures degrade in-place via tool fallback (Plan 03-01) or
// banner deflection (Plan 03-04). error.tsx is the third belt-and-suspenders
// for any uncaught render-time exception.
import { Card } from '@/components/ui/card';
import { DisclaimerBanner } from '@/components/DisclaimerBanner';
import { EmailGate } from '@/components/EmailGate';
import { FramingCopy } from '@/components/FramingCopy';
import { StatusBanner } from '@/components/StatusBanner';
import { PlainHtmlFallback } from '@/components/PlainHtmlFallback';
import { fetchHealth } from '@/lib/fetch-health';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const fallbackParam = params.fallback === '1';

  // D-G-04 trigger 2: classifier hard-down → fallback regardless of query
  // param. Skip the live fetch when we already know we're going to fallback.
  const health = fallbackParam ? null : await fetchHealth();
  if (fallbackParam || health?.classifier === 'down') {
    return <PlainHtmlFallback />;
  }

  return (
    <>
      <StatusBanner page="framing" />
      <main className="mx-auto flex w-full max-w-2xl flex-1 items-start px-6 py-12">
        <Card className="w-full space-y-2 rounded-[28px] border border-[var(--hairline)] bg-[var(--panel)] p-8 shadow-[0_30px_60px_-20px_rgba(15,15,20,0.18),0_12px_30px_-12px_rgba(15,15,20,0.10)] dark:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)]">
          <FramingCopy />
          <DisclaimerBanner />
          <EmailGate />
        </Card>
      </main>
    </>
  );
}
