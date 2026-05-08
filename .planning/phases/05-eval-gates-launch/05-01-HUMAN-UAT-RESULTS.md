---
walked_at: 2026-05-07
preview_url: local:dev
env_mode: local-dev
---

# Phase 5-01 HUMAN-UAT Results

Walkthrough of all 20 outstanding HUMAN-UAT items (9 Phase 3 + 11 Phase 4) per plan
[05-01-PLAN.md](./05-01-PLAN.md). This is the gating walk before Phase 5 eval-suite
work begins — eval results are only meaningful against a known-good agent.

## Pre-Walk Setup (2026-05-07 evening)

Hygiene completed before scaffold:

- Rotated `SUPABASE_SERVICE_ROLE_KEY` (transcript exposure during pre-walk inspection)
- Rotated `UPSTASH_REDIS_REST_TOKEN` (same)
- Renamed `ADMIN_GITHUB_USERNAMES` → `ADMIN_GITHUB_LOGINS` in `.env.local` (matches Plan 04-01)
- Sourced real `ANTHROPIC_API_KEY`, `EXA_API_KEY`, `RESEND_API_KEY`
- Populated missing config vars: `CRON_SECRET` (64-char hex), `JOE_NOTIFICATION_EMAIL`,
  `RESEND_FROM_EMAIL=onboarding@resend.dev` (sandbox), `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
- Left `BETTERSTACK_DASHBOARD_URL` unset (item 10 BLOCKED-NO-INFRA tonight)

## Phase 3 UAT (9 items)

Source: [03-HUMAN-UAT.md](../03-tools-resilience/03-HUMAN-UAT.md). Reference each item's
`expected:` block in the source file before walking.

### 1. Live Exa call observable in DevTools when triggering research_company
result: PASS
notes: After BL-09 classifier fix, "I'm at Anthropic. Pitch me on why you'd fit..." prompt fired research_company against live Exa. Tool trace rendered under assistant message; output JSON contained 4 sources (cbinsights.com, fx.linkedin.com, sequoiacap.com, time.com) with `published_date` 2026-02-13, 2026-02-25, 2026-03-11, 2026-04-24 — all within 90-day freshness window. Real fetched-content blocks visible. cost_dollars total $0.007.

### 2. Pitch tool produces 3-paragraph tailored output with live clickable source URLs
result: PARTIAL
notes: 3-paragraph response rendered ✓; pitch leaned on the "connection" beat (how Joe's PM/BI background maps to Anthropic) without the full observation→connection→first-problem-I'd-dig-into framing. Source URLs present in `research_company` tool-result JSON (trace panel) but NOT emitted in the assistant prose body — system prompt has no instruction telling Sonnet to surface a Sources footer (BL-11). Rendering of bare URLs in prose verified by new regression test ([tests/components/MessageBubble.test.tsx](../../../tests/components/MessageBubble.test.tsx) "BL-10: bare URLs in assistant prose autolink"); BL-10 fix landed (react-markdown + remark-gfm) but is unobservable until BL-11 lands.

### 3. Walkthrough narration is ~400 words, first-person, ends with "Want to go deeper, or hear a different story?"
result: PASS
notes: 2026-05-08 walk. `get_case_study` tool fired in menu mode then case_study mode (latencies 4ms / 0ms cache-hit) per dev log. Joe confirms narration output meets the expected shape. Word-count not separately measured.

### 4. MetricCard renders inline above TracePanel with Sonnet commentary stream
result: PARTIAL
notes: 2026-05-08 walk after BL-15 fix. Joe confirms `<MetricCard>` rendered with structured fields. **Streaming gap**: response landed all at once after ~60s of silence — Sonnet's commentary did NOT stream alongside the tool wait. Dev log: `tool_call design_metric_framework status:ok latency_ms:38698`, then `event:chat output_tokens:518 latency_ms:60045`. The 38.7s metric tool sub-call (Haiku 4.5 with forced tool_choice) plus subsequent ~21s Sonnet response = recruiter staring at a loading state for a full minute. Filed as BL-16 below — two distinct concerns: (a) anomalous Haiku tool latency, (b) no in-tool-wait UX feedback. Pre-walk discovery: classifier false-positive on first prompt attempt ("Design a metric framework for measuring chat agent quality" → offtopic 0.72) — known pattern from BL-09; recruiter-shaped phrasing slipped through. Adding the false-positive to Phase 5 eval cat 5 corpus is already on the roadmap.

### 5. Trace panel collapse/expand UX with chevron
result: PASS
notes: Trace panel renders collapsed by default with chevron ✓. Click expands. Tool args + `research_company` output JSON visible in monospace/code styling ✓. Joe walked this during Item #1 / #2 prompt against Anthropic.

### 6. Yellow status banner copy renders on real degraded state
result: [pending]
notes:

### 7. Plain-HTML fallback renders on /?fallback=1 with mailto CTA + 3 roles + LinkedIn/GitHub
result: PASS
notes: HTTP 200 on `/?fallback=1`; rendered HTML contains `data-testid="plain-html-fallback"`, `mailto:joe.dollinger@gmail.com` (1 match), 0 form elements (no email gate), 0 status-banner markers. 3 recent roles present (Senior Consultant @ Nimbl Digital · Sales Eng @ Retailcloud · Sr Mgr BI @ Gap). LinkedIn + GitHub + Résumé links rendered with stable testids. about_me first paragraph rendered verbatim from KB.

### 8. ChatUI redirect to /?fallback=1 after 2 consecutive /api/chat 500s
result: [pending]
notes:

### 9. Resume PDF link /joe-dollinger-resume.pdf
result: FAIL-EXPECTED
notes: HTTP 404 confirmed via curl (PDF not in public/). Per plan 05-01 guidance — does NOT count toward NO-GO verdict; rolls into BL-01 / Plan 05-11.

## Phase 4 UAT (11 items)

Source: [04-HUMAN-UAT.md](../04-admin-observability/04-HUMAN-UAT.md). Reference each item's
`expected:` block in the source file before walking.

### 1. GitHub OAuth happy path on deploy preview
result: [pending]
notes: Local-dev mode — register GitHub OAuth callback `http://localhost:3000/admin/auth/callback` in your OAuth app settings, or mark BLOCKED-NO-INFRA if app is configured for production callback only.

