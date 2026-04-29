// src/components/FramingCopy.tsx
// Landing-page framing per GATE-01 + GATE-05 + CONTEXT.md D-B-03.
// Register: engineered professional, warm but unsentimental — CONTEXT.md
// specifics: "Joe on LinkedIn being honest with a trusted former coworker".
// Names the three tool capabilities so "what you can do here" is concrete
// (satisfies GATE-01 "three tools" without icon buttons — those land in Phase 2
// per CHAT-14). Also mentions Joe-gets-notified (D-B-05) so recruiters aren't
// surprised later. No banned vocabulary; no emoji; no exclamation fanfare.
// Server Component.
export function FramingCopy() {
  return (
    <div className="space-y-3 text-slate-800">
      <h1 className="text-2xl font-semibold text-slate-900">
        Chat with Joe Dollinger&apos;s agent
      </h1>
      <p className="text-base leading-relaxed">
        I&apos;m an agent built on Joe&apos;s background — roles, projects, decisions, voice — so
        you can get specific answers about how he thinks and what he&apos;s done without waiting for
        a calendar slot. Ask about a project, have me tailor a pitch for your company, walk through
        a case study, or draft a metric framework for a feature you&apos;re sizing up.
      </p>
      <p className="text-sm text-slate-600">
        Drop your email to start. Joe will see a note that you stopped by, so if there&apos;s a role
        you think fits, leave it in the chat and he&apos;ll follow up directly.
      </p>
    </div>
  );
}
