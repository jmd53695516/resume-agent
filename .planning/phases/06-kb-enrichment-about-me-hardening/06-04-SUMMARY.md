---
phase: 06-kb-enrichment-about-me-hardening
plan: 04
status: complete
completed_at: 2026-05-13
tasks_completed: 3/3
durable_artifact: .planning/phases/06-kb-enrichment-about-me-hardening/06-04-VOICE-REWRITE-REVIEW.md
patches_applied: 4
voice_fidelity_score: 4
total_haiku_cost_cents: 1.42
---

# Plan 06-04 Summary — Voice rewrite of merged kb/about_me.md content

## Outcome

The 6 new content chunks Plan 06-03 added to kb/about_me.md (P4 S3 augment + P7-P11 S6-S10 keep-as-net-new) were voice-rewritten from stripped 3rd-person Haiku output to 1st-person Joe-prose matching [kb/voice.md](../../../kb/voice.md) cadence. Existing T1/T2/T3/T4/T5 voice-true paragraphs (P1/P2/P3/P5/P6) stayed byte-identical pre/post — they were NEVER sent to Haiku per Task 2 scoping rule.

Joe-review at Task 3 flagged 6 specific claim-preservation regressions from Haiku's rewrite; Joe selected PATCHED verdict and applied the 4 strong patches inline (R1, R3, R5, R6). R2 + R4 (low-severity paraphrases) left as-is.

**kb/about_me.md final state:** 1030 words / ~1370 tokens / 16 content paragraphs. Banned-vocab 0/17 hits; SAFE-11 determinism preserved (17/17 system-prompt tests pass).

## Cost & velocity

