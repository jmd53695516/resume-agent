# Phase 5: Eval Gates & Launch - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 05-eval-gates-launch
**Areas discussed:** Harness + judge model, Blind A/B voice test, CI promote-to-prod gate, Backlog & launch sequence

---

## Harness + Judge Model

### Q1: Runner shape

| Option | Description | Selected |
|--------|-------------|----------|
| Custom tsx CLI | scripts/run-evals.ts orchestrates everything; Vitest stays for unit tests only | ✓ |
| Vitest with custom reporter | Eval cases as Vitest tests, custom reporter aggregates pass/fail/cost | |
| Hybrid | tsx CLI for cats 1-5, Vitest for cat 6 UX smoke | |

**User's choice:** Custom tsx CLI (recommended)
**Notes:** Aligns with spec's `scripts/run-evals.ts` callout.

### Q2: Test case format/location

| Option | Description | Selected |
|--------|-------------|----------|
| YAML in evals/ | One file per category, frontmatter-style metadata + multi-line prompts | ✓ |
| JSON in evals/ | Strict schema, machine-friendly but ugly to author | |
| Markdown with frontmatter | Mirrors kb/ pattern; one .md file per case | |

**User's choice:** YAML in evals/

### Q3: Eval target

| Option | Description | Selected |
|--------|-------------|----------|
| Vercel preview deploy | Real network, real Anthropic, real Supabase preview; matches EVAL-09 | ✓ |
| localhost (npm run dev) | Faster iteration, no Vercel needed; doesn't gate prod | |
| Both — EVAL_TARGET env var | Local for dev, preview for CI | |

**User's choice:** Vercel preview deploy
**Notes:** Refined in CONTEXT.md to a single `EVAL_TARGET_URL` env var (preview by default; localhost by override) — no `EVAL_TARGET` mode flag.

### Q4: Judge model strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Cross-vendor (GPT-4.1-mini or Gemini 2.5 Flash) | Avoids self-preference; new vendor key | ✓ |
| Haiku 4.5 | Cheapest, no new vendor; same family risk | |
| Two-judge ensemble | Most rigorous, ~2x cost | |

**User's choice:** Cross-vendor

### Q5: Specific cross-vendor judge

| Option | Description | Selected |
|--------|-------------|----------|
| GPT-4.1-mini | OpenAI; well-tested as judge in academic evals | |
| Gemini 2.5 Flash | Google; cheaper still | |
| Claude's discretion in research | gsd-phase-researcher picks at planning time | ✓ |

**User's choice:** Claude's discretion

### Q6: Cost budget enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Soft — log + warn | Projected at start, actual at end with red warn if >$1; no abort | ✓ |
| Hard — abort if projected >$2 | Belt-and-suspenders | |
| Per-category cost cap | Granular, more code | |

**User's choice:** Soft

### Q7: Judge model version pinning

| Option | Description | Selected |
|--------|-------------|----------|
| Const in src/lib/eval-models.ts | Auditable in git history | |
| Env var EVAL_JUDGE_MODEL | Runtime override | |
| Both — const default + env override | Default in code, override for experiments | ✓ |

**User's choice:** Both

### Q8: Monthly human calibration mechanics (EVAL-12)

| Option | Description | Selected |
|--------|-------------|----------|
| Manual /admin/evals/calibrate page | Joe rates 10 random recent cases, delta surfaced | ✓ |
| Cron email reminder only | No new UI; easy to skip | |
| Defer to v2 | Build only if drift becomes concern | |

**User's choice:** Manual /admin/evals/calibrate page

---

## Blind A/B Voice Test

### Q1: A/B venue

| Option | Description | Selected |
|--------|-------------|----------|
| /admin/eval-ab single-page tool | Joe-only page behind requireAdmin | ✓ |
| Public /ab-test page with token-gated link | Async UX, more friction | |
| Google Form (no code) | Fastest to ship, manual scoring | |

**User's choice:** /admin/eval-ab

### Q2: Source of real-Joe paragraphs

| Option | Description | Selected |
|--------|-------------|----------|
| Curated voice.md samples | Pre-selected, fixed length, reproducible | ✓ |
| Fresh unfiltered excerpts each run | Drift signal, high friction | |
| Mix — 3 fixed + 2 rotating | Reproducibility + drift detection | |

**User's choice:** Curated voice.md samples

### Q3: Source of agent replies

| Option | Description | Selected |
|--------|-------------|----------|
| Generated fresh from preview deploy at A/B time | Always reflects current state | ✓ |
| Pre-recorded fixture | Reproducible but stale | |
| Joe picks from /admin/sessions | Authentic but Joe-time per run | |

**User's choice:** Generated fresh from preview deploy

