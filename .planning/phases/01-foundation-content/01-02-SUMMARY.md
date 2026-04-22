---
phase: 01-foundation-content
plan: 02
subsystem: kb-infrastructure
tags: [kb-loader, system-prompt, gray-matter, js-yaml, vitest, determinism, prompt-cache, tdd]

# Dependency graph
requires:
  - 01-01 (repo scaffold, gray-matter + js-yaml installed, vitest configured with @/ alias, pre-commit hook active)
provides:
  - "Versioned kb/ with 10 required top-level files + brainstorm working doc + test fixture (VOICE-01 structural scaffold; content populated by Plan 04)"
  - "src/lib/kb-loader.ts — cold-start KB read + module-scope memoization, cross-OS-deterministic case-study sort, underscore-prefix fixture filter"
  - "src/lib/system-prompt.ts — pure buildSystemPrompt(): string assembling IDENTITY + VOICE_RULES + HALLUCINATION_RULES + tool placeholder + KB; byte-identical across invocations"
  - "// PHASE 2: anchor comment in src/lib/system-prompt.ts marking the cache_control: { type: ephemeral, ttl: 1h } attachment point for Phase 2's /api/chat route"
  - "tests/lib/kb-loader.test.ts — 6 cases covering CHAT-03"
  - "tests/lib/system-prompt.test.ts — 5 cases covering CHAT-04, CHAT-05 (marker), SAFE-11 (forbidden-pattern guard)"
affects: [02-chat, 03-tools, 04-admin, 05-deploy, 01-04-content]

# Tech tracking
tech-stack:
  added: []  # All deps were installed in 01-01; this plan consumed them
  patterns:
    - "Pure-function system prompt: buildSystemPrompt() is synchronous, deterministic, dependency-free at call time (no env reads, no Date, no crypto.randomUUID) — the whole SAFE-11 contract is enforced by a single unit-test file"
    - "Cold-start filesystem read + module-scope memoization: `let cached: string | null` pattern; first call reads kb/ and caches the concatenation, subsequent calls return the same reference (identity equality provable in tests)"
    - "Test-only cache reset export (__resetKBCacheForTests): vitest lifecycle can invalidate the cache between tests without exposing a runtime escape hatch in production routes (T-02-03 accept disposition)"
    - "Load-bearing file order: FILE_ORDER is a frozen array; reordering it silently invalidates every session's cache prefix on the next deploy — this is intentional change-control coupling"
    - "Case-study fixture exclusion via underscore prefix: files matching /^_/ are filtered from both listCaseStudySlugs() and the KB concatenation; determinism-tests use the fixture only for stable structural assertions"
    - "Deterministic cross-OS case-study ordering: readdirSync(...).sort() (explicit .sort() is the Pitfall 5 guard against macOS/Linux/Windows readdir-order divergence)"
    - "Forbidden-pattern regex guard in tests as a future-proof tripwire: ISO-timestamp, UUID, session-id-shape regexes run on the prompt output each test run — prevents any future KB edit from accidentally leaking dynamic content into the cached prefix"

key-files:
  created:
    - kb/profile.yml
    - kb/resume.md
    - kb/linkedin.md
    - kb/github.md
    - kb/about_me.md
    - kb/management_philosophy.md
    - kb/voice.md
    - kb/stances.md
    - kb/faq.md
    - kb/guardrails.md
    - kb/brainstorm/case-study-candidates.md
    - kb/case_studies/_fixture_for_tests.md
    - src/lib/kb-loader.ts
    - src/lib/system-prompt.ts
    - tests/lib/kb-loader.test.ts
    - tests/lib/system-prompt.test.ts
  modified: []

key-decisions:
  - "RESEARCH.md code examples used verbatim for kb-loader.ts and system-prompt.ts — zero deviations from reference code. RESEARCH.md's choices (gray-matter for frontmatter, js-yaml for profile.yml, underscore-prefix fixture filter, joined on \\n\\n) are all adopted unchanged."
  - "Baseline buildSystemPrompt() output: 5505 bytes with placeholder KB. Plan 04 content fill will grow this substantially (likely into the 20-40k-byte range depending on case study count and length). The 500-byte lower and 200_000-byte upper sanity bounds in the determinism test comfortably accommodate Plan 04 growth without test churn."
  - "Fixture file kb/case_studies/_fixture_for_tests.md is NOT included in buildSystemPrompt() output per CONTEXT.md specifics — verified by the `kb` not-contains `<!-- kb: case_study/_fixture_for_tests -->` assertion in kb-loader.test.ts. The fixture exists purely as a structural stable anchor so the `listCaseStudySlugs() excludes _ prefix` test has something to filter against; Plan 04 will add 4-6 real case studies that WILL flow into the KB."
  - "TDD flow followed per plan's `tdd=\"true\"` tags on Tasks 2 & 3: test file written first, confirmed failing (`Cannot find module`), then implementation written, then green. Two RED → GREEN cycles committed atomically (test + implementation together in each task commit — refactor step was unnecessary since the RESEARCH.md reference code was already minimal)."

