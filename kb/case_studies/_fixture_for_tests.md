---
slug: _fixture_for_tests
hook: "Internal test fixture — never surfaced to users"
role: "Fixture"
timeframe: "N/A"
confidential: false
---

## Context
This file exists only to give `buildSystemPrompt()` a stable, known case study to
concatenate during unit tests. Filenames starting with `_` are excluded from
production `listCaseStudies()` results via the filter in `lib/kb-loader.ts`.

## Options considered
- Keep a static fixture in the repo.
- Generate synthetic fixtures in the test setup.

## Decision & reasoning
Static fixture — deterministic across platforms; no test-setup complexity.

## Outcome
Tests pass on Linux, macOS, Windows.

## Retrospective
Would do the same thing again.

## Likely recruiter follow-ups (and my answers)
- Q: Is this a real case study? A: No, it's a test fixture. See `docs/` for real ones.
