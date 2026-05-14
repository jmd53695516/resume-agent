# Phase 7 Plan 07-1A: Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `07-1A-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 07-add-test-yml-github-actions-workflow-for-determinism
**Sub-plan:** 07-1A (React-hooks lint debt resolution)
**Areas discussed:** Resolution strategy per category; Regression de-risking; Plan boundary & Task 3 absorption; Plan numbering convention

---

## Pre-Discussion Routing

| Option | Description | Selected |
|--------|-------------|----------|
| Scope the lint follow-up plan | Treat as discuss-phase for new 07-1A; original 07-CONTEXT untouched | ✓ |
| Amend existing 07-CONTEXT | Update existing 07-CONTEXT.md with new decisions section | |
| Just view existing CONTEXT | Display 07-CONTEXT.md and stop | |
| Skip — use existing as-is | Exit without changes | |

**Selected:** Scope the lint follow-up plan
**Notes:** Joe wanted a focused context for the new plan, not a whole-phase amendment. Original 07-CONTEXT remains the phase-wide truth.

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Resolution strategy per category | 4 sub-decisions across architectural categories | ✓ |
| Regression de-risking | Verification posture for shipped UI code | ✓ |
| Plan boundary & Task 3 absorption | Whether new plan absorbs deferred Task 3 from 07-01 | ✓ |
| Plan numbering convention | 07-1A vs 07-03 vs renumber | ✓ |

**Selected:** All four areas (multi-select).

---

## Resolution Strategy: Sub-Question 1 (Server-component `purity` — #1, #2)

| Option | Description | Selected |
|--------|-------------|----------|
| eslint-disable + rationale comment | `// eslint-disable-next-line react-hooks/purity` + comment per line; ~4 LOC | ✓ |
| Hoist to request-bound helper | Move `Date.now()` into separate helper file; ~6 LOC + indirection | |
| Hybrid — helper for purity, leave Server Components alone | Create helper + document pattern for future Server Components | |

**User's choice:** eslint-disable + rationale comment (recommended)
**Notes:** False-positive in Server Component context; helper would be over-engineering for a 1-line case.

---

## Resolution Strategy: Sub-Question 2 (Hydration boundary `setHydrated(true)` — #5, #7)

| Option | Description | Selected |
|--------|-------------|----------|
| useSyncExternalStore client-detection hook | Shared `useIsClient()` hook; both call sites collapse to one line; ~15 LOC net | ✓ |
| eslint-disable + rationale comment | Disable per call site with rationale; ~4 LOC; fights linter direction | |
| Render-conditional via Suspense or dynamic import | `next/dynamic({ssr:false})`; heavier refactor; breaks SSR for ChatStatusBanner | |

**User's choice:** useSyncExternalStore client-detection hook (recommended)
**Notes:** Aligns with React-team direction; clean shared abstraction.

---

## Resolution Strategy: Sub-Question 3 (Time formatting `setText(...)` — #3, #4)

| Option | Description | Selected |
|--------|-------------|----------|
| useSyncExternalStore for the formatted string | Refactor each component; ~10 LOC each; removes useState+useEffect pair | ✓ |
| Reuse useIsClient hook + render-time format | Compose with sub-Q2 hook; smaller diff but slightly less elegant | |
| eslint-disable + rationale comment | Disable on each setText line; same downside as fighting the linter | |

**User's choice:** useSyncExternalStore for the formatted string (recommended)
**Notes:** Natural fit for components that exist to defer locale-formatting to client.

---

## Resolution Strategy: Sub-Question 4 (Time-stamping in ChatUI.tsx:85 — #8)

| Option | Description | Selected |
|--------|-------------|----------|
| Move Date.now() capture to useChat callback | Hoist into `onChunk` (preferred) or `onFinish`; event-driven state; ~10–15 LOC | ✓ |
| eslint-disable + rationale comment | Disable on the line; loses architectural improvement; high-traffic file | |
| Move stamp into derived render-time fallback | Stamp at first render via Map ref; less precise; not recommended | |

**User's choice:** Move Date.now() capture to useChat callback (recommended)
**Notes:** This is the only violation that's a genuine architectural improvement, not just a label false-positive. Aligns with Plan 05.2-03 D-A-02-AMENDED ("stamped on status==='streaming' transition").

---

## Regression De-risking

| Option | Description | Selected |
|--------|-------------|----------|
| Existing test suite + manual smoke + Playwright cat6 | Trust 562 vitest + cat6 Playwright + Joe-driven dev smoke; no new tests | ✓ |
| Add targeted regression tests for changed components | +1–2h to lock behavior; may overlap with existing coverage | |
| Full live-prod smoke after merge | +5min Joe-time post-deploy walk; pairs with eval gate | |
| Option 1 + Option 3 (no extra tests, but Joe verifies prod) | Combine lowest-cost test with post-merge prod walk | |

**User's choice:** Existing test suite + manual smoke + Playwright cat6 (recommended)
**Notes:** Joe-time is the binding constraint; existing coverage is broad enough that signal-per-hour for new tests is low.

---

## Plan Boundary & Task 3 Absorption

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — absorb Task 3 into the new plan | Run clean-env pre-flight + capture sentinel-env-var list; hand to 07-02 | ✓ |
| No — push Task 3 into 07-02 | 07-02's workflow IS the gate; separate clean-env run is duplicative | |
| Split — cleanup does lint+tsc, 07-02 does build+sentinels | Split along natural fault lines | |

**User's choice:** Yes — absorb Task 3 into the new plan (recommended)
**Notes:** Logical home for "lint passes from clean env" proof. Keeps 07-02 focused purely on workflow + branch protection.

---

## Plan Numbering Convention

| Option | Description | Selected |
|--------|-------------|----------|
| 07-1A (decimal-pattern) | Files: 07-1A-PLAN.md etc.; matches 05.1/05.2 precedent at plan level | ✓ |
| 07-03 (sequential) | Files: 07-03-PLAN.md; relies on `requires:` frontmatter for dependency story | |
| 07-02 (renumber existing 07-02 → 07-03) | Linear ordering; rename-cascade friction | |

**User's choice:** 07-1A (recommended)
**Notes:** Communicates execution-order intent at a glance; no rename cascade.

---

## Claude's Discretion

The following decisions were left to the planner/executor within stated constraints:

- Order in which to fix the 9 violations (suggested: trivials → useIsClient + call sites → time-formatting → ChatUI hoist → server-purity disables).
- Exact signature and file location of `useIsClient()` hook (within `src/hooks/`).
- Whether to inline `useSyncExternalStore` snapshot functions or extract them per call site.
- Whether ChatUI timestamp hoist uses `onChunk` or `onFinish` (D-A-04 prefers `onChunk` for first-chunk arrival; `onFinish` acceptable if useChat v6 API doesn't surface onChunk cleanly).
- Trivial fix shapes (D-A-05): `_reset` rename vs disable; `let` → `const` for `totalCost`.

## Deferred Ideas

- Pre-emptive vitest regression tests for `useIsClient()` and ChatUI timestamp (D-B-02 deferred — only add if real regression surfaces).
- Refactor of `tests/**`, `scripts/**`, `evals/**` lint debt (stays in backlog 999.8 per parent Option B+E).
- Live-prod smoke walk after merge (D-B-03 deferred — surface signal-driven).
- Renaming 07-02 → 07-03 to insert as 07-02 (rejected per D-D-01).
