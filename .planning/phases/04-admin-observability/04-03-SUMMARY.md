---
phase: 04
plan: 03
subsystem: admin-shell
tags: [admin, sessions, transcript, trace-panel, route-group, ssr]
requirements_addressed: [OBSV-03, OBSV-04]
dependency-graph:
  requires:
    - "Plan 04-01 — shadcn Table + Badge primitives at src/components/ui/{table,badge}.tsx"
    - "Plan 04-02 — requireAdmin() / NotAuthorized component / supabaseBrowser singleton / proxy.ts /admin/login exclusion"
    - "Plan 04-05 — canonical isFreeMail() + FREE_MAIL_DOMAINS at src/lib/free-mail-domains.ts (consumed instead of inline fallback)"
  provides:
    - "TracePanel `alwaysExpanded?: boolean` admin variant (consumed by Plan 04-04 transcript-style admin UI if any)"
    - "MessageBubble `alwaysExpandTrace?: boolean` prop on assistant variant"
    - "AdminNav (consumed by every (authed) admin page; mounts in (authed)/layout.tsx)"
    - "LocalTime + RelativeTime SSR-safe time-display helpers (consumed by Plan 04-04 AbuseTable + future admin pages)"
    - "SessionsTable component (server-rendered shadcn table; could be reused on /admin/cost session list if needed)"
    - "/admin shell — (authed) route group + layout requireAdmin() + AdminNav + /admin → /admin/sessions redirect"
    - "/admin/sessions list page (last 100, URL-driven sort)"
    - "/admin/sessions/[id] transcript viewer with always-expanded traces"
tech-stack:
  added: []
  patterns:
    - "Next.js App Router route group `(authed)` to separate auth-guarded layout from `/admin/login` (login is sibling, not child of authed shell)"
    - "Discriminated-union prop extension on MessageBubble — added `alwaysExpandTrace?: boolean` only to assistant variant; user variant keeps `alwaysExpandTrace?: undefined` to preserve narrowing"
    - "data-variant=admin|chat attribute on TracePanel root element — single data-testid (preserves Phase 3 E2E selectors), variant disambiguated via attribute"
    - "supressHydrationWarning + useEffect bridge for browser-locale time rendering on SSR'd pages (LocalTime/RelativeTime)"
    - "Whitelisted searchParams parsing for sort/dir (T-04-03-01 mitigation) — never pass raw user string to supabase order()"
    - "rowsToBubbles() reconstruction — persistence stores assistant/tool as separate rows; transcript page reassembles into parts[] shape MessageBubble expects (Phase 3 D-D-04 contract)"
key-files:
  created:
    - "src/app/admin/layout.tsx (thin pass-through)"
    - "src/app/admin/(authed)/layout.tsx"
    - "src/app/admin/(authed)/page.tsx"
    - "src/app/admin/(authed)/sessions/page.tsx"
    - "src/app/admin/(authed)/sessions/[id]/page.tsx"
    - "src/app/admin/components/AdminNav.tsx"
    - "src/app/admin/components/LocalTime.tsx"
    - "src/app/admin/components/RelativeTime.tsx"
    - "src/app/admin/components/SessionsTable.tsx"
    - "tests/components/trace-panel-admin-variant.test.tsx"
    - "tests/admin/sessions-page.test.tsx"
    - ".planning/phases/04-admin-observability/04-03-SUMMARY.md"
  modified:
    - "src/components/TracePanel.tsx"
    - "src/components/MessageBubble.tsx"
decisions:
  - "Route group `(authed)` for auth-guarded admin pages — `/admin/login` (Plan 04-02) is a child of `/admin/` so a layout-level requireAdmin() at src/app/admin/layout.tsx as plan-authored would render <NotAuthorized /> for unauth users visiting /admin/login and break the OAuth sign-in flow. Route group preserves URLs (parens-wrapped) and isolates the auth-guarded shell."
  - "Imported canonical isFreeMail from @/lib/free-mail-domains (Plan 04-05) instead of plan-suggested inline fallback — Plan 04-05 already shipped, the conditional 'if not yet present' is false, single source of truth is cleaner."
  - "data-variant attribute (not duplicate data-testid) for distinguishing TracePanel chat vs admin renders — preserves Phase 3 E2E test selectors verbatim."
  - "MessageBubble alwaysExpandTrace defined as `?: undefined` on user variant + `?: boolean` on assistant variant — keeps the discriminated union narrowing tight and Phase 3 ChatUI callsite (no third prop) type-checks unchanged."
