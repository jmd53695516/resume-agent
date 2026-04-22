# Phase 1: Foundation & Content - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 01-foundation-content
**Mode:** `--auto` (Claude auto-selected recommended defaults after analyzing gray areas against the spec and research artifacts)
**Areas discussed:** Repo tooling & versions; Landing page UX; KB content acquisition; Secret scanning; System prompt determinism test; Environment & secrets

---

## A — Repo, Tooling & Versions

| Option | Description | Selected |
|--------|-------------|----------|
| Single-package Next.js at repo root | Simplest, standard Next.js layout | ✓ |
| Monorepo (pnpm/turborepo) | Overkill for one app | |
| Flat layout (no `src/`) | Non-default Next.js; harder to onboard | |

**User's choice (auto-recommended):** Single-package, `src/` directory.
**Notes:** Matches research STACK.md and Joe is not primarily an engineer — optimize for boringness and community convention.

---

| Option | Description | Selected |
|--------|-------------|----------|
| npm | Next.js default; zero friction | ✓ |
| pnpm | Faster install, strict hoisting | |
| bun | Fastest but still bleeding-edge | |

**User's choice (auto-recommended):** npm.
**Notes:** No monorepo so pnpm's strictness gains little; bun is overkill and risk-bearing for a personal project.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Node 22 LTS | Next.js 16 minimum; supported through 2027 | ✓ |
| Node 20 | Older LTS, still viable | |
| Node latest current | Newest features, but no LTS guarantees | |

**User's choice (auto-recommended):** Node 22 LTS.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Feature branch for Phase 1 | Cleaner history for PR review | |
| Stay on `master` | Solo dev, no CI, no remote yet | ✓ |

**User's choice (auto-recommended):** Stay on `master`.
**Notes:** Joe confirmed earlier that `master` is fine for this solo project. No remote yet; GitHub push happens in Phase 4 for admin OAuth.

---

## B — Landing Page UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline real-time email validation | HTML5 `type="email"` with immediate format feedback | ✓ |
| On-submit validation only | Simpler; feels less polished | |

**User's choice (auto-recommended):** Inline real-time.
**Notes:** Small UX win; no meaningful engineering cost.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Disclaimer above-fold near framing paragraph | Small but visible; sets expectation before interaction | ✓ |
| Disclaimer in footer | Easy to miss; legal-weak position | |
| Disclaimer inside chat UI only | Recruiter may act before seeing it | |

**User's choice (auto-recommended):** Above-fold, near the framing paragraph.
**Notes:** PITFALLS research: fabrication defense starts with user expectations set before the first message.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Engineered professional + warm | First-person "Joe's agent"; specific; no emoji tropes | ✓ |
| Breathless "Meet my AI assistant!" | Highest gimmickiness signal; research-flagged | |
| Cold/corporate | Doesn't reflect Joe's voice; pitch dies | |

**User's choice (auto-recommended):** Engineered professional + warm.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full-page navigate to `/chat` after email submit | Clean separation; `/chat` is a Phase 1 stub placeholder | ✓ |
| Inline chat-reveal on same page | Conflates landing and chat; harder to replace in Phase 2 | |
| Two-step modal | Adds UI complexity for no real gain | |

**User's choice (auto-recommended):** Full-page navigate to `/chat` (stub route in Phase 1).

---

## C — KB Content Acquisition (Joe's parallel track)

| Option | Description | Selected |
|--------|-------------|----------|
| Voice interview → stances seed → prose files → case studies | Voice establishes cadence; stances carry opinion density early | ✓ |
| Case studies first, voice later | Case studies get written in LinkedIn register; voice can't fix later | |
| All content in parallel, in any order | Invites voice-last drift; research-flagged failure mode | |

**User's choice (auto-recommended):** Voice → stances → prose → case studies (sequence per PITFALLS research).

---

| Option | Description | Selected |
|--------|-------------|----------|
| `docs/interview-protocol-*.md` | Discoverable, reproducible, committed | ✓ |
| `.planning/phases/01-*` only | Loses reusability for future content refreshes | |
| No written protocol | Interview quality varies; not repeatable | |

**User's choice (auto-recommended):** `docs/interview-protocol-*.md`.

---

| Option | Description | Selected |
|--------|-------------|----------|
| `resume.md` as SSOT; PDF generated from it | One source; no drift risk (PITFALLS 11) | ✓ |
| PDF as SSOT; markdown copy kept in sync manually | Drift is inevitable; research flags this | |

**User's choice (auto-recommended):** `resume.md` as SSOT.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Voice samples from Slack/texts/voice-memos/unfiltered | Authentic register; research-validated | ✓ |
| Voice samples from LinkedIn posts / PRDs | Already reads as ChatGPT; defeats the whole defense | |
| Voice samples from a mix | Mix contaminates the unfiltered signal | |

**User's choice (auto-recommended):** Unfiltered sources only; LinkedIn/PRDs explicitly banned.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Case studies drafted voice-first (conversational register from draft 1) | Cadence baked in; research-validated path | ✓ |
| Draft formally, then "voice-pass" at the end | Research: voice-passing at end never works | |

**User's choice (auto-recommended):** Voice-first drafting.

---

## D — Secret Scanning & Pre-Commit Hook

| Option | Description | Selected |
|--------|-------------|----------|
| Plain shell script installed to `.git/hooks/pre-commit` | No binary deps; 20 lines; easy to maintain | ✓ |
| gitleaks | Third-party tool; binary install | |
| trufflehog | Heavier; not warranted at personal-project scale | |

**User's choice (auto-recommended):** Plain shell script + installer `scripts/install-pre-commit-hook.sh`.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Scan staged content; block on match (exit 1) | Block-before-commit is the cheapest remediation | ✓ |
| Scan but only warn | Warnings get ignored; history rewrite is painful once committed | |

**User's choice (auto-recommended):** Block on match.
**Notes:** Patterns: `NEXT_PUBLIC_.*(KEY|SECRET|TOKEN|PASS)`, raw `sk-ant-*`, Supabase JWT regex, `.env*.local` staged.

---

## E — System Prompt Determinism Test

| Option | Description | Selected |
|--------|-------------|----------|
| Pure function `buildSystemPrompt(): string` with strict-equality unit test | Guarantees byte-identical; supports cache prefix | ✓ |
| Fuzzy snapshot test | Hides dynamic content drift | |
| No test, rely on code review | PITFALLS 2: 10-20x silent cost inflation scenario; research-blocked | |

**User's choice (auto-recommended):** Pure function + strict-equality unit test.

---

| Option | Description | Selected |
|--------|-------------|----------|
| KB loaded at cold start, memoized in module constant | Read once per process; cache-safe | ✓ |
| Read KB per request | Cache invalidation bomb; 10-20x cost inflation | |

**User's choice (auto-recommended):** Cold-start memoization.

---

## F — Environment & Secrets

| Option | Description | Selected |
|--------|-------------|----------|
| `.env.example` with placeholders for ALL phases' vars | Forward-compatibility; single source of env truth | ✓ |
| `.env.example` only for Phase 1 vars | Creates churn as phases add vars | |

**User's choice (auto-recommended):** All-phase placeholders now.

---

## Claude's Discretion

- Framing page visual design (palette, font, spacing) — Claude picks tastefully; Joe can steer during review.
- Exact landing-page copy wording — Claude drafts; Joe edits.
- Component/file organization details inside `src/` beyond high-level structure.
- Minor TypeScript conventions (interface vs type, named vs default exports).

## Deferred Ideas

None from this discussion. Every suggestion stayed inside Phase 1 scope.
