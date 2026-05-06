---
phase: 03-tools-resilience
verified: 2026-05-06T02:42:00Z
status: human_needed
score: 6/6 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Live Exa call observable in DevTools when triggering research_company"
    expected: "DevTools Network tab shows /api/chat POST streaming a tool_call/tool_result for research_company; no mock; result includes <90d source URLs"
    why_human: "Requires real EXA_API_KEY in .env.local + a live npm run dev session + DevTools observation; cannot be programmatically verified from static code"
  - test: "Pitch tool produces 3-paragraph tailored output with live clickable source URLs"
    expected: "Sonnet weaves Exa results into 3 paragraphs (observation / connection / first-problem-I'd-dig-into) with clickable URL footer rendered in MessageBubble"
    why_human: "Output prose shape is model-dependent and visual; needs human eval (Phase 5 Cat 6 candidate)"
  - test: "Walkthrough narration is ~400 words, first-person, ends with 'Want to go deeper, or hear a different story?'"
    expected: "Sonnet narrates from get_case_study record producing first-person ~400-word narration with the closing line"
    why_human: "Word count + closing-line adherence are prose-shape concerns; the system prompt instructs the behavior but only live invocation confirms"
  - test: "MetricCard renders inline above TracePanel with Sonnet commentary stream"
    expected: "When recruiter triggers design_metric_framework, MetricCard appears with six labeled sections, Sonnet's commentary streams above, TracePanel collapsed below"
    why_human: "Visual rendering + live streaming order verified against MessageBubble dispatcher; unit tests assert DOM order, but real-stream integration is human-eval"
  - test: "Trace panel collapse/expand UX with chevron"
    expected: "Default collapsed; click chevron expands; args + response JSON visible in monospace; subtle low-contrast styling per D-E-05"
    why_human: "jsdom <details> open/closed state has known quirks; visual assertion of design tokens is human"
  - test: "Yellow status banner copy renders on real degraded state"
    expected: "When Anthropic/classifier heartbeat absent (>120s) the framing banner renders 'Chat may be slow right now — Anthropic is having a moment.'; banner disappears on all-green"
    why_human: "Requires full-stack integration with live Redis state; StatusBanner SC was intentionally not unit-tested (depends on Next request context)"
  - test: "Plain-HTML fallback renders on /?fallback=1 with mailto CTA + 3 roles + LinkedIn/GitHub"
    expected: "Visit /?fallback=1 → PlainHtmlFallback rendered, no email gate, no banner, no Card; mailto:joe.dollinger@gmail.com clickable"
    why_human: "Full-page rendering pass + test that recruiter actually has a working email path"
  - test: "ChatUI redirect to /?fallback=1 after 2 consecutive /api/chat 500s"
    expected: "Force two consecutive 500s → router.push fires → URL becomes /?fallback=1 → page.tsx renders PlainHtmlFallback"
    why_human: "Unit tests assert callback invocation + push target; full-stack 500-induction is best done via Phase 5 Playwright"
  - test: "Resume PDF link /joe-dollinger-resume.pdf"
    expected: "Phase 5 LAUNCH-* will drop the PDF in public/; currently 404 (acknowledged in 03-05-SUMMARY)"
    why_human: "Joe to drop PDF before public deploy; currently flagged as expected 404, graceful failure mode"
---

# Phase 03: Tools & Resilience — Verification Report

**Phase Goal:** The three agentic tools work for real (DevTools shows live network calls), render as distinct UI (trace panel + metric card), degrade gracefully when any dependency fails, and a recruiter never leaves empty-handed even if `/api/chat` is 500ing.

