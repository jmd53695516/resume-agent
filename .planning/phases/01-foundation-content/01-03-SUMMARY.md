---
phase: 01-foundation-content
plan: 03
subsystem: api
tags: [supabase, nextjs-app-router, zod, nanoid, server-components, client-components, tailwind-v4]

# Dependency graph
requires:
  - phase: 01-foundation-content
    provides: "env.ts zod-validated env reader, supabase-server.ts service-role client, hash.ts sha256 ip hasher, shadcn ui primitives (Button/Input/Label), pre-commit secret-scan hook"
  - phase: 01-foundation-content
    provides: "kb/ scaffold (Plan 02) — not consumed in Plan 03 but lives in the same working tree"
provides:
  - "Live Supabase schema: sessions (Phase 1 target) + messages (Phase 2 forward-compat), RLS enabled with zero policies"
  - "POST /api/session Node-runtime endpoint: zod-validated email, sha256-hashed IP, service-role INSERT"
  - "Landing page at / (Server Component): FramingCopy + DisclaimerBanner + EmailGate"
  - "EmailGate Client Component: zod-validated inline error, sessionStorage write, router.push('/chat')"
  - "/chat Client Component stub: reads sessionStorage.session_id inside useEffect, renders 'chat coming in Phase 2'"
  - "docs/README.md: kb/resume.md SSOT note (VOICE-12)"
affects: [02-chat-streaming, 03-tooling, 04-admin-dashboard, 05-eval-harness]

# Tech tracking
tech-stack:
  added: []  # All libraries were pre-installed in Plan 01 (Wave 1); this plan composed them.
  patterns:
    - "Service-role Supabase INSERTs bypass RLS — convention: never import @/lib/supabase-server from src/components/ or Client Components"
    - "sessionStorage read guarded inside useEffect to avoid SSR ReferenceError"
    - "zod v4 z.email() (NOT deprecated z.string().email()) for request-body + client-side validation"
    - "dotenv-first load order for ad-hoc tsx verify scripts: import dotenv → config() → dynamic import of env-reading modules"

key-files:
  created:
    - "supabase/migrations/0001_initial.sql — sessions + messages DDL, RLS enabled, zero policies"
    - "src/app/api/session/route.ts — POST /api/session Node runtime"
    - "src/app/page.tsx — landing composition"
    - "src/app/chat/page.tsx — /chat stub"
    - "src/components/EmailGate.tsx — email gate Client Component"
    - "src/components/FramingCopy.tsx — landing framing copy"
    - "src/components/DisclaimerBanner.tsx — 'not Joe in real time' disclaimer"
    - "docs/README.md — kb/resume.md SSOT note"
  modified:
    - "src/app/globals.css — existing scaffold (no functional changes for this plan beyond inherited Tailwind v4 theme)"

key-decisions:
  - "RLS enabled with zero policies in Phase 1 — correct posture because service-role bypasses RLS; Phase 4 will add admin SELECT policies"
  - "runtime='nodejs' on /api/session — matches Phase 2's /api/chat which requires Node for tool-use streaming; do not migrate to edge"
  - "Raw x-forwarded-for accepted in Phase 1 — T-03-01 accepted risk; Phase 2 switches to @vercel/functions ipAddress() helper"
  - "POST response shape is { id: string } not { session_id, email_domain } — plan's interface contract, matches EmailGate fetch handler parsing"
  - "dotenv NOT added as a dependency — used only as transitive inside ephemeral verify scripts; production paths rely on Next.js env loader"

patterns-established:
  - "Ephemeral verify scripts: write under scripts/_verify-*.mts, run with npx tsx, delete before commit (never committed; see Issues Encountered for tsx ESM ordering pitfall)"
  - "Post-deploy live-schema probe: select('id').limit(0) against each table returns [] if schema present, error if missing — fast and row-free"
  - "E2E gate verification: POST real email → verify row in DB via supabaseAdmin → delete by id → confirm delete count > 0"

