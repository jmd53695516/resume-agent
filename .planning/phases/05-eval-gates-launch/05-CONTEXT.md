# Phase 5: Eval Gates & Launch - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning
**Mode:** Interactive (Joe selected ALL four gray areas: Harness + judge model, Blind A/B voice test, CI promote-to-prod gate, Backlog & launch sequence)

<domain>
## Phase Boundary

Phase 5 delivers the **launch gate**: a custom-CLI eval harness running ~40 cases across 6 categories against Vercel preview deploys, gated through GitHub Actions branch protection on `main`, with cat 1 (factual fidelity, 15/15 zero-tolerance) and cat 4 (voice fidelity blind A/B + LLM judge) as hard pass requirements; an admin surface at `/admin/evals` (index + detail + calibrate); a friend-test sign-off (3 testers including ≥1 PM and ≥1 non-PM); and the operational launch (public URL + QR + resume PDF placement + Joe-signed `guardrails.md`). Concretely:

- `npm run eval` invokes `scripts/run-evals.ts` (tsx CLI) → loads YAML cases from `evals/cat-0[1-6]-*.yaml` → runs against `EVAL_TARGET_URL` (a Vercel preview deploy) → calls a cross-vendor non-Anthropic judge (GPT-4.1-mini or Gemini 2.5 Flash, picked at planning time) → writes results to Supabase `eval_runs` + `eval_cases` → emits pass/fail summary + cost log.
- Vitest stays for unit tests only. Playwright (cat 6 UX smoke) is invoked from inside the eval CLI as a subprocess so cat 6 results funnel into the same `eval_runs` row.
- A `/admin/eval-ab` Joe-only page (behind `requireAdmin()`) renders 10 shuffled snippets — 5 fresh-from-preview agent replies + 5 curated `voice.md` excerpts — friend-tester clicks AI/Joe per snippet → POST to `/api/admin/eval-ab` writes a row tagged `category='cat4-blind-ab'` into `eval_runs` with `pass: identification_pct < 70`.
- A `/admin/evals` index lists last 30 runs; `/admin/evals/[run-id]` shows per-case detail (prompt / response / judge score+verdict / pass-fail / raw JSON expandable). A `/admin/evals/calibrate` page surfaces 10 random recent cases for Joe to rate monthly (EVAL-12 drift detection).
- GitHub Actions workflow `.github/workflows/eval.yml` triggers on PR ready_for_review and on push to `main`; reads the preview-deploy URL from the Vercel deployment status webhook; runs the suite; comments pass/fail on PR; the workflow is the GitHub branch-protection required check on `main`. Vercel auto-deploys `main` to prod, so passing the check IS the promote gate.
- Weekly scheduled run via `cron-job.org` → `/api/cron/run-eval` → spawns the same suite against the production URL (drift detection per EVAL-11). Reuses `CRON_SECRET` Bearer auth pattern from Phase 4 D-C-09. New `eval_runs.scheduled = true` flag distinguishes from CI runs.
- Pre-launch smoke plan (first plan in Phase 5) walks Joe through the 20 outstanding HUMAN-UAT items from Phase 3 (9) + Phase 4 (11) against a fresh preview deploy. Discovered bugs fold back into decimal phases or the launch checklist.
- Final launch plan handles: pick + DNS-config domain (Joe's call at planning time), drop resume PDF in `public/joe-dollinger-resume.pdf`, generate QR (qrcode CLI → PNG checked into repo), update LinkedIn/PDF/personal site URLs, sign `guardrails.md`, set Anthropic org $20/mo cap (SAFE-12) with verification step, run pre-launch checklist (LAUNCH-06), confirm friend-test sign-off, flip resume link.
- Friend-test (LAUNCH-04): Joe DMs 3 specific people (≥1 PM, ≥1 non-PM); each gets the live preview URL + a Google Form ('feels substantive Y/N', 'anything awkward', 'one favorite moment', 'one cringe moment', open feedback). Async, no scheduling overhead; Joe records sign-off in launch checklist.

**Not in Phase 5:**
- Daily digest email — `OBSV-D1` v2.
- Weekly question-clustering job — `OBSV-D2` v2.
- End-of-session feedback prompt — `OBSV-D3` v2 (drifted in PROJECT.md; reconcile at next `/gsd-transition`).
- Custom domain beyond Vercel subdomain — `LAUNCH-D1` v2 (Joe may pick a custom in launch plan, but the v2 line is for *additional* domains).
- Multi-version A/B testing framework — out of scope.

**Carrying forward from Phase 1 + Phase 2 + Phase 3 + Phase 4:**
- `master` branch, npm, Node 22 LTS, sequential execution, no worktrees.
- Vitest + Playwright already wired ([package.json](package.json), [playwright.config.ts](playwright.config.ts), [tests/e2e/chat-happy-path.spec.ts](tests/e2e/chat-happy-path.spec.ts)).
- `requireAdmin()` two-layer pattern (Phase 4 D-A-03) — used for `/admin/evals/*`, `/admin/eval-ab`, and `/api/admin/eval-ab`.
- shadcn `<Table>` primitive (Phase 4) — reused for `/admin/evals` index and per-case detail.
- Resend + React Email (Phase 4 D-C-01..05) — reusable for eval-failure alarm emails IF added (planner's discretion).
- `CRON_SECRET` Bearer auth pattern + `cron-job.org` (Phase 4 D-C-08, D-C-09) — used for `/api/cron/run-eval` weekly scheduled run.
- Pino structured JSON logging (Phase 3 D-I; Phase 4 reuse) — eval CLI uses Pino for structured run output.
- Supabase service-role client (Phase 4) — `eval_runs` / `eval_cases` writes from CI use service-role.
- `/api/health` endpoint (Phase 3) — eval cat 6 UX smoke probes it as part of fallback verification.
- Phase 3 HUMAN-UAT: 9 items in [.planning/phases/03-tools-resilience/03-HUMAN-UAT.md](.planning/phases/03-tools-resilience/03-HUMAN-UAT.md).
- Phase 4 HUMAN-UAT: 11 items in [.planning/phases/04-admin-observability/04-HUMAN-UAT.md](.planning/phases/04-admin-observability/04-HUMAN-UAT.md).
- Deferred SAFE-12 (Anthropic org cap) — Phase 2 carry-over, becomes Phase 5 LAUNCH-06 prerequisite.

</domain>

<decisions>
## Implementation Decisions

### Harness + Judge Model (A)

- **D-A-01:** **Custom tsx CLI** at `scripts/run-evals.ts` is the eval entrypoint, invoked as `npm run eval`. Vitest stays for unit tests only. Cat 6 (UX smoke) is run as a Playwright subprocess from inside the CLI so all 6 categories funnel into a single `eval_runs` row. *Rationale: spec calls this out; clean separation of unit tests vs eval; easy parallelism control + cost tracking; one CI invocation point.*
- **D-A-02:** **YAML cases in `evals/`** — one file per category: `evals/cat-01-fabrication.yaml`, `cat-02-tools.yaml`, `cat-03-persona.yaml`, `cat-04-voice.yaml`, `cat-05-abuse.yaml`, `cat-06-ux-smoke.yaml`. Frontmatter-style metadata + multi-line prompts. Easy to diff in PRs, easy to author. Schema validated by zod on load.
- **D-A-03:** **Eval target = Vercel preview deploy.** `EVAL_TARGET_URL` env var passed to the CLI by GitHub Actions (read from Vercel deployment status webhook). For local development, Joe can set `EVAL_TARGET_URL=http://localhost:3000` and run against `npm run dev`. No `EVAL_TARGET` mode flag — single env var; behavior is whatever you point it at.
- **D-A-04:** **Cross-vendor judge** (non-Anthropic) for cat 1, cat 4 LLM-judge, and any other LLM-judged categories. Avoids family self-preference (the bias EVAL-12 monthly calibration is meant to detect). New env var (one of `OPENAI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY`) added.
- **D-A-05:** **Specific judge model = Claude's discretion in research.** `gsd-phase-researcher` compares GPT-4.1-mini vs Gemini 2.5 Flash on current pricing and judge-rubric reliability at planning time and picks one. Lock the chosen model + version ID in `src/lib/eval-models.ts` as `JUDGE_MODEL`.
- **D-A-06:** **Version pinning** = const-in-code default + env override. `src/lib/eval-models.ts` exports `JUDGE_MODEL = '<vendor>-<model>-<YYYY-MM-DD>'`. `EVAL_JUDGE_MODEL` env var overrides at runtime for ad-hoc experiments. Bumping the const requires a PR (auditable in git history) AND the planner should add a checklist note that monthly calibration must re-run when the const changes.
- **D-A-07:** **Cost budget = soft.** CLI prints projected cost at start (sum of `(case_count × est_input_tokens × judge_input_price + est_output_tokens × judge_output_price)`); prints actual cost at end with red Pino warn line if `actual > $1.00`. Does NOT abort. *Rationale: 40-case suite is well-modeled; surprise overruns are unlikely; the `/api/chat` daily $3 cap already fires if a judge call somehow runs unbounded; aborts mid-run waste partial work.*
- **D-A-08:** **Monthly human calibration (EVAL-12)** = `/admin/evals/calibrate` page. Joe spends ~30 min/month: page selects 10 random recent cases (across cats 1, 3, 4 — the LLM-judged ones), shows judge's verdict + score, Joe re-rates each on the same rubric, page computes per-case delta and overall agreement %. Stored in new `eval_calibrations` table. No scheduling — Joe runs it ad-hoc; cron-job.org reminder email on the 1st of each month points him to the page.
- **D-A-09:** **Eval results storage** — new tables (one migration in Phase 5):
  - `eval_runs(id uuid pk, started_at timestamptz, finished_at timestamptz, target_url text, judge_model text, total_cases int, passed int, failed int, total_cost_cents int, scheduled boolean default false, git_sha text, status text)` — one row per `npm run eval` invocation.
  - `eval_cases(id uuid pk, run_id uuid fk, category text, case_id text, prompt text, response text, judge_score numeric, judge_verdict text, judge_rationale text, passed boolean, cost_cents int)` — per-case detail.
  - `eval_calibrations(id uuid pk, calibrated_at timestamptz, case_id uuid fk, judge_score numeric, human_score numeric, delta numeric)` — monthly drift tracking.
  Schema details refined in planner.

### Blind A/B Voice Test (B)

- **D-B-01:** **A/B venue = `/admin/eval-ab`** behind `requireAdmin()` (Phase 4 pattern). Single Joe-only page. Joe shares screen with friend-tester or invites them in for ~5 min. No public surface area to abuse. *Rationale: adding a public token-gated page costs anti-abuse work; for ≤3 friend-testers per launch, Joe can be present for each session.*
- **D-B-02:** **Real-Joe paragraphs = curated voice.md samples.** Joe pre-selects 5 fixed-length excerpts (~80-120 words each, matching expected agent reply length) from `voice.md` (or fresh unfiltered Slack/text excerpts that he also adds to `voice.md` as voice canon). Stored in `evals/cat-04-real-joe.yaml`. Reproducible across runs; voice baseline is intentional and curated.
- **D-B-03:** **Agent paragraphs = generated fresh from preview deploy at A/B time.** CLI (or the page itself) sends 5 fixed prompts (the same prompts used as cat 4 LLM-judge cases) to `/api/chat` against the preview URL, captures replies. Always reflects current KB + system-prompt state. No stale snapshots.
- **D-B-04:** **The 5 fixed cat-4 prompts** live in `evals/cat-04-prompts.yaml`. They are designed to elicit voice (e.g., "tell me about a time you made the wrong call", "how do you think about prioritization on a brand-new product"). Reused by the LLM-judge run AND the blind A/B run for consistency.
- **D-B-05:** **Scoring = auto-recorded.** `/admin/eval-ab` shuffles the 10 snippets server-side, sets a session-scoped key, friend-tester clicks AI/Joe for each, page POSTs `{tester_role: 'pm' | 'non-pm' | 'other', identifications: [...]}` to `/api/admin/eval-ab`. Server computes `identification_pct = correct_AI_picks / 5`, writes a row with `category='cat4-blind-ab'`, `passed = pct < 0.70`, into `eval_runs`. Counted in CI's eval_runs scan as a category-level pass/fail.
- **D-B-06:** **Multi-tester aggregation** — NOT required for v1. Each tester's row is an independent eval_run entry; pass = each individual entry passes. If Joe later wants stricter ('avg < 70 AND no individual >85%'), it's a query change against eval_runs, not a schema change. Keep simple in v1.
- **D-B-07:** **Friend-tester role tag** — page asks the tester to self-identify (PM / non-PM / other) before starting; that tag is on the eval_runs row. Helps satisfy LAUNCH-04 (≥1 non-PM tester) auditably.

### CI Promote-to-Prod Gate (C)

- **D-C-01:** **CI runner = GitHub Actions** at `.github/workflows/eval.yml`. Triggers: `pull_request` (on `ready_for_review` and `synchronize`) + `push` (on `main`). Reads preview-deploy URL from Vercel via the `vercel/preview-deploy` action or by polling Vercel API for the latest preview URL for the PR's commit SHA. Posts pass/fail summary as a PR comment.
- **D-C-02:** **Trigger cadence = on every PR + on promote.** Full ~$0.50-1 run per PR catches regressions early. Estimated annual CI cost ($50-100 if Joe makes 100+ PRs in the launch year) is negligible vs catch rate. Re-runs on push-to-main against the new preview as the actual gate. *Rationale: cheap subset on PR + full on promote was tempting but adds a second config to maintain and the cost savings don't justify the maintenance burden at this scale.*
- **D-C-03:** **Block mechanism = GitHub branch protection on `main`.** Required check: `eval-workflow / eval`. Vercel auto-deploys `main` to production, so the moment the check passes + the PR is merged, prod is updated. Standard, well-understood, no Vercel-specific bypass tokens. Joe still has emergency-override (admin can bypass branch protection if launch deadline forces it).
- **D-C-04:** **Eval cost vs PR-flow concern** — the suite takes 3-5 min and costs ~$0.50-1 per PR. Joe uses a Draft PR convention for WIP (Actions only fires on `ready_for_review`). Solo-developer pace with infrequent PRs makes this tolerable.
- **D-C-05:** **/admin/evals UI depth** = two pages + the calibrate page from D-A-08, total three:
  - `/admin/evals` (index): last 30 runs, columns = started_at, target_url (truncated), judge_model, per-category pass/fail counts, total_cost_cents, status. Sortable by date. shadcn `<Table>` reuse.
  - `/admin/evals/[run-id]` (detail): per-case rows; expandable JSON for prompt/response/judge_rationale; cat 6 Playwright cases show screenshot links if Playwright captured them.
  - `/admin/evals/calibrate` (per D-A-08).
- **D-C-06:** **Weekly scheduled run** (EVAL-11): `/api/cron/run-eval` invoked by `cron-job.org` every Monday 03:00 ET. Spawns the same harness against PROD URL (`EVAL_TARGET_URL=https://<prod-domain>`). `CRON_SECRET` Bearer auth (Phase 4 D-C-09 pattern). Tags eval_runs row `scheduled=true`. **Question for planner:** should weekly failures fire an alarm email via the Phase 4 dispatcher? Recommend YES via a 5th alarm condition; planner decides.

### Backlog & Launch Sequence (D)

- **D-D-01:** **Plan 05-01 = Pre-launch smoke** (FIRST plan in Phase 5). Walks Joe through all 20 outstanding HUMAN-UAT items as live runtime checks against a fresh preview deploy:
  - Phase 3 (9 items, [.planning/phases/03-tools-resilience/03-HUMAN-UAT.md](.planning/phases/03-tools-resilience/03-HUMAN-UAT.md)) — TracePanel chevron visual, MetricCard render, Exa DevTools observation, etc.
  - Phase 4 (11 items, [.planning/phases/04-admin-observability/04-HUMAN-UAT.md](.planning/phases/04-admin-observability/04-HUMAN-UAT.md)) — live OAuth round-trip, real per-session email + idempotency, cron auth gate, force-trip spend-cap alarm, archive smoke, **3 cron-job.org schedules to configure** (check-alarms, heartbeat, archive), **BetterStack monitor + dashboard URL env**, always-expanded admin trace.
  - Discovered bugs become decimal phases (5.1, 5.2, ...) or fold into the launch checklist.
  *Rationale: surfaces blockers BEFORE the eval suite is built on a shaky foundation. Eval runs against a known-good preview, not a buggy one.*
- **D-D-02:** **SAFE-12 (Anthropic org-level $20/mo cap)** = pre-launch checklist item in the LAUNCH plan, blocking LAUNCH-06. Joe sets it in the Anthropic console; plan includes a verify step (curl Anthropic billing endpoint or attach screenshot to the launch-checklist commit). No code change.
- **D-D-03:** **Friend-test (LAUNCH-04) flow** = Joe-recruited, async link + 5-question Google Form. Joe DMs 3 specific people he trusts (≥1 PM, ≥1 non-PM):
  1. "Feels substantive (Y/N)?" — non-PM answer must be Y to pass per LAUNCH-04.
  2. "Anything awkward — pick a moment."
  3. "One favorite moment."
  4. "One cringe moment."
  5. Open feedback.
  Joe records sign-off in the launch-checklist commit. "Awkward" issues block resume-link activation per LAUNCH-04 wording.
- **D-D-04:** **Final launch plan = 05-NN-LAUNCH** (last plan; NN = whatever number it ends up). Single plan handles:
  - Pick + DNS-configure public domain (Joe's call at planning time — NOT pre-decided here because Joe doesn't have DNS info in front of him; planner will ask Joe at planning time and capture).
  - Drop `joe-dollinger-resume.pdf` in `public/` (Joe drags file into repo; tracked in plan).
  - Generate QR with `qrcode` npm CLI: `npx qrcode https://<prod-domain> -o public/resume-qr.png` and check the PNG into the repo for archival.
  - Update LinkedIn URL field, PDF embedded URL, personal site link.
  - Sign `guardrails.md` (Joe adds his initials + date to the file, commits).
  - Set Anthropic org cap (D-D-02).
  - Run pre-launch checklist (LAUNCH-06): all EVAL-* passing on prod deploy, real-transcript end-to-end verified in `/admin/sessions`, friend-test sign-off filed.
  - Flip resume-link state (Joe physically prints paper resume with QR; updates digital resume).
- **D-D-05:** **Decision recording for domain** — domain choice deferred to planning time. Capture in CONTEXT.md as Specifics: NEEDS-INPUT-AT-PLAN-TIME so the planner explicitly prompts Joe.

### Folded Todos
None — `todo match-phase 5` returned 0 matches.

### Claude's Discretion
- Specific cross-vendor judge model (D-A-05) — gsd-phase-researcher chooses GPT-4.1-mini vs Gemini 2.5 Flash at planning time.
- Whether to add a 5th alarm condition for weekly-eval failure (D-C-06 question).
- Detailed `eval_runs` / `eval_cases` / `eval_calibrations` schema columns beyond the seed list in D-A-09.
- Plan numbering / wave structure (sequential single-developer execution; wave structure unlikely to add value).
- Whether the qrcode CLI generates PNG inline at launch time or via a `scripts/generate-qr.ts` helper.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec & Requirements
- [docs/superpowers/specs/2026-04-21-resume-agent-design.md](docs/superpowers/specs/2026-04-21-resume-agent-design.md) — Original approved design spec. Read for: eval section rationale, the launch-criteria section, the four-layer voice defense (cat 4 context).
- [.planning/REQUIREMENTS.md](.planning/REQUIREMENTS.md) — Specifically EVAL-01..14, LAUNCH-01..07, SAFE-12 (deferred carry-over). All Phase 5 requirements are listed there.
- [.planning/PROJECT.md](.planning/PROJECT.md) — Vision, constraints, top quality risk (generic ChatGPT voice → cat 4 is the launch gate), top correctness risk (fabrication → cat 1 zero-tolerance).
- [.planning/ROADMAP.md](.planning/ROADMAP.md) §Phase 5 — Goal statement, 6 success criteria, requirement list.

### Prior-Phase Decisions to Reuse
- [.planning/phases/04-admin-observability/04-CONTEXT.md](.planning/phases/04-admin-observability/04-CONTEXT.md) — D-A-01..07 (admin auth two-layer), D-B-03..06 (admin shell + sub-routes + shadcn Table), D-C-08..10 (cron-job.org config + CRON_SECRET + heartbeat pattern), D-G-01 (alarms_fired schema pattern reused for eval_runs).
- [.planning/phases/03-tools-resilience/03-CONTEXT.md](.planning/phases/03-tools-resilience/03-CONTEXT.md) — D-I (Pino logging), D-J (/api/health) — eval cat 6 probes /api/health.
- [.planning/phases/02-safe-chat-core/02-CONTEXT.md](.planning/phases/02-safe-chat-core/02-CONTEXT.md) — SAFE-12 deferral context (Anthropic org-level cap).
- [.planning/phases/01-foundation-content/](.planning/phases/01-foundation-content/) — kb/ structure (voice.md, profile.yml — eval cat 1 name-token allow-list reads from profile.yml; cat 4 real-Joe paragraphs read from voice.md).

### Outstanding HUMAN-UAT (Phase 5 D-D-01 input)
- [.planning/phases/03-tools-resilience/03-HUMAN-UAT.md](.planning/phases/03-tools-resilience/03-HUMAN-UAT.md) — 9 items, live runtime smoke for tool execution, trace panel, fallback.
- [.planning/phases/04-admin-observability/04-HUMAN-UAT.md](.planning/phases/04-admin-observability/04-HUMAN-UAT.md) — 11 items, live OAuth, email idempotency, cron + BetterStack ops.

### Phase 5 STATE-of-Project Markers
- [.planning/STATE.md](.planning/STATE.md) — Phase 4 closure markers, current branch state.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Vitest** ([package.json](package.json)) — `npm run test` exists; eval CLI is separate but unit tests of the runner itself live here.
- **Playwright** ([playwright.config.ts](playwright.config.ts), [tests/e2e/chat-happy-path.spec.ts](tests/e2e/chat-happy-path.spec.ts)) — already configured. Cat 6 specs extend this directory: `tests/e2e/cat-06-*.spec.ts`. Eval CLI invokes `npx playwright test --grep cat-06` as a subprocess and parses JSON reporter output.
- **`requireAdmin()`** (Phase 4) — `/admin/evals/*`, `/admin/eval-ab`, `/api/admin/eval-ab` all wrap with this.
- **shadcn `<Table>`** primitive (Phase 4) — `/admin/evals` index reuses without modification.
- **shadcn `<Card>`, `<Button>`** — `/admin/eval-ab` snippet rendering.
- **`src/lib/cron-auth.ts`** (Phase 4 D-C-09) — `/api/cron/run-eval` reuses `requireCronAuth(req)`.
- **`src/lib/supabase-server.ts`** (service-role client, Phase 4) — used for eval_runs writes from CI (no RLS).
- **Resend + React Email** templates pattern in `src/emails/` (Phase 4) — reusable for eval-failure alarm template (planner's discretion).
- **`src/lib/free-mail-domains.ts`** (Phase 4 D-C-03) — friend-test recruitment doesn't strictly need this, but useful if Joe wants to flag friend-tester emails differently.
- **Pino logger** (`src/lib/logger.ts`, Phase 3 D-I) — eval CLI uses Pino for run output (structured JSON, parseable in CI logs).

### Established Patterns
- **Atomic-claim idempotency** (Phase 4 D-C-05 `UPDATE...WHERE first_email_sent_at IS NULL`) — reused if eval-failure alarm needs idempotency per run.
- **`waitUntil()` for fire-and-forget I/O after streaming response** (Phase 2 ARCHITECTURE) — eval CLI doesn't need this (synchronous), but `/api/cron/run-eval` may use it if it kicks off a long-running CI job.
- **shadcn admin layout + top-bar nav** (Phase 4 D-B-03) — adds "Evals" nav entry (Sessions / Cost / Abuse / Health / **Evals** / Sign out).
- **Migration pattern** — single new migration `migrations/0003_phase5.sql` for `eval_runs`, `eval_cases`, `eval_calibrations`, `sessions.first_email_sent_at` (already in 0002), and any indices.
- **Pino structured event-name convention** (`event: 'admin_403'`, `event: 'heartbeat'`) — eval emits `event: 'eval_run_started'`, `event: 'eval_case_complete'`, `event: 'eval_run_summary'`.

### Integration Points
- **GitHub Actions secrets** — needs `ANTHROPIC_API_KEY`, `EVAL_JUDGE_VENDOR_KEY` (OpenAI or Google), `SUPABASE_SERVICE_ROLE_KEY`, Vercel API token for preview-URL lookup.
- **Vercel deployment status webhook** — wired in GitHub Actions to fire eval after preview goes ready. Alternative: `vercel/check-deployment` or polling.
- **Vercel branch protection / Vercel deployment-protection** — Joe configures externally; the Action's required-check name must match what's whitelisted in branch protection rules.
- **`cron-job.org`** — Joe adds a 4th scheduled job (Mon 03:00 ET) hitting `/api/cron/run-eval` with the same `CRON_SECRET` Bearer header pattern.
- **`/api/admin/eval-ab`** — new admin POST route, gated by `requireAdmin()`.
- **New env vars to add to `src/lib/env.ts`** (zod): `EVAL_JUDGE_MODEL` (optional), `OPENAI_API_KEY` OR `GOOGLE_GENERATIVE_AI_API_KEY` (one required, picked at planning), `EVAL_TARGET_URL` (optional; CI-provided).
- **Resume PDF placement** — `public/joe-dollinger-resume.pdf` referenced from landing page (Phase 1 / Phase 3 already wired the link; Phase 5 D-D-04 just drops the file).

</code_context>

<specifics>
## Specific Ideas

- **NEEDS-INPUT-AT-PLAN-TIME — Public domain choice (LAUNCH-01):** Joe to decide subdomain (e.g., `chat.joedollinger.com`) vs dedicated (e.g., `joeagent.dev`) at planning time. Planner MUST explicitly ask. Joe's call depends on DNS access info he doesn't have in front of him today.
- **Cat-04 fixed prompts** (used by both LLM-judge AND blind A/B): Joe will provide 5 specific prompts at planning or research time that elicit voice. Examples to seed but NOT lock: "tell me about a time you made the wrong call", "how do you think about prioritization on a brand-new product", "what's a stance you hold that other PMs disagree with", "describe a tough cross-functional conflict", "walk me through a recent failure you learned from". Final list curated by Joe.
- **Voice.md curated A/B excerpts:** Joe to pre-select 5 voice.md (or fresh unfiltered) excerpts at planning/research time, ~80-120 words each.
- **Friend-tester recruits:** Joe identifies 3 specific people (≥1 PM, ≥1 non-PM) at launch-plan time. Names captured in launch-checklist artifact.
- **QR code:** plain monochrome PNG, ≥250×250px, generated from final prod URL via `npx qrcode <url> -o public/resume-qr.png` and checked into repo for paper-resume sourcing.
- **Anthropic org cap (SAFE-12):** $20/mo (matches code-level $3/day with margin).

</specifics>

<deferred>
## Deferred Ideas

- **Multi-tester aggregation for cat 4 A/B** — v1 uses per-tester rows; stricter aggregation rules can land in v2 as a query change without schema migration.
- **Custom domain beyond Vercel subdomain** — `LAUNCH-D1` v2.
- **Daily digest email** — `OBSV-D1` v2.
- **Weekly question-clustering job** — `OBSV-D2` v2.
- **End-of-session feedback prompt** — `OBSV-D3` v2 (drift in PROJECT.md to reconcile at next `/gsd-transition`).
- **Cheaper-subset eval on PR** (D-C-02 alternate) — defer until annual GitHub Actions eval cost actually becomes a concern; not worth the dual-config maintenance now.
- **Public token-gated `/ab-test` page** (D-B-01 alternate) — defer until friend-tester volume exceeds Joe's screen-sharing capacity; for v1 launch, /admin/eval-ab + Joe-present is sufficient.
- **Eval-failure alarm via Phase 4 dispatcher (5th condition)** — planner's discretion whether to add in Phase 5 or defer; mechanism is trivial if added.

### Reviewed Todos (not folded)
None — todo match returned zero matches for Phase 5.

</deferred>

---

*Phase: 05-eval-gates-launch*
*Context gathered: 2026-05-07*