| metric | value |
|---|---|
| Haiku spend | 1.42¢ total (6 calls × ~0.24¢ each — well under plan's 10-15¢ estimate) |
| Haiku per-call input | ~2400 tokens (small voice.md + small canonical pre-merge kb/about_me.md) |
| Haiku per-call output | ~60-150 tokens (matches passage length) |
| Wall-clock | ~30 sec per call × 6 = ~3 min total Haiku time |
| Joe-time | Task 3 review + verdict + 4 patches ~5 min |

The plan's 10-15¢ estimate baked in larger context assumption; actual context was minimal because voice.md is 690 words and pre-merge kb/about_me.md is 592 words.

## Tasks

| task | description | outcome |
|------|-------------|---------|
| 1 | Build `scripts/voice-rewrite.ts` (Haiku 4.5 voice-rewrite CLI) | ✓ Committed `5644386`. All 9 acceptance criteria green: tsc clean, strict argv `--bogus` exits non-zero, all required literal strings present. |
| 2 | Rewrite augmented/replaced sections of kb/about_me.md in place | ✓ Committed `de4391f`. 6 calls × Haiku 4.5; banned-vocab 0/17; 9/9 sampled claims preserved; 6 regressions flagged for Task 3. |
| 3 | Joe reviews voice-rewritten kb/about_me.md and signs off | ✓ Committed `4bc8a02`. Verdict=PATCHED (4 manual patches: R1 WOO + R3 credibility-based + R5 drop invented sentence + R6 servant leadership). Voice-fidelity 4/5. |

## Key design decisions made during execution

1. **Pre-merge canonical reference, not post-merge.** scripts/voice-rewrite.ts uses `--canonical` flag to read kb/about_me.md as the cadence-reference block in the Haiku system prompt. But the post-06-03-merge kb/about_me.md ALREADY contains the 3rd-person stripped passages we're trying to rewrite — using it as canonical would teach Haiku the 3rd-person voice. Solution: extracted `git show 9e58675^:kb/about_me.md` into `.canonical-pre-merge.tmp` (the 592-word voice-true pre-merge file) and passed THAT as `--canonical`. This avoids the contamination loop.

2. **One Haiku call per passage, not one call per file.** Six separate calls avoided cross-passage references and kept each rewrite focused. Total cost 1.42¢ vs ~0.5¢ for a single batched call — the difference is negligible at this scale and the per-passage approach makes Joe-review trivial (one chunk at a time).

3. **Task 2 applies Haiku output verbatim; Task 3 surfaces regressions.** I did NOT pre-patch the 6 regressions during Task 2 — that would have collapsed the "Haiku rewrite + Joe review" pattern into "Claude pre-fixes Haiku's mistakes". The plan's separation is deliberate: Task 2 is mechanical, Task 3 is the Joe-judgment gate.

4. **PATCHED was Joe's choice, RE-RUN was rejected.** Joe picked PATCH over RE-RUN-SECTION because (a) the 4 strong regressions were each a small surgical fix; (b) re-running risks Haiku making different mistakes (e.g., it might preserve servant leadership but invent something else); (c) PATCH gives Joe direct control over the canonical phrases.

5. **R2 + R4 intentionally left as paraphrases.** Joe judged them semantically faithful — "I genuinely connect with people" preserves claim-047's intent, and "I connect technical issues to what actually matters for the business" is idiomatic kb/voice.md cadence for claim-036. If Plan 06-06 cat4 LLM-judge flags these, they can be re-patched then; not a launch blocker.

6. **R5 (invented content) was the most concerning regression.** Haiku's "That's the move — know when to step back and let the specialist talk" sentence violated rule 1 (preserve claims; don't add). This is the cat1-hallucination risk class the plan's threat model T-06-04-01 specifically targets. The patch dropped the sentence; no compensation needed because the preceding sentence already conveyed the same idea ("I bring in the right person to handle it").

## Banned-vocab grep audit (post-patch, all 17 tokens)

| token | hits |
|---|---|
| transformative | 0 |
| innovative | 0 |
| leveraged | 0 |
| dynamic | 0 |
| robust | 0 |
| seamless | 0 |
| synergy | 0 |
| holistic | 0 |
| passionate | 0 |
| delve | 0 |
| elevate | 0 |
| Joe seems | 0 |
| Joe appears | 0 |
| Joe likely | 0 |
| Great question | 0 |
| I'd be happy to | 0 |
| At its core | 0 |

**PASS — 0/17 hits on final kb/about_me.md state.**

## Claim-preservation final pass

9/9 sampled claims preserved across the full rewrite + patch cycle. Specifically the 3 transcript-signature phrases that Haiku dropped were restored via Task 3 patches:

| claim | source | final-state survival |
|---|---|---|
| WOO (Winning Others Over) | claim-044, transcript line 30 verbatim | PRESERVED via R1 patch |
| credibility-based (5th comm-style descriptor) | claim-035 Joe-confirmed Yes-keep + consolidated-resume.md line 403 | PRESERVED via R3 patch |
| servant leadership (claim-028) | claim-028, transcript line 14 verbatim | PRESERVED via R6 patch |

## Voice-fidelity self-assessment

**Joe's score: 4/5** — Mostly Joe-voice, minor stiffness on some sentences. Cadence is right; tightness varies. Plan 06-06 cat4 LLM-judge expected to clear ≥4.0 aggregate threshold.

## SAFE-11 determinism status

**PASS** on commit `4bc8a02` (post-patch final state). 17/17 system-prompt tests green. D-B-04 CI determinism contract holds.

## Artifacts

| path | purpose |
|---|---|
| [scripts/voice-rewrite.ts](../../../scripts/voice-rewrite.ts) | Reusable Haiku 4.5 voice-rewrite CLI (committed `5644386`). Carries forward for Phase 7+ resume.md voice work per D-C-04 sequencing. |
| [kb/about_me.md](../../../kb/about_me.md) | Final content-true + voice-true state (1030 words; 16 content paragraphs); locked for Plan 06-05 (ground_truth_facts) and Plan 06-06 (preview/prod cat1+cat4 verification). |
| [.planning/phases/06-kb-enrichment-about-me-hardening/06-04-VOICE-REWRITE-REVIEW.md](./06-04-VOICE-REWRITE-REVIEW.md) | Durable Joe-sign-off audit trail: banned-vocab table, claim spot-check, 6 regressions + 4 patches applied, voice-fidelity score, PATCHED verdict, Joe signature. |

## Commits

- `5644386` feat(06-04): add scripts/voice-rewrite.ts — Haiku 4.5 voice-rewrite CLI
- `de4391f` kb(06-04): voice-rewrite augmented sections of kb/about_me.md per kb/voice.md cadence
- `4bc8a02` docs(06-04): Task 3 sign-off — voice rewrite PATCHED + approved (4/5 voice-fidelity)
- (this commit pending: SUMMARY + STATE + ROADMAP)

## Plan 06-05 readiness

Plan 06-05 (expand cat1 ground_truth_facts for new claims) inputs ready:

- [kb/about_me.md](../../../kb/about_me.md) frozen at 1030 words / 16 content paragraphs (this commit's final state)
- 6 new content chunks have new specific factual claims that need cat1 ground_truth_facts entries to prevent the Plan 05-12 Task 0 bug class (Sonnet correctly citing the new fact → cat1 judge mis-grading as fabrication because no ground_truth_facts entry exists):
  - **WOO (Winning Others Over)** — new ground-truth-fact for any cat1 case asking about personality traits
  - **servant leadership** — new ground-truth-fact for any leadership-style question
  - **credibility-based** comm-style descriptor — new ground-truth-fact for comm-style questions
  - **Days Forward Coverage / Supply Chain War Room** — new ground-truth-fact for UA case-study or differentiator questions
  - **"ghost models"** phrase — new ground-truth-fact for what-energizes-Joe questions
  - **"data cloud platform owner" / "business-to-technology translator" / "KPI storyteller"** — 3 self-descriptors new for positioning questions
- Plan 06-05 builds [evals/cat-01-fabrication.yaml](../../../evals/cat-01-fabrication.yaml) ground_truth_facts expansion + kb/voice.md sample expansion (if needed for cat4 ≥4.0 aggregate)

Plan 06-04 hard-dep (D-D-01 from CONTEXT) — eval-cli spend-cap exemption — already shipped in quick task 260512-tku (kill-switch). Plan 06-05 + 06-06 verification spend will not re-trip the 24h-rolling cap.
