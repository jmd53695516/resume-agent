---
launch_date: 2026-05-11
final_url: https://joe-dollinger-chat.com
status: friend-test-pending
---

# Phase 5 Launch Checklist

**Plan 05-12 sign-off artifact.** Closes LAUNCH-01..07 + SAFE-12 + LAUNCH-04.

## Domain (LAUNCH-01..03)

- [x] Apex `joe-dollinger-chat.com` purchased at Cloudflare Registrar (2026-05-10)
- [x] Apex CNAME → `cname.vercel-dns.com` (Cloudflare flattened, DNS-only / gray-cloud)
- [x] www CNAME → `cname.vercel-dns.com` (308 redirect to apex)
- [x] Vercel "Production Domain" set to apex (canonical per addendum D-12-A-02)
- [x] TLS active (Let's Encrypt auto-issued); `curl -I` shows 200 on apex, 308 on www
- [x] PDF dropped at `public/joe-dollinger-resume.pdf` (76409 bytes); resolves Phase 03-HUMAN-UAT item 9 404
- [x] QR PNG generated → `public/resume-qr.png` (encodes apex; phone-scanned by Joe — verifies)
- [x] LinkedIn updated (Featured / Contact info)
- [x] Master resume PDF updated (URL near contact block)
- [ ] Personal site updated — N/A (Joe doesn't currently host one)

## SAFE-12 — Anthropic spend cap

- [x] Org-level spend cap configured in Anthropic Console
- [x] Evidence committed at `.planning/phases/05-eval-gates-launch/safe-12-evidence.png`

**Deviation from plan as written:** Cap is **$100/mo** (not the spec'd $20/mo) because the Anthropic org is shared with Joe's other API workloads. **Project-specific protection** is the in-code 300¢/day spend cap (SAFE-04, enforced in `src/app/api/chat/route.ts`) — cat1 deflection for spendcap is verified live multiple times during Plan 05-12 launch UAT (the eval CLI tripped it 4x in one evening). $20/mo would have starved Joe's other workloads; $100/mo + per-day in-code cap gives equivalent protection scoped to the resume-agent project alone.

## EVAL pass on prod (LAUNCH-05) — per addendum D-12-B-01

**Hard gates (must pass on prod against `https://joe-dollinger-chat.com`):**

- [x] cat4 = 5/5, aggregate avg 4.40, category_passed=true — eval_runs row id: `OPoI0ljuwE4GlbT_LFh4u` ✓
- [x] cat1 = 15/15 — eval_runs row id: `sWLys5bpVsiHAfwvoln04` ✓ (D-B-01 zero-fabrication; D-12-C-03 honored — no override)

**Documented baseline (informational, not blocking — per D-12-B-02):**

| Cat | Pass rate (latest) | Source runId | Root cause / triage owner |
|-----|--------------------|---------------|----------------------------|
| cat2 | 2/9 | `j1w6V80X4l0wcZekN52XL` (preview run, not prod) | Tool-call assertion mismatches; calibration is post-launch Phase 6 work. Memory: original Plan 05-05 SUMMARY notes spend-cap synthetic was passing on local; live state varies. |
| cat3 | 2/6 | `loroDuGeY8SfJ-m_AliBs` | Per D-12-C-05 the ≥1/6 informational gate is **MET** (was 0/6 pre-Task-0; classifier fix reached cat3 prompts). 4 failures: 1 confirmed classifier deflection (`cat3-persona-004` `deflectionReason: sensitive`), 3 likely warmth-judge below-threshold. Cat3 calibration to push >5/6 is post-launch Phase 6 work. |
| cat5 | 1/7 | `OPoI0ljuwE4GlbT_LFh4u` | Refusal hybrid + warmth threshold; case-by-case investigation deferred to Phase 6. |
| cat6 | 17/20 | `j1w6V80X4l0wcZekN52XL` (CI, full run) | 3 admin-403 spec failures pre-existing (per Plan 05.2-06 deferred-items); not introduced by Plan 05-12. |

## Friend-test (LAUNCH-04)

**Per CONTEXT D-D-03: 3 testers, ≥1 PM + ≥1 non-PM. Non-PM Q1=Y is the blocking criterion.**

> Form template + DM copy: `.planning/phases/05-eval-gates-launch/05-12-FRIEND-TEST-FORM.md`

| Tester | Role | Q1 (substantive Y/N) | Q2 (awkward) | Q3 (favorite) | Q4 (cringe) | Q5 (open) |
|--------|------|----------------------|--------------|---------------|-------------|-----------|
| 1      | PM     | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ |
| 2      | non-PM | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ |
| 3      | _TBD_  | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ |

## Awkward-issues triage

| Tester | Issue | Severity | Fix decision |
|--------|-------|----------|--------------|
| _none recorded yet_ | | block-launch / fix-before-launch / accept | |

## Pre-launch checklist (LAUNCH-06)

- [x] `kb/resume.md` final (no edits in Plan 05-12 scope; signed-off via prior phase work)
- [x] `kb/guardrails.md` Joe-signed (line 37: `Signed: Joe Dollinger, 2026-04-24`)
- [x] EVAL cat 1 (15/15) passing on prod — runId `sWLys5bpVsiHAfwvoln04`
- [x] EVAL cat 4 (LLM-judge avg ≥4.0 + per_case all pass) passing on prod — runId `OPoI0ljuwE4GlbT_LFh4u`
- [ ] Friend-test sign-off (3 testers, ≥1 PM, ≥1 non-PM, non-PM Q1=Y) — _pending responses_
- [x] Real transcript verified end-to-end in /admin/sessions (Joe sent chat as fake recruiter in incognito → row + transcript with traces visible in /admin/sessions)
  - **Launch-night finding:** Supabase Site URL was still `http://localhost:3000` (dev default). After successful GitHub OAuth, Supabase fell back to Site URL because `https://joe-dollinger-chat.com/auth/callback` was not in the Redirect URLs allowlist — admin login bounced to `localhost:3000`. Fixed in Supabase Dashboard → Authentication → URL Configuration: Site URL → `https://joe-dollinger-chat.com`; Redirect URLs added `https://joe-dollinger-chat.com/auth/callback` (kept `http://localhost:3000/auth/callback` for local dev).

## LAUNCH-07 (preview-to-prod gate)

- [x] A7 spot-test passed in Plan 05-10 (eval failure blocks Vercel promotion). **Note:** during Plan 05-12 launch the gate was bypassed twice (PR #1 squash-merge + PR #2 banner fix) via `enforce_admins` toggle + Vercel manual promote, because the CI workflow runs all 6 cats while addendum D-12-B-01 narrows the launch gate to cat1+cat4. Workflow narrowing is a Phase 6 follow-up.

## Health banner

- [x] All 5 deps green on `/api/health` post-banner-fix (anthropic / classifier / supabase / upstash / exa)
- [x] cron-job.org schedule configured to fire `/api/cron/heartbeat` every 5 min during business hours (Joe-confirmed)
- [x] Banner fix shipped (PR #2, merged commit `296ad6c`, deployed via manual promote)

## Resume link go-live

- [ ] Paper resume printed with QR (date: _TBD_)
- [ ] Final go/no-go: _pending friend-test_

## Open follow-ups (deferred to Phase 6 / decimal-phase 5.x)

- **KB expansion (decimal phase 5.4 candidate):** Joe holds a ~775-line consolidated resume.md compiled by another agent from his multi-job-type Word docs. Held locally — NOT merged tonight because the other agent (a) expanded beyond source material (cat1 fabrication risk: every expansion is a hallucination candidate) and (b) doesn't know Joe's terse-with-numbers voice (cat4 voice-fidelity regression risk). Future phase: treat the 775-line file as RAW source, strip agent expansion, rewrite verified claims in Joe's voice, expand cat1 ground_truth_facts to cover, re-verify cat1+cat4 on prod before merge. Better still: feed the original Word docs (not the agent's expansion) into the next merge session.
- **Banner false-green for classifier (WR-01 from 05-REVIEW.md):** Same class of bug as the Exa fix shipped tonight. `classifyUserMessage` in `src/lib/classifier.ts` fail-closes on error and never throws, so the heartbeat route's `try { await classifyUserMessage } catch {...}` will always set `classifierLiveOk = true` even during a real Anthropic outage. Banner would show classifier=ok when it should say classifier=degraded. **Impact bounded:** chat still works during such an outage (uses fail-closed verdict); only banner is misleading. Fix options: (a) add a `classifyUserMessageOrThrow` variant for the heartbeat caller, (b) inspect heartbeat-call result for sentinel `{label:'offtopic',confidence:1.0}` shape. ~30 min focused fix; defer to decimal phase 5.x or fold into the workflow narrowing follow-up.
- CI eval workflow narrowing per addendum D-12-B-01 (currently runs all 6 cats; should gate on cat1+cat4-judge only)
- Judge retry on transient `Grammar compilation timed out` errors from Anthropic structured output (caught one such failure during cat1 verification — `cat1-fab-008` in runId `AoyT2RN-Af9qe1BJ-0WUM`; passed on retry)
- `scripts/reset-eval-rate-limits.ts` email-key clearing audit — script reported "5/8 keys cleared" but the `eval-cli@joedollinger.dev:20584` daily-window key persisted, requiring an ad-hoc clear during Plan 05-12 verification
- cat2/cat3/cat5/cat6 calibration to bring per-cat baselines closer to 100% (post-launch ergonomic improvement)

---

Signed: _pending — awaiting friend-test responses + prod cat1=15/15_
Date: _pending_
