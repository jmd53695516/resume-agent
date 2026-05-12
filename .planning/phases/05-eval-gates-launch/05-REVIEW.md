---
phase: 05-eval-gates-launch
reviewed: 2026-05-11T00:00:00Z
depth: standard
files_reviewed: 77
files_reviewed_list:
  - .eval-tmp/sample-stream.txt
  - .github/workflows/eval.yml
  - .gitignore
  - evals/cat-01-fabrication.yaml
  - evals/cat-02-tools.yaml
  - evals/cat-03-persona.yaml
  - evals/cat-04-prompts.yaml
  - evals/cat-04-real-joe.yaml
  - evals/cat-04-voice.yaml
  - evals/cat-05-abuse.yaml
  - kb/profile.yml
  - package.json
  - scripts/reset-eval-spend-cap.ts
  - scripts/run-evals.ts
  - src/app/admin/(authed)/eval-ab/AbClient.tsx
  - src/app/admin/(authed)/eval-ab/page.tsx
  - src/app/admin/(authed)/evals/[runId]/page.tsx
  - src/app/admin/(authed)/evals/calibrate/CalibrateClient.tsx
  - src/app/admin/(authed)/evals/calibrate/page.tsx
  - src/app/admin/(authed)/evals/page.tsx
  - src/app/admin/components/AdminNav.tsx
  - src/app/admin/login/page.tsx
  - src/app/api/admin/eval-ab/route.ts
  - src/app/api/admin/evals/calibrate/route.ts
  - src/app/api/chat/route.ts
  - src/app/api/cron/heartbeat/route.ts
  - src/app/api/cron/run-eval/route.ts
  - src/components/ChatUI.tsx
  - src/components/MessageBubble.tsx
  - src/lib/alarms.ts
  - src/lib/classifier.ts
  - src/lib/env.ts
  - src/lib/eval-models.ts
  - src/lib/eval/ab-mapping.ts
  - src/lib/eval/agent-client.ts
  - src/lib/eval/calibration.ts
  - src/lib/eval/cats/cat1.ts
  - src/lib/eval/cats/cat2.ts
  - src/lib/eval/cats/cat3.ts
  - src/lib/eval/cats/cat4-judge.ts
  - src/lib/eval/cats/cat5.ts
  - src/lib/eval/cats/cat6.ts
  - src/lib/eval/cost.ts
  - src/lib/eval/fabrication.ts
  - src/lib/eval/judge.ts
  - src/lib/eval/storage.ts
  - src/lib/eval/types.ts
  - src/lib/eval/yaml-loader.ts
  - src/lib/health.ts
  - src/lib/tools/design-metric-framework.ts
  - src/lib/tools/research-company.ts
  - supabase/migrations/0003_phase5.sql
  - tests/api/chat-bl17-session-error.test.ts
  - tests/cron/heartbeat.test.ts
  - tests/cron/run-eval.test.ts
  - tests/e2e/cat-06-admin-403.spec.ts
  - tests/e2e/cat-06-email-gate.spec.ts
  - tests/e2e/cat-06-fallback.spec.ts
  - tests/e2e/cat-06-tool-buttons.spec.ts
  - tests/e2e/cat-06-trace-toggle.spec.ts
  - tests/lib/eval-models.test.ts
  - tests/lib/eval/ab-mapping.test.ts
  - tests/lib/eval/agent-client.test.ts
  - tests/lib/eval/calibration.test.ts
  - tests/lib/eval/cats/cat1.test.ts
  - tests/lib/eval/cats/cat2.test.ts
  - tests/lib/eval/cats/cat3.test.ts
  - tests/lib/eval/cats/cat4-judge.test.ts
  - tests/lib/eval/cats/cat5.test.ts
  - tests/lib/eval/cats/cat6.test.ts
  - tests/lib/eval/cost.test.ts
  - tests/lib/eval/fabrication.test.ts
  - tests/lib/eval/judge.test.ts
  - tests/lib/eval/storage.test.ts
  - tests/lib/eval/yaml-loader.test.ts
  - tests/lib/health.test.ts
  - tests/lib/tools/research-company.test.ts
findings:
  critical: 2
  warning: 6
  info: 7
  total: 15
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-05-11
**Depth:** standard
**Files Reviewed:** 77
**Status:** issues_found