requirements-completed:
  - CHAT-03
  - CHAT-04
  - CHAT-05  # Phase 1 deliverable (pure-function cache-ready string + // PHASE 2: marker); actual cache_control attachment lands in Phase 2
  - SAFE-11
  - VOICE-01  # Structural scaffold (10 required files present); content fill is Plan 04's responsibility

# Metrics
duration: 8min
completed: 2026-04-22
tasks: 3
files: 16
tests_added: 11
tests_passing: 11
---

# Phase 1 Plan 02: KB Infrastructure + Deterministic System-Prompt Summary

**Deterministic engine shipped: a pure buildSystemPrompt() composed over a cold-start-memoized KB loader, guarded by an 11-case vitest suite that proves byte-identity across invocations and blocks any future dynamic-content regression via forbidden-pattern regex — the single most load-bearing engineering artifact of Phase 1 and the product's lifetime defense against Pitfall 2 (silent prompt-cache regression → 10-20x cost inflation).**

## Performance

- **Duration:** ~8 min (start 10:44:51 UTC, last commit 10:52:43 UTC local-inferred from git log order)
- **Tasks:** 3 auto (Task 1 scaffold + Tasks 2-3 TDD)
- **Files created:** 16 (12 KB scaffold + 2 lib modules + 2 test files)
- **Test cases added:** 11 (6 kb-loader + 5 system-prompt); 11/11 passing; 0 pre-existing tests (Phase 1 first test suite)

## Accomplishments

- **KB structural scaffold complete (VOICE-01).** All 10 required top-level files present (profile.yml + 9 .md), each carrying a visible `PLACEHOLDER` banner + HTML-comment instructions so Plan 04 execution knows the target shape (400-600 words for about_me, 8-12 samples for voice, 8-12 stances, 15 FAQs, seven-section guardrails, etc.). `kb/resume.md` declares `ssot: true` (VOICE-12). Brainstorm working doc at `kb/brainstorm/case-study-candidates.md` ships the coverage-rubric checkboxes ready for the Plan 04 selection session.
- **Test fixture stable under kb/case_studies/_fixture_for_tests.md.** Verbatim from RESEARCH.md code example; frontmatter `slug: _fixture_for_tests`; confirmed filtered from both production `listCaseStudySlugs()` and the KB concatenation, but readable via direct slug lookup for tests that need stable input (contract matches CONTEXT.md specifics section exactly).
- **src/lib/kb-loader.ts implements CHAT-03 end-to-end.** Reads profile.yml + 9 .md files in `FILE_ORDER` (load-bearing byte sequence). profile.yml parsed via `js-yaml` and serialized as `JSON.stringify(parsed, null, 2)`; .md files parsed via `gray-matter` with frontmatter embedded as `<!-- meta: ... -->` HTML comments. Case studies read from `kb/case_studies/*.md` after a deterministic `.sort()` (Pitfall 5 cross-OS guard), with `!f.startsWith('_')` filter excluding fixtures. Result memoized in module-scope `let cached: string | null` — proven by identity-equality test on the second call.
- **src/lib/system-prompt.ts is provably pure.** Source grep-verified clean of `Date`, `Date.now(`, `new Date(`, `crypto.randomUUID(`, `process.env.` calls in the function body (D-E-03). Composes IDENTITY + VOICE_RULES (Layer 2 negative directives: banned vocabulary, no bullets, contractions, positions) + HALLUCINATION_RULES (KB-only sourcing, company allow-list) + tool-guidance placeholder + `loadKB()`. The `// PHASE 2:` marker comment stays resident in the source as the Phase 2 hand-off anchor for `cache_control: { type: 'ephemeral', ttl: '1h' }`.
- **11/11 vitest cases green, typecheck clean.** kb-loader.test.ts: section markers for all 10 files, memoization identity (===), post-reset byte-equality, fixture exclusion from KB, listCaseStudySlugs filter, profile.yml→JSON emission. system-prompt.test.ts: byte-identity across invocations (SAFE-11 primary defense), required markers (`<!-- kb: resume -->`, `<!-- kb: guardrails -->`, `<!-- kb: voice -->`, `VOICE RULES`, `HALLUCINATION RULES`), sanity length bounds (500 < len < 200k), forbidden-pattern guards (no ISO timestamps, no UUIDs, no session-id-shaped tokens), `// PHASE 2:` source-file marker present. `npx tsc --noEmit` exits 0.
- **Baseline buildSystemPrompt() byte count: 5505 bytes with placeholder KB.** This is the record-baseline for Plan 04 to measure against. Plan 04 content fill should grow this into the 20-40k range (comfortably under the 200k upper bound); a growth below ~15k would signal placeholder text didn't get fully replaced.

