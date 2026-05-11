---
created: 2026-05-11T00:31:23.198Z
title: Implement Chat Stream design from Anthropic design system
area: ui
files:
  - src/app/chat/page.tsx
  - src/components/ChatUI.tsx
  - src/components/MessageBubble.tsx
  - src/components/StarterPrompts.tsx
  - src/components/TracePanel.tsx
  - src/app/globals.css
---

## Problem

Anthropic provides a design file at:

https://api.anthropic.com/v1/design/h/EO1HCQjT2RGJ7Hvc2WWp5A?open_file=Chat+Stream.html

The bundle's `Chat Stream.html` is the streaming-chat UI reference design. Our current chat UI in `src/components/ChatUI.tsx` + `src/components/MessageBubble.tsx` was hand-built without a shared design system, and there is no documented visual spec. The recruiter-facing experience is the portfolio artifact, so the chat surface needs to look intentionally designed — not generic Tailwind defaults.

This todo captures the work to:

1. Fetch the design bundle from that URL.
2. Read the bundle's README to understand intent, tokens, components, and any framework/library expectations.
3. Identify which parts of `Chat Stream.html` are applicable to our stack (Next.js 16 App Router + Tailwind v4 + shadcn/ui + Vercel AI SDK `useChat`) — e.g. layout, type ramp, color tokens, bubble styling, streaming-cursor treatment, starter-prompt chips, trace-panel framing.
4. Implement those relevant aspects against our existing chat route at `src/app/chat/page.tsx` and supporting components, without regressing email gate, disclaimer banner, plain-HTML fallback, or any of the Phase-5 gates.

## Solution

TBD — exact scope depends on what the README says is "relevant."

Likely approach when picked up:

- Route through a GSD command (`/gsd-quick` if scope is tight, otherwise `/gsd-execute-phase` if this becomes its own phase under the active milestone).
- Invoke the `frontend-design` skill before writing CSS/components — this is creative UI work and the skill is the gate.
- Use `WebFetch` against the design URL with a prompt that asks for: README contents, file list, design tokens (colors, spacing, radii, font stacks), and a description of the Chat Stream layout. Then fetch `Chat+Stream.html` directly if the WebFetch result is too summarized.
- Map design tokens into `src/app/globals.css` via Tailwind v4's `@theme` directive (CSS-first config — do NOT introduce a `tailwind.config.js`).
- Keep `useChat` wiring + `cache_control: ephemeral` flow untouched; design changes are visual-only.
- Verify with `npx tsc --noEmit` + `npm run build` before claiming done (per the local-vs-Vercel-build feedback memory).

Open questions to resolve at execute-time:

- Does the bundle ship its own component code (HTML/CSS), or just visual reference? That changes whether we port code or re-implement against shadcn primitives.
- Light-mode only, or dark-mode parity? Our current UI is light-first.
- Any animations / streaming-cursor behavior worth porting, or does our AI SDK SSE rendering already cover that?
