---
phase: 04
plan: 05
subsystem: email
tags: [email, resend, react-email, after, idempotency, free-mail, alarm]
requirements_addressed: [OBSV-08]
dependency-graph:
  requires:
    - "Plan 04-01 — env.RESEND_API_KEY/RESEND_FROM_EMAIL/JOE_NOTIFICATION_EMAIL + sessions.first_email_sent_at column + resend@^6.12.3 + @react-email/components@^1.0.12 deps"
    - "Plan 04-02 — admin perimeter live (the email's transcript button targets /admin/sessions/<id>; access is gated by proxy.ts + requireAdmin)"
  provides:
    - "src/lib/free-mail-domains.ts — FREE_MAIL_DOMAINS Set + isFreeMail() helper (consumed by Plan 04-03 SessionsTable badge column)"
    - "src/lib/email.ts — sendSessionNotification (per-session) + claimAndSendSessionEmail (atomic-claim wrapper) + sendAlarm (consumed by Plan 04-06 cron alarms)"
    - "src/emails/SessionNotification.tsx — React Email template for OBSV-08 per-session notification"
    - "src/app/api/chat/route.ts — after()-scheduled email fire post-persistNormalTurn (idempotent, fire-and-forget, fail-safe)"
  affects:
    - "tests/api/chat-tools.test.ts — added 'next/server' after() mock + '@/lib/email' claimAndSendSessionEmail mock to keep 5 W4-decoupling tests green after the route.ts wiring change"
tech-stack:
  added: []
  patterns:
    - "after() from 'next/server' for fire-and-forget post-response work in route handlers (Next.js 16 / RESEARCH §Pitfall 3 — supersedes deprecated waitUntil())"
    - "Atomic UPDATE-WHERE-IS-NULL on first_email_sent_at — exactly-once guarantee across concurrent /api/chat racers (D-C-05)"
    - "Lazy-initialised SDK client (Resend constructor deferred until first call) — keeps module import cheap so tests with minimal env stubs don't have to wire every Phase 4 var"
    - "Class-based vi.mock() for SDKs invoked via 'new' (Plan 03-00 Exa pattern reused here for Resend)"
key-files:
  created:
    - "src/lib/free-mail-domains.ts"
    - "src/lib/email.ts"
    - "src/emails/SessionNotification.tsx"
    - "tests/lib/free-mail-domains.test.ts"
    - "tests/lib/email.test.ts"
    - ".planning/phases/04-admin-observability/04-05-SUMMARY.md"
  modified:
    - "src/app/api/chat/route.ts"
    - "tests/api/chat-tools.test.ts"
decisions:
  - "Lazy-init Resend client — module-load constructor would have broken chat-route tests whose env stubs omit RESEND_API_KEY; production code path unchanged (first-call materialise + cache)"
  - "Class-based vi.mock for Resend (mirrors Plan 03-00 Exa SDK mock) — arrow vi.fn() implementations aren't constructible against 'new Resend(...)'"
  - "Mocked 'next/server' after() in chat-tools.test.ts that calls onFinish directly out-of-request-scope; real after() throws 'outside a request scope' otherwise. Other chat tests (six-gate-order) trip earlier gates and never reach onFinish, so they don't need the mock"
  - "Subject scheme: '[PRIORITY] new chat: <email>' for non-free-mail; 'new chat: <email>' for free-mail — matches plan's must-have truth #2"
  - "buildAdminUrl() base resolution: NEXT_PUBLIC_SITE_URL > VERCEL_URL > localhost — preview deploys auto-link, prod overrides via NEXT_PUBLIC_SITE_URL once Joe sets a custom domain"
metrics:
  duration: "~7 min"
  tasks_completed: 4
  files_changed: 8
  commits: 4
  completed_date: "2026-05-06"
---

# Phase 4 Plan 05: Email Infrastructure Summary

