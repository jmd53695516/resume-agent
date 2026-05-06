---
phase: 03-tools-resilience
plan: 05
subsystem: fallback
tags: [fallback, build-script, error-boundary, branched-render, plain-html, fetch-health-extraction, w5, b1, b2]

# Dependency graph
requires:
  - phase: 03-tools-resilience
    plan: 04
    provides: StatusBanner Server Component (SC) with inline fetchHealth (this plan extracts it); /api/health endpoint (HTTP 200 always); HealthShape DepStatus type
provides:
  - scripts/generate-fallback.ts — build-time KB→constants extractor (W5 exported pure helpers)
  - src/generated/fallback.ts — auto-generated module with FALLBACK_BIO, FALLBACK_LINKEDIN, FALLBACK_GITHUB, FALLBACK_EMAIL, FALLBACK_ROLES (gitignored)
  - src/components/PlainHtmlFallback.tsx — static minimal fallback render (zero dynamic deps)
  - src/lib/fetch-health.ts — shared SC helper extracted from Plan 03-04 StatusBanner; consumed by both StatusBanner and the new branched-render page.tsx
  - src/app/error.tsx — Client Component error boundary; belt-and-suspenders for uncaught render exceptions
  - npm prebuild hook (tsx scripts/generate-fallback.ts) — fallback module regenerated on every build
  - Two D-G-04 trigger paths consumed: ?fallback=1 (Plan 03-03 ChatUI redirect target) AND health.classifier === 'down' (live SC fetchHealth check)
affects: [05-launch (resume PDF placement; Playwright E2E for fallback triggers)]

# Tech tracking
tech-stack:
  added: ["tsx@^4.21.0 (devDep — build-time TS runner for prebuild hook)"]
  patterns:
    - "Build-time KB→generated-module pattern: fs.readFileSync at PREBUILD; never at request time (D-G-03 cascading-failure-avoidance lock)"
    - "W5 pure-fn extraction: build script exports extractFirstParagraph + extractLastNRoles at top-level so tests import them directly (no execSync required for pure-fn unit tests; smoke test uses execSync only for end-to-end coverage)"
    - "main()-guarded-by-env-flag-OR-argv-match pattern: prevents test imports from triggering main() side effects (process.exit on missing kb fixtures), while preserving direct-invocation ergonomics (npx tsx scripts/generate-fallback.ts works without setting env)"
    - "Generated module gitignore: src/generated/.gitignore tracks fallback.ts as ignored; the .gitignore itself IS committed (directory marker) but the regenerated file is NOT"
    - "Shared SC helper extraction: fetchHealth + HealthShape moved from inline-in-StatusBanner to src/lib/fetch-health.ts; consumed by both StatusBanner and page.tsx (no duplication)"
    - "Branched-render fallback in page.tsx: async Home() awaits searchParams (Next 16 idiom) + fetchHealth; renders PlainHtmlFallback on either trigger; otherwise renders the live email gate path unchanged"
    - "error.tsx as belt-and-suspenders: third surface (after page.tsx branched render and ChatUI redirect) — catches uncaught render-time exceptions; renders the same PlainHtmlFallback content; logs Error to console.error (NEVER to user-visible DOM per T-03-05-06)"
    - "Resume regex tuned for canonical kb/resume.md shape (### Company H3 then **Role** — Dates bold-em-dash); degenerate format (bold-only role names without H3) deterministically returns 0 roles (W5 fixture B)"

key-files:
  created:
    - scripts/generate-fallback.ts
    - src/generated/.gitignore
    - src/components/PlainHtmlFallback.tsx
    - src/lib/fetch-health.ts
    - src/app/error.tsx
    - tests/scripts/generate-fallback.test.ts
    - tests/components/PlainHtmlFallback.test.tsx
    - tests/components/error-boundary.test.tsx
  modified:
    - src/components/StatusBanner.tsx (B1: inline fetchHealth REMOVED, replaced with import from @/lib/fetch-health; HealthShape relocated to the helper)
    - src/app/page.tsx (async Home; branched render on fallback param OR classifier=down)
    - package.json (added prebuild script + tsx devDep)
    - package-lock.json (tsx install)