### 2. Non-allowlisted GitHub account
result: [pending]
notes:

### 3. First-message-of-session email
result: PASS
notes: 2026-05-08 walk after BL-12 fix. Single `session_email_sent` event in dev log: session_id=Q4xYR7KudmmBMn42qIIkL, is_priority=true, resend_send_id=3295267e-05dd-4ed5-a6af-10795ad58ecf, latency_ms=526. Joe confirms one email in inbox. Resend sandbox sender used (`onboarding@resend.dev`) — production swap is BL-06 / Plan 05-11.

### 4. Per-session email idempotency
result: PASS
notes: 2026-05-08 walk. Second message in same session produced zero additional `session_email_sent`/`session_email_send_failed` events in dev log. Joe confirms still one email in inbox after second send.

### 5. /api/cron/check-alarms auth gate
result: PASS
notes: `curl -X POST` without Authorization → HTTP 401 `{"error":"unauthorized"}`. With `Authorization: Bearer $CRON_SECRET` → HTTP 200 `{"ok":true,"results":[4 conditions],"fired_count":1}` — dep-down fired (heartbeat keys cold at curl time, expected during pre-flight; alarm email sent to JOE_NOTIFICATION_EMAIL; resend_send_id confirmed in body).

### 6. Force-trip spend-cap alarm
result: PASS
notes: SET `resume-agent:spend:2026-05-08T01` to 350 via Upstash REST API. Run #1 of /api/cron/check-alarms returned `spend-cap: tripped:true, fired:true, resend_send_id: fdb5aa85-435e-48d8-8875-38909e598d4f` (alarm email dispatched). Run #2 within seconds returned `spend-cap: tripped:true, fired:FALSE, resend_send_id:null` — per-condition NX suppression confirmed working. Cleanup: DEL returned 1, GET returned null. Joe to verify (a) ONE `[ALARM] resume-agent: spend-cap` email arrived (Run #2 was correctly suppressed by NX, no email), and (b) `alarms_fired` row exists in Supabase + /admin/health "Recent alarms" widget shows the entry post-OAuth.

