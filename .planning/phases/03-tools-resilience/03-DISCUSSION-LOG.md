# Phase 3: Tools & Resilience - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 03-tools-resilience
**Areas discussed:** Tool invocation flow, Resilience visibility (banner + fallback)
**Areas skipped (Claude's discretion):** Trace panel UX, Metric card visual design

---

## Gray-area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Tool invocation flow (Recommended) | How recruiters get from a starter button to a tool firing — affects all three tools. | ✓ |
| Trace panel "See what I did" UX | Prominence, default state, multi-tool aggregation. | |
| Metric card visual design | Density, sectioning, inline vs floating. | |
| Resilience visibility (banner + fallback) | Banner placement, fallback content depth, trigger model. | ✓ |

**Joe's choice:** Tool invocation flow + Resilience visibility. Trace panel and metric card go to Claude's discretion with sensible defaults captured in CONTEXT D-E-* and D-D-04.

---

## Tool invocation flow

### How should a recruiter get from clicking a starter button to a tool actually firing?

| Option | Description | Selected |
|--------|-------------|----------|
| Prefill + Sonnet decides (Recommended) | Keep current Phase 2 flow. Sonnet sees the message, decides to call the tool. Zero new UI; matches spec's "agent prompts for company name" pattern. | ✓ |
| Modal/dialog with structured fields | Button click opens a modal with structured fields. Submission directly invokes the tool. | |
| Sonnet asks one clarifying question | Button prefills, Sonnet replies with one short question if missing info, then calls tool. | |

**User's choice:** Prefill + Sonnet decides.
**Notes:** Cheapest path, zero new UI surface, lets Sonnet pass on tool calls when not warranted (TOOL anti-reflexive-chaining). Captured as D-A-01.

### When the recruiter wants a case-study walkthrough, how should Sonnet pick which one?

| Option | Description | Selected |
|--------|-------------|----------|
| Always show menu first (Recommended) | Sonnet replies with brief menu, recruiter picks, Sonnet calls get_case_study(slug). | ✓ |
| Auto-pick from conversation context | Sonnet picks based on prior signals; falls back to default if no signal. | |
| Hybrid: pick if confident, else menu | Tries to auto-pick, falls back to menu if confidence is low. | |

**User's choice:** Always show menu first.
**Notes:** Zero risk of narrating the wrong story; menu doubles as a "breadth signal." Matches TOOL-04's "unknown slug returns the menu" rule. Captured as D-C-02.

### How should tool-failure copy be authored (TOOL-11 graceful in-character fallback)?

| Option | Description | Selected |
|--------|-------------|----------|
| Joe-locked copy in CONTEXT.md (Recommended) | Joe writes one short fallback per tool, in voice. Hardcoded in route.ts. | ✓ (with refinement below) |
| Claude's discretion, drafted against voice.md | Claude generates fallback copy during planning, draws from voice.md. | |

**User's choice:** Joe-locked copy in CONTEXT.md.
**Refined to:** Claude drafts during execution using voice.md + stances.md as register source; Joe reviews/edits in PR. Same flow as Phase 2 D-C-01..07 deflection copy. Captured as D-H-01.

### When Sonnet shows the case-study menu, what format?

| Option | Description | Selected |
|--------|-------------|----------|
| Titles + one-line hook (Recommended) | "Cortex AI client win — first AI deal at a 30y consultancy" etc. | |
| Titles only | "Cortex AI client win, Snowflake EDW migration, …. Which one?" | ✓ |
| Sonnet picks 2-3, names them with reasons | Sonnet narrows the menu to 2-3 based on context. | |

**User's choice:** Titles only. (Override of recommended.)
**Notes:** Joe explicitly chose minimal menu signal over breadth-with-hooks. Captured as D-C-02.

### Failure copy authoring — who drafts the in-character tool-fallback strings?

| Option | Description | Selected |
|--------|-------------|----------|
| Claude drafts, Joe edits in PR (Recommended) | Same flow as Phase 2 deflection copy (D-C-01..07). | ✓ |
| Joe drafts now, Claude lands verbatim | Joe writes the three strings inline in CONTEXT.md right now. | |

**User's choice:** Claude drafts, Joe edits in PR.
**Notes:** voice.md is now populated (Phase 1 closed), giving Claude a real register to mirror. Captured as D-H-01.

### When Sonnet calls research_company, should it ever pass a website URL, or just the name?

| Option | Description | Selected |
|--------|-------------|----------|
| Name only by default (Recommended) | Sonnet calls with name; Exa figures out the canonical site. URL is escape hatch. | ✓ |
| Always require URL when provided | Sonnet asks for a URL if not given. | |
| Sonnet decides per-call | Trust Sonnet's judgment to ask only when ambiguous. | |

**User's choice:** Name only by default.
**Notes:** Simpler default, lets Exa do its job; URL stays as escape hatch for ambiguous names. Captured as D-B-02.

---

## Resilience visibility (banner + fallback)

### Where should the dependency-status banner appear when something is impaired (OBSV-11)?

| Option | Description | Selected |
|--------|-------------|----------|
| Framing page only (Recommended) | Banner shows only on `/`. Matches spec wording. | |
| Framing page + chat header | Banner persists on both pages. Catches recruiters who deep-link into `/chat`. | ✓ |
| Framing page + per-tool inline notice | Banner on framing only; inline per-tool notice in chat. | |

**User's choice:** Framing page + chat header. (Override of recommended.)
**Notes:** Joe explicitly opted to surface the banner on both pages — captures the deep-link case where a recruiter lands directly on `/chat`. Refined as D-F-01: framing-page banner is sticky non-dismissible (D-F-05); chat-page banner is dismissible per-session via sessionStorage.

### How rich should the plain-HTML fallback be (OBSV-12)?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal: bio + email CTA (Recommended) | 3-4 sentence bio, last 3 roles, links, big "Email Joe" CTA. | ✓ |
| Medium: bio + case-study summaries + CTA | Above plus case-study summaries from frontmatter. | |
| Rich: bio + full case studies + stances + CTA | Effectively a static portfolio site. | |

**User's choice:** Minimal: bio + email CTA.
**Notes:** Recruiter never leaves empty-handed; low maintenance; preserves "agent IS the artifact" positioning. Captured as D-G-01.

### What should trigger the plain-HTML fallback?

| Option | Description | Selected |
|--------|-------------|----------|
| /api/chat 500 + classifier-down (Recommended) | Two narrow triggers; other dep failures degrade in-place. | ✓ |
| /api/chat 500 only (strict) | Only show fallback on /api/chat 500. | |
| Any dependency-down trigger (loose) | Show fallback on any dep unhealthy. | |

**User's choice:** /api/chat 500 + classifier-down.
**Notes:** Narrow, predictable, eval-testable. A hard classifier outage shows the fallback (no message would get through anyway). Other dep failures (Exa, Supabase, Upstash) degrade via in-place tool fallback or deflection copy. Captured as D-G-04.

---

## Claude's Discretion (areas not explicitly discussed)

- **Trace panel UX** (CHAT-13) — defaulted to: subtle inline `<details>` block under each assistant message, collapsed by default, "See what I did" label, monospace args/response in small text. One block per tool call. Captured as D-E-01..05.
- **Metric card visual design** (TOOL-06) — defaulted to: single inline shadcn `<Card>` with section headers per schema field, Sonnet's commentary as streamed prose ABOVE the card. No tabs, no side panel. Captured as D-D-04.
- **Banner visual styling** — thin strip at top of viewport, soft yellow background. Dismissibility per D-F-05.
- **`/api/health` Anthropic-check strategy** — cost-vs-accuracy trade-off; planner picks per D-J-02.
- **`error.tsx` vs branched render for fallback** — Claude's discretion per D-G-02.
- **Search-provider final decision (Exa vs Brave)** — researcher pilots during planning; D-B-03 captures the deferral.
- **Pino integration ergonomics** — child loggers per route, request-scoped contextual loggers, etc.

## Deferred Ideas

(See CONTEXT.md `<deferred>` section for the full list — items explicitly rejected during this discussion include: dynamic per-recruiter auto-pick of case study, rich plain-HTML fallback with case studies, modal/dialog for tool input.)