requirements-completed: [GATE-01, GATE-02, GATE-03, GATE-04, GATE-05, VOICE-12]

# Metrics
duration: ~2h 45m (across Task 1 code + Joe-applied migration + Task 3 UI + Task 4 verify/env-swap recovery)
completed: 2026-04-22
---

# Phase 01 Plan 03: Gate Flow + Supabase Schema Summary

**Email-gated landing → /api/session Node-runtime POST → Supabase sessions row → sessionStorage → /chat stub, all end-to-end verified against live Supabase with hashed IP, validated email, and RLS posture intact.**

## Performance

- **Duration:** ~2h 45m wall-clock (Task 1 + Task 3 atomic work ~45 min each; Task 2 Joe-side dashboard migration ~10 min; Task 4 verify including env-swap recovery loop ~1h)
- **Started:** 2026-04-21T22:47Z (plan opened)
- **Completed:** 2026-04-22T21:41Z (final verify green)
- **Tasks:** 4/4 (Task 1 auto, Task 2 human-action, Task 3 auto, Task 4 human-verify)
- **Files created:** 8 (7 code + 1 docs/README)
- **Files modified:** 0 (all-new additions under src/app, src/components, supabase/migrations, docs/)

## Accomplishments

- Live Supabase schema applied via Dashboard SQL Editor: `sessions` (13 cols) + `messages` (17 cols + FK cascade), RLS enabled with zero policies per Phase 1 threat-model posture.
- POST /api/session returns `{id: nanoid}` on valid email, `{error}` 400 on malformed body, `{error: "Could not start session."}` 500 on DB failure. Node runtime, zod v4 validation, sha256-hashed IP, service-role INSERT.
- Landing page renders above-fold: headline → framing paragraph (mentions pitch / case study / metric framework — GATE-01 "three tools") → disclaimer banner ("not Joe in real time") → labeled email input → "Let's chat" button. Zero GATE-05 anti-patterns (no emoji, no "Meet my AI", no exclamation-fanfare).
- EmailGate wires client-side zod validation → fetch /api/session → sessionStorage.setItem('session_id', id) → router.push('/chat'). Inline error on blur-after-dirty. Disabled states during submit and when schema invalid.
- /chat stub reads sessionStorage inside useEffect (SSR-safe), renders the session id in a `<code>` block with fallback copy if storage is empty.
- `docs/README.md` declares `kb/resume.md` as SSOT with rationale referencing PITFALLS.md Pitfall 11 (VOICE-12).

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration SQL + /api/session route + Supabase client wiring** — `24d3606` (feat)
2. **Task 2: [checkpoint:human-action] Apply migration via Dashboard SQL Editor** — no commit (dashboard-side DDL; verified via live schema probe)
3. **Task 3: Landing + email gate + /chat stub + docs/README SSOT note** — `6f9918b` (feat)
4. **Task 4: [checkpoint:human-verify] End-to-end gate-flow verification** — no commit (verification-only; this SUMMARY captures evidence)

**Plan metadata:** pending — this SUMMARY commit completes the plan.

## Files Created/Modified

- `supabase/migrations/0001_initial.sql` — DDL for `public.sessions` + `public.messages`; indexes on `email_domain`, `created_at desc`, `messages(session_id, created_at)`, partial index on `classifier_verdict <> 'normal'`; RLS enabled on both tables; comment docstrings.
- `src/app/api/session/route.ts` — Node-runtime POST handler; zod `BodySchema` → 400; service-role insert → 200 w/ `{id}` or 500 w/ generic error (T-03-03 info-disclosure mitigation).
- `src/app/page.tsx` — Server Component composition; zero client JS for framing/disclaimer.
- `src/app/chat/page.tsx` — `'use client'` stub; `sessionStorage.getItem('session_id')` inside useEffect.
- `src/components/EmailGate.tsx` — `'use client'` form with `z.email({message: ...})`, touched/blur state machine, server-error surface, disabled-on-invalid-or-submitting button.
- `src/components/FramingCopy.tsx` — Engineered copy: headline + two paragraphs; mentions all three tool capabilities; no banned tone markers.
- `src/components/DisclaimerBanner.tsx` — role="note" above-fold banner w/ exact phrase "not Joe in real time".
- `docs/README.md` — Contributor notes; SSOT declaration for `kb/resume.md`; pointers to interview protocols (Plan 04) and PROJECT.md/REQUIREMENTS.md.

