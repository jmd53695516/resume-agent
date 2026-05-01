// src/app/page.tsx
// Landing page per GATE-01, GATE-05. Server Component — zero JS for framing
// and disclaimer; EmailGate adds the minimum client bundle.
// Layout: FramingCopy -> DisclaimerBanner -> EmailGate, in that order, all
// above-fold at 1280x800 (verified during checkpoint).
import { Card } from '@/components/ui/card';
import { DisclaimerBanner } from '@/components/DisclaimerBanner';
import { EmailGate } from '@/components/EmailGate';
import { FramingCopy } from '@/components/FramingCopy';

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 items-start px-6 py-12">
      <Card className="w-full space-y-2 rounded-[28px] border border-[var(--hairline)] bg-[var(--panel)] p-8 shadow-[0_30px_60px_-20px_rgba(15,15,20,0.18),0_12px_30px_-12px_rgba(15,15,20,0.10)] dark:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)]">
        <FramingCopy />
        <DisclaimerBanner />
        <EmailGate />
      </Card>
    </main>
  );
}
