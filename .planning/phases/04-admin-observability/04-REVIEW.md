---
phase: 04-admin-observability
reviewed: 2026-05-06T00:00:00Z
depth: standard
files_reviewed: 56
files_reviewed_list:
  - .env.example
  - .gitignore
  - package.json
  - scripts/install-pre-commit-hook.sh
  - src/app/admin/(authed)/abuse/page.tsx
  - src/app/admin/(authed)/cost/page.tsx
  - src/app/admin/(authed)/health/page.tsx
  - src/app/admin/(authed)/layout.tsx
  - src/app/admin/(authed)/page.tsx
  - src/app/admin/(authed)/sessions/[id]/page.tsx
  - src/app/admin/(authed)/sessions/page.tsx
  - src/app/admin/components/AbuseTable.tsx
  - src/app/admin/components/AdminNav.tsx
  - src/app/admin/components/CostCard.tsx
  - src/app/admin/components/HealthGrid.tsx
  - src/app/admin/components/LocalTime.tsx
  - src/app/admin/components/NotAuthorized.tsx
  - src/app/admin/components/RelativeTime.tsx
  - src/app/admin/components/SessionsTable.tsx
  - src/app/admin/layout.tsx
  - src/app/admin/login/page.tsx
  - src/app/api/chat/route.ts
  - src/app/api/cron/archive/route.ts
  - src/app/api/cron/check-alarms/route.ts
  - src/app/api/cron/heartbeat/route.ts
  - src/app/auth/callback/route.ts
  - src/components/MessageBubble.tsx
  - src/components/TracePanel.tsx
  - src/components/ui/badge.tsx
  - src/components/ui/table.tsx
  - src/emails/SessionNotification.tsx
  - src/lib/admin-auth.ts
  - src/lib/alarms.ts
  - src/lib/archive.ts
  - src/lib/cron-auth.ts
  - src/lib/email.ts
  - src/lib/env.ts
  - src/lib/free-mail-domains.ts
  - src/lib/id.ts
  - src/lib/supabase-browser.ts
  - src/proxy.ts
  - supabase/migrations/0002_phase4.sql
  - tests/admin/abuse-page.test.tsx
  - tests/admin/cost-page.test.tsx
  - tests/admin/sessions-page.test.tsx
  - tests/api/chat-tools.test.ts
  - tests/components/trace-panel-admin-variant.test.tsx
  - tests/cron/archive.test.ts
  - tests/cron/check-alarms.test.ts
  - tests/cron/heartbeat.test.ts
  - tests/lib/admin-auth.test.ts
  - tests/lib/alarms.test.ts
  - tests/lib/archive.test.ts
  - tests/lib/cron-auth.test.ts
  - tests/lib/email.test.ts
  - tests/lib/free-mail-domains.test.ts
  - tests/middleware/admin-perimeter.test.ts
findings:
  critical: 0
  warning: 6
  info: 5
  total: 11
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-05-06T00:00:00Z
**Depth:** standard
**Files Reviewed:** 56
**Status:** issues_found

## Summary

Phase 4 admin shell, cron jobs, retention/archive, alarm dispatch, and email notifications. Code quality is high overall: defense-in-depth perimeter (proxy.ts + per-page requireAdmin), atomic UPDATE-WHERE-IS-NULL idempotency for first-email send, Redis NX suppression for alarms, upload-before-delete for retention, fail-closed env parsing, structured logging via Pino, and constant-time secret compare for cron auth. Tests broadly cover happy paths and error branches.

The findings below are mostly defense-in-depth gaps and edge-case correctness issues, not headline bugs. Most have explicit Layer-2 backstops or fail-closed defaults, but several would surface in real-world conditions (a single session with thousands of old rows, prod email link rendering as localhost, or a small URL-pattern quirk in the proxy matcher).

## Warnings

### WR-01: proxy.ts matcher pattern leaks `/admin/login*` paths past Layer 1

**File:** `src/proxy.ts:70`
**Issue:** The matcher `'/admin/((?!login).*)'` uses a negative lookahead that fires on any path beginning with the literal string `login`, not just the exact segment `/admin/login`. As written:

