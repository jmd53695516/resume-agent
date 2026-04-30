---
phase: 02-safe-chat-core
plan: 04
subsystem: auth
tags: [turnstile, captcha, abuse-controls, feature-flag, cloudflare, react, next.js]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: EmailGate.tsx (Plan 01-03), /api/session route (Plan 01-03), pre-commit secret-scan hook (Plan 01-01)
provides:
  - Cloudflare Turnstile wired through EmailGate + /api/session, feature-flagged OFF by default
  - Server-side siteverify helper with fail-closed network error handling
  - 5-case unit test for the Turnstile preflight (turnstile_misconfigured / turnstile_missing / turnstile_failed / skip / pass)
  - Documented enable path in .env.example (3 env vars + Cloudflare test keys)
affects: [phase-05-launch (post-launch abuse decision), admin-dashboard (Turnstile failure metrics)]

# Tech tracking
tech-stack:
  added:
    - "@marsidev/react-turnstile@1.5.1 (React wrapper for Cloudflare Turnstile)"
  patterns:
    - "Feature flag via NEXT_PUBLIC_* env var inlined at build time; conditional tree-shakes when off"
    - "Fail-closed network error handling on third-party verify endpoints (Cloudflare outage cannot bypass gate)"
    - "process.env read at call time (not module scope) inside route handlers so test suites can toggle flags per-test"
    - "Pre-commit secret-scan-friendly env var naming (NEXT_PUBLIC_TURNSTILE_SITE_ID, TURNSTILE_SECRET_KEY) — neither matches pattern NEXT_PUBLIC_[A-Z_]*(KEY|SECRET|TOKEN|PASSWORD|PASS)"

key-files:
  created:
    - tests/api/session-turnstile.test.ts
  modified:
    - package.json
    - package-lock.json
    - src/components/EmailGate.tsx
    - src/app/api/session/route.ts
    - .env.example

key-decisions:
  - "Used latest stable @marsidev/react-turnstile@1.5.1 (research locked 1.5.0 — patch bump only, semver-safe)"
  - "Read process.env at call time inside POST /api/session so vitest's per-test env mutation works without vi.resetModules ceremony"
  - "Fail-closed on Cloudflare network error / non-200: returns success=false with error code; outage cannot bypass the gate"
  - "Send remoteip to siteverify when available (defense-in-depth — Cloudflare can correlate token to IP)"
  - "Mocked @/lib/supabase-server in unit tests so the success-path test deterministically returns 200 with no real DB connection needed"
  - "Added Cloudflare always-pass test keys (1x000...AA) to .env.example for local rendering verification — saves Joe a doc lookup at flip-on time"

patterns-established:
  - "Conditional client-side render via module-scope process.env constant (tree-shakes the dead branch when flag is off)"
  - "Hermetic API route tests via vi.mock of supabase-server + globalThis.fetch override; no real network or DB hits"

requirements-completed:
  - SAFE-13

# Metrics
duration: 8min
completed: 2026-04-30
---

# Phase 02 Plan 04: Turnstile Wired But Off Summary

**Cloudflare Turnstile wired through EmailGate and /api/session via @marsidev/react-turnstile@1.5.1, feature-flagged OFF by default — flippable in under 10 minutes by setting three env vars and restarting.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-30T00:42:20Z
- **Completed:** 2026-04-30T00:50:06Z
- **Tasks:** 5
- **Files modified:** 5 (1 created, 4 edited)

## Accomplishments

- `@marsidev/react-turnstile@1.5.1` installed as runtime dep; typecheck clean.
- `EmailGate.tsx` conditionally renders the Turnstile widget below the email input when `NEXT_PUBLIC_TURNSTILE_ENABLED='true'` AND `NEXT_PUBLIC_TURNSTILE_SITE_ID` is set; submit button gated on token presence; request body forwards `turnstile_token` to the server.
- `/api/session` POST handler verifies the token against Cloudflare's documented siteverify endpoint with three precise failure paths (`turnstile_misconfigured` 500, `turnstile_missing` 400, `turnstile_failed` 400) and a fail-closed network error policy.
- 5-case hermetic unit test (`tests/api/session-turnstile.test.ts`) covers all branches via `vi.mock` of `@/lib/supabase-server` plus `globalThis.fetch` override; no real network or DB hits.
- `.env.example` documents the three env vars plus Cloudflare's always-pass test keys.
- **Default behavior preserved:** with `NEXT_PUBLIC_TURNSTILE_ENABLED` absent or `false`, EmailGate renders identically to Plan 01-03 — no widget, no UX impact, existing flow untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @marsidev/react-turnstile** — `38fe942` (deps)
2. **Task 2: Conditional Turnstile widget in EmailGate** — `fc6c57c` (feat)
3. **Task 3: Server-side Turnstile verification in /api/session** — `a64ca4e` (feat)
4. **Task 4: Verify Turnstile server-side path (5 cases)** — `f48453a` (test)
5. **Task 5: Document Turnstile env vars in .env.example** — `ea1c2c3` (docs)

**Plan metadata:** _(this SUMMARY commit)_

## Files Created/Modified

