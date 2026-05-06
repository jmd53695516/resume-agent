# Phase 4: Admin & Observability - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning
**Mode:** Interactive (Joe selected ALL four gray areas: Admin auth gating, Dashboard IA & refresh, Emails & alarms, Retention & archive — all 13 sub-questions answered with the recommended default)

<domain>
## Phase Boundary

Phase 4 delivers the **operator-side stack**: a GitHub-OAuth-gated `/admin` dashboard with sessions/cost/abuse/health views, per-session email notifications with company-domain priority, four-condition alarm emails, an external synthetic monitor, three cron-driven scheduled jobs, and concrete hot/cold retention. Concretely:

- `/admin/*` and `/api/admin/*` routes gated by Supabase Auth + GitHub OAuth + `ADMIN_GITHUB_LOGINS` env-var allowlist. Middleware blocks at the perimeter; per-route checks are belt-and-suspenders.
- Sub-route IA: `/admin/sessions` (default landing), `/admin/sessions/[id]` (transcript viewer), `/admin/cost`, `/admin/abuse`, `/admin/health`. Shared layout with top-bar nav. SSR + 60s segment revalidate + manual refresh button — no client polling, no Supabase Realtime.
- Sessions list = last 100 rows from `sessions` ORDER BY created_at DESC, sortable by date/domain (shadcn Table primitive), with email/domain/timestamp/flagged/cost/turn columns. Click row → transcript viewer reusing Phase 3 `<MessageBubble>` + `<TracePanel>` + `<MetricCard>` with traces ALWAYS expanded (admin variant).
- Cost tracker computes live SUM queries on each page load: 24h/7d/30d windowed, GROUP BY tool_name for per-tool breakdown, cache_read_tokens / (cache_read + input) for hit rate.
- Abuse log lists `messages WHERE classifier_verdict NOT IN ('normal', NULL) OR stop_reason LIKE 'deflection:%'`, joined to sessions for hashed IP + email.
- Per-session email via Resend + React Email fires on **first user turn** (not session creation), idempotent via `sessions.first_email_sent_at`. Subject prefixed `[PRIORITY]` for non-free-mail domains.
- Alarm emails on hard spend-cap trip, error rate >2% over 10min, any `/api/health` dep down, ≥5 unique IP-hashes hitting rate limits within 1h. All four conditions checked by `/api/cron/check-alarms` every 5 min via cron-job.org. Per-condition Redis suppression key with 1h TTL.
- BetterStack synthetic monitor pings `/` every 3 min from outside Vercel (3 regions). Configured externally; `/admin/health` links to its public status page.
- cron-job.org pre-warm heartbeat at `/api/cron/heartbeat` every 5 min during US business hours (9am–6pm ET, M-F): pings Anthropic with the cached system prompt (cache-warm) + Supabase `select 1` + Redis `ping()` + Exa HEAD. **Cost trade-off explicit (see D-C-10).**
- Retention: `messages` archived to Supabase Storage (gzipped JSONL per session) at 180d via nightly cron, then hot rows deleted. Flagged user-message rows hard-deleted at 90d. `sessions` never deleted (captured emails indefinite).

**Not in Phase 4:**
- End-of-session feedback prompt — PROJECT.md "Active" lists it for Phase 4 but REQUIREMENTS.md has it as `OBSV-D3` (v2-deferred), and ROADMAP success criteria don't include it. Treated as **v2/deferred**; PROJECT.md drift to be reconciled at next `/gsd-transition`.
- Eval results dashboard at `/admin/evals/<run-id>` — Phase 5 / EVAL-14.
- Anthropic org-level $20/mo cap — operational task before Phase 5 LAUNCH-06; carryover from Phase 2 (SAFE-12).
- Daily digest email — v2 / OBSV-D1.
- Weekly question-clustering job — v2 / OBSV-D2.
- Custom domain + QR + resume link — Phase 5 / LAUNCH-*.

**Carrying forward from Phase 1 + Phase 2 + Phase 3:**
- `master` branch, npm, Node 22 LTS, sequential execution, no worktrees.
- shadcn/ui + Tailwind v4 — add `<Table>` primitive (`npx shadcn@latest add table`) for the data-density views.
- Supabase service-role client (`src/lib/supabase-server.ts`) for admin reads (bypasses RLS — no SELECT policies needed).
- Supabase Auth + GitHub OAuth — **first time we use Supabase Auth at all** (Phases 1–3 only used Supabase Postgres).
- Pino structured JSON logging via `src/lib/logger.ts` (Phase 3 D-I).
- `/api/health` (Phase 3 D-J) — alarm cron consumes its response; admin dashboard surfaces it on `/admin/health`.
- `messages` + `sessions` schema (Phase 1 migration; populated Phases 2–3) — Phase 4 adds aggregate queries + an archive bucket; only one new migration (D-G-01).
- TracePanel + MetricCard from Phase 3 reused in `/admin/sessions/[id]`.
- Per-condition Redis namespace `resume-agent:*` — Phase 4 adds `alarms:fired:<condition>` keys with 1h TTL.

</domain>

<decisions>
## Implementation Decisions

### Admin Auth Gating (A)

