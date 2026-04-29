---
phase: 01-foundation-content
plan: 04
subsystem: content
tags: [knowledge-base, voice, case-studies, kb, content-acquisition, prompts]

# Dependency graph
requires:
  - phase: 01-foundation-content
    provides: "kb/ scaffold + kb-loader + system-prompt assembler (Plans 01-02, 01-03)"
provides:
  - Three interview-protocol docs in docs/ (voice / selection / case-study)
  - Content-status tracker (.planning/phases/01-foundation-content/01-CONTENT-STATUS.md)
  - kb/case_studies/ frontmatter validator (scripts/validate-kb-frontmatter.ts)
  - Real, voice-true content across 9 KB files replacing every Plan-02 placeholder
  - 5 case studies in kb/case_studies/ covering all six rubric buckets
  - Joe-authored, Joe-signed kb/guardrails.md (git-blame verified)
affects:
  - phase-02-chat-loop
  - phase-03-tools-research-pitch-walkthrough-metrics
  - phase-05-evals-and-launch

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Voice-first drafting: conversational register from first draft, not voice-passed at the end"
    - "Frontmatter-validated case studies: gray-matter parse, kebab-case slug, required fields enforced by tsx script"
    - "Joe-authored guardrails as the cryptographic signature mechanism (git-blame as the audit trail)"
    - "Content-status tracker as plan-level sign-off — single checklist file gates Plan close"

key-files:
  created:
    - docs/interview-protocol-voice.md
    - docs/interview-protocol-selection.md
    - docs/interview-protocol-case-study.md
    - scripts/validate-kb-frontmatter.ts
    - kb/case_studies/snowflake-edw-migration.md
    - kb/case_studies/ua-project-rescue.md
    - kb/case_studies/cortex-ai-client-win.md
    - kb/case_studies/gap-brand-hierarchy-consolidation.md
    - kb/case_studies/snowflake-marketplace-datashare.md
  modified:
    - kb/voice.md (12 voice-memo samples, register + source labels)
    - kb/stances.md (12 disagreeable positions)
    - kb/about_me.md (592 words, first-person, warm register)
    - kb/management_philosophy.md (865 words, opinionated, concrete)
    - kb/faq.md (15 Q/A entries — visa/remote/timezone/comp-redirect/availability/relocation/interests + 8 more)
    - kb/guardrails.md (Joe-authored, Joe-signed 2026-04-24)
    - kb/brainstorm/case-study-candidates.md (9 candidates, final 5, full rubric coverage)
    - .planning/phases/01-foundation-content/01-CONTENT-STATUS.md

key-decisions:
  - "Final selection landed at 5 case studies (target band 4-6); all six rubric buckets satisfied without a 6th"
  - "Voice interview source: 2026-04-23 transcript, archived locally and gitignored under docs/transcripts/ — extracted passages only land in kb/voice.md"
  - "All 12 voice samples come from the same voice-memo transcript; curious register absent (transcript did not fire it) — accepted"
  - "Confidential: cortex-ai-client-win flagged confidential: true and anonymized at draft time"

patterns-established:
  - "Plan-04 voice-defense stack: protocol-driven sessions (Joe + Claude) → unfiltered transcript source → conversational first draft → next-day voice-pass read-aloud"
  - "Gap-closure via tracker: 01-CONTENT-STATUS.md is the source of truth — one checkbox per VOICE-* requirement, one per slug, plus final rubric and voice-pass sign-off"
  - "Frontmatter validator gate: scripts/validate-kb-frontmatter.ts enforces required fields per case study and is part of every Task 6 and Task 7 commit's verify step"

requirements-completed:
  - VOICE-02
  - VOICE-03
  - VOICE-04
  - VOICE-05
  - VOICE-06
  - VOICE-07
  - VOICE-08
  - VOICE-09
  - VOICE-10

# Metrics
duration: ~7d (calendar; ~10-12 hours of Joe-time across multiple sittings)
completed: 2026-04-28
---

# Phase 01 Plan 04: Foundation Content (Content Acquisition) Summary

