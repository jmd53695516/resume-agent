---
phase: 260511-u9d
plan: "01"
type: quick
mode: quick
branch: gsd/05-12-task-0-classifier-tune
wave: 1
status: complete
requirements:
  - WR-01
tags: [classifier, heartbeat, banner-truth, fail-closed, fail-open, refactor, regression-test]
dependency_graph:
  requires:
    - src/lib/classifier.ts (pre-existing fail-closed classifyUserMessage)
    - src/app/api/cron/heartbeat/route.ts (pre-existing chicken-and-egg WR-04 fix)
  provides:
    - src/lib/classifier.ts (classifyUserMessageOrThrow throwing variant)
    - src/app/api/cron/heartbeat/route.ts (truthful banner during Anthropic outages)
  affects:
    - /api/health banner (now goes yellow when Haiku is actually down)
    - /admin/health dashboard (same)
key_files:
  modified:
    - src/lib/classifier.ts
    - src/app/api/cron/heartbeat/route.ts
    - tests/lib/classifier.test.ts
    - tests/cron/heartbeat.test.ts
decisions:
  - "Option (a) — extract throwing variant — chosen over (b) sentinel inspection: separates call-site intent (chat wants fail-closed; heartbeat wants throw) and removes the {label:'offtopic',confidence:1.0} sentinel-shape overload that forced the prior probe-phrase workaround"
  - "classifyUserMessageOrThrow body is byte-identical to the prior classifyUserMessage try-block contents — same JSON-extract regex, same code-fence strip, same zod parse — risk surface stays minimal"
  - "Chat route call sites unchanged (still imports classifyUserMessage) — fail-closed deflection contract for the user-facing hot path is preserved"
metrics:
  duration_min: ~25
  tasks: 2
  files: 4
  commits: 2
  net_test_delta: +5 (4 new classifier tests + 1 inverted heartbeat test - 1 removed sentinel test = +5 vs baseline 612 → 612 tests, but baseline was actually 607 pre-change so net +5 passes)
completed: 2026-05-11
---

# Quick Task 260511-u9d: WR-01 Classifier Banner False-Green Fix Summary

## One-liner

Extracted `classifyUserMessageOrThrow` as a throwing variant of the classifier so the heartbeat cron's try/catch actually fires during Anthropic outages — banner now reports `classifier=degraded` truthfully instead of false-greening when Haiku is down.

## Why this fix matters

The recruiter-facing `/api/health` banner was lying. `classifyUserMessage` is fail-closed: on any Anthropic error (rate limit, 503, network) it logs and returns `{ label: 'offtopic', confidence: 1.0 }` — it never throws. The heartbeat route's `try/catch` was therefore unreachable, and the prior WR-04 chicken-and-egg fix had to invent a fragile sentinel-shape inspection (`looksFailClosed = verdict.label === 'offtopic' && verdict.confidence === 1.0`) to detect outages by reading the shape of the swallowed result.

