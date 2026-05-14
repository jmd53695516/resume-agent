# Phase 7 Plan 07-1A: React-hooks lint debt resolution - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning
**Parent phase context:** `07-CONTEXT.md` (untouched — this file scopes a single follow-up sub-plan)

<domain>
## Plan Boundary

Resolve the 9 pre-existing `eslint` violations in `src/` exposed by `eslint-plugin-react-hooks@6` (shipped with `eslint-config-next@16.2.4`) so that `npm run lint` exits 0 from a clean-env shell. Then execute the deferred Task 3 from 07-01 (clean-env pre-flight: `npm test && npx tsc --noEmit && npm run lint && npm run build` exits 0 from a zero-secrets shell) and capture the empirical sentinel-env-var list as a handoff for 07-02.

**This plan is NOT:**
- The `.github/workflows/test.yml` workflow file (Plan 07-02).
- Branch protection wiring (Plan 07-02; sequence per parent D-C-04).
- Cleanup of `tests/**`, `scripts/**`, `evals/**` lint debt (deferred to backlog 999.8 per parent Option B+E).
- Resolving the chat-six-gate-order parallel-execution flake (Plan 05.2 deferred — already CI-quarantined in 07-01 Task 2).

**Why this plan exists:**
07-01 Task 3 (clean-env pre-flight) hit a Rule 4 architectural checkpoint when `eslint-plugin-react-hooks@6` flagged 9 pre-existing patterns (5 `set-state-in-effect`, 2 `purity`, 2 trivial). Joe selected Option F (defer + split) — auto-fixing under 07-01 would have silently expanded a config-only plan into a hydration/effect-pattern refactor of 7 production components. This plan is that refactor done deliberately.

</domain>

<decisions>
## Implementation Decisions

### Resolution Strategy Per Violation Category (D-A)

The 9 violations cluster into 4 architectural categories + 2 trivial. Per-category strategy:

