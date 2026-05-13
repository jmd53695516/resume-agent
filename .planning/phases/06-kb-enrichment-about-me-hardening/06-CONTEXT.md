# Phase 06: KB enrichment — about-me hardening - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning
**Brainstorm:** 2026-05-12 EOD (post-incident); design approved by Joe inline

<domain>
## Phase Boundary

Take an LLM-written about-me .md file (produced by an external agent from an interview with Joe), strip its agent-introduced expansion, ground-truth every surviving claim against the interview transcript, voice-rewrite to match `kb/voice.md` cadence, and merge section-by-section into the existing `kb/about_me.md` — BEFORE broad distribution of the resume agent (QR paper print + LinkedIn push). Verification gates: cat1=15/15 zero-fabrication + cat4 aggregate avg >=4.0 voice fidelity, on preview then on prod.

**Why this is a phase, not a quick task:** The LLM-expanded source class is the same risk profile Joe explicitly held back at launch when offered a 775-line consolidated resume.md from a similar workflow. From `.planning/phases/05-eval-gates-launch/05-12-LAUNCH-CHECKLIST.md` (open follow-ups):

> "KB expansion (decimal phase 5.4 candidate): ... NOT merged tonight because the other agent (a) expanded beyond source material (cat1 fabrication risk: every expansion is a hallucination candidate) and (b) doesn't know Joe's terse-with-numbers voice (cat4 voice-fidelity regression risk). Future phase: treat the file as RAW source, strip agent expansion, rewrite verified claims in Joe's voice, expand cat1 ground_truth_facts to cover, re-verify cat1+cat4 on prod before merge."

Same handling pattern applies here.

**Why integer Phase 6 (not decimal 5.3):** The decimal convention in this project's ROADMAP is reserved for **urgent reactive insertions** (Phase 05.1 reacted to eval failing on real signal; Phase 05.2 reacted to a UI-debt finding pre-launch). This phase is **planned next-step work** Joe is initiating proactively, not a reaction to a found defect. Integer numbering is the honest representation per ROADMAP.md:13-14 convention.

**Why this is still v1.0 (not v1.1):** v1.0's milestone goal is "publicly linked, eval-gated chat agent attached to Joe's resume." The agent is live on prod (2026-05-11) but broad distribution has not started — QR is not printed, LinkedIn-link is not pushed, friend-test responses (Plan 05-12 sign-off) have not returned. KB enrichment in this window is **pre-distribution polish on the v1.0 artifact**, which fits inside v1.0's goal. v1.0 closes when broad distribution begins, not when Plan 05-12 marks sign-off internally. Joe locked this framing during the 2026-05-12 brainstorm.

**What this phase delivers:**
1. An updated `kb/about_me.md` that incorporates verified, voice-true content from the interview-derived LLM source — merged section-by-section into the existing file (not file-replacement)
2. Expanded `evals/cat-01-fabrication.yaml` `ground_truth_facts` covering any new specific factual claims introduced by the merge
3. Optionally 1-2 new voice samples in `kb/voice.md` if the interview transcript surfaced quote-worthy turns of phrase not already represented
4. Cat1 = 15/15 on **prod** post-merge (re-verification)
5. Cat4 aggregate avg >=4.0 + per_case all pass on **prod** post-merge (re-verification)