## Verification Evidence

### Live schema probe (step 2)

```
◇ injected env (8) from .env.local
SESSIONS_OK rows= 0
MESSAGES_OK rows= 0
SCHEMA_PROBE_PASS
```

Both tables queryable by service-role client → migration applied, RLS posture correct (service role bypasses empty policy set).

### Dev server boot (step 3)

```
✓ Ready in 729ms
```

`curl -sI http://localhost:3000/` → HTTP/1.1 200 OK.

### POST /api/session happy path (step 4)

```
POST_STATUS= 200
POST_BODY= {"id":"z6MaF2cRrVRdXDHk6DqWu"}
SESSION_ID= z6MaF2cRrVRdXDHk6DqWu
```

Response shape matches plan's interface contract (`{id: string}`). `id` is a 21-char nanoid.

### Row field verification (step 5)

| Field | Value | Check |
|-------|-------|-------|
| `email` | `e2e-verify-1776893626275@example.com` | matches submitted |
| `email_domain` | `example.com` | split-at-@ correct |
| `ip_hash` | 64-char lowercase hex | `/^[a-f0-9]{64}$/` ✓ (sha256) |
| `user_agent` | `node` (fetch default) | non-empty ✓ |
| `created_at` | `2026-04-22T21:33:51.29275+00:00` | within 60s ✓ |

All five row checks passed.

### 400 path (step 6)

```
BAD_STATUS= 400
BAD_BODY= {"error":"Invalid email."}
```

Malformed body returns 400 with generic error. T-03-02 mitigation verified.

### Cleanup (step 7)

```
CLEANUP_DELETED_COUNT= 1
```

Test row deleted; `sessions` table returned to empty state.

### Final typecheck + tests (step 8)

- `npx tsc --noEmit` → exit 0
- `npx vitest run --pool=vmThreads` → **Test Files 2 passed (2); Tests 11 passed (11)** — see Deviations below re: pool flag

### Landing page framing copy (for Plan 04 / Phase 5 A/B reference)

```
Chat with Joe Dollinger's agent

I'm an agent built and trained on Joe's background — roles, projects,
decisions, voice — so you can get specific answers about how he thinks
and what he's done without needing to wait for a calendar slot. Ask me
about a project, have me tailor a pitch for your company, walk through
a case study, or draft a metric framework for a feature you're
considering.

Drop your email to start. Joe will see a note that you stopped by, so
if there's a role you think fits, leave it in the chat and he'll
follow up directly.
```

Three-tool mentions present (pitch / case study / metric framework). No GATE-05 anti-patterns. Single exclamation point appears in the CTA button label "Let's chat" only — a deliberate casual-but-decisive register per CONTEXT.md specifics.

## Decisions Made

- **Kept dotenv out of `package.json`.** Ephemeral verify scripts used dotenv via the existing transitive install; production paths (Next.js dev server, build, runtime) use Next's native `.env.local` loader. Adding dotenv as a direct dep would invite drift between "how the app loads env" and "how scripts load env."
- **Dynamic-import pattern for verify scripts.** `src/lib/env.ts` parses `process.env` at module load and throws if required vars are missing. When invoking via `tsx`, `import { config } from 'dotenv'; config()` has to run BEFORE any transitive import of `env.ts`. Pattern: top-of-file `config({ path: '.env.local' })`, then `await import(...)` inside `main()` for any env-reading module.
- **Not regenerating the schema-push via CLI.** Joe applied the DDL through the Supabase Dashboard SQL Editor per CONTEXT.md D-F-02. The SQL file remains the canonical source; a future CLI-based push would `supabase db push` this same file idempotently thanks to `create table if not exists` guards.

