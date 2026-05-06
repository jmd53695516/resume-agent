---
phase: 04
plan: 01
subsystem: foundation
tags: [foundation, env, schema, deps, shadcn, supabase, storage, resend]
requirements_addressed: [OBSV-15]
dependency-graph:
  requires: []
  provides:
    - "resend@^6.12.3 + @react-email/components@^1.0.12 npm deps (consumed by Plan 04-05 email)"
    - "9 Phase 4 env vars validated at module load (RESEND_API_KEY, RESEND_FROM_EMAIL, JOE_NOTIFICATION_EMAIL, ADMIN_GITHUB_LOGINS, CRON_SECRET, SUPABASE_STORAGE_ARCHIVE_BUCKET, BETTERSTACK_DASHBOARD_URL, HEARTBEAT_LLM_PREWARM)"
    - "sessions.first_email_sent_at column (consumed by Plan 04-05 email idempotency)"
    - "public.alarms_fired table (consumed by Plan 04-06 cron alarm history)"
    - "Private Supabase Storage bucket transcripts-archive (consumed by Plan 04-07 archive cron)"
    - "shadcn Table + Badge primitives (consumed by Plans 04-03/04/05/06 admin UI)"
  affects: ["src/lib/env.ts", ".env.example", "supabase/migrations/", "src/components/ui/"]
tech-stack:
  added: ["resend@^6.12.3", "@react-email/components@^1.0.12"]
  patterns: ["base-nova shadcn vendoring (data-slot attrs, cn helper)", "zod v4 .email()/.url() syntax", "renamed env var with rg sweep"]
key-files:
  created:
    - "supabase/migrations/0002_phase4.sql"
    - "src/components/ui/table.tsx"
    - "src/components/ui/badge.tsx"
    - ".planning/phases/04-admin-observability/04-01-SUMMARY.md"
  modified:
    - "package.json"
    - "package-lock.json"
    - "src/lib/env.ts"
    - ".env.example"
    - ".gitignore"
decisions:
  - "ADMIN_GITHUB_USERNAMES → ADMIN_GITHUB_LOGINS rename (matches GitHub OAuth claim name `login`)"
  - "RESEND_API_KEY promoted from optional to required with .startsWith('re_') format guard"
  - "CRON_SECRET requires ≥32 chars (matches openssl rand -hex 32 default)"
  - "SUPABASE_STORAGE_ARCHIVE_BUCKET defaults to 'transcripts-archive' (no .env entry needed if default acceptable)"
  - "alarms_fired uses text PK populated by nanoid in Node (matches 0001 sessions/messages PK pattern; no pgcrypto extension)"
  - "RLS enabled on alarms_fired with NO policies — service-role bypass per /admin pattern"
  - "Restored package-lock.json after npx shadcn caused unrelated transitive bumps (express-rate-limit, ip-address) — keeps Task 1 lockfile diff scoped to resend + @react-email/components"
metrics:
  duration: "~32 min (incl. ~25min Joe-side blocking checkpoint pause for db push + bucket create)"
  tasks_completed: 7
  files_changed: 9
  commits: 5
  completed_date: "2026-05-06"
---

# Phase 4 Plan 01: Foundation Bootstrap Summary

Foundation wave for Phase 4: installed Resend + React Email deps, extended env schema with 9 Phase 4 vars (renamed `ADMIN_GITHUB_USERNAMES` → `ADMIN_GITHUB_LOGINS`, promoted `RESEND_API_KEY` from optional → required, added 7 new vars), wrote and applied migration `0002_phase4.sql` (sessions.first_email_sent_at column + alarms_fired table with index + RLS), created the private `transcripts-archive` Supabase Storage bucket, and vendored shadcn Table + Badge primitives. Unblocks every downstream Phase 4 plan.

## What Was Built

### Task 1 — Install resend + @react-email/components (commit `7dd1617`)

`npm install resend@^6.12.2 @react-email/components@^1.0.12` resolved to `resend@^6.12.3` and `@react-email/components@^1.0.12`. Lockfile diff scoped to those two packages only. `npm ls` confirms single resolved versions.

### Task 2 — Extend env.ts schema (commit `a79388c`)