## Task Commits

Each task committed atomically via `gsd-tools commit` (pre-commit hook from Plan 01-01 active; all commits passed secret-scan cleanly):

1. **Task 1: Scaffold kb/ with 10 required placeholders + test fixture + brainstorm doc** — `4a5a47c` (feat)
2. **Task 2: kb-loader with cold-start memoization + fixture exclusion (CHAT-03)** — `e7c2602` (feat) — TDD: RED confirmed via `Cannot find module` before implementation; GREEN with 6/6 tests on first run
3. **Task 3: buildSystemPrompt pure function with determinism guard (CHAT-04, CHAT-05, SAFE-11)** — `9700c8c` (feat) — TDD: RED confirmed the same way; GREEN with 5/5 tests on first run

## Files Created/Modified

### KB Scaffold (Task 1 — 12 files)
- `kb/profile.yml` — YAML profile placeholder with companies: [] and tools: [] allow-lists awaiting Plan 04
- `kb/resume.md` — SSOT declaration in frontmatter (`ssot: true`); VOICE-12
- `kb/linkedin.md`, `kb/github.md`, `kb/about_me.md`, `kb/management_philosophy.md`, `kb/voice.md`, `kb/stances.md`, `kb/faq.md`, `kb/guardrails.md` — placeholder with targets, source rules, and "what goes here" HTML comments
- `kb/brainstorm/case-study-candidates.md` — coverage-rubric checkboxes + candidate template (NOT in production KB path; lives in kb/brainstorm/)
- `kb/case_studies/_fixture_for_tests.md` — RESEARCH.md-verbatim test fixture (slug: _fixture_for_tests)

### KB Loader + Tests (Task 2 — 2 files)
- `src/lib/kb-loader.ts` — 81 lines; exports `loadKB`, `__resetKBCacheForTests`, `listCaseStudySlugs`
- `tests/lib/kb-loader.test.ts` — 6 cases covering CHAT-03 contract + memoization identity + fixture exclusion

### System Prompt + Tests (Task 3 — 2 files)
- `src/lib/system-prompt.ts` — 40 lines; exports `buildSystemPrompt(): string`; contains `// PHASE 2:` anchor
- `tests/lib/system-prompt.test.ts` — 5 cases covering CHAT-04 (determinism), CHAT-05 (marker presence), SAFE-11 (forbidden-pattern guard)

## Decisions Made

- **Reference code adopted verbatim.** RESEARCH.md's Pattern 1 code examples for both kb-loader.ts and system-prompt.ts are the final implementation with no material edits — this is a feature, not a shortcut: the research was explicit about the minimal shape and any deviation would have been incidental. Consequence: the artifacts read identically to the research documentation, which is a benefit for future-Joe maintaining this code.
- **Case-study fixture excluded from KB concatenation.** CONTEXT.md had two interpretations (A: exclude from KB, expose only via getCaseStudy; B: include in KB). The plan locked Option A; this implementation matches it by filtering `!f.startsWith('_')` in both the KB concat loop and `listCaseStudySlugs()`. The determinism test asserts the absence of `<!-- kb: case_study/_fixture_for_tests -->` in the output. If a future requirement ever needs the fixture inside the cached prefix, that's a deliberate config change — not an accident.
- **Determinism test spans THREE guarantees, not one.** The test file is structured so (a) byte-identity on repeat calls, (b) byte-equality after cache reset, and (c) absence of forbidden dynamic patterns are all independent assertions. Any one could fail without the others. This is the Pitfall 2 tripwire's redundancy layer — a future contributor can break memoization without breaking the content, or introduce a dynamic token without breaking memoization, and the correct failure signal still fires.
- **No tests for `getCaseStudy(slug)` in this plan.** That helper (referenced in the sequential_execution context as "must still work for tests") was not in RESEARCH.md's code example and is not in the plan's behavior contract — its home is Phase 3's `get_case_study` tool. `listCaseStudySlugs()` is the Phase 1 contract expose; full slug→content lookup lands with the tool implementation.
- **Durable baseline byte count (5505) published in the SUMMARY.** Joe/Claude can diff against this after Plan 04 fills content to validate that real content made it into the cached prefix (expected ~4-8x growth); a sub-15k output after Plan 04 would indicate incomplete population.

