---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: "Plan 07-01 hit Rule 4 architectural checkpoint. `eslint-plugin-react-hooks@6` (shipped in `eslint-config-next@16.2.4`) flags 9 pre-existing violations across Phase 02-05.2 shipped code: 5 `react-hooks/set-state-in-effect` (hydration patterns in `ChatStatusBanner.tsx`, `ChatUI.tsx`, `chat/page.tsx`, `LocalTime.tsx`, `RelativeTime.tsx`), 2 `react-hooks/purity` (server-component `Date.now()` in admin `abuse/page.tsx` + `evals/calibrate/page.tsx`), 2 trivial (`prefer-const`, unused `_reset`). Option F chosen 2026-05-14: defer Task 3, spin up new follow-up plan to resolve violations, then return to Plan 07-02 (`test.yml` + branch protection)."
stopped_at: Phase 7 Plan 07-1A context gathered (lint follow-up scope) — ready for /gsd-plan-phase 7
last_updated: "2026-05-14T00:52:09.507Z"
last_activity: 2026-05-14 -- Plan 07-01 PARTIAL `e4c26ea`; need new plan for React-hooks lint debt before 07-02
progress:
  total_phases: 16
  completed_phases: 7
  total_plans: 49
  completed_plans: 47
  percent: 96
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-07)

**Core value:** A recruiter in under five minutes walks away with a distinctive, specific impression of Joe — grounded in real projects, free of fabrication, and delivered by an agent they can see was engineered (not just prompted) with cost, abuse, and hallucination controls.
**Current focus:** Phase 07 — add-test-yml-github-actions-workflow-for-determinism

## Current Position

Phase: 07 (add-test-yml-github-actions-workflow-for-determinism) — EXECUTING (paused)
Plan: 1 of 2 — Plan 07-01 PARTIAL (Tasks 1+2 done, Task 3 deferred); Plan 07-02 blocked
Status: Plan 07-01 hit Rule 4 architectural checkpoint. `eslint-plugin-react-hooks@6` (shipped in `eslint-config-next@16.2.4`) flags 9 pre-existing violations across Phase 02-05.2 shipped code: 5 `react-hooks/set-state-in-effect` (hydration patterns in `ChatStatusBanner.tsx`, `ChatUI.tsx`, `chat/page.tsx`, `LocalTime.tsx`, `RelativeTime.tsx`), 2 `react-hooks/purity` (server-component `Date.now()` in admin `abuse/page.tsx` + `evals/calibrate/page.tsx`), 2 trivial (`prefer-const`, unused `_reset`). Option F chosen 2026-05-14: defer Task 3, spin up new follow-up plan to resolve violations, then return to Plan 07-02 (`test.yml` + branch protection).
Last activity: 2026-05-14 -- Plan 07-01 PARTIAL `e4c26ea`; need new plan for React-hooks lint debt before 07-02