Replaced `src/lib/env.ts` with full Phase 4 schema:
- **Renamed:** `ADMIN_GITHUB_USERNAMES` → `ADMIN_GITHUB_LOGINS` (`.string().min(1)` required)
- **Promoted:** `RESEND_API_KEY` optional → required (`.string().startsWith('re_')`)
- **Added required:** `RESEND_FROM_EMAIL` (`z.email()`), `JOE_NOTIFICATION_EMAIL` (`z.email()`), `CRON_SECRET` (`.string().min(32)`), `SUPABASE_STORAGE_ARCHIVE_BUCKET` (`.string().default('transcripts-archive')`)
- **Added optional:** `BETTERSTACK_DASHBOARD_URL` (`z.url().optional()`), `HEARTBEAT_LLM_PREWARM` (`.string().optional().default('true')`)
- All Phase 1–3 vars (Supabase, Anthropic, Upstash, Exa) preserved unchanged.

Codebase grep confirmed zero production references to `ADMIN_GITHUB_USERNAMES` outside `.planning/`. `npx tsc --noEmit` clean.

### Task 3 — Update .env.example + verify pre-commit hook (commit `c6dbf20`)

`.env.example` now documents all 7 new Phase 4 vars with inline guidance (key generation hints, free-tier callouts, default-value notes). Renamed line `ADMIN_GITHUB_USERNAMES=joe-dollinger` → `ADMIN_GITHUB_LOGINS=joe-dollinger`. Pre-commit hook self-test (`bash scripts/test-pre-commit-hook.sh`) exited 0 — no exemption changes needed; the existing `:(exclude).env.example` filter and the secret-pattern matchers correctly tolerate `NEXT_PUBLIC_SUPABASE_ANON_KEY` references in env.ts.

### Task 4 — Migration file (commit `48caf7c`)

