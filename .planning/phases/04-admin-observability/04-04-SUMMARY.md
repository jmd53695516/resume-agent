---
phase: 04
plan: 04
subsystem: admin-cost-abuse-health
tags: [admin, cost, abuse, health, dashboard, force-dynamic]
requirements_addressed: [OBSV-05, OBSV-06]
dependency-graph:
  requires:
    - "Plan 04-01 — alarms_fired table; BETTERSTACK_DASHBOARD_URL env var"
    - "Plan 04-02 — requireAdmin() / NotAuthorized component"
    - "Plan 04-03 — (authed) route group + AdminNav + LocalTime + RelativeTime + isFreeMail (transitively, none consumed in this plan but the route-group convention is honored)"
    - "Phase 3 — src/lib/health.ts ping helpers + src/lib/redis.ts heartbeat keys"
  provides:
    - "/admin/cost — 24h/7d/30d cost dashboard with per-tool breakdown + cache-hit-rate color thresholds"
    - "/admin/abuse — last 100 classifier-flagged + rate-limit/spend-cap deflected messages joined to sessions"
    - "/admin/health — 5-dep status grid + heartbeat ages + last successful turn + last 5 alarms + optional BetterStack link"
    - "src/app/admin/components/CostCard.tsx — single window card primitive"
    - "src/app/admin/components/AbuseTable.tsx — compact one-line abuse list"
    - "src/app/admin/components/HealthGrid.tsx — 5-section health page primitive"
  affects: []
tech-stack:
  added: []
  patterns:
    - "(authed) route group convention adopted from Plan 04-03 — all three new pages live under src/app/admin/(authed)/{slug}/page.tsx so they inherit the requireAdmin layout guard + AdminNav"
    - "force-dynamic-only freshness contract (D-B-04) — every admin page sets `export const dynamic = 'force-dynamic'` and intentionally OMITS `export const revalidate = 60` (would be dead code under force-dynamic)"
    - "Two-query merge pattern for abuse log — supabase-js doesn't cleanly support OR across distinct conditions in a join shape, so classifier-flagged + deflection rows are fetched in parallel, deduped by message id, sorted desc, sliced top 100"
    - "Per-page belt-and-suspenders requireAdmin() at the top of every server component (D-A-03) — layout-level guard at (authed)/layout.tsx is necessary but not sufficient under parallel routes / loading boundaries"
key-files:
  created:
    - "src/app/admin/components/CostCard.tsx"
    - "src/app/admin/components/AbuseTable.tsx"
    - "src/app/admin/components/HealthGrid.tsx"
    - "src/app/admin/(authed)/cost/page.tsx"
    - "src/app/admin/(authed)/abuse/page.tsx"
    - "src/app/admin/(authed)/health/page.tsx"
    - "tests/admin/cost-page.test.tsx"
    - "tests/admin/abuse-page.test.tsx"
    - ".planning/phases/04-admin-observability/04-04-SUMMARY.md"
  modified: []
decisions:
  - "Pages mounted under (authed)/ route group (Plan 04-03 convention) instead of plan-frontmatter-listed src/app/admin/{slug}/page.tsx paths — the wave_context override and the live route-group structure are the source of truth; URLs unchanged"
  - "AbuseTable uses two parallel Supabase queries + array merge instead of a single OR-shaped query — supabase-js's .or() is awkward across foreign-table joins; merge is cheap at expected volume"
  - "Heartbeat ages display via RelativeTime (Plan 04-03 helper) — the heartbeat key value is a Date.now() ms number, converted to ISO string before passing"
metrics:
  duration: "~6 min"
  tasks_completed: 3
  files_changed: 8
  commits: 5
  completed_date: "2026-05-07"
---

# Phase 4 Plan 04: Cost / Abuse / Health Admin Pages Summary

Wave 3 plan B for Phase 4 — the remaining three admin pages live. `/admin/cost` renders three time-window cards (24h/7d/30d) each showing total dollars, request count, per-tool cost breakdown, and color-coded cache-hit-rate (green ≥80%, amber 60–79%, red <60%). `/admin/abuse` lists the last 100 classifier flags + rate-limit/spend-cap deflections within the 90d retention window, with verdict-mapped color coding (amber for classifier verdicts, red for deflections) and clickable rows linking to the parent session transcript. `/admin/health` renders five sections: a 5-dep status grid (anthropic/classifier/supabase/upstash/exa), heartbeat ages for the LLM-prewarm keys, last successful turn timestamp, last 5 alarm rows, and an optional BetterStack link surface. All three pages live under the `(authed)/` route group from Plan 04-03 so they inherit the AdminNav + requireAdmin shell. Twelve plan-scoped test cases pass; full repo holds at 271/271.