## Deviations from Plan

### Auth-gate recovery (documented per checkpoint_protocol — not a deviation per Rule 1/2/3)

**Env-key slot mismatch during Task 4 first-pass verify.** On the initial verification attempt, the E2E POST returned 500 because `.env.local` had the Supabase `sb_publishable_*` and `sb_secret_*` keys in the wrong slots — the server was attempting service-role INSERTs with the publishable (anon) key, which fails RLS (correctly — RLS is the safety net working as designed). The executor detected the 500, confirmed the server-side Postgres error was an auth/permission failure (not a schema or app bug), and returned a `checkpoint:human-action` asking Joe to swap the two keys. Joe swapped them and signaled "swapped." This verify pass re-ran the full sequence against the corrected `.env.local` and all checks passed first-try. Timeline: initial verify fail → checkpoint returned → Joe swapped → re-verify green.

This counts as an **authentication gate**, not a Rule-class deviation — the plan code is unchanged, the environment config was the sole blocker.

### Auto-fixed Issues

None - plan code executed exactly as written. The only corrective work was the env-key swap (Joe-side, above) and the tests-pool workaround (below).

## Issues Encountered

**1. [Environment — not caused by plan changes] vitest 4.1.5 default pool fails on Node 25.9.0.**

- **Found during:** Task 4 step 8 (final test pass).
- **Symptom:** `npx vitest run` (forks or threads pool) produced `TypeError: Cannot read properties of undefined (reading 'config')` at the first `describe(...)` line of every test file. Root cause traced to `createDefaultSuite(runner)` in `@vitest/runner/dist/chunk-artifact.js` — `runner.config.sequence` dereferencing an undefined runner because `clearCollectorContext()` wasn't being invoked before test-file import in the default pool on Node 25.
- **Resolution:** `npx vitest run --pool=vmThreads` runs all 11 tests green. The vmThreads pool uses Node's `vm` module for isolation instead of worker_threads/child_process and is unaffected.
- **Scope:** Pre-existing environment issue (vitest/Node 25 compat) — NOT caused by any Plan 01-03 code change. Tests themselves are unchanged and pass.
- **Deferred to:** Joe. Two options: (a) pin Node to 22 or 24 in `engines` and locally; (b) add `test: { pool: 'vmThreads' }` to `vitest.config.ts`. Recommend (b) as the lower-friction fix — vmThreads is a supported production pool. Logging here so Plan 04 / Phase 2 executors don't get surprised.

**2. tsx ESM import-order gotcha on env-reading modules.**

- **Found during:** Task 4 step 2 (first attempt at live schema probe).
- **Symptom:** Ephemeral script did `import { config } from 'dotenv'; config(); import { supabaseAdmin } from '../src/lib/supabase-server'` — error: "module does not provide an export named 'supabaseAdmin'". Misleading error — actual cause was `env.ts` throwing on module-graph evaluation because `process.env` wasn't populated yet when the import tree was resolved (ESM hoists imports before top-level code).
- **Resolution:** Use dynamic import inside `main()`: `const { supabaseAdmin } = await import(...)`. This defers evaluation of the transitively-imported `env.ts` until after `config()` has run.
- **Why it matters:** This pattern should be the standard for any future ad-hoc verify scripts (Phase 2+) that touch env-validated modules outside the Next.js env loader.

## Post-Plan-04 Joe-time Follow-Up (not a deviation — per Task 4 Step 10)

