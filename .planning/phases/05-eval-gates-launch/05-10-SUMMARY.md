---
phase: 05-eval-gates-launch
plan: 05-10
subsystem: ci-cd
tags: [eval-gate, vercel-deployment-checks, github-branch-protection, eval-09, eval-13, launch-07]

# Dependency graph
requires:
  - phase: 05-eval-gates-launch (Plan 05-02)
    provides: name-locked eval.yml scaffold (no-op step at job 'eval', workflow name 'eval', repository_dispatch trigger types)
  - phase: 05-eval-gates-launch (Plan 05-03..05-08)
    provides: working `npm run eval` CLI hitting six categories (cat1..cat6) — the gate has something to actually run
  - external: GitHub repo at jmd53695516/resume-agent (created during this plan, no pre-existing repo)
  - external: Vercel project joey-d-resume-agent/resume-agent-eyap (created during this plan, no pre-existing project)
provides:
  - ".github/workflows/eval.yml — full eval invocation: actions/checkout@v6 → setup-node@v5 → npm ci → playwright install → npm run eval (with 13 secrets injected) → vercel/repository-dispatch/actions/status@v1 notify"
  - "GitHub branch protection on `main` requiring `Vercel - resume-agent-eyap: eval` check; required PR (0 reviews — solo dev); enforce_admins=true"
  - "Vercel Deployment Checks integration on resume-agent-eyap project polling GitHub commit-status `Vercel - resume-agent-eyap: eval` — blocks prod alias promotion on red eval"
  - "package.json scripts: preeval npm hook (runs scripts/generate-fallback.ts so cat6 webServer compiles); eval uses --env-file-if-exists so CI doesn't trip on missing .env.local"
  - "scripts/install-pre-commit-hook.sh exclusion extended to .github/workflows/** (eval.yml legitimately references NEXT_PUBLIC_* secret names for runner injection)"
  - "src/components/ChatUI.tsx: onFinish destructure tightened to satisfy AI SDK v6 strict type (latent bug surfaced by Vercel's `next build` strict tsc — local dev never caught it)"