- **D-A-01:** Supabase Auth provider with **GitHub OAuth** as the only sign-in method. Configured in the Supabase dashboard (no code change beyond client setup). *Rationale: locked in PROJECT.md key decisions; free; minimal setup.*
- **D-A-02:** Allowlist sourced from new env var `ADMIN_GITHUB_LOGINS` — comma-separated GitHub usernames (e.g., `joedollinger`). Validated in `src/lib/env.ts` (zod, min length 1). Effectively a one-element list but format leaves room. Revoke = update env + redeploy.
- **D-A-03:** **Two-layer enforcement** (belt-and-suspenders):
  - **Layer 1 (middleware):** `src/middleware.ts` matches `/admin/:path*` and `/api/admin/:path*`; reads Supabase session via `@supabase/ssr` cookies; reads GitHub provider username from `session.user.user_metadata.user_name`; rejects if not in `ADMIN_GITHUB_LOGINS`.
  - **Layer 2 (per-route):** every `/admin/*` server component AND every `/api/admin/*` route handler invokes a single `requireAdmin()` helper at top-of-function. Server components: return `<NotAuthorized />` page. Route handlers: return `403 { error: 'not_authorized' }`.
  *Rationale: middleware is the perimeter (fast, edge-runtime-friendly); per-route check guarantees no leak if middleware misconfigures (e.g., matcher pattern bug). ROADMAP success #1 explicitly says "403 at the API middleware layer (not just UI)".*
- **D-A-04:** **GitHub login flow:**
  - Unauthed `/admin/*` → middleware redirects to `/admin/login`.
  - `/admin/login` shows a single "Sign in with GitHub" button (shadcn Button + Supabase Auth `signInWithOAuth({ provider: 'github' })`).
  - OAuth callback at `/auth/callback` (Supabase SSR pattern from `@supabase/ssr` docs) sets cookies, then redirects to `/admin/sessions`.
  - **Successfully-authed but non-allowlisted user:** `requireAdmin()` returns the 403 page **AND** calls `supabase.auth.signOut()` to clear the session. Page also includes a "go back to /" link. ROADMAP success #1 wording matched.
- **D-A-05:** `/admin/login` is the ONLY unauthed-accessible admin route (the `signInWithOAuth` button must render before auth exists). Middleware matcher excludes it.
- **D-A-06:** Logout: small "Sign out" button in `/admin` top-bar nav; calls `supabase.auth.signOut()` then `router.push('/')`.
- **D-A-07:** Failed-403 attempts emit a structured Pino warn line: `{event: 'admin_403', github_login, attempted_path}`. **Phase 5 may add an alarm condition** for ≥3 distinct logins hitting 403 in an hour; logged in Phase 4 to enable that, not auto-alarmed.

### Dashboard IA & Refresh (B)

- **D-B-01:** **Sub-route IA:** `/admin/sessions`, `/admin/sessions/[id]`, `/admin/cost`, `/admin/abuse`, `/admin/health`. Each is its own App Router page that SSRs its own data via the service-role Supabase client. Deep-linkable (transcript URLs are shareable internally).
- **D-B-02:** `/admin` is a server component that redirects to `/admin/sessions` (the default landing). No content of its own.
- **D-B-03:** Shared layout at `app/admin/layout.tsx` with: top-bar nav (Sessions / Cost / Abuse / Health / Sign out), refresh button (calls `router.refresh()`), `<NotAuthorized />` boundary fallback. `requireAdmin()` invoked in the layout's server component AND in each child page (D-A-03 belt-and-suspenders).
- **D-B-04:** **Refresh strategy:** SSR on each navigation; `revalidate = 60` segment config; manual "Refresh" button forces `router.refresh()`. **No client polling, no Supabase Realtime in Phase 4.** Joe spot-checks a few times a day, not staring at the dashboard. *Rationale: live-update cost/complexity not justified at expected volume; revisit in Phase 5 only if behavior changes.*
- **D-B-05:** `/admin/sessions` shows last 100 rows from `sessions` ORDER BY created_at DESC. Columns: `email`, `email_domain`, `created_at` (relative — "5 min ago"), `flagged` (badge), `total_cost_cents` (cents → dollars formatted), `turn_count`. Sort UI: clickable column headers (date, domain). shadcn Table primitive — no third-party data-table library.
- **D-B-06:** `/admin/sessions/[id]`: full transcript via `messages WHERE session_id = <id> ORDER BY created_at`. Reuses Phase 3 `<MessageBubble>` rendering — **admin variant ALWAYS expands `<TracePanel>` (no chevron-collapsed state)**. `<MetricCard>` renders inline as in chat. Session header shows email/domain/IP-hash/turn count/total cost/flagged/created_at.
- **D-B-07:** `/admin/cost`: live SUM queries on each page load. Three cards: 24h, 7d, 30d windows. Each card shows total `cost_cents`, request count, **per-tool breakdown** (`GROUP BY tool_name FROM messages WHERE tool_name IS NOT NULL`), and **cache-hit rate** (`SUM(cache_read_tokens) / NULLIF(SUM(cache_read_tokens) + SUM(input_tokens), 0)` displayed as `87.4%`). At expected free-tier volume (low thousands of messages/month), single-digit-millisecond SUM queries against indexed `created_at`. **No pre-aggregated rollups in Phase 4** — revisit only if observed >300ms page load.
- **D-B-08:** `/admin/abuse`: lists `messages WHERE classifier_verdict NOT IN ('normal') OR (classifier_verdict IS NULL AND stop_reason LIKE 'deflection:%')`, joined to `sessions` for `email`, `email_domain`, `ip_hash`. Sort by `created_at DESC`, last 100 rows. Columns: time, session email, IP-hash (first 8 chars), verdict-or-reason, message preview (first 100 chars), link to `/admin/sessions/<id>`.
- **D-B-09:** `/admin/health`: server-renders a fresh fetch to `/api/health`. Shows per-dep status (anthropic / classifier / supabase / upstash / exa) using same color tokens as `<StatusBanner>`. Adds the heartbeat ages (`heartbeat:anthropic`, `heartbeat:classifier`) and "last successful turn" timestamp. **Also: a list of last 5 alarms-fired** (queried from new `alarms_fired` table — see D-G-01) and a link out to BetterStack's public status page (`BETTERSTACK_DASHBOARD_URL` env var).
- **D-B-10:** **No CSV export, no transcript-edit, no session-delete UI in Phase 4.** Manual SQL only. (Operational tasks are out of scope for the dashboard.)