- `/admin/login` → bypasses proxy (correct — sign-in page must render unauth)
- `/admin/loginx` → also bypasses proxy (incorrect — should be protected)
- `/admin/login-foo` → bypasses proxy (incorrect)
- `/admin/login/anything` → bypasses proxy (incorrect)

These extras don't currently exist as routes, so a 404 falls out, but if anyone adds `app/admin/login/*` siblings later they'd render unauthenticated. Layer 2 (`requireAdmin()` in `(authed)/layout.tsx` and per-page) catches this — there is no current authorization bypass — but the comment on line 68-69 ("all /admin/* protected (no exclusion)") is misleading.

**Fix:** Anchor the lookahead to a path-segment boundary so only the exact `/admin/login` literal is excluded:
```ts
export const config = {
  matcher: ['/admin/((?!login(?:/|$)).*)', '/api/admin/:path*'],
};
```
Or, equivalently, use Next.js's `missing` matcher form to express "match /admin/* unless the next segment is exactly `login`" more precisely.

### WR-02: `findArchiveCandidates` can starve under one heavy session

**File:** `src/lib/archive.ts:70-94`
**Issue:** The candidate query selects up to `maxSessions * 100 = 10000` `session_id` rows from `messages` ordered (implicitly) by Postgres internal order. The dedupe loop bails as soon as `seen.size >= maxSessions`. If a single session has ≥10 000 messages older than 180 days, the entire row budget is consumed by that one session_id and no other candidate sessions are ever discovered. The next cron run will hit the same session again (idempotent, but wasteful) and other archivable sessions stay forever in the hot tier.

For Joe's expected volume this is unlikely, but it's a real correctness gap: the function's contract is "up to N distinct session_ids that have ≥1 message older than 180d," and that contract can be violated by row distribution.

**Fix:** Either ask Postgres for distinct session_ids directly (preferred), or sort the messages query to interleave sessions:
```ts
// Preferred — single distinct query, no N×100 overshoot:
const { data, error } = await supabaseAdmin.rpc('find_archive_candidate_sessions', {
  cutoff_iso: cutoffISO,
  max_sessions: maxSessions,
});
// supabase function: select distinct session_id from messages
//   where created_at < cutoff_iso limit max_sessions;
```
Or as a no-migration patch, order by `session_id` so the row-budget walks across sessions:
```ts
.lt('created_at', cutoffISO)
.order('session_id', { ascending: true })
.limit(maxSessions * 100);
```

### WR-03: `buildAdminUrl` falls back to `http://localhost:3000` in production if env is incomplete

**File:** `src/lib/email.ts:46-52`
**Issue:** If neither `NEXT_PUBLIC_SITE_URL` nor `VERCEL_URL` is set at request time, `buildAdminUrl` silently returns `http://localhost:3000/admin/sessions/<id>`. This is unreachable from Joe's phone and breaks the per-session notification CTA. `NEXT_PUBLIC_SITE_URL` is not in `env.ts`'s Zod schema, so a typo or missing var fails open without surfacing in env validation. `VERCEL_URL` is set automatically by Vercel but only on Vercel-hosted previews and prod — not on self-hosted or background invocations from non-edge contexts.

**Fix:** Add `NEXT_PUBLIC_SITE_URL` to `env.ts` (optional with explicit fallback documented), and on missing prod URL, log a warning rather than silently emitting localhost:
```ts
function buildAdminUrl(session_id: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (!base) {
    log({ event: 'admin_url_no_base', session_id }, 'warn');
    return `/admin/sessions/${session_id}`; // relative — recipient can't click but link won't 404 to localhost
  }
  return `${base}/admin/sessions/${session_id}`;
}
```

### WR-04: heartbeat cron does not refresh `heartbeat:classifier` — `/admin/health` can show stale even when classifier is healthy

**File:** `src/app/api/cron/heartbeat/route.ts:53-88`
**Issue:** `warmPromptCache()` writes `heartbeat:anthropic` (line 79) but never writes `heartbeat:classifier`. The classifier key is only refreshed inside `/api/chat`'s `onFinish` (chat/route.ts:307-311). On a low-traffic day with no chat turns, `/admin/health` will show the classifier heartbeat as `—` or stale, even though `pingClassifier()` itself succeeds — and Joe could read the dashboard as "classifier broken" when it's just idle. The dep grid does still show classifier=ok from the live ping, but the heartbeat row gives a misleading second signal.