key-decisions:
  - "Resume regex calibrated to actual kb/resume.md format. The plan's example regex assumed H2/H3 'role title' followed by 'Company — dates' — but the real format is H3 '### Company — Location' followed by '**Role Title** — Date Range'. Adapting in this task (not deferring) was Rule 3 blocking-issue auto-fix territory: shipping the plan's exact regex would have produced empty FALLBACK_ROLES."
  - "W5 main()-guard via dual condition (env flag OR argv-match): the plan suggested EITHER is.main detection OR an env flag; we shipped both so manual `npx tsx scripts/generate-fallback.ts` works AND `GENERATE_FALLBACK_RUN=1 tsx scripts/generate-fallback.ts` works AND test imports do NOT trigger main(). Belt-and-suspenders against tsx ESM/CJS detection brittleness."
  - "B1: HealthShape type relocated to src/lib/fetch-health.ts (re-exported alongside fetchHealth) so both StatusBanner.tsx and src/app/page.tsx import it from the same module. Avoids a future divergence where two files independently define the type."
  - "B2 strict ownership: src/components/ChatUI.tsx is NOT in this plan's commit diff. The persistent-500 → /?fallback=1 client redirect lives in Plan 03-03. This plan ONLY consumes the resulting query param via page.tsx searchParams branch. Verified: git diff --name-only HEAD~7 HEAD shows zero matches for ChatUI.tsx."
  - "Skip-the-fetch optimization in page.tsx: when ?fallback=1 is set, we do NOT call fetchHealth() at all (`const health = fallbackParam ? null : await fetchHealth();`). One less server round-trip when we already know the answer. Trivial but worth noting for future tracing."
  - "FALLBACK_BIO uses the first paragraph of kb/about_me.md AFTER stripping the top-level # heading. extractFirstParagraph returns the first ≥100-char paragraph; for the current about_me.md that's the 'I ended up in product management kind of by accident' paragraph (846 chars). If Joe wants a tighter bio he can edit about_me.md to put a shorter pitch as the first paragraph and the next prebuild will pick it up automatically."

patterns-established:
  - "Pattern: build-time content extraction via prebuild hook — write a TS script that reads source-of-truth files, generates a TS module of constants, gitignores the output, and wires `prebuild` so `npm run build` always regenerates. Avoids stale committed artifacts AND avoids request-time file reads (cascading-failure avoidance)."
  - "Pattern: pure-fn export from a build script for unit testability — keep the body of the script's main() small, push extractor logic into pure named-export fns at the top, and guard main() so test imports don't trigger side effects. Pairs with W5 dual-fixture testing (real format + degenerate format) for regex regression coverage."
  - "Pattern: shared SC helper extraction-after-first-use — Plan 03-04 shipped fetchHealth inline because it had only one consumer; Plan 03-05 extracts it once a second consumer (page.tsx) appears. Avoids speculative abstraction."
  - "Pattern: belt-and-suspenders fallback layering — three surfaces (1) page.tsx branched render on classifier=down + ?fallback=1, (2) ChatUI client-side redirect on persistent /api/chat 500s (Plan 03-03), (3) error.tsx for uncaught render exceptions. Each layer covers a different failure class; together they ensure no recruiter ever sees a blank page or stack trace."

requirements-completed: [OBSV-12]

# Metrics
duration: 14min
completed: 2026-05-06
---

# Phase 03 Plan 05: Plain-HTML Fallback Summary

**OBSV-12 plain-HTML fallback safety net shipped: a build-time script (`scripts/generate-fallback.ts`) extracts bio + last 3 roles + LinkedIn/GitHub/email from `kb/{about_me,profile,resume}.md` into a gitignored `src/generated/fallback.ts` module on every `npm run build`; `<PlainHtmlFallback />` renders that content with zero dynamic deps; `src/app/page.tsx` becomes async and branches to the fallback when `?fallback=1` (Plan 03-03's persistent-500 redirect target) OR `health.classifier === 'down'`; `src/app/error.tsx` is a third belt-and-suspenders surface for uncaught render exceptions; B1 fix landed clean (Plan 03-04's inline `fetchHealth` extracted to `src/lib/fetch-health.ts`); B2 verified (no ChatUI.tsx changes — Plan 03-03 owns it end-to-end); W5 dual-fixture regression coverage live for `extractLastNRoles`.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-05-06T01:17:26Z
- **Completed:** 2026-05-06T01:31:12Z
- **Tasks:** 3 (all TDD: RED → GREEN per task)
- **Files created:** 8 (5 source + 3 test)
- **Files modified:** 4 (StatusBanner.tsx, page.tsx, package.json, package-lock.json)
- **Commits:** 6 (3 RED + 3 GREEN)

## Accomplishments