That workaround had two problems:
1. The probe phrase had to be carefully chosen to NOT plausibly classify as `offtopic` (Joe's prior WR-01-followup commit had to swap `'health check ping'` → `"Tell me about Joe's PM experience"` for exactly this reason — the sentinel was overloaded).
2. A legitimate `'offtopic' + 1.0` Haiku response (rare but possible) would false-flag the banner even when classifier was perfectly healthy.

Option (a) — extract a throwing variant — fixes both at the call-site level. Heartbeat *wants* errors to propagate; chat route *wants* fail-closed deflection. Same shared body, two intent-explicit entry points.

## Files changed (4) + commits (2)

| Commit | Files | Net |
|--------|-------|-----|
| `4b9e68b` — fix(classifier): extract classifyUserMessageOrThrow throwing variant | src/lib/classifier.ts, tests/lib/classifier.test.ts | +64 / -20; 4 new tests; 12 existing fail-closed tests pass byte-identical |
| `6a5a8b0` — fix(heartbeat): use classifyUserMessageOrThrow so banner reports classifier outages truthfully | src/app/api/cron/heartbeat/route.ts, tests/cron/heartbeat.test.ts | +37 / -60; sentinel-shape branch deleted; WR-03 test repurposed as inverted contract |

## What the fix does

### `src/lib/classifier.ts`

- New exported function `classifyUserMessageOrThrow(userText)` — body is the literal prior contents of the `classifyUserMessage` try-block (Anthropic call + JSON extract + zod parse). Errors propagate.
- `classifyUserMessage` is now a 6-line wrapper: `try { return await classifyUserMessageOrThrow(...) } catch (err) { console.error(...); return offtopic/1.0 sentinel }`. Public fail-closed contract is preserved byte-identical from the caller's perspective.
- `ClassifierOutput` zod schema + `SYSTEM_PROMPT` untouched (no prompt edits in this fix — risk surface stays minimal).

### `src/app/api/cron/heartbeat/route.ts`

- Import swap: `classifyUserMessage` → `classifyUserMessageOrThrow`.
- The 34-line WR-01-followup block (lines 116-149) collapses to a clean ~14-line try/catch. `looksFailClosed` sentinel-shape inspection is GONE.
- Probe phrase `"Tell me about Joe's PM experience"` retained (was already correct).
- Everything else byte-identical: prewarm logic, exa write, anthropic write-then-read fix (WR-02), final log payload structure.

## Test changes

### `tests/lib/classifier.test.ts`

Added `describe('classifyUserMessageOrThrow', ...)` with 4 new tests:
1. Returns parsed verdict on successful Anthropic response.
2. **RE-THROWS Anthropic API errors** — the load-bearing WR-01 contract.
3. RE-THROWS on malformed JSON response.
4. RE-THROWS on zod validation failure (bad label).

The existing 12 `classifyUserMessage` tests (including 'fail-closed on API error', 'fail-closed on bad JSON', and the Item #11 regression-contract block) pass byte-identical — proves the public fail-closed contract is preserved.

### `tests/cron/heartbeat.test.ts`

- All mock references renamed `classifyUserMessage` → `classifyUserMessageOrThrow` (hoisted mocks, vi.mock factory, reset, default, assertions).
- WR-03 fail-closed-sentinel test replaced with inverted contract: 'treats legitimate offtopic+1.0 verdict as classifier-ok' — asserts that `heartbeat:classifier` IS written and `statuses.classifier === 'ok'` when the throwing variant resolves with `{label:'offtopic',confidence:1.0}`. This is the regression that the sentinel-shape branch could not have caught.
- 'does not write heartbeat:classifier when live classifier call throws' updated to reject on `classifyUserMessageOrThrow` (banner-truth regression — the must-have).
- 'logs classifier=ok in heartbeat statuses on successful live call' updated to assert against `classifyUserMessageOrThrow`.

## Verification gates

| Gate | Result |
|------|--------|
| `npx vitest run tests/lib/classifier.test.ts tests/cron/heartbeat.test.ts` | 27/27 pass (16 classifier + 11 heartbeat) |
| `npx tsc --noEmit` | Exit 0 |
| `npm test` (full suite) | 541 pass / 71 fail / 612 total — **zero NEW failures** vs the ~71 pre-existing baseline (TracePanel React.act + logger trim + admin JSDOM — all unrelated). Net delta: +5 new passes (4 classifier + 1 heartbeat inverted) vs prior 536 passes. |
| `npm run build` | Exit 0 (Next.js compiled cleanly + emitted route summary) |
| `git diff --stat` | Exactly 4 files (classifier.ts, heartbeat route.ts, both test files). No collateral. |
| Chat-route preservation grep | `src/app/api/chat/route.ts:35,244` still imports + calls `classifyUserMessage` (fail-closed). Zero `classifyUserMessageOrThrow` references in the chat route. |

## Deviations from plan

**None.** Plan executed exactly as written:
- Option (a) selected as the plan prescribed.
- `classifyUserMessageOrThrow` body is byte-identical to the prior try-block contents (no regex "improvements", no prompt edits).
- Existing 12 `classifyUserMessage` tests untouched.
- Chat route untouched.
- `health.ts` untouched.
- Two atomic commits, one per task, conventional-commits style.

No deviation rules (1-4) triggered.

## Out of scope (deliberately not changed)

- `src/lib/health.ts` (pingClassifier still reads `heartbeat:classifier` — same heartbeat-trust pattern, unchanged).
- `src/app/api/chat/route.ts` (still fail-closed via `classifyUserMessage`).
- Probe phrase choice (already correct from WR-01-followup).
- Classifier system prompt (no behavioral changes).
- Pre-existing untracked diagnostic scripts (`scripts/heartbeat-diagnostic.ts`, `scripts/rl-diagnostic.ts`) — not part of this task, left alone per orchestrator instructions.

## Follow-ups to consider for `05-12-LAUNCH-CHECKLIST.md`

1. **Mark WR-01 entry as RESOLVED** in the "Open follow-ups" section. The banner now goes yellow when classifier is actually degraded.
2. **Note that the WR-03 sentinel-branch test was repurposed**: the sentinel-shape branch no longer exists in the heartbeat route (a legitimate `offtopic+1.0` Haiku response is treated as classifier-ok). The inverted test in `tests/cron/heartbeat.test.ts` covers the new contract: any successful classifier response (including the legitimate `offtopic+1.0` shape) refreshes `heartbeat:classifier` and emits `statuses.classifier='ok'`.

## Self-Check: PASSED

- src/lib/classifier.ts: FOUND (modified, exports both functions)
- src/app/api/cron/heartbeat/route.ts: FOUND (imports classifyUserMessageOrThrow)
- tests/lib/classifier.test.ts: FOUND (4 new tests in new describe block)
- tests/cron/heartbeat.test.ts: FOUND (mocks renamed, sentinel test repurposed)
- Commit 4b9e68b: FOUND (`git log` confirms)
- Commit 6a5a8b0: FOUND (`git log` confirms)
- Chat route `src/app/api/chat/route.ts` byte-identical (grep confirms 2 references to `classifyUserMessage`, zero to `classifyUserMessageOrThrow`)
- `npx tsc --noEmit` exit 0
- `npm run build` exit 0
- Full vitest suite: 541 pass / 71 fail (baseline preserved; +5 net passes)