### Q4: Scoring mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Auto — page records + writes eval_runs row | Counted in CI's eval_runs scan | ✓ |
| Joe manually enters % | Less code; Joe is bottleneck | |
| Multi-tester aggregation | Stricter, more orchestration | |

**User's choice:** Auto-recorded
**Notes:** Multi-tester aggregation captured as deferred — query-change in v2 if needed.

---

## CI Promote-to-Prod Gate

### Q1: CI runner

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Actions | New .github/workflows/eval.yml | ✓ |
| Vercel deploy hook + serverless eval endpoint | 60s function-timeout limit issue | |
| GitHub Actions + Vercel manual promote | Two-step manual promote | |

**User's choice:** GitHub Actions
**Notes:** main auto-deploys to prod; passing the check IS the promote gate.

### Q2: Trigger cadence

| Option | Description | Selected |
|--------|-------------|----------|
| On every PR + on promote | Catches regressions early; ~$50-100/yr CI cost | ✓ |
| Promote-only | Cheapest; slower feedback | |
| Cheap subset on PR + full on promote | Two configs to maintain | |

**User's choice:** Every PR + promote
**Notes:** Cheap subset captured as deferred.

### Q3: Block mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Branch protection: required check on main | Standard GitHub pattern | ✓ |
| Vercel deploy-protection bypass token | Vercel-specific, more pieces | |
| Manual: Joe checks before clicking promote | Convention only, no enforcement | |

**User's choice:** Branch protection

### Q4: /admin/evals UI depth

| Option | Description | Selected |
|--------|-------------|----------|
| Two pages: index + detail | Reuses Phase 4 shadcn Table + admin auth | ✓ |
| Index only | Less code; harder to investigate flaky cases | |
| Index + detail + calibrate | Same as recommended + calibration UI | |

**User's choice:** Index + detail
**Notes:** Calibrate page from harness Q8 still applies — total three pages (index, detail, calibrate). Synthesized in CONTEXT.md D-C-05.

---

## Backlog & Launch Sequence

### Q1: Phase 3+4 HUMAN-UAT handling (20 items)

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated 'pre-launch smoke' plan early in Phase 5 | First plan; surfaces blockers before eval is built | ✓ |
| Interleave into LAUNCH-06 pre-launch checklist (last plan) | Risk: build eval on top of buggy foundation | |
| Skip — only re-verify items eval exercises | Trust prior verification | |

**User's choice:** Dedicated pre-launch smoke plan first

### Q2: SAFE-12 (Anthropic org $20/mo cap) timing

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-launch checklist item in LAUNCH plan | Operational, blocking LAUNCH-06 | ✓ |
| Front-loaded — first plan in Phase 5 | Caps even dev runs | |
| Joe handles asynchronously, not in plan structure | No formal task | |

**User's choice:** Pre-launch checklist item

### Q3: Friend-test recruitment & flow (LAUNCH-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Joe-recruited, async link + 5-question Google Form | No scheduling overhead | ✓ |
| Live observation over Zoom | High signal, observer-effect risk | |
| Hybrid — 1 live, 2 async | Live for non-PM | |

**User's choice:** Async link + form

### Q4: Domain + QR + PDF + LinkedIn scheduling

| Option | Description | Selected |
|--------|-------------|----------|
| All in final 05-LAUNCH plan | Single plan; Joe sequences ops, plan structures verifications | ✓ |
| Domain decided in Phase 5 discuss now | Risk: no DNS info available | |
| Split: domain plan + QR/resume plan | More overhead for Joe-owned tasks | |

**User's choice:** All in final LAUNCH plan
**Notes:** Domain choice marked NEEDS-INPUT-AT-PLAN-TIME in CONTEXT.md Specifics.

---

## Claude's Discretion

- Specific cross-vendor judge model (GPT-4.1-mini vs Gemini 2.5 Flash) — picked by gsd-phase-researcher at planning time.
- Whether to add a 5th alarm condition for weekly-eval failure — planner's discretion.
- Detailed `eval_runs` / `eval_cases` / `eval_calibrations` column schema beyond the seed list.
- Plan numbering / wave structure (sequential single-developer pace; waves unlikely to add value).
- Whether the qrcode CLI generates PNG inline at launch or via `scripts/generate-qr.ts` helper.

## Deferred Ideas

- Multi-tester aggregation for cat 4 A/B (v2 query change).
- Custom domain beyond Vercel subdomain (LAUNCH-D1 / v2).
- Daily digest email (OBSV-D1 / v2).
- Weekly question-clustering job (OBSV-D2 / v2).
- End-of-session feedback prompt (OBSV-D3 / v2 — PROJECT.md drift).
- Cheaper-subset eval on PR (defer until cost actually concerns).
- Public token-gated /ab-test page (defer until friend-tester volume exceeds screen-sharing).
- Eval-failure alarm via Phase 4 dispatcher (planner's discretion).