- **Build-time fallback extractor (`scripts/generate-fallback.ts`).** Reads `kb/about_me.md`, `kb/profile.yml`, `kb/resume.md` at build time via `fs.readFileSync` and writes `src/generated/fallback.ts` with 5 const exports. **W5: `extractFirstParagraph` and `extractLastNRoles` are exported pure functions at the top of the file**; tests import them directly without spawning a child process. Resume regex tuned for the real `### Company — Location` H3 + `**Role** — Dates` bold-em-dash format; the plan's example regex would have produced empty `FALLBACK_ROLES`, so the regex was adapted in this task (not deferred).
- **W5 dual-fixture coverage.** `extractLastNRoles` tested against (A) the canonical real resume format AND (B) a degenerate bold-only format. Fixture B asserts `roles.length === 0` — documenting the failure mode so a future change to `kb/resume.md` that drops H3 headings will trip a deterministic test failure rather than silently shipping an empty `FALLBACK_ROLES` to production. Plus a smoke test that runs the full `npx tsx scripts/generate-fallback.ts` end-to-end against real KB.
- **`PlainHtmlFallback` component (zero dynamic deps).** Renders bio, 3 recent roles, LinkedIn/GitHub/resume PDF links, and a prominent `mailto:` CTA. Imports ONLY build-time constants from `@/generated/fallback`. **`git grep -E "import.*supabase|import.*redis|import.*@anthropic|fetch\("` against the file returns empty** — D-G-03 cascading-failure-avoidance lock holds.
- **B1 fix landed clean.** `src/components/StatusBanner.tsx` no longer contains the inline `async function fetchHealth(...)` block. `git grep "async function fetchHealth" src/components/StatusBanner.tsx` is empty; `git grep "from '@/lib/fetch-health'" src/components/StatusBanner.tsx` returns one match. The `HealthShape` type was relocated to the shared module too, so both StatusBanner and page.tsx now share one definition.
- **Branched render in page.tsx.** `Home()` is now `async` and awaits `searchParams` (Next 16 idiom) + `fetchHealth()`. Returns `<PlainHtmlFallback />` when `?fallback=1` OR `health?.classifier === 'down'`; otherwise the existing `StatusBanner` + `Card`-with-FramingCopy/DisclaimerBanner/EmailGate renders unchanged. **Skip-the-fetch optimization**: when fallbackParam is true, we don't call fetchHealth at all.
- **`error.tsx` belt-and-suspenders.** Client Component (`'use client'`) renders the same `PlainHtmlFallback`. The `Error` object is logged via `console.error` in a `useEffect` — never rendered to user-visible DOM (T-03-05-06 mitigation).
- **B2 verified.** `git diff --name-only HEAD~7 HEAD` does NOT include `src/components/ChatUI.tsx`. Plan 03-03 owns ChatUI end-to-end — this plan only consumes the resulting `?fallback=1` query param.
- **prebuild hook integration.** `npm run build` now runs `tsx scripts/generate-fallback.ts` first; verified — both `prebuild` and `next build` complete clean. `/` is now `ƒ Dynamic` in the route table because page.tsx awaits searchParams + fetchHealth (was already dynamic from Plan 03-04 StatusBanner's headers() call).

## W5 Acceptance: Verbatim FALLBACK_ROLES (Joe's Semantic Review)

The actual 3 extracted rows from `src/generated/fallback.ts` (after running prebuild against current `kb/resume.md`):

```ts
export const FALLBACK_ROLES: ReadonlyArray<{ title: string; company: string; dates: string }> = [
  {
    "title": "Senior Consultant (Client: SEI)",
    "company": "Nimbl Digital",
    "dates": "September 2024 – Present"
  },
  {
    "title": "Sales Engineering Solutions Consultant",
    "company": "Retailcloud",
    "dates": "April 2024 – August 2024"
  },
  {
    "title": "Senior Manager, Business Intelligence — Supply Chain",
    "company": "Gap, Inc.",
    "dates": "January 2022 – May 2023"
  }
];
```

**Cross-check against `kb/resume.md`:**

| Generated row | resume.md source | Match |
|---|---|---|
| `Senior Consultant (Client: SEI)` @ `Nimbl Digital` (Sep 2024 – Present) | `### Nimbl Digital — Berwyn, PA` / `**Senior Consultant (Client: SEI)** — September 2024 – Present` | ✅ exact |
| `Sales Engineering Solutions Consultant` @ `Retailcloud` (Apr–Aug 2024) | `### Retailcloud — Concord, CA (Remote Contract)` / `**Sales Engineering Solutions Consultant** — April 2024 – August 2024` | ✅ exact |
| `Senior Manager, Business Intelligence — Supply Chain` @ `Gap, Inc.` (Jan 2022 – May 2023) | `### Gap, Inc. — San Francisco, CA (Remote)` / `**Senior Manager, Business Intelligence — Supply Chain** — January 2022 – May 2023` | ✅ exact |

All three rows have non-empty `{title, company, dates}` AND match the actual most-recent 3 roles in `kb/resume.md`. **Note:** the Under Armour entry (4th-most-recent) is correctly excluded because we cap at `n=3`. If Joe wants to include Under Armour in the fallback, change `extractLastNRoles(resumeContent, 3)` to `4` in `scripts/generate-fallback.ts` and rerun prebuild.

## W5 Acceptance: Both Fixture Tests Pass

```
$ npx vitest run tests/scripts/generate-fallback.test.ts

 Test Files  1 passed (1)
      Tests  7 passed (7)
   Duration  1.27s
```

Test breakdown (all PASS):
1. `extractFirstParagraph: returns the first paragraph >100 chars when one exists` ✅
2. `extractFirstParagraph: falls back to first paragraph if none meet minLen` ✅
3. `extractFirstParagraph: returns empty string when content is empty` ✅
4. **`extractLastNRoles — current real resume format (W5 fixture A): extracts 3 roles with non-empty {title, company, dates}` ✅**
5. **`extractLastNRoles — current real resume format (W5 fixture A): matches actual kb/resume.md content (smoke test against the real file)` ✅**
6. **`extractLastNRoles — degenerate resume format (W5 fixture B): returns 0 roles when resume has no H3 company headings (documents failure mode)` ✅**
7. `script smoke test: produces a fallback.ts containing all 5 expected exports when run against real kb` ✅

W5 dual-fixture coverage is live: any future change to `kb/resume.md` that breaks the regex (e.g., dropping H3 in favor of bold-only role names) will trip fixture B's assertion in CI.

## Generated FALLBACK_BIO (first 200 chars)

```
"I ended up in product management kind of by accident. Before product management on the tech side really existed in corporate America, I was already doing it — dictating how a product functioned witho...
```

This is the first paragraph of `kb/about_me.md` (after the `# About Me` heading is stripped). 846 characters total — longer than the spec's "3-4 sentence" target but accurately preserves Joe's narrative tone. If Joe wants a tighter bio, he can edit `kb/about_me.md` to put a shorter pitch as the first paragraph (or the bio extractor can be tweaked to honor a frontmatter `fallback_bio` override field) — next prebuild picks up changes automatically.

## Resume PDF — `/joe-dollinger-resume.pdf`

**Status: 404 (file does not exist in `public/`)**

`ls public/joe-dollinger-resume.pdf` → `No such file or directory`. Public/ contains only the Next.js stock SVGs (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`).

**This is expected and flagged for Phase 5 LAUNCH-***. The PlainHtmlFallback's resume PDF link is wired but will 404 until Joe drops the PDF into `public/`. Recruiter on the fallback page still has working email + LinkedIn + GitHub paths, so the failure mode is graceful (broken link, not broken page). T-03-05-08 disposition is `accept` — Phase 5 owns the PDF placement.

## B1 Confirmation: StatusBanner.tsx Diff

The Plan 03-04 inline `fetchHealth` is gone; replaced with one import line:

```diff
-import { headers } from 'next/headers';
 import type { DepStatus } from '@/lib/health';
+import { fetchHealth, type HealthShape } from '@/lib/fetch-health';
 import { ChatStatusBanner } from './ChatStatusBanner';

-type HealthShape = {
-  anthropic: DepStatus;
-  classifier: DepStatus;
-  supabase: DepStatus;
-  upstash: DepStatus;
-  exa: DepStatus;
-};
-
 // D-F-04: per-dep specific copy. Joe reviews/edits in PR per the same flow as
 // Phase 2 deflection copy. W10: declared directly with the typed annotation.
 export const STATUS_COPY: Record<keyof HealthShape, { label: string; degraded: string }> = {
 ...
-async function fetchHealth(): Promise<HealthShape | null> {
-  const h = await headers();
-  ...
-  } catch {
-    return null;
-  }
-}
-
 export async function StatusBanner({ page }: { page: 'framing' | 'chat' }) {
   const health = await fetchHealth();
```

**Verification greps:**
- `git grep "async function fetchHealth" src/components/StatusBanner.tsx` → empty
- `git grep "from '@/lib/fetch-health'" src/components/StatusBanner.tsx` → 1 match
- `git grep "from 'next/headers'" src/components/StatusBanner.tsx` → empty (no longer needed; `headers()` lives inside fetchHealth helper now)

**StatusBanner SC tests still pass after extraction:**
```
$ npx vitest run tests/components/StatusBanner.test.tsx
 Test Files  1 passed (1)
      Tests  9 passed (9)
```

All 9 Plan 03-04 StatusBanner tests pass with no modification needed (they imported `STATUS_COPY` from `StatusBanner`, which is unchanged; `ChatStatusBanner` UX tests are independent of fetchHealth).

## B2 Confirmation: ChatUI.tsx Untouched

```
$ git diff --name-only HEAD~7 HEAD | grep ChatUI.tsx
(empty — no match)
```

The 6 commits this plan made (3 RED + 3 GREEN) span from `HEAD~7` (`46aaf73 docs(03-02): complete tool-wiring + W4/W7 plan` — Plan 03-02 close) to `HEAD` (`8d8dd2f feat(03-05): branched render in page.tsx + error.tsx safety net`). Plan 03-05's `files_modified` frontmatter explicitly excludes `src/components/ChatUI.tsx`, and the actual diff confirms it. The persistent-500 → `/?fallback=1` redirect logic remains owned end-to-end by Plan 03-03.

## Manual Verification Steps (for Joe)

After this plan ships, Joe can manually verify the two trigger paths:

1. **`?fallback=1` query param trigger:**
   ```
   npm run dev
   ```
   Then visit `http://localhost:3000/?fallback=1` — should render `<PlainHtmlFallback />` (data-testid=`plain-html-fallback`), no email gate, no banner, no Card.

2. **Mocked `health.classifier === 'down'` trigger:**
   - Easiest: temporarily edit `src/app/api/health/route.ts` to return `classifier: 'down'`.
   - Restart dev server, visit `http://localhost:3000/` → fallback renders.
   - Revert the edit afterwards.

3. **Persistent /api/chat 500 trigger:** owned by Plan 03-03's tests + manual smoke; not duplicated here. After 03-03 ships, the path is: induce two consecutive 500s on `/api/chat` → ChatUI client redirects to `/?fallback=1` → page.tsx serves PlainHtmlFallback (steps 1 + 2 confirm the consumer side already works).

4. **error.tsx belt-and-suspenders:** force a render-time exception (e.g., temporarily make `FramingCopy` throw) → error.tsx catches and renders PlainHtmlFallback. Don't ship this test artifact; it's just to confirm the boundary works.

## Phase 5 Playwright E2E Candidates

The trigger paths are stable and high-leverage E2E candidates:
- `[data-testid=plain-html-fallback]` is the visible element on both branches.
- `[data-testid=fallback-email-cta]` is the prominent mailto CTA.
- Three link testids: `fallback-linkedin`, `fallback-github`, `fallback-resume`.

Suggested Phase 5 E2E:
- Visit `/?fallback=1` → expect plain-html-fallback testid visible.
- Mock `/api/health` to return `classifier: 'down'` → visit `/` → expect plain-html-fallback testid visible.
- Persistent 500 on `/api/chat` → expect ChatUI redirect to `/?fallback=1` (Plan 03-03 territory; 03-05 only verifies the consumer).

## Task Commits

| Task | RED commit | GREEN commit | Description |
|---|---|---|---|
| 1 | `cfc181f` | `e022e9e` | Build-time fallback content extractor + W5 pure fns + dual-fixture tests + prebuild hook + tsx devDep |
| 2 | `d048a0f` | `2f6107d` | PlainHtmlFallback component + fetch-health helper extraction (B1: StatusBanner inline removed) |
| 3 | `f2bfeae` | `8d8dd2f` | Branched render in page.tsx (?fallback=1 + classifier=down) + error.tsx belt-and-suspenders |

## Files Created/Modified

### Created
- `scripts/generate-fallback.ts` — 110 lines. Reads kb/{about_me,profile,resume}.md → writes src/generated/fallback.ts. Exports `extractFirstParagraph` + `extractLastNRoles` as pure fns at top-level (W5). main()-guarded by env flag OR argv-match so test imports do not trigger side effects.
- `src/generated/.gitignore` — Excludes `fallback.ts` from git tracking. The .gitignore itself IS committed (directory marker); the regenerated file is NOT.
- `src/components/PlainHtmlFallback.tsx` — Static minimal fallback; bio + 3 roles + LinkedIn/GitHub/resume PDF + Email Joe mailto CTA. Imports ONLY build-time constants from @/generated/fallback. Five data-testid contracts (plain-html-fallback, fallback-email-cta, fallback-linkedin, fallback-github, fallback-resume).
- `src/lib/fetch-health.ts` — Shared SC helper extracted from Plan 03-04 StatusBanner. Exports `fetchHealth()` + `HealthShape` type. headers()-derived absolute URL pattern with 30s revalidate.
- `src/app/error.tsx` — Client Component error boundary. Renders PlainHtmlFallback; logs Error to console.error in a useEffect.
- `tests/scripts/generate-fallback.test.ts` — 7 tests covering extractFirstParagraph + extractLastNRoles (W5 fixtures A + B) + smoke test.
- `tests/components/PlainHtmlFallback.test.tsx` — 5 tests covering bio render, mailto CTA, 3 roles, links, testid wrapper. W3: per-file `// @vitest-environment jsdom`.
- `tests/components/error-boundary.test.tsx` — 2 tests covering ErrorBoundary renders PlainHtmlFallback + mailto CTA. W3: per-file `// @vitest-environment jsdom`.

### Modified
- `src/components/StatusBanner.tsx` — B1 fix: inline `async function fetchHealth(...)` REMOVED; `import { headers } from 'next/headers'` REMOVED (no longer needed); `import { fetchHealth, type HealthShape } from '@/lib/fetch-health'` ADDED. HealthShape type relocated to fetch-health.ts so both StatusBanner and page.tsx share the definition.
- `src/app/page.tsx` — Async `Home()` accepting Promise<SearchParams>. Awaits searchParams + fetchHealth. Branches to `<PlainHtmlFallback />` on `?fallback=1` OR `health?.classifier === 'down'`. Otherwise renders the unchanged StatusBanner + email gate path. Skip-the-fetch optimization when fallbackParam is true.
- `package.json` — Added `"prebuild": "tsx scripts/generate-fallback.ts"` script + `tsx@^4.21.0` to devDependencies.
- `package-lock.json` — tsx + transitive devDeps lockdown.

## Decisions Made

- **Resume regex calibrated to real format.** The plan's example regex (`^#{2,3}\s+(.+)`) assumed H2/H3 = role title. Real `kb/resume.md` is H3 = company, then `**Role**` bold-em-dash = role + dates. Adapting in this task (Rule 3 blocking-issue auto-fix): shipping the plan's exact regex would have produced empty `FALLBACK_ROLES` — defeating the whole point of the fallback. The shipped regex is also tolerant of em-dash (—), en-dash (–), and hyphen (-) separators in the H3 line.
- **W5 main()-guard via dual condition (env flag OR argv-match).** The plan suggested either is.main detection or an env flag. Shipped both: manual `npx tsx scripts/generate-fallback.ts` works (argv match), `npm run prebuild` works (argv match), and `import { extractLastNRoles } from '../scripts/generate-fallback'` from tests does NOT trigger main() (no argv match, no env flag). Belt-and-suspenders against tsx's ESM/CJS detection differences across versions.
- **HealthShape type relocated to fetch-health.ts (B1).** Cleaner than re-exporting from StatusBanner (which would create a backwards dep). Both consumers import `HealthShape` from the helper module now.
- **Skip-the-fetch optimization in page.tsx.** When `?fallback=1` is set, we already know we're rendering the fallback — calling `fetchHealth()` would be a wasted server round-trip. The current shape: `const health = fallbackParam ? null : await fetchHealth();` is simple, readable, and saves one network call on the bot-redirect path.
- **`console.error` (not Pino) in error.tsx.** error.tsx is a Client Component; Pino is server-side only. The `useEffect` logs to browser console — adequate for a runtime that should rarely-if-ever fire (any error reaching error.tsx is already a bug worth investigating, and the recruiter is now safe on the fallback).
- **Resume PDF link wired despite 404.** The fallback link `/joe-dollinger-resume.pdf` is rendered as-is; will 404 until Phase 5 LAUNCH-* drops the actual PDF in public/. Documented above. Alternative considered: hide the link until file exists — rejected because (a) Phase 5 will land the PDF before public deploy and (b) the broken link is graceful (recruiter still has email + LinkedIn + GitHub).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Resume regex tuned to real kb/resume.md format**
- **Found during:** Task 1 GREEN (running prebuild against real KB to verify FALLBACK_ROLES populated)
- **Issue:** The plan's example regex (`^#{2,3}\s+(.+)` capturing role title from heading + parsing next line for company/dates) assumed H2/H3 was role title. Real `kb/resume.md` is the inverse: H3 (`### Nimbl Digital — Berwyn, PA`) is the **company name** (with location after em-dash), and the next non-blank line (`**Senior Consultant (Client: SEI)** — September 2024 – Present`) is bold role title + em-dash + dates. Shipping the plan's exact regex would have produced empty FALLBACK_ROLES (every "role" would have been a company, every "dates" line would have been wrong) — fatal for the fallback's value.
- **Fix:** Adapted regex in `extractLastNRoles`: H3 capture extracts company before the first em/en-dash; lookahead 1-5 lines for `^\*\*([^*]+?)\*\*\s*[—–-]\s*(.+)$` captures role title + dates. Documented inline. Plan's example was illustrative-not-literal; the action node's instruction "**adapt the regex IN THIS TASK — do not ship a script that produces empty FALLBACK_ROLES**" explicitly authorizes this.
- **Files modified:** `scripts/generate-fallback.ts`
- **Verification:** Generated `src/generated/fallback.ts` shows 3 correctly populated roles matching actual resume.md. W5 fixture A test asserts the canonical real format produces non-empty {title, company, dates}.
- **Committed in:** `e022e9e` (Task 1 GREEN)

**2. [Rule 3 — Blocking] tsx not in devDependencies; install required**
- **Found during:** Task 1 GREEN (prebuild script needs `tsx scripts/generate-fallback.ts`)
- **Issue:** `npm ls tsx` returned empty. The plan calls out "Add `tsx` to devDependencies if not already present: `npm install --save-dev tsx`" so this was anticipated, but flagging as deviation because it's a real-world step that produces lockfile changes.
- **Fix:** `npm install --save-dev tsx` → tsx@4.21.0 added; package-lock.json updated.
- **Files modified:** `package.json`, `package-lock.json`
- **Verification:** `npx tsx scripts/generate-fallback.ts` runs clean; `npm run build` invokes prebuild via tsx successfully.
- **Committed in:** `e022e9e` (Task 1 GREEN, folded with the script + .gitignore)

**3. [Rule 2 — Strip top-level # heading from FALLBACK_BIO]**
- **Found during:** Task 1 GREEN (initial output had `# About Me` as part of bio extraction context)
- **Issue:** `extractFirstParagraph` against the raw post-frontmatter content treated `# About Me\n\n` as a paragraph. The first long paragraph that followed was correctly chosen, but the heading sits visually atop in the source so a future content edit (e.g., adding a short summary right after `# About Me`) could surface the heading itself as the bio.
- **Fix:** In `main()`, strip leading `^#[^\n]*\n+` from `aboutContent` before passing to `extractFirstParagraph`. Matches Joe's `# About Me` heading; leaves body untouched.
- **Files modified:** `scripts/generate-fallback.ts`
- **Verification:** Generated FALLBACK_BIO starts with "I ended up in product management..." — no heading.
- **Committed in:** `e022e9e` (Task 1 GREEN)

---

**Total deviations:** 3 auto-fixed (1 regex calibration, 1 anticipated dependency install, 1 heading strip). No scope creep. No architectural changes (Rule 4) needed. All three are correctness fixes the plan would have failed without.

## Issues Encountered

- **Plan example regex assumed H2/H3 role title.** Documented above as deviation #1. Adapted on the fly during Task 1 GREEN. Real-world resume formats vary; the W5 dual-fixture test pattern is the right defense going forward.
- **tsx ESM/CJS main-detection brittleness anticipated by plan.** The plan's note about `import.meta.url === \`file://${process.argv[1]}\`` being potentially brittle was correct — implemented dual-condition guard (env flag OR argv-match) instead.

## Verification Output

- **Full test suite:** **189/189 passed** across 23 test files (was 175/175 before this plan; +14 new tests across 3 new test files: 7 generate-fallback + 5 PlainHtmlFallback + 2 error-boundary).
- **Plan 03-05 specific tests:** 14/14 passed.
- **Plan 03-04 StatusBanner tests still pass:** 9/9 (B1 extraction is non-breaking).
- **Typecheck (`npx tsc --noEmit`):** clean (exit 0).
- **Build (`npm run build`):** clean (exit 0); prebuild runs `tsx scripts/generate-fallback.ts` first; routes table shows `/` is `ƒ Dynamic` (was already dynamic from Plan 03-04 StatusBanner; this plan keeps it dynamic via searchParams + fetchHealth).
- **W5 grep — `extractFirstParagraph`:** `git grep "export function extractFirstParagraph" scripts/generate-fallback.ts` → 1 match.
- **W5 grep — `extractLastNRoles`:** `git grep "export function extractLastNRoles" scripts/generate-fallback.ts` → 1 match.
- **W3 grep — jsdom directives:** `git grep "@vitest-environment jsdom" tests/components/PlainHtmlFallback.test.tsx tests/components/error-boundary.test.tsx` → 1 match per file.
- **B1 grep — inline fetchHealth removed:** `git grep "async function fetchHealth" src/components/StatusBanner.tsx` → empty.
- **B1 grep — fetch-health import:** `git grep "from '@/lib/fetch-health'" src/components/StatusBanner.tsx` → 1 match.
- **B2 confirm — ChatUI not touched:** `git diff --name-only HEAD~7 HEAD | grep ChatUI.tsx` → empty.
- **D-G-03 grep — no dynamic deps in fallback:** `git grep -E "import.*supabase|import.*redis|import.*@anthropic|fetch\(" src/components/PlainHtmlFallback.tsx src/app/error.tsx` → empty.
- **D-G-03 grep — no kb-loader in fallback:** `git grep -E "kb-loader|fs\.|readFileSync" src/components/PlainHtmlFallback.tsx src/app/error.tsx` → empty.
- **gitignore — fallback.ts excluded:** `git check-ignore src/generated/fallback.ts` exits 0.
- **page.tsx grep — async + branched render:** `git grep "fallback === '1'" src/app/page.tsx` → 1 match; `git grep "classifier === 'down'" src/app/page.tsx` → 2 matches (1 in code + 1 in comment); `git grep "await fetchHealth()" src/app/page.tsx` → 1 match.
- **error.tsx grep — 'use client':** `git grep "'use client'" src/app/error.tsx` → 1 match.
- **PlainHtmlFallback referenced in both branches:** `grep -c PlainHtmlFallback src/app/page.tsx` → 3 (import + comment + JSX); `grep -c PlainHtmlFallback src/app/error.tsx` → 2 (import + JSX).

## Next Phase Readiness

- **Plan 03-03 (walkthrough tool — get_case_study UX):** ready. Plan 03-03 owns ChatUI's persistent-500 redirect to `/?fallback=1`. The consumer side (page.tsx searchParams branch) is now live in master, so when 03-03 ships its redirect logic it has a working target.
- **Phase 4 admin dashboard:** ready. The fallback path produces no new admin surface; Phase 4's transcript view is unaffected.
- **Phase 5 LAUNCH-***:
  - **Drop the resume PDF into `public/joe-dollinger-resume.pdf`** before public deploy. Currently 404s.
  - **Playwright E2E for fallback triggers:** `/?fallback=1`, `/api/health` mock for classifier=down, persistent /api/chat 500 (the third trigger spans Plan 03-03's redirect). Stable testid contracts: `plain-html-fallback`, `fallback-email-cta`, `fallback-linkedin`, `fallback-github`, `fallback-resume`.
  - **Eval Cat 6 (UX smoke):** the fallback page is a candidate for at least one smoke check (visit `/?fallback=1`, assert mailto CTA href).

## Self-Check

- File `scripts/generate-fallback.ts`: FOUND
- File `src/generated/.gitignore`: FOUND
- File `src/generated/fallback.ts`: FOUND (gitignored — auto-generated)
- File `src/components/PlainHtmlFallback.tsx`: FOUND
- File `src/lib/fetch-health.ts`: FOUND
- File `src/app/error.tsx`: FOUND
- File `src/components/StatusBanner.tsx` (modified): FOUND
- File `src/app/page.tsx` (modified): FOUND
- File `package.json` (modified): FOUND with prebuild script
- File `tests/scripts/generate-fallback.test.ts`: FOUND
- File `tests/components/PlainHtmlFallback.test.tsx`: FOUND
- File `tests/components/error-boundary.test.tsx`: FOUND
- Commit `cfc181f` (RED Task 1): FOUND
- Commit `e022e9e` (GREEN Task 1): FOUND
- Commit `d048a0f` (RED Task 2): FOUND
- Commit `2f6107d` (GREEN Task 2): FOUND
- Commit `f2bfeae` (RED Task 3): FOUND
- Commit `8d8dd2f` (GREEN Task 3): FOUND

## Self-Check: PASSED

---
*Phase: 03-tools-resilience*
*Plan: 05*
*Completed: 2026-05-06*