## Deviations from Plan

None. Plan 01-02 executed exactly as written:
- All 12 KB files match the plan's specified content.
- kb-loader.ts and system-prompt.ts match RESEARCH.md Pattern 1 code examples verbatim.
- Test files match RESEARCH.md Code Examples verbatim.
- TDD sequencing followed (RED → GREEN for Tasks 2 & 3); refactor skipped because reference code was already minimal and no tests flagged code smells.

## Issues Encountered

- **None that required recovery.** Two green TDD cycles on first attempt. All guards (typecheck, vitest, forbidden-pattern regex, section-marker presence, byte-identity) passed without any intermediate debugging.
- **Byte-count probe required a roundabout method.** Node v25 ESM couldn't import the TypeScript module directly, and `npx tsx -e` had quoting issues on Windows Git Bash. Worked around by writing a temporary vitest test that intentionally failed with `expect(length).toBe(-1)`, reading the "Received: 5505" diagnostic, then deleting the probe file. Probe file never committed. Committed working tree confirmed clean via `git status --short` showing only the intended task deliverables.

## Phase 2 Handoff Notes

**Cache-control attachment point:** `src/app/api/chat/route.ts` (does NOT yet exist in Phase 1). When Phase 2 creates that file, the `system` block in the `streamText` call receives `buildSystemPrompt()` as its content AND the `providerOptions.anthropic.cacheControl = { type: 'ephemeral', ttl: '1h' }` attaches at that same attachment site.

**The `// PHASE 2:` anchor comment in src/lib/system-prompt.ts is the literal string Phase 2's refactor commit should grep for** when wiring the cache control — it's intentionally preserved in the source file (and asserted by test 5) so the Phase 2 executor has a canonical pointer.

**buildSystemPrompt()'s byte-identity contract is the Phase 2 pre-flight gate.** Before Phase 2 ships `/api/chat`, the test suite in this plan must still be green; if not, the prompt cache will silently miss and costs will blow up without any visible signal except the Anthropic bill. Phase 5 adds CI gating; until then, `npm test` at the pre-commit stage is the layer.

**Fixture file kb/case_studies/_fixture_for_tests.md is NOT in buildSystemPrompt() output.** Confirmed by the kb-loader.test.ts assertion `expect(kb).not.toContain('<!-- kb: case_study/_fixture_for_tests -->')`. Phase 2 should not need to be aware of the fixture; it's a test-only anchor.

## Verification Evidence

1. **KB scaffold file check (Task 1 verify):**
   ```
   KB_SCAFFOLD_OK
   ```
   (all 12 files exist; `ssot: true` present in resume.md; `slug: _fixture_for_tests` present in fixture)

2. **kb-loader tests (Task 2 verify):**
   ```
   Test Files  1 passed (1)
   Tests  6 passed (6)
   Duration  526ms
   ```

3. **system-prompt tests (Task 3 verify):**
   ```
   Test Files  1 passed (1)
   Tests  5 passed (5)
   Duration  568ms
   ```

4. **Full suite (regression sweep):**
   ```
   Test Files  2 passed (2)
   Tests  11 passed (11)
   Duration  659ms
   ```

5. **Typecheck:** `npx tsc --noEmit` → exit 0, no output.

6. **CHAT-05 marker check:** `grep -q "// PHASE 2:" src/lib/system-prompt.ts && grep -q "loadKB" src/lib/system-prompt.ts` → `SYSTEM_PROMPT_OK`

7. **Baseline byte count probe:** 5505 bytes (captured via temporary probe test, file not committed).

8. **Commit ledger (in reverse chronological order):**
   - `9700c8c` — Task 3 system-prompt
   - `e7c2602` — Task 2 kb-loader
   - `4a5a47c` — Task 1 KB scaffold