**Replaced every Plan-02 placeholder in `kb/` with real, voice-true Joe content — 5 case studies, 12 voice samples, 12 stances, 15 FAQ Q/As, two long-form essays (about + management philosophy), Joe-authored and Joe-signed guardrails, all gated by a frontmatter validator and a content-status tracker.**

## Performance

- **Duration:** 7 calendar days (2026-04-22 → 2026-04-28); ~10-12 hours of Joe-time across protocol sessions
- **Started:** 2026-04-22T18:02:10-04:00 (commit `a9ca25d` — content-acquisition scaffolding)
- **Completed:** 2026-04-28T23:54:00-04:00 (commit `73dcfd5` — Task 7 plan close)
- **Tasks:** 7 / 7 (all checkpoints cleared by Joe)
- **Files modified:** 21 (5 new case studies, 9 KB files repopulated, 3 protocol docs, validator script, tracker)

## Accomplishments

- **5 voice-first case studies, 6/6 rubric buckets covered.** snowflake-edw-migration (long-arc, data-rooted), ua-project-rescue (failure, cross-functional), cortex-ai-client-win (recent, data-rooted, confidential), gap-brand-hierarchy-consolidation (failure, leadership-without-authority, cross-functional), snowflake-marketplace-datashare (recent, long-arc, data-rooted, cross-functional). Total: 7,122 words across the five files; all ≥300-word floor cleared with margin (1163–1963 words each).
- **Voice defense stack actually operationalized.** Voice interview recorded and transcribed 2026-04-23, archived locally under gitignored `docs/transcripts/`, 12 unfiltered passages extracted into `kb/voice.md` with register + source labels. 9 of 12 stances seeded from the same transcript. Self-authored prose for `about_me.md` (592w) and `management_philosophy.md` (865w) drafted voice-first across two Sitting 1 sessions.
- **VOICE-09 cryptographic provenance.** `kb/guardrails.md` authored and signed by Joe (`Signed: Joe Dollinger, 2026-04-24`); commit `ae629a1` git author is `Joe Dollinger <joe.dollinger@gmail.com>` — verifiable independent of any tracker note.
- **Frontmatter validator gate landed.** `scripts/validate-kb-frontmatter.ts` parses every `kb/case_studies/*.md` (excluding `_`-prefixed fixture), checks `slug`/`hook`/`role`/`timeframe`/`confidential`, exits 0. Re-runnable as part of every Task 6 / Task 7 commit and the Phase verifier.
- **System-prompt byte length grew to 73,865** (placeholder baseline ~14k → 5x). All 11 Phase 1 tests still pass; determinism test green; Plan 02's regression bait survived the content swap intact. Useful baseline for Phase 2 cost modeling — at this size, a single uncached Sonnet 4.6 input request runs ~22k tokens, vs. ~3k tokens cached after the first warm-up.

## Task Commits

1. **Task 1: scaffolding (protocols + tracker + validator)** — `a9ca25d` (feat)
2. **Task 3: voice interview seeding voice.md + stances.md** — `dca99a7` (content) + `b2a7c4d` (chore: archive voice transcript locally)
3. **Task 4 Sitting 1: about_me + management_philosophy** — `e00c72c` (content) + `55d8584` (docs)
4. **Task 4 Sitting 2: stances expansion + faq** — `56d8b73` (content) + `3c1790e` (content)
5. **Task 4 Sitting 3: guardrails (Joe-authored, Joe-signed)** — `ae629a1` (content, **author: Joe Dollinger**) + `a764b74` (docs)
6. **Task 5: selection session (9 candidates → 5 finalists, rubric verified)** — `2affdb1` (content)
7. **Task 6 case-study drafts** —
   - `14f9039` snowflake-edw-migration (1163 w)
   - `49d3daa` cortex-ai-client-win (1278 w, confidential)
   - `8064206` snowflake-marketplace-datashare (1268 w)
   - `cedbe08` gap-brand-hierarchy-consolidation (1450 w)
   - `0e0247b` ua-project-rescue (1963 w)