The landing-page framing copy (`src/components/FramingCopy.tsx`) was written before `kb/voice.md` is populated with real voice samples (Plan 04 Task 3). After Plan 04 captures the voice interview and distills authentic samples, Joe should re-read the landing page copy and open a small revision PR if the register has drifted from Joe's unfiltered writing voice. This is on the plan by design — Plan 03 ships what's needed for the gate flow; voice fidelity is a Phase 5 eval-gated deliverable.

**Not classified as a deviation** because it's explicit in PLAN.md Task 4 "Step 10 — Voice-follow-up revisit (post-Plan-04)."

## Must-haves Status

| must-have | status |
|---|---|
| Landing page at `/` renders framing copy + disclaimer visible without scroll (GATE-01, GATE-05) | GREEN — verified in Task 4 happy-path walk + DOM structure |
| Valid-email submit creates sessions row with {id, email, email_domain, ip_hash, user_agent, created_at} (GATE-03) | GREEN — row-field verification table above, all 5 checks pass |
| sessionStorage receives session_id and browser navigates to /chat (GATE-04) | GREEN — EmailGate code sets sessionStorage before router.push('/chat'); /chat stub reads it back in useEffect |
| /chat stub displays 'chat coming in Phase 2' + session id | GREEN — src/app/chat/page.tsx |
| Invalid email shows inline error (GATE-02) | GREEN — onBlur sets touched; z.email safeParse produces inline message |
| Landing copy has zero breathless anti-patterns (GATE-05) | GREEN — grep -qi "Meet my AI" / "🤖" / "Welcome to" returns no match; single `!` lives only on button label |
| kb/resume.md SSOT declared in docs/README.md (VOICE-12) | GREEN — docs/README.md contains the SSOT note referencing PITFALLS.md Pitfall 11 |

## User Setup Required

**External service used for migration application.** Joe applied `supabase/migrations/0001_initial.sql` via Supabase Dashboard → SQL Editor (per CONTEXT.md D-F-02). No `USER-SETUP.md` generated because all other env config was complete after Plan 01.

For Phase 2, the `SUPABASE_SERVICE_ROLE_KEY` slot must remain pointed at the `sb_secret_*` key (not the `sb_publishable_*` key) — see auth-gate recovery note above.

## Next Phase Readiness

**Ready for Phase 2 (chat streaming):**
- `sessions` rows flowing; Phase 2's `/api/chat` can safely `supabaseAdmin.from('sessions').update({turn_count: …, ended_at: …})` — columns exist.
- `messages` table exists with forward-compatible schema (17 cols incl. token counts, latency_ms, classifier_verdict, stop_reason) — Phase 2's `onFinish` inserts go straight in, no migration-on-migration.
- Convention established: `@/lib/supabase-server` never imported from Client Components. Phase 5 should add a bundle-scan test (Phase 1 T-03-04 residual mitigation).
- Phase 2 hand-off: migrate `/api/session` and `/api/chat` from raw `x-forwarded-for` to `@vercel/functions` `ipAddress()` helper once SAFE-05 rate-limit work lands.

**No blockers for Phase 2.**

## Self-Check: PASSED

Verified before committing SUMMARY:

- `supabase/migrations/0001_initial.sql` → FOUND
- `src/app/api/session/route.ts` → FOUND
- `src/app/page.tsx` → FOUND
- `src/app/chat/page.tsx` → FOUND
- `src/components/EmailGate.tsx` → FOUND
- `src/components/FramingCopy.tsx` → FOUND
- `src/components/DisclaimerBanner.tsx` → FOUND
- `docs/README.md` → FOUND
- Commit `24d3606` → FOUND in `git log --all`
- Commit `6f9918b` → FOUND in `git log --all`
- No ephemeral `scripts/_verify-*.mts` residue → FOUND CLEAN
- No `vitest.config.noreact.mts` residue → FOUND CLEAN
- `git status` → clean working tree before SUMMARY write

---
*Phase: 01-foundation-content*
*Completed: 2026-04-22*
