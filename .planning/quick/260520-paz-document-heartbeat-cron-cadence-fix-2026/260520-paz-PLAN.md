---
phase: quick-260520-paz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/api/cron/heartbeat/route.ts
  - .planning/reports/MILESTONE_SUMMARY-v1.0.md
  - .planning/incidents/2026-05-20-heartbeat-overfire.md
autonomous: true
requirements:
  - QUICK-260520-paz
must_haves:
  truths:
    - "Top-of-file comment in heartbeat/route.ts accurately describes the operational schedule (5-min biz-hrs, TZ America/New_York) as of 2026-05-20."
    - "MILESTONE_SUMMARY-v1.0.md line 125 reflects the new 5-min cadence and the 2026-05-20 reconciliation date, not the prior 1-min over-fire."
    - "A discoverable incident post-mortem exists at .planning/incidents/2026-05-20-heartbeat-overfire.md capturing what/why/detection/fix and the open spend-cap-scope-gap backlog item."
  artifacts:
    - path: "src/app/api/cron/heartbeat/route.ts"
      provides: "Updated top-of-file schedule comment referencing the actual */5 9-17 * * 1-5 TZ America/New_York schedule and a one-line note about the 2026-05-20 reconciliation from the prior every-minute cadence."
      contains: "*/5 9-17 * * 1-5"
    - path: ".planning/reports/MILESTONE_SUMMARY-v1.0.md"
      provides: "Updated tech-debt line 125 reflecting the 5-min cadence and reconciliation date."
      contains: "5-min biz-hrs"
    - path: ".planning/incidents/2026-05-20-heartbeat-overfire.md"
      provides: "Post-mortem with sections: What happened, Root cause, Detection, Fix applied, Open systemic issue."
      min_lines: 30
  key_links:
    - from: "src/app/api/cron/heartbeat/route.ts (top comment)"
      to: ".planning/incidents/2026-05-20-heartbeat-overfire.md"
      via: "shared schedule string `*/5 9-17 * * 1-5` and 2026-05-20 reconciliation date"
      pattern: "\\*/5 9-17 \\* \\* 1-5"
    - from: ".planning/reports/MILESTONE_SUMMARY-v1.0.md (Section 6 line 125)"
      to: ".planning/incidents/2026-05-20-heartbeat-overfire.md"
      via: "shared reconciliation-date phrasing so future readers can cross-reference"
      pattern: "2026-05-20"
---

<objective>
Document the 2026-05-20 heartbeat cron cadence reconciliation across three surfaces so future-Joe (and future agents) do not re-derive this from scratch.

Purpose: An unobserved schedule mismatch (intent `*/5` in code comment vs. operational `* 13-22` every-minute in cron-job.org) silently consumed ~$5.57/biz-day of Anthropic spend, exceeding the $3/day CLAUDE.md cap with no alarm because the spend cap is enforced only on /api/chat, not on cron paths. The fix has already been applied operationally — this plan is documentation only.

Output:
1. Updated top-of-file comment in `src/app/api/cron/heartbeat/route.ts` reflecting the actual operational schedule.
2. Updated line 125 of `.planning/reports/MILESTONE_SUMMARY-v1.0.md`.
3. New incident post-mortem at `.planning/incidents/2026-05-20-heartbeat-overfire.md` (new directory, no prior `incidents/` convention exists).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md