### 7. /api/cron/heartbeat live behavior
result: PASS
notes: 2026-05-08 walk after BL-12 fix + warm chat. Two `/api/cron/heartbeat` calls back-to-back: call #1 cache_read_tokens=0 (cold heartbeat-cache), call #2 cache_read_tokens=20035, cost_cents=1. Both calls returned HTTP 200 `{"ok":true}` and emitted `event:'heartbeat'`. **Mental-model correction**: original PARTIAL note assumed "warm chat first" was the prerequisite — actually heartbeat and chat use *different* system-prompt shapes that don't share a cache prefix. The real prerequisite is "one prior heartbeat call." In production with cron-job.org hitting heartbeat every ~5min during business hours, every call after the first hits the cache. Side observation: `anthropic`/`classifier` show `degraded` in the heartbeat event payload even right after the call refreshes their Redis keys — likely an in-route ordering quirk in pingDeps vs key-refresh; non-blocking (separate from /api/health which is what the UI banner reads). Filed as BL-13 below for follow-up.

### 8. /api/cron/archive smoke on fresh deploy
result: PASS
notes: HTTP 200 + `{"ok":true,"sessions_archived":0,"rows_archived":0,"rows_deleted_classifier_90d":0,"errors":[]}` via curl with bearer. Zero counts as expected on fresh DB.

### 9. cron-job.org schedules configured
result: BLOCKED-NO-INFRA
notes: No public URL on local-dev for cron-job.org to reach. Folds into BL-02 / Plan 05-11 launch checklist; not counted toward NO-GO verdict.

### 10. BetterStack synthetic monitor + dashboard link
result: BLOCKED-NO-INFRA
notes: No public URL on local-dev. Folds into BL-03 / Plan 05-11 launch checklist; not counted toward NO-GO verdict.

### 11. Visual confirmation of always-expanded admin trace
result: [pending]
notes:

## Bug Backlog

Pre-populated with known infra gaps that will surface during the walk. Add new rows for any
bugs discovered during walk. Severities:
- `block-launch` — broken core flow; must fix before any eval work
- `fix-before-eval` — eval suite would be unreliable until fixed
- `launch-checklist` — non-blocking; rolls into 05-11 LAUNCH-* work

