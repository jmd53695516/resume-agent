// src/components/DisclaimerBanner.tsx
// Above-fold disclaimer per CONTEXT.md D-B-02 + PITFALLS.md Pitfall 1 defense
// (fabrication/legal-precedent defense starts with user expectations set before
// the first message). Small-but-visible; sits directly under the framing.
// Server Component — zero client JS.
export function DisclaimerBanner() {
  return (
    <div
      role="note"
      aria-label="agent disclosure"
      className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700"
    >
      <span className="font-medium">Heads up:</span> I&apos;m an AI agent grounded on Joe
      Dollinger&apos;s background, not Joe in real time. If you need a direct reply, email Joe and
      he&apos;ll get back to you.
    </div>
  );
}