**Fix:** Also set `heartbeat:classifier` whenever the classifier ping succeeds in the heartbeat cron:
```ts
// after the Promise.all of timed pings (line 100-107):
if (classifierPing.value === 'ok') {
  await redis.set('heartbeat:classifier', Date.now(), { ex: 120 });
}
if (anthropicPing.value === 'ok' && !llmPrewarmEnabled) {
  // also refresh anthropic when prewarm is disabled
  await redis.set('heartbeat:anthropic', Date.now(), { ex: 120 });
}
```

### WR-05: abuse page caps each query at 100 — when both branches saturate, oldest are silently dropped

**File:** `src/app/admin/(authed)/abuse/page.tsx:27-47, 86-87`
**Issue:** The two queries each `limit(100)`, then merge + dedupe + sort + slice top 100. If classifier-flagged > 100 OR deflection > 100 in the 90-day window, the older entries are silently dropped before merging. The "Showing last 100 flagged events" hint (AbuseTable.tsx:77) is rendered when `merged.length > 100`, but `merged.length` itself is bounded by 200 — so the user has no signal that, say, 250 deflections happened. At sustained abuse this misleads triage.

**Fix:** Either widen the per-query limit (200-300 each is still cheap at expected volume), or compute the two `count: 'exact'` queries first, then conditionally widen the row pull when totals exceed the merged target:
```ts
// Option A — widen to 200 each, still slice top 100, but show real total:
.limit(200)
// then in render: pass the sum-of-real-counts (via head:true count) so
// "Showing last 100 of N flagged events" shows N from the count() not the
// row buffer.
```

### WR-06: `archiveSession` re-uploads full transcript every run (path drifts month-by-month)

**File:** `src/lib/archive.ts:103-138`
**Issue:** Each run of `archiveSession`:
1. SELECTs the entire current transcript (any age)
2. Uploads to `archive/<current-yyyy>/<current-mm>/<id>.jsonl.gz`
3. DELETEs only rows older than 180d

If a session is re-archived in a later month (because new old rows aged into the >180d window), step 2 writes to a new path with the current month, leaving the May archive in place from the prior run and a June archive at a different key. Same content (or supersetting content) lives at two paths. Over time, the same session can have 10+ archive paths, each holding a snapshot.

This isn't a data-loss bug (more storage = safer), but it's wasteful, and on lookup someone asking "where's session X archived?" must scan all monthly prefixes.

**Fix:** Either pin the archive path to the session's creation month (stable), or use a single canonical path without month grouping:
```ts
function archivePath(session_id: string): string {
  // Canonical, stable path — upsert overwrites in place:
  return `archive/${session_id}.jsonl.gz`;
}
// If you want monthly grouping for browsability, derive month from session.created_at,
// not new Date():
function archivePath(session_id: string, sessionCreatedAt: Date): string {
  const year = sessionCreatedAt.getFullYear();
  const month = String(sessionCreatedAt.getMonth() + 1).padStart(2, '0');
  return `archive/${year}/${month}/${session_id}.jsonl.gz`;
}
```

## Info

### IN-01: `TracePanel` admin variant is not actually click-locked

**File:** `src/components/TracePanel.tsx:56-78`
**Issue:** When `alwaysExpanded=true`, `<details>` is rendered with `open={true}` and `onToggle` set to `undefined`. `aria-disabled` is set on the summary, but `aria-disabled` does not prevent native click toggling on `<details>`. A user clicking the summary collapses the panel; React then re-renders with `open=true` and (depending on browser) the panel may flicker or stay closed until the next React commit. For an admin-only path this is cosmetic, but the lockdown is incomplete.

**Fix:** Either render a non-`<details>` always-open block in the admin variant, or call `e.preventDefault()` on toggle attempts:
```tsx
<details
  open
  onToggle={
    alwaysExpanded
      ? (e) => { (e.target as HTMLDetailsElement).open = true; }
      : (e) => setOpenState((e.target as HTMLDetailsElement).open)
  }
  ...
>
```
Better: when `alwaysExpanded`, render `<div>` + `<div>` content directly, dropping `<details>` entirely.