`supabase/migrations/0002_phase4.sql` written per CONTEXT D-G-01:
- `alter table public.sessions add column if not exists first_email_sent_at timestamptz` — per-session email idempotency guard
- `create table if not exists public.alarms_fired (id text PK, condition text, fired_at timestamptz default now(), resend_send_id text, body_summary text)`
- `create index if not exists alarms_fired_fired_at_idx on public.alarms_fired (fired_at desc)` — supports /admin/health "last 5 alarms" query
- `alter table public.alarms_fired enable row level security` — service-role bypasses; no policies
- `comment on` for both column + table
- No Postgres extensions (matches 0001's nanoid-as-text PK pattern)

### Task 5 — Apply migration (manual, BLOCKING checkpoint — completed by Joe)

Joe ran `supabase db push` against the live Supabase project. Verification queries (run by Joe via dashboard SQL editor):
- `select column_name from information_schema.columns where table_name = 'sessions' and column_name = 'first_email_sent_at'` → 1 row
- `select count(*) from public.alarms_fired` → 0 (table exists, empty)

No file artifact for this task — operational gate only. Resume signal received: `applied`.

### Task 6 — Create transcripts-archive Storage bucket (manual, BLOCKING checkpoint — completed by Joe)

Joe created bucket `transcripts-archive` via Supabase dashboard → Storage → New bucket with `Public bucket: OFF`. Bucket appears with lock icon (private) in dashboard list. Resume signal received: `bucket-created`.

Env note: `SUPABASE_STORAGE_ARCHIVE_BUCKET` is intentionally NOT set in `.env.local` — `src/lib/env.ts` has `.default('transcripts-archive')` which matches the created bucket name. No .env entry needed.

### Task 7 — Vendor shadcn Table + Badge primitives (commit `ae58193`)

`npx shadcn@latest add table badge --yes` created:
- `src/components/ui/table.tsx` — exports Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption
- `src/components/ui/badge.tsx` — exports Badge + badgeVariants (default/secondary/destructive/outline/ghost/link)

Both use the project's `base-nova` shadcn style: `data-slot` attributes, `cn` helper from `@/lib/utils`, function declarations (not forwardRef), CVA for badge variants. Matches existing `card.tsx`/`button.tsx` conventions.

`npx tsc --noEmit` produced zero errors. Existing `card.tsx`, `button.tsx`, `input.tsx`, `label.tsx` untouched.

## Final Dependency Versions

| Package | Range in package.json | Resolved |
|---|---|---|
| resend | ^6.12.2 | 6.12.3 |
| @react-email/components | ^1.0.12 | 1.0.12 |

## ADMIN_GITHUB_USERNAMES Rename Verification

Codebase-wide grep for `ADMIN_GITHUB_USERNAMES`:
- `src/` — 0 matches (production code clean)
- `.env.example` — 0 matches (line replaced with `ADMIN_GITHUB_LOGINS=joe-dollinger`)
- `.planning/` — historical references only (PROJECT/PLAN/RESEARCH docs use the new name where prescriptive; old name appears only in dated context blocks)

No additional refactors required. Phase 1–3 never consumed admin-auth env vars in code, so the rename is contained to `src/lib/env.ts` + `.env.example` + the new Phase 4 plans.

## Migration Application

- **Applied:** 2026-05-06 (Joe-side via `supabase db push`)
- **Verification 1:** `sessions.first_email_sent_at` column exists (1 row from information_schema)
- **Verification 2:** `public.alarms_fired` table exists (0 rows, table reachable)
- **Result:** Live DB now satisfies must-have truth #2 from PLAN frontmatter

## Storage Bucket

- **Name:** `transcripts-archive` (matches `SUPABASE_STORAGE_ARCHIVE_BUCKET` default)
- **Public:** false (verified by lock icon in dashboard Storage list)
- **MIME types / file size:** dashboard defaults (50MB, any MIME)
- **Result:** Plan 04-07 archive cron unblocked

## Pre-Commit Hook

No adjustments made. The existing hook (Phase 1) already excludes `.env.example` and tolerates `NEXT_PUBLIC_SUPABASE_ANON_KEY` references in env.ts. Self-test (`bash scripts/test-pre-commit-hook.sh`) passes against the new `.env.example` block. No edits to `scripts/install-pre-commit-hook.sh`.

## Resend Setup

- API key obtained from https://resend.com/api-keys (Joe-side, free tier — 3k emails/month)
- `RESEND_API_KEY=re_...` set in `.env.local` (verified by env.ts module-load not throwing on `npm run dev`)
- `RESEND_FROM_EMAIL=onboarding@resend.dev` (dev default; pre-public-deploy DKIM swap deferred to LAUNCH-* in Phase 5)
- `JOE_NOTIFICATION_EMAIL=joe.dollinger@gmail.com`

## Deviations from Plan

### Task 5 + Task 6 Manual Checkpoints (expected by plan)

Both tasks were authored as `type="checkpoint:human-action" gate="blocking"` — Joe-side operational steps that cannot be automated. Joe executed both during the planned pause and provided the resume signals (`applied`, `bucket-created`). Not deviations — the plan correctly identified these as gates.

### [Rule 3 — Blocking issue] Restored package-lock.json after Task 7

**Found during:** Task 7 verification
**Issue:** `npx shadcn@latest add` triggered an npm tree resolve that bumped two unrelated transitive deps (`express-rate-limit` 8.3.2 → 8.5.1, `ip-address` 10.1.0 → 10.2.0). The Task 7 plan and Task 1 plan both explicitly forbid touching unrelated lockfile entries.
**Fix:** `git restore package-lock.json` before staging. Final lockfile diff (across all 7 tasks) is scoped to Task 1's two added deps.
**Files modified:** package-lock.json (no diff at commit time vs. pre-Task-7 state)
**Commit:** none — restoration before staging Task 7's commit

### [Rule 3 — Blocking issue] Added .claude/ and supabase/.temp/ to .gitignore

**Found during:** Task 7 final `git status` check (per task_commit_protocol step 6)
**Issue:** Two new untracked runtime-output directories appeared during execution: `.claude/` (Claude Code local cache, created when this agent runs in this repo) and `supabase/.temp/` (Supabase CLI scratch, created by Joe's `supabase db push`). Neither is project source — both are tool runtime artifacts that future agents/runs will keep regenerating. Leaving them untracked is a footgun.
**Fix:** Appended both to `.gitignore` with descriptive comments.
**Files modified:** `.gitignore`
**Commit:** included in this plan's metadata commit (post-Task-7)

## Self-Check

- src/components/ui/table.tsx — FOUND
- src/components/ui/badge.tsx — FOUND
- supabase/migrations/0002_phase4.sql — FOUND
- src/lib/env.ts contains ADMIN_GITHUB_LOGINS — FOUND
- src/lib/env.ts does not contain ADMIN_GITHUB_USERNAMES — VERIFIED
- .env.example contains all 7 new var names — VERIFIED
- Commit 7dd1617 (Task 1) — FOUND in git log
- Commit a79388c (Task 2) — FOUND in git log
- Commit c6dbf20 (Task 3) — FOUND in git log
- Commit 48caf7c (Task 4) — FOUND in git log
- Commit ae58193 (Task 7) — FOUND in git log
- Tasks 5 + 6 — manual checkpoints, no commit (verified by Joe-side resume signals)

## Self-Check: PASSED