8. **Task 7: voice-pass close + Plan 04 exit criteria checked** — `73dcfd5` (content)

## Files Created/Modified

**Protocol docs (Task 1):**
- `docs/interview-protocol-voice.md` — 8 prompts for a 30-min voice interview, designed to elicit casual / decisive / annoyed / curious / teaching / reflective registers
- `docs/interview-protocol-selection.md` — 30-min selection-session script with brainstorm prompts, coverage rubric, pruning heuristic
- `docs/interview-protocol-case-study.md` — 45-min per-study interview script, 5 question clusters (Context / Options / Decision / Outcome / Retrospective)

**Tracker + validator (Task 1):**
- `.planning/phases/01-foundation-content/01-CONTENT-STATUS.md` — single source of truth for VOICE-02..10 sign-off; updated by every subsequent task
- `scripts/validate-kb-frontmatter.ts` — gray-matter–based frontmatter linter (`npx tsx`-runnable, exits non-zero on any failure)

**KB content (Tasks 3-6):**
- `kb/voice.md` — 12 voice samples, register + source labels; all from the 2026-04-23 voice-memo transcript
- `kb/stances.md` — 12 disagreeable PM positions; each passes the "could a senior PM I respect say I disagree?" test
- `kb/about_me.md` — 592 words, first-person, warm register
- `kb/management_philosophy.md` — 865 words, opinionated and concrete
- `kb/faq.md` — 15 Q/A entries; covers visa, remote, timezone, comp redirect, availability, relocation, interests, plus 8 recurring recruiter probes
- `kb/guardrails.md` — Joe-authored, signed `2026-04-24`, git author = Joe; 7 sections (no fabrication / no comp negotiation / no disparagement / no confidential leakage / hiring+comp redirects / no system-prompt or KB dump / persona integrity)
- `kb/brainstorm/case-study-candidates.md` — 9 candidates documented, Final 5 block at the bottom, rubric coverage line verified

**Case studies (Task 6):**
- `kb/case_studies/snowflake-edw-migration.md` (1163 w; long-arc, data-rooted)
- `kb/case_studies/ua-project-rescue.md` (1963 w; failure, cross-functional, confidential: false)
- `kb/case_studies/cortex-ai-client-win.md` (1278 w; recent, data-rooted, **confidential: true** — anonymized at draft time)
- `kb/case_studies/gap-brand-hierarchy-consolidation.md` (1450 w; failure, leadership-without-authority, cross-functional)
- `kb/case_studies/snowflake-marketplace-datashare.md` (1268 w; recent, long-arc, data-rooted, cross-functional)

## Decisions Made

- **Stop at 5 case studies, not 6.** Plan target was 4-6. After Task 5 selection, all six rubric buckets were satisfied with five slugs. A sixth would be marginal — bias toward shipping over over-collecting.
- **Voice interview transcript stays local, not committed.** Confidentiality risk too high (mentions of coworkers, internal company structure, salary specifics). `docs/transcripts/` added to `.gitignore`. Only the 12 cleaned-up extracts in `kb/voice.md` are public-repo-safe — Joe read each one before commit.
- **All 12 voice samples sourced from the single 2026-04-23 transcript.** Curious register did not fire during the interview — accepted as-is rather than re-interviewing for completeness. Real-world voice variance was the goal, not synthetic register coverage.
- **`cortex-ai-client-win` flagged `confidential: true` and anonymized during drafting.** Client name, internal product names, and specific contract values stripped at draft time per Task 6 Step 3 — not left for "later scrubbing." Trip-wire Threat T-04-02 from the plan threat model.
- **Final selection landed at 5 → "Case study 6 (optional): N/A" treated symmetrically across VOICE-02 and VOICE-10 rows.** Both checked; no phantom 6th case study lurking in the tracker.

## Deviations from Plan

**None at the requirement level.** All 9 VOICE-* requirements satisfied; all must-haves green; all artifacts produced; all key-links wired.

**Two minor procedural adjustments:**