<!-- Background (paraphrased from the orchestrator brief; do not re-derive):
- Old prod schedule (cron-job.org dashboard, until 2026-05-20): `* 13-22 * * 1-5` UTC ~= every minute 9am-7pm ET Mon-Fri = ~600 fires/biz-day.
- Anthropic ephemeral prompt-cache TTL is 5 min, so 4-of-5 fires were wasted cache-read tokens (~$5.57/biz-day at observed cache_read_input_tokens volume).
- New prod schedule (set manually by Joe in cron-job.org dashboard, 2026-05-20): `*/5 9-17 * * 1-5` with timezone `America/New_York` (DST-safe). ~108 fires/biz-day, ~$1.08/biz-day, ~$20/biz-week saved.
- Detection: Joe manually questioned spend during a 3-day idle window (no logins May 17-20). No alarm fired because the $3/day spend cap is wired only on /api/chat, not on the cron path. This is a real backlog item.
- The original code comment (lines 5-9 of route.ts) already said "every 5 min during 9am-6pm ET Mon-Fri" — i.e. the comment was correct *intent*, the dashboard was wrong *reality*. Updating the comment must make clear the comment now describes the current operational reality plus the reconciliation date, so a future reader doesn't dismiss it as aspirational again.
-->

<interfaces>
<!-- Current top-of-file comment in src/app/api/cron/heartbeat/route.ts, lines 1-14
     (extracted via Read; do NOT re-read in execution): -->

```
// src/app/api/cron/heartbeat/route.ts
// Phase 4 OBSV-14 + D-C-10. Light-touch dep pings + optional Anthropic
// prompt-cache pre-warm.
//
// Schedule (cron-job.org, operationally configured): every 5 min during
// 9am–6pm ET Mon–Fri (e.g. `*/5 14-22 * * 1-5` UTC, or use cron-job.org's
// timezone selector). Outside business hours we accept that the recruiter's
// first request takes the cold-cache hit; cost vs. coverage trade is
// documented in CONTEXT.md D-C-10.
//
// RESEARCH §5 / Pitfall 5: the Anthropic call MUST use buildSystemPrompt()
// — never an inline copy. Cache hit on the recruiter session depends on
// byte-identical prefix match. This is the Phase 1 D-E determinism contract.
```

<!-- Current text at .planning/reports/MILESTONE_SUMMARY-v1.0.md line 125
     (extracted via Read; do NOT re-read in execution): -->

```
- **cron-job.org schedules** — 3 schedules to configure (heartbeat business-hours, archive daily, weekly eval). Heartbeat is LIVE (1-min biz-hrs); archive + weekly-eval deferred into Plan 05-12 because the weekly eval needs the stable prod URL after CNAME flip (now done at `joe-dollinger-chat.com`). ~10-15 min residual work.
```

<!-- Existing .planning/ subdirectory layout: phases/, quick/, reports/, research/, seeds/, todos/.
     NO `incidents/` directory exists yet. Task 2 will create it. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update heartbeat/route.ts top-of-file comment and MILESTONE_SUMMARY line 125</name>
  <files>src/app/api/cron/heartbeat/route.ts, .planning/reports/MILESTONE_SUMMARY-v1.0.md</files>
  <action>
Use Edit (not Write) on both files.

