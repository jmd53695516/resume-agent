# Phase 4: Admin & Observability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `04-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 04-admin-observability
**Mode:** Interactive (no `--auto`, no `--chain`, no `--batch`, no `--analyze`, no `--text`)
**Areas discussed:** Admin auth gating, Dashboard IA & refresh, Emails & alarms, Retention & archive (all 4 areas selected by Joe via multi-select)

---

## Area 1: Admin auth gating

### Q1: Where should the admin allowlist check run?

| Option | Description | Selected |
|--------|-------------|----------|
| Middleware + per-route | Next.js middleware blocks unauthorized requests at the edge for all `/admin/*` + `/api/admin/*` paths; each server component AND each `/api/admin/*` route handler also re-checks. Belt-and-suspenders — middleware is the perimeter, route checks guarantee no leak if middleware misconfigured. Spec says '403 at API middleware layer (not just UI).' | ✓ |
| Middleware only | Single enforcement point in middleware. Simpler, but if middleware ever misconfigures (edge runtime quirk, matcher pattern bug), routes are exposed. | |
| Per-route check only | No middleware; each `/admin` page + `/api/admin/*` route asserts the GitHub login is in the allowlist. More explicit but easier to forget on a new route. | |

**User's choice:** Middleware + per-route (Recommended)
**Notes:** Locked as D-A-03.

---

### Q2: How should the admin allowlist be stored?

| Option | Description | Selected |
|--------|-------------|----------|
| `ADMIN_GITHUB_LOGINS` env var | Comma-separated GitHub usernames in Vercel env (e.g., `joedollinger,joedo`). Zero DB writes, no admin-of-admin bootstrap. Revoke = redeploy or update env + restart. Effectively a 1-element list since this is your project. | ✓ |
| Hardcoded array in code | `const ADMIN_LOGINS = ['joedollinger']`. Simplest. Requires a code change + deploy to add/remove. Public via repo (the username is already public; but bad pattern as a habit). | |
| Supabase profiles table with `is_admin` | A profiles row per admin GitHub user with `is_admin=true`. Future-proof for multi-admin, but overkill for solo project and adds DB schema + bootstrap problem. | |
| `ADMIN_EMAILS` env var | Match against the email Supabase Auth returns from GitHub OAuth. Slightly different threat model — GitHub username is more stable than email if you change your primary. | |

**User's choice:** `ADMIN_GITHUB_LOGINS` env var (Recommended)
**Notes:** Locked as D-A-02. New env var added to D-H-01.

---

### Q3: What does a successfully-logged-in but non-allowlisted GitHub user see?