metrics:
  duration: "~12 min"
  tasks_completed: 6
  files_changed: 13
  commits: 7
  completed_date: "2026-05-06"
---

# Phase 4 Plan 03: Admin Shell + Sessions List + Transcript Viewer Summary

Wave 3 plan A for Phase 4. TracePanel + MessageBubble extended with admin-variant props (no Phase 3 regression — 49/49 component tests pass with the originals + the 4 new admin-variant tests). The `/admin` shell is wired end-to-end: a thin pass-through `src/app/admin/layout.tsx` lets `/admin/login` render unauth, and a Next.js route group `(authed)/layout.tsx` mounts the requireAdmin() guard + AdminNav top-bar + auth-protected pages. `/admin/sessions` lists the last 100 sessions in a 6-column shadcn Table with URL-driven sort (date | domain), PRIORITY/flagged badges, and row-link navigation. `/admin/sessions/[id]` reconstructs persisted assistant/tool rows into the AI SDK parts shape MessageBubble expects, then renders with `alwaysExpandTrace={true}` so every tool trace is forced open with the "Tool trace" label. 259/259 full-repo tests pass; tsc clean; zero `revalidate = 60` in admin (force-dynamic is the sole freshness mechanism).

## What Was Built

### Task 1 — TracePanel `alwaysExpanded` admin variant (commits `ced917a` test + `d496991` impl)

`src/components/TracePanel.tsx` extended with `alwaysExpanded?: boolean` (default `false`):
- When `false`/undefined: behavior **byte-for-byte identical** to Plan 03-03 — collapsed initial state, chevron toggles, label "See what I did".
- When `true`: forced `open`, chevron hidden, label changes to "Tool trace", `onToggle` is `undefined` (clicking summary does nothing), `aria-disabled` on summary.
- New `data-variant={alwaysExpanded ? 'admin' : 'chat'}` attribute on the root element. Streaming-state line gets the same attribute.
- Existing `data-testid={`trace-${toolCallId}`}` preserved — Phase 3 E2E tests don't need to change.

`tests/components/trace-panel-admin-variant.test.tsx` — 4 cases, all passing:
- chat default: collapsed, "See what I did" label, data-variant=chat
- admin: open, "Tool trace" label, data-variant=admin
- admin: zero `<svg>` elements (chevron hidden)
- streaming + admin: streaming line still renders, data-variant=admin

TDD flow: failing test (`ced917a`) → implementation (`d496991`) → 4/4 GREEN.

### Task 2 — MessageBubble `alwaysExpandTrace` forwarding (commit `17d5feb`)

Discriminated-union extended:
```ts
type MessageBubbleProps =
  | { role: 'user'; text: string; parts?: undefined; alwaysExpandTrace?: undefined }
  | { role: 'assistant'; parts: Part[]; text?: undefined; alwaysExpandTrace?: boolean };
```

Inside the assistant branch, `<TracePanel ... />` now receives `alwaysExpanded={props.alwaysExpandTrace ?? false}`. User branch unchanged. `stripMarkdownHeaders` (D-I-07) and the text → MetricCard → TracePanel render order (D-D-04) are byte-preserved.

Phase 3 callsite verification: `src/components/ChatUI.tsx` calls `<MessageBubble role="assistant" parts={...} />` with NO third prop — type-checks cleanly because `alwaysExpandTrace` is optional, and the assistant branch's TracePanel receives `false` (chat default).

### Task 3 — Admin shell with route group (commit `999738d`)

