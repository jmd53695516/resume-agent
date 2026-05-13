---
phase: 06-kb-enrichment-about-me-hardening
plan: 05
status: complete
completed_at: 2026-05-13
tasks_completed: 3/3
durable_artifact: .planning/phases/06-kb-enrichment-about-me-hardening/06-05-FACTS-EXPANSION.md
new_ground_truth_entries: 11
voice_samples_added: 0
strategy: expand-existing
---

# Plan 06-05 Summary — cat1 ground_truth_facts expansion for Phase 06 new claims

## Outcome

[evals/cat-01-fabrication.yaml](../../../evals/cat-01-fabrication.yaml) expanded with 11 new `ground_truth_facts` entries across 3 existing cat1 cases. D-B-01 15/15 hard-gate invariant preserved (case count 15 → 15). kb/voice.md byte-identical (0 voice samples added; D-A-04 skip per planner default + Joe sign-off).

**Why this plan was critical:** The judge in cat1 is per-case-isolated — it grounds the agent's response against `ground_truth_facts` inside the case it's judging, nothing else. Phase 06 introduced 11 specific transcript-grounded claims into kb/about_me.md (UA Supply Chain War Room story, 9 personal traits including WOO, 3 default Joe-questions, 5-descriptor communication style including credibility-based, 5-element non-technical-user framework, servant-leadership framing, 5 product-energization examples, ghost models, 3 self-descriptors + AI PO target, 6-role roles-to-avoid). Without this expansion, Plan 06-06 cat1 judge would mis-grade Sonnet's correct citations of these claims as fabrication — the EXACT bug class Plan 05-12 Task 0 iter-2/iter-3 expansion solved (4 separate cases needed retroactive expansion then).

This plan applies the same pattern forward-leaning rather than reactively: 11 entries pre-loaded before Plan 06-06 verification runs cat1.

## Expansion by case

| case | pre | post | delta | claim cluster |
|---|---|---|---|---|
| cat1-fab-006 (UA $50M counterfactual-quantity trap) | 3 | 5 | +2 | UA Days-Forward-Coverage diagnosis + Supply Chain War Room responsibilities |
| cat1-fab-008 (persona-expert ML-engineer trap) | 3 | 8 | +5 | Personality traits (incl. WOO) + 3 default questions + comm-style 5-descriptor list (incl. credibility-based) + 5-element non-technical-user framework + servant-leadership framing |
| cat1-fab-014 (verifiable-easy SEI current product/positioning) | 12 | 16 | +4 | Product-energization framing + 5 examples + ghost models + 3 self-descriptors + 6-role roles-to-avoid list |
| **Total** | **18** | **29** | **+11** | |

## Tasks

| task | description | outcome |
|------|-------------|---------|
| 1 | Build facts-expansion plan | ✓ Committed `6804b67`. 11 new-claims rows mapped to 3 cases; voice-sample skip; expand-existing strategy. All 8 acceptance grep checks green. |
| 2 | Joe reviews + locks decisions | ✓ Committed `6f8ef6d`. APPROVED 2026-05-13 — planner defaults accepted as-is; no per-row overrides; no voice-sample expansion. |
| 3 | Apply YAML edits + verify | ✓ Committed `1b26ae6`. 3 splices applied at anchor lines 85/109/205; YAML parses cleanly as 15-element array; ground_truth_facts deltas confirmed (3→5, 3→8, 12→16); system-prompt 17/17 + cat1 13/13 + tsc + build all green. |

## Key design decisions made during execution

1. **Default to expand-existing, not add-new-case.** Phase 06 added biographical / personality / positioning content. Every new claim fit into one of 3 existing cases (cat1-fab-006 UA quantitative trap, cat1-fab-008 persona-expert, cat1-fab-014 verifiable-easy current product). No new fabrication-trap surface emerged. Strategy preserves the cleanly-passing 15/15 D-B-01 invariant — no CONTEXT D-F-02/03/04/05 amendments needed.

2. **Three target cases concentrate the expansion sensibly.** cat1-fab-006 catches UA-quantitative recovery; cat1-fab-008 catches PM-persona recovery (the ML-engineer trap prompt invites Sonnet to surface PM-shape + traits + questions + comm-style + leadership); cat1-fab-014 catches positioning recovery (the "what are you working on?" prompt invites broader product-energization + roles-to-avoid).

