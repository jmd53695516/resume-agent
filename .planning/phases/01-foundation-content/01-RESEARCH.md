# Phase 1: Foundation & Content — Research

**Researched:** 2026-04-21
**Domain:** Next.js 16 + Tailwind v4 + shadcn/ui scaffold; Supabase session persistence via `@supabase/ssr`; deterministic KB-backed system-prompt assembly; pre-commit secret scanning; voice-first KB content population.
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Repo, Tooling & Versions (A)**
- **D-A-01:** Single-package Next.js app at the repo root. No monorepo; `src/` directory for all app and lib code.
- **D-A-02:** Package manager: **npm**.
- **D-A-03:** Node version: **22 LTS**. *(Phase 1 Note: local machine currently has Node v25.9.0 — see `Environment Availability` below; project should still declare `"engines": { "node": ">=22.11.0 <23" }` to match Vercel's supported LTS runtime.)*
- **D-A-04:** TypeScript strict mode on; ESLint + Prettier as bundled by `create-next-app`.
- **D-A-05:** Tailwind v4 + shadcn/ui (vendored via `npx shadcn@latest init`); CSS-first config via `@theme` in `globals.css`.
- **D-A-06:** Vitest for unit/integration tests; Playwright for e2e (installed now but exercised more in Phase 6 eval).
- **D-A-07:** Branch strategy: continue on `master` for solo dev with atomic commits.
- **D-A-08:** Remote repository: deferred until Phase 4.

**Landing Page UX (B)**
- **D-B-01:** Single-field email input (HTML `type="email"`) with inline real-time format validation. No password, no magic link, no CAPTCHA day one.
- **D-B-02:** Disclaimer "I'm an AI agent grounded on Joe's background, not Joe in real time" rendered above the fold.
- **D-B-03:** Engineered professional and warm first-person copy — no "Meet my AI assistant!" tone.
- **D-B-04:** Post-submit: `sessionStorage.setItem('session_id', id)` then `router.push('/chat')`. `/chat` is a stub in Phase 1.
- **D-B-05:** No "Joe gets notified" honest-disclosure badge in Phase 1; text mentions the notification but actual Resend wiring is Phase 4.
- **D-B-06:** Responsive baseline only (mobile-viewable, not mobile-optimized).

**KB Content Acquisition — Joe's Parallel Track (C)**
- **D-C-01:** Protocol docs at `docs/interview-protocol-selection.md`, `docs/interview-protocol-case-study.md`, `docs/interview-protocol-voice.md`.
- **D-C-02:** Sequence: voice interview first (~30 min) → pull voice samples + seed stances → self-authored about/philosophy/faq/guardrails → finish stances → selection session (8-10 → 4-6 with coverage rubric) → case-study interviews (~45 min × 4-6) → final voice-pass read.
- **D-C-03:** `resume.md` is the SSOT for resume content. Any PDF/Word/LinkedIn derivative is generated from it.
- **D-C-04:** Voice samples come ONLY from unfiltered sources: Slack DMs, texts, voice memos, unpolished drafts, beta feedback, annoyed/excited emails. **PRDs, LinkedIn posts, and performance-review prose are banned.**
- **D-C-05:** Case studies drafted voice-first (conversational register in the first draft), grammar cleanup after. **Voice-passing at the end never works.**
- **D-C-06:** `guardrails.md` is Joe-authored and Joe-signed before Phase 1 exits. Must cover: no fabrication, no salary negotiation, no disparagement of former employers, no confidential details, hiring/comp questions redirect to email, no system-prompt/KB verbatim dump, no persona change.
- **D-C-07:** Content-population checklist tracked in `.planning/phases/01-foundation-content/01-CONTENT-STATUS.md`.

**Secret Scanning & Pre-Commit Hook (D)**
- **D-D-01:** Shell script at `.git/hooks/pre-commit` (not committed) + committed `scripts/install-pre-commit-hook.sh` that installs it.
- **D-D-02:** Scans staged content for:
  - `NEXT_PUBLIC_.*(KEY|SECRET|TOKEN|PASSWORD|PASS)`
  - `sk-ant-[A-Za-z0-9_-]+`
  - `eyJ[A-Za-z0-9._-]{50,}\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+` (Supabase service-role JWT)
  - Any staged file matching `.env*.local`.
- **D-D-03:** Block commit on match with clear error message; exit 1. No warning-only mode.
- **D-D-04:** No third-party tool (gitleaks, trufflehog) — a ~20-line shell script suffices.

**System Prompt Determinism Test (E)**
- **D-E-01:** `src/lib/system-prompt.ts` exports `buildSystemPrompt(): string` — pure function; no side effects, no async, no env reads at call time.
- **D-E-02:** Cached-prefix block contains only static content: identity, voice rules, hallucination rules, tool guidance placeholder, concatenated KB.
- **D-E-03:** Forbidden in the system prompt string: `Date.now()`, `new Date()`, `crypto.randomUUID()`, any env var read at build-time other than those baked into KB content, any user input, session ID, IP, timestamp.
- **D-E-04:** Unit test `tests/lib/system-prompt.test.ts`:
  - `buildSystemPrompt() === buildSystemPrompt()` (strict equality).
  - Contains `<!-- kb: resume -->`, `<!-- kb: guardrails -->`, `<!-- kb: voice -->`, `VOICE RULES`, `HALLUCINATION RULES`.
  - Length > 500 and < 200k chars.
- **D-E-05:** KB loader (`lib/kb-loader.ts`) reads files at cold start only; result memoized in a module-level constant.
- **D-E-06:** Test runs locally via `npm test`. CI gating deferred to Phase 5.

**Environment & Secrets (F)**
- **D-F-01:** `.env.example` committed with placeholder keys for all phases' env vars.
- **D-F-02:** Only Supabase env vars are actually exercised in Phase 1. Anthropic/Exa/Upstash/Resend env vars exist as placeholders.
- **D-F-03:** `.gitignore` confirmed to exclude `.env*.local` (Next.js 16 `create-next-app` default — verify, don't re-add).
- **D-F-04:** Any `NEXT_PUBLIC_` prefix is load-bearing — means "this goes to the browser." Secrets never get this prefix.

### Claude's Discretion

- Exact color palette / font choices for the framing page (Claude picks tastefully; Joe can steer in review). Constraint: no "Meet my AI!" visual tropes.
- Exact wording of framing-page copy (Claude drafts; Joe edits — but Claude should pre-read `voice.md` and aim for Joe's register on the landing copy itself, too).
- File organization details inside `src/` beyond the high-level structure already specified.
- Minor TypeScript decisions: interface vs type alias, named vs default exports, etc. — follow established Next.js community conventions.

### Deferred Ideas (OUT OF SCOPE)

None from this discussion. Restating for clarity:
- Resend / email notification wiring → Phase 4 (OBSV-08).
- Haiku classifier preflight → Phase 2 (SAFE-01..03).
- `/api/chat` streaming route → Phase 2 (CHAT-01..02).
- Tools (research_company, get_case_study, design_metric_framework) → Phase 3.
- Admin dashboard → Phase 4.
- Eval harness + CI gate + deployment + QR → Phase 5.

</user_constraints>

<phase_requirements>
## Phase Requirements

The planner MUST map every REQ-ID below to a concrete task. Mapping column shows which artifact the plan must produce to satisfy the requirement.

| ID | Description | Concrete Artifact the Plan Must Produce |
|----|-------------|-----------------------------------------|
| **GATE-01** | Landing page with framing (who Joe is, what the agent does, three tools) + "I'm an AI, not Joe" disclaimer visible without scroll. | `src/app/page.tsx` renders framing copy + tool trio teaser + disclaimer banner above fold. |
| **GATE-02** | Single-field email gate; inline format validation; submission unlocks chat. | `src/components/EmailGate.tsx` client component; zod `z.email()` validation on blur/change; `/api/session` POST on submit. |
| **GATE-03** | Each session → row in Supabase `sessions` with email, email_domain, hashed IP, user agent, timestamp. | `supabase/migrations/20260421000000_sessions.sql` + `src/app/api/session/route.ts` (Node runtime) using `@supabase/ssr` service-role client + `sha256(ip)` via `node:crypto`. |
| **GATE-04** | Session ID persisted in `sessionStorage`; referenced on every subsequent `/api/chat` request. | `EmailGate.tsx` calls `sessionStorage.setItem('session_id', id)` after 200 response, then `router.push('/chat')`. Phase 2 reads it on `/api/chat`. |
| **GATE-05** | Landing-page copy is engineered (professional, warm, specific) — no breathless tone. | `src/app/page.tsx` copy reviewed against Pitfall 6 anti-patterns; no "Meet my AI!", no emoji-lean, no exclamation-point framing. |
| **CHAT-03** | System prompt loads full KB (<50k tokens) from versioned markdown in `kb/`. | `src/lib/kb-loader.ts` reads `kb/**/*.md` + `kb/profile.yml` at cold start; returns memoized concatenation. |
| **CHAT-04** | System prompt prefix byte-identical between requests (no dynamic content) so Anthropic prompt-caching hits. | `src/lib/system-prompt.ts` pure function; `tests/lib/system-prompt.test.ts` asserts strict equality. **Phase 1 acceptance = the test passes; Phase 2 ships the actual `cache_control` on the API call.** |
| **CHAT-05** | Explicit `cache_control` with non-default TTL on the system prompt. | Phase 1 deliverable: write the system-prompt string so it is cache-ready (no dynamic content). `cache_control: { type: 'ephemeral', ttl: '1h' }` is attached in Phase 2 where `streamText` is wired. **Leave a `// PHASE 2:` comment marker in `lib/system-prompt.ts` showing exactly where the cache breakpoint will attach.** |
| **VOICE-01** | `kb/` contains: `profile.yml`, `resume.md`, `linkedin.md`, `github.md`, `about_me.md`, `management_philosophy.md`, `voice.md`, `stances.md`, `faq.md`, `guardrails.md`, `case_studies/*.md`. | Scaffold created in engineering pass; files populated by Joe via content-acquisition track. |
| **VOICE-02** | 4-6 case studies following the strict template (context / options / decision / outcome / retrospective / likely follow-ups). | `kb/case_studies/*.md` — 4-6 files, each following the YAML-fronted template in spec §4. |
| **VOICE-03** | Coverage rubric satisfied: ≥1 failure, ≥1 leadership-without-authority, ≥1 data-rooted, ≥1 cross-functional conflict, ≥1 recent (<2y), ≥1 long-arc (>12mo). | `01-CONTENT-STATUS.md` rubric-check table populated before Phase 1 exit. |
| **VOICE-04** | `voice.md` has 8-12 authentic samples from informal sources only. | Joe-authored content from voice-interview transcript + unfiltered-source extracts. |
| **VOICE-05** | Voice interview (30-min recorded + transcribed) completed; seeds `voice.md` + 2-3 `stances.md` entries. | Protocol doc `docs/interview-protocol-voice.md`; transcript lives outside repo (Joe's private notes); extracted samples land in `kb/voice.md` and `kb/stances.md`. |
| **VOICE-06** | `stances.md` has 8-12 disagreeable opinions. | Joe-authored; test from spec: "could someone I respect read this and say 'I disagree'?" |
| **VOICE-07** | `faq.md` has 15 canned answers (visa, remote, timezone, comp→redirect, availability, etc.). | Joe-authored. |
| **VOICE-08** | `about_me.md` (400-600 words) + `management_philosophy.md` (600-1000 words). | Joe-authored. |
| **VOICE-09** | `guardrails.md` written by Joe; covers: no fabrication, no salary negotiation, no disparagement, no confidential details, hiring/comp→email redirect. | Joe-authored + Joe-signed before Phase 1 exits. |
| **VOICE-10** | Case studies drafted voice-first (conversational register from first draft). | Interview protocol enforces this; first drafts reviewed for cadence before grammar cleanup. |
| **VOICE-12** | `resume.md` declared SSOT; any PDF/other format generated from it. | Explicit statement in `kb/resume.md` header + `docs/README.md` note for future contributors. |
| **SAFE-11** | System prompt never contains dynamic content (no timestamps, session IDs, per-request data) — cache integrity preserved. | `tests/lib/system-prompt.test.ts` assertions (see CHAT-04). |
| **SAFE-14** | No `NEXT_PUBLIC_` prefix on secrets; pre-commit hook scans for accidental leaks. | `scripts/install-pre-commit-hook.sh` installs the hook at `.git/hooks/pre-commit`; hook blocks on the four patterns in D-D-02. |

</phase_requirements>

## Summary

Phase 1 is scaffolding + content, not computation. Every locked decision in CONTEXT.md is executable against well-documented 2026 patterns — the 6-year-old "Next.js + Supabase + markdown KB" pattern is now ubiquitous enough that there are almost no open technical questions. Research converges on five operational points:

1. **Package versions are current on npm as of 2026-04-21.** `next@16.2.4`, `react@19.2.5`, `typescript@5.9.x` (Next 16 peer), `tailwindcss@4.2.4`, `@supabase/ssr@0.10.2`, `@supabase/supabase-js@2.104.0`, `zod@4.3.6`, `gray-matter@4.0.3`, `js-yaml@4.1.1`, `nanoid@5.1.9`, `date-fns@4.1.0`, `vitest@4.1.5`, `@playwright/test@1.59.1`, `shadcn@4.4.0` (CLI). All verified via `npm view` in the research session. [VERIFIED: npm registry, 2026-04-21]

2. **shadcn/ui + Next 16 + Tailwind v4 works cleanly** when you follow the 2026 setup notes: `create-next-app` with `--tailwind --app --ts --use-npm --eslint --src-dir` produces a Tailwind v4 baseline; `npx shadcn@latest init` is idempotent on top of it; the only real gotcha is the deprecation of `tailwindcss-animate` in favor of `tw-animate-css` (the shadcn CLI handles this on new init, but be sure to use the current CLI version). [CITED: ui.shadcn.com/docs/tailwind-v4]

3. **Vercel AI SDK is NOT a Phase 1 dependency.** There is no chat route yet. Installing `ai` + `@ai-sdk/anthropic` in Phase 1 is cosmetic pre-pollination; prefer to defer to Phase 2 so version pinning happens in the same commit as first use. **Exception:** install `zod@4` now because Phase 1 uses it directly for email validation. [VERIFIED: spec §2, CONTEXT.md D-F-02]

4. **The system-prompt determinism test is the single most load-bearing engineering artifact of Phase 1.** It does not just enforce SAFE-11; it is the test that silently protects against Pitfall 2 (runaway cost from silent cache regression) across the entire product lifetime. The test must assert both (a) string equality across two calls and (b) absence of forbidden patterns (`\d{4}-\d{2}-\d{2}`, `Z$`, `/[0-9a-f]{8}-[0-9a-f]{4}/`, etc.) as a safety net against regex-matchable dynamic content slipping in via a future KB edit. See `## Code Examples` for the recommended test body.

5. **The pre-commit hook pattern is "committed installer, uncommitted hook."** `.git/hooks/` is outside the tracked working tree, so the artifact Joe commits is a shell installer at `scripts/install-pre-commit-hook.sh` that writes the hook to `.git/hooks/pre-commit` and `chmod +x`s it. The installer is idempotent (use `cat > FILE` not `>>`). Human-readable failure messages, exit 1 on match, no allow-list Phase 1. Phase 5 may add a CI-time bundle scan; Phase 1 is the local-commit gate only.

**Primary recommendation:** Execute in this order — (0) scaffold + tooling, (1) supabase migration + env vars + pre-commit hook, (2) `kb/` skeleton + `lib/kb-loader.ts` + `lib/system-prompt.ts` + determinism test, (3) `/api/session` + `EmailGate.tsx` + framing page, (4) `/chat` stub, (5) content acquisition (Joe-time, parallel). The engineering work fits in 1-2 days; content is 10-14 hours of Joe time over 1-2 weeks.

## Standard Stack

### Core

| Library | Version (verified 2026-04-21) | Purpose | Why Standard |
|---------|------------------------------|---------|--------------|
| `next` | `16.2.4` | App Router, server/client components, `/api/*` routes | Default 2026 React framework on Vercel; Turbopack default in 16; App Router is the only path that streams SSE cleanly. [VERIFIED: npm view next version] |
| `react` | `19.2.5` | UI runtime | Bundled peer of Next 16; required for server components. [VERIFIED: npm view react version] |
| `react-dom` | `19.2.5` | Matches React | — |
| `typescript` | `5.9.x` (Next 16 peer) | Strict-mode TypeScript | Required by AI SDK tool schemas in Phase 2; best to set strict mode day 1. [CITED: Next.js 16 docs] |
| `tailwindcss` | `4.2.4` | Styling | CSS-first config via `@theme` in `globals.css`. No JS config file. [VERIFIED: npm view tailwindcss version] |
| `@tailwindcss/postcss` | `4.2.4` | PostCSS plugin for Tailwind v4 | New in v4; replaces the v3 `tailwindcss` PostCSS plugin. [CITED: tailwindcss v4 docs] |
| `shadcn` (CLI, not a runtime dep) | `4.4.0` | Vendors Radix-based components into `src/components/ui/` | Installed via `npx shadcn@latest init`; run-once, components copied into the repo. [VERIFIED: npm view shadcn version] |
| `@supabase/ssr` | `0.10.2` | SSR-safe Supabase client | Replaces the deprecated `@supabase/auth-helpers-nextjs`; exposes `createServerClient` + `createBrowserClient`. Use `auth.getClaims()` not `getSession()` in server code. [VERIFIED: npm view, CITED: supabase.com/docs] |
| `@supabase/supabase-js` | `2.104.0` | Underlying client | Peer of `@supabase/ssr`. [VERIFIED: npm view] |
| `zod` | `4.3.6` | Schema validation | Email validation on gate; env-var parsing; future tool arg schemas (Phase 2+). Use `z.email()` (new in v4) — `z.string().email()` is deprecated. [VERIFIED: npm view + CITED: zod.dev/v4] |
| `gray-matter` | `4.0.3` | YAML frontmatter + markdown parsing for `kb/case_studies/*.md` | Battle-tested (used by Astro, VitePress, Gatsby, Netlify). Ships **built-in TypeScript types** — do NOT install `@types/gray-matter` (does not exist on npm — verified with 404). [VERIFIED: npm view + npm view @types/gray-matter = 404] |
| `js-yaml` | `4.1.1` | Parse `kb/profile.yml` | gray-matter only handles *frontmatter* YAML. For a standalone `.yml` file, use `js-yaml` directly. Install `@types/js-yaml@4.0.9` as a devDep. [VERIFIED: npm view] |
| `nanoid` | `5.1.9` | Generate `session.id` on session creation | URL-safe, ~21-char default; preferred over `crypto.randomUUID()` for user-facing IDs per ARCHITECTURE.md Pattern. [VERIFIED: npm view] |
| `date-fns` | `4.1.0` | Date formatting in admin (later) and transcript views | Tree-shakeable; no runtime like moment. **Phase 1 may not actually use it yet** — install in Phase 1 only if a session-timestamp format is needed in the session-created response; otherwise defer to Phase 2. [VERIFIED: npm view] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/js-yaml` | `4.0.9` | TS types for js-yaml | Always alongside js-yaml. [VERIFIED: npm view] |
| `@types/node` | matches Node 22 | TS types for Node APIs (`node:crypto` hashing) | Bundled by `create-next-app`. [CITED: create-next-app docs] |
| `vitest` | `4.1.5` | Unit tests (`tests/**/*.test.ts`) | Required day 1 for the determinism test (CHAT-04 / SAFE-11). [VERIFIED: npm view] |
| `@vitejs/plugin-react` | `6.0.1` | Vitest React plugin | Needed if any component tests land in Phase 1. Can defer — Phase 1 tests are all lib-level. Install now to avoid churn. [VERIFIED: npm view] |
| `jsdom` | `29.0.2` | Component-test DOM | Same as above — install now if EmailGate gets a unit test in Phase 1. Otherwise defer. [VERIFIED: npm view] |
| `@playwright/test` | `1.59.1` | E2E tests | Installed day 1 per D-A-06 even though first real e2e test is Phase 5. `npx playwright install --with-deps` downloads browsers (~300MB — happens once per machine). [VERIFIED: npm view] |
| `prettier` | `3.8.3` | Format | `create-next-app` ships ESLint config; Prettier is additive. [VERIFIED: npm view] |
| `prettier-plugin-tailwindcss` | `0.7.2` | Class sorting | Official Tailwind plugin; autosorts `className="..."` content. [VERIFIED: npm view] |
| `eslint-config-next` | `16.2.4` | Next-flavored ESLint rules | Bundled by `create-next-app`. [VERIFIED: npm view] |

### Deferred to Phase 2+ (DO NOT install in Phase 1)

| Library | When |
|---------|------|
| `ai` | Phase 2 (`/api/chat` streaming) |
| `@ai-sdk/anthropic` | Phase 2 |
| `@anthropic-ai/sdk` | Phase 2 (Haiku classifier) |
| `@upstash/redis`, `@upstash/ratelimit` | Phase 2 (rate limits + spend cap) |
| `exa-js` | Phase 3 (research_company tool) |
| `resend`, `react-email`, `@react-email/components` | Phase 4 (notifications) |
| `pino` | Phase 3 (OBSV-16) |
| `@tailwindcss/typography` | Phase 3 (case-study prose rendering in the walkthrough tool) |

**Rationale:** Per CONTEXT.md D-F-02, only Supabase env vars are exercised in Phase 1. Installing a library without using it pollutes the lockfile and `package.json` diff when it's actually needed. The `.env.example` (D-F-01) documents the forward view; the lockfile should reflect *current* state.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@supabase/ssr` | `@supabase/auth-helpers-nextjs` | Deprecated — do not use. [VERIFIED: supabase migration docs] |
| `zod@4` | `valibot` | Valibot is ~90% smaller bundle-wise but AI SDK (Phase 2) expects zod schemas. Not worth fragmentation. |
| `gray-matter` | `remark-frontmatter` + `remark-parse` | Unified/remark ecosystem is overkill for reading flat `.md` files with YAML frontmatter. Use it only if a Phase 3+ case study is rendered to HTML inside the app (then add it for MDX). |
| `nanoid` | `crypto.randomUUID()` | UUIDs are 36 chars with dashes; nanoid is 21 chars URL-safe. For admin-dashboard URLs (Phase 4) the shorter form is nicer. Both are collision-resistant at our scale. |
| Install AI SDK in Phase 1 | Defer to Phase 2 | Defer: version locked in same commit as first use; simpler `package.json` diff. |
| `npm` | `pnpm`, `bun` | Locked by D-A-02. |
| `tsx` for scripts | `ts-node` | Defer — Phase 1 has zero script-style TS; `install-pre-commit-hook.sh` is bash, not TS. |

**Installation (Phase 1 command sequence — ready to paste):**

```bash
# 0. Verify Node version (should be 22.x LTS — or >=22 per package.json engines field below)
node --version

# 1. Scaffold in repo root (Joe's cwd is the existing "Agent For Interviews" folder)
#    --src-dir places app/ under src/; --use-npm locks npm; --eslint adds eslint-config-next.
#    (Note: create-next-app will fail if the cwd contains files other than .git / planning docs.
#     Plan must handle this — see `Common Pitfalls` below.)
npx create-next-app@16.2.4 . --typescript --tailwind --app --src-dir --use-npm --eslint --no-turbopack=false --skip-install
npm install

# 2. Runtime deps (Phase 1 only)
npm install @supabase/ssr@0.10.2 @supabase/supabase-js@2.104.0
npm install zod@4.3.6
npm install gray-matter@4.0.3 js-yaml@4.1.1
npm install nanoid@5.1.9

# 3. Dev deps
npm install -D vitest@4.1.5 @vitejs/plugin-react@6.0.1 jsdom@29.0.2
npm install -D @playwright/test@1.59.1
npm install -D @types/js-yaml@4.0.9
npm install -D prettier@3.8.3 prettier-plugin-tailwindcss@0.7.2
npx playwright install --with-deps

# 4. shadcn/ui (vendored into src/components/ui/)
npx shadcn@latest init
#   When prompted:
#     - Style: new-york (recommended for a professional look)
#     - Base color: slate (or whatever matches the engineered-professional copy register)
#     - CSS variables: yes
#   Then add exactly the components Phase 1 needs:
npx shadcn@latest add button card input label
```

**Version verification:** All versions above were confirmed on 2026-04-21 via `npm view <pkg> version`. Pin the majors in `package.json` (`"next": "^16.2.4"`, not `"^16"`) to keep Phase 2's AI SDK install from pulling in a surprise minor.

## Architecture Patterns

### Recommended Project Structure

```
Agent For Interviews/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Server Component — root layout
│   │   ├── page.tsx                # Server Component — framing page
│   │   ├── globals.css             # Tailwind v4 @theme config
│   │   ├── api/
│   │   │   └── session/
│   │   │       └── route.ts        # POST — create session row (Node runtime)
│   │   └── chat/
│   │       └── page.tsx            # Stub — "chat coming in Phase 2" (Client Component — reads sessionStorage)
│   ├── components/
│   │   ├── EmailGate.tsx           # 'use client' — form + validation + /api/session call
│   │   ├── FramingCopy.tsx         # Server Component — static copy
│   │   ├── DisclaimerBanner.tsx    # Server Component — above-fold disclaimer
│   │   └── ui/                     # shadcn vendored (button, card, input, label)
│   └── lib/
│       ├── kb-loader.ts            # Cold-start KB read + memoize
│       ├── system-prompt.ts        # Pure function buildSystemPrompt(): string
│       ├── supabase-server.ts      # createServerClient with service role (server-only)
│       ├── env.ts                  # zod-validated process.env reader
│       └── hash.ts                 # sha256(ip) helper
├── tests/
│   └── lib/
│       ├── system-prompt.test.ts   # CHAT-04 + SAFE-11 determinism test
│       └── kb-loader.test.ts       # KB loads all expected files
├── kb/
│   ├── profile.yml
│   ├── resume.md
│   ├── linkedin.md
│   ├── github.md
│   ├── about_me.md
│   ├── management_philosophy.md
│   ├── voice.md
│   ├── stances.md
│   ├── faq.md
│   ├── guardrails.md
│   ├── brainstorm/
│   │   └── case-study-candidates.md
│   └── case_studies/
│       ├── _fixture_for_tests.md
│       └── <4-6 real case studies>.md
├── supabase/
│   └── migrations/
│       └── 20260421000000_sessions_messages.sql
├── scripts/
│   └── install-pre-commit-hook.sh
├── docs/
│   ├── interview-protocol-voice.md
│   ├── interview-protocol-selection.md
│   └── interview-protocol-case-study.md
├── .env.example
├── .env.local                       # Joe-created, gitignored
├── .gitignore                       # Next.js default (verify .env*.local ignored)
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── next.config.ts                   # Next 16 default
├── postcss.config.mjs               # @tailwindcss/postcss plugin
└── CLAUDE.md                        # (optional) project instructions
```

### Pattern 1: Pure-Function System Prompt with Forbidden-Pattern Guard

**What:** `buildSystemPrompt()` is a pure function that concatenates static strings in a deterministic order. It reads the KB via a module-memoized `loadKB()` which hits the filesystem **once** per process (cold start) and never again.

**When to use:** Always — this is the whole SAFE-11 / CHAT-04 contract.

**Example:**
```typescript
// src/lib/system-prompt.ts
// Source: ARCHITECTURE.md Pattern 1 + CONTEXT.md D-E-01..06
import { loadKB } from './kb-loader';

const IDENTITY = `You are Joe Dollinger's agent. Speak in first person as Joe.
This is a public, recruiter-facing chat attached to Joe's resume.`;

const VOICE_RULES = `VOICE RULES
- Never open with "Great question" or any compliment to the asker.
- Banned vocabulary: leverage, robust, comprehensive, holistic, synergy, align (verb), drive (verb).
- No bulleted lists unless explicitly asked for a list.
- No markdown headers in chat replies.
- Always use contractions.
- Take positions; "I think X" not "some people might argue X."
- Say "I don't know" — never "it depends."
- Vary sentence length deliberately.
- Default to <120 words per reply; go longer only when the user asks for depth.`;

const HALLUCINATION_RULES = `HALLUCINATION RULES
- If something is not in the knowledge base, say "I don't know" or "I don't think Joe has talked about that with me."
- Never invent roles, dates, metrics, tools, companies, or outcomes.
- For case-study-type questions, draw only from the <!-- kb: case_studies --> section.`;

const TOOL_GUIDANCE_PLACEHOLDER = `<!-- TOOL DESCRIPTIONS: auto-generated by AI SDK in Phase 2 -->`;

// PHASE 2: the cache_control: { type: 'ephemeral', ttl: '1h' } breakpoint
// attaches to the `system` block in /api/chat/route.ts. The string returned
// by buildSystemPrompt() IS the cached block — keep it byte-identical.
export function buildSystemPrompt(): string {
  const kb = loadKB();
  return [
    IDENTITY,
    VOICE_RULES,
    HALLUCINATION_RULES,
    TOOL_GUIDANCE_PLACEHOLDER,
    kb,
  ].join('\n\n');
}
```

```typescript
// src/lib/kb-loader.ts
// Source: CONTEXT.md D-E-05 + ARCHITECTURE.md Pattern 1
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import yaml from 'js-yaml';

const KB_ROOT = path.join(process.cwd(), 'kb');

// Order is load-bearing: determines the byte sequence of the cached block.
// Changing this order invalidates every session's cache prefix on deploy.
const FILE_ORDER = [
  'profile.yml',          // YAML parsed separately
  'resume.md',
  'linkedin.md',
  'github.md',
  'about_me.md',
  'management_philosophy.md',
  'voice.md',
  'stances.md',
  'faq.md',
  'guardrails.md',
];

let cached: string | null = null;

export function loadKB(): string {
  if (cached !== null) return cached;

  const parts: string[] = [];

  for (const rel of FILE_ORDER) {
    const abs = path.join(KB_ROOT, rel);
    const raw = readFileSync(abs, 'utf-8');
    if (rel.endsWith('.yml')) {
      const parsed = yaml.load(raw);
      parts.push(`<!-- kb: ${path.basename(rel, '.yml')} -->\n${JSON.stringify(parsed, null, 2)}`);
    } else {
      // gray-matter gives us { data, content } — we embed frontmatter as comments
      // so the model sees slug/hook/role without having to parse YAML itself.
      const { data, content } = matter(raw);
      const slug = path.basename(rel, '.md');
      const meta = Object.keys(data).length ? `<!-- meta: ${JSON.stringify(data)} -->\n` : '';
      parts.push(`<!-- kb: ${slug} -->\n${meta}${content.trim()}`);
    }
  }

  // Case studies: deterministic sort, skip files starting with _ (fixtures)
  // Source: CONTEXT.md specifics — fixture file excluded from production listing
  const caseDir = path.join(KB_ROOT, 'case_studies');
  const caseFiles = readdirSync(caseDir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .sort(); // lexicographic — byte-identical across machines

  for (const f of caseFiles) {
    const raw = readFileSync(path.join(caseDir, f), 'utf-8');
    const { data, content } = matter(raw);
    const slug = data.slug ?? path.basename(f, '.md');
    parts.push(`<!-- kb: case_study/${slug} -->\n<!-- meta: ${JSON.stringify(data)} -->\n${content.trim()}`);
  }

  cached = parts.join('\n\n');
  return cached;
}

// Test-only: let Vitest reset the cache between test runs.
export function __resetKBCacheForTests(): void {
  cached = null;
}
```

### Pattern 2: Zod-Validated Environment Parsing

**What:** Read and validate `process.env` once, at module load, in a single file. Every other module imports typed constants from `env.ts`.

**When to use:** Always. Prevents the "env var is undefined in production" surprise.

**Example:**
```typescript
// src/lib/env.ts
import { z } from 'zod';

const EnvSchema = z.object({
  // Supabase (Phase 1)
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  // Future-phase placeholders (made optional in Phase 1; required later)
  ANTHROPIC_API_KEY: z.string().optional(),
  EXA_API_KEY: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
});

export const env = EnvSchema.parse(process.env);
```

### Pattern 3: Server-Only Supabase Client

**What:** `supabase-server.ts` exports a singleton created with the **service role key** for the `/api/session` INSERT. RLS is the defense layer in depth; the INSERT runs from server code with service role so it bypasses RLS — which is the correct pattern for a server-controlled write.

**When to use:** Phase 1 only for the session INSERT. Phase 2+ adds more tables.

**Example:**
```typescript
// src/lib/supabase-server.ts
import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Service-role client — server-only. NEVER import this into a Client Component.
// @supabase/ssr's createServerClient is for auth flows with cookies;
// for a pure server INSERT we can use the plain supabase-js createClient.
export const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
```

### Anti-Patterns to Avoid

- **Reading `process.env` inside `buildSystemPrompt()`.** Any env var that differs between preview and prod (even a harmless "build version") will break cache equality. Pull from the KB or from static strings only. If a Phase 2 decision truly needs something env-derived in the system prompt, it goes in `messages`, not `system`.
- **Using a Date or timestamp in `about_me.md`** ("Today is April 21, 2026..."). KB content is static text; don't template-ize it.
- **Using `@supabase/ssr` for a service-role server INSERT.** `@supabase/ssr` is designed for auth-aware cookie-based flows. A simple server INSERT that bypasses RLS wants the vanilla `supabase-js` client with the service role key. Save `@supabase/ssr` for the Phase 4 admin auth.
- **Reading the KB per request.** `loadKB` must memoize in module scope. Re-reading the filesystem on every `/api/chat` call (Phase 2) defeats the cache and adds ~10-40ms of filesystem latency.
- **Gluing `.env.local` via `>>`** in the install script. The file should be idempotent — user re-runs the script, gets the same content, not three copies stacked.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email format validation | Custom regex | `zod@4`'s `z.email()` | Tested, current standard. `z.string().email()` is deprecated in zod v4. [CITED: zod.dev/v4] |
| YAML frontmatter parsing | `JSON.parse` after splitting on `---` | `gray-matter` | Handles edge cases (`---` inside content, TOML/YAML detection, excerpt support). [CITED: gray-matter GitHub] |
| Standalone YAML file parsing | Regex | `js-yaml` (safeLoad-equivalent) | `profile.yml` is a full YAML doc, not frontmatter. gray-matter is the wrong tool. [VERIFIED: gray-matter README] |
| Session ID generation | `Math.random().toString(36)` | `nanoid` | Crypto-quality randomness, URL-safe. [CITED: nanoid README] |
| IP hashing | Hand-rolled SHA256 | `node:crypto` `createHash('sha256')` | Built-in; see Code Example below. |
| Pre-commit secret scanning framework | `pre-commit` python tool | A ~30-line bash script installed via `scripts/install-pre-commit-hook.sh` | CONTEXT.md D-D-04 locks this — avoids python dep. |
| Tailwind CSS variable setup | Writing custom CSS | `shadcn@latest init` | Generates `@theme` block in `globals.css` correctly. [CITED: ui.shadcn.com] |
| "Chat" UI scaffold | Custom CSS + React state | Defer — Phase 1 `/chat` is a stub | Phase 2 uses `ai`'s `useChat`. Don't pre-build a scaffold Phase 2 will throw away. |
| Supabase schema migrations | Manual SQL pasted into Supabase UI | `supabase/migrations/*.sql` file tracked in git + `supabase db push` or Supabase dashboard "Run SQL" | Git-tracked schema is required for rollback + Phase 2's migration on top. |

**Key insight:** Phase 1 has no novel algorithms. Every capability maps to a published library or a one-line built-in. Custom code should be < 300 lines of application logic total (lib/ + api/ + components/), excluding shadcn-vendored UI and markdown content.

## Runtime State Inventory

**Not applicable** — Phase 1 is greenfield. There is no pre-existing runtime state to migrate, rename, or preserve. (If the `docs/superpowers/plans/` draft had left behind stale Next.js artifacts, this section would flag them — but STATE.md confirms the repo has only planning docs today.)

## Common Pitfalls

### Pitfall 1: `create-next-app` fails because the cwd is not empty

**What goes wrong:** Joe's cwd already contains `.planning/`, `docs/`, `.agents/`, `CLAUDE.md`, etc. Stock `npx create-next-app@latest .` will abort with "The directory is not empty."

**Why it happens:** `create-next-app` refuses to overwrite existing files by default (safety feature).

**How to avoid:** Use `create-next-app`'s `--empty` flag or manually scaffold:
- Option A (cleanest): run `create-next-app` in a sibling dir (`../joe-agent-scaffold`), then `mv` the scaffolded files into the project root. Merge `.gitignore` carefully. Delete the sibling.
- Option B: add `--skip-install` + use `create-next-app` with a fresh subdir name (`joe-agent-temp`), cherry-pick the config files (`next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`, `src/app/*`, `src/app/globals.css`, `package.json`) and copy them in.
- Option C (if create-next-app supports it in 16.2.x): `npx create-next-app@16.2.4 . --typescript --tailwind --app --src-dir --use-npm --eslint --yes --disable-git --skip-install` — passes `--yes` for defaults and hopes cwd-not-empty is handled. **Verify this before the planner codifies it.**

**Warning signs:** "EEXIST: file already exists, mkdir ..." or "Directory is not empty" on scaffold step.

**Recommendation for the plan:** Make Task 1 a preflight that moves the planning artifacts into a temp dir, scaffolds, then moves them back. This is straightforward in a bash one-liner but the plan must call it out explicitly — it's the first sharp edge of Phase 1.

### Pitfall 2: `@types/gray-matter` does not exist on npm

**What goes wrong:** Developer instinctively runs `npm install -D @types/gray-matter` and gets a 404.

**Why it happens:** gray-matter ships its own types in the package.

**How to avoid:** Don't install `@types/gray-matter`. Just `import matter from 'gray-matter'`; types resolve from the package itself. [VERIFIED: `npm view @types/gray-matter version` → 404]

### Pitfall 3: shadcn init produces `tailwindcss-animate` but 2026 shadcn uses `tw-animate-css`

**What goes wrong:** Following an outdated tutorial leaves `tailwindcss-animate` in `globals.css` (`@plugin 'tailwindcss-animate'`). The 2026 shadcn CLI has migrated to `tw-animate-css`.

**Why it happens:** Tutorials from 2024-2025 still reference `tailwindcss-animate`.

**How to avoid:**
- Always use the current `shadcn@latest` CLI; do not copy-paste `globals.css` from older tutorials.
- If upgrading an existing scaffold, remove `@plugin 'tailwindcss-animate'`, `npm uninstall tailwindcss-animate`, `npm install -D tw-animate-css`, and add `@import "tw-animate-css"` to `globals.css`. [CITED: ui.shadcn.com/docs/tailwind-v4]

**Warning signs:** Any shadcn component animation (dialog fade-in, accordion slide) not working out of the box.

### Pitfall 4: `.gitignore` is missing `.env*.local`

**What goes wrong:** Joe's Supabase service-role key ends up in git history.

**Why it happens:** Next.js 16's `create-next-app` default `.gitignore` **does** include `.env*.local` (verified — see sources below), but a hand-crafted gitignore or one inherited from an older Next.js tutorial may not.

**How to avoid:** Verify after scaffold. The `.gitignore` generated by `create-next-app@16.x` now also ignores all `.env` files by default (PR #61920 landed). Grep for `.env` in the generated `.gitignore`; expect to see `.env*` or `.env*.local`. [CITED: github.com/vercel/next.js/pull/61920]

**Redundant belt-and-suspenders:** The pre-commit hook's rule D-D-02 fourth line blocks any `.env*.local` from being staged. If `.gitignore` and the hook both catch it, the leak is structurally impossible.

### Pitfall 5: System-prompt determinism test passes on a machine, fails in CI because `readdirSync` returns files in different order

**What goes wrong:** `readdirSync` on Linux returns files in inode order; on macOS APFS in name order; on Windows NTFS in creation order. Without an explicit sort, the case-studies concatenation is non-deterministic across OSes.

**Why it happens:** `readdirSync` has no documented ordering contract.

**How to avoid:** Always `.sort()` the output of `readdirSync`. See `kb-loader.ts` in Code Examples — the `caseFiles.sort()` call is load-bearing. Add a test that monkey-patches `readdirSync` to reverse the order and asserts the same output.

**Warning signs:** Local `npm test` passes; CI fails on `buildSystemPrompt() === buildSystemPrompt()` assertion.

### Pitfall 6: `z.email()` error messages look terrible in the gate UI

**What goes wrong:** `z.email()` default error is "Invalid email address" with no context. On a recruiter-facing gate, that reads robotic.

**Why it happens:** zod v4's new string-format functions prioritize correctness over UX.

**How to avoid:**
```typescript
const EmailSchema = z.email({ message: "That doesn't look like a valid email — try again?" });
```
Use one error for empty (`"Please enter an email."`) and one for malformed (`"That doesn't look like a valid email."`). The gate validates on `onBlur` (not `onChange`) to avoid flashing errors while the user is still typing. [CITED: zod.dev/v4]

### Pitfall 7: Supabase RLS blocks the anon-client INSERT

**What goes wrong:** `/api/session` uses the anon key and RLS is enabled on `sessions` — the INSERT 403s.

**Why it happens:** RLS requires an explicit policy allowing the `anon` role to INSERT.

**How to avoid:** Use the **service-role** client for server-only writes (see `supabaseAdmin` in Pattern 3). Service role bypasses RLS. This is the right pattern when the write is server-initiated and the user doesn't have a Supabase auth session (they don't — Phase 1 has no login). **Phase 4** (admin dashboard) will add `@supabase/ssr` and `auth.getClaims()` with RLS policies; Phase 1 does not need them. [CITED: supabase.com/docs/guides/database/postgres/row-level-security]

**Warning signs:** `/api/session` returns 500 with `{ error: 'new row violates row-level security policy for table "sessions"' }`.

### Pitfall 8: Installing pre-commit hook via `>>` appends multiple times

**What goes wrong:** Joe runs `scripts/install-pre-commit-hook.sh` twice; now the hook has two copies of every rule.

**How to avoid:** The installer writes with `cat > FILE` (single `>`), not `>>`. Idempotent on every run.

## Code Examples

### System-prompt determinism test (CHAT-04 + SAFE-11)

```typescript
// tests/lib/system-prompt.test.ts
// Verifies: D-E-04 assertions + forbidden-pattern regex guard.
import { describe, it, expect, beforeEach } from 'vitest';
import { buildSystemPrompt } from '../../src/lib/system-prompt';
import { __resetKBCacheForTests } from '../../src/lib/kb-loader';

describe('buildSystemPrompt determinism', () => {
  beforeEach(() => {
    __resetKBCacheForTests();
  });

  it('is byte-identical across invocations (strict equality)', () => {
    const a = buildSystemPrompt();
    const b = buildSystemPrompt();
    expect(a).toBe(b); // reference equality — same string object (memoized KB)
    // Belt-and-suspenders: also check deep equality after cache reset.
    __resetKBCacheForTests();
    const c = buildSystemPrompt();
    expect(a).toEqual(c);
  });

  it('contains all required KB section markers', () => {
    const p = buildSystemPrompt();
    expect(p).toMatch(/<!-- kb: resume -->/);
    expect(p).toMatch(/<!-- kb: guardrails -->/);
    expect(p).toMatch(/<!-- kb: voice -->/);
    expect(p).toMatch(/VOICE RULES/);
    expect(p).toMatch(/HALLUCINATION RULES/);
  });

  it('falls within sanity length bounds', () => {
    const p = buildSystemPrompt();
    expect(p.length).toBeGreaterThan(500);
    expect(p.length).toBeLessThan(200_000);
  });

  it('contains no dynamic content patterns (SAFE-11 guard)', () => {
    const p = buildSystemPrompt();
    // No ISO timestamps: 2026-04-21T14:02:00Z
    expect(p).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    // No UUIDs: 550e8400-e29b-41d4-a716-446655440000
    expect(p).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    // No 21-char nanoid-shaped strings preceded by "session"
    expect(p).not.toMatch(/session[_-]?id[:\s=]+[A-Za-z0-9_-]{10,25}/i);
    // Note: date *content* in about_me.md / resume.md is allowed (2018–2024 role dates).
    //       What's forbidden is per-request dynamic insertion. A static calendar date
    //       in a markdown file is fine. This regex catches timestamp-style injection.
  });
});
```

### `/api/session` route (GATE-03)

```typescript
// src/app/api/session/route.ts
// Source: CONTEXT.md GATE-03 + Pitfall 9 (use trusted IP header)
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs'; // NOT edge — Pitfall 2 in ARCHITECTURE anti-patterns

const BodySchema = z.object({
  email: z.email(),
});

function hashIp(ip: string | null): string {
  if (!ip) return 'unknown';
  return createHash('sha256').update(ip).digest('hex');
}

function emailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() ?? '';
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email.' }, { status: 400 });
  }

  // Trusted IP header — Vercel sets x-forwarded-for; in Phase 1 we accept it.
  // Phase 2 will switch to the @vercel/functions ipAddress() helper.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = req.headers.get('user-agent') ?? '';

  const session = {
    id: nanoid(),
    email: parsed.data.email,
    email_domain: emailDomain(parsed.data.email),
    ip_hash: hashIp(ip),
    user_agent: userAgent,
    // created_at: database default (NOW())
  };

  const { error } = await supabaseAdmin.from('sessions').insert(session);
  if (error) {
    console.error('session insert failed', error);
    return NextResponse.json({ error: 'Could not start session.' }, { status: 500 });
  }

  return NextResponse.json({ id: session.id });
}
```

### EmailGate client component (GATE-02 + GATE-04 + GATE-05)

```typescript
// src/components/EmailGate.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const EmailSchema = z.email({
  message: "That doesn't look like a valid email — try again?",
});

export function EmailGate() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const result = EmailSchema.safeParse(email);
  const showInlineError = touched && !result.success && email.length > 0;
  const inlineError = showInlineError ? result.error.issues[0]?.message : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!result.success || submitting) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setServerError(body.error ?? 'Something went wrong. Try again?');
        return;
      }
      const { id } = await res.json();
      sessionStorage.setItem('session_id', id);
      router.push('/chat');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-sm">
      <Label htmlFor="email">Who are you? (so Joe can follow up if you're hiring)</Label>
      <Input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder="you@company.com"
        aria-invalid={!!inlineError}
        aria-describedby={inlineError ? 'email-error' : undefined}
        disabled={submitting}
      />
      {inlineError && (
        <p id="email-error" className="text-sm text-red-600">{inlineError}</p>
      )}
      {serverError && (
        <p className="text-sm text-red-600">{serverError}</p>
      )}
      <Button type="submit" disabled={!result.success || submitting}>
        {submitting ? 'Starting…' : "Let's chat"}
      </Button>
    </form>
  );
}
```

### Pre-commit hook installer (SAFE-14 + D-D-01..04)

```bash
# scripts/install-pre-commit-hook.sh
#!/usr/bin/env bash
# Source: CONTEXT.md D-D-01..04
# Installs a pre-commit hook that blocks accidental secret commits.
# Idempotent — safe to re-run.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "")"
if [[ -z "$REPO_ROOT" ]]; then
  echo "error: not inside a git repo" >&2
  exit 1
fi

HOOK_PATH="$REPO_ROOT/.git/hooks/pre-commit"

cat > "$HOOK_PATH" <<'HOOK_EOF'
#!/usr/bin/env bash
# pre-commit hook — secret scanning (auto-generated; edit scripts/install-pre-commit-hook.sh to change)
set -euo pipefail

# Patterns we block (CONTEXT.md D-D-02):
#   1. NEXT_PUBLIC_.*(KEY|SECRET|TOKEN|PASSWORD|PASS)
#   2. Raw Anthropic keys:        sk-ant-[A-Za-z0-9_-]+
#   3. Supabase service-role JWT: eyJ[...].[...].[...]
#   4. Any staged .env*.local file

# (4) Block staged .env*.local files outright
staged_files="$(git diff --cached --name-only --diff-filter=ACMR)"
if [[ -n "$staged_files" ]]; then
  while IFS= read -r f; do
    if [[ "$f" =~ (^|/)\.env.*\.local$ ]]; then
      echo "error: attempting to commit '$f' — .env*.local files are gitignored for a reason." >&2
      echo "       If this is intentional, remove the file from staging: git reset HEAD '$f'" >&2
      exit 1
    fi
  done <<< "$staged_files"
fi

# (1) (2) (3) Scan staged content for forbidden patterns
# We use git diff --cached (only staged changes) and look at added lines only (+).
diff_output="$(git diff --cached -U0 --no-color -- ':(exclude).env.example' ':(exclude)scripts/install-pre-commit-hook.sh' || true)"

if [[ -z "$diff_output" ]]; then
  exit 0
fi

check_pattern() {
  local pattern="$1"
  local label="$2"
  # grep -E for ERE; -n for line numbers inside the diff; only check added lines.
  # Added lines start with '+' (but not '+++' which are diff headers).
  matches="$(printf '%s\n' "$diff_output" | grep -E "^\+[^+].*$pattern" || true)"
  if [[ -n "$matches" ]]; then
    echo "error: commit blocked — detected $label in staged changes:" >&2
    echo "$matches" | head -5 >&2
    echo "" >&2
    echo "       If this is a false positive (e.g. a documentation example)," >&2
    echo "       rephrase the line. There is no --no-verify escape hatch for a reason." >&2
    return 1
  fi
  return 0
}

fail=0
check_pattern 'NEXT_PUBLIC_[A-Z_]*(KEY|SECRET|TOKEN|PASSWORD|PASS)' 'NEXT_PUBLIC_ secret name' || fail=1
check_pattern 'sk-ant-[A-Za-z0-9_-]{20,}' 'Anthropic API key (sk-ant-*)' || fail=1
check_pattern 'eyJ[A-Za-z0-9._-]{50,}\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+' 'JWT (possible Supabase service-role key)' || fail=1

exit $fail
HOOK_EOF

chmod +x "$HOOK_PATH"
echo "installed pre-commit hook at $HOOK_PATH"
echo "test it by staging a file containing 'sk-ant-XXXXXXXXXXXXXXXXXXXX' and trying to commit."
```

**Self-test:** The installer script itself would trigger the hook if committed as-is (it literally contains the `sk-ant-` and `NEXT_PUBLIC_` patterns). The `:(exclude)scripts/install-pre-commit-hook.sh` pathspec inside the hook exempts it. Verify this exclusion works by running `git diff --cached -U0 -- ':(exclude)scripts/install-pre-commit-hook.sh'` against a staged version.

### Supabase migration — sessions + messages (GATE-03, future-proofed for Phase 2)

```sql
-- supabase/migrations/20260421000000_sessions_messages.sql
-- Source: GATE-03 + ARCHITECTURE.md Data Flow storage table
-- This migration creates both `sessions` and `messages` up front even though
-- Phase 1 only uses `sessions` — to avoid a migration-on-migration in Phase 2.

create table if not exists public.sessions (
  id             text primary key,              -- nanoid, not UUID (shorter URLs)
  email          text not null,
  email_domain   text not null,
  ip_hash        text not null,                 -- sha256 hex
  user_agent     text not null default '',
  created_at     timestamptz not null default now(),
  ended_at       timestamptz,
  turn_count     int not null default 0,
  flagged        boolean not null default false, -- admin toggle (Phase 4)

  -- Phase 2+ additions are nullable so this migration covers them:
  total_input_tokens   int not null default 0,
  total_output_tokens  int not null default 0,
  total_cache_read_tokens int not null default 0,
  total_cost_cents     int not null default 0
);

create index if not exists sessions_email_domain_idx on public.sessions (email_domain);
create index if not exists sessions_created_at_idx   on public.sessions (created_at desc);

-- messages table — empty in Phase 1, populated in Phase 2
create table if not exists public.messages (
  id               text primary key,            -- app-generated nanoid (CHAT-12)
  sdk_message_id   text,                        -- AI SDK ID (secondary, for correlation)
  session_id       text not null references public.sessions(id) on delete cascade,
  role             text not null check (role in ('user', 'assistant', 'tool', 'system')),
  content          text not null,
  tool_name        text,
  tool_args        jsonb,
  tool_result      jsonb,
  classifier_verdict text,                      -- 'normal' | 'injection' | 'offtopic' | 'sensitive'
  classifier_confidence numeric,
  input_tokens     int not null default 0,
  output_tokens    int not null default 0,
  cache_read_tokens int not null default 0,
  cache_creation_tokens int not null default 0,
  cost_cents       int not null default 0,
  latency_ms       int,
  stop_reason      text,
  created_at       timestamptz not null default now()
);

create index if not exists messages_session_id_idx on public.messages (session_id, created_at);
create index if not exists messages_classifier_idx on public.messages (classifier_verdict) where classifier_verdict <> 'normal';

-- RLS: enable on both, but we deliberately do NOT create policies in Phase 1.
-- All writes happen server-side via the service-role client (bypasses RLS).
-- Phase 4 (admin dashboard) will add SELECT policies for authenticated admin users.
alter table public.sessions enable row level security;
alter table public.messages enable row level security;

comment on table public.sessions is 'One row per email-gated recruiter session. Service-role INSERT only.';
comment on table public.messages is 'Appended by /api/chat onFinish (Phase 2). Service-role INSERT only. No client-side writes.';
```

### `.env.example` (D-F-01)

```bash
# .env.example
# Copy to .env.local and fill in real values. .env.local is gitignored.
# Phase 1 only uses the first three. Other variables are placeholders documenting the full forward view.

# --- Supabase (Phase 1) ---
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key...
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key-SERVER-ONLY...

# --- Anthropic (Phase 2) ---
ANTHROPIC_API_KEY=sk-ant-...

# --- Exa (Phase 3) ---
EXA_API_KEY=

# --- Upstash Redis (Phase 2) ---
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=

# --- Resend (Phase 4) ---
RESEND_API_KEY=

# --- Admin (Phase 4) ---
ADMIN_GITHUB_USERNAMES=joe-dollinger  # comma-separated allowlist
```

### `kb/_fixture_for_tests.md` (case-study fixture — CONTEXT.md specifics)

```markdown
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
```

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Next.js runtime | ✓ | v25.9.0 (local) | — |
| npm | Package manager | ✓ | 11.12.1 | — |
| git | Repo + pre-commit hook install | ✓ | 2.43.0.windows.1 | — |
| Bash | Pre-commit hook + installer shell script | ✓ (Git Bash / mingw64 on Joe's Windows) | GNU Bash 5.x via Git Bash | — |
| Supabase project | `/api/session` INSERT | ✓ (per CONTEXT.md — Joe has created the project and rotated the secret key) | Current | — |
| Supabase CLI | Running migrations locally | ⚠ Not verified on this machine | n/a | Fallback: paste migration SQL into Supabase dashboard "SQL Editor". Plan should use dashboard path to avoid requiring CLI install. |

**Notes and blockers:**

- **Node 22 LTS vs installed Node 25.9.0:** Joe's machine runs Node 25.9.0 (latest). Vercel's production Node runtime is 22.x LTS (per CONTEXT.md D-A-03). For Phase 1 this is *fine* — nothing in the scaffold breaks on a newer Node — but the plan should declare `"engines": { "node": ">=22.11.0" }` in `package.json` and use `nvm use 22` or similar when publishing to ensure preview/prod parity. Not a blocker.
- **Windows + shell scripts:** The pre-commit hook is bash. Git for Windows ships Git Bash, which will execute `.git/hooks/pre-commit` correctly. No blocker.
- **Supabase CLI not required for Phase 1.** Migration can be pasted into the dashboard. If Joe wants `supabase db push` later, that's a Phase 2 concern.

**No blocking dependencies.**

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | **Vitest 4.1.5** (unit/lib) + **Playwright 1.59.1** (e2e, installed but not exercised until Phase 5) |
| Config file | `vitest.config.ts` (to be created — Wave 0 gap) + `playwright.config.ts` (Wave 0 gap) |
| Quick run command | `npm test` → alias for `vitest run` |
| Full suite command | `npm run test:all` → `vitest run && playwright test` (Playwright no-ops in Phase 1) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| CHAT-04 / SAFE-11 | `buildSystemPrompt()` returns byte-identical output | unit | `vitest run tests/lib/system-prompt.test.ts` | ❌ Wave 0 |
| CHAT-03 | KB loader reads all 10 required files + case studies | unit | `vitest run tests/lib/kb-loader.test.ts` | ❌ Wave 0 |
| GATE-02 | `z.email()` validates on blur, rejects malformed | unit | `vitest run tests/components/email-gate.test.tsx` | ❌ Wave 0 (optional — can defer to Phase 5 Playwright) |
| GATE-03 | `/api/session` creates a row (happy path) | integration (manual for Phase 1) | `curl -X POST ... /api/session` — manual smoke | manual |
| GATE-01 / GATE-05 | Framing page renders disclaimer above fold | manual (Phase 1) / Playwright (Phase 5) | `npx playwright test` (deferred) | ❌ Wave 0 stub |
| GATE-04 | sessionStorage key set after successful submit | manual (Phase 1) / Playwright (Phase 5) | — | deferred |
| SAFE-14 | Pre-commit hook blocks `sk-ant-*` insertion | shell test | `scripts/test-pre-commit-hook.sh` (optional) | ❌ optional |
| VOICE-* | Content existence + coverage rubric | human checklist in `01-CONTENT-STATUS.md` | manual | to be created |

### Sampling Rate

- **Per task commit:** `npm test` (vitest only — fast, <5s). The pre-commit hook does NOT run tests in Phase 1 (too slow to run on every commit; planner may choose to add in Phase 5 via husky or similar).
- **Per wave merge:** `npm test` green; manual smoke of framing page + email gate in local browser.
- **Phase gate:** All vitest tests green; Joe-signed `guardrails.md`; content-status checklist fully checked; framing page rendered with engineered copy reviewed by Joe.

### Wave 0 Gaps

- [ ] `vitest.config.ts` — basic config, resolve `@/` alias to `src/`
- [ ] `playwright.config.ts` — stub config, browsers=chromium only
- [ ] `tests/lib/system-prompt.test.ts` — covers CHAT-04 + SAFE-11 (see Code Examples)
- [ ] `tests/lib/kb-loader.test.ts` — covers CHAT-03 (asserts all 10 required files read)
- [ ] `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:e2e": "playwright test"`

No test framework install needed beyond the packages listed in Standard Stack.

## Security Domain

> Security enforcement is enabled (no `security_enforcement: false` found in `.planning/config.json`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V1 Architecture | yes | Server components default; client components explicitly marked `'use client'`; service-role key never imported into a client component (enforced by convention + bundle scan in Phase 5). |
| V2 Authentication | deferred | Phase 1 has no user auth (email gate is not authentication — it's a soft identity capture). Phase 4 adds Supabase Auth + GitHub OAuth for admin. |
| V3 Session Management | partial | `sessionStorage` used as chat-session carrier (not auth session). `session.id` is a nanoid, not user-guessable in the cryptographic sense but not a security token either — it's a lookup key for server-side rows. No PII besides email. |
| V4 Access Control | yes | Supabase RLS enabled on both tables; writes only via service-role key from server. Admin SELECT policies deferred to Phase 4. |
| V5 Input Validation | yes | `zod@4` on email input (API + client); `zod@4.email()` format check. Request body parsed via `BodySchema.safeParse` — invalid input returns 400, never reaches Supabase. |
| V6 Cryptography | yes | `node:crypto` `createHash('sha256')` for IP hashing (never hand-rolled). |
| V7 Error Handling & Logging | partial | `/api/session` returns generic error strings to client; real errors to `console.error`. Phase 3 adds Pino structured logging (OBSV-16). Phase 1 is acceptable with `console.error`. |
| V8 Data Protection | yes | IP hashed at ingest, never stored raw. Service-role key only in server-side env. `.env*.local` gitignored + pre-commit hook. |
| V9 Communications | yes | HTTPS enforced by Vercel. No custom TLS handling. |
| V13 API & Web Service | yes | `/api/session` rejects invalid content types; only accepts POST. Phase 2 adds rate limits on `/api/chat`. |
| V14 Configuration | yes | Env vars validated at module load via zod (`lib/env.ts`). `NEXT_PUBLIC_*` prefix reserved for safe-to-expose values. |

### Known Threat Patterns for this Stack (Phase 1 surface)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via Supabase | Tampering | `supabase-js` parameterizes all queries; no raw SQL from user input. |
| Secret leak via `NEXT_PUBLIC_` prefix | Information Disclosure | Pre-commit hook blocks (D-D-02); `lib/env.ts` schema marks secret fields as non-`NEXT_PUBLIC_`. |
| Secret leak via committed `.env.local` | Information Disclosure | `.gitignore` (Next.js default) + pre-commit hook rule #4. |
| Email enumeration via `/api/session` timing | Information Disclosure | Not applicable — Phase 1 accepts any new email; no "already exists" signal. |
| IP spoofing to bypass future rate limits | Spoofing | Phase 1 only hashes IP for storage; Phase 2 switches to `@vercel/functions` `ipAddress()`. Plan must note this for Phase 2 handoff. |
| XSS in framing page | Tampering | Next.js + React auto-escape. No `dangerouslySetInnerHTML` anywhere in Phase 1. |
| CSRF on `/api/session` | Tampering | Same-origin policy + fetch with `Content-Type: application/json` requires preflight for cross-origin. Phase 1 accepts this (no CSRF token). Phase 2 may add a token if abuse emerges. |
| Open redirect via `sessionStorage` key | Tampering | `/chat` page reads `sessionStorage.getItem('session_id')`; never redirects based on user-supplied URL. |
| Service-role key in client bundle | Information Disclosure | `lib/supabase-server.ts` only imported by `app/api/*/route.ts`; bundle scan in Phase 5 will verify. Convention: any file starting with `supabase-server` must only be imported from `app/api/`. |

## State of the Art

| Old Approach | Current (2026-04) Approach | When Changed | Impact |
|--------------|----------------------------|--------------|--------|
| `create-next-app` defaults to Pages Router | App Router default + Turbopack | Next 14+ | Spec already locks App Router; no impact. |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` + `auth.getClaims()` | 2024 | Deferred to Phase 4; Phase 1 uses vanilla `supabase-js` service-role client. |
| `z.string().email()` | `z.email()` | zod v4 | Use `z.email()`. |
| `tailwindcss-animate` in shadcn init | `tw-animate-css` | shadcn 2026 CLI | Use current `shadcn@latest`; don't copy-paste old tutorials. |
| `tailwind.config.js` / `.ts` | CSS-first `@theme` directive in `globals.css` | Tailwind v4 | No JS config file in Phase 1. |
| `crypto.randomUUID()` for URL-visible IDs | `nanoid` | — | CONTEXT.md pattern + ARCHITECTURE.md preference. |
| `.gitignore` manually lists `.env.local` | Next.js `create-next-app` ignores all `.env` by default | PR #61920, 2024 | Verify after scaffold; don't assume. |
| Pages Router `getServerSideProps` | Server Components + server actions | Next 13+ | Not directly relevant — Phase 1 `/api/session` is a route handler, not a server action. |

**Deprecated / do not use in Phase 1:**
- `@supabase/auth-helpers-nextjs`
- `z.string().email()`
- `tailwindcss-animate`
- `@types/gray-matter` (does not exist)
- `NEXT_PUBLIC_` prefix on any secret (D-F-04)
- Edge runtime on `/api/session` (Node runtime only — matches Phase 2's `/api/chat`)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Next 16.2.4's `create-next-app .` can be run in a cwd that already has planning dirs, given `--yes` or manual merge | Pitfall 1 | Scaffolding step fails and plan has to insert a preflight move/merge. **Mitigation:** planner codifies the preflight step explicitly and tests it in a throwaway clone before running it on the real repo. |
| A2 | shadcn `4.4.0` CLI uses `tw-animate-css`, not `tailwindcss-animate`, on new init | Standard Stack + Pitfall 3 | If wrong, developer removes the wrong plugin from `globals.css`. Low-impact — visible immediately if dialogs don't animate. |
| A3 | Supabase service-role key bypasses RLS for `insert` on a brand-new `sessions` table with RLS enabled but no policies | Pattern 3 + Pitfall 7 | If wrong (e.g., Supabase added a "service role requires policy" flag in a recent release), `/api/session` returns 500 and plan adds a permissive INSERT policy for service role. **Mitigation:** Wave 0 smoke test — `curl -X POST /api/session` with a dummy email after migration + hook install. If 500, add a `create policy "service role insert" on sessions as permissive for insert to service_role with check (true);` policy. |
| A4 | Joe's existing Supabase project is on the free tier with default region. `.env.local` already has the URL + anon + service-role key (per CONTEXT.md "Joe has created project and rotated the secret key"). | Environment Availability | If Joe hasn't actually done this, Wave 0 is blocked. **Mitigation:** plan Task 1.0 = "verify .env.local present with three required Supabase vars" — fast precheck, not an assumption. |
| A5 | The pre-commit hook's `:(exclude)scripts/install-pre-commit-hook.sh` pathspec works in git 2.43.x on Windows | Pre-commit installer code | If pathspec exclude doesn't work as expected, committing the installer script itself fails (self-bite). **Mitigation:** plan has a "verify hook self-commit works" step that stages only the installer and runs `.git/hooks/pre-commit` manually. Well-understood pattern; low risk. |
| A6 | `z.email()` in zod 4.3.6 accepts standard RFC 5322 addresses without extra config | Standard Stack + Pitfall 6 | Unlikely wrong — zod's email regex is well-documented. If custom rules needed (e.g., block free-mail domains), that's a Phase 4 concern, not Phase 1. |
| A7 | `readdirSync` + `.sort()` produces byte-identical case-studies concatenation on Linux, macOS, Windows | Pitfall 5 | Near-zero risk — lexicographic sort is well-defined. Test monkey-patches `readdirSync` to return reversed order and asserts same output. |

**All other claims in this research are either VERIFIED via `npm view` on 2026-04-21 or CITED to primary documentation.**

## Open Questions (RESOLVED)

1. **Does `create-next-app@16.2.4 .` accept a non-empty cwd with `--yes`?**
   - What we know: `create-next-app` historically refuses non-empty dirs.
   - What's unclear: Whether a 2026 flag (`--force`, `--empty`, or `--yes` override) handles this.
   - Recommendation: Plan should try `--yes` first, fall back to "scaffold in `joe-agent-temp/`, `mv *` into root" if that fails. Test in a throwaway clone before running on the real repo.
   - **RESOLVED:** Plan 01 Task 1 handles via temp-directory scaffold + rsync merge.

2. **Should the Phase 1 plan create the `/chat` stub with a minimal `useChat` scaffold, or truly a "coming soon" static placeholder?**
   - What we know: CONTEXT.md D-B-04 says "placeholder 'chat coming in Phase 2'."
   - What's unclear: How minimal is "placeholder"? Does reading `sessionStorage.getItem('session_id')` count as real code or stub?
   - Recommendation: Stub reads `session_id` from `sessionStorage` and displays "Welcome — your session id is <XYZ>. Chat coming in Phase 2." This exercises GATE-04 (sessionStorage read) end-to-end without pulling in the AI SDK.
   - **RESOLVED:** Plan 03 Task 3 Step 5 implements a minimal stub that reads sessionStorage.session_id and displays it (exercises GATE-04 without pulling AI SDK).

3. **Does `guardrails.md` get a Joe-signed footer in plain text, or is "Joe-signed" just a git commit from Joe's account?**
   - What we know: CONTEXT.md D-C-06 says "Joe-authored and Joe-signed."
   - What's unclear: Literal signature text vs. git-blame evidence.
   - Recommendation: Treat it as a manual gate — `01-CONTENT-STATUS.md` checkbox "Joe reviewed and approved `guardrails.md`" + git commit authored by Joe. No digital signature needed for a solo project.
   - **RESOLVED:** Plan 04 Task 4 implements both a literal "Signed:" line in kb/guardrails.md AND an author-match verify against git config user.email.

4. **Phase 2 hand-off: should `lib/system-prompt.ts` already embed a `// PHASE 2: cache_control breakpoint here` comment, or leave it uncommented and let Phase 2 refactor?**
   - Recommendation: Add the comment marker. Zero runtime cost, high future-readability. The marker makes Phase 2's first commit a one-line change at an obvious anchor.
   - **RESOLVED:** Plan 02 Task 3 system-prompt.ts includes a "// PHASE 2:" comment for the one-line Phase 2 refactor when cache_control is wired.

5. **Is `sessions` RLS left enabled with no policies the correct Phase 1 posture?**
   - What we know: Service role bypasses RLS. RLS-enabled + zero-policies means the anon key is completely blocked — which is exactly what we want in Phase 1 (no anon writes should happen).
   - What's unclear: Whether a Phase 5 Supabase dashboard warning about "table has RLS enabled but no policies" becomes noise.
   - Recommendation: Accept the dashboard warning; it's informational. Add policies in Phase 4.
   - **RESOLVED:** Plan 03 Task 1 Step 1 migration enables RLS on sessions and messages with no policies; service-role key bypasses RLS for server-side INSERT (Phase 4 adds admin read policies).

## Sources

### Primary (HIGH confidence)

- **Next.js 16 docs** — [nextjs.org/docs/app](https://nextjs.org/docs/app) — App Router, server/client components, route handlers.
- **Next.js 16 release notes** — [nextjs.org/blog/next-16](https://nextjs.org/blog/next-16) — Turbopack default, React 19.2, gitignore update.
- **create-next-app .env gitignore PR #61920** — [github.com/vercel/next.js/pull/61920](https://github.com/vercel/next.js/pull/61920) — confirms `.env*.local` in default gitignore.
- **shadcn/ui Tailwind v4 docs** — [ui.shadcn.com/docs/tailwind-v4](https://ui.shadcn.com/docs/tailwind-v4) — `@theme inline`, `tw-animate-css` migration.
- **shadcn/ui Next.js install** — [ui.shadcn.com/docs/installation/next](https://ui.shadcn.com/docs/installation/next)
- **Supabase SSR docs** — [supabase.com/docs/guides/auth/server-side/creating-a-client](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- **Supabase RLS guide** — [supabase.com/docs/guides/database/postgres/row-level-security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- **zod v4 release notes** — [zod.dev/v4](https://zod.dev/v4) — `z.email()` deprecation of `z.string().email()`.
- **zod defining schemas** — [zod.dev/api](https://zod.dev/api)
- **gray-matter README** — [github.com/jonschlinkert/gray-matter](https://github.com/jonschlinkert/gray-matter) — built-in TypeScript types.
- **gray-matter npm** — [npmjs.com/package/gray-matter](https://www.npmjs.com/package/gray-matter)
- **Git hooks reference** — [git-scm.com/book/en/v2/Customizing-Git-Git-Hooks](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks)
- **Atlassian git hooks tutorial** — [atlassian.com/git/tutorials/git-hooks](https://www.atlassian.com/git/tutorials/git-hooks)
- **npm registry** — verified versions of every Standard Stack package via `npm view <pkg> version` on 2026-04-21.

### Secondary (MEDIUM confidence)

- **Next.js 16 App Router 2026 guide (DEV)** — [dev.to/getcraftly/nextjs-16-app-router-the-complete-guide-for-2026-2hi3](https://dev.to/getcraftly/nextjs-16-app-router-the-complete-guide-for-2026-2hi3)
- **shadcn ui 2026 guide (Jishu Labs)** — [jishulabs.com/blog/shadcn-ui-component-library-guide-2026](https://jishulabs.com/blog/shadcn-ui-component-library-guide-2026)
- **Next.js App Router patterns 2026 (DEV)** — [dev.to/teguh_coding/nextjs-app-router-the-patterns-that-actually-matter-in-2026-146](https://dev.to/teguh_coding/nextjs-app-router-the-patterns-that-actually-matter-in-2026-146)
- **zod v4 email trim deprecation issue** — [github.com/colinhacks/zod/issues/4850](https://github.com/colinhacks/zod/issues/4850)

### Project-internal (HIGH)

- `.planning/phases/01-foundation-content/01-CONTEXT.md` — locked decisions
- `.planning/REQUIREMENTS.md` — all 21 Phase 1 REQ-IDs
- `.planning/ROADMAP.md` — Phase 1 success criteria
- `.planning/research/SUMMARY.md` — cross-cutting tensions
- `.planning/research/STACK.md` — validated stack
- `.planning/research/ARCHITECTURE.md` — Pattern 1: frozen-prefix caching
- `.planning/research/PITFALLS.md` — Pitfalls 1, 2, 3, 8, 11 mapped to Phase 1
- `docs/superpowers/specs/2026-04-21-resume-agent-design.md` — §2, §4

## Metadata

**Confidence breakdown:**
- Standard Stack: **HIGH** — every version verified via `npm view` on 2026-04-21.
- Architecture Patterns: **HIGH** — Pattern 1 (frozen-prefix caching) is documented in ARCHITECTURE.md and matches ANthropic cache docs; Pattern 3 (server-only Supabase client) is a standard 2026 idiom.
- Pitfalls: **HIGH** for technical (Pitfall 1-5, 7, 8 all verified); **MEDIUM** for Pitfall 6 (zod error message UX is a judgment call).
- Environment: **HIGH** — local Node/npm/git/bash verified on Joe's Windows machine.
- Security domain: **HIGH** — maps to standard ASVS categories; Phase 1 surface is small.
- Validation architecture: **HIGH** — Vitest + Playwright is the spec-locked pattern.

**Research date:** 2026-04-21
**Valid until:** 2026-07-21 (stable stack; re-verify npm versions if Phase 1 slips past this date).

---

*Phase: 01-foundation-content*
*Research completed: 2026-04-21*
