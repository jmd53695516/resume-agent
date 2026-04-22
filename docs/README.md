# Resume Agent — Contributor Notes

A public, QR- and URL-linked chat agent attached to Joe Dollinger's paper and
digital resume. Recruiters land in a soft-gated chat that answers questions
about Joe and invokes three PM-flavored tools (company pitch, case-study
walkthrough, metric framework). The agent itself is the portfolio artifact.

## Resume is SSOT

`kb/resume.md` is the **single source of truth** for Joe's resume content. Any
PDF, Word, LinkedIn export, or printed copy MUST be generated from `resume.md`
— never the other way around. Updates flow: edit `kb/resume.md` → regenerate
derivatives. Rationale: prevents the "two versions of the truth" pitfall the
agent would then silently narrate around (see
`.planning/research/PITFALLS.md` Pitfall 11).

## Orient yourself

- `.planning/PROJECT.md` — product context, core value, constraints, key
  decisions.
- `.planning/ROADMAP.md` — five-phase plan and per-phase goals.
- `.planning/REQUIREMENTS.md` — versioned requirement IDs (GATE-\*, CHAT-\*,
  VOICE-\*, SAFE-\*, etc.).
- `.planning/phases/01-foundation-content/01-CONTEXT.md` — Phase 1 decisions
  and boundaries; start here for current-phase specifics.