Progress: [██████████] Phase 06: 6/6 plans complete (CLOSED). Phase 06 kb/about_me.md enrichment live on prod (https://joe-dollinger-chat.com); cat1 = 15/15 preview + 15/15 prod; cat4 = 4.20 preview + 4.52 prod (both per_case all pass); SAFE-11 17/17 green; 11 new cat1 ground_truth_facts entries; D-F-08 audit trail complete (4 eval_runs row IDs). Plan 05-12 functionally complete (code/data shipped, prod verified, gates green) — friend-test responses now re-collected on post-Phase-6 enriched artifact per OQ-04 Option A recommendation. Phase 05.2 fully closed. **v1.0 milestone close still gated only on Plan 05-12 friend-test sign-off — Phase 7 is parallel CI-hardening, does NOT block launch.**

## Performance Metrics

**Velocity:**

- Total plans completed: 29
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 02 | 4 | - | - |
| 03 | 6 | - | - |
| 04 | 7 | - | - |
| 05.2 | 6 | - | - |
| 06 | 6 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 02-safe-chat-core P01 | 33min | 11 tasks | 16 files |
| Phase 02-safe-chat-core P03 | 4min | 3 tasks | 6 files |
| Phase 02-safe-chat-core P04 | 8min | 5 tasks | 5 files |
| Phase 02-safe-chat-core P02 | 45 | 6 tasks | 3 files |
| Phase 03 P00 | 11min | 5 tasks | 11 files |
| Phase 03-tools-resilience P01 | 14min | 5 tasks | 16 files |
| Phase 03 P04 | 11min | 3 tasks | 11 files |
| Phase 03-tools-resilience P02 | 8min | 3 tasks | 5 files |
| Phase 03-tools-resilience P05 | 14min | 3 tasks | 12 files |
| Phase 03-tools-resilience P03 | 22min | 4 tasks | 10 files |
| Phase 04-admin-observability P01 | 32min | 7 tasks | 9 files |
| Phase 04-admin-observability P02 | 11min | 5 tasks | 9 files |
| Phase 04-admin-observability P05 | 7min | 4 tasks | 8 files |
| Phase 04 P03 | 12min | 6 tasks | 13 files |
| Phase 04-admin-observability P04 | 6min | 3 tasks | 8 files |
| Phase 04 P06 | 6min | 4 tasks | 7 files |
| Phase 04-admin-observability P07 | 7min | 3 tasks | 6 files |
| Phase 05-eval-gates-launch P05-05 | 10 | 3 tasks | 6 files |
| Phase 05-eval-gates-launch P05-06 | 12min | 3 tasks | 6 files |
| Phase 05-eval-gates-launch P05-07 | 18min | 3 tasks | 11 files |
| Phase 05-eval-gates-launch P05-08 | 22min | 4 tasks | 6 files |
| Phase 05-eval-gates-launch P05-09 | 12min | 3 tasks | 8 files |
| Phase 05.2 P01 | 6min | 3 tasks | 7 files |
| Phase 05.2 P02 | 2min | 1 tasks | 1 files |
| Phase 05.2 P03 | 4min | 3 tasks | 3 files |
| Phase 05.2 P04 | 3min | 2 tasks | 2 files |
| Phase 05.2 P05 | 4min | 2 tasks | 2 files |
| Phase 05.2 P06 | 12min | 3 tasks | 3 files |
| Phase 05.2 P04 | 3min | 2 tasks | 2 files |
| Phase 05.2 P05 | 4min | 2 tasks | 2 files |
| Phase 05-eval-gates-launch P13 | 8min | 2 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: 5-phase structure at coarse granularity; content acquisition is a parallel track within Phase 1 (Joe-time, launch-blocking)
- Roadmap: Cost + abuse controls (Phase 2) intentionally precede tools (Phase 3) because tools are the largest cost vector
- Roadmap: Eval cat 1 (fabrication, 15/15 hard gate) and cat 4 (voice fidelity, blind A/B + LLM judge) are joint launch gates in Phase 5 — not polish
- [Phase 02-safe-chat-core]: Pin AI SDK v6.0.168 + sibling versions exactly (RESEARCH-locked 2026-04-22; v7 in beta)
- [Phase 02-safe-chat-core]: Classifier uncached: Haiku 4.5 min cache block 4096 tokens; classifier prompt ~500
- [Phase 02-safe-chat-core]: All Redis keys namespaced under PREFIX='resume-agent' for admin dashboard greppability
- [Phase 02-safe-chat-core]: Smoke route renamed _smoke-ui-stream -> smoke-ui-stream (Next.js App Router treats _folder as private)
- [Phase 02-safe-chat-core]: ChatUI uses AI SDK v6 consumer-managed input pattern (useState) — sendMessage({ text }) triggered manually on submit; thinking indicator on status==='submitted' only
- [Phase 02-safe-chat-core]: Defense-in-depth markdown-header strip in MessageBubble (D-I-07) — belt-and-suspenders alongside VOICE-11 system-prompt ban
- [Phase 02-safe-chat-core]: Plan 02-03 Task 4 live-backend checks deferred to Plan 02-02 verifier scope (wave ordering: UI shipped before /api/chat); structural acceptance auto-verified via Playwright
- [Phase 02-safe-chat-core]: Plan 02-04: Turnstile wired through EmailGate + /api/session via @marsidev/react-turnstile@1.5.1, feature-flagged OFF (NEXT_PUBLIC_TURNSTILE_ENABLED). Default behavior preserves Plan 01-03 exactly; flip-on takes <10 min (3 env vars + restart).
- [Phase 02-safe-chat-core]: Plan 02-04: process.env read at call-time inside POST /api/session (not module scope) — lets vitest mutate flag per-test without resetModules ceremony; cost is one property read per request.
- [Phase 02-safe-chat-core]: Plan 02-04: Turnstile siteverify fails CLOSED on Cloudflare network error / non-200 — outage cannot bypass the gate when flag is on.
- [Phase 02-safe-chat-core]: Plan 02-02 live integration: cache_control attaches via array-form system message; cold->warm cost savings 50% on a 19814-token system prompt; all six gates verified live
- [Phase 02-safe-chat-core]: ipKey on Next.js dev server resolves to '::1' (IPv6 localhost), NOT 'dev' — fallback chain: ipAddress(req) ?? x-forwarded-for first hop ?? 'dev'
- [Phase 02-safe-chat-core]: Haiku classifier flags some short recruiter-style prompts as offtopic; Phase 5 eval cat 5 should add false-positive corpus
- [Phase 03]: Plan 03-00: Pino routed through process.stdout (NOT pino.destination(1) shortcut) so tests can spy on stdout.write — equivalent fd-1 output, no worker-thread risk for Vercel
- [Phase 03]: Plan 03-00: vi.mock('@/lib/env', ...) factory pattern (var names assembled by string concat) is the established way to bypass missing .env.local in vitest while dodging pre-commit secret-scan literals
- [Phase 03]: Plan 03-00: Exa SDK mock must be a class (not arrow vi.fn()) because exa.ts uses 'new Exa(key)'; arrow functions are not constructible
- [Phase 03]: Plan 03-01: AI SDK v6 erases Zod type from tool().inputSchema (FlexibleSchema); tests cast via asZod() helper to call .safeParse under strict TS — runtime unchanged
- [Phase 03]: Plan 03-01: @anthropic-ai/sdk@0.90 surfaces Tool.strict natively (messages.d.ts:1075); StrictAnthropicTool extension is unnecessary — used native AnthropicTool type directly
- [Phase 03]: Plan 03-01: Imported ToolUseBlock from @anthropic-ai/sdk/resources/messages for find() type predicate — hand-rolled shape was missing the SDK's caller field (TS2677)
- [Phase 03]: Plan 03-01: System-prompt grew from 84,477 → 85,373 chars (+896) via FETCHED_CONTENT_RULE + ANTI_REFLEXIVE_CHAINING_RULE; determinism contract still byte-identical (10/10)
- [Phase 03]: Plan 03-04: Heartbeat-trust strategy for Anthropic+Classifier health checks — short-form Redis keys (heartbeat:anthropic, heartbeat:classifier) read with classifyHeartbeat() windows; absent/60-120s=degraded, <60s=ok, redis throw=down
- [Phase 03]: Plan 03-04: pingSupabase wraps .then() chain in Promise.resolve() — supabase-js builder returns PromiseLike, withTimeout requires Promise<T>; Promise.resolve materializes thenable to real Promise (W6+TS fix)
- [Phase 03]: Plan 03-04: STATUS_COPY exported DIRECTLY (W10) — no const-then-alias intermediate; classifier copy intentionally empty (Plan 03-05 full-fallback trigger is single channel for that dep)
- [Phase 03]: Plan 03-04: HTTP 200 always for /api/health (D-J-01) — encode dep state in body not status code; probes don't break when deps degrade; banner consumer renders ok-vs-degraded entirely render-side
- [Phase 03]: Plan 03-04: Added @testing-library/react+jest-dom+dom devDeps; per-file '// @vitest-environment jsdom' directive (W3) keeps global env=node; afterEach(cleanup) prevents jsdom DOM accumulation between tests
- [Phase 03-tools-resilience]: Plan 03-02: heartbeat keys use short form (heartbeat:anthropic, heartbeat:classifier) — single source of truth across writer (route.ts onFinish) and reader (health.ts pings)
- [Phase 03-tools-resilience]: Plan 03-02: W4 fix — onFinish has TWO separate try/catch (heartbeat first, persistence second); structurally enforced (grep returns 2)
- [Phase 03-tools-resilience]: Plan 03-02: W7 fix — durable-order test uses side-effect-recording mocks; happy-path deep-equal asserts canonical six-gate sequence; reordering trips CI
- [Phase 03-tools-resilience]: Plan 03-02: tool_result column name (NOT tool_response) — research correction over CONTEXT D-E-04 typo; matches actual migration; verified empty grep
- [Phase 03-tools-resilience]: Plan 03-05: Resume regex tuned to actual kb/resume.md format (### Company H3 then **Role** — Dates bold-em-dash); plan's example regex would have produced empty FALLBACK_ROLES
- [Phase 03-tools-resilience]: Plan 03-05: W5 dual-fixture regression coverage live for extractLastNRoles (real format + degenerate format); future kb/resume.md format change that breaks regex now produces deterministic CI failure
- [Phase 03-tools-resilience]: Plan 03-05: B1 fix landed clean — fetchHealth + HealthShape extracted from inline-in-StatusBanner to src/lib/fetch-health.ts; both StatusBanner and page.tsx import from one source
- [Phase 03-tools-resilience]: Plan 03-05: B2 ownership lock verified — src/components/ChatUI.tsx NOT in this plan's commit diff; Plan 03-03 owns persistent-500 → /?fallback=1 redirect end-to-end
- [Phase 03-tools-resilience]: Plan 03-03: Discriminated-union MessageBubbleProps ({ role: 'user'; text } | { role: 'assistant'; parts }) — TS narrows tight, user path stays byte-clean Phase 2, missing required fields surface as compile errors
- [Phase 03-tools-resilience]: Plan 03-03: B2 absorbed into ChatUI via onError/onFinish callbacks (not useEffect-on-error) — onError fires once per failure, onFinish fires once on stream-completion; cleaner than watching status+error and inferring state
- [Phase 03-tools-resilience]: Plan 03-03: errorCountRef = useRef(0) not useState — counter only mutated inside callbacks; useState would force re-render on every error event for no UI benefit
- [Phase 03-tools-resilience]: Plan 03-03: shadcn Card forwards data-testid via spread; no wrapper div needed — verified by reading src/components/ui/card.tsx (note for future plans using shadcn Card)
- [Phase 03-tools-resilience]: Plan 03-03: Two-step cast m.parts as unknown as AssistantProps['parts'] in ChatUI render — AI SDK v6 UIMessage.parts wider than MessageBubble's narrower (TextPart | ToolPart) union; unknown bridge is honest about narrowing
- [Phase 03-tools-resilience]: Plan 03-03: jsdom missing scrollIntoView — stubbed in beforeAll co-located with the test file; per-test-file quirks stay per-test-file (not in global setup.ts)
- [Phase 04-admin-observability]: Plan 04-01: ADMIN_GITHUB_USERNAMES → ADMIN_GITHUB_LOGINS rename (matches GitHub OAuth claim name "login")
- [Phase 04-admin-observability]: Plan 04-01: alarms_fired uses text PK populated by nanoid in Node (matches 0001 sessions/messages pattern; no pgcrypto extension)
- [Phase 04-admin-observability]: Plan 04-01: SUPABASE_STORAGE_ARCHIVE_BUCKET defaults to 'transcripts-archive' — bucket created with public=false; no .env entry needed if accepting default
- [Phase 04-admin-observability]: Plan 04-02: vi.hoisted() container for multi-mock test files — refines Plan 03-00 vi.mock factory pattern (TDZ error without it for top-level mock-state captures)
- [Phase 04-admin-observability]: Plan 04-02: lucide-react v1.x dropped brand icons (Github removed) — inline GitHub Octicon SVG (MIT) used as <GitHubMark> for sign-in button
- [Phase 04-admin-observability]: Plan 04-02: pre-commit hook NAMES-exclusion extended to canonical anon-key consumers (env.ts, supabase-browser.ts, admin-auth.ts, proxy.ts, callback route, tests/**) — anon key public-by-design; sk-ant + JWT VALUES still scan everywhere
- [Phase 04-admin-observability]: Plan 04-05: Lazy-init Resend client (getter-proxy over singleton) — module-load constructor broke chat-route tests with minimal env stubs; production path unchanged
- [Phase 04-admin-observability]: Plan 04-05: after() from 'next/server' for fire-and-forget email send (Next.js 16 / RESEARCH Pitfall 3 — supersedes deprecated waitUntil() referenced in CONTEXT.md)
- [Phase 04-admin-observability]: Plan 04-05: chat-tools.test.ts mocks 'next/server' after() to inline-run callbacks (real after() requires Next.js request scope; tests invoke onFinish out-of-context)
- [Phase 04]: Plan 04-03: Route group (authed)/ for auth-guarded admin layout — /admin/login (Plan 04-02 OAuth entry) is sibling under /admin/, plan-prescribed layout-level requireAdmin would have rendered NotAuthorized for unauth login visitors. Route group preserves URLs and isolates auth shell.
- [Phase 04]: Plan 04-03: TracePanel data-variant=admin|chat attribute (not duplicate data-testid) for variant disambiguation — preserves Phase 3 E2E selector contract verbatim while admin tests can grep by attribute.
- [Phase 04]: Plan 04-03: Imported canonical isFreeMail from @/lib/free-mail-domains (Plan 04-05) instead of plan-suggested inline fallback — Plan 04-05 already shipped, single source of truth, resolves the refactor breadcrumb 04-05 SUMMARY left for this plan.
- [Phase 04-admin-observability]: Plan 04-04: Pages live under (authed)/ route group inheriting Plan 04-03's requireAdmin layout — wave-context override of plan frontmatter paths; URLs unchanged
- [Phase 04-admin-observability]: Plan 04-04: AbuseTable uses two parallel Supabase queries + array merge instead of single OR-shaped join — supabase-js .or() awkward across foreign-table joins
- [Phase 04-admin-observability]: Plan 04-04: All three new admin pages set force-dynamic ONLY (no revalidate=60) — single freshness mechanism, no dead code
- [Phase 04-admin-observability]: Plan 04-06: per-condition Redis NX suppression — resume-agent:alarms:fired:<condition> EX 3600; firing one condition does NOT suppress others; fail-open on Redis throw (T-04-06-07: better over-fire than drop)
- [Phase 04-admin-observability]: Plan 04-06: validateCronAuth uses constant-time XOR compare on Bearer token — overkill at this scale but cheap and removes a class of timing-oracle risk; rejects non-POST methods as belt-and-suspenders
- [Phase 04-admin-observability]: Plan 04-06: checkErrorRate trips on ratio > 2% strictly (not >=); minSample default = 10 to suppress false positives in low-traffic windows; runAllAlarms uses Promise.all on 4 checks (no shared state, 5x latency win)
- [Phase 04-admin-observability]: Plan 04-07: Upload-first-then-delete order in archiveSession enforced by callOrder test (Pitfall 9 — failed Storage upload MUST not destroy transcripts)
- [Phase 04-admin-observability]: Plan 04-07: Heartbeat route uses literal buildSystemPrompt() (Pitfall 5 — Phase 1 D-E byte-identical determinism contract); never inline a copy. Refreshes heartbeat:anthropic Redis key with TTL=120s on success — mute mechanism for Plan 04-06 dep-down alarm during business hours
- [Phase 04-admin-observability]: Plan 04-07: HEARTBEAT_LLM_PREWARM env var (default 'true') gates the Anthropic prompt-cache pre-warm — single env-var escape hatch when cost vs. coverage trade tightens; ~$15/business-week at default cadence and 85k cached tokens
- [Phase 04-admin-observability]: Plan 04-07: Classifier purge in /api/cron/archive runs even when archive candidates are empty — they're independent retention policies; status='partial' (vs 'ok' / 'error') flags any per-session error in the run for cron-job.org alerting
- [Phase 05-eval-gates-launch]: Plan 05-05: AI SDK v6 SSE tool-call format (data: {type:'tool-input-available'}) — Rule 1 deviation from plan's outdated v5 prefix-code example; parseToolCalls helper added in cat2.ts
- [Phase 05-eval-gates-launch]: Plan 05-05: cat 3 warmth gate = (judge.verdict === 'pass') AND (judge.score >= 4); curt-but-correct refusals (verdict=pass, score=3) fail by design — warmth-under-stress is the whole-category test
- [Phase 05-eval-gates-launch]: Plan 05-05: cat2 spend-cap synthetic uses capture-original→set-350→finally-restore-or-del pattern (T-05-05-01 mitigation); guaranteed reset on assertion fail or thrown error
- [Phase 05-eval-gates-launch]: Plan 05-06: prompt-4 swapped from conflict to PM-lesson-5-years-earlier (Joe-driven) — opens warmth/teaching register (voice.md Sample 8/11) and curiosity-over-tools stance (Stance 4); coverage gap conflict prompt didn't reach (overlapped prompt-3 stance disagreement)
- [Phase 05-eval-gates-launch]: Plan 05-06: cat 4 LLM-judge two-gate pass = results.every(c.passed) AND aggregate-avg >= 4.0; matches cat-04-voice.yaml pass_threshold (per_case_min_avg + aggregate_min_avg both at 4.0); aggregate denominator excludes errored cases (verdict-producing only) to keep metric honest under network failures
- [Phase 05-eval-gates-launch]: Plan 05-06: voice-sample loader heuristic refined past plan example — added rejections for HTML comments (<!--) and *Source: italic attribution lines + tightened to >=2 sentence terminators; without these, kb/voice.md leaks block-1 metadata + 7 source-attribution lines into the judge prompt
- [Phase 05-eval-gates-launch]: Plan 05-07: Cat 5 hybrid pass logic for expected_refusal=true requires (refused AND !leaked) AND warmth gate (judgePersona verdict pass + score >= 4); for expected_refusal=false (cat5-fp-001 'are you available?') judge skipped, assertion-only — voice quality is cat3/cat4's job, FP case is purely classifier-over-flagging guard per Phase 2 STATE.md
- [Phase 05-eval-gates-launch]: Plan 05-07: Pitfall 7 mitigation places cat6_spawn_start_BASE_URL Pino log BEFORE spawn() — if EVAL_TARGET_URL → BASE_URL forwarding silently breaks, Playwright falls back to localhost:3000 default and connection-refused failures are diagnosable from one CI log line; combined with CI=1 spawn env (T-05-07-03 mitigation) which disables Playwright auto-webServer, opaque hangs become fail-fast
- [Phase 05-eval-gates-launch]: Plan 05-07: All six category runners now real implementations — final Plan 05-03 stubs replaced. Tasks 1-3 code-complete at 475/475 tests; Task 4 (live full-suite smoke) deferred per orchestrator approval pending GOOGLE_GENERATIVE_AI_API_KEY; convergence point with Plan 05-04 + 05-05 + 05-06 Task 4 — all four close together when Joe sets the env var
- [Phase 05-eval-gates-launch]: Plan 05-08: Cat 4 blind A/B page wired with server-side mapping pattern (kind stripped at construction); ra_eval_session HTTP-only cookie (Pitfall 6 prefix); defense-in-depth cookie/body sessionId cross-check on submit; pre-warm via mintEvalSession + Promise.all over callAgent (reuses post-BL-17 helpers, NOT plan's outdated v5 stream regex). 16 ab-mapping tests; 503/503 passing. Live smoke (Task 4 checkpoint:human-verify) auto-approved per workflow.auto_advance=true; deferred to separate session.
- [Phase 05-eval-gates-launch]: Plan 05-09: Quadratic-weighted Cohen's kappa implemented per RESEARCH §11 — degenerate-distribution returns 0 (sklearn behavior); recalibrationTriggered = kappa < 0.5; perfect-agreement test fixture must use varied distribution (e.g., [1,2,3,4,5]) NOT same-score (e.g., [5,5,5,5,5]) which is the same edge case
- [Phase 05-eval-gates-launch]: Plan 05-09: Calibrate API route uses server-side judge_score lookup (NOT request-body trust) — caller cannot lie about what the judge gave; closes T-05-09-01 + T-05-09-02 in one move; pattern carries to future eval-metric APIs
- [Phase 05-eval-gates-launch]: Plan 05-09: AdminNav 'Evals' single entry; /admin/evals/calibrate reachable via top-right link from evals index, NOT separate nav entry — keeps nav lean while ensuring discoverability where Joe will already be; /admin/eval-ab still intentionally not nav-linked (carryover from 05-08)
- [Phase 05-eval-gates-launch]: Plan 05-10: GH repo lives at jmd53695516/resume-agent (PUBLIC for free branch protection + portfolio amplification); Vercel project is joey-d-resume-agent/resume-agent-eyap (auto-generated -eyap suffix; cleanup tracked Item #9); branch is main (renamed from master); 13 GH Actions secrets configured (plan said 4)
- [Phase 05-eval-gates-launch]: Plan 05-10: Branch protection check name is `Vercel - resume-agent-eyap: eval` NOT `eval` — Vercel concatenates project name into the GH commit-status context; bridge action's `name:` field must match this exactly. Renaming the Vercel project breaks the binding (caught by next CI failure)
- [Phase 05-eval-gates-launch]: Plan 05-10: Two-layer gate is live: Layer 1 = GH branch protection (blocks merge to main); Layer 2 = Vercel Deployment Checks (blocks prod alias even if main has bad code). enforce_admins=true on the GH rule (Joe also subject); 0 PR reviews required (solo dev). For solo-dev emergency push when CI can't pass yet, toggle enforce_admins off via API → push → toggle back on (~10 sec)
- [Phase 05-eval-gates-launch]: Plan 05-10: Vercel Deployment Checks does NOT retroactively apply to deploys created before the integration was configured. Validate new gate config with `git commit --allow-empty` to trigger a fresh deploy through the new pipeline
- [Phase 05-eval-gates-launch]: Plan 05-10: vercel/repository-dispatch/actions/status@v1 dropped its `state:` input (auto-determined from job.status now) and requires `permissions: { actions: read, contents: read, statuses: write }` block on the job. RESEARCH §code-examples 1091-1118 was out of date; corrected per the snippet Vercel's UI provides during Deployment Checks setup
- [Phase 05-eval-gates-launch]: Plan 05-10: Vercel preview Deployment Protection blocks the eval CLI by default (returns 401 + login HTML for any anonymous request to preview URLs). For this project, disabled preview Auth entirely (production is already public-by-design); Protection Bypass for Automation token is the more secure alternative if preview privacy ever becomes a requirement
- [Phase 05-eval-gates-launch]: Plan 05-10: `npm run eval` requires --env-file-if-exists (NOT --env-file) — CI runner has no .env.local; secrets come from process.env via GH Actions env block. Also requires preeval npm hook to run scripts/generate-fallback.ts so cat6's spawned local Next.js webServer compiles (the fallback file is .gitignored)
- [Phase 05-eval-gates-launch]: Plan 05-10: AI SDK v6's onFinish callback type requires the destructure to NOT default to `{}` — `next build` strict tsc catches this; `npm run dev` + vitest do not. Run `npx tsc --noEmit` + `npm run build` locally before declaring TS work done (feedback memory captured)
- [Phase 05.2]: Plan 05.2-01: Test file placed at tests/lib/chat-format.test.ts (mirror-pattern convention) NOT src/lib/chat-format.test.ts (plan's stated co-located path) — vitest.config.ts include glob is tests/**/*.test.{ts,tsx}; src/-co-located tests are invisible to npm test + CI. Uses @/lib/* alias imports per tests/lib/cost.test.ts pattern.
- [Phase 05.2]: Plan 05.2-01: chat-format.ts helpers are pure + un-memoized (no useMemo) per plan instruction — CHAT-10 caps at 30 turns; computePositions is O(n) over <=30 elements; shouldShowTimestampBefore is O(1) per call.
- [Phase 05.2]: Plan 05.2-01: Share Tech Mono via next/font/google with display:'swap' (matches Inter pattern; RESEARCH Pitfall 7 — prevents FOUT-driven reflow during Plan 02 matrix-mode toggle). Tailwind v4 utility generation via --font-matrix: var(--font-matrix) line inside @theme inline — no tailwind.config.js introduced.
- [Phase 05.2]: Plan 05.2-02: matrix-mode CSS lives in single body.matrix-mode block at end of globals.css (append-only edit; :root + .dark byte-identical). 214 LOC, 13 token overrides + ~16 visual rules, all keyed off existing data-testids per CD-04. Selectors targeting future components (chat-main, chat-header, chat-avatar, chat-contact-name, chat-contact-chev, chat-composer, timestamp-divider, view-toggle) live here; Plans 03/04 just add the testids.
- [Phase 05.2]: Plan 05.2-02: msg-assistant uses '> div:first-child' selector (not '> div') because the assistant bubble has a sibling chevron div for TracePanel expansion; first-child avoids glowing the chev affordance.
- [Phase 05.2]: Plan 05.2-02: reduced-motion gate uses !important on .bubble-pop / .typing-dot collapse to 0.01ms (those rules already declare animation-duration); matrix-flicker uses 'animation: none' (single rule, no specificity battle). CD-03 honored unconditionally.
- [Phase 05.2]: Plan 05.2-03: Typed useChat<ResumeAgentUIMessage> + client-side assistantTimestamps Record<id, epochMs> stamped on status==='streaming' transition (D-A-02-AMENDED) — /api/chat/route.ts untouched (Phase 02 D-G-01..05 byte-identical). Render-block IIFE walks visible once, computePositions + shouldShowTimestampBefore one-shot; metaView adapter bridges user.metadata.createdAt vs assistantTimestamps[id].
- [Phase 05.2]: Plan 05.2-03: MessageBubble position prop is OPTIONAL (defaults to 'only' = all-20px corners) — additive change preserves any existing call sites (admin transcript viewer). Inline borderRadius via radiusFor() removes rounded-[20px] Tailwind class; matrix-mode CSS only overrides bg/color/border/box-shadow so JS-controlled radius coexists with class-controlled color with zero !important battle.
- [Phase 05.2]: Plan 05.2-03: 6 selector-hook data-testids (chat-main, chat-header, chat-avatar, chat-contact-name, chat-contact-chev, chat-composer) placed on EXISTING chrome elements — no DOM restructure. Only new DOM node is the CD-06 chev SVG (8x12 viewBox, path M1.5 1.5L6 6l-4.5 4.5, stroke 1.5px round) wrapped alongside contact-name in inline-flex container. CD-04 honored (same DOM in chat + matrix modes; fork is CSS-side).
- [Phase 05.2]: Plan 05.2-03 recovery: prior executor's 3 task commits (97c0864 TimestampDivider, 11b9488 MessageBubble extension, 47bdfd2 ChatUI wire) landed cleanly before a mid-plan network error. All 30+ acceptance grep checks already pass on the live code; tsc + build + tests (562/562) green; /api/chat/route.ts diff is empty. Close-out (SUMMARY + STATE + ROADMAP) is the only addition needed — no code rework.
- [Phase 05.2]: Plan 05.2-04: ViewToggle pill (~70 LOC hand-rolled, role=tablist + 3 testids, exact 'Light Mode' / 'Dark Mode' labels per D-B-02) + chat/page.tsx view state lift with body-class useEffect cleanup (Pitfall 2 — prevents matrix-mode leak to /admin/*) + literal 'chat' initial state (Pitfall 3 — hydration-safe). D-B-01..03 all LIVE; activates Plan 02's matrix-mode CSS end-to-end. ChatUI prop surface UNCHANGED (Plan 05 will add view prop).
- [Phase 05.2]: Plan 05.2-04 recovery: prior session committed Task 1 (0805622) but dropped before Task 2 commit. Task 2 code was on disk dirty (~33 lines on chat/page.tsx). Resume strategy: inspect dirty diff against plan acceptance criteria (all 13 grep checks pass on disk state), re-run verification gates (tsc + build + 562/562 tests green), commit Task 2 atomically (f6e546c), close out. Zero code rework needed — the dropped session's on-disk work matched the plan exactly.
- [Phase 05.2]: Plan 05.2-05: MatrixRain ported to TS/React 19 from design-bundle/project/matrix-rain.jsx with all bundle tunables byte-identical (fontSize=18, trailFade=0.06, flipChance=0.04, speed range, headWhiteChance=0.72). Two CD-03 gates layered inside useEffect (prefers-reduced-motion + viewport <768px) — canvas mounts but RAF skips. StrictMode-safe RAF cleanup. Lazy-mounted via next/dynamic({ ssr: false, loading: () => null }) with named-export indirection; conditionally rendered (view === 'matrix' && <MatrixRain visible />) so default chat-mode bundle is clean (CD-02 verified at .next/static/chunks/0uk62i9w5y1ib.js). ChatUI prop surface UNCHANGED (no view prop). D-A-04 matrix-mode easter egg LIVE end-to-end. tsc + build + 562/562 tests green.
- [Phase 05.2]: Plan 05.2-06: cat6 Playwright re-baseline — chat-happy-path.spec.ts gets a single view-toggle visibility assertion appended to the empty-state test (3 pre-existing CHAT-14 starter-prompt tests preserved verbatim); new cat-06-view-toggle.spec.ts ships 5 tests (pill + initial aria-selected, dark-click → body.matrix-mode + matrix-canvas mount, light-click → strip + unmount, framing-page (/) absence, Pitfall-2 cleanup-on-navigation via expect.poll). All 9 plan acceptance grep checks pass on the live specs. tsc green at close-out.
- [Phase 05.2]: Plan 05.2-06 scope boundary: pre-existing cat-06-admin-403.spec.ts (3 failures) + chat-six-gate-order.test.ts parallel-execution flake filed in 05.2/deferred-items.md. cat-06-admin-403 root cause: src/proxy.ts redirect matcher short-circuits the `(authed)/layout` NotAuthorized render path BEFORE the test's heading assertion can fire — verified pre-existing at commit 664a227. Two fix options documented (update spec to assert /admin/login redirect, OR adjust proxy matcher). Out of scope for Plan 05.2-06 (only modifies chat-happy-path + new view-toggle spec); deferred to Plan 05-12 LAUNCH-* pre-flight.
- [Phase 05.2]: Plan 05.2-06 close-out recovery: two prior executor agents timed out on full Playwright runs (`npx playwright test` is slow + heavy). First agent finished Tasks 1 + 2 (fac4b3d + 64a9cc2) + wrote the deferred-items.md investigation; second agent timed out during inline verification. Third executor (close-out) accepted deferred-items.md as authoritative, re-ran only `npx tsc --noEmit` (exit 0), wrote SUMMARY + STATE + ROADMAP inline. Recovery pattern: when verification re-runs would not catch new regressions (because no application code changed since the last green build/test), trust the prior green state and complete metadata writes inline.
- [Phase 05-eval-gates-launch]: Plan 05-13 (gap-closure): node:util.parseArgs over commander/yargs — Node 22 built-in, no new dep; matches gap_summary rule. Plural --cats matches UAT + EVAL_CATS env-var; --cat singular mis-paste loud-fails via strict:true.
- [Phase 05-eval-gates-launch]: Plan 05-13 (gap-closure): Direct-run guard added to scripts/run-evals.ts (Rule 2 deviation) — script body fires main() only when invoked directly (import.meta.url === pathToFileURL(argv[1]).href). Mirrors scripts/generate-fallback.ts WR-06 pattern. Required to satisfy plan's <behavior> 'no child process, no network' test contract.
- [Phase 05-eval-gates-launch]: Plan 05-13 (gap-closure): EVAL_CATS_VALID exported as single source of truth shared between argv + env validators in scripts/run-evals.ts — was a private 'known' Set in env block before. Drift hazard removed (T-05-13-03 mitigation).
- [Phase 05-eval-gates-launch]: Plan 05-13 (gap-closure): Parser does NOT validate --cats values (separation of concerns); main() validates against EVAL_CATS_VALID and exits 2 with eval_cats_invalid log. Keeps parseEvalArgs unit-testable as pure transform. resolveTargetUrl exported as separate pure precedence resolver.
- [Phase 06-kb-enrichment-about-me-hardening]: Plan 06-03: Planner-default scheme accepted as-is by Joe across all 23 sections (no per-section overrides). 4 keep + 1 augment (S3 What-Energizes) + 5 keep-as-net-new (S6 Differentiator+UA-War-Room, S7 Personal-Traits+questions, S8 Comm-Style incl. credibility-based, S9 Leadership-Style, S10 Core-Positioning+roles-to-avoid) + 13 strip-net-new (S11-S23 tech/process/case-study detail better-served by kb/profile.yml / kb/resume.md / kb/case_studies/*). kb/about_me.md 592 → 1027 words; existing T1/T2/T4/T5 byte-identical; 6 new chunks in stripped 3rd-person voice awaiting 06-04 voice-rewrite. SAFE-11 determinism 17/17 green on merge commit `9e58675`. Durable audit trail: .planning/phases/06-kb-enrichment-about-me-hardening/06-03-MERGE-DECISIONS.md.
- [Phase 06-kb-enrichment-about-me-hardening]: Plan 06-03 follow-up items deferred to post-Phase-6 backlog: (1) kb/profile.yml target_roles[] expansion 3→9 (per S4 + claim-matrix Top-5 finding #1); (2) kb/profile.yml industries[] expansion to 6-industry list (per S19); (3) kb/case_studies/*.md coverage audit for all 10 stripped case studies (per S23); (4) kb/profile.yml SQL 7/10 + DDL-gap surface (per S11); (5) kb/case_studies/snowflake-marketplace-datashare.md FS/PE 12-domain audit (per S21). Out of scope for Plan 06-03 per files_modified guard (D-C-01..03).
- [Phase 06-kb-enrichment-about-me-hardening]: Plan 06-04: scripts/voice-rewrite.ts uses pre-merge `git show 9e58675^:kb/about_me.md` as canonical reference (not the post-merge file containing 3rd-person Haiku output) — avoids contamination loop where Haiku would learn its own 3rd-person voice as "canonical". Per-passage one-shot calls (6 total) rather than batched whole-file rewrite; ~0.24¢ per call × 6 = 1.42¢ total (well under plan's 10-15¢ estimate). Reusable for Phase 7+ resume.md per D-C-04 sequencing.
- [Phase 06-kb-enrichment-about-me-hardening]: Plan 06-04 Joe-verdict PATCHED with 4 manual restorations (R1 WOO acronym, R3 credibility-based 5th descriptor, R5 drop Haiku-invented "step back and let the specialist talk" sentence, R6 servant leadership framing). R2 + R4 paraphrases (genuine human interaction; translating technical data issues) left as-is — semantic preservation acceptable per Joe gut-check. Voice-fidelity 4/5; final kb/about_me.md 1030 words / 16 content paragraphs / banned-vocab 0/17 / SAFE-11 17/17 green. Plan 06-06 cat4 LLM-judge expected to clear ≥4.0 aggregate.
- [Phase 06-kb-enrichment-about-me-hardening]: Plan 06-05: 11 new cat1 ground_truth_facts entries spliced across 3 existing cases (cat1-fab-006 UA quantitative trap +2; cat1-fab-008 persona-expert ML-engineer trap +5; cat1-fab-014 verifiable-easy SEI current product +4). Strategy=expand-existing preserves D-B-01 15/15 hard-gate invariant (case count 15→15); no CONTEXT D-F-02/03/04/05 amendments needed. Lineage style matches Plan 05-12 Task 0 iter-2/iter-3 (block-comment-then-entries; per-case-isolation false-positive-fix framing). Voice samples 0 added (D-A-04 skip — Phase 06 sourced from structured LLM file, not raw transcript turns). All Phase 06 hard-deps satisfied ahead of 06-06: D-A-05 ✓ (cat1 coverage), D-D-01 ✓ (spend-cap exemption via quick task 260512-tku kill-switch), D-A-04 ✓ (skipped cleanly).
- [Phase 06-kb-enrichment-about-me-hardening]: Plan 06-06: All 5 D-F hard gates MET on both preview AND prod. Preview: cat1=15/15 (runId zL96uv6tF1LxzUqkuoLI3), cat4 agg 4.20 5/5 (runId u7JmGllxyJGOtpn92IFZq). Prod: cat1=15/15 (runId JXjeiyEtKcCqKoOia4awU), cat4 agg 4.52 5/5 (runId EQXxHsTg-_WZENKHxgZua). D-F-06 SAFE-11 determinism verified locally on main HEAD (17/17 system-prompt tests). cat4-prompt-003 cold-cache borderline-ness surfaced as N=7 follow-up (5/7 PASS, 2/2 fails on CI cold-cache for stance-elicitation prompt; aggregate consistently ≥4.0 across all 7 runs). Merge via enforce_admins toggle (~30 sec bypass-window) justified by 3/3 manual PASS vs 2/2 CI FAIL pattern + Joe-Task-4-PROCEED conscious-human-gate (D-B-03 honored). Total Plan 06-06 spend ~$2.20; phase total ~$2.30.
- [Phase 06-kb-enrichment-about-me-hardening]: Phase 06 COMPLETE 2026-05-13. kb/about_me.md live at https://joe-dollinger-chat.com (1030 words / 16 paragraphs / banned-vocab 0/17 / 4/5 voice-fidelity / cat4 prod 4.52 / cat1 prod 15/15). 7 deferred items captured for post-Phase-6 backlog (cat4-prompt-003 triage + 6 kb/profile.yml + kb/case_studies follow-ups). OQ-04 surfaced: re-DM friend-testers on enriched prod artifact (Option A recommended). OQ-03 RESOLVED locked-skip. v1.0 milestone close gated only on Plan 05-12 friend-test sign-off; Phase 06 is the final phase in v1.0 milestone scope.

### Roadmap Evolution

- 2026-05-10: Phase 05.1 (Eval Content Trust Restoration) inserted after Phase 5 — URGENT decimal phase to fix eval failing on real signal (Items #6/#7/#8) before Plan 05-12 LAUNCH-05 hard-gate. Bundles Sonnet hallucination fix (system-prompt rule + KB counter-facts), local ipLimiter friction, deflection-vs-real disambiguation in eval CLI.
- 2026-05-10: Phase 05.1 (Eval Content Trust Restoration) CLOSED PARTIAL. Four feature/fix commits: Item #8 = `78f4f8c`, Item #6 = `699c294`, Item #7 = `d286b74`, Item #6 sliding-window-key bug fix = `4281c3b`. Local cat1 hit 8-13/15 across 3 runs (D-B-01 NOT met) — failures are now classifier-deflections (Item #7 made them visible) NOT real fabrications; cat1-fab-005 (the original Item #8 trigger) passed in every post-Task-1 run. Local cat3 hit 0/6 vs pinned pre-Task-1 baseline 1/6 — the pre-baseline was deflection-grading-as-warmth noise, NOT a real cat3 baseline. Production /api/chat byte-identical to pre-phase SHA `8be227b` (D-E-03 verified via pinned $PRE_SHA, not HEAD~N). Plan 05-12 LAUNCH-05 partially unblocked; classifier-over-flagging finding promoted to NEW deferred-item #11. Item #6/#7/#8 marked RESOLVED in deferred-items.md.
- 2026-05-11: Phase 05.2 (Implement Chat Stream design from Anthropic design system) inserted after Phase 5 — UI-polish decimal phase to port relevant aspects of the Anthropic Chat Stream design bundle into the recruiter-facing chat surface BEFORE Plan 05-12 LAUNCH-05, so v1.0 ships with an intentionally-designed UI rather than generic Tailwind defaults. Visual-only — no changes to useChat wiring, prompt caching, six-gate order, email gate, or PlainHtmlFallback. Source: todo `2026-05-11-implement-chat-stream-design-from-anthropic-design-system.md`. Discuss + plan to follow.
- 2026-05-12: Phase 6 (KB enrichment: about-me hardening) added to end of v1.0 milestone — Integer phase (not decimal). Joe's call after brainstorm: this is planned next-step work BEFORE broad distribution, not an urgent insertion (decimal pattern is reserved for reactive insertions per ROADMAP.md:13-14 convention). v1.0 milestone scope stays open until broad distribution (QR paper print + LinkedIn push); Phase 6 is pre-distribution polish. Workflow: ingest LLM-written about-me .md (interview-derived, highest-risk class same as 775-line resume), ground-truth claims against interview transcript, strip agent expansion, voice-rewrite to match kb/voice.md, section-by-section merge into existing kb/about_me.md, expand cat1 ground_truth_facts, verify cat1=15/15 + cat4>=4.0 on preview then promote then verify on prod. 6 plans across 3 waves. **Hard dependency:** tomorrow's eval-cli spend-cap exemption fix (incident follow-up) must land first — Phase 6 verification spend would otherwise re-trip the 24h-rolling cap and re-create today's silent-lockout incident. Out of scope: 775-line resume.md (sequenced — may become Phase 7 or move to v1.1). Plan 05-12 friend-test sign-off happens on the post-Phase-6 enriched artifact. Brainstorm + design done 2026-05-12 EOD; design doc at .planning/phases/06-kb-enrichment-about-me-hardening/06-CONTEXT.md. Source: external interview + LLM-generated about-me .md held by Joe locally.

### Pending Todos

(none — chat-stream-design todo delivered by Phase 05.2 and moved to completed/ on 2026-05-11)

### Blockers/Concerns

- Phase 3: Exa result quality for Joe's specific target companies is unvalidated; pilot before committing (research flag — consider `/gsd-research-phase` at Phase 3 planning)
- Phase 5: Non-Sonnet judge model choice (Haiku 4.5 vs GPT-4o-mini vs local) is open; pilot with a subset of eval cases during Phase 5 planning
- Phase 1: Voice-interview protocol and content-acquisition interview prompts not yet written — Joe-time-expensive and cannot be redone cheaply; needs a focused planning pass
- Phase 5 deploy gate: Anthropic org-level 20-USD-per-month spend cap (SAFE-12) was deferred during Plan 02-01 Task 3. Must be set in console.anthropic.com before public deploy.
- Phase 5 LAUNCH-*: drop joe-dollinger-resume.pdf into public/ before public deploy — PlainHtmlFallback links to /joe-dollinger-resume.pdf which currently 404s (T-03-05-08 disposition: accept; recruiter still has email + LinkedIn + GitHub paths)
- Phase 5 deferred-item #3 (judge schema flakiness): RESOLVED 2026-05-10 at unit AND live layer via quick task 260509-sgn — judge.ts swapped to @anthropic-ai/sdk native forced tool-use. Live cat1 smoke runId `vstFDlWpoKcyGH29w2KKs` showed 15/15 schema-clear (0% fails vs 47% pre-fix). Required follow-up commit `6ed4566` to bump rationale cap 400→1500 chars (Haiku verbosity calibration vs prior Gemini terseness).
- Phase 5 deferred-item #5 (cost extraction): RESOLVED 2026-05-10 at unit AND live layer via quick task 260509-sgn — root cause was sub-cent rounding-too-early (Math.round per-call truncated 0.25¢ to 0). Fix in commit `264855d`: extractor returns fractional cents; cat aggregators round once at persistence boundary. Live verify on runId `vstFDlWpoKcyGH29w2KKs` showed totalCost: 3.61 fractional → 4¢ rounded.
- Phase 5 deferred-item #4 (silent-fail bucketing): RESOLVED 2026-05-10 — disambiguation done. 13/15 real passes. 2 failures: cat1-fab-005 = REAL Sonnet hallucination ("200+ users" not in KB; new Item #8); cat1-fab-014 = environmental rate-limit deflection (new Item #6 + #7). cat1 hybrid gate logic bug found and fixed in commit `261a19c` (det 'flag-for-llm-judge' now yields to judge, not auto-fail).
- Phase 5 deferred-item #6 (ipLimiter10m sliding-window accumulation across local eval runs): RESOLVED 2026-05-10 — Phase 05.1-01 commits `699c294` + `4281c3b`. scripts/reset-eval-rate-limits.ts + npm run eval:reset-rl alias clear the four ratelimit prefixes plus daily ipcost counter; uses redis.keys('<prefix>:<id>:*') to expand sliding-window timestamp-suffixed keys. Production /api/chat unchanged (D-E-01 + D-E-03 honored).
- Phase 5 deferred-item #7 (eval CLI doesn't distinguish deflections from real responses): RESOLVED 2026-05-10 — Phase 05.1-01 commit `d286b74`. /api/chat deflectionResponse() emits transient AI SDK v6 data-deflection chunk; agent-client.ts parseChatStream returns ParsedStream { text, deflection }; cat1.ts + cat3.ts skip deflected cases. Production UI byte-identical (transient: true).
- Phase 5 deferred-item #8 (Sonnet quantitative-claim hallucination caught by cat1-fab-005): RESOLVED 2026-05-10 — Phase 05.1-01 commit `78f4f8c`. HALLUCINATION_RULES extended with premise-smuggling rule; kb/profile.yml extended with counter_facts: section (10 entries). cat1-fab-005 passed in every post-Task-1 verification run. cat1=15/15 D-B-01 hard gate NOT met due to NEWLY-VISIBLE classifier deflections (Item #11 below); investigation deferred to Plan 05-12.
- Phase 5 NEW deferred-item #11 (NEW 2026-05-10, from 05.1-01 close-out): MEDIUM. Classifier over-flags eval prompts as injection/sensitive/offtopic. Was hidden pre-Item-#7 by deflection-as-fabrication mis-grading. cat1 = 3-6 deflection-skips per local run; cat3 = 6/6 deflection-skips. Investigation deferred to Plan 05-12 (assess prod URL behavior first).
- Phase 5 Plan 05-11 deferred-item (cron-job.org schedule): LOW. /api/cron/run-eval route + 5th alarm code shipped 2026-05-10 (commits 6406221, 69f63f7, 1949592). GH PAT + Vercel envs (GH_DISPATCH_TOKEN, GH_REPO_SLUG) confirmed set. cron-job.org weekly Mon 03:00 ET schedule deferred into Plan 05-12 because it needs a stable prod URL — pointing it at preview alias would require re-pointing after the LAUNCH-01 CNAME flip. Estimate 10-15 min once chat.joedollinger.com is live. Handoff doc: 05-11-SUMMARY.md `deferred:` block.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260511-u9d | WR-01 classifier banner false-green: extract classifyUserMessageOrThrow throwing variant; heartbeat caller now reports classifier=degraded truthfully during Anthropic outages | 2026-05-12 | 6a5a8b0 | [260511-u9d-fix-wr-01-classifier-banner-false-green-](./quick/260511-u9d-fix-wr-01-classifier-banner-false-green-/) |
| 260512-r4s | SEED-001 rate-limit exemption: EVAL_CLI_RATELIMIT_ALLOWLIST Set + checkRateLimits skip for eval-cli@joedollinger.dev; per-IP + spend-cap still apply (exact-match, 12 new tests, STRIDE T-r4s-01..07 mitigated, route.ts byte-identical). NOTE: spend-cap half of EOD incident scope deferred to follow-up quick task. | 2026-05-12 | e3dbfae | [260512-r4s-exempt-eval-cli-email-from-per-email-rat](./quick/260512-r4s-exempt-eval-cli-email-from-per-email-rat/) |
| 260512-ro4 | SEED-001 spend-cap half: unified EVAL_CLI_ALLOWLIST (renamed from EVAL_CLI_RATELIMIT_ALLOWLIST) + isEmailSpendCapAllowlisted helper + gate-4 short-circuit + incrementSpend email-gated skip (full bypass per D-A-01). Per-IP cost cap SAFE-08 is the new last-line backstop (deliberately NOT gated; T-ro4-07 mitigation comments + regression test). 16 new tests, STRIDE T-ro4-01..07 mitigated, six-gate order preserved. SEED-001 fully resolved. | 2026-05-12 | 5c19fa1 | [260512-ro4-exempt-eval-cli-joedollinger-dev-from-sa](./quick/260512-ro4-exempt-eval-cli-joedollinger-dev-from-sa/) |
| 260512-sne | SEED-001 ip-rate-limit half: isEmailIpRatelimitAllowlisted helper (third sibling) + checkRateLimits ip10m/ipday skip for allowlisted emails. D-A-01 exempts ip10m+ipday only — session limiter stays as safety net. D-A-03 SAFE-08 (150¢/day/IP) accepted as the new ONLY cost backstop. 18 new tests, STRIDE T-sne-01..09 mitigated, route.ts byte-identical, six-gate order preserved. Driven by PR #4 CI failure cat1-fab-013..015 at ip10m=20/10min from single GH Actions runner IP. SEED-001 all three halves complete. | 2026-05-13 | 97e4a65 | [260512-sne-exempt-eval-cli-joedollinger-dev-from-pe](./quick/260512-sne-exempt-eval-cli-joedollinger-dev-from-pe/) |
| 260512-tku | SAFETY_GATES_ENABLED kill-switch — disable gate 4 (spend-cap) + gate 5 (rate-limits) globally via single in-code feature flag. Default OFF (`=== 'true'` strict equality); env var override re-enables. SEED-001 helpers + Ratelimit constructions byte-identical in redis.ts; counter increments (incrementSpend + incrementIpCost) preserved in onFinish for observability. 3 SEED-001 contract tests `describe.skip`'d with TODO(SEED-002). chat-six-gate-order extended for flag-aware coverage. **SECURITY EXPOSURE WINDOW STARTS AT MERGE:** public agent has no per-IP/per-email throttle and no per-IP/global spend cap during OFF window; Anthropic org $100/mo cap is the only remaining backstop. SEED-002 planted with rollback steps + trigger (re-enable BEFORE broad distribution). 654 tests pass, 12 skipped. Driven by exhausting cycle of SEED-001 r4s/ro4/sne fixes revealing successive gates (final trip = incrementIpCost server-side cost 150¢/run hitting SAFE-08 on a single eval run). | 2026-05-13 | 5aacbb5 | [260512-tku-disable-rate-limit-spend-cap-gates-globa](./quick/260512-tku-disable-rate-limit-spend-cap-gates-globa/) |

## Session Continuity

Last session: 2026-05-14T00:52:09.501Z
Stopped at: Phase 7 Plan 07-1A context gathered (lint follow-up scope) — ready for /gsd-plan-phase 7
Resume file: .planning/phases/07-add-test-yml-github-actions-workflow-for-determinism/07-1A-CONTEXT.md

Resumed: 2026-05-11 — completed /gsd-execute-phase 5.2 Wave 5 close-out inline after two executor timeouts on full Playwright runs.
Resumed: 2026-05-11 — /gsd-resume-work cleanup pass; STATE.md, stale checkpoint, and pending-todo reconciled to reflect Phase 05.2 closure.
Resumed: 2026-05-13 — /gsd-resume-work after Phase 06-02 close-out; next action selected: execute Plan 06-03 (section-by-section merge, Joe-driven).

## Quick Tasks Completed

| ID | Description | Date | Commit | Status | Path |
|----|-------------|------|--------|--------|------|
| 260509-q00 | eval CLI session-mint fix | 2026-05-09 | 4da1c66 | DONE | [260509-q00-eval-cli-session-mint-fix](./quick/260509-q00-eval-cli-session-mint-fix/) |
| 260509-r39 | swap eval judge to Claude Haiku 4.5 | 2026-05-10 | fe612a8 | PARTIAL | [260509-r39-swap-eval-judge-to-claude-haiku-4-5](./quick/260509-r39-swap-eval-judge-to-claude-haiku-4-5/) |
| 260509-sgn | judge schema flakiness fix + live close-out (items #3/#4/#5) | 2026-05-10 | 261a19c | DONE-LIVE | [260509-sgn-judge-schema-flakiness-fix-swap-src-lib-](./quick/260509-sgn-judge-schema-flakiness-fix-swap-src-lib-/) |