**Verified:** 2026-05-06T02:42:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria + PLAN must-haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Pitch tool: streamed 3-paragraph tailored pitch with recent (<90d) company signals + live clickable source URLs; real Exa call observable | ✓ VERIFIED (code) / ? UNCERTAIN (live behavior) | `src/lib/exa.ts` ships real `researchCompany()` with `startPublishedDate: ninetyDaysAgo`, `numResults: 5`, `maxCharacters: 4000`. `src/lib/tools/research-company.ts` wraps Exa results in `<fetched-content>` for prompt-injection defense. Wired into `streamText({ tools: { research_company } })` at route.ts:281-285. Live call requires real EXA_API_KEY — needs human DevTools confirmation. |
| 2 | Walkthrough tool: case study selection from menu → ~400-word first-person narration ending with "Want to go deeper, or hear a different story?"; unknown slugs return menu | ✓ VERIFIED (code) / ? UNCERTAIN (prose) | `src/lib/tools/get-case-study.ts` returns MenuPayload (kind='menu') for missing/unknown slug AND CaseStudyPayload for valid slug. Tool schema makes slug optional. Tool returns DATA; Sonnet does narration via system prompt. Word count + closing line are model-dependent — flagged for human eval. |
| 3 | Metric design tool: formatted card (not markdown blob) with all 6 sections + Sonnet commentary above | ✓ VERIFIED | `src/lib/tools/design-metric-framework.ts` calls Haiku 4.5 with `tool_choice: { type: 'tool', name: 'output_metric_framework' }` + `strict: true`; zod-validates output. `src/components/MetricCard.tsx` renders six labeled sections (North Star, Input Metrics, Counter-Metrics, Guardrails, Proposed Experiment, Open Questions) with `isMetricFramework` defensive type guard. `src/components/MessageBubble.tsx:80-101` enforces text → MetricCard → TracePanel render order (D-D-04). Unit tests assert DOM order via `compareDocumentPosition`. |
| 4 | Trace panel: collapsible "See what I did" under each assistant reply; depth cap 3/turn with stopWhen: stepCountIs(5); duplicate-arg stop-sequence | ✓ VERIFIED | `src/components/TracePanel.tsx` renders `<details>` with `useState(false)` collapsed default, "See what I did — {label}" summary, three TOOL_LABELS for the three tools. `src/lib/tools/depth-cap.ts` enforces ≤3 calls (TOOL-07) + duplicate-arg stop (SAFE-15) via `activeTools: []` (cache-friendly). Wired as `prepareStep: enforceToolCallDepthCap` in route.ts:289. `stopWhen: stepCountIs(5)` preserved at route.ts:290. WR-03 fix added shape-regression guard (`depth_cap_shape_warning` log). |
| 5 | Resilience visibility: per-impaired-dep yellow banner; /api/chat 500 → same URL serves plain-HTML fallback with direct-email CTA | ✓ VERIFIED | `src/components/StatusBanner.tsx` exports STATUS_COPY (W10 direct export) with 5 per-dep messages; `src/app/chat/layout.tsx` mounts banner on /chat; `src/app/page.tsx` mounts banner on /. PlainHtmlFallback at `src/components/PlainHtmlFallback.tsx` with `mailto:joe.dollinger@gmail.com` CTA (testid `fallback-email-cta`). Branched render in page.tsx:36-39 on `?fallback=1` OR `health.classifier === 'down'`. ChatUI redirect to /?fallback=1 on 2nd consecutive 500 at ChatUI.tsx:38-49. error.tsx belt-and-suspenders. |
| 6 | Honest fallbacks: tool errors → in-character fallback; fetched Exa content never interpreted as instructions; tool execute fns read-only | ✓ VERIFIED | `TOOL_FAILURE_COPY` in failure-copy.ts has 3 in-character ≤30-word strings (verified word counts: 26/28/27). All 3 tools return `{ error: TOOL_FAILURE_COPY[name] }` structured payload, never throw. `src/lib/tools/sanitize.ts` `wrapFetchedContent` wraps Exa results in `<fetched-content>` tags. `FETCHED_CONTENT_RULE` in system-prompt.ts:35-38 instructs Sonnet to treat tagged content as data, not instructions. `git grep "supabaseAdmin\|redis\.set" src/lib/tools/` returns empty (TOOL-08 read-only lock holds). Persistence happens only in onFinish via `persistToolCallTurn`. |