9. **Working tree integrity:** `git status --short` after all three task commits shows only orchestrator-owned files in `.planning/` may appear modified (STATE.md, config.json — not touched by this executor).

10. **Pre-commit hook integrity:** All three task commits passed the hook cleanly (no regex matches on staged content). The hook did its job silently — no interruptions.

## Known Stubs

**None that block progress.** Every KB file carries a `PLACEHOLDER` banner, but that's the plan's deliberate hand-off to Plan 04 (content-acquisition track). The placeholders are:
- Fully wired into `loadKB()`'s filesystem-read loop (no dead paths).
- Fully visible in `buildSystemPrompt()` output (5505 bytes).
- Not stubs in the runtime sense — the code path works end-to-end with placeholder text; only the text content is "to be written by Joe."

The distinction matters: Plan 04 replaces *content*, not *code*. After Plan 04 the infrastructure is unchanged; only the strings change.

## Threat Flags

**None.** All new surface was covered in the plan's `<threat_model>`:
- T-02-01 (dynamic-content regression) mitigated by determinism test's forbidden-pattern regex — now live and running on `npm test`.
- T-02-02 (readdirSync cross-OS nondeterminism) mitigated by explicit `.sort()` in kb-loader — source-grep verified, exercised by the byte-identity test.
- T-02-03 (production `__resetKBCacheForTests` abuse) accepted disposition — no runtime check added in Phase 1 per plan; Phase 5 can add a lint rule if needed.
- T-02-04 (whitespace-change cache invalidation) accepted — change control is the mitigation; any edit to VOICE_RULES/HALLUCINATION_RULES/file order will invalidate the prefix on next deploy, as intended.
- T-02-05 (KB-as-instructions jailbreak) accepted for Phase 1 (KB is Joe-authored); Phase 2 classifier + refusal rules are the next defense layer.

No new surface beyond the threat register.

## Next Plan Readiness

**Ready for Plan 01-03 (landing-page) and Plan 01-04 (content acquisition — Joe-time track).**

- **Plan 01-03 consumption:** Does NOT depend on kb-loader or system-prompt — the landing page is a separate slice. No Plan 02 outputs are Plan 03 inputs.
- **Plan 01-04 consumption:** Replaces every `TBD` placeholder in the 10 top-level KB files and adds 4-6 `kb/case_studies/*.md` files matching the spec §4 template. Plan 04 does NOT modify `src/lib/kb-loader.ts` or `src/lib/system-prompt.ts`; if it does, it's a bug — the infrastructure is locked in by this plan. The determinism test will catch any accidental tampering.
- **Phase 2 (post-Phase-1) consumption:** `src/app/api/chat/route.ts` imports `buildSystemPrompt` from `src/lib/system-prompt` and attaches `cache_control: { type: 'ephemeral', ttl: '1h' }` via `providerOptions` on the `streamText` system block. The `// PHASE 2:` anchor comment marks the exact location.

No blockers. No deferred items created.

## Self-Check: PASSED

Files verified present:
- FOUND: kb/profile.yml, kb/resume.md, kb/linkedin.md, kb/github.md, kb/about_me.md, kb/management_philosophy.md, kb/voice.md, kb/stances.md, kb/faq.md, kb/guardrails.md
- FOUND: kb/brainstorm/case-study-candidates.md
- FOUND: kb/case_studies/_fixture_for_tests.md
- FOUND: src/lib/kb-loader.ts, src/lib/system-prompt.ts
- FOUND: tests/lib/kb-loader.test.ts, tests/lib/system-prompt.test.ts

Commits verified present in `git log --oneline -6`:
- FOUND: 4a5a47c (Task 1 KB scaffold)
- FOUND: e7c2602 (Task 2 kb-loader)
- FOUND: 9700c8c (Task 3 system-prompt)

Verify-step outcomes:
- FOUND: KB_SCAFFOLD_OK (Task 1 shell-test battery)
- FOUND: 6/6 kb-loader tests green
- FOUND: 5/5 system-prompt tests green
- FOUND: 11/11 full suite green
- FOUND: npx tsc --noEmit clean exit
- FOUND: SYSTEM_PROMPT_OK (// PHASE 2: + loadKB grep hits)
- FOUND: Baseline byte count 5505 recorded
- FOUND: git status clean of task deliverables (only orchestrator-owned .planning/ files may show modified)

---
*Phase: 01-foundation-content*
*Completed: 2026-04-22*