**What this phase does NOT change:**
- `/api/chat/route.ts` (Phase 02 D-G-01..05 byte-identical contract preserved)
- `src/lib/kb-loader.ts`, `src/lib/system-prompt.ts` assembly logic (D-E-01..05 deterministic assembly preserved)
- `src/lib/classifier.ts` (Phase 05.1 Item #8 + Plan 05-12 Task 0 classifier tune preserved)
- Any UI component
- Any infra config
- The 775-line resume.md (held back from this phase; see D-C-04)

</domain>

<decisions>
## Implementation Decisions

### D-A: Scope Items (locked)

- **D-A-01:** Source file: the LLM-written about-me .md Joe holds locally (interview-derived, agent-produced prose). Will be staged into `.planning/phases/06-kb-enrichment-about-me-hardening/source/` as raw input. NOT directly written into `kb/`.
- **D-A-02:** Ground-truth source: the interview transcript or recording (Joe confirmed available during 2026-05-12 brainstorm). Every claim that survives into `kb/about_me.md` MUST trace to a transcript quote or established prior-KB fact. No exceptions.
- **D-A-03:** Merge target: existing `kb/about_me.md` (NOT a new file). Section-by-section **keep / augment / replace** decisions; no wholesale file overwrite. `keep` = leave existing kb/about_me.md section unchanged, discard LLM content for this section; `augment` = add LLM content alongside existing; `replace` = LLM content supersedes existing for this section. Joe approves each section's disposition before merge.
- **D-A-04:** Optional voice-sample expansion: `kb/voice.md` may receive 1-2 new samples IF the transcript surfaced quote-worthy Joe-language not already represented in the existing 8-12 samples. Adds, never removes.
- **D-A-05:** Cat1 ground_truth_facts expansion: any specific factual claim introduced by the merge (employer name, team size, metric, role, dates, technology) gets a matching entry in `evals/cat-01-fabrication.yaml`'s `ground_truth_facts:` set. Otherwise the cat1 judge will mis-grade Sonnet's correct restatement as fabrication.

### D-B: Workflow Decisions

- **D-B-01:** Six-plan workflow across three waves (see Phase Workflow section below).
- **D-B-02:** Joe-approval gates: Plans 06-02 (post-strip), 06-03 (per-section merge), 06-04 (post-voice-rewrite) are explicit human-in-the-loop checkpoints. Plans 06-01 (intake), 06-05 (cat1 facts expansion), 06-06 (verification) are tool-automated with Joe reviewing output but not gating per-line.
- **D-B-03:** Verification cycle order: preview eval first → Joe reviews preview eval_runs row → promote to prod → prod eval → Joe reviews prod eval_runs row → mark complete. NEVER promote-then-test.
- **D-B-04:** Determinism contract preserved: the existing system-prompt byte-identical determinism test (`src/lib/system-prompt.test.ts`) runs in CI and on every push; any per-request data leaking into the cached prefix fails loudly. No need to add new determinism scaffolding.

### D-C: Scope Boundaries (out of scope)

- **D-C-01:** `/api/chat/route.ts` is out of scope. Phase 02 D-G-01..05 byte-identical contract is preserved.
- **D-C-02:** `src/lib/kb-loader.ts` and `src/lib/system-prompt.ts` assembly logic are out of scope. KB content changes flow through their existing assembly path; no logic edits.
- **D-C-03:** UI, infra, env vars, package.json, CI workflows, alarms, cron are all out of scope.
- **D-C-04:** The 775-line consolidated resume.md (held back at launch per LAUNCH-CHECKLIST line referenced above) is OUT of scope for Phase 6. It will be addressed separately — likely as Phase 7 (sequential under v1.0) or as Phase 1 of v1.1, depending on Joe's preference when that work becomes decision-ready. Rationale for sequencing: the resume work has an unresolved upstream decision ("feed original Word docs vs. agent expansion") that the about_me work does not.

### D-D: Dependencies (hard)

- **D-D-01:** Tomorrow's eval-cli spend-cap exemption fix (incident follow-up from 2026-05-12) MUST land before any Phase 6 verification eval is run against prod. A full cat1+cat4 prod eval costs roughly $2-3, which would re-trip the same 24h-rolling cap that caused today's silent-lockout incident. Sequencing: incident-followup fix → Phase 6 work → Phase 6 verification.
- **D-D-02:** Tomorrow's alarm cron wiring (incident follow-up #2) SHOULD land before Phase 6 verification. Not strictly blocking, but without the cron-job.org alarm schedule wired, any future cap trip during Phase 6 work would be silent again (same failure mode as today). Recommend wiring this in the same incident-followup session.
- **D-D-03:** Plan 05-12 friend-test sign-off does NOT block this phase, and this phase does not block friend-test responses (the form is already live, DMs sent). Recommended sequencing: ship Phase 6 → re-DM friends with the enriched artifact → collect responses on the enriched artifact. Acceptable alternative: collect responses on the current artifact and treat Phase 6 as post-friend-test enrichment (Joe-decided).

### D-E: Risk Mitigations

- **D-E-01:** Cat1 fabrication regression — mitigated by D-A-02 (transcript ground-truth gate) + D-A-05 (ground_truth_facts expansion). Any claim that cannot trace to transcript or prior KB is stripped at Plan 06-02 before merge.
- **D-E-02:** Cat4 voice regression — mitigated by Plan 06-04 voice rewrite pass + Plan 06-06 cat4 judge gate (>=4.0 aggregate, per_case all pass). Verbal hedges, corporate phrasing, and adjective stacks ("transformative," "innovative," etc.) are stripped at Plan 06-02; surviving content is rewritten to match `kb/voice.md` cadence.
- **D-E-03:** SAFE-11 determinism break — mitigated by D-B-04 (existing CI determinism test catches per-request data leaks). KB content additions are static text in the cached prefix; no per-request data path exists in the merge surface.
- **D-E-04:** Spend cap re-trip during verification — mitigated by D-D-01 (incident-followup fix must land first).
- **D-E-05:** Silent verification failure (alarm doesn't fire) — mitigated by D-D-02 (alarm cron wired before this phase's verification run).
- **D-E-06:** LLM expansion smuggles in interview-adjacent inferences ("Joe seems energized when discussing X" — projection beyond what Joe actually said) — mitigated by D-A-02 (transcript-only ground truth) + Plan 06-02 (strip pass explicitly removes projections, characterizations, and observer-voice).

### D-F: Success Criteria (Phase 6 closes when ALL true)

- **D-F-01:** `kb/about_me.md` merged content reviewed and Joe-signed (per Plan 06-03 checkpoint).
- **D-F-02:** Cat1 = 15/15 on **preview** ✓ (Plan 06-06 first verification).
- **D-F-03:** Cat1 = 15/15 on **prod** ✓ (Plan 06-06 second verification after promote).
- **D-F-04:** Cat4 aggregate avg >=4.0 + `per_case all pass` on **preview** ✓ (Plan 06-06 first verification).
- **D-F-05:** Cat4 aggregate avg >=4.0 + `per_case all pass` on **prod** ✓ (Plan 06-06 second verification after promote).
- **D-F-06:** System-prompt determinism test green (CI pass on the merge commit).
- **D-F-07:** ROADMAP.md updated with Phase 6 completion; STATE.md `## Progress` reflects 6/6 phases done; Phase 6 SUMMARY committed.
- **D-F-08:** Two preview + two prod eval_runs row IDs recorded in Phase 6 SUMMARY for future audit (matches Plan 05-12 LAUNCH-CHECKLIST format).

</decisions>

<workflow>
## Phase Workflow (6 plans, 3 waves)

| # | Plan | Wave | Joe-time | Output |
|---|------|------|----------|--------|
| 06-01 | **Intake** — stage the LLM about-me file into `.planning/phases/06-kb-enrichment-about-me-hardening/source/llm-about-me.md`; transcribe interview transcript/recording into `.planning/phases/06-kb-enrichment-about-me-hardening/source/transcript.md`; produce a per-claim diff matrix (each claim in LLM file → matching transcript quote OR "no source" flag) | 1 | ~30 min Joe review of diff matrix | `source/llm-about-me.md`, `source/transcript.md`, `06-01-CLAIM-MATRIX.md` |
| 06-02 | **Strip agent expansion** — mechanical pass over the LLM file removing hedges, adjective stacks, corporate phrasing, observer-voice, and any claim flagged "no source" in the diff matrix | 1 | ~15 min Joe review of stripped output | `source/llm-about-me.stripped.md` (Joe-approved) |
| 06-03 | **Section-by-section merge into `kb/about_me.md`** — present each section of the stripped file alongside the existing `kb/about_me.md` content covering the same topic; Joe decides keep / replace / append per section; merge tool applies decisions | 2 | ~60-90 min Joe-time (this is the biggest time cost) | Updated `kb/about_me.md` (Joe-signed per-section) |
| 06-04 | **Voice rewrite** — surviving claims rewritten to match `kb/voice.md` cadence (terse, numbers-forward, no adjective stacks); Joe approves rewritten passages | 2 | ~30 min Joe review of rewritten output | Updated `kb/about_me.md` (voice-true) |
| 06-05 | **Expand cat1 `ground_truth_facts`** — extract every new specific factual claim from the merged `kb/about_me.md`; add matching `ground_truth_facts:` entries in `evals/cat-01-fabrication.yaml`; optionally add 1-2 voice samples to `kb/voice.md` if transcript surfaced new quote-worthy turns | 3 | ~15 min Joe review of facts list | Updated `evals/cat-01-fabrication.yaml`, optionally updated `kb/voice.md` |
| 06-06 | **Verify** — run cat1 + cat4 against **preview** deploy; Joe reviews eval_runs row; promote to prod ONLY if both gates green; run cat1 + cat4 against **prod**; Joe reviews prod eval_runs row | 3 | ~10 min Joe monitor + decision-gate at promote step | Two preview eval_runs row IDs + two prod eval_runs row IDs; Phase 6 SUMMARY written |

**Total Joe-time estimate:** ~3-4 hours focused work over 1-2 days, dominated by the Plan 06-03 section-by-section merge.

**Total verification spend estimate:** roughly $4-6 (two cat1 runs at ~$1.50 each + two cat4 runs at ~$1 each = ~$5; preview + prod). Must NOT run until D-D-01 (eval-cli spend-cap exemption) lands.

</workflow>

<lineage>
## Lineage / Cross-References

- **Brainstorm session:** 2026-05-12 EOD, conducted post spend-cap incident resolution. Joe selected:
  - Source class: "Agent / LLM wrote it up" (highest-risk category)
  - Verification source: "Interview transcript / recording" (highest fidelity)
  - Merge relationship: "Augments / interleaves" with existing `kb/about_me.md`
  - Milestone fit: Phase 6 of v1.0 (not Phase 5.3 decimal, not v1.1 Phase 1)
- **Convention reference:** [.planning/ROADMAP.md:13-14](../../ROADMAP.md) — integer phases are planned milestone work; decimal phases are urgent reactive insertions
- **Precedent for KB-expansion workflow:** [.planning/phases/05-eval-gates-launch/05-12-LAUNCH-CHECKLIST.md](../05-eval-gates-launch/05-12-LAUNCH-CHECKLIST.md) "Open follow-ups → KB expansion (decimal phase 5.4 candidate)" — same handling pattern, different source file
- **Incident lineage:** [Memory project_spend_cap_incident_2026-05-12.md](../../../C:/Users/joedo/.claude/projects/c--Users-joedo-Documents-Python-Scripts-Agent-For-Interviews/memory/project_spend_cap_incident_2026-05-12.md) — Phase 6 verification spend is exactly the kind of usage that re-trips the cap; this is why D-D-01 is a hard dependency
- **Determinism contract:** Phase 1 (`SAFE-11`, `CHAT-03/04/05`) — preserved end-to-end; CI determinism test catches violations

</lineage>

<open_questions>
## Open Questions (resolve during planning, NOT here)

- **OQ-01:** Exact path for staging the source files — `.planning/phases/06-.../source/` is the proposed location; planning may choose differently (e.g., a private/gitignored staging area if the transcript contains content Joe doesn't want committed). Plan 06-01 will resolve.
- **OQ-02:** Tool-assisted strip pass in Plan 06-02 — should this use a Haiku 4.5 call with a "remove hedges, projections, agent voice" system prompt, or should it be a manual diff Joe applies? Planning will weigh cost (~5¢ Haiku call vs Joe-time) against control (LLM strip may itself drift). Tentative recommendation: Haiku-assisted draft + Joe review, since this is the bulk-mechanical work where Haiku's strengths apply.
- **OQ-03:** Whether to gate Plan 06-06 on a fresh post-`kb/voice.md`-edit voice-blind-A-B run (Plan 05-08 pattern) — only relevant if D-A-04 surfaces new voice samples that materially shift the voice-rewrite baseline. Default: skip; cat4 LLM judge gate is sufficient.
- **OQ-04:** Decision-point for whether friend-test resume happens pre- or post-Phase-6 — D-D-03 leaves this open; Joe will pick during Plan 06-01 close-out or earlier.

</open_questions>