### Email Notifications & Alarms (C)

- **D-C-01:** **Resend + React Email** for all transactional sends (locked in TECH STACK; 3k/mo free tier sufficient). Single sender domain configured per Joe's domain (or fallback to `onboarding@resend.dev` for early dev). Joe handles the DNS config operationally before public deploy.
- **D-C-02:** **Per-session email** fires on **first user turn**, NOT on session creation. Trigger: in `/api/chat` route's `onFinish` callback, after `persistNormalTurn` for the FIRST user message of a session — gated on `sessions.first_email_sent_at IS NULL` — enqueue a Resend send via `waitUntil()` (research-validated pattern from Phase 2 ARCHITECTURE.md §Pattern 6). Idempotency via the same column (D-C-05).
- **D-C-03:** **Free-mail allowlist** (Claude's discretion to maintain): `gmail.com, yahoo.com, hotmail.com, outlook.com, live.com, msn.com, icloud.com, me.com, mac.com, protonmail.com, proton.me, aol.com, mail.com, yandex.com, yandex.ru, gmx.com, gmx.de, fastmail.com, fastmail.fm, pm.me, hey.com, duck.com, qq.com, 163.com, naver.com`. If `email_domain` is NOT in this set, subject is prefixed `[PRIORITY]`. Stored as a constant in `src/lib/free-mail-domains.ts`; small unit test verifies common cases.
- **D-C-04:** **Per-session email subject:** `[PRIORITY] new chat: <email_user>@<domain>` (non-free-mail) or `new chat: <email_user>@<domain>` (free-mail). Body (React Email): rendered first user message (sanitized — content escaped, no HTML), classifier_verdict + confidence, session-cost-so-far, **button link** to `https://<host>/admin/sessions/<id>`. Template at `src/emails/SessionNotification.tsx`.
- **D-C-05:** **Idempotency:** per-session email fires **exactly once** per session, gated by new column `sessions.first_email_sent_at timestamptz`. Atomic guard via `UPDATE sessions SET first_email_sent_at = now() WHERE id = ? AND first_email_sent_at IS NULL RETURNING id` — only proceed with the Resend send if the update returned a row. Concurrent `/api/chat` requests for the same session race on this UPDATE; only one wins.
- **D-C-06:** **Alarm conditions** (4 total per ROADMAP success #4):
  1. **Hard spend-cap tripped** — Redis spend counter ≥ 300 cents (mirror of Phase 2 SAFE-04 threshold).
  2. **Error rate >2% over 10min** — count messages with `stop_reason='error'` or null content+non-deflection, divided by total persisted turns in last 10 min. (Implementation may also use Pino logs queried from a Vercel log query — planner picks; Supabase-side count is preferred for self-containment.)
  3. **Any dependency down** — `/api/health` returns any non-`ok` status across the 5 deps.
  4. **≥5 unique IP-hashes hitting rate limits in 1h** — `messages JOIN sessions WHERE messages.stop_reason='deflection:ratelimit' AND messages.created_at > now() - interval '1 hour' GROUP BY sessions.ip_hash HAVING count >= 1` distinct count.
- **D-C-07:** **Alarm dispatcher**: new endpoint `/api/cron/check-alarms` runs all four checks; for each tripped condition, checks Redis suppression key `alarms:fired:<condition>`; if absent, sends Resend alarm email AND sets the key with 1h TTL. **Per-condition keys**, so e.g. `spend-cap-fired` doesn't suppress `dependency-down`. Each fire writes a row to `alarms_fired` table (D-G-01) for `/admin/health` "last 5 alarms" widget.
- **D-C-08:** **cron-job.org configuration** (operational; Joe sets up post-deploy):
  - `/api/cron/check-alarms` — every 5 min, all hours
  - `/api/cron/heartbeat` — every 5 min during US business hours (9am–6pm ET, Monday–Friday)
  - `/api/cron/archive` — daily at 03:00 ET
- **D-C-09:** **Cron auth**: every `/api/cron/*` endpoint reads `Authorization: Bearer <CRON_SECRET>` header (env var `CRON_SECRET`, ≥32 chars). Reject with 401 if absent or mismatched. Belt-and-suspenders: also reject if `req.method !== 'POST'`. Helper: `src/lib/cron-auth.ts`.
- **D-C-10:** **Heartbeat endpoint** = light-touch dependency pings + a single Anthropic prompt-cache-warming call.
  - **Pings:** Supabase `select 1`, Redis `ping()`, Exa HEAD on search root, `/api/health` self-call.
  - **Prompt-cache pre-warm:** one Sonnet call with the full cached system prompt + a hardcoded user message ("ping") + `maxOutputTokens: 1`. **Cost: ~2.5¢/call** (cache_read on ~85k tokens at $0.30/MTok = ~$0.026; output negligible). 5 min × 10 hours × 5 days/week = **~600 calls/week × 2.5¢ = ~$15/business-week**.
  - **Cost-vs-benefit caveat:** each pre-warmed recruiter session saves ~14¢ on cache_creation. Net positive only if ≥6 sessions/business-day land within 5 min of a heartbeat — uncertain at job-search volume. Planner should:
    1. Add an env var `HEARTBEAT_LLM_PREWARM` (default `true`) to disable the LLM-warm portion if cost outpaces benefit.
    2. Add the pre-warm-call cost to Pino's `event: 'heartbeat'` log so `/admin/cost` can attribute it correctly.
    3. Revisit cadence (5 min vs 15 min) in Phase 5 with real traffic data — for now, follow ROADMAP success #5's "every 5 min" wording.

### Retention & Cold Storage (D)

- **D-D-01:** **Hot table:** `messages` rows live in Postgres for 180 days from `created_at`. After that, archive then delete.
- **D-D-02:** **Cold storage:** Supabase Storage private bucket `transcripts-archive` (env: `SUPABASE_STORAGE_ARCHIVE_BUCKET`, default `transcripts-archive`). One file per session: `archive/<yyyy>/<mm>/<session_id>.jsonl.gz`. Each line is one message row (JSON-serialized, all columns + `tool_args` + `tool_result`). Gzip for size + reduced egress cost. Stays inside Supabase free-tier 1GB Storage cap for years.
- **D-D-03:** **Archive job:** `/api/cron/archive` runs daily at 03:00 ET via cron-job.org. Algorithm:
  1. Find candidate sessions: `SELECT DISTINCT session_id FROM messages WHERE created_at < now() - interval '180 days'`.
  2. For each session (max 100 per cron run to stay within Vercel's 60s function timeout):
     - SELECT all messages for that session (regardless of age — full transcript context).
     - JSONL-encode + gzip + upload to Storage at `archive/<yyyy>/<mm>/<session_id>.jsonl.gz` (overwrite OK).
     - DELETE FROM messages WHERE session_id = ? AND created_at < now() - interval '180 days'.
  3. **Idempotent**: re-running on already-archived sessions is a no-op (Storage upload is overwrite OK; DELETE on already-deleted rows is a no-op).
  4. Logs `event: 'archive_run'` with `sessions_archived`, `rows_archived`, `errors[]`.
- **D-D-04:** **Classifier-flag retention (90d):** Same daily cron also runs:
  ```sql
  DELETE FROM messages
  WHERE created_at < now() - interval '90 days'
    AND (classifier_verdict NOT IN ('normal') OR stop_reason LIKE 'deflection:%')
  ```
  Hard delete; row gone; abuse log only shows last 90d. Sessions row still records aggregate `flagged=true` boolean for indefinite tracking. Cron logs `rows_deleted_classifier_90d` for visibility.
- **D-D-05:** **Sessions table:** never auto-deleted. Indefinite retention per ROADMAP success #5 ("captured emails retained indefinitely"). Operator-only manual deletes via SQL if needed.
- **D-D-06:** **Restoring an archived transcript** (rare but useful): Phase 4 makes the data retrievable but does NOT ship a UI. Joe knows the file path convention; `supabase storage download archive/<yyyy>/<mm>/<session_id>.jsonl.gz` from the dashboard or CLI is enough. UI restore deferred (post-launch operational need only).
- **D-D-07:** **Storage bucket setup** (operational): private bucket created in Supabase dashboard before Phase 4 deploys; service-role key has read+write; no public read access. Configuration captured in `.env.example`.

### External Synthetic Monitor (E)

- **D-E-01:** **BetterStack** chosen over UptimeRobot. *Rationale: better 2026 free tier (10 monitors, 30s minimum check), bundled status page (positive portfolio signal), API for programmatic add/remove. UptimeRobot is the equally-acceptable substitute if Joe's preference reverses.*
- **D-E-02:** Monitor pings the public framing page (`/`) every 3 min from 3 geographic regions (US-east, US-west, EU). Expects HTTP 200. Joe's email (`JOE_NOTIFICATION_EMAIL` env var) is the alert channel; SMS optional via BetterStack's free tier.
- **D-E-03:** **Configured via BetterStack dashboard, not code.** Operational task during Phase 4 implementation. The `/admin/health` page links to the live BetterStack status URL via `BETTERSTACK_DASHBOARD_URL` env var.
- **D-E-04:** **No code-level integration.** BetterStack is purely external; Phase 4 doesn't read its data, doesn't have a webhook back. The justification IS the externality — catches Vercel-originated outages our own `/api/health` can't see (DNS issues, edge-network problems, account suspension).

### Logging Extensions (F)

- **D-F-01:** New Pino events introduced this phase (logger reused from Phase 3):
  - `event: 'admin_access'` — every successful `/admin/*` request: `github_login`, `path`
  - `event: 'admin_403'` — every middleware/route reject: `github_login` (or null), `reason`, `attempted_path`
  - `event: 'cron_run'` — every `/api/cron/*` invocation: `cron_name`, `duration_ms`, `status`, `items_processed`
  - `event: 'alarm_fired'` — when an alarm send happens: `condition`, `resend_send_id`, `suppression_until_ts`
  - `event: 'archive_run'` — per archive cron run: `sessions_archived`, `rows_archived`, `rows_deleted_classifier_90d`, `errors[]`
  - `event: 'heartbeat'` — per heartbeat cron run: `deps_pinged`, `latencies_ms`, `anthropic_cache_read_tokens`, `cost_cents`
  - `event: 'session_email_sent'` — per per-session email: `session_id`, `email_domain`, `is_priority`, `resend_send_id`, `latency_ms`
- **D-F-02:** All logs continue using existing Pino instance from `src/lib/logger.ts` (Phase 3 D-I). No new logger config.

### Schema Migration (G)

- **D-G-01:** **One new migration this phase:** `supabase/migrations/0002_phase4.sql`:
  ```sql
  -- per-session email idempotency (D-C-05)
  ALTER TABLE public.sessions ADD COLUMN first_email_sent_at timestamptz;

  -- alarm history for /admin/health "last 5 alarms" widget (D-B-09 + D-C-07)
  CREATE TABLE public.alarms_fired (
    id text primary key,
    condition text not null,
    fired_at timestamptz not null default now(),
    resend_send_id text,
    body_summary text
  );
  CREATE INDEX alarms_fired_created_at_idx ON public.alarms_fired (fired_at DESC);
  ALTER TABLE public.alarms_fired ENABLE ROW LEVEL SECURITY;
  -- service-role-only writes; no SELECT policies (admin reads via service role).
  ```

### Admin Auth Flow Files & Env (H)

- **D-H-01:** **New env vars** (extend `src/lib/env.ts` zod schema):
  - `ADMIN_GITHUB_LOGINS` (required, non-empty comma-separated)
  - `CRON_SECRET` (required, ≥32 chars)
  - `RESEND_API_KEY` (required, starts with `re_`)
  - `RESEND_FROM_EMAIL` (required, valid email; e.g., `agent@joedollinger.com` or `onboarding@resend.dev` for dev)
  - `JOE_NOTIFICATION_EMAIL` (required, valid email — destination for per-session and alarm emails)
  - `BETTERSTACK_DASHBOARD_URL` (optional, valid URL — link target on `/admin/health`)
  - `SUPABASE_STORAGE_ARCHIVE_BUCKET` (required, default `transcripts-archive`)
  - `HEARTBEAT_LLM_PREWARM` (optional boolean, default `true` — disables Anthropic cache-warm call if cost outpaces benefit)
  - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (added — needed for browser-side Supabase Auth client; were not previously needed because Phase 1–3 only used service-role)
- **D-H-02:** `src/lib/admin-auth.ts` (new) exports `requireAdmin()` + `getCurrentAdmin()` helpers consumed by middleware and per-route checks.
- **D-H-03:** `src/lib/supabase-browser.ts` (new) — `createBrowserClient` from `@supabase/ssr` for the GitHub OAuth button on `/admin/login`.
- **D-H-04:** Pre-commit hook (Phase 1 D-D) already scans for `NEXT_PUBLIC_*KEY*` patterns — verify it exempts `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon key is public by design per Supabase docs).

### Claude's Discretion

- Visual styling within shadcn norms — table density, badge colors, card layout.
- Exact React Email template prose and visual design (Joe reviews in PR — same flow as Phase 2 deflection copy authoring).
- BetterStack monitor cadence (3-min default; 1-min if Joe wants — affects free-tier check budget).
- Free-mail allowlist list grooming (start with the recommended set in D-C-03; add as encountered).
- Whether to also send alarm emails as plain text vs React Email (recommend plain text for alarms — readable on phone, no formatting friction; see Specifics).
- Archive bucket region/storage class (default Supabase Storage settings).
- Exact threshold for "error rate >2%" computation (10-min window is locked; minimum sample size to suppress false positives — e.g., require ≥10 turns in window — is Claude's discretion).
- Whether `/api/cron/heartbeat` rotates the cached prompt user-message text to avoid a rare cache-miss bug (default: stable single-string ping).
- Whether the alarm cron's "5 unique IPs" check uses `ip_hash` or `email` as the unique-identity dimension (default: `ip_hash` — matches OBSV-09 wording "unique IPs"; same recruiter on multiple IPs should still trigger).
- Top-bar nav active-state styling — recommend underline + bold; Claude picks.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 + Phase 2 + Phase 3 artifacts (patterns to extend)
- `.planning/phases/01-foundation-content/01-CONTEXT.md` — env.ts shape, pre-commit hook, atomic commits, system-prompt determinism contract.
- `.planning/phases/02-safe-chat-core/02-CONTEXT.md` — six-gate flow at `/api/chat` (where the per-session email side-effect threads in), spend-cap mechanism, deflection-copy authoring pattern, Redis namespace `resume-agent:*`.
- `.planning/phases/03-tools-resilience/03-CONTEXT.md` — `/api/health` endpoint, `<TracePanel>` + `<MetricCard>` reusables, fetch-health helper, Pino discipline rules, message persistence helpers (`persistNormalTurn`, `persistDeflectionTurn`, `persistToolCallTurn`).
- `.planning/phases/03-tools-resilience/03-04-PLAN.md` and any 03-04-SUMMARY.md — exact `/api/health` implementation Phase 4 alarm cron consumes.
- `supabase/migrations/0001_initial.sql` — `sessions` + `messages` schema; Phase 4 only adds `0002_phase4.sql` (D-G-01).

### Design & Scope
- `docs/superpowers/specs/2026-04-21-resume-agent-design.md` — §6 (Resilience), §7 (Phase 5 Admin & Observability — equivalent to GSD Phase 4) — read every word; the per-session-email + alarm-conditions + retention windows are spec-locked.
- `.planning/PROJECT.md` — Phase 4 active items; **note PROJECT.md/REQUIREMENTS.md drift on end-of-session feedback prompt** (treated as v2 per REQUIREMENTS.md, not Phase 4 — see Deferred).
- `.planning/REQUIREMENTS.md` — Phase 4 owns 11 OBSV REQ-IDs: OBSV-01..06, OBSV-08, OBSV-09, OBSV-13, OBSV-14, OBSV-15.
- `.planning/ROADMAP.md` — §Phase 4 5 success criteria. Goal-backward verifier checks against these exactly.

### Research (Phase 4-relevant excerpts)
- `.planning/research/SUMMARY.md` — Phase 4 stack picks (Resend, BetterStack, cron-job.org).
- `.planning/research/STACK.md` — Resend + React Email config; Supabase Auth + GitHub OAuth setup; cron-job.org HTTP cron pattern; `@supabase/ssr` middleware idioms; BetterStack vs UptimeRobot comparison.
- `.planning/research/ARCHITECTURE.md` — §Pattern 6 (`waitUntil()` for fire-and-forget side effects — used by per-session email sends to keep `/api/chat` response latency unaffected); §Pattern on RLS bypass via service role.
- `.planning/research/PITFALLS.md` — §Pitfall on Pino transports (no worker-thread transports on Vercel); §Pitfall on `getSession()` vs `getClaims()` server-side (use `getClaims()`); §Pitfall on rate-limit bypass via X-Forwarded-For (relevant to alarm condition #4).

### External docs for the planner's research step
- Supabase Auth Next.js Server-Side guide — current 2026 SSR pattern with `createServerClient` + `getClaims()`.
- `@supabase/ssr` API ref — middleware cookie pattern + `createBrowserClient` for the OAuth button.
- Supabase Auth GitHub OAuth provider config docs — provider scopes, redirect URLs.
- Resend Next.js docs + React Email integration — `Resend` client, `Email`, `Body`, `Container`, `Button`, `Link` components.
- React Email component library reference.
- BetterStack uptime monitor setup docs — region picker, alert channel config, status-page bundling.
- cron-job.org HTTP cron config — POST + bearer-auth header pattern.
- Supabase Storage Node SDK upload docs — `supabase.storage.from(bucket).upload(path, file, { contentType, upsert: true })`.
- Supabase Storage retention/lifecycle docs — currently no built-in lifecycle (we delete from Postgres; Storage retains until explicit delete).
- Anthropic prompt caching cost docs — for D-C-10 cost rationale (cache_read $0.30/MTok on Sonnet 4.6).
- Vercel `waitUntil()` API — for non-blocking email sends after response.
- Next.js 16 App Router middleware docs — matcher patterns, Edge runtime constraints.

### Knowledge base files
- (None new this phase — no KB content changes; emails are templates, not KB-sourced content.)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`src/middleware.ts`** — DOES NOT YET EXIST. Phase 4 creates it (first time we use Next.js middleware in this project).
- **[src/lib/supabase-server.ts](src/lib/supabase-server.ts)** — service-role admin client. Phase 4 uses it for admin reads (bypasses RLS).
- **[src/lib/env.ts](src/lib/env.ts)** — extends with 8+ new env vars (D-H-01).
- **[src/lib/redis.ts](src/lib/redis.ts)** — Phase 4 adds `alarms:fired:<condition>` keys with 1h TTL via `set(..., { ex: 3600, nx: true })` semantics; reads spend counter for alarm condition #1.
- **[src/lib/health.ts](src/lib/health.ts)** — already exists from Phase 3; alarm cron condition #3 imports it directly (or fetches `/api/health` for self-test).
- **[src/lib/persistence.ts](src/lib/persistence.ts)** — `persistNormalTurn` already records the first user turn; Phase 4 adds an idempotent email-fire trigger AFTER the FIRST persist via the `sessions.first_email_sent_at` guard (D-C-05).
- **[src/lib/logger.ts](src/lib/logger.ts)** — Pino instance reused for new event types (D-F-01).
- **[src/components/MessageBubble.tsx](src/components/MessageBubble.tsx)**, **[src/components/TracePanel.tsx](src/components/TracePanel.tsx)**, **[src/components/MetricCard.tsx](src/components/MetricCard.tsx)** — reused unchanged in `/admin/sessions/[id]` transcript viewer (admin variant always-expands traces — likely a prop).
- **[src/components/ui/](src/components/ui/)** — shadcn primitives. Phase 4 adds `<Table>` (`npx shadcn@latest add table`).
- **`src/app/api/health/route.ts`** — unchanged. Alarm cron + `/admin/health` consume its public response.
- **`src/app/api/chat/route.ts`** — `onFinish` callback gains the per-session email-fire branch (after `persistNormalTurn` succeeds and `first_email_sent_at IS NULL`); side-effected via `waitUntil()`.

### New modules Phase 4 will create

- `src/middleware.ts` — admin auth perimeter; matcher: `['/admin/:path*', '/api/admin/:path*']` excluding `/admin/login`.
- `src/lib/admin-auth.ts` — `requireAdmin()`, `getCurrentAdmin()` helpers.
- `src/lib/supabase-browser.ts` — `createBrowserClient` for the OAuth button.
- `src/lib/email.ts` — Resend client singleton; `sendSessionNotification(...)`, `sendAlarm(...)` helpers.
- `src/lib/free-mail-domains.ts` — allowlist constant + `isFreeMail(domain)` helper.
- `src/lib/cron-auth.ts` — bearer-token check helper.
- `src/lib/alarms.ts` — the four condition checks; suppression-key dispatcher; writes `alarms_fired` rows.
- `src/lib/archive.ts` — gzip-JSONL builder; Storage upload; classifier-row deleter; idempotency helpers.
- `src/emails/SessionNotification.tsx` — React Email template.
- `src/emails/AlarmFired.tsx` — React Email template (or plain-text formatter — Claude's discretion per Specifics).
- `src/app/admin/layout.tsx` — top-bar nav + `requireAdmin()` invocation.
- `src/app/admin/login/page.tsx` — sign-in-with-GitHub button (uses browser Supabase client).
- `src/app/admin/page.tsx` — redirects to `/admin/sessions`.
- `src/app/admin/sessions/page.tsx` — last 100 sessions table.
- `src/app/admin/sessions/[id]/page.tsx` — transcript viewer.
- `src/app/admin/cost/page.tsx` — 24h/7d/30d cost cards.
- `src/app/admin/abuse/page.tsx` — abuse log.
- `src/app/admin/health/page.tsx` — health dashboard + last-5-alarms widget.
- `src/app/admin/components/AdminNav.tsx` — top-bar nav with Refresh + Sign out.
- `src/app/admin/components/SessionsTable.tsx` — shadcn Table around the sessions data.
- `src/app/admin/components/CostCard.tsx` — single 24h/7d/30d card component.
- `src/app/admin/components/AbuseTable.tsx` — shadcn Table.
- `src/app/admin/components/HealthGrid.tsx` — per-dep status + heartbeats + alarms list.
- `src/app/admin/components/NotAuthorized.tsx` — 403 page (signs out + offers home link).
- `src/app/auth/callback/route.ts` — Supabase Auth OAuth callback handler (sets cookies, redirects to `/admin/sessions`).
- `src/app/api/cron/check-alarms/route.ts` — runs all four alarm checks; per-condition suppression.
- `src/app/api/cron/heartbeat/route.ts` — pings Supabase + Redis + Exa + (optionally) Anthropic prompt-cache warm.
- `src/app/api/cron/archive/route.ts` — daily archive + 90d classifier cleanup.
- `supabase/migrations/0002_phase4.sql` — schema additions (D-G-01).
- `tests/middleware/admin-perimeter.test.ts` — middleware reject test.
- `tests/lib/admin-auth.test.ts` — `requireAdmin()` allowlist match + signout-on-reject tests.
- `tests/lib/email.test.ts` — Resend client mocked; free-mail detection unit tests; idempotency-guard test.
- `tests/lib/alarms.test.ts` — each condition's threshold logic tested in isolation; suppression-key dispatcher test.
- `tests/lib/archive.test.ts` — gzip-JSONL roundtrip; batched-delete idempotency; 90d classifier cleanup test.
- `tests/cron/check-alarms.test.ts`, `tests/cron/heartbeat.test.ts`, `tests/cron/archive.test.ts` — auth-rejection tests, happy-path tests with mocked deps.
- `tests/admin/sessions-page.test.ts`, `tests/admin/cost-page.test.ts`, `tests/admin/abuse-page.test.ts` — server-component render tests with mocked Supabase.

### Established Patterns (do not deviate)

- `app/` imports from `lib/`; `lib/` never imports from `app/`.
- Atomic commits via `gsd-tools commit`; pre-commit hook runs.
- All `/api/cron/*` endpoints validate the bearer token at the very top — fail-closed.
- All `/api/admin/*` and `/admin/*` invocations call `requireAdmin()` at the very top — fail-closed.
- Service-role Supabase reads only on admin paths — never expose anon key for admin data (RLS-bypassing reads need service-role).
- Pino discipline: structured fields, no `console.log`, especially in error paths.
- Resend sends via `waitUntil()` — never block `/api/chat` response on email send.
- Side effects in `/api/chat onFinish` remain in `onFinish` — new email side effect goes inside `onFinish`, NOT inline before/around `streamText`.
- System-prompt determinism (Phase 1 D-E) — Phase 4 does NOT touch the system prompt; heartbeat cache-warming uses the IDENTICAL cached prefix.

### Integration Points

- **`/api/chat onFinish`** (Phase 2 + 3 file): after `persistNormalTurn`, conditional email fire — `if (persistedRoles.includes('user') && atomicallyClaimEmailFlag(session_id)) waitUntil(sendSessionNotification(session_id))`.
- **`/api/health`** (Phase 3 file): unchanged. Alarm cron (`condition #3`) consumes its public response (or imports `health.ts` directly).
- **`src/middleware.ts` (NEW)**: runs before every request matching `/admin/:path*` and `/api/admin/:path*` (excluding `/admin/login`).
- **`/admin/sessions/[id]`**: queries messages by `session_id`; renders via existing Phase 3 message components with admin variant always-expanding traces.
- **cron-job.org → `/api/cron/{check-alarms, heartbeat, archive}`** via Bearer `CRON_SECRET` — Joe configures each job in cron-job.org dashboard after Phase 4 deploy.
- **BetterStack → public framing page (`/`)** — purely external; no code integration beyond the link-out on `/admin/health`.
- **Resend → SMTP via Resend's API** — sender domain config is one-time DNS work, not in code.
- **Supabase Storage** (`transcripts-archive` bucket) — written by `/api/cron/archive`; read by Joe via Supabase dashboard CLI for now.

</code_context>

<specifics>
## Specific Ideas

- `/admin` top-bar nav uses subdued grey background — admin tools should look like tools, not products. No brand colors.
- Alarm email subject prefix: `[ALARM] resume-agent: <condition>` for clarity in inbox. Body is **plain text** (not React Email) — readable on phone, no formatting friction.
- Per-session email subject template: `[PRIORITY] new chat: <email_user>@<domain>` for company-domain, `new chat: <email_user>@<domain>` for free-mail. The `[PRIORITY]` flag is THE thing Joe scans inbox for — keep it stable across all priority sends.
- Heartbeat cost note: at ~85k cached system prompt × $0.30/MTok cache_read = ~2.5¢ per prompt-cache-warming ping. 5-min cadence × 10 business hours × 5 days/week = ~600 calls × 2.5¢ = ~$15/business-week. Trade-off: each "pre-warmed" recruiter session saves ~14¢ on cache_creation. Net positive only if ≥6 sessions/business-day land within 5 min of a heartbeat. Plan should include `HEARTBEAT_LLM_PREWARM` env var (default `true`) so Joe can disable the LLM-warm portion if cost outpaces benefit; revisit cadence in Phase 5 with traffic data.
- Transcript viewer in `/admin/sessions/[id]` renders inline metric card AND tool traces **always-expanded** — Joe wants the audit, not the chat experience. Likely a `<MessageBubble variant="admin" />` prop or a context.
- Sessions table sort: clickable column headers; default = `created_at DESC`. Filter optional but not blocking (Phase 4 ships without filter UI; Joe types into URL bar to navigate).
- Abuse log row shows: `<time> · <email_user>@<domain> · <ip_hash[:8]> · <verdict_or_reason> · <message[:100]>` — compact one-line readability.
- Cost-card cache-hit-rate displayed as percent with 1 decimal: `Cache hit rate: 87.4%`. Joe likes the number visible.
- Free-mail allowlist (D-C-03) is strict-match against `email_domain` (already lowercase-extracted at session creation, indexed). No email parsing at email-fire-time.
- The `/admin/health` page surfaces cron-job.org as the truth source for "are crons firing" — link out to cron-job.org dashboard. We don't pull cron run-status into Phase 4; if a cron silently dies, the alarm-conditions it would have fired for will eventually fire from a different cron (e.g., heartbeat detects the spend-cap-cron is silent).
- BetterStack public status page should be embedded as an iframe on the `/admin/health` page if BetterStack supports it cleanly; otherwise link-out — Claude picks.
- Sessions and messages timestamps render in **Joe's local timezone** (browser-side, via `toLocaleString`) — not UTC — for usability on the dashboard.
- `[PRIORITY]` subject flag should NOT include extra brackets or emojis — keep it greppable as a plain string.
- New `alarms_fired` table is admin-read-only — no UI write path, only cron writes.

</specifics>

<deferred>
## Deferred Ideas

- **End-of-session feedback prompt** — PROJECT.md "Active" lists it for Phase 4 but REQUIREMENTS.md has it as `OBSV-D3` (v2-deferred), and ROADMAP success criteria don't include it. **TREATED AS V2/DEFERRED.** PROJECT.md is stale; reconcile the discrepancy at next `/gsd-transition` (move from Active to v2 to match REQUIREMENTS.md).
- **`/admin/evals/<run-id>` view** — Phase 5 / EVAL-14.
- **Daily 9am digest email (OBSV-D1)** — v2.
- **Weekly question-clustering job (OBSV-D2)** — v2.
- **Anthropic org-level $20/month spend cap (SAFE-12)** — operational task before Phase 5 LAUNCH-06; Joe sets in console.anthropic.com.
- **Phase 5 alarm-condition addition: ≥3 distinct GitHub logins hitting `/admin` 403 in 1h** — deferred from D-A-07 once we have logging in place.
- **Transcript restore-from-archive UI (D-D-06)** — Phase 5+ if needed; SQL/manual access in Phase 4 only.
- **CSV/JSON export of sessions/cost/abuse** — manual SQL only in Phase 4; if Joe needs export UI later, add post-launch.
- **Custom Resend sender domain DNS config** — operational task (DNS records + verification), not code; Joe handles before public deploy. Until then, fallback to `onboarding@resend.dev`.
- **`[PRIORITY]` highlight on `/admin/sessions` table for company-domain rows** — Phase 4 includes a small badge in the `flagged` column area; full visual treatment is Claude's discretion.
- **Admin-only Supabase Auth provider beyond GitHub** (Google, etc.) — not needed; Joe is the only admin.
- **Multi-admin support** — not needed.
- **BetterStack-as-data-source** (pulling uptime stats into `/admin/health`) — out of scope; `/admin/health` only links out to BetterStack.
- **Dynamic threshold tuning per condition** — fixed thresholds in Phase 4; revisit if alarms spam or miss.
- **Long-term aggregate cost charts** — Phase 4 just shows windowed totals; charts are v2.
- **In-process inline alarm firing for hot conditions** (spend-cap, dependency-down) — explicitly rejected in favor of cron-only dispatch (D-C-07). Centralized threshold logic outweighs the 5-min latency.
- **Supabase Realtime for live admin dashboard** — explicitly rejected (D-B-04). SSR + 60s revalidate is sufficient for spot-check workflow.
- **Single-page admin with tabs** — explicitly rejected (D-B-01). Sub-routes give deep-linkability.
- **`/admin = sessions list directly` (no redirect)** — explicitly rejected (D-B-02). Redirect is cleaner conceptually.
- **Pre-aggregated Redis cost counters** — explicitly rejected (D-B-07) in favor of live SUM queries; revisit only if observed page-load > 300ms.
- **Email on session creation (vs first user turn)** — explicitly rejected (D-C-02). First-turn fire prevents empty-session noise.
- **Hard delete at 180d (no archive)** — explicitly rejected (D-D-02) in favor of Supabase Storage cold archive.
- **Manual-button archive (no cron)** — explicitly rejected (D-D-03) in favor of automated cron.
- **`messages_archive` table (vs Storage)** — explicitly rejected (D-D-02) — defeats the "cold" purpose of moving out of hot DB.
- **Delete classifier_verdict column at 90d (vs hard delete row)** — explicitly rejected (D-D-04). Hard delete is the strongest privacy posture against retaining attacker payloads.
- **Sessions auto-delete** — explicitly rejected (D-D-05). Captured emails are indefinite per ROADMAP success #5.
- **UptimeRobot (vs BetterStack)** — Acceptable substitute if Joe prefers; default is BetterStack for free tier + status page (D-E-01). Either works.

</deferred>

---

*Phase: 04-admin-observability*
*Context gathered: 2026-05-06*