**Critical deviation from plan path:** the plan called for `src/app/admin/layout.tsx` to call `requireAdmin()` directly. That breaks `/admin/login` (Plan 04-02's OAuth entry, sibling route under `/admin/`) — an unauth visitor would render NotAuthorized instead of the GitHub sign-in button. Restructured to:

- **`src/app/admin/layout.tsx`** — thin pass-through (`return <>{children}</>;`). Documented why.
- **`src/app/admin/(authed)/layout.tsx`** — auth-guarded shell. `requireAdmin()` at top → `<NotAuthorized />` on null; otherwise mounts `<AdminNav />` + `<main>{children}</main>`. `dynamic = 'force-dynamic'`. NO `revalidate = 60` (dead code under force-dynamic).
- **`src/app/admin/(authed)/page.tsx`** — `redirect('/admin/sessions')` (D-B-02).
- **`src/app/admin/components/AdminNav.tsx`** — client component. 4 nav items (Sessions/Cost/Abuse/Health), active state via `border-b-2 border-[--me]` + `font-semibold`, Refresh button calls `router.refresh()`, Sign out calls `supabaseBrowser.auth.signOut()` then `router.push('/')`.

Route groups don't change URLs — `/admin/sessions` resolves at the same path whether the file is `admin/sessions/page.tsx` or `admin/(authed)/sessions/page.tsx`.

### Task 4 — LocalTime + RelativeTime helpers (commit `305eeeb`)

`src/app/admin/components/LocalTime.tsx` — `'use client'`, `useState(iso)` + `useEffect` → `toLocaleString()` (or `.toLocaleDateString()` / `.toLocaleTimeString()` per `format` prop). NaN guard returns raw ISO. `<span suppressHydrationWarning>` wraps the text.

`src/app/admin/components/RelativeTime.tsx` — `'use client'`, `Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })` with thresholds at 60s / 3600s / 86400s / 30d / 365d. NaN guard returns raw ISO. Same `suppressHydrationWarning` pattern.

### Task 5 — SessionsTable + /admin/sessions page (commit `558c759`)

`src/app/admin/components/SessionsTable.tsx`:
- 6 columns: Email, Domain, When (RelativeTime), Flags, Cost (`$X.YY`), Turns
- Empty state: "No sessions yet" + sub-copy
- Sort headers: Domain and When are wrapped in `<Link>` with `sortHref()` that flips dir on the active column
- Active sort column: `font-semibold` className on `<TableHead>`
- Each row is 6 `<Link href={`/admin/sessions/${id}`}>` cells (full-row navigation; the row itself has `cursor-pointer hover:bg-muted/50`)
- PRIORITY badge for non-free-mail domains (imported from `@/lib/free-mail-domains` — Plan 04-05's canonical list, NOT the plan-suggested inline fallback)
- flagged badge when `session.flagged === true`

`src/app/admin/(authed)/sessions/page.tsx`:
- `requireAdmin()` at top (belt-and-suspenders to (authed) layout)
- `dynamic = 'force-dynamic'` (no `revalidate`)
- Whitelisted `parseSort()`: `sort=domain` → `'email_domain'`, anything else → `'created_at'`; `dir=asc` → `'asc'`, anything else → `'desc'` (T-04-03-01)
- `await searchParams` (Next.js 16 Promise contract)
- `supabaseAdmin.from('sessions').select(7 cols).order(sort, { ascending: dir === 'asc' }).limit(100)`
- Error path renders `text-destructive` line; success path hands off to `<SessionsTable />`

`tests/admin/sessions-page.test.tsx` — 6 cases, all passing:
- empty state copy
- dollar formatting (`$0.14`, `$3.12`)
- PRIORITY badge for non-free-mail
- flagged badge for `flagged=true`
- no PRIORITY for `gmail.com`
- active-sort header `font-semibold`

### Task 6 — Transcript viewer (commit `d8f7f9d`)

`src/app/admin/(authed)/sessions/[id]/page.tsx`:
- `requireAdmin()` at top
- `dynamic = 'force-dynamic'`
- `Promise.all([sessions.eq(id).single(), messages.eq(session_id).order(asc)])`
- `rowsToBubbles()` reconstruction: walks rows; for each `assistant` row, looks ahead for consecutive `tool` rows and assembles them into `parts: (TextPart | ToolPart)[]` matching the Phase 3 D-D-04 shape MessageBubble expects. `system` rows skipped; orphan `tool` rows ignored (only attached to a preceding assistant).
- Header card: `email · domain · ip_hash[:8] · turn_count · dollars(cost) · [PRIORITY]? · flagged? · LocalTime(created_at)`
- Renders bubbles with `<MessageBubble role="assistant" parts={b.parts} alwaysExpandTrace={true} />` for assistant turns (forces TracePanel admin variant), `<MessageBubble role="user" text={b.text} />` for user turns
- Empty messages → "This session has no messages."
- Session not found (single() returned no row) → "Session not found." in destructive text
- `isPriority` uses canonical `isFreeMail` from `@/lib/free-mail-domains`

## Test Results

| File | Tests | Status |
|---|---|---|
| `tests/components/trace-panel-admin-variant.test.tsx` | 4 | PASS |
| `tests/admin/sessions-page.test.tsx` | 6 | PASS |
| **Plan-scoped total** | **10** | **PASS** |
| Full repo suite | 259 | PASS (33 files) |

`npx tsc --noEmit` clean. `grep -rE "export const revalidate" src/app/admin/` returns zero matches.

## Phase 3 Compatibility Verification

Plan output spec asks: "Confirmation that Phase 3 callsites (ChatUI) compile + tests pass without modification."

- `src/components/ChatUI.tsx` was NOT modified by this plan (verified via `git diff master~7 -- src/components/ChatUI.tsx` showing zero diff for files in this plan's commit range).
- ChatUI's `<MessageBubble role="assistant" parts={...} />` callsite (no `alwaysExpandTrace` prop) type-checks cleanly with the extended discriminated union.
- All 8 component test files pass — including the Phase 3 originals for TracePanel/MessageBubble that don't pass the new props.
- TracePanel default-collapsed behavior (the `useState(false)` initial open) is unchanged when `alwaysExpanded` is false/undefined.

## Free-Mail Allowlist Refactor (Plan 04-05 Note Resolved)

Plan 04-05's SUMMARY noted: "When Plan 04-03 ships SessionsTable, it should import `isFreeMail` from `@/lib/free-mail-domains` directly — no inline allowlist needed."

Done. Both `src/app/admin/components/SessionsTable.tsx` and `src/app/admin/(authed)/sessions/[id]/page.tsx` import the canonical `isFreeMail` from `@/lib/free-mail-domains`. Zero inline allowlist code in this plan's output.

## Deviations from Plan

### [Rule 1 — Bug] Route group `(authed)` for auth-guarded admin layout

**Found during:** Task 3 implementation review.
**Issue:** The plan called for `src/app/admin/layout.tsx` to call `await requireAdmin()` and render `<NotAuthorized />` on null. But `/admin/login` (Plan 04-02 D-A-05 — the OAuth sign-in entry) is a child of `/admin/`, so the layout would wrap it. An unauthenticated visitor to `/admin/login` would render `<NotAuthorized />` instead of the GitHub sign-in button — broken sign-in flow, broken D-A-05 contract. The proxy excludes `/admin/login` from its redirect (so unauth users CAN reach the URL), but Next.js layout composition renders all parent layouts regardless of proxy.
**Fix:** Used Next.js App Router route group `(authed)`:
- `src/app/admin/layout.tsx` — thin pass-through (`return <>{children}</>;`) with comment explaining why
- `src/app/admin/(authed)/layout.tsx` — the auth-guarded shell
- `src/app/admin/(authed)/page.tsx`, `.../sessions/page.tsx`, `.../sessions/[id]/page.tsx` — protected pages

URLs are unaffected (parens-wrapped folders are URL-invisible), per-page `requireAdmin()` (D-A-03 belt-and-suspenders) is preserved, and `/admin/login` renders unauth without the `<NotAuthorized />` short-circuit.

**Files modified:** `src/app/admin/layout.tsx` (created as thin pass-through, not as plan-prescribed auth-guard), `(authed)/` route group introduced for protected routes.
**Commit:** `999738d`

### [Rule 1 — Bug avoided] Used canonical free-mail allowlist instead of inline fallback

**Found during:** Task 5 implementation.
**Issue:** Plan instructed: "if Plan 04-05's free-mail allowlist not yet present, hardcode a minimal fallback list locally for this plan." Plan 04-05 IS present (its SUMMARY is in `.planning/phases/04-admin-observability/04-05-SUMMARY.md` with the canonical list at `src/lib/free-mail-domains.ts`). Hardcoding a fallback would create two sources of truth and a tech-debt refactor obligation that the plan output spec already flagged.
**Fix:** Imported `isFreeMail` from `@/lib/free-mail-domains` in both `SessionsTable.tsx` and the transcript page. No inline allowlist.
**Files modified:** `src/app/admin/components/SessionsTable.tsx`, `src/app/admin/(authed)/sessions/[id]/page.tsx`.
**Commits:** `558c759` (Task 5), `d8f7f9d` (Task 6).

## Layout/Spacing Tweaks Beyond UI-SPEC

Plan output spec asks for any UI-SPEC deviations. None applied — the AdminNav (`h-11`, `bg-muted`, `border-b-2 border-[--me]`, `font-semibold` active state), session header card (`rounded-lg border bg-[var(--panel)] p-4`), and SessionsTable shadcn `Table` defaults all match UI-SPEC §3 / §4 / §8 verbatim. The transcript bubbles inherit Phase 3 MessageBubble styling (D-I-05 amendment — both roles as bubbles), no overrides.

## Manual Smoke (deferred to deploy preview)

Plan §verification calls for two manual smokes that need a deploy preview with seeded sessions:

1. `/admin/sessions` shows last 100 sessions with sort + badges (route → table → click flow)
2. Click a session → `/admin/sessions/[id]` renders transcript with all tool traces visibly expanded (no chevron, label "Tool trace")

These are **deferred** until either (a) Joe spot-checks them on a Vercel preview after Plan 04-04 ships the remaining admin pages, or (b) Phase 4 close-out manual QA pass. Auth flow + SessionsTable empty state are covered by unit tests; the deploy-preview smokes verify the live Supabase + AdminNav router.refresh + transcript reconstruction path end-to-end.

## Notes for Future Plans

- **Plan 04-04** (Wave 3 plan B — cost / abuse / health pages): mounts pages at `/admin/(authed)/cost/page.tsx`, `/admin/(authed)/abuse/page.tsx`, `/admin/(authed)/health/page.tsx` (under the same `(authed)` group so they inherit the AdminNav + requireAdmin shell). All three should set `dynamic = 'force-dynamic'` and OMIT `revalidate`. AbuseTable can consume `RelativeTime` from `src/app/admin/components/RelativeTime.tsx`.
- **Plan 04-04** AdminNav already has `Cost`, `Abuse`, `Health` link items — no nav edits required.
- **Plan 04-06** (cron alarms): `sendAlarm()` from `src/lib/email.ts` is wired (Plan 04-05); /admin/health page (Plan 04-04) will likely render last 5 alarms from the `alarms_fired` table (Plan 04-01).

## Self-Check

- src/components/TracePanel.tsx contains `alwaysExpanded?: boolean` — VERIFIED
- src/components/MessageBubble.tsx contains `alwaysExpandTrace?: boolean` — VERIFIED
- src/app/admin/layout.tsx — FOUND (thin pass-through)
- src/app/admin/(authed)/layout.tsx — FOUND (calls requireAdmin)
- src/app/admin/(authed)/page.tsx — FOUND (redirects)
- src/app/admin/(authed)/sessions/page.tsx — FOUND
- src/app/admin/(authed)/sessions/[id]/page.tsx — FOUND
- src/app/admin/components/AdminNav.tsx — FOUND
- src/app/admin/components/LocalTime.tsx — FOUND
- src/app/admin/components/RelativeTime.tsx — FOUND
- src/app/admin/components/SessionsTable.tsx — FOUND
- tests/components/trace-panel-admin-variant.test.tsx — FOUND
- tests/admin/sessions-page.test.tsx — FOUND
- Commit ced917a (Task 1 RED) — FOUND
- Commit d496991 (Task 1 GREEN) — FOUND
- Commit 17d5feb (Task 2) — FOUND
- Commit 999738d (Task 3) — FOUND
- Commit 305eeeb (Task 4) — FOUND
- Commit 558c759 (Task 5) — FOUND
- Commit d8f7f9d (Task 6) — FOUND
- 10/10 plan-scoped tests passing
- 259/259 full-repo tests passing
- npx tsc --noEmit clean
- zero `export const revalidate` in src/app/admin/ (force-dynamic is the sole freshness mechanism)

## Self-Check: PASSED
