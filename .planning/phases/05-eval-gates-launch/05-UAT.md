---
status: complete
phase: 05-eval-gates-launch
source: [05-10-SUMMARY.md, 05-11-SUMMARY.md, 05-12-LAUNCH-CHECKLIST.md]
scope: post-fix verification — eval gate + launch outstanding (items 1-6 already verified in 05-01-HUMAN-UAT-RESULTS.md; items 10-11 verified by unit tests on this branch)
started: 2026-05-12T01:08:54Z
updated: 2026-05-12T01:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Eval gate — cat1 + cat4 still pass against prod
expected: cat1=15/15 and cat4=5/5 (avg ≥ 4.0) on prod (https://joe-dollinger-chat.com)
result: issue
reported: "CLI ignored --target / --cats flags and ran against localhost (no dev server) → mintEvalSession fetch failed. Run abended with status='error', totalCostCents=0."
severity: minor
note: |
  Test-spec error: scripts/run-evals.ts reads EVAL_TARGET_URL env (not --target argv) and
  has no --cats filter (runs all 6 cats). Phase deliverable itself is already verified per
  LAUNCH-CHECKLIST: cat1=15/15 prod run `sWLys5bpVsiHAfwvoln04`, cat4=5/5 avg 4.40 prod run
  `OPoI0ljuwE4GlbT_LFh4u`. CLI argv-parsing gap matches existing deferred-items entry
  "CI eval workflow narrowing per addendum D-12-B-01".

### 2. GitHub branch protection blocks merge on red eval
expected: On `main`, branch protection rule requires `Vercel - resume-agent-eyap: eval` commit status. A PR with that check pending/failed cannot merge (unless admin-bypassed via `enforce_admins` toggle, which is auditable in the GitHub UI). Verify via GitHub → Settings → Branches → main rule.
result: pass

### 3. Vercel Deployment Checks gates prod alias on red eval
expected: A failing eval on a preview deploy leaves that deploy red in the Vercel UI. The prod alias `https://joe-dollinger-chat.com` continues to serve the previous green deploy — does NOT promote the red one. Verify via Vercel → resume-agent-eyap → Deployments history (A7 spot-test).
result: pass

### 4. Friend-test Q1 responses received (LAUNCH-04)
expected: 3 testers (1 non-PM + 1 PM + 1 recruiter) have submitted responses to https://forms.gle/yovqkpe3QVnNpVTP7. Non-PM Q1=Y is the launch-blocking criterion per CONTEXT D-D-03. Open the Google Form responses tab; check role mix + non-PM Q1 verdict.
result: pass

### 5. Paper resume printed + QR physical scan test
expected: Joe has at least one physical copy of the master resume PDF printed with `public/resume-qr.png` embedded. Phone-scanning the printed QR resolves to https://joe-dollinger-chat.com (apex). Print run completed; physical scan verified.
result: pass

## Summary

total: 5
passed: 4
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Eval CLI verifies cat1=15/15 and cat4=5/5 against prod via `npm run eval -- --target=... --cats=...`"
  status: failed
  reason: "User reported: CLI ignored --target / --cats flags and ran against localhost (no dev server) → mintEvalSession fetch failed. Run abended with status='error', totalCostCents=0."
  severity: minor
  test: 1
  artifacts:
    - path: "scripts/run-evals.ts"
      issue: "No argv parsing — reads only EVAL_TARGET_URL env; no per-category filter; always runs all 6 cats"
  missing:
    - "argv parser for --target / --cats flags (or equivalent env-overrides documented in --help)"
    - "Per-category invocation matching addendum D-12-B-01 launch gate (cat1 + cat4-judge only)"
  context: |
    Phase 05 deliverable itself is not failing — LAUNCH-CHECKLIST captures cat1=15/15
    prod run `sWLys5bpVsiHAfwvoln04` and cat4=5/5 avg 4.40 prod run `OPoI0ljuwE4GlbT_LFh4u`.
    The gap is CLI ergonomics, already tracked under deferred-items "CI eval workflow
    narrowing per addendum D-12-B-01". Folding this UAT note into that follow-up.