| Option | Description | Selected |
|--------|-------------|----------|
| 403 page + auto-signout | Render a minimal '403 — not authorized' page, automatically signs out the Supabase Auth session, includes a 'go back to /' link. Explicit, easy to debug, doesn't strand a non-admin in a logged-in-but-locked-out state. Matches ROADMAP success #1's '403' wording. | ✓ |
| 403 page, keep session | Render 403 but leave the Supabase session intact. Cleaner if Joe tests with a second GitHub account; messier in practice (cookie says logged-in but no access). | |
| Silent redirect to `/` | No 403 page. Just bounce non-admins back to the public framing page. Less informative but lower 'why am I seeing this' confusion. | |
| 404 (pretend `/admin` doesn't exist) | Maximum security-by-obscurity. Slight friction for Joe debugging from a fresh browser. | |

**User's choice:** 403 page + auto-signout (Recommended)
**Notes:** Locked as D-A-04. Implemented via `<NotAuthorized />` server component that calls `supabase.auth.signOut()` on mount.

---

## Area 2: Dashboard IA & refresh

### Q1: Information architecture for `/admin`?

| Option | Description | Selected |
|--------|-------------|----------|
| Sub-routes per concern | `/admin/sessions`, `/admin/cost`, `/admin/abuse`, `/admin/health` — each is its own App Router page that SSRs its own data. Deep-linkable, easy to bookmark a transcript URL, each page is its own bundle. Standard Next.js pattern. | ✓ |
| Single page with tabs | One `/admin` route with tab strip (Sessions / Cost / Abuse / Health). Lighter; client-side tab switching feels snappy; but tabs hide URL state — sharing a transcript link is awkward. | |
| Sessions-first command center | `/admin` = sessions list with sidebar drill-down to a transcript, plus a cost + abuse widget strip across the top. Single screen, dense. Best for at-a-glance, but harder to fit everything without scrolling. | |

**User's choice:** Sub-routes per concern (Recommended)
**Notes:** Locked as D-B-01.

---

### Q2: What does `/admin` show by default?

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect to `/admin/sessions` | Sessions is what you'll check most — 'who landed on the site?' Cost + abuse are interesting but secondary. Pure redirect at `/admin` keeps the URL clean. | ✓ |
| Lightweight overview at `/admin` | Tiny dashboard at `/admin` showing today's session count, today's cost, abuse-flag count, and last 5 sessions. Kind of a 'home page.' Adds an extra page to maintain. | |
| `/admin` = sessions list directly (no redirect) | Make `/admin` BE the sessions page. Saves a redirect hop but pollutes the route conceptually. | |

**User's choice:** Redirect to `/admin/sessions` (Recommended)
**Notes:** Locked as D-B-02.

---

### Q3: How should admin pages stay fresh?

| Option | Description | Selected |
|--------|-------------|----------|
| SSR + manual refresh + 60s revalidate | Pages SSR on each navigation; a small 'refresh' button forces a re-fetch. Next.js fetch cache revalidates after 60s. Simple, no polling cost, free-tier-friendly. You're checking the dashboard a few times a day, not staring at it. | ✓ |
| Client polling every 30s | `useEffect` + `setInterval` refetch. Feels live, but burns Supabase free-tier read quota and runs whenever the tab is open. Overkill for low-volume traffic. | |
| Supabase realtime subscription | Subscribe to messages/sessions inserts via Supabase realtime channels. Truly live, updates appear as recruiters chat. More wiring; cool factor; hits realtime free-tier limits eventually. | |
| SSR-only, no refresh hint | Full page reload to update. Rough UX but zero complexity. | |

**User's choice:** SSR + manual refresh + 60s revalidate (Recommended)
**Notes:** Locked as D-B-04.

---

### Q4: How is the cost tracker (24h/7d/30d, per-tool, cache-hit-rate) computed?

| Option | Description | Selected |
|--------|-------------|----------|
| Live SUM from messages on each page load | `SUM(cost_cents)`, `SUM(cache_read_tokens)`, `GROUP BY tool_name`. Three windows = three queries. Indexed on `created_at` + `classifier_verdict` already. At expected volume (~thousand messages/month) this is sub-100ms; data is always fresh. | ✓ |
| Pre-aggregated Redis counters | Increment redis counters in onFinish (`cost:24h`, `cost:7d:tool:research_company`, etc.); read instantly in dashboard. Faster reads but doubles persistence complexity in onFinish. | |
| Nightly rollup table in Supabase | Cron job builds `daily_aggregates` rows; dashboard reads aggregates. Fast and cheap, but stale up to 24h. | |
| Hybrid: today from Redis, 7d/30d from Supabase | Best-of-both. Adds two implementation paths instead of one; only worth it if SUM queries actually become slow. | |

**User's choice:** Live SUM from messages on each page load (Recommended)
**Notes:** Locked as D-B-07. Pre-aggregation deferred until measurement justifies it.

---

## Area 3: Emails & alarms

### Q1: When does the per-session email to Joe fire?

| Option | Description | Selected |
|--------|-------------|----------|
| On first user turn | Email sends after the recruiter's first message persists. Prevents 'someone entered an email and bounced' noise; you only hear about real engagements. Slight latency (~1 turn) before notification. | ✓ |
| On session creation (email submitted) | Email sends the moment session row is created. You hear about every email gate hit, including 100% bouncers. Higher signal floor; higher noise. | |
| On session END (30-turn cap or idle timeout) | Single delayed email with full transcript summary. Less hot-lead value; better digest format. | |
| Both: notification on creation + summary on end | Two emails per session. Most complete; most volume. | |

**User's choice:** On first user turn (Recommended)
**Notes:** Locked as D-C-02. Idempotency via new `sessions.first_email_sent_at` column (D-C-05).

---

### Q2: What goes in the per-session email body?

| Option | Description | Selected |
|--------|-------------|----------|
| First message + classifier verdict + admin link | Subject: `[joe.dollinger.com] [PRIORITY] new chat from <email> @ <domain>`. Body: rendered first user message, classifier verdict (normal/injection/etc.), session-cost-so-far, button link to `/admin/sessions/<id>`. Actionable on phone. | ✓ |
| Notification only | Subject + body: `<email> from <domain> just started chatting. Open: <link>.` Minimal; you click through for context. | |
| Live-updating digest (last 3 turns) | Email refreshes every N turns. Resend doesn't natively support edit-in-place; would need a fresh email each time. Loud. | |
| Notification + first 3 turns at 5-min mark | Single email sent 5 min after session start, includes first 3 turns. Best snapshot but adds a delayed-send mechanism. | |

**User's choice:** First message + classifier verdict + admin link (Recommended)
**Notes:** Locked as D-C-04. React Email template at `src/emails/SessionNotification.tsx`.

---

### Q3: Where does alarm-threshold detection run?

| Option | Description | Selected |
|--------|-------------|----------|
| cron-job.org → `/api/cron/check-alarms` every 5 min | Single shared cron endpoint runs all four checks against Redis counters + Supabase + `/api/health`. All threshold logic centralized; easy to test; easy to add conditions later. cron-job.org is already locked in TECH STACK. | ✓ |
| In-process inline on each `/api/chat` | Spend-cap alarm fires immediately when the cap trip happens; rate-limit-flood check piggybacks on each rate-limit deflection. No 5-min latency. But threshold logic scatters across multiple call sites; hard to keep consistent. | |
| Hybrid: hot conditions inline, cold conditions cron | Spend cap + dependency-down inline (instant); error rate + IP flood from cron. Most responsive but two implementation paths. | |
| Vercel cron only | Hobby plan is 1 daily cron — too coarse for 5-min alarm checks. Would need Vercel Pro upgrade. | |

**User's choice:** cron-job.org → `/api/cron/check-alarms` every 5 min (Recommended)
**Notes:** Locked as D-C-07. Per-condition Redis suppression keys (D-C-07 + Q4 below).

---

### Q4: How should alarm-email de-duplication work?

| Option | Description | Selected |
|--------|-------------|----------|
| 1h suppression per condition in Redis | After `spend_cap_alarm` fires, set redis key `alarm:spend_cap` with 1h TTL; suppress further sends until expired. Per-condition keys mean one alarm doesn't suppress others. Re-alarms once per hour if condition persists — enough signal without spam. | ✓ |
| 6h suppression per condition | Quieter — max one alarm-per-condition per 6h block. Risk: a real ongoing problem only pings 4x/day. | |
| 24h suppression per condition | Once per day max per condition. Cleanest inbox; risks missing late-day re-escalation. | |
| No suppression — every cron tick that sees the condition emails | Loudest. Spam in 5-min increments while a problem persists. | |

**User's choice:** 1h suppression per condition in Redis (Recommended)
**Notes:** Locked as D-C-07. Redis key shape: `alarms:fired:<condition>` with `EX 3600 NX`.

---

## Area 4: Retention & archive

### Q1: What does 'cold storage' for 180d-old transcripts actually mean?

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase Storage as gzipped JSONL per session | One `.jsonl.gz` file per `session_id` in a private Supabase Storage bucket; messages rows DELETEd from hot table after upload. Stays inside Supabase free tier (1GB storage), retrievable on demand for `/admin` if you ever want to view a 200d-old transcript. Single-vendor, no S3 to manage. | ✓ |
| Separate Supabase table `messages_archive` | Same Postgres DB, different table, same indexes. Defeats the 'cold' purpose (still in hot DB) but simplest to query. May still serve free-tier 500MB cap. | |
| GitHub release / private repo as zip | Free unlimited; cron pushes archive zips. Awkward to retrieve; can't easily delete for compliance. Fragile. | |
| Hard delete after 180d (no archive) | Simplest. Loses audit trail beyond 6 months. Acceptable if Joe never plans to look at half-year-old transcripts. | |

**User's choice:** Supabase Storage as gzipped JSONL per session (Recommended)
**Notes:** Locked as D-D-02. Path convention: `archive/<yyyy>/<mm>/<session_id>.jsonl.gz`. Bucket name in env: `SUPABASE_STORAGE_ARCHIVE_BUCKET=transcripts-archive`.

---

### Q2: When/how does the archive job run?

| Option | Description | Selected |
|--------|-------------|----------|
| cron-job.org nightly `/api/cron/archive` | Same provider as alarms; runs daily at e.g. 3am ET. Endpoint queries `messages WHERE created_at < now()-180d` in batches, gzip-uploads to Storage, then DELETEs the rows. Idempotent (re-running is a no-op). Standard cron pattern. | ✓ |
| Manual button in `/admin/sessions` | Adds an 'archive sessions older than 180d' button. Gives you full control — but if you forget, the table just grows. Free-tier 500MB hit eventually. | |
| Supabase pg_cron scheduled function | Stays inside Postgres, no HTTP hop, no external dependency. Some pg_cron features need Supabase Pro; basic scheduled functions are free. | |
| Lazy: archive on-the-fly when `/admin` reads old rows | When `/admin` queries `messages > 180d`, archive-then-return. Complex, doesn't help table size if no one reads old data. | |

**User's choice:** cron-job.org nightly `/api/cron/archive` (Recommended)
**Notes:** Locked as D-D-03. Daily 03:00 ET. Batched 100 sessions/run.

---

### Q3: What does '90d retention for classifier flags' mean concretely?

| Option | Description | Selected |
|--------|-------------|----------|
| Hard-delete flagged user-message rows at 90d | Daily cron deletes `messages WHERE classifier_verdict NOT IN ('normal', NULL) AND created_at < now()-90d`. The injection content is gone forever; sessions table still records the abuse via `flagged` column. Strongest privacy posture against retaining attacker payloads. | ✓ |
| Null out `classifier_verdict` + content at 90d, keep row | Preserves message ID for ordering; loses content + verdict. Lighter touch. | |
| Move flagged rows to `messages_archive` at 90d (early eviction) | Goes cold earlier than transcripts; abuse log only queries last 90d hot. Adds a second archive trigger condition. | |
| Just decay the `classifier_verdict` column to NULL at 90d | Content stays readable; flag context lost. Weakest — doesn't really 'retain less.' | |

**User's choice:** Hard-delete flagged user-message rows at 90d (Recommended)
**Notes:** Locked as D-D-04. Same daily cron job as transcript archive (D-D-03).

---

### Q4: What happens to the sessions table over time?

| Option | Description | Selected |
|--------|-------------|----------|
| Sessions never deleted; only messages archive | `sessions` row keeps email/email_domain/ip_hash/total_cost_cents/flagged forever. Child messages move to cold storage after 180d. The email captures pipe stays intact — your future-job-search needs may want to revisit who chatted years later. | ✓ |
| Sessions archived after 5y | Long horizon cleanup. Probably never relevant for a personal portfolio project. | |
| Sessions deleted only on explicit cleanup request | Manual purge only. Same as recommended in practice for years. | |
| Sessions also archived to Storage at 180d alongside messages | Goes against 'indefinite captured emails' — not recommended unless you want to remove email visibility from `/admin/sessions` for old sessions. | |

**User's choice:** Sessions never deleted; only messages archive (Recommended)
**Notes:** Locked as D-D-05. Matches ROADMAP success #5 ("captured emails retained indefinitely").

---

## Claude's Discretion

Areas left to Claude during planning/execution (captured in 04-CONTEXT.md `### Claude's Discretion` section):

- Visual styling within shadcn norms — table density, badge colors, card layout.
- Exact React Email template prose and visual design (Joe reviews in PR).
- BetterStack monitor cadence (3-min default; 1-min if Joe wants).
- Free-mail allowlist list grooming (start with the recommended set in D-C-03; add as encountered).
- Whether to also send alarm emails as plain text vs React Email (recommend plain text — readable on phone, no formatting friction).
- Archive bucket region/storage class (default Supabase Storage).
- Exact threshold for "error rate >2%" computation — minimum sample size to suppress false positives is Claude's discretion.
- Whether `/api/cron/heartbeat` rotates the cached prompt user-message text to avoid a rare cache-miss bug (default: stable single-string ping).
- Whether the "5 unique IPs" check uses `ip_hash` or `email` as the unique-identity dimension (default: `ip_hash` per OBSV-09 wording).
- Top-bar nav active-state styling — recommend underline + bold; Claude picks.

---

## Deferred Ideas

(Captured in `04-CONTEXT.md` `<deferred>` section. Surfaced here for searchability.)

- End-of-session feedback prompt — PROJECT.md vs REQUIREMENTS.md drift; treated as v2/OBSV-D3.
- `/admin/evals/<run-id>` view — Phase 5 / EVAL-14.
- Daily 9am digest email — v2 / OBSV-D1.
- Weekly question-clustering job — v2 / OBSV-D2.
- Anthropic org-level $20/month spend cap — operational task before Phase 5 LAUNCH-06.
- Phase 5 alarm condition: ≥3 distinct GitHub logins hitting `/admin` 403 in 1h.
- Transcript restore-from-archive UI — Phase 5+.
- CSV/JSON export of sessions/cost/abuse — manual SQL only in Phase 4.
- Custom Resend sender domain DNS config — operational, not code.
- BetterStack-as-data-source — out of scope; just link out.
- In-process inline alarm firing — explicitly rejected in favor of cron-only dispatch.
- Supabase Realtime for live admin dashboard — explicitly rejected.
- Single-page admin with tabs — explicitly rejected.
- `/admin = sessions list directly` (no redirect) — explicitly rejected.
- Pre-aggregated Redis cost counters — explicitly rejected.
- Email on session creation (vs first user turn) — explicitly rejected.
- Hard delete at 180d (no archive) — explicitly rejected.
- Manual-button archive (no cron) — explicitly rejected.
- `messages_archive` table — explicitly rejected.
- Sessions auto-delete — explicitly rejected.
- UptimeRobot — acceptable substitute; default is BetterStack.