### IN-02: One-time OAuth claims-shape diagnostic remains as committed code

**File:** `src/app/auth/callback/route.ts:53-67`
**Issue:** The diagnostic log captures `JSON.stringify(claimsData?.claims).slice(0, 1000)` — a 1KB blob containing OAuth claim fields (sub, login, email metadata) — into Pino logs on every successful OAuth exchange, not just the first one. The comment says "Remove this log after Joe confirms the shape," but there's no automatic gate (e.g. a one-time Redis flag or env toggle) to prevent it from running indefinitely.

**Fix:** Either gate it on a redis-NX one-shot key (refreshes once per deploy) or remove it after the first successful login:
```ts
const claimed = await redis.set('oauth_debug_logged', '1', { ex: 86400, nx: true });
if (claimed === 'OK') {
  const { data: claimsData } = await supabase.auth.getClaims();
  log({ event: 'oauth_debug_claims_shape', claims_preview: ... });
}
```
Or just delete the block once the production shape is confirmed.

### IN-03: `process.env` direct reads in client + server contexts bypass the Zod schema

**File:** `src/lib/email.ts:49-50`, `src/lib/supabase-browser.ts:19-20`, `src/proxy.ts:32-33`
**Issue:** Several modules read `process.env.X` directly instead of routing through the Zod-validated `env` from `src/lib/env.ts`. supabase-browser.ts has a documented reason (env.ts is server-only); proxy.ts has a runtime sequencing reason (env.ts may not have been parsed yet in middleware). But email.ts pulls `NEXT_PUBLIC_SITE_URL` and `VERCEL_URL` directly with no schema enforcement. Configuration drift is invisible until prod.

**Fix:** Add the two URL vars to `env.ts` (optional with `.url().optional()`) and read them through `env`:
```ts
// env.ts
NEXT_PUBLIC_SITE_URL: z.url().optional(),
VERCEL_URL: z.string().optional(),

// email.ts
import { env } from './env';
const base = env.NEXT_PUBLIC_SITE_URL ?? (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : null);
```

### IN-04: Magic threshold strings repeated across alarms.ts

**File:** `src/lib/alarms.ts:68, 122, 153, 174`
**Issue:** Thresholds (`>= 300` cents, `> 0.02` ratio, `>= 5` distinct IPs, `windowHours=1`, `windowMinutes=10`) are inline literals. The spend-cap value `300` also lives in `redis.ts`'s `isOverCap` definition (CONTEXT D-D-07); divergence between the two would silently break the alarm contract.

**Fix:** Hoist to named constants at module top, or — better — import the spend-cap constant from `redis.ts` so it cannot drift:
```ts
import { SPEND_CAP_CENTS } from './redis';
// or
const ALARM_SPEND_CAP_CENTS = 300; // mirrors redis.ts SPEND_CAP_CENTS
const ALARM_ERROR_RATIO = 0.02;
const ALARM_RATE_LIMIT_DISTINCT_IPS = 5;
```

### IN-05: `streamText_error` path persists with `reason: 'offtopic'` as a closest-fit hack

**File:** `src/app/api/chat/route.ts:392-419`
**Issue:** The `onError` handler persists a deflection turn with `reason: 'offtopic'` and a literal `deflection_text: '[streamText error]'`. The comment explicitly notes this is a closest-fit choice ("admin can grep stop_reason to distinguish stream failures from real off-topic deflections via the deflection_text marker above"). The /admin/abuse view filters on `stop_reason LIKE 'deflection:%'` and would show `[streamText error]` content as if it were a real off-topic deflection, polluting abuse triage.

**Fix:** Add a dedicated reason or stop_reason marker for streamText failures so they can be filtered out of abuse views:
```ts
// persistence.ts: extend allowed `reason` union to include 'streamerror'
// alarms.ts checkErrorRate: include reason='streamerror' as an error signal
// admin/abuse/page.tsx: exclude reason='streamerror' from abuse view
```
This also gives `checkErrorRate` a cleaner signal than the current "empty content + non-deflection stop_reason" heuristic.

---

_Reviewed: 2026-05-06T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
