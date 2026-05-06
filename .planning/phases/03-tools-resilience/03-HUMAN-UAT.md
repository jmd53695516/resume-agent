---
status: partial
phase: 03-tools-resilience
source: [03-VERIFICATION.md]
started: 2026-05-06T02:45:00Z
updated: 2026-05-06T02:45:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live Exa call observable in DevTools when triggering research_company
expected: DevTools Network tab shows /api/chat POST streaming a tool_call/tool_result for research_company; no mock; result includes <90d source URLs
why_human: Requires real EXA_API_KEY in .env.local + a live npm run dev session + DevTools observation; cannot be programmatically verified from static code
result: [pending]

### 2. Pitch tool produces 3-paragraph tailored output with live clickable source URLs
expected: Sonnet weaves Exa results into 3 paragraphs (observation / connection / first-problem-I'd-dig-into) with clickable URL footer rendered in MessageBubble
why_human: Output prose shape is model-dependent and visual; needs human eval (Phase 5 Cat 6 candidate)
result: [pending]

### 3. Walkthrough narration is ~400 words, first-person, ends with "Want to go deeper, or hear a different story?"
expected: Sonnet narrates from get_case_study record producing first-person ~400-word narration with the closing line
why_human: Word count + closing-line adherence are prose-shape concerns; the system prompt instructs the behavior but only live invocation confirms
result: [pending]

### 4. MetricCard renders inline above TracePanel with Sonnet commentary stream
expected: When recruiter triggers design_metric_framework, MetricCard appears with six labeled sections, Sonnet's commentary streams above, TracePanel collapsed below
why_human: Visual rendering + live streaming order verified against MessageBubble dispatcher; unit tests assert DOM order, but real-stream integration is human-eval
result: [pending]

### 5. Trace panel collapse/expand UX with chevron
expected: Default collapsed; click chevron expands; args + response JSON visible in monospace; subtle low-contrast styling per D-E-05
why_human: jsdom <details> open/closed state has known quirks; visual assertion of design tokens is human
result: [pending]

### 6. Yellow status banner copy renders on real degraded state
expected: When Anthropic/classifier heartbeat absent (>120s) the framing banner renders "Chat may be slow right now — Anthropic is having a moment."; banner disappears on all-green
why_human: Requires full-stack integration with live Redis state; StatusBanner SC was intentionally not unit-tested (depends on Next request context)
result: [pending]

### 7. Plain-HTML fallback renders on /?fallback=1 with mailto CTA + 3 roles + LinkedIn/GitHub
expected: Visit /?fallback=1 → PlainHtmlFallback rendered, no email gate, no banner, no Card; mailto:joe.dollinger@gmail.com clickable
why_human: Full-page rendering pass + test that recruiter actually has a working email path
result: [pending]

### 8. ChatUI redirect to /?fallback=1 after 2 consecutive /api/chat 500s
expected: Force two consecutive 500s → router.push fires → URL becomes /?fallback=1 → page.tsx renders PlainHtmlFallback
why_human: Unit tests assert callback invocation + push target; full-stack 500-induction is best done via Phase 5 Playwright
result: [pending]

### 9. Resume PDF link /joe-dollinger-resume.pdf
expected: Phase 5 LAUNCH-* will drop the PDF in public/; currently 404 (acknowledged in 03-05-SUMMARY)
why_human: Joe to drop PDF before public deploy; currently flagged as expected 404, graceful failure mode
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps
