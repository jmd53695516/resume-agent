---
phase: 03-tools-resilience
fixed_at: 2026-05-06T02:36:18Z
review_path: .planning/phases/03-tools-resilience/03-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-05-06T02:36:18Z
**Source review:** .planning/phases/03-tools-resilience/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (WR-01..WR-06; Info findings excluded by `fix_scope: critical_warning`)
- Fixed: 6
- Skipped: 0
- Final test suite: **220 passed (27 files)** — baseline of 218 + 2 new WR-05 regression-guard tests
- Final `tsc --noEmit`: clean

## Fixed Issues

### WR-01: Server Component self-fetches own `/api/health` route

**Files modified:** `src/lib/fetch-health.ts`, `tests/components/StatusBanner.test.tsx`
**Commit:** 222e86a
**Applied fix:** Replaced the HTTP self-fetch in `fetchHealth()` with direct in-process calls to the five `ping*` helpers from `src/lib/health.ts`, wrapped in `next/cache.unstable_cache(['health-status'], { revalidate: 30 })` to preserve the 30s revalidate behavior. Confirmed `src/app/page.tsx` does NOT use `force-dynamic`, so `unstable_cache` is the correct caching primitive. Removed the `headers()` import (no longer needed). The `/api/health` route still exists for external monitors and the Phase 4 admin widget.

Side effect: the new fetch-health.ts transitively imports `supabase-server` → `env`, which broke `tests/components/StatusBanner.test.tsx` (which imports `STATUS_COPY` from `StatusBanner.tsx` → `fetch-health.ts`). Added a `vi.mock('@/lib/env', …)` block matching the pattern already used in `tests/lib/health.test.ts`.

### WR-02: `console.error` used in deflection-path catches instead of Pino `log()`

**Files modified:** `src/app/api/chat/route.ts`, `src/lib/persistence.ts`
**Commit:** 773c8a6
**Applied fix:** Replaced all 8 `console.error(...)` call sites in `route.ts` (turncap, spendcap, ratelimit, borderline, verdict-label deflection, heartbeat write, onFinish persistence, onError) and the 3 sites in `persistence.ts` (`persistNormalTurn`, `persistDeflectionTurn`, `persistToolCallTurn`) with structured `log({ event: 'persistence_failed' | 'heartbeat_write_failed' | 'streamText_error', where, error_class, error_message, session_id }, 'error')` calls. Added `import { log } from './logger'` to `persistence.ts`. Fixed the AI SDK `onError` parameter shape (`{ error: unknown }`) — previous draft cast directly to `Error`, which TS rejected; revised to `instanceof Error` narrowing.

### WR-03: `enforceToolCallDepthCap` uses `any` to walk steps

**Files modified:** `src/lib/tools/depth-cap.ts`
**Commit:** 7aa4eb7
**Applied fix:** Replaced `PrepareStepFunction<any>` and `(s: any) => s.toolCalls ?? []` with a structural `StepWithToolCalls` type alias. Initially tried `PrepareStepFunction<ToolSet>` per the REVIEW snippet, but the AI SDK's `streamText` infers the specific tool record (research_company, get_case_study, design_metric_framework) and a `ToolSet` (Record<string, …>) signature is too narrow at the call site — `tsc` rejected it. Switched to a regular `async function` declaration with a custom `DepthCapInput = { steps: ReadonlyArray<unknown> }` parameter type. The function still type-checks at the call site via duck-typing while eliminating all `any` from the depth-cap logic itself. Added the runtime shape-regression guard from the REVIEW snippet: when `flatCalls.length === 0 && steps.length > 0`, log `{ event: 'depth_cap_shape_warning', step_count }` so an SDK shape change produces a noisy log line instead of a silent SAFE-15 bypass. All 9 existing depth-cap tests still pass against the new structural type.

### WR-04: `ChatStatusBanner` does not handle `sessionStorage` access exceptions

**Files modified:** `src/components/ChatStatusBanner.tsx`
**Commit:** 71a0610
**Applied fix:** Wrapped both `sessionStorage.getItem(DISMISS_KEY)` (in the hydration `useEffect`) and `sessionStorage.setItem(DISMISS_KEY, '1')` (in the dismiss `onClick`) in `try { … } catch { /* swallow */ }` blocks per the REVIEW snippet. Documents the failure modes (Safari Private Browsing, iOS Lockdown Mode, quota-exceeded) and explains why it matters: without the guard, a thrown SecurityError inside the effect would trip the nearest error boundary (`app/error.tsx` → PlainHtmlFallback) on `/chat`, sending iOS Private Mode recruiters to the fallback page just by visiting `/chat` while a banner is showing.

### WR-05: `extractLastNRoles` company-name split fails on em-dash + hyphen mix

**Files modified:** `scripts/generate-fallback.ts`, `tests/scripts/generate-fallback.test.ts`
**Commit:** 158543a
**Applied fix:** Tightened the company-name split regex from `/\s+[—–-]\s+/` (em-dash, en-dash, OR hyphen) to `/\s+[—–]\s+/` (em-dash, en-dash only). Confirmed all four `### Company — Location` headings in `kb/resume.md` use em-dashes (no hyphen separators), so the change is fully backward-compatible with the canonical resume format. Added two new regression-guard tests (`extractLastNRoles — hyphen-in-company-name (WR-05 regression guard)` describe block) covering hyphenated company names with em-dash separator and en-dash separator. Test count went from 7 → 9 in `generate-fallback.test.ts` (218 → 220 overall).

### WR-06: Direct-invocation guard on `generate-fallback.ts` may miss script renames

**Files modified:** `scripts/generate-fallback.ts`
**Commit:** 3472be8
**Applied fix:** Replaced the regex fallback (`/generate-fallback\.ts$/.test(process.argv[1])`) with the Node-recommended self-detection idiom `import.meta.url === pathToFileURL(process.argv[1]).href`. Added `import { pathToFileURL } from 'node:url'`. The new pattern survives script renames because the comparison is filename-agnostic. Wrapped in a try/catch that returns `false` on failure, so any platform-specific edge case (e.g., argv[1] is a non-path) silently falls back to the env-flag guard. Kept the `GENERATE_FALLBACK_RUN === '1'` env flag as the canonical entry point for the prebuild hook. Verified with `npm run prebuild` that direct-invocation still triggers `main()` correctly and the smoke test in `generate-fallback.test.ts` (which `execSync`'s `npx tsx scripts/generate-fallback.ts`) still passes.

## Skipped Issues

None — all 6 in-scope findings (WR-01 through WR-06) were successfully fixed.

---

_Fixed: 2026-05-06T02:36:18Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