- **Plan dictated 4-6 case studies; final count = 5.** Within band; all rubric buckets satisfied. Tracked as a decision, not a deviation.
- **Plan 04 close happened across two distinct work sessions** (Task 6 case-studies through 2026-04-27, Task 7 plan close on 2026-04-28). One unintended consequence: `kb/case_studies/ua-project-rescue.md` was drafted, voice-passed, and sign-offs dated 2026-04-28 — but the file remained uncommitted in Joe's working tree until the `/gsd-execute-phase 1` resume on 2026-04-28T23:54. No content was lost; the file landed in commit `0e0247b` exactly as Joe had drafted it.

## Threats Mitigated

From `01-04-PLAN.md` threat model:

- **T-04-01 (voice-transcript leakage):** Transcript stayed local; gitignore in place; only Joe-reviewed extracts committed.
- **T-04-02 (case-study confidential leak):** `cortex-ai-client-win` anonymized at draft time; no real names in committed files; Joe voice-passed each study aloud (catches names a code review would miss).
- **T-04-03 (executor invents content):** Every Task 2-6 was `checkpoint:human-action`; Joe physically typed `*-done` signals at each gate. No content originated from Claude unprompted.
- **T-04-04 (guardrails tampering):** `kb/guardrails.md` git author is `Joe Dollinger <joe.dollinger@gmail.com>` per `git log -1 --format='%an <%ae>' kb/guardrails.md`; any future modification by another author will be visible in `git blame`.
- **T-04-06 (signature non-repudiation):** `Signed: Joe Dollinger, 2026-04-24` line + git-author identity provide a two-key audit trail.

## Lessons Learned

- **Voice-first drafting actually works, but requires next-day spacing.** Joe's first drafts written under the 2026-04-23 voice-interview register read conversationally. Same-day voice-passes were thin; next-day reads caught LinkedIn drift in two of the five studies (rewrites kept in-place, no re-interviews needed).
- **Selection session was the highest-leverage 30 minutes of the plan.** Choosing 5 stories that cover the rubric is the entire ballgame for VOICE-03; Task 6 interview quality follows from selection quality. Worth budgeting more time here on future content plans.
- **Frontmatter validator caught two real defects during Task 6** (missing `confidential:` field on draft 1; malformed timeframe on draft 3). Worth the 30-min investment in Task 1.
- **Sitting structure (1 / 2 / 3) for Task 4 was load-bearing.** Joe ran out of voice fidelity in Sitting 2 — splitting stances and FAQ across separate work blocks was the right call. Bias toward more sittings, not fewer.

## Next Phase Setup

- **Phase 2 (chat loop) inherits a fully populated `kb/`.** No content gaps; system-prompt assembler can run in production-realistic conditions from day one.
- **System-prompt byte length 73,865 → ~22k input tokens uncached.** With Anthropic prompt caching (`cache_control: ephemeral`) the cached read is ~3k tokens after first warm-up — the cost model assumes >80% cache-hit rate during a recruiter session. Phase 2's spend-cap math should plumb this number through.
- **Determinism test from Plan 02 still green.** The KB content swap did not break the byte-stable assertion; the determinism contract holds.
- **Frontmatter validator is a CI candidate** — Phase 5 (evals + launch) should consider adding it to the GitHub Actions pre-deploy gate alongside the eval harness.

## Self-Check: PASSED

- [x] All 7 tasks reached `done` state per the plan; tracker fully checked
- [x] All 9 VOICE-* requirements satisfied (VOICE-02..10)
- [x] All artifacts present and frontmatter-valid
- [x] All key-links present and wired (validated by `gsd-tools verify key-links`)
- [x] Validator script exits 0 (5 case studies validated, 0 errors)
- [x] All 11 Phase 1 tests pass (`npm test`)
- [x] `kb/guardrails.md` git author = Joe Dollinger (verified via `git log -1 --format='%an <%ae>'`)
- [x] Coverage rubric + voice-pass have Joe's initials (`JMD 04/28/2026`)
- [x] Plan 04 Exit Criteria all four boxes checked