| id | title | severity | proposed action |
|----|-------|----------|-----------------|
| BL-01 | Resume PDF 404 at `/joe-dollinger-resume.pdf` | launch-checklist | Drop `joe-dollinger-resume.pdf` into `public/` (Plan 05-11) |
| BL-02 | cron-job.org schedules not configured | launch-checklist | Configure 3 jobs (check-alarms 5m / heartbeat 5m business hours / archive daily 03:00 ET) (Plan 05-11) |
| BL-03 | BetterStack synthetic monitor + dashboard URL not configured | launch-checklist | Set up monitor + populate `BETTERSTACK_DASHBOARD_URL` (Plan 05-11) |
| BL-04 | No GitHub remote configured | launch-checklist | Push to GitHub repo (Plan 05-11) |
| BL-05 | No Vercel project linked | launch-checklist | Connect Vercel project, mirror `.env.local` into Vercel env vars, push test branch for preview (Plan 05-11) |
| BL-06 | `RESEND_FROM_EMAIL` using sandbox sender (`onboarding@resend.dev`) | launch-checklist | Verify domain in Resend, swap to verified sender before public deploy (Plan 05-11) |
| BL-07 | Anthropic org-level $20/mo spend cap not yet set in console.anthropic.com | launch-checklist | Set cap in Anthropic console before public deploy (SAFE-12 carry-forward) |
| BL-08 | `/admin/login` failed `next build` prerender — `useSearchParams()` not wrapped in `<Suspense>` | block-launch | FIXED inline 2026-05-07 during 05-01 pre-flight: extracted `OAuthErrorMessage` child + wrapped in `<Suspense fallback={null}>` ([src/app/admin/login/page.tsx](../../../src/app/admin/login/page.tsx)). `next build` now exits 0; `/admin/login` prerenders as static. |
| BL-09 | Classifier brittle JSON parse — Haiku 4.5 sometimes emits `{...}\nReasoning:...` trailing prose despite prompt; every classify call fail-closed to `offtopic` confidence:1.0; every chat message deflected; heartbeat shows `classifier:degraded` | block-launch | FIXED inline 2026-05-07 during 05-01 walk: extract first flat JSON object via `/\{[^{}]*\}/` regex before `JSON.parse` ([src/lib/classifier.ts:53-56](../../../src/lib/classifier.ts#L53-L56)); added regression test in [tests/lib/classifier.test.ts](../../../tests/lib/classifier.test.ts). False-positive corpus still owed in Phase 5 eval cat 5 (separate from this fix). |
| BL-10 | MessageBubble had no Markdown rendering — even when Sonnet emitted source URLs in prose, they rendered as plain text (item #2 expected clickable URLs) | fix-before-eval | FIXED inline 2026-05-07 during 05-01 walk: added `react-markdown` + `remark-gfm` to render assistant prose; auto-linkify on bare URLs; custom `<a target=_blank rel=noopener>` renderer; h1-h6 collapsed to `<p>` (defense-in-depth, D-I-07). Regression test added in [tests/components/MessageBubble.test.tsx](../../../tests/components/MessageBubble.test.tsx) — 8/8 passing. |
| BL-11 | System prompt has no rule instructing Sonnet to surface a "Sources:" footer in pitch-tool prose; URL emission is whim-driven; clickability work (BL-10) is unobservable until this lands | fix-before-eval | Add a Sonnet-prose rule: "After calling research_company, end the pitch with a Sources: line listing each URL on its own line (bare URL, no markdown wrapping)." Add a regression eval in cat 6 quality scoring. Token-cost: ~30 tokens added to cached system prompt; one-time cache warmup. Owner: Joe. Target: decimal phase 5.1 (post-walk fix bundle). |
| BL-12 | First-message recruiter notification email fails: `session_email_send_failed` with `Failed to render React component. Make sure to install @react-email/render or @react-email/components`. Resend internally calls `@react-email/render` to turn `SessionNotification.tsx` JSX into HTML; only `@react-email/components` is in package.json — `@react-email/render` is missing as a direct dep. Discovered 2026-05-08 during walk, blocks P4 UAT #3. | block-launch | FIXED inline 2026-05-08 during 05-01 walk: `npm i @react-email/render` (v2.0.8); restarted dev; re-walked P4 #3/#4 — single `session_email_sent` event, idempotency confirmed. Dep bump in package.json/package-lock pending commit at end of walk. |
| BL-13 | `/api/cron/heartbeat` event payload reports `statuses.anthropic=degraded` and `statuses.classifier=degraded` even immediately after the route refreshes both `heartbeat:anthropic` / `heartbeat:classifier` Redis keys (TTL=120s). Suggests pingDeps() reads the Redis keys BEFORE the route refreshes them, so the heartbeat self-reports stale status. /api/health (the UI banner source) is a separate code path — likely unaffected, but worth confirming. Discovered 2026-05-08 during P4 #7 walk. | launch-checklist | Trace pingDeps call-order in `/api/cron/heartbeat`. Likely fix: refresh keys BEFORE pingDeps reads them, or fold the in-route refresh into pingDeps' anthropic/classifier checks. Defer to Phase 5.1 fix bundle — non-blocking for launch gate (eval suite + /api/health are unaffected). |
| BL-14 | `design_metric_framework` tool catch block logged only `error_class` not `error_message`, blinding root-cause investigation. Regression of WR-02 Pino logging discipline pattern. Discovered 2026-05-08 during P3 #4 walk. | fix-before-eval | FIXED inline 2026-05-08 during 05-01 walk: added `error_message: (err as Error).message ?? String(err)` to the catch block. Pending commit at end of walk. **Audit owed**: grep other tool catch blocks for the same omission and patch in one bundle (TOOL-* files) — defer to Phase 5.1 bundle. |
| BL-15 | `design_metric_framework` tool 100% broken in production: `OUTPUT_METRIC_FRAMEWORK_TOOL.input_schema` missing `additionalProperties: false`, which Anthropic's `strict: true` mode requires. Every tool call returns `400 invalid_request_error` and falls through to TOOL_FAILURE_COPY. Recruiter sees graceful "Metric tool tripped" message — never sees a real metric framework. Discovered 2026-05-08 during P3 #4 walk via BL-14 logging fix; root-cause error: `tools.0.custom: For 'object' type, 'additionalProperties' must be explicitly set to false`. | block-launch | FIXED inline 2026-05-08 during 05-01 walk: one-line addition `additionalProperties: false` to the tool's `input_schema`. Re-walked P3 #4 — tool now succeeds. Pending commit at end of walk. **Audit owed**: any other tool with `strict: true` and an `object`-type input_schema needs the same line — `research_company`, `get_case_study` use AI SDK `inputSchema` (zod) so probably exempt; only the forced-output sub-call tool inside `design_metric_framework` had this shape. Confirm via grep before launch. |
| BL-16 | `design_metric_framework` tool sub-call latency was 38.7s on the BL-15-verified retry; total chat latency 61s (38.7s tool + ~21s Sonnet response). During the 60s wait, Sonnet's prose did NOT stream alongside — Joe perceived the agent as "unresponsive." Two distinct concerns: **(a) anomalous Haiku 4.5 latency** — Haiku with `max_tokens:1500` and forced `tool_choice` should be sub-3s; 38.7s might be transient API load, strict-mode overhead, or cold-cache; needs a few more samples to characterize. **(b) no in-tool-wait UX feedback** — chat UI shows "thinking" indicator only on `status==='submitted'`; once the stream opens for tool execution, indicator disappears but no tokens are emitted until tool completes. Recruiter sees a silent loading state for the entire tool duration. Discovered 2026-05-08 during P3 #4 walk. | fix-before-eval | (a) Re-time the tool 5x next session — if consistently >10s, investigate Haiku endpoint behavior under `tool_choice: tool` + `strict: true`. May need to drop strict and rely on zod for output validation if the API path is genuinely slow. (b) Add an inline "Drafting metric framework..." chip in MessageBubble while tool-calling state is active (AI SDK v6 exposes tool-call lifecycle on `parts`). Both fixes target Phase 5.1 bundle pre-eval. |

## Walk Status: PAUSED 2026-05-08 (mid-walk)

**Walked: 15 of 20.** Verdict cannot be rendered until remaining 5 items walk.

### Round-by-round progress

- **Round 1 (chat loop)** — DONE: P3 #3 PASS, P3 #4 PARTIAL (BL-16), P4 #3 PASS, P4 #4 PASS, P4 #7 PASS
- **Round 2 (fault injection)** — NOT STARTED: P3 #6 yellow banner on degraded · P3 #8 fallback redirect after 2x 500s
- **Round 3 (admin/auth)** — NOT STARTED: P4 #11 admin trace · P4 #1 OAuth happy path (needs `http://localhost:3000/admin/auth/callback` registered in OAuth app) · P4 #2 non-allowlist

### Inline fixes landed during walk (commit pending)

Working tree (uncommitted as of pause):

- `src/lib/tools/design-metric-framework.ts` — **BL-14** error_message logging + **BL-15** `additionalProperties: false` (metric tool was 100% broken in prod, now works)
- `package.json` + `package-lock.json` — **BL-12** `npm i @react-email/render@^2.0.8` (recruiter notification email was failing render)
- `.planning/phases/05-eval-gates-launch/05-01-HUMAN-UAT-RESULTS.md` — this file

### Resume next session

1. Confirm dev server is up (`http://localhost:3000`) — kill & restart if stale.
2. Review BL-12/14/15 commit landed; BL-08/09/10 already shipped at `c09e2c7`.
3. Continue with **Round 2** (P3 #6, P3 #8) — fault injection. Claude can drive both via Redis/curl while Joe watches the browser. ~10 min.
4. Then Round 3 (admin/auth) — Joe to confirm OAuth callback URL registered before walking P4 #1.
5. After Round 3, render verdict + counts at top of this file.

### Bugs still owed (not fixed during this walk)

- **BL-11** (fix-before-eval): Sources footer system-prompt rule — keeps P3 #2 PARTIAL.
- **BL-13** (launch-checklist): heartbeat status-vs-refresh ordering quirk — non-blocking for launch gate.
- **BL-16** (fix-before-eval): metric tool latency + no streaming UX feedback — needs latency characterization (5x re-time) + a "Drafting..." chip.

## Counts

(filled at end of walk)

- PASS:
- FAIL:
- BLOCKED-NO-INFRA:
- TOTAL: 20
