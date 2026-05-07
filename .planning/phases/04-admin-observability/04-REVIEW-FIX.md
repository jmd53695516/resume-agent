---
phase: 04-admin-observability
fixed_at: 2026-05-06T00:00:00Z
review_path: .planning/phases/04-admin-observability/04-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-05-06T00:00:00Z
**Source review:** `.planning/phases/04-admin-observability/04-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (0 critical + 6 warning; info findings out of scope)
- Fixed: 6
- Skipped: 0

All six warnings from REVIEW.md were applied and verified. Each fix was committed atomically and the full Vitest suite (`npm test`) was re-run after every fix. Baseline was 41 files / 328 tests; final state is 41 files / 330 tests (added two new heartbeat assertions covering WR-04). No prior tests required relaxation; the four test files that were touched all expanded or sharpened existing assertions.

## Fixed Issues

### WR-01: proxy.ts matcher pattern leaks `/admin/login*` paths past Layer 1

**Files modified:** `src/proxy.ts`, `tests/middleware/admin-perimeter.test.ts`
**Commit:** `b8d4911`
**Applied fix:** Anchored the negative lookahead with `(?:/|$)` so only the exact `/admin/login` segment is excluded from the proxy. Sibling paths like `/admin/loginx`, `/admin/login-foo`, and `/admin/login/anything` now pass through Layer 1 and require auth. Test `config.matcher` literal updated to match.

### WR-02: `findArchiveCandidates` can starve under one heavy session

**Files modified:** `src/lib/archive.ts`
**Commit:** `8a88d0f`
**Applied fix:** Added `.order('session_id', { ascending: true })` so the row budget walks across distinct sessions. A single session with thousands of >180d rows can no longer consume the entire `maxSessions * 100` row buffer, restoring the contract "up to N distinct session_ids." No migration required.

### WR-03: `buildAdminUrl` falls back to `http://localhost:3000` in production if env is incomplete

**Files modified:** `src/lib/env.ts`, `src/lib/email.ts`, `.env.example`
**Commit:** `dca2fda`
**Applied fix:**
- Added `NEXT_PUBLIC_SITE_URL` (`z.url().optional()`) and `VERCEL_URL` (`z.string().optional()`) to the Zod env schema so misconfiguration is at least visible.
- `buildAdminUrl` now reads through `env`, prefers `NEXT_PUBLIC_SITE_URL`, falls back to `https://${VERCEL_URL}`, and on missing-both logs a warn-level `admin_url_no_base` event and returns a relative `/admin/sessions/<id>` path rather than emitting a clickable localhost link.
- `.env.example` documents `NEXT_PUBLIC_SITE_URL` with a prod-required note.

### WR-04: heartbeat cron does not refresh `heartbeat:classifier`

**Files modified:** `src/app/api/cron/heartbeat/route.ts`, `tests/cron/heartbeat.test.ts`
**Commit:** `a199a15`
**Applied fix:**
- Added `redis.set('heartbeat:classifier', Date.now(), { ex: 120 })` after the parallel pings whenever `classifierPing.value === 'ok'`.
- Added a parallel `heartbeat:anthropic` refresh from the live ping when `HEARTBEAT_LLM_PREWARM=false` (so disabling prewarm doesn't blackhole the anthropic heartbeat).
- Both writes wrapped in try/catch with warn-level logging — a transient Redis blip will not fail the cron.
- Updated two existing tests to reflect the new behavior; added two new tests asserting (a) classifier key written on success, (b) classifier key skipped on ping failure. Test count: 6 → 8 in this file.

### WR-05: abuse page caps each query at 100 — silent drop on saturation

**Files modified:** `src/app/admin/(authed)/abuse/page.tsx`, `src/app/admin/components/AbuseTable.tsx`, `tests/admin/abuse-page.test.tsx`
**Commit:** `55fb136`
**Applied fix:**
- Widened per-query limit from 100 to 200 (still cheap given expected volume).
- Added `count: 'exact'` to both Supabase selects to get true server-side totals.
- Sum the two counts and clamp via `Math.max(flaggedTotal, merged.length)` so the footer never claims more rows than the user can scroll through; over-count on dual-match rows is acceptable for triage UX.
- Footer copy updated from "Showing last 100 flagged events." to "Showing last 100 of N flagged events."; test expectation updated.

### WR-06: `archiveSession` re-uploads to a drifting monthly path

**Files modified:** `src/lib/archive.ts`, `tests/lib/archive.test.ts`
**Commit:** `1fd1942`
**Applied fix:** Replaced `archive/<yyyy>/<mm>/<id>.jsonl.gz` with a stable canonical `archive/<id>.jsonl.gz` path. With `upsert: true`, re-runs in later months now overwrite in place rather than scattering snapshots across monthly prefixes. Header comment + test path-format assertion updated.

## Skipped Issues

None.

---

_Fixed: 2026-05-06T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