- `package.json` / `package-lock.json` — added `@marsidev/react-turnstile@1.5.1`
- `src/components/EmailGate.tsx` — conditional `<Turnstile>` render, `turnstileToken` state, request-body forwarding, submit-button gating
- `src/app/api/session/route.ts` — `verifyTurnstileToken` helper, conditional preflight, optional `turnstile_token` field on Zod body schema
- `tests/api/session-turnstile.test.ts` (new) — 5 test cases covering skip / misconfigured / missing / failed / passed
- `.env.example` — Turnstile section with three commented placeholders + Cloudflare test keys

## Test Evidence

**Before Plan 02-04:** 43 tests passing across 5 files (Phase 1 + Plans 02-01, 02-03).

**After Plan 02-04:** **48 tests passing across 6 files** (43 prior + 5 new Turnstile cases). No regressions.

```
Test Files  6 passed (6)
     Tests  48 passed (48)
  Duration  653ms
```

`npx tsc --noEmit` exits 0 across all changes.

## Decisions Made

- **Used @marsidev/react-turnstile@1.5.1** (research locked 1.5.0). Patch-level bump is semver-safe; no API surface changes affecting our usage.
- **`process.env` read at call time inside the route handler** instead of at module scope. Lets tests toggle the flag per-test without `vi.resetModules` ceremony, and the cost is one property read per request — negligible.
- **Fail-closed on Cloudflare network error / non-200 response.** A Cloudflare outage cannot bypass the gate when the flag is on. Tradeoff accepted: during a CF outage, sessions stop being created when the flag is on. Acceptable because (a) the flag is OFF by default, and (b) when it's ON, abuse mitigation is the priority.
- **`remoteip` sent to siteverify** when the IP is available. Defense-in-depth — Cloudflare can correlate token to IP at verification time.
- **Mocked `@/lib/supabase-server`** in the unit tests rather than the real client. Hermetic test runs do not require Supabase env vars; the success-path test deterministically returns 200.
- **Added Cloudflare always-pass test keys** (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`) to `.env.example`. Saves a doc lookup at flip-on time and signals to Joe that local testing is supported.

## Deviations from Plan

None — plan executed exactly as written.

The plan's Task 3 example used `body.turnstile_token` (raw); I used `parsed.data.turnstile_token` because that's what Zod returned after `safeParse`. Functionally identical, more type-safe. Not material enough to be a deviation.

## Issues Encountered

None.

## User Setup Required

**None for the plan to be complete.** Turnstile is wired and feature-flagged OFF by default — no Joe action needed today.

**For future flip-on (post-launch abuse observation):**

1. Register a Turnstile site at https://dash.cloudflare.com/?to=/:account/turnstile
2. Add three env vars to Vercel (and `.env.local` for local testing):
   - `NEXT_PUBLIC_TURNSTILE_ENABLED=true`
   - `NEXT_PUBLIC_TURNSTILE_SITE_ID=<site-key>`
   - `TURNSTILE_SECRET_KEY=<secret-key>`
3. Redeploy / restart `npm run dev`.

For local rendering verification without registering a site, use Cloudflare's documented test keys (already in `.env.example`):
- Site key: `1x00000000000000000000AA`
- Secret key: `1x0000000000000000000000000000000AA`

## Phase 5 Launch-Checklist Flag

> **Turnstile is wired but OFF.** It can be enabled in <10 minutes by setting three env vars + restart. The decision to enable is **deferred to post-launch abuse observation** (per CONTEXT D-J-01 + roadmap posture: ship un-captcha'd, observe, flip on if needed).
>
> If Phase 5 sees rate-limit data showing organized abuse against `/api/session`, flip `NEXT_PUBLIC_TURNSTILE_ENABLED=true` and the gate is live without a code deploy. The widget is invisible-when-passing on most browsers, so the UX cost is minimal even when on.

## Next Phase Readiness

- **Plan 02-02 (`/api/chat` route)** can land independently — it has no dependency on Turnstile (per D-J-04: no Turnstile on `/api/chat`).
- **Phase 02 close-out** is unblocked from a Plan 02-04 standpoint; SAFE-13 is now closed.
- **Admin dashboard (Phase 4)** should surface Turnstile failure-code distribution when the flag is eventually flipped — useful signal but out of scope for Phase 2.

---

## Self-Check: PASSED

Verified all claimed artifacts exist and all claimed commits are reachable:

- `package.json` + `package-lock.json`: FOUND (modified, includes `@marsidev/react-turnstile@^1.5.1`)
- `src/components/EmailGate.tsx`: FOUND (modified, contains Turnstile import + conditional render)
- `src/app/api/session/route.ts`: FOUND (modified, contains `verifyTurnstileToken` + three error paths)
- `tests/api/session-turnstile.test.ts`: FOUND (created, 5 tests pass)
- `.env.example`: FOUND (modified, contains Turnstile section)
- Commit `38fe942` (Task 1 deps): FOUND
- Commit `fc6c57c` (Task 2 EmailGate): FOUND
- Commit `a64ca4e` (Task 3 server verify): FOUND
- Commit `f48453a` (Task 4 tests): FOUND
- Commit `ea1c2c3` (Task 5 .env.example): FOUND
- Full test suite: 48/48 passed
- `npx tsc --noEmit`: exits 0

---

*Phase: 02-safe-chat-core*
*Completed: 2026-04-30*
