# Phase 1: Foundation & Content - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning
**Mode:** `--auto` (all gray areas auto-resolved to recommended defaults; Joe can revise CONTEXT.md before planning begins)

<domain>
## Phase Boundary

Phase 1 delivers the **deployable shell + the knowledge base** and nothing else. Concretely:

- A working Next.js 16 app (local `npm run dev`) that you can load in a browser.
- A framing landing page with a soft email gate that persists sessions to Supabase (no LLM calls yet).
- The `kb/` directory fully scaffolded and then **populated by Joe** with real content: resume, profile, about, management philosophy, voice samples (from unfiltered sources), disagreeable stances, FAQ, Joe-signed guardrails, and 4-6 voice-first case studies.
- A `lib/kb-loader.ts` + `lib/system-prompt.ts` pair with a unit test that proves the assembled system prompt is byte-identical across two calls (SAFE-11: the cache-prefix invariant).
- A pre-commit hook that scans for accidental secret leaks (SAFE-14).

**Not in Phase 1:** the `/api/chat` route, streaming UI, classifier, spend cap, rate limits, tools, trace panel, metric card, admin dashboard, evals, deployment. Every one of those belongs to a later phase.

Content acquisition runs as a **parallel Joe-time track inside this phase** (~10-14 hours of Joe's time spread over 1-2 weeks). Engineering work does not block on it, but exit criteria for Phase 1 include the KB being populated.

</domain>

<decisions>
## Implementation Decisions

### Repo, Tooling & Versions (A)

- **D-A-01:** Single-package Next.js app at the repo root. No monorepo; `src/` directory for all app and lib code. *(Rationale: Next.js default, easiest to reason about at this scale.)*
- **D-A-02:** Package manager: **npm**. *(Rationale: Next.js default, zero friction, Joe is not primarily an engineer — optimize for boringness.)*
- **D-A-03:** Node version: **22 LTS**. *(Rationale: Next.js 16 minimum; LTS supported through 2027.)*
- **D-A-04:** TypeScript strict mode on; ESLint + Prettier as bundled by `create-next-app`.
- **D-A-05:** Tailwind v4 + shadcn/ui (vendored via `npx shadcn@latest init`); CSS-first config via `@theme` in `globals.css`. *(Rationale: Research confirms this is the current default and pairs naturally with Next.js 16.)*
- **D-A-06:** Vitest for unit/integration tests; Playwright for e2e (installed now but exercised more in Phase 6 eval). *(Rationale: Research recommends both; install early so tests are normal from day 1.)*
- **D-A-07:** Branch strategy: continue on `master` for solo dev with atomic commits. No feature branches for this personal project. *(Rationale: Joe confirmed "master is fine" posture earlier; no CI or code review pipeline that would benefit from branch isolation.)*
- **D-A-08:** Remote repository: deferred until needed. GitHub push happens in Phase 4 when GitHub OAuth is wired (admin auth provider).

### Landing Page UX (B)

- **D-B-01:** Single-field email input (HTML `type="email"`) with **inline real-time format validation**. No password, no magic link, no CAPTCHA day one. *(Rationale: Spec lock-in; friction kills 2-minute demo.)*
- **D-B-02:** Disclaimer "I'm an AI agent grounded on Joe's background, not Joe in real time" rendered **above the fold**, small-but-visible, directly under the framing paragraph. *(Rationale: Pitfall research: the fabrication/legal-precedent defense starts with user expectations being set before the first message.)*
- **D-B-03:** Copy register: **engineered professional and warm** — first-person introduction from "Joe's agent," specific about the three capabilities, no emoji-laden "Meet my AI assistant!" tone. *(Rationale: Features research flags breathless framing as the #1 gimmickiness signal.)*
- **D-B-04:** Post-submit behavior: `sessionStorage.setItem('session_id', id)` then `router.push('/chat')`. The `/chat` route will be a stub in Phase 1 (placeholder "chat coming in Phase 2") — this deliberately lets Joe verify the happy path without the streaming loop existing yet.
- **D-B-05:** No "Joe gets notified" honest-disclosure badge in Phase 1 (the email notification itself lands in Phase 4). Text on the framing page mentions the notification so recruiters aren't surprised, but the actual Resend integration is Phase 4.
- **D-B-06:** Responsive baseline only (mobile-viewable, not mobile-optimized). No full WCAG audit.

### KB Content Acquisition — Joe's Parallel Track (C)

- **D-C-01:** Content-acquisition protocol docs committed at `docs/interview-protocol-selection.md`, `docs/interview-protocol-case-study.md`, `docs/interview-protocol-voice.md`. *(Rationale: Makes the process reproducible; downstream sessions can re-run interviews against these protocols.)*
- **D-C-02:** Recommended population sequence:
  1. **Voice interview first** (~30 min recorded; Joe's choice of tool — Loom, phone, voice memo). Transcribe via Otter / MacWhisper / ChatGPT "clean up transcription."
  2. Pull 8-12 short passages from the transcript into `voice.md`. Pull 2-3 genuine opinion passages into `stances.md` as a seed.
  3. Write `about_me.md`, `management_philosophy.md`, `faq.md`, `guardrails.md` (Joe-authored prose).
  4. Finish `stances.md` (8-12 total disagreeable positions).
  5. Selection session (~30 min) → 8-10 candidate stories in `kb/brainstorm/case-study-candidates.md` → prune to 4-6 against the coverage rubric (≥1 failure, ≥1 leadership-without-authority, ≥1 data-rooted, ≥1 cross-functional conflict, ≥1 recent, ≥1 long-arc).
  6. Case-study interviews (~45 min each × 4-6). Claude runs them per `interview-protocol-case-study.md`; Joe edits for voice and accuracy.
  7. Voice-pass: final read of each case study in conversational register, not LinkedIn register.
  *(Rationale: Voice samples seed every subsequent content file; stances carry opinion density into the KB early; case studies written after voice establishes cadence are voice-first by construction.)*
- **D-C-03:** `resume.md` is the single source of truth (SSOT) for Joe's resume content. Any PDF/Word/LinkedIn derivative is generated from it, never the other way around. *(Addresses Pitfall 11 — KB drift.)*
- **D-C-04:** Voice samples (`voice.md`) come **only** from unfiltered sources: Slack DMs, texts, voice-memo transcripts, unpolished drafts, beta feedback, emails-where-Joe-was-annoyed-or-excited. **PRDs, LinkedIn posts, and performance-review prose are banned** as voice sources. *(Rationale: Pitfall 3 — the single largest quality risk; polished writing already reads as ChatGPT and cannot be rescued after the fact.)*
- **D-C-05:** Case studies drafted voice-first (conversational register in the first draft), with grammar cleanup after. **Voice-passing at the end never works.** *(Rationale: Pitfall 3 execution detail; research explicitly calls this out as the common failure mode.)*
- **D-C-06:** `guardrails.md` is Joe-authored and Joe-signed before Phase 1 exits. It must explicitly cover: no fabrication, no salary negotiation, no disparagement of former employers, no confidential details, hiring/comp questions redirect to email, no system-prompt/KB verbatim dump, no persona change. *(Rationale: This file is the single most load-bearing safety artifact in the project; Joe's approval is the gate, not Claude's.)*
- **D-C-07:** Content-population checklist tracked as checkboxes inside `.planning/phases/01-foundation-content/01-CONTENT-STATUS.md` (created during Phase 1 execution). Claude and Joe both update it as content lands.

### Secret Scanning & Pre-Commit Hook (D)

- **D-D-01:** Pre-commit hook implemented as a plain shell script at `.git/hooks/pre-commit` (not committed to the repo directly) plus a committed `scripts/install-pre-commit-hook.sh` that installs it. *(Rationale: `.git/hooks/*` isn't tracked by git; the installer script is the committed artifact.)*
- **D-D-02:** Hook scope: scans **staged** content (`git diff --cached --name-only | xargs`) for:
  - `NEXT_PUBLIC_.*(KEY|SECRET|TOKEN|PASSWORD|PASS)` — catches the classic "accidentally made secret public" mistake.
  - `sk-ant-[A-Za-z0-9_-]+` — raw Anthropic API keys.
  - `eyJ[A-Za-z0-9._-]{50,}\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+` — Supabase service-role JWT.
  - Any file matching `.env.local` or `.env*.local` being staged at all.
- **D-D-03:** Hook behavior: **block** the commit on match with a clear error message; exit 1. No warning-only mode. *(Rationale: Once a secret is committed, history rewrite is painful; better to block than remediate.)*
- **D-D-04:** No third-party tool (gitleaks, trufflehog) in Phase 1 — a 20-line shell script is enough and avoids adding a binary dependency. *(Rationale: YAGNI. The threat model is "Joe's own commits," not an adversarial CI pipeline.)*

### System Prompt Determinism Test (E)

- **D-E-01:** `src/lib/system-prompt.ts` exports `buildSystemPrompt(): string` — pure function; no side effects, no async, no environment reads at call time.
- **D-E-02:** The cached-prefix block (the entire system prompt at v1) contains **only** static content: identity, voice rules, hallucination rules, tool guidance placeholder (the actual tool descriptions are auto-generated by the AI SDK from tool specs in Phase 3), and the concatenated KB.
- **D-E-03:** Forbidden in the system prompt string: `Date.now()`, `new Date()`, `crypto.randomUUID()`, any env var read at build-time other than those baked into KB content, any user input, session ID, IP, timestamp.
- **D-E-04:** Unit test `tests/lib/system-prompt.test.ts`:
  - Asserts `buildSystemPrompt() === buildSystemPrompt()` (strict equality — byte-identical).
  - Asserts the prompt contains `<!-- kb: resume -->`, `<!-- kb: guardrails -->`, `<!-- kb: voice -->`, `VOICE RULES`, `HALLUCINATION RULES` (sanity: the KB actually got stitched in).
  - Asserts length > 500 chars and < 200k chars (sanity bounds).
- **D-E-05:** The KB loader (`lib/kb-loader.ts`) reads files at cold start only; the result is memoized in a module-level constant. Re-reading the filesystem per request would be a cache-invalidation bomb.
- **D-E-06:** Test runs in CI (once CI exists, Phase 5). For now, `npm test` runs it locally and the pre-commit hook can optionally run it on changes to `src/lib/system-prompt.ts` or `kb/` (deferred — not required in Phase 1).

### Environment & Secrets (F)

- **D-F-01:** `.env.example` committed with placeholder keys for every var we'll need across all phases, so new contributors (future-Joe) have the full picture even though only some are used in Phase 1.
- **D-F-02:** Only Supabase env vars are actually exercised in Phase 1. Anthropic/Exa/Upstash/Resend env vars exist as placeholders but nothing reads them until later phases.
- **D-F-03:** `.gitignore` confirmed to exclude `.env*.local` (Next.js default — verify, don't re-add).
- **D-F-04:** Any `NEXT_PUBLIC_` prefix is treated as load-bearing — it means "this goes to the browser." Secrets never get this prefix. Pre-commit hook enforces.

### Claude's Discretion

- Exact color palette / font choices for the framing page (Claude picks tastefully; Joe can steer in review). Constraint: no "Meet my AI!" visual tropes.
- Exact wording of framing-page copy (Claude drafts; Joe edits — but Claude should pre-read `voice.md` and aim for Joe's register on the landing copy itself, too).
- File organization details inside `src/` beyond the high-level structure already specified.
- Minor TypeScript decisions: interface vs type alias, named vs default exports, etc. — follow established Next.js community conventions.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design & Scope
- `docs/superpowers/specs/2026-04-21-resume-agent-design.md` — Approved design spec. §1 (Recruiter Journey), §2 (Stack + Architecture), §4 (KB & Interview Capture) most relevant to this phase.
- `.planning/PROJECT.md` — Project context, core value, risk register, key decisions, constraints.
- `.planning/REQUIREMENTS.md` — v1 requirements. Phase 1 is responsible for 21 REQ-IDs: GATE-01..05, CHAT-03/04/05, VOICE-01..10/12, SAFE-11/14.
- `.planning/ROADMAP.md` — §Phase 1 goal + success criteria.

### Research (read before engineering any file)
- `.planning/research/SUMMARY.md` — Executive synthesis; cross-cutting tensions; per-phase rationale.
- `.planning/research/STACK.md` — Validated dependencies with current 2026 versions; what NOT to use. Phase 1 touches: Next.js 16, TypeScript, Tailwind v4, shadcn/ui, Vitest, Playwright, `@supabase/ssr`, `@supabase/supabase-js`, `gray-matter`, `js-yaml`, `zod`, `date-fns`, `nanoid`.
- `.planning/research/ARCHITECTURE.md` — Data flow; component boundaries; the frozen-prefix caching pattern (Pattern 1, directly drives D-E-01..06).
- `.planning/research/PITFALLS.md` — Pitfalls mapped to this phase: Pitfall 1 (fabrication — guardrails + voice-first content prevent it), Pitfall 3 (generic ChatGPT voice — the four-layer defense starts here), Pitfall 8 (env-var leak — D-D-01..04 handle it), Pitfall 11 (KB drift — D-C-03 handles it), Pitfall 2 (cost via silent cache regression — D-E-01..06 prevent it).
- `.planning/research/FEATURES.md` — Table stakes T12 (structured KB), differentiator D3 (voice fidelity), anti-features (referenced for scope discipline).

### Interview Protocols (to be created during Phase 1 execution; become canonical afterward)
- `docs/interview-protocol-selection.md` — 30-min selection session protocol for pruning 8-10 case study candidates to 4-6.
- `docs/interview-protocol-case-study.md` — 45-min per-case-study interview protocol (15-20 probing questions per story).
- `docs/interview-protocol-voice.md` — 30-min voice interview protocol (8 prompts for eliciting authentic speech).

### Existing artifacts that should NOT be treated as canonical
- `docs/superpowers/plans/2026-04-21-resume-agent-plan-a-build.md` — An earlier draft implementation plan written before the GSD workflow took over. Useful as thinking signal only. GSD planning runs fresh via `/gsd-plan-phase 1`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

**None yet.** This is a greenfield repo with only planning artifacts and one fixture. The `src/`, `app/`, `components/`, `lib/`, `tests/` directory structure is created during Phase 1 execution.

### Established Patterns

**None yet** — this phase establishes them. Future phases will inherit:
- `app/` imports from `lib/`; `lib/` never imports from `app/` (architecture research Pattern).
- Zod schemas for any structured input (tool args, env vars, request bodies).
- `gray-matter` for YAML frontmatter + markdown parsing.
- `js-yaml` for `profile.yml` parsing.
- UUIDs generated by nanoid (not uuid package — smaller, faster).
- Pure functions where possible; especially in `lib/system-prompt.ts` (determinism-critical).

### Integration Points

- `app/page.tsx` — landing page (framing + email gate).
- `app/api/session/route.ts` — session-creation API consumed by the email gate.
- `app/chat/page.tsx` — stub only in Phase 1 ("chat coming in Phase 2"). Will be replaced in Phase 2.
- `lib/kb-loader.ts` + `lib/system-prompt.ts` — the deterministic prompt assembly. Will be consumed by `app/api/chat/route.ts` in Phase 2.

</code_context>

<specifics>
## Specific Ideas

- Framing-page copy should sound like **Joe on LinkedIn being honest with a trusted former coworker**, not like a startup landing page. Short, specific, warm but unsentimental.
- The email gate button label is "Let's chat" (not "Start chatting" or "Begin" — the casual-but-decisive register matches Joe's voice).
- Case study slugs are kebab-case, content-descriptive, not cute. Example good slugs: `killing-the-feature`, `bi-migration`, `onboarding-ab-test`. Example bad slugs: `project-x`, `story-1`, `my-biggest-win`.
- `kb/case_studies/_fixture_for_tests.md` is kept in the tree for determinism-test stability. It's explicitly excluded from production `listCaseStudies()` (files starting with `_` are filtered) but readable by `getCaseStudy('_fixture_for_tests')` for tests.
- The content-status tracker (`01-CONTENT-STATUS.md`) uses a simple checklist format. Joe reviews it each time he adds a KB file, and it stays in the phase directory as a record of when each piece of content landed.

</specifics>

<deferred>
## Deferred Ideas

None from this discussion — every topic raised stayed inside Phase 1 scope.

**Scope items explicitly parked into later phases (restating for clarity):**
- Resend / email notification wiring → Phase 4 (OBSV-08).
- Haiku classifier preflight → Phase 2 (SAFE-01..03).
- `/api/chat` streaming route → Phase 2 (CHAT-01..02).
- Tools (research_company, get_case_study, design_metric_framework) → Phase 3.
- Admin dashboard → Phase 4.
- Eval harness + CI gate + deployment + QR → Phase 5.

</deferred>

---

*Phase: 01-foundation-content*
*Context gathered: 2026-04-21*
*Auto-resolution: all gray areas resolved to recommended defaults — Joe can edit CONTEXT.md before planning runs, though the auto-advance chain will proceed to `/gsd-plan-phase 1 --auto` immediately unless interrupted.*