## What Was Built

### Task 1 — CostCard + /admin/cost (commits `e77d26e` RED + `6598187` GREEN)

`src/app/admin/components/CostCard.tsx` — single-window presentational card. Inputs: `CostWindowData` shape (`window | total_cents | request_count | per_tool[] | cache_read_tokens | input_tokens`). Renders:
- Window label ("Last 24 hours" / "Last 7 days" / "Last 30 days")
- Big dollar total via `dollars(cents)` helper (`$(cents/100).toFixed(2)`)
- Request count subline
- Per-tool breakdown list (sorted desc — caller's responsibility to sort) with each row showing `tool_name` and `dollars(cost) (share%)`
- Cache hit rate line: `read / (read + input) * 100`, colored green ≥80% / amber 60–79% / red <60%, with `text-muted-foreground` and `—` when denominator is zero
- Zero-spend window: "No requests in this window." muted copy replaces the breakdown sections

`src/app/admin/(authed)/cost/page.tsx`:
- `requireAdmin()` at top (Layer 2 of two-layer perimeter); `dynamic = 'force-dynamic'`; **NO** `revalidate`
- `Promise.all([buildWindow('24h'), buildWindow('7d'), buildWindow('30d')])`
- `buildWindow(w)` runs one Supabase query per window: `messages.select('cost_cents, tool_name, input_tokens, cache_read_tokens, role').gte('created_at', windowSinceISO(w)).in('role', ['assistant', 'tool'])`. The page then walks rows in JS to sum totals, count assistant rows, sum cache+input tokens, and bucket cost by tool_name (assistant rows without a tool_name go to `(no tool)`)
- 3-column grid on md+ (`grid-cols-1 md:grid-cols-3 gap-4`)

`tests/admin/cost-page.test.tsx` — 6 cases, all passing:
1. dollar total + request count rendered correctly
2. zero-spend empty-state copy
3. cache-hit ≥80% → green
4. cache-hit 60–79% → amber
5. cache-hit <60% → red
6. per-tool breakdown rendered in input-array order (caller-sorted desc)

TDD flow: failing test (`e77d26e`) → implementation (`6598187`) → 6/6 GREEN.

### Task 2 — AbuseTable + /admin/abuse (commits `1358865` RED + `414bac7` GREEN)

`src/app/admin/components/AbuseTable.tsx`:
- `verdictLabel(verdict, stop)` mapping: `injection` → amber/`injection`, `offtopic` → amber/`off-topic`, `sensitive` → amber/`sensitive`, `deflection:ratelimit` → red/`rate limit`, `deflection:spendcap` → red/`spend cap`, fallback → amber/raw
- One `<li>` per row with `<Link href={`/admin/sessions/${session_id}`}>` — full row clickable; uses `<LocalTime iso=... format="datetime" />` for timestamp, `<span class="font-mono text-xs">{ip_hash.slice(0,8)}</span>` for the truncated IP, and the verdict's mapped label/color
- Message preview truncated to 100 chars + ellipsis; rendered inside curly quotes (`&ldquo;…&rdquo;`)
- Empty state: centered "No flagged activity" + sub-copy
- Footer shown only when `totalCount > 100`: "Showing last 100 flagged events."

`src/app/admin/(authed)/abuse/page.tsx`:
- `requireAdmin()` at top; `dynamic = 'force-dynamic'`; **NO** `revalidate`
- Two parallel Supabase queries against `messages` joined to `sessions(email, ip_hash)`:
  1. classifier-flagged: `.not('classifier_verdict', 'is', null).neq('classifier_verdict', 'normal').gte('created_at', SINCE).order('created_at', desc).limit(100)`
  2. deflection: `.like('stop_reason', 'deflection:%').gte('created_at', SINCE).order('created_at', desc).limit(100)`
- `SINCE` = 90 days ago (matches D-D-04 retention window)
- Merge: dedupe by `message.id`, normalize `sessions` join (supabase-js can return single object OR array depending on FK shape — both handled), sort desc by created_at, slice top 100, pass `merged.length` as `totalCount` so the AbuseTable footer fires correctly when more than 100 rows matched

`tests/admin/abuse-page.test.tsx` — 6 cases, all passing:
1. empty state copy
2. injection verdict styled `text-amber-700`
3. ratelimit deflection styled `text-red-700` with label "rate limit"
4. ip_hash truncated to 8 chars + `font-mono`
5. footer renders when `totalCount > 100`
6. footer does NOT render when `totalCount <= 100`

TDD flow: failing test (`1358865`) → implementation (`414bac7`) → 6/6 GREEN.

### Task 3 — HealthGrid + /admin/health (commit `8b8c4cb`, no TDD per plan)

`src/app/admin/components/HealthGrid.tsx` — 5-section presentational component (server-renderable, no `'use client'`):
- **Section 1 — Dep grid**: 5 cards (`grid-cols-2 md:grid-cols-5`), each with the dep name and a status badge using `STATUS_CLASS` map (`bg-green-100 text-green-800` / `bg-amber-100 text-amber-900` / `bg-red-100 text-red-800`) — matches StatusBanner Phase 3 contract
- **Section 2 — Heartbeats**: two-column table (name | RelativeTime) for the LLM-prewarm keys; `—` when key absent
- **Section 3 — Last successful turn**: single muted line with `<RelativeTime iso=… />` or "No turns recorded yet."
- **Section 4 — Recent alarms**: list of last 5 with `ALARM_LABEL` mapping (`spend-cap` → "Spend cap tripped" etc.) plus `<LocalTime iso=… />`; empty-state "No alarms fired."
- **Section 5 — BetterStack link**: only renders when `betterstackUrl` non-null

`src/app/admin/(authed)/health/page.tsx`:
- `requireAdmin()` at top; `dynamic = 'force-dynamic'`; **NO** `revalidate`
- Single `Promise.all` of 9 awaitables in parallel:
  - 5 ping helpers (`pingAnthropic/Classifier/Supabase/Upstash/Exa` from `src/lib/health.ts`)
  - 2 raw Redis reads (`heartbeat:anthropic`, `heartbeat:classifier`) — values are `Date.now()` ms numbers (Plan 03-02 contract); converted to ISO via `new Date(Number(v)).toISOString()` before passing to `<RelativeTime />`
  - last successful assistant turn: `messages.eq(role='assistant').not('stop_reason', 'like', 'deflection:%').order(created_at desc).limit(1).maybeSingle()`
  - last 5 alarms: `alarms_fired.order(fired_at desc).limit(5)`
- BetterStack link is `env.BETTERSTACK_DASHBOARD_URL ?? null` — env.ts validates `.url()` schema; non-URL strings rejected at module load (T-04-04-03 mitigation)

## Test Results

| File | Tests | Status |
|---|---|---|
| `tests/admin/cost-page.test.tsx` | 6 | PASS |
| `tests/admin/abuse-page.test.tsx` | 6 | PASS |
| **Plan-scoped total** | **12** | **PASS** |
| Full repo suite | 271 | PASS (35 files) |

`npx tsc --noEmit` clean. `grep -rE "export const revalidate" src/app/admin/` returns zero matches — force-dynamic is the sole freshness mechanism across the entire admin surface.

## Plan Output Spec Answers

The plan output spec asks for these confirmations; here are answers based on what's verifiable without a live deploy preview:

1. **Live SUM cost query under 300ms (D-B-07 watch threshold)** — *Deferred to deploy preview.* The cost page issues 3 Supabase queries (one per window) within a single `Promise.all`. At expected free-tier volume (low thousands of message rows / month, with the 90d retention pruning), three indexed `created_at` range scans should complete well under 300ms. If the budget is exceeded, the D-B-07 escape hatch is documented in the page's inline comment: switch to pre-aggregated counters.

2. **Two-query merge ordering against real data** — *Deferred to deploy preview.* The merge logic dedupes by `message.id`, then sorts the merged array descending by `new Date(created_at).getTime()`, then slices top 100. Test fixtures cover the verdict mapping + truncation; ordering correctness is structurally guaranteed by the in-memory sort.

3. **All 5 health deps return 'ok' on a healthy preview deploy** — *Deferred to deploy preview.* Anthropic + classifier rely on `heartbeat:*` keys written by `/api/chat onFinish` (Plan 03-02); will read 'degraded' until at least one chat turn lands on the deploy. Supabase + Upstash + Exa are direct pings; expect 'ok' immediately.

4. **No admin page in this plan sets `revalidate = 60`** — **VERIFIED** via `grep -rE "export const revalidate" src/app/admin/` returning zero matches across the entire admin tree. Force-dynamic only.

5. **Note for Plan 04-06: alarms_fired widget reads from a table that is empty until 04-06 lands** — Acknowledged. The HealthGrid renders "No alarms fired." while the table is empty; once Plan 04-06's cron starts inserting rows, they surface automatically (no further admin-page changes needed).

6. **LocalTime/RelativeTime SSR-safe rendering hydration warnings** — *Deferred to deploy preview.* Both components use `suppressHydrationWarning` on the `<span>` they wrap (Plan 04-03 contract); the abuse page renders a `LocalTime` inside an `<a>`/`<Link>`, which has been used the same way on the sessions transcript page (Plan 04-03) without reported warnings. If a console warning surfaces on Joe's first preview pass, the fix is to remove `<LocalTime />` from inside the `<Link>` and place it adjacent.

## Wave-Context Path Override

The plan's frontmatter `files_modified` listed `src/app/admin/cost/page.tsx`, `src/app/admin/abuse/page.tsx`, and `src/app/admin/health/page.tsx`. Per the executor's wave-context, the actual paths are `src/app/admin/(authed)/cost/page.tsx`, `(authed)/abuse/page.tsx`, and `(authed)/health/page.tsx` — the `(authed)/` route group introduced by Plan 04-03 isolates auth-guarded pages from `/admin/login` (a sibling under `/admin/`) without changing URLs. All three pages now correctly inherit the `(authed)/layout.tsx` requireAdmin guard + AdminNav top-bar.

## Deviations from Plan

### [Wave-context override] Pages live under `(authed)/` route group, not directly under `src/app/admin/`

**Found during:** Plan ingestion (wave_context block in executor prompt).
**Issue:** Plan frontmatter `files_modified` references the legacy paths `src/app/admin/{cost,abuse,health}/page.tsx`. The actual repo has had the `(authed)/` route group since Plan 04-03 — pages under that group inherit the requireAdmin layout guard, the AdminNav top-bar, and the dynamic-only freshness contract.
**Fix:** Created the three pages under `src/app/admin/(authed)/{cost,abuse,health}/page.tsx`. Imports adjusted to reach up two parent dirs (`'../../components/CostCard'` etc. instead of `'../components/CostCard'`). URLs unchanged (`/admin/cost`, `/admin/abuse`, `/admin/health`) since route groups are URL-invisible.
**Files modified:** N/A — this is structural, not a fix to existing code.
**Commits:** `6598187` (cost), `414bac7` (abuse), `8b8c4cb` (health).

No other deviations. The plan executed exactly as authored beyond the wave-context path adjustment.

## Notes for Plan 04-06 (Cron Alarms)

- The HealthGrid alarms section reads from `public.alarms_fired` and renders the last 5 rows ordered desc by `fired_at`. The table will be empty until Plan 04-06 begins inserting rows from its cron handler; that's the expected pre-04-06 state. The "No alarms fired." copy renders fine in the empty case.
- The alarm condition labels in `HealthGrid.tsx` cover the four conditions Plan 04-06 will write: `spend-cap`, `error-rate`, `dep-down`, `rate-limit-abuse`. If 04-06 introduces a new condition string, add it to `ALARM_LABEL` in `HealthGrid.tsx`; otherwise it falls back to displaying the raw condition slug.
- `sendAlarm()` is already wired in `src/lib/email.ts` (Plan 04-05) — Plan 04-06's cron just needs to call it after inserting the row, with the `body_summary` payload matching what the cron computed.

## Notes for Manual Smoke (Deferred to Deploy Preview)

The plan's `<verification>` section calls out three manual smokes that need a deploy preview:

1. `/admin/cost` shows three cards with real data
2. `/admin/abuse` shows last 100 flags or empty state
3. `/admin/health` shows green ok badges for all 5 deps; alarms section "No alarms fired."

These are **deferred** until Joe spot-checks them on a Vercel preview, alongside the Plan 04-03 transcript-page smokes. All require live Supabase + GitHub OAuth + the heartbeat keys from at least one production-shaped chat turn.

## Self-Check

- src/app/admin/components/CostCard.tsx — FOUND
- src/app/admin/components/AbuseTable.tsx — FOUND
- src/app/admin/components/HealthGrid.tsx — FOUND
- src/app/admin/(authed)/cost/page.tsx — FOUND (calls requireAdmin, force-dynamic, no revalidate)
- src/app/admin/(authed)/abuse/page.tsx — FOUND (calls requireAdmin, force-dynamic, no revalidate)
- src/app/admin/(authed)/health/page.tsx — FOUND (calls requireAdmin, force-dynamic, no revalidate)
- tests/admin/cost-page.test.tsx — FOUND
- tests/admin/abuse-page.test.tsx — FOUND
- Commit e77d26e (Task 1 RED) — FOUND in git log
- Commit 6598187 (Task 1 GREEN) — FOUND in git log
- Commit 1358865 (Task 2 RED) — FOUND in git log
- Commit 414bac7 (Task 2 GREEN) — FOUND in git log
- Commit 8b8c4cb (Task 3) — FOUND in git log
- 12/12 plan-scoped tests passing
- 271/271 full-repo tests passing
- npx tsc --noEmit clean
- grep -rE "export const revalidate" src/app/admin/ — zero matches (force-dynamic is the sole freshness mechanism)

## Self-Check: PASSED