Wave 2 plan B for Phase 4: Resend client + canonical free-mail allowlist + React Email template + atomic-claim email-send wrapper + Next.js 16 `after()` wiring into `/api/chat` `onFinish`. Per-session emails fire on the first user turn (after `persistNormalTurn` succeeds), gated by `sessions.first_email_sent_at`'s atomic UPDATE-WHERE-IS-NULL claim — exactly-once across concurrent racers. Subjects prefix `[PRIORITY]` when the recruiter's email_domain is NOT in the 25-entry free-mail set. Email failures never propagate to `/api/chat` (logged + swallowed via Pino). The `sendAlarm()` export is in place for Plan 04-06 to consume without circular dependency. 15/15 plan-scoped tests pass; full repo holds at 249/249.

## What Was Built

### Task 1 — Free-mail allowlist + helper (commit `c2fc160`)

`src/lib/free-mail-domains.ts` exports `FREE_MAIL_DOMAINS: ReadonlySet<string>` (the 25 domains from CONTEXT.md D-C-03 verbatim — gmail/yahoo/hotmail/outlook/live/msn/icloud/me/mac/protonmail/proton.me/aol/mail/yandex.com/yandex.ru/gmx.com/gmx.de/fastmail.com/fastmail.fm/pm.me/hey/duck/qq/163/naver) and `isFreeMail(domain)` helper that lowercases + trims before lookup, treats nullish/non-string as `false`. TDD: failing test first (`Cannot find package '@/lib/free-mail-domains'`), then implementation, 6/6 tests pass.

### Task 2 — SessionNotification React Email template (commit `37ee0cd`)

`src/emails/SessionNotification.tsx` renders the per-session body shape from D-C-04: headline (`[PRIORITY] New chat from <email>` or plain), `Domain · Session ID` subhead, "First message" section with the user's first turn text (truncated to 600 chars + ellipsis), classifier verdict + confidence line, session-cost-so-far line, and a "View transcript" button styled with the `--me` accent token (`#2080ff`) linking to the absolute `admin_url` provided by the caller. Inline styles only (CSS-in-style for cross-client email reliability — `<style>` blocks are unreliable across email clients). No `'use client'` directive — React Email templates render server-side via the Resend SDK.

### Task 3 — email.ts (Resend + helpers) + tests (commit `e617a3d`)

`src/lib/email.ts` exports four pieces:

- **`resend`** — getter-proxy over a lazy-initialised singleton (see Deviations below). Behaves like a singleton but only calls `new Resend(env.RESEND_API_KEY)` on first access.
- **`sendSessionNotification(props)`** — applies the subject scheme (`[PRIORITY] new chat: <email>` / `new chat: <email>`), invokes `resend.emails.send({ from, to, subject, react: SessionNotification(props) })`. On Resend `error` → log `event: 'session_email_send_failed'` (level: 'error') and return `{ id: null }`. On success → log `event: 'session_email_sent'` with `resend_send_id` + `latency_ms`. Catches throws — never propagates upward.
- **`claimAndSendSessionEmail({ session_id, last_user_text, classifier_verdict, classifier_confidence })`** — atomic UPDATE-WHERE-IS-NULL claim on `sessions.first_email_sent_at` (D-C-05); if claim returns `null` (already sent / lost the race / row missing), exits silently with no log. If claim wins, builds `admin_url`, computes `is_priority` via `isFreeMail`, calls `sendSessionNotification`. Wrapped in try/catch logging `event: 'session_email_send_failed'` with `where: 'claimAndSendSessionEmail'` — designed for `after(...)` callsites where uncaught rejections would be unobserved.
- **`sendAlarm({ condition, summary })`** — plain-text alarm email. Subject `[ALARM] resume-agent: <condition>`; body: `Alarm fired: <condition>` + ISO timestamp + `summary`. No React template (per CONTEXT D-C Specifics — alarm emails are plain text for phone readability and zero formatting friction). Logs `alarm_email_sent` / `alarm_email_send_failed`.

