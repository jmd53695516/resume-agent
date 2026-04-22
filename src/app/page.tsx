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
      <Card className="w-full space-y-2 p-8">
        <FramingCopy />
        <DisclaimerBanner />
        <EmailGate />
      </Card>
    </main>
  );
}