## Summary

Phase 05 ("eval-gates-launch") is large and load-bearing: it shipped the CI eval gate (GH Actions), the two-layer prod gate via `repository_dispatch`, six category runners (cat1-cat6) plus blind A/B + calibration admin UIs, the heartbeat cron rewrite (live classifier call + unconditional `heartbeat:exa` write), and the launch checklist that made `joe-dollinger-chat.com` go LIVE on prod.

Overall the code is unusually well-commented — every load-bearing decision is annotated with research/plan/threat-register references, and the test mocks exhaustively cover the unit boundaries. Both Critical findings are integrity gaps in the eval/observability layer itself — specifically, eval correctness contracts that look right in unit tests but fail to exercise the production code path they claim to test. Given the project's "zero-fabrication rule" + "hard daily spend cap" + "public during active job search" posture, an eval gate that silently doesn't exercise the production safety net is itself a launch risk.

The Warnings cluster around observability gaps (heartbeat-trust pattern means real dep outages don't surface in alarms), eval-side effects on shared infrastructure (synthetic email written to prod sessions table, classifier verdict shape inconsistency between live code and tests), and stale-read patterns in the heartbeat cron that the comments acknowledge but don't fully fix.

## Critical Issues

### CR-01: Cat 2 synthetic spend-cap test sets a key the production gate never reads

**File:** `src/lib/eval/cats/cat2.ts:174-175,199,229,231`
**Issue:** `runCat2` builds the spend-cap key as `resume-agent:spend:${today}` where `today = new Date().toISOString().slice(0, 10)` = `"YYYY-MM-DD"`. But the production spend gate (`src/lib/redis.ts:77-88`) uses hourly buckets: `hourBucketKey` slices to `YYYY-MM-DDTHH`, and `getSpendToday()` mgets the 24 hourly keys (`isOverCap` thresholds against the sum). The cat2 synthetic test sets `resume-agent:spend:2026-05-11` (no hour suffix) — a key that `getSpendToday()` does NOT read. The production gate therefore does NOT trip, /api/chat does NOT return the spendcap deflection, and the case fails its real-path contract.

The unit test (`tests/lib/eval/cats/cat2.test.ts:312-326`) masks the bug: it mocks `fetch` to return the deflection text directly, so the assertion passes without ever calling /api/chat. EVAL-10 (the contract this case enforces — "spend cap gate trips under load before Anthropic gets called") is therefore not actually verified by the test suite when run against a live target.

Compounded by `assertSpendCapDeflection`'s permissive regex (`taking a breather|back tomorrow|email Joe directly|come back|few hours|spend cap|capacity|rate limit`) — under real-target runs, an unrelated rate-limit deflection (cat2 fires many sequential calls per session) could match this regex and produce a green case that proves nothing.

For a public-facing agent during an active job search with a hard $3/day spend cap as a load-bearing constraint, an eval that claims to prove the cap works but doesn't is precisely the kind of false-positive that makes the gate worse than no gate.

**Fix:**
```ts
// src/lib/eval/cats/cat2.ts — replace the YYYY-MM-DD key with hourly buckets
// that match getSpendToday()'s read pattern in src/lib/redis.ts:82-88.
const nowMs = Date.now();
const spendKeys = Array.from({ length: 24 }, (_, i) => {
  const iso = new Date(nowMs - i * 3_600_000).toISOString().slice(0, 13);
  return `resume-agent:spend:${iso}`;
});
// Capture originals so finally{} can restore exactly.
const originalSpends = await redis.mget<(string | number | null)[]>(...spendKeys);

// Set the current-hour bucket past the 300¢ threshold. One bucket > 300 is
// enough because getSpendToday sums all 24 — the test still exercises the
// gate while keeping side-effects narrow.
await redis.set(spendKeys[0], 350);

// ... callAgentWithTools ...

// In finally:
for (let i = 0; i < spendKeys.length; i++) {
  const orig = originalSpends[i];
  if (orig != null) await redis.set(spendKeys[i], orig);
  else await redis.del(spendKeys[i]);
}
```

Add an integration-style assertion in the unit test that the SET key matches the hourly-bucket format `getSpendToday` actually reads, and tighten `assertSpendCapDeflection` to require the spendcap-specific substring `"taking a breather"` (text from `src/app/api/chat/route.ts:80`) — rate-limit deflections don't contain that phrase.

### CR-02: Eval CLI writes synthetic sessions to PROD sessions table on every run; chat path triggers Joe's session-notification email

**File:** `src/lib/eval/agent-client.ts:203-238` (combined with `src/app/api/chat/route.ts:394-402`)
**Issue:** `mintEvalSession` POSTs to `/api/session` with `email: 'eval-cli@joedollinger.dev'` to satisfy BL-17's session-existence check. Each cat runner (`cat1.ts:70`, `cat2.ts:169`, `cat3.ts:32`, `cat4-judge.ts:72`, `cat5.ts:71`) calls this once per category against `targetUrl`. When the cron-dispatched eval runs against PROD (`https://joe-dollinger-chat.com` per `src/app/api/cron/run-eval/route.ts:48`), every category mints a row in the production `sessions` table.

Then in `src/app/api/chat/route.ts:394-402`, the chat path's `onFinish` calls `claimAndSendSessionEmail` via Next.js `after()` — which is an atomic-claim-first-turn email send to Joe. The claim is per-session, so each eval-minted session triggers exactly one email to `JOE_NOTIFICATION_EMAIL` on its first normal-classified turn.

A weekly drift run hits 5 categories × ~9 cases avg = ~9 emails to Joe per cron fire (some cases deflect via classifier and skip the send). Manual smoke runs do the same. The "per-session notification" feature was designed for recruiter traffic, not eval traffic. There's no `email_domain='joedollinger.dev'` filter in `claimAndSendSessionEmail` to suppress synthetic-email sessions.

Side-effect blast radius extends to:
- `/admin/sessions` admin page populated with eval-CLI rows mixed in with real recruiter traffic — biasing Joe's signal that "someone scanned the QR code."
- `email_domain='joedollinger.dev'` rows in the daily rollup digest (Plan 04-04).
- `sessions.first_email_sent_at` atomic claim consumes the once-per-session email slot for synthetic sessions; if a real recruiter coincidentally has the same `id` (nanoid collision = vanishingly unlikely, but the architectural coupling is real), they'd miss their notification.
- Rate-limit counters per `email_domain` get burned by eval traffic (`emailLimiterDay = 150/day` per `redis.ts:33`).

For a public-facing agent during an active job search, the "Joe got 9 emails at 3am ET" failure mode after a cron-dispatched eval is operationally noisy and erodes alarm-email trust (Plan 04-06 alarm-fatigue concern).

**Fix:**
```ts
// src/lib/email.ts (or wherever claimAndSendSessionEmail lives) — add an
// early-return for synthetic eval-origin emails BEFORE the atomic claim
// (so the first_email_sent_at slot stays available for real recruiters).
const EVAL_SUFFIX = '@joedollinger.dev';
if (session.email?.endsWith(EVAL_SUFFIX)) {
  log({ event: 'session_email_skipped_eval', session_id });
  return;
}
```

Alternative (smaller diff): in `src/lib/eval/agent-client.ts:203-238`, mint with a non-email identifier and update `/api/session` to accept `eval_cli=true` in the body, bypassing the email field. The email-suffix filter is simpler and aligns with the existing `email_domain` column already present in `sessions`.

Also worth adding to `/admin/sessions` an "exclude eval-cli traffic" toggle so the dashboard's session count reflects real recruiter activity.

## Warnings

### WR-01: `pingExa` heartbeat-trust pattern makes Exa outages invisible to the dep-down alarm

**File:** `src/lib/health.ts:107-122` and `src/lib/alarms.ts:151-166`
**Issue:** Plan 05-12 launch-fix replaced the broken `fetch('https://api.exa.ai/', { method: 'HEAD' })` (which returned 404 → permanent `degraded`) with a heartbeat-trust pattern: `pingExa` reads `heartbeat:exa` from Redis. The heartbeat key is refreshed in two places — `src/app/api/cron/heartbeat/route.ts:160` (unconditional write every cron fire, regardless of Exa's actual health) and `src/lib/tools/research-company.ts:50` (only on successful Exa calls).

Because the cron writes unconditionally, `pingExa` returns `'ok'` whenever the heartbeat cron has fired in the last 60 seconds — regardless of whether Exa itself is reachable. The dep-down alarm (`alarms.ts:checkDependencies`) calls `pingExa()` and treats `'ok'` as a green signal. Result: if Exa goes down, `research_company` will deflect (good), but the dep-down alarm WILL NOT FIRE — Joe won't get an email letting him know one of the three tools is broken.

The code comment at `health.ts:108-113` and `heartbeat/route.ts:152-157` acknowledges this gap and labels it "WR-01 follow-up." This finding is the formal record of the unresolved issue.

The same heartbeat-trust trap exists for `pingClassifier` and `pingAnthropic` — but those keys are refreshed in `/api/chat`'s `onFinish` (line 334-338) on real traffic, which means under live recruiter traffic the keys lag-correlate with actual classifier/Sonnet health. Exa has no equivalent live-traffic refresh in the chat path — only the cron's unconditional bump and the tool's success-only refresh.

**Fix:** Either (a) make the heartbeat cron's `heartbeat:exa` write CONDITIONAL on an actual Exa probe (e.g., a real `exa.search` call with `numResults: 1, query: 'test'` — costs ~$0.005 per cron fire, $7/month at 5-min interval during business hours), or (b) add a separate `research_company_error_rate` alarm condition in `alarms.ts` that queries `tool_calls` table for `tool_name='research_company' AND status='error'` ratio in the last 1h. Option (b) catches the real failure mode (Exa down → tool deflects → recruiter sees in-character apology) without adding cron cost. Option (a) is cleaner but pays a small recurring cost.

### WR-02: Heartbeat route reads `pingAnthropic` BEFORE writing the heartbeat:anthropic key when prewarm is disabled, producing a stale read

**File:** `src/app/api/cron/heartbeat/route.ts:101-108,174-194`
**Issue:** Lines 101-108 fire all 5 deps' `ping*` helpers in parallel, including `pingAnthropic()` which reads `heartbeat:anthropic` from Redis. Later, line 174-183 unconditionally writes `heartbeat:anthropic` when `llmPrewarmEnabled === false`. Line 192-194 then computes `anthropicStatus` using `prewarm.ok` if prewarm is enabled, else falls back to `anthropicPing.value` — which is the STALE pre-write read.

So when `HEARTBEAT_LLM_PREWARM=false`, the cron writes `heartbeat:anthropic` (good, keeps the key fresh) but logs `anthropic: 'degraded'` if the previous heartbeat key was older than 60 seconds. This produces incoherent rows in the heartbeat log: `{anthropic_cache_read_tokens: 0, cost_cents: 0, statuses.anthropic: 'degraded'}` when the dashboard would show `ok` on the very next read after the write took effect.

The comment at line 184-194 mentions the BL-13 fix for the prewarm-enabled case (use `prewarm.ok` as authoritative) but the prewarm-disabled branch was not updated symmetrically. Visible only when prewarm-disabled mode is in use; default config has prewarm enabled, so this is dormant in production.

**Fix:**
```ts
// src/app/api/cron/heartbeat/route.ts
const anthropicStatus = llmPrewarmEnabled
  ? (prewarm.ok ? 'ok' : 'degraded')
  // Prewarm disabled — we just unconditionally wrote heartbeat:anthropic at
  // line 175, so the key is fresh by definition. Mirror the exa/classifier
  // heartbeat-trust pattern that uses the post-write boolean.
  : 'ok';
```

Additionally, gate this on the write succeeding (track a `anthropicWriteOk` boolean inside the try at line 174-183) so a Redis network blip doesn't produce a false 'ok'.

### WR-03: Classifier verdict shape mismatch between live code (`{label, confidence}`) and heartbeat test mock (`{verdict, confidence}`)

**File:** `tests/cron/heartbeat.test.ts:20,91,236-241` vs `src/lib/classifier.ts:9-14`
**Issue:** `ClassifierVerdict` per `src/lib/classifier.ts:9-12` is `{ label: 'normal'|..., confidence: number }`. The heartbeat route at `src/app/api/cron/heartbeat/route.ts:133-138` checks `verdict.label === 'offtopic' && verdict.confidence === 1.0` to detect the fail-closed sentinel.

But `tests/cron/heartbeat.test.ts:20` mocks `classifyUserMessage` to return `{ verdict: 'allow', confidence: 0.9 }` — wrong field name AND a `verdict` value (`'allow'`) that isn't in the enum. The test passes because the route only reads `.label` (which is `undefined` on the mock object), and `undefined === 'offtopic'` is false, so `looksFailClosed` is false, so `classifierLiveOk` becomes true. The "fail-closed sentinel detection" branch is never actually exercised by these tests.

This means the test labeled "does not write heartbeat:classifier when live classifier call throws" (line 233) only proves the `catch` branch works — it does NOT prove the fail-closed-sentinel branch works. If `classifyUserMessage` were ever to return a malformed shape under real conditions, the heartbeat code's fail-closed check would silently pass and write a stale-OK heartbeat — exactly the chicken-and-egg the Plan 05-12 fix was trying to eliminate.

**Fix:** Update the test mocks to return the real `ClassifierVerdict` shape:
```ts
// tests/cron/heartbeat.test.ts
classifyUserMessage: vi.fn(async () => ({ label: 'normal', confidence: 0.9 })),
// And add an explicit test for the fail-closed-sentinel branch:
it('logs warning and skips heartbeat:classifier write when live call returns fail-closed sentinel', async () => {
  mocks.classifyUserMessage.mockResolvedValue({ label: 'offtopic', confidence: 1.0 });
  // ... assert no heartbeat:classifier write, warn log present
});
```

### WR-04: `assertSpendCapDeflection` regex is overly permissive — masks real failures

**File:** `src/lib/eval/cats/cat2.ts:146-148`
**Issue:** The regex `/taking a breather|back tomorrow|email Joe directly|come back|few hours|spend cap|capacity|rate limit/i` matches many strings that are NOT the spendcap deflection. The "ratelimit" deflection at `src/app/api/chat/route.ts:78` ("You've been at this a bit — my rate limit just kicked in...") contains "rate limit" and would match. The "borderline" deflection ("Not sure I caught that") would not match — but a generic Sonnet response about capacity planning ("ensure we have enough capacity") would.

Combined with CR-01 (the cap key doesn't trip), this creates a defense-in-zero: the gate it's supposed to test isn't tripping, AND the assertion is too permissive to catch the mis-match.

**Fix:**
```ts
// src/lib/eval/cats/cat2.ts
export function assertSpendCapDeflection(result: ChatStreamResult): AssertionResult {
  // Pin to the exact phrase from DEFLECTIONS.spendcap in src/app/api/chat/route.ts:80.
  const isSpendcapText = /taking a breather for the day/i.test(result.responseText);
  const noToolFired = result.toolCalls.length === 0;
  const passed = isSpendcapText && noToolFired && result.httpStatus === 200;
  return { passed, rationale: JSON.stringify({ isSpendcapText, noToolFired, httpStatus: result.httpStatus, snippet: result.responseText.slice(0, 200) }) };
}
```

Better still: parse the `data-deflection` transient sideband chunk (already plumbed through `parseChatStream` in `src/lib/eval/agent-client.ts:88-91`) and assert `deflection.reason === 'spendcap'` directly. The sideband signal exists precisely to avoid this regex-matching fragility.

### WR-05: `pingSupabase` treats any PostgREST error as `degraded` — doesn't discriminate PGRST116 from real infrastructure errors

**File:** `src/lib/health.ts:71-96`
**Issue:** The function returns `'degraded'` if `result.error` is set, but `result.error` from supabase-js can legitimately be set on transient PostgREST hiccups (e.g., a single failed `.single()` with PGRST116 = no-rows) — which would log `degraded` for what is actually a healthy database. Compare with the `/api/chat` BL-17 fix in `src/app/api/chat/route.ts:134-149` which discriminates `PGRST116` from real infrastructure errors. `pingSupabase` does not — any `result.error` is `degraded`. The probe is a count-head query so PGRST116 is unlikely here, but the asymmetry with BL-17 is worth fixing for consistency.

Separately, the comment at lines 78-85 lampshades a real fragility: the supabase-js builder is a PromiseLike (thenable), and the `.then((r) => r)` no-op identity-then is doing real work coercing the thenable into a Promise that `withTimeout` can race. If anyone refactors this thinking it's a no-op, the timeout would stop working — comment that more emphatically or extract into a `toPromise` helper with a doc comment.

**Fix:** Discriminate PGRST-error-codes from infrastructure errors symmetrically to BL-17:
```ts
if (result && 'error' in result && result.error) {
  // PGRST codes are "PostgREST-validated request, server is healthy" signals.
  // Only network/auth failures should mark the dep degraded.
  const code = (result.error as { code?: string }).code;
  if (code?.startsWith('PGRST')) return 'ok';
  return 'degraded';
}
```

### WR-06: `validateAndScoreAbSession` writes the eval_run row BEFORE marking the AB session submitted — a crash between the two leaves an orphan run with no audit trail

**File:** `src/lib/eval/ab-mapping.ts:213-273`
**Issue:** Order of operations: `createRun` (line 213) → `writeCase` (line 240) → `updateRunStatus` (line 242) → THEN mark `eval_ab_sessions.submitted_at` (line 256-264). If the process crashes between line 251 (run finalized) and line 264 (session marked submitted), the next call with the same `sessionId` would find `submitted_at IS NULL` and re-score the session, producing a duplicate eval_run row and a duplicate eval_cases row with the same case_id.

Comment at line 266-272 says "the primary scoring path succeeded" — but the audit-row inconsistency (run exists, session not marked) violates the T-05-08-06 repudiation mitigation that the file claims to enforce. Practical likelihood is low (the in-API surface is small and the failure window is narrow), but the duplicate-row contamination of `eval_runs` would be confusing on the admin /admin/evals index.

**Fix:** Reorder so the session-marked-submitted UPDATE happens BEFORE the eval_runs row is written (or wrap both in a Supabase RPC). Practically, claim the session as submitted first as an atomic claim — same pattern as `claimAndSendSessionEmail` (`session.first_email_sent_at`). The runs/cases writes can be replayed safely on retry because they're keyed on a fresh `nanoid()` per attempt.

## Info

### IN-01: `package.json` declares Node `>=22.11.0` but `.github/workflows/eval.yml` pins Node 22 (uses latest 22.x)

**File:** `package.json:5-7`, `.github/workflows/eval.yml:35`
**Issue:** CI uses `node-version: '22'` (resolves to current latest 22.x). Local dev contract says `>=22.11.0`. If Node 22.x introduces a behavior change consumed by an eval-time dep, CI could pick it up before local. Pin both to the same minor version to keep eval reproducibility tight (`eval-models.ts:8-10` makes a big deal about judge-model snapshot reproducibility for the same reason).

**Fix:** Set `node-version: '22.11'` in the workflow and `"node": ">=22.11.0 <23"` in package.json.

### IN-02: `cat1.ts` reads full KB unconditionally even when filter excludes cat1

**File:** `src/lib/eval/cats/cat1.ts:64` (called from CLI dispatch)
**Issue:** `cat1.ts:64` calls `loadKB()` at the top of `runCat1`. The CLI dispatch in `scripts/run-evals.ts:94-96` filters categories before calling runners — but if Joe runs `EVAL_CATS=cat1` to debug cat1 specifically, `loadKB` fires once and is fine. The latent issue: the KB is loaded once per `runCat1` call, and the union of all cat1 ground_truth_facts is built once (line 52-54) and reused. Good. Lower priority cleanup: extract these into module-level lazy singletons if cat1 is ever run more than once per process.

**Fix:** Consider memoizing `loadKB()` at the module level since the KB content is invariant for a given process. Minor cleanup; not impacting correctness.

### IN-03: `evals/cat-04-real-joe.yaml` contains 80-120 word verbatim Joe-voice samples that mirror `kb/voice.md`

**File:** `evals/cat-04-real-joe.yaml:14-34`
**Issue:** The 5 curated excerpts in this YAML duplicate content already present in `kb/voice.md` (the file header confirms they were stitched from voice.md). Since `cat-04-real-joe.yaml` is checked into a public repo (project memory notes the GitHub repo `jmd53695516/resume-agent` is public), this exposes Joe's voice samples — including the "failed leadership project" content describing a former coworker — in a repo file that's easier to grep than `kb/voice.md` and duplicates content outside its anonymization context.

Re-check that the anonymization annotations in `kb/voice.md` (referenced in the YAML header) have been faithfully carried over to all 5 entries, especially `cat4-real-004` which references "the woman in charge" and her hiring decisions. The `docs/transcripts/` directory is gitignored for exactly this concern; the same care should apply to derived files in the eval YAMLs.

**Fix:** Confirm with Joe that all 5 excerpts have been anonymized to his comfort level (no personally-identifying titles, gender, hiring relationships that point to a specific person), then add a header line referencing the anonymization audit date matching `kb/voice.md`'s "anonymized 2026-04-29" note.

### IN-04: `kb/profile.yml` `personal_sites[]` URLs include direct Streamlit and Railway production URLs

**File:** `kb/profile.yml:18-22`
**Issue:** Joe's Streamlit MLB app and Railway golf-scorecard app URLs are exposed in the agent's KB. If the agent emits these in a research_company response or chat reply, recruiters can hit them directly. Both are Joe's personal projects (per the descriptions) so this is presumably intentional, but the Railway URL (`https://web-production-d8773.up.railway.app/`) is the platform's default subdomain — if Joe ever takes the app down or repurposes the subdomain, the agent will still emit a now-broken link. Same for the Streamlit URL.

**Fix:** Consider routing through a stable redirect Joe controls (e.g., `joe-dollinger-chat.com/mlb` → 302 to Streamlit) so URL changes can be patched without re-deploying the agent's KB. Lower priority — accept if Joe wants to keep the direct links for simplicity.

### IN-05: `eval-ab/page.tsx` pre-warm makes 5 parallel Sonnet calls per page load

**File:** `src/app/admin/(authed)/eval-ab/page.tsx:122-152`
**Issue:** `generateAgentParagraphs` issues 5 `Promise.all`-parallel `callAgent` calls — but each call hits `/api/chat` which is rate-limited (`sessionLimiter = 200/7days` per session, `ipLimiter10m = 20/10min` per IP). Five parallel calls from the admin page burns 5 of the 20-in-10-minutes slot in a single page load. If Joe refreshes the page mid-test or generates a second session, the second batch hits `ip10m` rate-limit and the page renders with `[pre-warm failed]` placeholders. The `try/catch` per call falls back gracefully but the UX is sub-optimal — friend testers would see a half-broken card set.

Cost: 5 × Sonnet calls × ~85k cached system prompt input ≈ $0.013 per page load (cache-read priced). If Joe loads the page 10 times during friend-tester coordination, that's $0.13 hitting the $3/day cap counter.

**Fix:** Cache the generated paragraphs per `targetUrl + cat-04-prompts.yaml hash` for 1h in Redis. Plan 05-08's intent was "fresh paragraphs per test session" but in practice the tester sees one batch and submits; refreshing should be intentional. Even simpler: render placeholders + a "Generate" button that fires the 5 calls on click, so the cost is opt-in.

### IN-06: `run-eval` POST handler tests an unreachable validateCronAuth GET branch

**File:** `src/app/api/cron/run-eval/route.ts:21-23`, `tests/cron/run-eval.test.ts:85-91`
**Issue:** The route's belt-and-suspenders comment at line 109-113 claims `validateCronAuth` rejects non-POST. The test at line 85-91 invokes `POST(req with method: 'GET')` and asserts 401 — but Next.js routes are method-dispatched at the framework layer; a real GET request would never reach `POST()` (it would 405). The test exercises an unreachable code path. Not a bug, but the test offers false confidence.

**Fix:** Add an explicit `export async function GET()` returning 405 for clarity, or remove the GET-via-POST-handler test since it tests the wrong layer.

### IN-07: `calibrate/page.tsx` and `ab-mapping.ts` Math.random()-based Fisher-Yates has known small-array bias

**File:** `src/app/admin/(authed)/evals/calibrate/page.tsx:41-48`, `src/lib/eval/ab-mapping.ts:53-60`
**Issue:** Fisher-Yates is correctly implemented but uses `Math.random()` which is not crypto-strong. For a calibration sample of 10 from a pool of 50, the practical bias is undetectable, and the code comments explicitly accept this ("Joe vs himself; no incentive to game"; "honest-but-curious threat model"). Calling out for completeness — the blind A/B in particular is the artifact Joe might cite to a hiring manager as evidence of rigor; having `crypto.getRandomValues` here is a one-line upgrade.

**Fix:**
```ts
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const r = new Uint32Array(1);
    crypto.getRandomValues(r);
    const j = r[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

---

_Reviewed: 2026-05-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