3. **WOO (Winning Others Over) was the priority cat1 entry.** Distinctive transcript-verbatim acronym (claim-044). If Sonnet correctly surfaces "I have WOO" on a personality prompt and the judge doesn't see it in ground_truth_facts, the judge calls it fabrication — that's the Plan 05-12 Task 0 lineage bug class.

4. **Voice-sample expansion deliberately skipped (D-A-04).** Phase 06 content came from a structured LLM file (post-strip + post-merge + post-voice-rewrite); no raw transcript turns with distinctive cadence not already in samples 1-12. D-A-04 is optional + additive — over-expanding kb/voice.md risks diluting its signal. The right time to add a voice sample is Phase 7+ when raw transcript turns surface from resume.md voice work.

5. **Lineage style matches Plan 05-12 Task 0 iter-2/iter-3.** Each new-entry group prefixed with a block comment referencing the kb/about_me.md source line + the "judge per-case-isolation false-positive fix" framing. Future plans cross-referencing why these entries exist can trace back to this lineage convention.

6. **No SKIPs requested by Joe.** Planner-default mapping accepted as-is. Compared to Plan 06-04 where Joe applied 4 surgical patches to Haiku's voice-rewrite output, Plan 06-05's planner-defaults aligned cleanly with Joe's reading of the cat1 case mappings.

## Pass-threshold verification

- Pre-Plan-06-05: D-B-01 hard gate = 15/15 cases pass on local eval + CI eval
- Post-Plan-06-05: 15 cases preserved; ground_truth_facts expansion is purely additive (existing entries unchanged; new entries appended within each case). Pass criterion identical: 15 of 15 cases must clear both deterministic name-token check AND LLM judge verdict
- CONTEXT D-F-02/03/04/05 references untouched (no amendments needed under expand-existing strategy)

## SAFE-11 determinism status

**PASS** on commit `1b26ae6`. 17/17 system-prompt tests green. kb/about_me.md / kb/voice.md / kb/profile.yml / kb/resume.md / kb/case_studies/* unchanged in this plan (D-C-01..03 honored — only evals/cat-01-fabrication.yaml modified, which is NOT in the cached system prompt).

## Artifacts

| path | purpose |
|---|---|
| [evals/cat-01-fabrication.yaml](../../../evals/cat-01-fabrication.yaml) | 15 cases / 29 ground_truth_facts entries (18 pre-Plan-06-05 + 11 new); committed `1b26ae6` |
| [.planning/phases/06-kb-enrichment-about-me-hardening/06-05-FACTS-EXPANSION.md](./06-05-FACTS-EXPANSION.md) | Per-claim audit trail (claim text, kb source line, target case mapping, YAML-edit preview); Joe-signed APPROVED |

## Commits

- `6804b67` docs(06-05): build 06-05-FACTS-EXPANSION.md (Task 1)
- `6f8ef6d` docs(06-05): Task 2 sign-off — facts expansion APPROVED as-is
- `1b26ae6` kb+evals(06-05): expand cat-01-fabrication ground_truth_facts per 06-05-FACTS-EXPANSION.md
- (this commit pending: SUMMARY + STATE + ROADMAP)

## Plan 06-06 readiness

Plan 06-06 (preview eval → promote → prod eval) inputs ready:

- [evals/cat-01-fabrication.yaml](../../../evals/cat-01-fabrication.yaml) frozen with full ground_truth_facts coverage for all Phase 06 new claims — the per-case-isolation false-positive bug class avoided ahead of time
- [kb/about_me.md](../../../kb/about_me.md) frozen at 1030 words / 16 content paragraphs / 4/5 voice-fidelity / banned-vocab 0/17 / SAFE-11 17/17 green
- All Phase 06 hard-deps satisfied:
  - D-A-05 (every new fact has cat1 ground_truth_facts coverage) — Plan 06-05 ✓
  - D-D-01 (eval-cli spend-cap exemption) — quick task 260512-tku ✓ (SAFETY_GATES_ENABLED kill-switch shipped)
  - D-A-04 (kb/voice.md additive expansion if needed) — skipped this round ✓
- Plan 06-06 Task 1 preflight gate: grep for spend-cap exemption + git-log preflight (per Plan 06-06 frontmatter must_have)
- Plan 06-06 sequence: preview cat1+cat4 → checkpoint:human-pick (Joe) → promote to prod → prod cat1+cat4

D-B-01 hard gate: cat1 = 15/15 on preview, 15/15 on prod. D-B-02 hard gate: cat4 ≥ 4.0 aggregate + per_case all pass.