`tests/lib/email.test.ts` — 9 cases, all passing:
- sendSessionNotification: priority subject prefix; non-priority subject; success log payload shape; Resend-error fail-safe (doesn't throw, logs failure)
- claimAndSendSessionEmail: silent skip on null claim; sends with priority for non-free-mail; doesn't throw on supabase error
- sendAlarm: plain-text body + `[ALARM]` subject; doesn't throw on send failure

### Task 4 — /api/chat onFinish wiring + Rule 3 fixes (commit `23a477b`)

`src/app/api/chat/route.ts` — two targeted edits, no rewrites:

1. **Imports added** (line 31, 56): `import { after } from 'next/server'` + `import { claimAndSendSessionEmail } from '@/lib/email'`.

2. **after() block added** (line ~366) inside the existing `onFinish` callback, between the persistence try/catch and the final `log({ event: 'chat', ... })` call:

```ts
after(async () => {
  await claimAndSendSessionEmail({
    session_id,
    last_user_text: lastUser,
    classifier_verdict: verdict.label,
    classifier_confidence: verdict.confidence,
  });
});
```

The block is preceded by an inline doc comment that pins down the `after()` vs `waitUntil()` choice (RESEARCH Pitfall 3 wins over CONTEXT's `waitUntil` reference). The heartbeat-write try/catch and persistence try/catch (Plan 03-02 W4 contract) are structurally untouched — the after() schedules cleanly between the persistence catch and the final log.

`git diff src/app/api/chat/route.ts` confirmed: 2 import lines + the after() block, nothing else changed.

## Test Results

| File | Tests | Status |
|---|---|---|
| `tests/lib/free-mail-domains.test.ts` | 6 | PASS |
| `tests/lib/email.test.ts` | 9 | PASS |
| **Plan-scoped total** | **15** | **PASS** |
| Full repo suite | 249 | PASS (31 files) |

`npx tsc --noEmit` clean.

## Deviations from Plan

### [Rule 3 — Blocking issue] Lazy-init the Resend client

**Found during:** Task 4 verification (full test suite)
**Issue:** With `export const resend = new Resend(env.RESEND_API_KEY)` at module load, importing `src/lib/email.ts` from `route.ts` cascaded a Resend constructor invocation during every chat-route test that touches the route module. The chat-route tests stub a minimal env (`vi.mock('@/lib/env', ...)`) that omits `RESEND_API_KEY`, so the constructor threw `Error: Missing API key. Pass it to the constructor 'new Resend("re_123")'`. 10 chat-route tests broke at module import time.
**Fix:** Wrapped the Resend constructor in `getResend()` — first call materialises + caches; subsequent calls return the cached client. The exported `resend` is now a getter-proxy: `export const resend = { get emails() { return getResend().emails; } };` — production code path is identical, tests still mock the `resend` package via `vi.mock('resend', () => ({ Resend: class { ... } }))` and the lazy `getResend()` constructs the mock class at first call. **6 of the 10 broken tests resolved with this fix.**
**Files modified:** `src/lib/email.ts`
**Commit:** included in `23a477b` (Task 4)

### [Rule 3 — Blocking issue] Mock 'next/server' after() + '@/lib/email' in chat-tools.test.ts

**Found during:** Task 4 verification (full test suite, after lazy-init fix)
**Issue:** 4 W4-decoupling tests in `tests/api/chat-tools.test.ts` invoke `config.onFinish(event)` directly to assert behaviors of the heartbeat + persistence ordering. Real `after()` from 'next/server' requires a Next.js request scope; called out-of-scope it throws `Error: 'after' was called outside a request scope`.
**Fix:** Added two scoped vi.mocks: `vi.mock('next/server', ...)` to intercept `after` and run the callback inline (so an email-path regression still fails the test); `vi.mock('@/lib/email', ...)` to stub `claimAndSendSessionEmail`. The other chat-route test file (`chat-six-gate-order.test.ts`) trips an earlier gate in every case and never reaches the streamText/onFinish path, so it doesn't need the mock — left untouched.
**Files modified:** `tests/api/chat-tools.test.ts`
**Commit:** included in `23a477b` (Task 4)

### [Rule 3 — Blocking issue] Class-based Resend mock in tests/lib/email.test.ts

**Found during:** Task 3 first test run
**Issue:** Plan-template's mock used `Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendMock } }))`. `new Resend(env.RESEND_API_KEY)` invokes Resend as a constructor; arrow vi.fn() implementations aren't constructible — `TypeError: () => ({ emails: { send: mocks.sendMock } }) is not a constructor`.
**Fix:** Replaced with a real class: `Resend: class { emails = { send: mocks.sendMock }; }`. Mirrors the Plan 03-00 Exa SDK mock pattern recorded in STATE.md decisions.
**Files modified:** `tests/lib/email.test.ts`
**Commit:** included in `e617a3d` (Task 3)

## Manual Smoke (deferred to deploy preview)

Plan §verification specifies five manual smokes that require a live Supabase project + a deployed preview + a real Resend send (DKIM-configured custom domain or `onboarding@resend.dev`):

1. Fresh chat → first message arrives → email lands in `JOE_NOTIFICATION_EMAIL` within ~5 s
2. Second message in same session → no duplicate email (idempotency)
3. Company-domain test session → `[PRIORITY]` subject prefix
4. `gmail.com` test session → plain `new chat: <email>` subject (no prefix)
5. Vercel logs show `event: 'session_email_sent'` with `resend_send_id`

These are **deferred** until either (a) Plan 04-03 ships the admin shell so the transcript button has a working destination, or (b) Joe spot-checks them on a deploy preview before Phase 4 closes. Per Plan 04-01 SUMMARY, Joe's current Resend setup uses `RESEND_FROM_EMAIL=onboarding@resend.dev` (Resend's free-tier dev sender); custom-domain DKIM swap is on the LAUNCH-* checklist for Phase 5.

## Notes for Plan 04-03 (SessionsTable refactor)

The plan output spec calls this out:

> Note for Plan 04-03: the SessionsTable currently embeds a fallback free-mail allowlist; this plan ships the canonical list at `src/lib/free-mail-domains.ts` — refactor SessionsTable in a follow-up commit OR have Plan 04-03 import from this module if both plans land in the same wave.

**Status:** Plan 04-03 has not yet executed. There is currently no `SessionsTable.tsx` in the repo (`src/app/admin/sessions/` doesn't exist). When Plan 04-03 ships SessionsTable, it should import `isFreeMail` from `@/lib/free-mail-domains` directly — no inline allowlist needed. This summary serves as the breadcrumb for that plan's executor.

## Self-Check

- src/lib/free-mail-domains.ts — FOUND
- src/lib/email.ts — FOUND
- src/emails/SessionNotification.tsx — FOUND
- tests/lib/free-mail-domains.test.ts — FOUND
- tests/lib/email.test.ts — FOUND
- src/app/api/chat/route.ts contains `import { after } from 'next/server'` — FOUND
- src/app/api/chat/route.ts contains `import { claimAndSendSessionEmail } from '@/lib/email'` — FOUND
- src/app/api/chat/route.ts contains `after(async () => {` followed by `claimAndSendSessionEmail` call — FOUND (lines 368-374)
- src/app/api/chat/route.ts does NOT contain `waitUntil(` outside comment text — VERIFIED (only doc-note references at lines 364, 366)
- src/app/api/chat/route.ts still contains heartbeat-write try/catch + persistence try/catch — VERIFIED (line 309 + 322 + 325 unchanged)
- Commit c2fc160 (Task 1) — FOUND in git log
- Commit 37ee0cd (Task 2) — FOUND in git log
- Commit e617a3d (Task 3) — FOUND in git log
- Commit 23a477b (Task 4) — FOUND in git log
- 15/15 plan-scoped tests passing
- 249/249 full-repo tests passing
- npx tsc --noEmit clean

## Self-Check: PASSED