**Score:** 6/6 must-haves verified (with human-test items for live UX/visual behaviors)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/api/chat/route.ts` | Tools + prepareStep + onFinish heartbeat (W4) + persistToolCallTurn | ✓ VERIFIED | 423 lines. Imports research_company, get_case_study, design_metric_framework, enforceToolCallDepthCap from @/lib/tools (lines 49-54). `tools: { ... }` at 281-285. `prepareStep: enforceToolCallDepthCap` at 289. `stopWhen: stepCountIs(5)` at 290. Two separate try/catch in onFinish (heartbeat at 305-320, persistence at 322-353) — W4 fix verified. |
| `src/lib/tools/research-company.ts` | Exa client + fetched-content wrap + failure copy | ✓ VERIFIED | 71 lines. Calls `researchCompany(name, website)`, applies `wrapFetchedContent`, logs PII-safe `args_hash`, returns `{ error: TOOL_FAILURE_COPY.research_company }` on failure. |
| `src/lib/tools/get-case-study.ts` | Menu-when-unknown + structured record | ✓ VERIFIED | 117 lines. `buildMenu()` lists slugs; missing/unknown slug returns menu (D-C-02). Valid slug returns `{kind: 'case_study', slug, frontmatter, content}`. |
| `src/lib/tools/design-metric-framework.ts` | Haiku forced-tool + zod validate | ✓ VERIFIED | 133 lines. `tool_choice: { type: 'tool', name: 'output_metric_framework' }` + `strict: true`. `MetricFrameworkOutput.parse(toolUseBlock.input)` defense-in-depth zod validate. |
| `src/lib/tools/depth-cap.ts` | TOOL-07 + SAFE-15 prepareStep callback | ✓ VERIFIED | 68 lines. Returns `activeTools: []` (cache-friendly, NOT toolChoice-none) at 51, 64. WR-03 fix: structural type alias replaces `any`; shape-regression guard logs `depth_cap_shape_warning`. |
| `src/lib/tools/sanitize.ts` | wrapFetchedContent helper | ✓ VERIFIED | 20 lines. Wraps each result.text in `<fetched-content>` tags. |
| `src/lib/tools/failure-copy.ts` | TOOL_FAILURE_COPY 3 strings | ✓ VERIFIED | 17 lines. All 3 strings ≤30 words (26/28/27). |
| `src/lib/tools/index.ts` | Barrel export | ✓ VERIFIED | 11 lines. Exports research_company, get_case_study, design_metric_framework, enforceToolCallDepthCap, TOOL_FAILURE_COPY. |
| `src/lib/persistence.ts` | persistToolCallTurn helper | ✓ VERIFIED | 177 lines. flatMap of steps[].toolCalls into messages rows; column is `tool_result` (NOT tool_response). WR-02 fix: `log()` (Pino) replaces console.error in error path. |
| `src/lib/exa.ts` | Exa client + 90-day filter | ✓ VERIFIED | 70 lines. `startPublishedDate: ninetyDaysAgo`, `numResults: 5`, `maxCharacters: 4000`, lazy singleton, `__resetExaForTests`. |
| `src/lib/health.ts` | 5 ping helpers + heartbeat-trust | ✓ VERIFIED | 113 lines. Anthropic/classifier read `heartbeat:anthropic`/`heartbeat:classifier` Redis keys. Supabase explicit `.then()` chain (W6). Upstash `redis.ping()`. Exa HEAD api.exa.ai. All wrapped in `withTimeout(p, 1500)`. |
| `src/app/api/health/route.ts` | GET handler 200 always | ✓ VERIFIED | 28 lines. `runtime='nodejs'`, `revalidate=30`, `Promise.all([5 pings])`, `NextResponse.json`. |
| `src/lib/fetch-health.ts` | Shared SC helper | ✓ VERIFIED | 52 lines. WR-01 fix: replaced HTTP self-fetch with direct in-process pings wrapped in `unstable_cache(['health-status'], { revalidate: 30 })`. |
| `src/components/StatusBanner.tsx` | SC with STATUS_COPY (W10) | ✓ VERIFIED | 73 lines. STATUS_COPY exported directly with typed annotation (no aliasing). 5 per-dep copy strings. classifier.degraded='' deliberately empty (Plan 03-05 fallback trigger). Framing variant sticky non-dismissible; chat variant delegates to ChatStatusBanner. |
| `src/components/ChatStatusBanner.tsx` | CC dismissible w/ sessionStorage | ✓ VERIFIED | 65 lines. WR-04 fix: sessionStorage getItem/setItem wrapped in try/catch (Safari Private Mode safety). Hydration-gated to avoid SSR mismatch. DISMISS_KEY const. |
| `src/app/chat/layout.tsx` | SC layout w/ banner | ✓ VERIFIED | 14 lines. Mounts `<StatusBanner page="chat" />` above {children}. |
| `src/components/TracePanel.tsx` | Collapsible "See what I did" | ✓ VERIFIED | 84 lines. `useState(false)` collapsed default. 3 TOOL_LABELS. State-machine-correct rendering (input-streaming label-only; input-available adds args; output-available adds output; output-error destructive tint). |
| `src/components/MetricCard.tsx` | shadcn Card w/ 6 sections | ✓ VERIFIED | 73 lines. All 6 section labels exact: 'North Star', 'Input Metrics', 'Counter-Metrics', 'Guardrails', 'Proposed Experiment', 'Open Questions'. `isMetricFramework` type guard rejects {error}, missing-field, null. |
| `src/components/MessageBubble.tsx` | parts walker w/ render order | ✓ VERIFIED | 105 lines. Discriminated-union props. Assistant: text → MetricCard (for design_metric_framework output-available) → TracePanel. D-I-07 stripMarkdownHeaders preserved on text only. data-testid `msg-user` + `msg-assistant` preserved. |
| `src/components/ChatUI.tsx` | parts forwarding + B2 redirect | ✓ VERIFIED | 211 lines. `useRouter()` + `useRef(0)` errorCountRef. onError increments + redirects on >=2; onFinish resets. Uses `router.push('/?fallback=1')`. |
| `src/components/PlainHtmlFallback.tsx` | Static minimal fallback | ✓ VERIFIED | 90 lines. Imports only build-time constants from @/generated/fallback. Zero dynamic deps verified by grep. mailto + 3 roles + LinkedIn + GitHub + resume PDF. testids: plain-html-fallback, fallback-email-cta, fallback-linkedin, fallback-github, fallback-resume. |
| `scripts/generate-fallback.ts` | Build-time KB extractor | ✓ VERIFIED | 167 lines. W5: `extractFirstParagraph` + `extractLastNRoles` exported as pure fns. WR-05 fix: company-name split tightened to em-dash/en-dash only. WR-06 fix: `import.meta.url`-vs-`pathToFileURL(argv[1])` self-detection. main() guarded by GENERATE_FALLBACK_RUN env flag OR direct invocation. |
| `src/generated/fallback.ts` | Auto-generated constants (gitignored) | ✓ VERIFIED | 26 lines (auto-generated). 5 expected exports populated; 3 FALLBACK_ROLES match actual kb/resume.md last 3 entries (Nimbl Digital / Retailcloud / Gap, Inc.). FALLBACK_EMAIL=joe.dollinger@gmail.com correct. |
| `src/app/error.tsx` | CC error boundary | ✓ VERIFIED | 28 lines. `'use client'` directive. Renders `<PlainHtmlFallback />`. Logs Error to console.error in useEffect (T-03-05-06: never to user DOM). |
| `src/app/page.tsx` | Async + branched render | ✓ VERIFIED | 53 lines. `async function Home`, awaits searchParams + fetchHealth. Branches to PlainHtmlFallback on `fallbackParam || health?.classifier === 'down'`. |
| `src/lib/system-prompt.ts` | FETCHED_CONTENT_RULE + ANTI_REFLEXIVE_CHAINING_RULE | ✓ VERIFIED | Both rules at lines 35-43, integrated into buildSystemPrompt at lines 60-61. Determinism preserved (Plan 01-02 contract still 10/10). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| route.ts | tools/index.ts | `import { research_company, ... }` | ✓ WIRED | route.ts:49-54 imports all 4 named exports. tools live inside `streamText({ tools: { ... } })` config. |
| route.ts | persistence.ts | `persistToolCallTurn({ session_id, steps })` | ✓ WIRED | route.ts:337-340 in onFinish persistence try block, after persistNormalTurn. |
| route.ts | redis (heartbeat) | `redis.set('heartbeat:anthropic', Date.now(), { ex: 120 })` | ✓ WIRED | route.ts:307-308. Heartbeat keys match exactly between route.ts (writer) and health.ts (reader) — confirmed via cross-grep. |
| persistence.ts | supabase messages | `supabaseAdmin.from('messages').insert(rows)` w/ tool_result | ✓ WIRED | persistence.ts:164. Column name `tool_result:` at line 150; `tool_response` does NOT appear anywhere in src/. |
| ChatUI.tsx | router.push | `router.push('/?fallback=1')` on 2nd error | ✓ WIRED | ChatUI.tsx:43. Counter resets in onFinish at line 47. |
| MessageBubble.tsx | TracePanel | `<TracePanel part={p} />` | ✓ WIRED | MessageBubble.tsx:99-101. One per tool part, stacked. |
| MessageBubble.tsx | MetricCard | `<MetricCard data={p.output} />` | ✓ WIRED | MessageBubble.tsx:96-98. Filtered to design_metric_framework output-available. |
| ChatUI.tsx | MessageBubble (parts) | `parts={m.parts as ...}` for assistant | ✓ WIRED | ChatUI.tsx:127-133 with two-step cast for AI SDK union narrowing. |
| StatusBanner.tsx | fetchHealth | `import { fetchHealth } from '@/lib/fetch-health'` | ✓ WIRED | StatusBanner.tsx:15. WR-01 fix: fetchHealth now uses unstable_cache + direct ping calls (no HTTP self-fetch). |
| page.tsx | fetchHealth + PlainHtmlFallback | `await fetchHealth()` + branched render | ✓ WIRED | page.tsx:22, 36-39. Skip-the-fetch optimization on `?fallback=1` path. |
| chat/layout.tsx | StatusBanner | `<StatusBanner page="chat" />` | ✓ WIRED | chat/layout.tsx:10. SC mount above CC chat page. |
| PlainHtmlFallback.tsx | @/generated/fallback | `import { FALLBACK_BIO, ... }` | ✓ WIRED | PlainHtmlFallback.tsx:7-13. Zero dynamic deps; only build-time constants. |
| scripts/generate-fallback.ts | kb/* | `readFileSync(...)` at build time | ✓ WIRED | scripts/generate-fallback.ts:108, 115, 121. main() runs on `npm run prebuild` via package.json. |
| health.ts | redis (heartbeat read) | `redis.get('heartbeat:anthropic')` etc. | ✓ WIRED | health.ts:47, 59. Short-form keys match writer in route.ts. |
| research-company.ts | sanitize.ts | `wrapFetchedContent(raw)` | ✓ WIRED | research-company.ts:44. Defense-in-depth alongside FETCHED_CONTENT_RULE in system prompt. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| TracePanel | `part.input` / `part.output` | AI SDK v6 message.parts stream from useChat | Yes — populated by streamText tool calls in /api/chat | ✓ FLOWING |
| MetricCard | `data` (= part.output for design_metric_framework) | Tool execute returns parsed MetricFramework from Haiku | Yes — Haiku call in design-metric-framework.ts:88-97 produces real data | ✓ FLOWING |
| StatusBanner | `health` (HealthShape) | fetchHealth → unstable_cache → 5 ping helpers (real Redis/Supabase/fetch) | Yes — direct in-process ping calls | ✓ FLOWING |
| PlainHtmlFallback | FALLBACK_BIO, FALLBACK_ROLES, etc. | Build-time generated constants from kb/* | Yes — verified populated in src/generated/fallback.ts | ✓ FLOWING |
| MessageBubble | `props.parts` | ChatUI passes m.parts from useChat hook | Yes — useChat manages stream | ✓ FLOWING |
| persistToolCallTurn (DB rows) | `event.steps` from streamText onFinish | AI SDK v6 multi-step shape | Yes — flat-mapped into Supabase rows on every successful turn | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes | `npm test` | 220/220 passed across 27 files in 4.17s | ✓ PASS |
| Heartbeat keys match between writer + reader | `git grep "heartbeat:anthropic" src/app/api/chat/route.ts src/lib/health.ts` | Matches in both files | ✓ PASS |
| TOOL-08 lock holds (no DB writes in tools) | `git grep -E "supabaseAdmin\|redis\.set" src/lib/tools/` | Empty (no matches) | ✓ PASS |
| Schema column correction | `git grep "tool_response" src/` | Empty | ✓ PASS |
| toolChoice-none avoidance (cache-friendly) | `git grep "toolChoice: 'none'" src/` | Empty | ✓ PASS |
| stopWhen preserved | `git grep "stopWhen: stepCountIs(5)" src/app/api/chat/route.ts` | 1 match at line 290 | ✓ PASS |
| W4: two separate try/catch in onFinish | onFinish body lines 305-353 | Heartbeat try at 305-320, persistence try at 322-353 (two distinct try blocks) | ✓ PASS |
| W10: STATUS_COPY direct export | `git grep "export const STATUS_COPY" src/components/StatusBanner.tsx` | 1 match; no `const COPY = {` aliasing | ✓ PASS |
| FETCHED_CONTENT_RULE in system prompt | system-prompt.ts | Lines 35-38 + integrated at line 60 | ✓ PASS |
| ANTI_REFLEXIVE_CHAINING_RULE in system prompt | system-prompt.ts | Lines 40-43 + integrated at line 61 | ✓ PASS |
| 90-day Exa freshness filter | exa.ts:44 | `startPublishedDate: ninetyDaysAgo` | ✓ PASS |
| FALLBACK_ROLES populated correctly | src/generated/fallback.ts:9-25 | 3 roles populated, all match kb/resume.md | ✓ PASS |
| W5 dual-fixture coverage | tests/scripts/generate-fallback.test.ts | 9 tests pass (was 7, +2 WR-05 regression-guard tests) | ✓ PASS |

### Requirements Coverage (17 IDs from PLAN frontmatter)

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CHAT-13 | 03-03 | Trace panel "See what I did" under each assistant reply with tool calls | ✓ SATISFIED | TracePanel.tsx renders one collapsible block per tool part; MessageBubble.tsx walks parts and stacks them. |
| TOOL-01 | 03-01 | research_company tool: Exa search 90-day + structured JSON | ✓ SATISFIED | research-company.ts + exa.ts with startPublishedDate filter; structured ExaSearchResponse shape. |
| TOOL-02 | 03-01 | research_company returns 3-paragraph pitch w/ live source URLs | ? NEEDS HUMAN | Tool returns DATA; Sonnet generates 3-paragraph prose per system prompt. Live verification required. |
| TOOL-03 | 03-01 | get_case_study returns structured record; menu when unknown | ✓ SATISFIED | get-case-study.ts buildMenu() for missing/unknown slug; CaseStudyPayload for valid slug. |
| TOOL-04 | 03-01 | Walkthrough narration ~400 words, first-person, ends with closing line | ? NEEDS HUMAN | Tool returns DATA; Sonnet narrates per system prompt. Word count + closing line model-dependent. |
| TOOL-05 | 03-01 | design_metric_framework: Haiku w/ rigid schema returns structured JSON | ✓ SATISFIED | design-metric-framework.ts uses Haiku 4.5 + tool_choice forced + zod-validate output. |
| TOOL-06 | 03-02, 03-03 | Metric framework rendered as formatted card w/ labeled sections | ✓ SATISFIED | MetricCard.tsx with all 6 labels exact. MessageBubble enforces text→card→trace render order. |
| TOOL-07 | 03-02 | Tool-call depth ≤3/turn; stopWhen: stepCountIs(5) | ✓ SATISFIED | depth-cap.ts caps at 3 (returns activeTools:[]); route.ts:290 stopWhen preserved. |
| TOOL-08 | 03-02 | Tool execute fns read-only; writes only in onFinish | ✓ SATISFIED | grep `supabaseAdmin\|redis.set` in src/lib/tools/ returns empty. persistToolCallTurn called only in onFinish. |
| TOOL-09 | 03-01 | Fetched Exa content treated as data, never instructions | ✓ SATISFIED | sanitize.ts wraps in `<fetched-content>` tags; FETCHED_CONTENT_RULE in system prompt instructs Sonnet. |
| TOOL-10 | 03-02, 03-03 | DevTools shows real network activity when tool fires | ? NEEDS HUMAN | Code wires real Exa + Haiku calls; live DevTools verification required (real EXA_API_KEY needed). |
| TOOL-11 | 03-01 | Graceful in-character fallback on tool error | ✓ SATISFIED | TOOL_FAILURE_COPY 3 strings ≤30 words each. All tools return `{ error: ... }` structured payload, never throw. |
| OBSV-07 | 03-04 | Tool health: ping endpoint status (Anthropic/Exa/Supabase/Upstash) | ✓ SATISFIED | health.ts 5 ping helpers + /api/health route returns aggregated status. |
| OBSV-10 | 03-04 | /api/health returns per-dependency status | ✓ SATISFIED | health/route.ts returns JSON with all 5 deps; HTTP 200 always. |
| OBSV-11 | 03-04 | Yellow status banner if any dep degraded | ✓ SATISFIED | StatusBanner.tsx renders bg-amber-100 strip with per-dep copy when any dep != 'ok'. |
| OBSV-12 | 03-05 | Plain-HTML fallback at same URL when /api/chat returns 500 | ✓ SATISFIED | ChatUI redirects to /?fallback=1 on 2nd 500; page.tsx renders PlainHtmlFallback; error.tsx belt-and-suspenders. |
| OBSV-16 | 03-00 | Pino structured JSON logging (no pino-pretty in prod) | ✓ SATISFIED | logger.ts uses pino@10.3.1 to process.stdout; no transports configured. WR-02 fix migrated console.error usage to log() in route.ts and persistence.ts. |

**Score:** 13/17 SATISFIED, 4/17 NEEDS HUMAN (TOOL-02, TOOL-04, TOOL-10 = live behavioral; all are model-dependent prose or DevTools observation that cannot be automatically verified)

No ORPHANED requirements detected — all 17 IDs from ROADMAP requirements list are claimed in the 6 plans' frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/components/MetricCard.tsx | 41-43 | `<li key={i}>` array index as key | ℹ️ Info | Static array, never reorders — IN-05 from REVIEW. Functionally fine. |
| src/lib/health.ts | 103-112 | `pingExa` HEAD request to api root may not reflect real API health | ℹ️ Info | IN-03 from REVIEW. Acceptable for Phase 3; tracked for Phase 4. |
| src/components/PlainHtmlFallback.tsx | 79 | `/joe-dollinger-resume.pdf` link 404s (file not in public/) | ℹ️ Info | Acknowledged as Phase 5 LAUNCH-* responsibility. Recruiter still has email + LinkedIn + GitHub. |
| src/app/api/chat/route.ts | 388-391 | onError persists deflection with `reason: 'offtopic'` for stream errors | ℹ️ Info | IN-01 from REVIEW. Admin grep ambiguous; deferred. |
| src/app/api/chat/route.ts | 62 | `messages: z.array(z.any())` — coarse zod validation | ℹ️ Info | IN-02 from REVIEW. Documented as deliberate; AI SDK validates downstream. |
| src/lib/logger.ts | (config) | No programmatic guard against future `transport: { target: 'pino-pretty' }` | ℹ️ Info | IN-06 from REVIEW. Comment-only enforcement. |
| Tests | various | Env-stub key obfuscation pattern non-obvious (string concat to dodge pre-commit hook) | ℹ️ Info | IN-09 from REVIEW. Could extract to shared helper. |

No 🛑 Blocker or ⚠️ Warning anti-patterns found. The 9 Info items from 03-REVIEW.md are documented as deferred (per `fix_scope: critical_warning`); the 6 Warning items WR-01 through WR-06 were all fixed in 03-REVIEW-FIX.md (commits 222e86a, 773c8a6, 7aa4eb7, 71a0610, 158543a, 3472be8).

### Human Verification Required

The following items require live runtime testing — code is correct but behavior depends on real API keys, real model output, or real visual rendering:

#### 1. Live Exa call observable in DevTools

**Test:** With real EXA_API_KEY in `.env.local`, run `npm run dev`, open DevTools Network, click "Pitch me on my company" starter prompt with a company name.
**Expected:** /api/chat POST streaming response containing tool_call/tool_result for research_company; published_date <90d on each source URL.
**Why human:** Requires real API key + live network observation; cannot be programmatically verified from code.

#### 2. Pitch tool produces 3-paragraph tailored output with live source URLs

**Test:** After (1), inspect Sonnet's streamed output.
**Expected:** Three paragraphs (observation / connection to Joe / first-problem-I'd-dig-into) followed by clickable source URL footer.
**Why human:** Output prose shape is model-dependent; needs human eval (Phase 5 Cat 6 candidate).

#### 3. Walkthrough tool ~400 words, first-person, closing line

**Test:** Click "Walk me through a project" starter, pick a case study from the menu.
**Expected:** ~400-word first-person narration ending with "Want to go deeper, or hear a different story?"
**Why human:** Word count + closing line are prose-shape concerns; system prompt instructs the behavior but only live invocation confirms.

#### 4. MetricCard renders inline with Sonnet commentary streaming above

**Test:** Click "Design a metric" starter, describe a feature.
**Expected:** MetricCard appears with six labeled sections; Sonnet commentary streams above; TracePanel collapsed below the card.
**Why human:** Visual rendering + live streaming order; unit tests cover DOM order via compareDocumentPosition but real-stream integration is human-eval.

#### 5. Trace panel collapse/expand UX

**Test:** After any tool call, click the chevron on the "See what I did" details block.
**Expected:** Default collapsed; click expands to show args + response JSON in monospace; subtle low-contrast grey label per D-E-05.
**Why human:** Visual design tokens are human; jsdom <details> has known quirks.

#### 6. Yellow banner copy on real degraded state

**Test:** Force a degraded state (e.g., flush Redis heartbeat keys, wait >120s) and reload `/`.
**Expected:** Yellow banner with "Chat may be slow right now — Anthropic is having a moment." (or equivalent per-dep copy). On all-green, banner absent.
**Why human:** Full-stack integration with live Redis state; StatusBanner SC intentionally not unit-tested (depends on Next request context).

#### 7. Plain-HTML fallback on /?fallback=1

**Test:** Visit `http://localhost:3000/?fallback=1` (after `npm run dev`).
**Expected:** PlainHtmlFallback rendered (data-testid `plain-html-fallback`). No email gate, no banner, no Card. Email Joe CTA prominently visible. 3 roles + LinkedIn + GitHub + resume PDF link.
**Why human:** Full-page rendering pass + visual confirmation.

#### 8. ChatUI redirect to /?fallback=1 after 2 consecutive 500s

**Test:** With dev tools, force /api/chat to return 500 twice in a row.
**Expected:** Browser navigates to /?fallback=1 → page.tsx serves PlainHtmlFallback.
**Why human:** Unit tests assert callback invocation + push target; full-stack 500-induction is best done via Phase 5 Playwright.

#### 9. Resume PDF placement

**Test:** Visit /joe-dollinger-resume.pdf.
**Expected (Phase 5):** PDF served. Currently 404.
**Why human:** Joe to drop the actual PDF file in public/ before public deploy. Acknowledged Phase 5 LAUNCH-* responsibility.

### Gaps Summary

**No blocking gaps detected.** All 6 must-have truths verified at the code level. All 17 requirement IDs are accounted for in plan frontmatter and have implementation evidence; 4 are NEEDS HUMAN (TOOL-02, TOOL-04, TOOL-10 prose/DevTools verification) and 13 are SATISFIED with code evidence. The 6 REVIEW Warnings (WR-01 through WR-06) were all fixed cleanly. The 9 REVIEW Info items are deferred per `fix_scope: critical_warning`.

The 9 human-verification items are intentionally deferred to live testing because they depend on:
- Real API keys (Exa, Anthropic) for live tool invocation observation
- Model-dependent prose shape (Sonnet output for pitch / walkthrough)
- Visual DOM rendering quality + design token fidelity
- Full-stack integration scenarios best covered by Phase 5 Playwright (forced-degraded health, persistent-500 induction)
- Resume PDF placement (Phase 5 LAUNCH-* deliverable)

The phase goal is achieved at the code level. Phase 5 LAUNCH-* should:
1. Add Playwright E2E for the three tool surfaces, the banner-degraded scenario, and the persistent-500 redirect.
2. Drop the resume PDF in public/.
3. Run an Eval Cat 6 UX smoke pass with Joe (manual) over the three tool buttons + DevTools.

---

_Verified: 2026-05-06T02:42:00Z_
_Verifier: Claude (gsd-verifier)_