(A) In `src/app/api/cron/heartbeat/route.ts`, replace the existing schedule comment block (current lines 5-9, the paragraph starting "Schedule (cron-job.org, operationally configured):" and ending "...documented in CONTEXT.md D-C-10.") with a comment that:
  - States the actual operational schedule verbatim: `*/5 9-17 * * 1-5` with timezone `America/New_York` (DST-safe via cron-job.org's timezone selector).
  - Names the cost/TTL reason: Anthropic ephemeral prompt-cache TTL is ~5 min, so a 5-min cadence matches one cache-warming fire per TTL window; firing more often is wasted cache_read tokens.
  - Includes a single-line reconciliation note: "Reconciled 2026-05-20 from a prior every-minute schedule (`* 13-22 * * 1-5` UTC) that was silently over-firing — see .planning/incidents/2026-05-20-heartbeat-overfire.md." This sentence is the load-bearing signal that the comment now reflects reality, not aspiration.
  - Preserves the existing follow-on sentence about accepting the cold-cache hit outside business hours and the CONTEXT.md D-C-10 reference. Do NOT touch lines 11-13 (the RESEARCH §5 / Pitfall 5 paragraph) or any code below line 14.
  - Keep the comment style (`//` line comments, no JSDoc block) and wrap lines at a similar width to the existing comments.

(B) In `.planning/reports/MILESTONE_SUMMARY-v1.0.md` line 125, replace the substring `Heartbeat is LIVE (1-min biz-hrs)` with `Heartbeat is LIVE (5-min biz-hrs, TZ America/New_York; reconciled 2026-05-20 from prior 1-min over-fire — see .planning/incidents/2026-05-20-heartbeat-overfire.md)`. Leave the rest of the bullet unchanged (the archive + weekly-eval deferral sentence and the ~10-15 min residual-work note both remain accurate).

No emojis (per CLAUDE.md). No code logic changes. No imports added. No tests touched.
  </action>
  <verify>
    <automated>
PowerShell verification (run from repo root):

  # Heartbeat route comment reflects new schedule + reconciliation pointer
  $route = Get-Content src/app/api/cron/heartbeat/route.ts -Raw
  if ($route -notmatch '\*/5 9-17 \* \* 1-5') { throw "route.ts missing new schedule string" }
  if ($route -notmatch 'America/New_York') { throw "route.ts missing TZ" }
  if ($route -notmatch '2026-05-20') { throw "route.ts missing reconciliation date" }
  if ($route -notmatch 'incidents/2026-05-20-heartbeat-overfire\.md') { throw "route.ts missing incident cross-link" }
  # Sanity: code below the comment block must still parse — the runtime contract is unchanged
  if ($route -notmatch 'import Anthropic from ''@anthropic-ai/sdk''') { throw "route.ts imports broken" }
  if ($route -notmatch 'export async function POST') { throw "route.ts POST handler missing" }

  # Milestone summary updated
  $ms = Get-Content .planning/reports/MILESTONE_SUMMARY-v1.0.md -Raw
  if ($ms -match 'Heartbeat is LIVE \(1-min biz-hrs\)') { throw "MILESTONE still shows old 1-min text" }
  if ($ms -notmatch 'Heartbeat is LIVE \(5-min biz-hrs') { throw "MILESTONE missing new 5-min text" }
  if ($ms -notmatch '2026-05-20') { throw "MILESTONE missing reconciliation date" }

  # Compile gate (per Joe's local-vs-Vercel-build feedback memory): tsc must still pass since we only touched comments,
  # but run it to prove no accidental brace edit broke the file.
  npx tsc --noEmit
    </automated>
  </verify>
  <done>
- heartbeat/route.ts top comment names `*/5 9-17 * * 1-5`, TZ `America/New_York`, the 2026-05-20 reconciliation, the TTL=5min rationale, and links to the incident file.
- MILESTONE_SUMMARY-v1.0.md line 125 shows the new cadence + date + incident link.
- `npx tsc --noEmit` is clean (proves no comment edit corrupted the file).
- No other lines in either file were modified.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create incident post-mortem at .planning/incidents/2026-05-20-heartbeat-overfire.md</name>
  <files>.planning/incidents/2026-05-20-heartbeat-overfire.md</files>
  <action>
Create the `.planning/incidents/` directory (new — no prior convention exists; this seeds it) and write the post-mortem file. Use the Write tool.

Required sections (markdown H2 headings, in this order):

  # Heartbeat Cron Over-Fire — 2026-05-20

  Date detected: 2026-05-20. Date reconciled: 2026-05-20. Severity: financial-cost-only (no user-facing impact). Author: Joe + agent pair.

  ## Summary
  One-paragraph TL;DR: the heartbeat cron-job.org schedule fired every minute during business hours instead of every 5 minutes, wasting Anthropic prompt-cache reads (TTL=5min) at ~$5.57/biz-day. Silent for an unknown duration (>= 6 weekdays from ~2026-05-12 onward per the spend-cap-incident memory). Reconciled by setting the dashboard schedule to `*/5 9-17 * * 1-5` TZ `America/New_York`.

  ## What happened
  - Code comment in `src/app/api/cron/heartbeat/route.ts` documented intended schedule as `*/5` (every 5 min) during business hours.
  - Operational reality in the cron-job.org dashboard was `* 13-22 * * 1-5` UTC (every minute, 9am-7pm ET Mon-Fri) — ~600 fires/biz-day.
  - Each fire executed `warmPromptCache()` → Anthropic `messages.create` with `cache_control: ephemeral` against `buildSystemPrompt()`. Cache read at Sonnet 4.6 rate is ~$0.30/MTok; observed total ~$5.57/biz-day.
  - Anthropic ephemeral prompt-cache TTL is ~5 min: 4-of-5 fires hit a still-warm cache and added zero coverage value — pure waste.

  ## Root cause
  Schedule mismatch between source-of-truth surfaces:
  - **Intent** lived in the code comment (`*/5 14-22 * * 1-5` UTC).
  - **Reality** lived in a separate system (cron-job.org dashboard) with no programmatic check that the two agreed.
  No drift-detection mechanism exists between code comments and cron-job.org configuration.

  ## Detection
  Joe manually questioned Anthropic dashboard spend during a 3-day idle window (no `/api/chat` logins 2026-05-17 through 2026-05-20). Traced the unexplained spend to heartbeat fires by counting `event=heartbeat` log lines per biz-day. No automated alarm fired.

  ## Fix applied
  - cron-job.org dashboard schedule changed to `*/5 9-17 * * 1-5` with timezone `America/New_York` (DST-safe via the dashboard's timezone selector, no UTC math needed).
  - Expected new cost: ~108 fires/biz-day × ~1¢/fire = ~$1.08/biz-day, ~$20/biz-week saved vs. the over-fire baseline.
  - Code comment in `src/app/api/cron/heartbeat/route.ts` reconciled to match (this plan, Task 1).
  - MILESTONE_SUMMARY-v1.0.md line 125 reconciled to match (this plan, Task 1).

  ## Open systemic issue — spend cap scope gap (backlog)
  The $3/day spend cap in CLAUDE.md is enforced ONLY on the `/api/chat` path. The heartbeat cron path (`/api/cron/heartbeat`) does not consult the same daily-cap counter. At the over-fire cadence, the heartbeat alone consumed ~$5.57/biz-day — exceeding the documented daily cap before any user request — with no alarm.

  Backlog items (do NOT address in this quick task; this is a flag for the next milestone):
  - Wire `warmPromptCache()` cost into the same daily-cap counter used by `/api/chat`, or add a separate cron-budget counter with its own alarm threshold.
  - Add a `cron_run` cost-rollup alarm so a misconfigured schedule trips an email within one biz-day instead of silently spending for weeks.
  - Consider an automated drift check (e.g. CI step that reads cron-job.org's API for the heartbeat job and asserts the schedule string matches a constant in code).

  ## Lessons
  - Source-of-truth split between code comments and external dashboards is a recurring failure mode (this is the second cron-job.org-related ops surprise after the spend-cap incident on 2026-05-12). Prefer programmatic schedule registration when feasible, or codify the expected schedule as a verified constant.
  - The $3/day spend cap currently has a hole the size of the cron path. Treat the spend cap as scope-limited until that hole is closed.
  - Idle-window spend is a useful signal: any non-zero Anthropic spend during a no-login window means cron is the culprit; check cron cadence first.

  ## References
  - `src/app/api/cron/heartbeat/route.ts` — top-of-file comment now points back to this file.
  - `.planning/reports/MILESTONE_SUMMARY-v1.0.md` Section 6 line 125 — tech-debt bullet now reflects the 5-min cadence.
  - Prior related incident: spend-cap-incident memory note 2026-05-12 (single-hour 272¢ spike from eval verification + silent failure due to unscheduled alarm cron).

Style: plain markdown, no emojis (per CLAUDE.md). H1 + H2 headings only. No frontmatter required — this is a static doc, not a GSD artifact.
  </action>
  <verify>
    <automated>
PowerShell verification (run from repo root):

  $f = '.planning/incidents/2026-05-20-heartbeat-overfire.md'
  if (-not (Test-Path $f)) { throw "incident file missing" }
  $c = Get-Content $f -Raw
  # Required sections
  foreach ($section in @('## Summary','## What happened','## Root cause','## Detection','## Fix applied','## Open systemic issue','## Lessons','## References')) {
    if ($c -notmatch [regex]::Escape($section)) { throw "missing section: $section" }
  }
  # Load-bearing facts must appear verbatim
  if ($c -notmatch '\*/5 9-17 \* \* 1-5') { throw "missing new schedule string" }
  if ($c -notmatch '\* 13-22 \* \* 1-5') { throw "missing old schedule string" }
  if ($c -notmatch 'America/New_York') { throw "missing TZ" }
  if ($c -notmatch '2026-05-20') { throw "missing date" }
  if ($c -notmatch '\$3/day') { throw "missing spend cap reference" }
  if ($c -notmatch '/api/chat') { throw "missing /api/chat scope reference" }
  # No emoji enforcement (CLAUDE.md). Scan for any character above U+2000 that's not standard punctuation/whitespace.
  if ($c -match '[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]') { throw "emoji detected" }
  # Length sanity (must-haves require min_lines 30)
  $lineCount = ($c -split "`n").Count
  if ($lineCount -lt 30) { throw "file too short ($lineCount lines, expected >= 30)" }
    </automated>
  </verify>
  <done>
- `.planning/incidents/` directory exists (newly created).
- `.planning/incidents/2026-05-20-heartbeat-overfire.md` exists with all 8 required H2 sections.
- File contains both schedule strings (`*/5 9-17 * * 1-5` new, `* 13-22 * * 1-5` old), TZ `America/New_York`, the 2026-05-20 date, the `$3/day` cap reference, and the `/api/chat` scope-gap call-out.
- File is >= 30 lines.
- No emojis (CLAUDE.md).
  </done>
</task>

</tasks>

<verification>
Whole-plan checks after both tasks complete:

1. Cross-document consistency:
   - `src/app/api/cron/heartbeat/route.ts` references `.planning/incidents/2026-05-20-heartbeat-overfire.md`.
   - `.planning/reports/MILESTONE_SUMMARY-v1.0.md` references `.planning/incidents/2026-05-20-heartbeat-overfire.md`.
   - The incident file's References section back-references both.
   - All three surfaces use the identical schedule string `*/5 9-17 * * 1-5` and the identical reconciliation date `2026-05-20`.

2. No code-logic or behavior change: `npx tsc --noEmit` passes; no test file was touched; `route.ts` POST handler signature is unchanged.

3. PowerShell smoke (combined; copy-paste safe):

   $a = Select-String -Path src/app/api/cron/heartbeat/route.ts -Pattern '\*/5 9-17 \* \* 1-5' -Quiet
   $b = Select-String -Path .planning/reports/MILESTONE_SUMMARY-v1.0.md -Pattern '5-min biz-hrs' -Quiet
   $c = Test-Path .planning/incidents/2026-05-20-heartbeat-overfire.md
   if (-not ($a -and $b -and $c)) { throw "cross-doc consistency check failed" }
</verification>

<success_criteria>
- All three documentation surfaces reflect the 2026-05-20 reconciliation with consistent, verbatim schedule + date + TZ strings.
- A discoverable incident post-mortem exists at `.planning/incidents/2026-05-20-heartbeat-overfire.md` capturing root cause, detection, fix, and the open spend-cap-scope-gap backlog flag.
- Zero code-logic changes; `npx tsc --noEmit` clean.
- No emojis introduced (CLAUDE.md).
- No tests added or modified.
</success_criteria>

<output>
Create `.planning/quick/260520-paz-document-heartbeat-cron-cadence-fix-2026/260520-paz-SUMMARY.md` when done.
</output>
