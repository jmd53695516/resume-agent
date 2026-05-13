---
phase: 06-kb-enrichment-about-me-hardening
plan: 01
status: complete
completed_at: 2026-05-13
tasks_completed: 3/3
durable_artifact: .planning/phases/06-kb-enrichment-about-me-hardening/06-01-CLAIM-MATRIX.md
---

# Plan 06-01 Summary — LLM about-me → ground-truth claim matrix

## Outcome

Plan 06-01 produced a per-claim diff matrix mapping every factual claim in `docs/transcripts/06-about-me/llm-about-me.md` (933 lines, gitignored) to one of: transcript quote, existing kb/ fact, or `no_source` flag. The matrix is the auditable input for Plan 06-02's strip pass.

**Headline stats (post-re-grade with consolidated-resume.md):**
- 142 claims extracted
- 75 keep (53%) — survive into kb/about_me.md merge in Plan 06-03
- 49 strip (35%) — LLM-coined positioning labels, adjective filler, downstream framing
- 9 meta (6%) — agent direction, not factual claims
- 0 verify-with-joe (all 13 originally borderline items resolved: 11 flipped to keep via consolidated-resume; 3 Joe-confirmed yes-keep; 1 Joe-confirmed via re-grading)

## What changed mid-plan: consolidated-resume.md added as tertiary source

Initial matrix was built against transcript + kb/ + evals/cat-01-fabrication.yaml. After Task 2 closed, Joe staged a second LLM source — `consolidated-resume.md` (680 lines, 10+ historical resumes consolidated by another LLM) — and requested it be used as additional ground-truth before Task 3 Q&A.

Re-grading impact: **13 items flipped** (11 verify-with-joe → keep; 1 strip → keep; 1 strip → verify-with-joe → then Joe-confirmed keep). The verify-with-joe pile compressed from 13 → 3 → 0.

This validated a structural insight: the two LLM sources (about-me + consolidated-resume) **corroborate each other** on positioning Joe is comfortable with — particularly the 9 target roles. kb/profile.yml's 3-role list is the narrowest of the three sources and should be updated in Plan 06-03 to match.

## Top-5 surprising findings

1. **kb/profile.yml is narrower than both LLM sources on target roles**. About-me lists 9; consolidated-resume lists 9; profile.yml lists 3. Cross-LLM corroboration unlocked the flip of 5 verify-with-joe target-role items to keep. profile.yml needs an update in Plan 06-03 (or earlier).

2. **LLM-coined positioning labels Joe never used still got stripped** even with both LLM sources available: "strategic analytics leader" (claim-005) and "AI-enabled analytics product owner" (claim-006) appear in NEITHER consolidated-resume NOR transcript. Pattern: LLM expansions stack adjectives ahead of canonical labels. Cat4 voice-fidelity regression risk — Plan 06-04 voice-rewrite must catch these.

3. **The consolidated resume surfaces NEW facts the LLM about-me never mentions** (16 facts catalogued in matrix's "Net-new facts" section). Most notable: JMD Ventures self-employed period (June 2023 – March 2024), 6% NPS lift via Gap loyalty analytics, MicroStrategy data dictionary serving 1,000+ users at Gap, $45M product-dev/vendor savings at UA, 150+ users at UA BI Office Hours, $750K Sensodyne savings at GSK, Lockheed "100-day strike" + leadership award, UA product launches (The Rock, Steph Curry, Lindsey Vonn collections), Master of Supply Chain Management credential (with verification caveat). **Out of scope for Plan 06-01** — these are the payload for the follow-on phase merging resume content into kb/.

4. **The consolidated resume self-flags caveats** Plan 06-04 voice-rewriting must honor: $85M pricing is **projected** (not realized); $45M product-dev/vendor savings frame as "visibility into projected or identified" unless verified; Master degree appears in earlier resumes — confirm before external use; don't overstate direct people management beyond documented examples (mentored 3 senior analysts at Gap; promoted 2 analysts at UA; 30 global teammates coordinated). Current kb/about_me.md lacks this nuance.

5. **The LLM added a "third question Joe asks" (claim-052: 'What decision are we actually trying to make?')** that's in NEITHER transcript NOR either resume — purely LLM expansion. Joe-confirmed via Task 3 that he does ask this, so it stays `keep`. **Notable as a model behavior**: LLM correctly pattern-matched Joe's style (similar to his two transcript questions) even without direct source support. This pattern is exactly what HALLUCINATION_RULES in src/lib/system-prompt.ts is supposed to catch — a "plausible expansion" that happens to be accurate. Good data point for cat1 fabrication eval calibration.

## OQ-04 Friend-test sequencing decision

**Option A locked**: Re-DM friend-testers AFTER Phase 6 ships. The friends evaluate the enriched v1.0, not the pre-enrichment snapshot.

**Implication for Plan 05-12 / v1.0 milestone:** Plan 05-12 sign-off is BLOCKED until Phase 6 ships AND friend-testers respond on the enriched artifact. Current Google Form responses (if any arrive) are early-signal / informational only. After Phase 6 ships, re-send the form to the same 3 testers (or expand) for canonical pre-distribution evaluation.

## Scope decision: consolidated-resume.md → follow-on phase

Per Joe's scope answer 2026-05-13: **Both** — use consolidated-resume as ground-truth NOW (done in this plan), AND eventually merge its content into kb/ as a follow-on phase. The "Net-new facts from consolidated-resume.md" section in the matrix (16 fact rows + caveats) is the payload spec for that follow-on phase.

Follow-on phase scope (NOT this Phase 6; sequenced separately):
- Phase number TBD (Phase 7 likely, OR a decimal 6.x if it logically chains to Phase 6 close-out)
- Process resume content through similar pipeline: strip → voice-rewrite → merge into kb/ (mainly kb/resume.md + kb/about_me.md + kb/profile.yml expansions)
- Update kb/profile.yml target_roles[] to match the 9-role list both LLM sources corroborate

## Artifacts

| path | purpose |
|---|---|
| `.planning/phases/06-kb-enrichment-about-me-hardening/06-01-CLAIM-MATRIX.md` | The matrix — 142 graded claims + 16 resume-only facts catalog + caveats |
| `docs/transcripts/06-about-me/llm-about-me.md` | (gitignored) source LLM-written about-me file Joe staged |
| `docs/transcripts/06-about-me/transcript.md` | (gitignored) interview transcript ground-truth source |
| `docs/transcripts/06-about-me/consolidated-resume.md` | (gitignored) LLM-consolidated multi-resume file Joe staged mid-plan |

## Commits

- `72f9165` docs(06-01): build claim matrix — 142 claims extracted (60 keep / 51 strip / 22 verify / 9 meta)
- `171c3b8` docs(06-01): re-grade matrix against consolidated-resume.md (13 flips); add resume-only facts list for follow-on phase
- (this SUMMARY commit forthcoming)

## Plan 06-02 readiness

Plan 06-02 (strip agent expansion) can now proceed:
- Strip targets are the 49 claims marked `strip` in the matrix (LLM-coined labels, adjective filler, downstream framing)
- The 9 meta claims (agent direction) are also NOT migrated regardless
- Keep targets are the 75 claims marked `keep` — these survive into the 06-03 merge into kb/about_me.md
- Plan 06-04 (voice rewrite) inherits the resume self-flagged caveats above
- Plan 06-05 (cat1 ground_truth_facts expansion) inherits the new specific factual claims from the keep set
