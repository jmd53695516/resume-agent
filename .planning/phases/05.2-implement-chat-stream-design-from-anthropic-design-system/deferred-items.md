# Phase 05.2 Deferred Items

## Item #1 (NEW 2026-05-11 from Plan 05.2-06 close-out): cat-06-admin-403.spec.ts — 3 failures

**Severity:** MEDIUM (test-only; admin perimeter security NOT compromised)

**Affected tests (all in `tests/e2e/cat-06-admin-403.spec.ts`):**
- `unauthenticated /admin/sessions renders NotAuthorized` (line 30)
- `unauthenticated /admin/cost renders NotAuthorized` (line 44)
- `unauthenticated /admin/health renders NotAuthorized` (line 50)

**Symptom:** Each test navigates to `/admin/<page>` without cookies, then asserts that a `getByRole('heading', { name: /Access denied/i })` is visible. The heading is NOT visible — test times out at 5000ms.

**Root cause (investigated):** `src/proxy.ts` (Layer 1 admin perimeter) redirects unauthorized requests to `/admin/login` BEFORE the `(authed)` layout has a chance to render `<NotAuthorized />`. The test was written assuming requests reach the (authed) layout's `requireAdmin()` null-path; the proxy short-circuits that with a redirect. So instead of seeing "Access denied", the test sees the `/admin/login` page.

**Where the proxy matcher lives:** `src/proxy.ts:73` — `matcher: ['/admin/((?!login(?:/|$)).*)', '/api/admin/:path*']`.

**Pre-existing — NOT caused by Plan 05.2-06:** Verified by running `tests/e2e/cat-06-admin-403.spec.ts` against the pre-Plan-05.2-06 baseline (with `chat-happy-path.spec.ts` reverted and `cat-06-view-toggle.spec.ts` removed). 3 of 4 admin-403 tests fail identically; 1 (login page) passes. Failure exists at commit `664a227` (Plan 05.2-05 close) — predates this plan.

**Why Plan 05.2-05 SUMMARY claims green:** Plan 05.2-05's verification gates were `npx tsc --noEmit`, `npm run build`, and `npm test` (vitest). The full Playwright suite was NOT run during 05.2-05 close-out. This regression went undetected from whenever the proxy redirect path diverged from the test's "renders NotAuthorized" expectation.

**Suggested fix (when picked up):** EITHER (a) update `tests/e2e/cat-06-admin-403.spec.ts` to assert the proxy redirect to `/admin/login` (replace "Access denied" expectation with `page.waitForURL('**/admin/login')` then assert sign-in button is present), OR (b) adjust the proxy matcher to NOT redirect for these specific pages and let `(authed)/layout.tsx` render `<NotAuthorized />` instead. Option (a) is the lower-risk fix.

**Phase 05.2-06 disposition:** Out of scope for this plan (test files modified by 05.2-06 are `chat-happy-path.spec.ts` + new `cat-06-view-toggle.spec.ts`; admin-403 spec is untouched). Plan 05.2-06's deliverables (all 8 tests across the 2 affected specs) pass. Documenting here per SCOPE BOUNDARY rule. Should be addressed by a separate quick task or Plan 05-12 (LAUNCH-*) pre-flight.

## Item #2 (carried from Plan 05.2-03): Pre-existing vitest flake in `tests/api/chat-six-gate-order.test.ts`

**Severity:** LOW (test-isolation issue; affects 2/562 tests)

**Affected tests (in `tests/api/chat-six-gate-order.test.ts`):**
- `fires gates in exact canonical order on a happy-path request`
- `stops at session_lookup when session is missing (no later gates fire)`

**Symptom:** Under full-suite parallel execution (`npm run test`), 2 tests fail with `gateOrderRecorder` array containing accumulated entries from prior tests. Isolated run (`npx vitest run tests/api/chat-six-gate-order.test.ts`) shows 5/5 pass.

**Root cause:** `gateOrderRecorder` shared array bleeds between concurrent test runs without a `beforeEach(() => gateOrderRecorder.length = 0)` reset.

**Suggested fix:** Add `beforeEach` reset in the test file.

**Pre-existing — NOT caused by Plan 05.2-06:** Documented in Plan 05.2-03 SUMMARY (line 138-139) and re-observed in Plan 05.2-04 / 05 verification. Carries over to Plan 05.2-06 verification.