affects: [05-11 cron-eval-weekly (consumes the same workflow via scheduled-eval dispatch type), 05-12 launch (LAUNCH-05/07 hard-gate readiness — gate works; eval contents currently fail on real signal, tracked in deferred-items.md #10)]

# Tech tracking
tech-stack:
  added:
    - "vercel/repository-dispatch/actions/status@v1 (the bridge action — Vercel Deployment Checks reads commit status posted by this; auto-determines state from job.status; deprecated `state:` input dropped)"
  patterns:
    - "Two-layer prod gate: Layer 1 = GitHub branch protection (blocks merge to main); Layer 2 = Vercel Deployment Checks (blocks prod alias even if main has bad code). Either alone is one safety net; together they're defense-in-depth"
    - "Vercel→GH→Vercel handshake: Vercel auto-dispatches `vercel.deployment.ready` repository_dispatch on every preview deploy; GH workflow runs eval against client_payload.url; bridge action posts back via GH commit status; Vercel polls that status for promotion gating"
    - "Public repo for free branch protection (private free-tier doesn't enforce rules; GitHub Team is $4/user/mo); also amplifies portfolio thesis"
    - "npm preeval hook (instead of inline `tsx ... &&` chain) — cleaner separation; auto-runs before `npm run eval` whether invoked locally or in CI"
    - "--env-file-if-exists (not --env-file): no .env.local on CI runner; secrets come from process.env via GH Actions env block. Silent fallthrough beats noisy fail"

key-files:
  created:
    - "(none — all changes were edits to existing files + external infra setup)"
  modified:
    - ".github/workflows/eval.yml — Plan 05-02 no-op replaced with full eval invocation (Task 1, then iterated 4x to reach end-to-end working state)"
    - "package.json — eval script switched to --env-file-if-exists; preeval hook added to run generate-fallback before eval (cat6 module-not-found fix)"
    - "scripts/install-pre-commit-hook.sh — extended NAMES-exclusion to .github/workflows/** so eval.yml can reference NEXT_PUBLIC_* secret names"
    - "src/components/ChatUI.tsx — onFinish: ({ ... } = {}) → onFinish: ({ ... }) — AI SDK v6 strict type required field; latent bug Vercel's first deploy surfaced"
    - ".planning/phases/05-eval-gates-launch/deferred-items.md — added Items #9 (dual-Vercel-project) and #10 (eval failures on real signal — cat1 13/15, cat2 1/9, cat3 0/6, cat5 1/7, cat6 12/15)"

key-decisions:
  - "PRE-WORK GAP DISCOVERED (Rule 3 — blocking): Plan 05-10 assumed GitHub repo + Vercel project + Vercel↔GitHub integration already existed. Reality: zero external infra. Joe-paced setup of all three (gh CLI install + repo create + push; Vercel project create + GitHub link + 12 env vars + first deploy) consumed ~30 min before any 05-10 task code could ship. Added to project memory (project_infra_endpoints.md) so future plans don't repeat the assumption"
  - "Plan 05-10 Task 2 underspecified GH secret count (Rule 2 — added critical functionality): plan listed 4 secrets (ANTHROPIC, GOOGLE, SUPABASE_SERVICE_ROLE, NEXT_PUBLIC_SUPABASE_URL). Reality: src/lib/env.ts validates the full env set on import; eval CLI loads @/lib/env at module load. 9 more secrets needed (NEXT_PUBLIC_SUPABASE_ANON_KEY, EXA, UPSTASH×2, RESEND×2, JOE_NOTIFICATION_EMAIL, ADMIN_GITHUB_LOGINS, CRON_SECRET) — all 13 now configured. Surfaced by run 25630464156 Zod validator throw"
  - "Vercel Deployment Checks check name is NOT 'eval' (Rule 3 — Plan correction): plan + RESEARCH §3 said branch protection should require check named `eval` (matching workflow name + job name). Reality: Vercel registers the check as `Vercel - resume-agent-eyap: eval` — concatenates Vercel project name into the GitHub commit-status context. Branch protection now requires that exact string. The 'name-locked' RESEARCH guidance only applied to the workflow filename, not the GH check context"
  - "Bridge action API drift (Rule 2 — corrected per Vercel UI): RESEARCH §code-examples 1091-1118 used `state: 'pending'` and `state: 'failure'` inputs to vercel/repository-dispatch/actions/status@v1. Reality: that input was removed; action auto-determines state from job.status. Also requires `permissions: { actions: read, contents: read, statuses: write }` block on the job (RESEARCH didn't mention permissions). Removed status helpers entirely (commit 08220b3) then re-added with corrected API after Joe pasted the snippet Vercel's UI provided"
  - "Private-repo branch protection limitation (decision pivot — Joe-driven): GitHub Free + private repo branch protection rules can be CREATED but are NOT ENFORCED. After flipping to public (Joe decision after weighing kb/ exposure tradeoff), the existing rule activated immediately and blocked the next push (catch-22: rule required eval check that had never passed). Resolved by deleting rule via API → iterating to working state → re-adding rule via UI per Task 3a steps with the corrected check name"
  - "Vercel preview Deployment Protection blocked eval CLI (decision: disable for previews): preview-deploy URLs from Vercel are auth-gated by default; eval CLI hitting preview URL got 401 + login HTML page. Disabled Vercel Authentication on previews entirely (vs Protection Bypass for Automation token route — more secure but ~10 min more work). Acceptable because production URL is already public-by-design"
  - "Two Vercel projects for one repo (deferred cleanup): GitHub commit-status query revealed `joey-d-resume-agent/resume-agent` and `joey-d-resume-agent/resume-agent-eyap` both linked to the same repo, both auto-deploying on every push. Stayed with `resume-agent-eyap` (the one already wired) for 05-10 closeout; Item #9 in deferred-items.md tracks the cleanup quick task"
  - "Empty commit to validate Task 3b/3c (Rule 1 — explicit method choice): Vercel doesn't retroactively apply Deployment Checks to deploys created before the integration was configured. Used `git commit --allow-empty` to trigger a fresh deploy through the new gate without code changes. Joe verified Vercel UI labeled the deploy red + showed 'checks failed'; A7 spot-test passed (resume-agent-eyap.vercel.app still serving previous green deploy)"
  - "Latent ChatUI TS bug (added to scope — necessary unblock): Vercel's first `next build` failed at strict tsc on `src/components/ChatUI.tsx:46` — `onFinish: ({ ... } = {}) => {}` violated AI SDK v6 required-properties type. `npm run dev` + vitest never caught it. One-character fix; committed as fix(05-10) since it was blocking the in-flight plan. New feedback memory captures the local-vs-Vercel-build divergence"
  - "Eval contents currently fail on real signal (defer to LAUNCH-05): cat1 13/15, cat2 1/9, cat3 0/6, cat4 PASS, cat5 1/7, cat6 12/15. Plan 05-10's success criterion is 'CI blocks promote-to-prod on eval regression' — i.e., the gate works. Eval PASSING is Plan 05-12 LAUNCH-05's job. Currently-failing eval also conveniently validates the A7 spot-test without needing intentional sabotage. Items #6, #8, #10 in deferred-items.md"

patterns-established:
  - "Two-layer prod gate (GH branch protection + Vercel Deployment Checks reading the same eval check)"
  - "Vercel→GH→Vercel handshake via repository_dispatch + bridge action commit status"
  - "Public repo as both portfolio amplifier AND free branch-protection enabler"
  - "Pre-work infra gap detection: future plans that touch external services should check for repo + Vercel project + integration state in their CONTEXT before assuming"

threats-mitigated:
  - "T-05-10-01 (Information Disclosure — malicious workflow edit exfiltrates secrets): mitigated by branch protection requiring PR + eval check before merge. Solo-dev caveat: Joe can self-approve workflow edits in PRs but the eval check still runs against the modified workflow before merge"
  - "T-05-10-02 (Tampering — A7 spot-test could be skipped, gate fails silently in prod): mitigated by Task 3c verification this plan (A7 spot-test passed; Vercel labeled failing deploy red and did NOT update prod alias)"
  - "T-05-10-03 (Spoofing — renaming workflow/job silently breaks branch-protection binding): mitigated by branch protection now keyed to `Vercel - resume-agent-eyap: eval` context; renaming the workflow OR the Vercel project would also break the binding (caught by next CI failure). The lock comment in eval.yml header still warns against rename"
  - "T-05-10-04 (DoS — repeated rapid pushes burn GH minutes): accept; solo dev pace; public-repo unlimited free GH Actions minutes (post visibility flip)"
  - "T-05-10-05 (Elevation — Joe-as-admin bypasses branch protection): accept; documented as emergency-override; Vercel Deployment Checks (Layer 2) is the second gate that even GH-bypass can't skip"
  - "T-05-10-06 (Repudiation — eval failed but no record of who merged the bypass): mitigated by GH PR audit log; documented for post-incident review"

cost-tracking:
  - "Eval runs during this plan (manual + auto-dispatched): ~6 runs × ~$0.05-0.08 each = ~$0.40 total. Well under $3/day cap"
  - "Vercel build minutes: ~7 builds (each ~3 min) on Hobby plan; Joe is well under the 6000-min/month free tier"

deferred-items:
  - "Item #9 (dual Vercel project): clean up `joey-d-resume-agent/resume-agent` (empty duplicate) OR migrate canonical project to `resume-agent` (cleaner name, requires renaming bridge action + branch protection check + memory). Tracked in deferred-items.md"
  - "Item #10 (eval failures on real signal): cat1 13/15, cat2 1/9, cat3 0/6, cat5 1/7, cat6 12/15 — launch-blocking per LAUNCH-05; cat3 (full-sweep fail) is highest-priority root-cause investigation. Tracked in deferred-items.md"
  - "Renaming GitHub username `jmd53695516` post-launch (project_infra_endpoints.md): would require search-and-replace across kb/, plans, env vars referencing the repo full name"

acceptance-criteria-final:
  - "Task 1 (Replace eval.yml no-op with real eval invocation): ✓ COMPLETE — 4 iterations from initial 3a669a4 to final 54d362a"
  - "Task 2 (Configure GitHub Actions secrets): ✓ COMPLETE — all 13 required secrets configured (4 from plan + 9 added)"
  - "Task 3a (GitHub branch protection): ✓ COMPLETE — `Vercel - resume-agent-eyap: eval` required; 0 PR reviews; enforce_admins=true"
  - "Task 3b (Vercel Deployment Checks): ✓ COMPLETE — integration polls `Vercel - resume-agent-eyap: eval` on every deploy"
  - "Task 3c (A7 spot-test): ✓ COMPLETE — failing eval on commit 1f16d31 left red in Vercel UI; prod alias resume-agent-eyap.vercel.app continued serving previous green deploy"
  - "EVAL-09 satisfied: ✓ — CI provably blocks promote-to-prod on eval regression"
  - "EVAL-13 satisfied: ✓ — judge model pinned in eval-models.ts (Plan 05-02) + name-keyed workflow CI gate (this plan)"
  - "LAUNCH-07 prerequisite: ✓ — preview-to-prod promotion only via passing-eval Vercel deploy"
---

# Plan 05-10 Summary

Wired the Plan 05-10 launch-readiness gate end-to-end: every push to `main` triggers a Vercel preview deploy → GitHub Actions runs `npm run eval` against that deploy → result posted as GitHub commit status `Vercel - resume-agent-eyap: eval` → BOTH GitHub branch protection AND Vercel Deployment Checks read that status to gate merges + prod alias promotion respectively.

Plan estimated 3 tasks; reality required substantial pre-work and 7 iterative commits to reach a working pipeline. The eval CLI now runs end-to-end against the live deploy, returning real-signal failures (32/57 cases passing) — those failures are launch-blocking but are Plan 05-12 LAUNCH-05's job, not 05-10's. Plan 05-10's mandate was to wire the gate, and the gate is provably wired (A7 spot-test verified Joe's UI eyeball: red deploy in Vercel + prod alias unchanged).

## What shipped vs the plan

| Plan | Reality |
|---|---|
| 4 GH Actions secrets | 13 required (env.ts validates full set on module load) |
| Branch-protection check name `eval` | Actual name: `Vercel - resume-agent-eyap: eval` (Vercel concatenates project name into context) |
| `state: 'pending' / 'success' / 'failure'` on bridge action | API removed; auto-determined from `job.status` |
| Single eval.yml edit (Task 1) | 4 iterations: drop status helpers → fix env-file → expand secrets → re-add status helpers with current API + permissions |
| GitHub repo + Vercel project assumed | Neither existed; full setup chain required first (~30 min Joe-paced) |
| Branch protection on private repo | Not enforced on free tier; flipped repo public after kb/ exposure analysis |

## Outcomes

- ✅ EVAL-09: CI blocks promote-to-prod on eval regression — verified live
- ✅ EVAL-13: judge model pinned + name-keyed workflow CI gate
- ✅ LAUNCH-07 prerequisite: preview→prod only via passing-eval Vercel deploy
- ✅ T-05-10-02 mitigated via Task 3c spot-test
- 🟡 Eval contents currently failing on real signal (cat1 13/15, cat2 1/9, cat3 0/6, cat5 1/7, cat6 12/15) — defers to LAUNCH-05

## Commits this plan
- `3a669a4` ci(05-10): replace eval.yml no-op with real eval invocation (Task 1)
- `4eb16c9` fix(05-10): correct ChatUI onFinish destructure to satisfy AI SDK v6 type
- `08220b3` fix(05-10): drop vercel/repository-dispatch status helpers from eval.yml
- `79c204a` fix(05-10): use --env-file-if-exists for npm run eval
- `001d34e` fix(05-10): inject all 13 required env vars into eval workflow
- `42c33ff` fix(05-10): add preeval npm hook to generate fallback before eval CLI
- `54d362a` fix(05-10): re-add Vercel deployment-check bridge to eval.yml
- `1f16d31` chore(05-10): empty commit to validate Vercel Deployment Checks

## External actions (Joe-driven, no commit)
- `gh auth login` + repo creation + push (jmd53695516/resume-agent, public)
- Vercel project creation + GitHub link + 13 env vars (joey-d-resume-agent/resume-agent-eyap)
- Vercel preview Deployment Protection: disabled
- Vercel Deployment Checks: configured to require `Vercel - resume-agent-eyap: eval`
- GitHub branch protection on `main`: requires `Vercel - resume-agent-eyap: eval`, 0 PR reviews, enforce_admins on
- Vercel + GitHub UI eyeball verifications (Tasks 3b/3c)

## Next steps
- Plan 05-11: weekly drift cron run (consumes same workflow via `scheduled-eval` dispatch type)
- Plan 05-12: launch checklist (DNS, friend-test, SAFE-12 cap, PDF/QR upload, go-live) — eval failures from Item #10 must resolve before LAUNCH-05 sign-off
- Quick task: dual-Vercel-project cleanup (Item #9)