- **D-A-01 (Server-component `purity` — #1, #2):** Targeted `// eslint-disable-next-line react-hooks/purity` above each line with a rationale comment ("Server Component — `Date.now()` in render is correct, runs once per request"). Applies to:
  - `src/app/admin/(authed)/abuse/page.tsx:25`
  - `src/app/admin/(authed)/evals/calibrate/page.tsx:55`
  - **Why:** The rule is a false positive in Server Component context (no hydration, no re-render). Refactor to a request-bound helper would be ~6 LOC of indirection for 1-line cases. Disable + comment is honest about the limitation.

- **D-A-02 (Hydration boundary `setHydrated(true)` — #5, #7):** Replace `useState(false) + useEffect(() => setHydrated(true), [])` with a shared `useIsClient()` hook backed by `useSyncExternalStore`. Hook lives at `src/hooks/use-is-client.ts`. Both call sites collapse to `const isClient = useIsClient();`. Applies to:
  - `src/app/chat/page.tsx:45`
  - `src/components/ChatStatusBanner.tsx:17`
  - **Why:** React 18+ idiomatic; the new lint rule is a deliberate React-team push toward `useSyncExternalStore` for client-detection. Aligns with current direction; ~15 LOC net (helper + 2 simplified call sites).

- **D-A-03 (Client-side time formatting `setText(...)` — #3, #4):** Refactor each component to compute the formatted string via `useSyncExternalStore` with the formatter as the snapshot function; server snapshot returns the raw ISO. Same idiom as D-A-02. Applies to:
  - `src/app/admin/components/LocalTime.tsx:20`
  - `src/app/admin/components/RelativeTime.tsx:25`
  - **Why:** These components exist specifically to defer locale-formatting to client. `useSyncExternalStore` is the natural shape for that — server snapshot ≠ client snapshot is exactly what the API models. Removes the `useState + useEffect` pair entirely.

- **D-A-04 (Time-stamping `setAssistantTimestamps(...)` in effect — #8):** Move `Date.now()` capture from the post-stream `useEffect` into a `useChat` callback (preferred: `onChunk` for first-chunk arrival; acceptable: `onFinish` for stream-end stamping if onChunk semantics don't match Plan 05.2-03 D-A-02-AMENDED intent). Removes the effect-then-state-then-render cycle in favor of event-driven state. Applies to:
  - `src/components/ChatUI.tsx:85`
  - **Why:** This is the only violation that's a genuine architectural improvement, not just a label false-positive. Effect-driven timestamping is fragile to React 19 strict-mode double-invocation; event-driven is precise. Aligns with Plan 05.2-03 Decision: "stamped on status==='streaming' transition (D-A-02-AMENDED)."

- **D-A-05 (Trivials — #6, #9):** Claude's discretion — fix the most direct way:
  - `src/app/error.tsx:16` (unused `_reset`): rename or remove the underscore-prefixed param per Next.js convention. If keeping for future use, add `// eslint-disable-next-line @typescript-eslint/no-unused-vars` with a 1-line rationale.
  - `src/lib/eval/cats/cat2.ts:176` (`prefer-const`): `let totalCost` → `const totalCost`. One character.

### Regression De-risking (D-B)

- **D-B-01:** Verification posture is **lowest-cost / highest-signal-per-hour**:
  - Trust existing 562-test vitest suite (covers `MessageBubble`, `ChatUI`, `ChatStatusBanner`, `LocalTime`, `RelativeTime`, etc.).
  - Run existing Playwright cat6 specs (`chat-happy-path.spec.ts`, `cat-06-view-toggle.spec.ts`) before close-out.
  - Joe-driven manual dev smoke: chat send + matrix toggle + admin pages render (LocalTime/RelativeTime visible, abuse + evals/calibrate load).
  - Plan acceptance MUST include all four pre-flight commands exit 0 (`npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`) — memory `feedback_local_vs_vercel_build` codified.
- **D-B-02:** No new vitest regression tests added in this plan. If a real regression surfaces during D-B-01 verification, file as a deviation (not pre-emptive coverage).
- **D-B-03:** No live-prod walk required (Joe-time is the binding constraint). If a regression escapes to prod, it surfaces in next eval gate run or on first user contact — both acceptable for the agent's current usage shape.

### Plan Boundary & Task 3 Absorption (D-C)

- **D-C-01:** This plan absorbs Task 3 from 07-01 (clean-env pre-flight verification). After fixing the 9 violations, run `npm test && npx tsc --noEmit && npm run lint && npm run build` from a zero-secrets shell. Capture which `process.env.*` reads at module-init time need sentinel/dummy values for the build to succeed.
- **D-C-02:** Sentinel-env-var list is handed to 07-02 in this plan's SUMMARY (handoff section, mirroring 07-01's deferred-task handoff). 07-02 uses that list to author test.yml's `env:` block.
- **D-C-03:** This plan does NOT touch `.github/workflows/`. Plan 07-02 owns workflow file + branch protection (sequenced per parent D-C-04).

### Plan Numbering Convention (D-D)

- **D-D-01:** New plan is numbered **07-1A** (decimal-pattern at the plan level). Files: `07-1A-PLAN.md`, `07-1A-SUMMARY.md`, etc. Matches the 05.1 / 05.2 decimal-phase precedent applied at the plan level — communicates "inserted between 01 and 02" execution-order intent at a glance.
- **D-D-02:** ROADMAP.md Phase 7 plans block must be updated to insert `- [ ] 07-1A-PLAN.md` between existing `- [x] 07-01-PLAN.md` and `- [ ] 07-02-PLAN.md`. Plan 07-02 retains its name (no renumbering cascade).

### Claude's Discretion

- Order in which to fix the 9 violations (suggested: trivials first as warmup, then `useIsClient` hook + its 2 call sites, then time-formatting components, then ChatUI timestamp hoist, then 2 server-purity disables — but planner can re-shape).
- Exact signature of `useIsClient()` hook (return type, file location, naming) within the constraints of D-A-02.
- Whether to inline the `useSyncExternalStore` snapshot functions or extract them per call site — refactor scope decision left to planner.
- Whether ChatUI timestamp hoist uses `onChunk` or `onFinish` (D-A-04 stated preference is `onChunk` for first-chunk arrival, but if useChat v6 API doesn't surface that cleanly, `onFinish` is acceptable).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Parent context (read first)
- `.planning/phases/07-add-test-yml-github-actions-workflow-for-determinism/07-CONTEXT.md` — Phase-wide decisions (D-A test scope, D-B zero-secrets posture, D-C branch protection sequence). All carry forward.

### 07-01 SUMMARY (the handoff that motivated this plan)
- `.planning/phases/07-add-test-yml-github-actions-workflow-for-determinism/07-01-SUMMARY.md` — Full violations table (9 entries with file:line, severity, rule, pattern), fix-strategy hints (informational), explicit handoff section with sentinel-env-var deferral note.

### Files being modified (the 9 violations)
- `src/app/admin/(authed)/abuse/page.tsx:25` — Server-component purity (D-A-01 disable)
- `src/app/admin/(authed)/evals/calibrate/page.tsx:55` — Server-component purity (D-A-01 disable)
- `src/app/admin/components/LocalTime.tsx:20` — Time formatting (D-A-03 useSyncExternalStore)
- `src/app/admin/components/RelativeTime.tsx:25` — Time formatting (D-A-03 useSyncExternalStore)
- `src/app/chat/page.tsx:45` — Hydration boundary (D-A-02 useIsClient)
- `src/app/error.tsx:16` — Unused `_reset` (D-A-05 trivial)
- `src/components/ChatStatusBanner.tsx:17` — Hydration boundary (D-A-02 useIsClient)
- `src/components/ChatUI.tsx:85` — Time-stamping (D-A-04 onChunk hoist)
- `src/lib/eval/cats/cat2.ts:176` — `prefer-const` (D-A-05 trivial)

### Files being created
- `src/hooks/use-is-client.ts` — Shared client-detection hook backed by `useSyncExternalStore` (D-A-02). New file; planner picks final path within `src/hooks/`.

### Tests that must remain green
- `tests/**/*.test.{ts,tsx}` — Full vitest scope (~562 tests). MessageBubble, ChatUI, ChatStatusBanner, time-component coverage already exists.
- `tests/e2e/chat-happy-path.spec.ts` (Playwright cat6) — view toggle + chat send.
- `tests/e2e/cat-06-view-toggle.spec.ts` (Playwright cat6) — matrix-mode body class lifecycle.
- `tests/lib/system-prompt.test.ts` — 17 SAFE-11 determinism tests (orthogonal to this plan but must stay green).

### Memory-rooted constraints (carry from parent)
- Memory `feedback_local_vs_vercel_build` — `npx tsc --noEmit + npm run build` are non-optional in plan acceptance (D-B-01).
- Memory `project_spend_cap_incident_2026-05-12` — informs D-C clean-env zero-secrets posture (no API keys in this plan's verification shell).

### Plan 05.2 prior decisions (referenced by D-A-04)
- `.planning/phases/05.2-implement-chat-stream-design-from-anthropic-design-system/05.2-03-PLAN.md` — D-A-02-AMENDED ("stamped on status==='streaming' transition") is the design intent that D-A-04 honors with the onChunk hoist.

### useChat v6 API (planner check before final ChatUI shape)
- `node_modules/@ai-sdk/react/dist/*.d.ts` (or context7 lookup) — verify `onChunk` vs `onFinish` callback signatures for Plan's 05.2 useChat usage in `src/components/ChatUI.tsx`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useSyncExternalStore` is a core React API (no install needed). Used pattern: `useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)`.
- `src/components/ChatUI.tsx` already uses `useChat()` from `@ai-sdk/react` with typed `<ResumeAgentUIMessage>` — adding `onChunk` callback follows existing import/typing patterns.
- Plan 05.2-03 already established `assistantTimestamps` Record<id, epochMs> shape and `metaView` adapter — D-A-04 only changes when the record gets stamped, not the shape.

### Established Patterns
- Hooks live at `src/hooks/` (per Plan 03-04 `src/hooks/` layer; planner can confirm).
- Defense-in-depth comments on lint disables — see Plan 02 D-I-07 markdown-strip pattern as precedent for "explicit rationale on suppression."
- vitest + jsdom env per-file directive (`// @vitest-environment jsdom`) — Plan 03-04 W3 pattern; useIsClient hook tests will need this.

### Integration Points
- `src/app/chat/page.tsx` — view-state lift from Plan 05.2-04; hydration check is gating matrix-mode body class. Replacing `useState(false) + useEffect(setHydrated)` with `useIsClient()` must preserve the SSR→client transition timing exactly.
- `src/components/ChatStatusBanner.tsx` — Plan 03-04 W3+W7 patterns; testing setup is in place.
- `src/app/admin/components/LocalTime.tsx` + `RelativeTime.tsx` — admin chrome; visible across multiple admin pages (abuse, evals, evals/calibrate). Refactor must preserve `suppressHydrationWarning` behavior.
- `src/components/ChatUI.tsx` line 85 area — `useEffect` watching status; carefully verify `useChat` v6 onChunk fires before `status === 'streaming'` transitions reach the existing effect (or relocate other effect logic).

</code_context>

<specifics>
## Specific Ideas

- `useIsClient()` hook signature: `function useIsClient(): boolean` returning `useSyncExternalStore(() => () => {}, () => true, () => false)`. Subscribe is no-op (no external state to subscribe to); client-snapshot is constant `true`; server-snapshot is constant `false`. Standard React community pattern.
- For server-component purity disables (D-A-01), the rationale comment SHOULD name the constraint, e.g.:
  ```
  // eslint-disable-next-line react-hooks/purity
  // Server Component — Date.now() in render is correct (runs once per request).
  ```
- ChatUI timestamp hoist (D-A-04) preserves the existing `assistantTimestamps[id] = Date.now()` shape; only the firing edge moves from "post-stream useEffect" to "first chunk callback." Plan 05.2-03 timestamp-divider rendering must remain byte-identical for the same chat session.

</specifics>

<deferred>
## Deferred Ideas

- Pre-emptive vitest regression tests for `useIsClient()` and ChatUI timestamp behavior. D-B-02 explicitly defers — only add if a real regression surfaces during verification.
- Refactor of `tests/**`, `scripts/**`, `evals/**` lint debt (78 errors + 41 warnings). Stays in backlog 999.8 per parent Option B+E.
- Live-prod smoke walk after merge. D-B-03 deferred — surface signal-driven, not pre-emptive.
- Renaming existing 07-02 to 07-03 to insert this plan as 07-02 (option discussed; rejected per D-D-01).

</deferred>

---

*Phase: 07-add-test-yml-github-actions-workflow-for-determinism*
*Plan: 07-1A (lint debt follow-up between 07-01 and 07-02)*
*Context gathered: 2026-05-13*
