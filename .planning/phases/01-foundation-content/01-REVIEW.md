---
phase: 01-foundation-content
reviewed: 2026-04-29T00:00:00Z
depth: standard
files_reviewed: 49
files_reviewed_list:
  - .env.example
  - .gitignore
  - .prettierrc
  - components.json
  - docs/interview-protocol-case-study.md
  - docs/interview-protocol-selection.md
  - docs/interview-protocol-voice.md
  - eslint.config.mjs
  - kb/about_me.md
  - kb/brainstorm/case-study-candidates.md
  - kb/case_studies/_fixture_for_tests.md
  - kb/case_studies/cortex-ai-client-win.md
  - kb/case_studies/gap-brand-hierarchy-consolidation.md
  - kb/case_studies/snowflake-edw-migration.md
  - kb/case_studies/snowflake-marketplace-datashare.md
  - kb/case_studies/ua-project-rescue.md
  - kb/faq.md
  - kb/github.md
  - kb/guardrails.md
  - kb/linkedin.md
  - kb/management_philosophy.md
  - kb/profile.yml
  - kb/resume.md
  - kb/stances.md
  - kb/voice.md
  - next.config.ts
  - package.json
  - playwright.config.ts
  - postcss.config.mjs
  - scripts/install-pre-commit-hook.sh
  - scripts/test-pre-commit-hook.sh
  - scripts/validate-kb-frontmatter.ts
  - src/app/globals.css
  - src/app/layout.tsx
  - src/app/page.tsx
  - src/components/ui/button.tsx
  - src/components/ui/card.tsx
  - src/components/ui/input.tsx
  - src/components/ui/label.tsx
  - src/lib/env.ts
  - src/lib/hash.ts
  - src/lib/kb-loader.ts
  - src/lib/supabase-server.ts
  - src/lib/system-prompt.ts
  - src/lib/utils.ts
  - tests/lib/kb-loader.test.ts
  - tests/lib/system-prompt.test.ts
  - tsconfig.json
  - vitest.config.ts
findings:
  critical: 2
  warning: 6
  info: 7
  total: 15
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-04-29T00:00:00Z
**Depth:** standard
**Files Reviewed:** 49
**Status:** issues_found

## Summary

Phase 1 ships a clean, well-engineered foundation: env validation via Zod, a deterministic KB loader with strong determinism tests, a minimal email-gate UI, and a robust pre-commit secret-scanner with a self-test. Code quality is generally high.

Two issues rise to **critical** severity. Both concern Joe's signed `kb/guardrails.md` policy ("Never name specific people or disparage them") — the committed KB violates that contract in two places. Because every KB file gets concatenated into the public-facing system prompt, the agent will speak these names to recruiters at runtime. This is a self-inflicted reputational risk identical in shape to leaking an internal Slack quote.

The remaining warnings cluster around two themes: (1) **prompt-cache determinism risk** from CRLF/BOM handling that is invisible on Joe's current Windows checkout but will diverge silently on Vercel's Linux build, and (2) **email-gate hardening gaps** that don't matter at zero traffic but should be closed before Phase 4 launch.

The `validate-kb-frontmatter.ts` script and the pre-commit hook are both well-engineered; minor robustness gaps noted as info.

## Critical Issues

### CR-01: Guardrails violation — real coworker name "Scott" used in voice samples and disparaged

**File:** `kb/voice.md:11`, `kb/voice.md:23`, `kb/voice.md:29`
**Issue:** `kb/guardrails.md` (the Joe-signed safety contract loaded into every system prompt) says: *"Former-employer discussion: Never name specific people or disparage them."* The committed `kb/voice.md` contains three samples that name a real coworker by first name and characterize him negatively:

- Sample 1 (line 11): *"Worked with Scott on adding local currency to partner allocation."* (descriptive — naming alone)
- Sample 3 (line 23): *"Scott didn't and still doesn't understand how Snowflake is intentioned to work."* (named + disparaging)
- Sample 4 (line 29): *"We should have pushed back more from Scott, but he's so hard-headed that it was just the path of least resistance to get him what he wanted so he could stop complaining."* (named + disparaging, twice)

These are voice samples, but they are part of the cached system prompt and will be quoted/paraphrased back to recruiters when the agent emulates voice. The persona-integrity rule actively encourages the agent to draw on this register. The guardrail violation is not a hypothetical — Sample 3 is the verbatim seed for `kb/stances.md` Stance 1 ("Snowflake is a data mart, not a reporting tool"), and the disparagement of "Scott" is one tool-use prompt away from being aired publicly.

This is a **public-facing-agent-during-active-job-search** issue: a recruiter who works in the same network as "Scott" can identify him from one of these samples plus the Snowflake context, then bring it up on a reference call. The committed guardrails file is also signed and dated by Joe — the discrepancy between the signed policy and the actual KB is a credibility problem in its own right.

**Fix:** Replace "Scott" with a role placeholder ("a peer engineer," "a stakeholder on my team") or rewrite the samples to land the same register without the personal critique. Concrete diff for the worst two samples:

```markdown
## Sample 3 — decisive

A peer on my team didn't and still doesn't understand how Snowflake is
intentioned to work. It should be a data mart. We should be building views
for people to access and join data. It's not a reporting tool.

## Sample 4 — decisive

It was a dumb decision to use functions to start with. We should have
pushed back harder, but the path of least resistance was just to deliver
what was being asked for so the complaining would stop.
```

After editing, also confirm `kb/voice.md` does not retain the source-tag "voice-interview-2026-04-23-prompt2" line if it now references a sanitized passage — no policy issue, but it preserves the audit trail to point at a transcript that no longer matches the file.

---

### CR-02: Guardrails violation — real coworker name "Will" used as hiring example in two committed files

**File:** `kb/management_philosophy.md:5`, `kb/stances.md:28`
**Issue:** Same policy as CR-01. `kb/management_philosophy.md` line 5 names a former direct report ("a guy named Will... Smart, highly recommended internally...") and `kb/stances.md` Stance 4 line 28 names him again ("The guy I took the biggest flyer on, Will, was on a team doing nothing close to what mine did..."). The same selection brainstorm at `kb/brainstorm/case-study-candidates.md` line 62-71 references "Hiring Will on a flyer" by first name, though that file is correctly excluded from production KB concatenation.

This is less reputationally hot than CR-01 because Will is described positively, but it still violates the signed guardrails verbatim ("Never name specific people"). Two specific risks beyond the policy violation:

1. The hiring example outs a real internal hiring decision at Under Armour that Will may not have consented to having narrated by a public AI agent. A first name plus the company plus the team description is identifiable to anyone who worked in UA's analytics org in that era.
2. It sets a precedent — the agent will see "Will" as a green-light pattern and may improvise other first names by analogy when narrating other case studies.

**Fix:** Replace "Will" with a role placeholder. Suggested rewrite for `kb/management_philosophy.md`:

```markdown
A specific hire I took a flyer on was an analyst who was smart and highly
recommended internally, but his current job had nothing to do with what
he'd be doing on my team. What stood out was the stuff he was doing on
his current team — trying to make it a little bit better, a little bit
more efficient, always improving a process.
```

And for `kb/stances.md` Stance 4:

```markdown
The hire I took the biggest flyer on was an analyst on a team doing
nothing close to what mine did, but he was constantly improving processes
around him. Tools I can teach. Curiosity I can't.
```

The brainstorm doc (`kb/brainstorm/case-study-candidates.md`) is not concatenated into production output, but recommend the same rename for consistency and to match the existing comment that says "Cut — already canonized in kb/management_philosophy.md."

## Warnings

### WR-01: KB loader has no CRLF/BOM normalization — prompt-cache determinism risk across platforms

**File:** `src/lib/kb-loader.ts:35`, `src/lib/kb-loader.ts:56`
**Issue:** `readFileSync(abs, 'utf-8')` returns raw file bytes verbatim. The repo has `core.autocrlf=true` (confirmed via `git config`) and **no `.gitattributes`** to pin line endings. On Joe's current Windows checkout the working tree happens to be LF (per `git ls-files --eol`), but `core.autocrlf=true` is documented to check files out as CRLF on Windows. Vercel's Linux build runs on LF.

`content.trim()` (line 44 and 59) only strips leading/trailing whitespace — internal `\r\n` line endings inside file bodies are preserved. The same applies to `js-yaml` parsing of `profile.yml` (the parsed object is fine, but `JSON.stringify(parsed, null, 2)` always emits `\n`, so the YAML branch is actually safe).

The result: a Windows developer who runs `npm run dev` and a Vercel deploy can produce **byte-different system prompts from the same KB content**. That breaks the Anthropic prompt-cache hit. CHAT-04 / SAFE-11 determinism tests pass because they run inside one platform per CI run; they cannot detect this divergence.

This is exactly the silent-cost regression the file was engineered to prevent ("changing it invalidates every session's cache prefix on deploy"). Cost impact at scale: 10-20x per request when the cached system prompt misses.

**Fix:** Two layers of defense, do both:

1. Add `.gitattributes` at repo root to pin all KB / source files to LF:

```gitattributes
* text=auto eol=lf
*.png binary
*.jpg binary
```

2. Normalize at read time in `kb-loader.ts` so the loader is robust against environments without `.gitattributes`:

```typescript
const raw = readFileSync(abs, 'utf-8')
  .replace(/^\uFEFF/, '')   // strip UTF-8 BOM if present
  .replace(/\r\n/g, '\n');  // normalize CRLF → LF
```

Apply at both readFileSync sites (line 35 for top-level files, line 56 for case studies). Add a unit test that injects a CRLF fixture and asserts the output matches the LF baseline.

---

### WR-02: `validate-kb-frontmatter.ts` doesn't enforce that confidential files have anonymized roles

**File:** `scripts/validate-kb-frontmatter.ts:38-41`
**Issue:** The validator checks that `confidential` is a boolean but does not enforce any anonymization invariant when `confidential: true`. `kb/case_studies/cortex-ai-client-win.md` is correctly flagged `confidential: true`, and the body is well-anonymized — but the validator is the wrong place to rely on author discipline.

A future case study could be marked `confidential: true` while still containing identifiable client names, and the validator would say "OK." That fails the file's own purpose as the "frontmatter is the contract" gate.

The case-study interview protocol (`docs/interview-protocol-case-study.md` line 98) says: *"If `confidential: true`, Claude proactively swaps company/person names for placeholders during drafting... do NOT leave real names in the file pending later scrubbing."* That instruction is correct but is an authoring-time guideline, not an enforcement gate.

**Fix:** Add a soft check in the validator that when `confidential: true`, the role string must be a generic descriptor (no proper-noun company name detectable). A pragmatic heuristic:

```typescript
if (data.confidential === true && typeof data.role === 'string') {
  // role like "Senior Product Manager — fund-services data platform" is OK.
  // role like "Senior PM — Snowflake" is not.
  const roleLower = data.role.toLowerCase();
  const flagged = /\b(snowflake|under armour|gap inc|gap[\s,]|athleta|banana republic|old navy)\b/i.test(data.role);
  if (flagged) {
    issues.push(`role mentions a specific company but file is confidential — anonymize role string`);
  }
}
```

The allow-list is project-specific; pull the actual list from `kb/profile.yml`'s `companies:` field once that's populated, so the check stays accurate as Joe's history evolves.

---

### WR-03: `EmailGate` lacks client-side rate limiting and input length cap

**File:** `src/components/EmailGate.tsx:33-57`
**Issue:** A determined visitor can bind an enter-spam loop to the form and rapid-fire `POST /api/session`. There is nothing between the client and the API route — no debounce, no per-tab cooldown, no maxLength on the input. Phase 1 doesn't have Upstash rate-limiting in place yet (per `package.json`), and the constraint of "hard daily spend cap in code" is documented but not implemented for the gate endpoint.

This is not the gate's job to solve fully — that's Phase 2 — but the email input has no `maxLength` cap, so a 10MB pasted "email" will be sent to the API and JSON-stringified into the request body. The fetch will eventually reject (Vercel function payload limit), but at the cost of bandwidth and a function invocation against the daily budget.

**Fix:** Two cheap additions:

```tsx
<Input
  id="email"
  type="email"
  maxLength={254}                      // RFC 5321 max email length
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  ...
/>
```

And debounce double-submit: the `submitting` state already does this, but on browsers that auto-submit on Enter while focus is in the input, the `submitting` flip happens after the second Enter. Cleaner pattern:

```tsx
const submittingRef = useRef(false);
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  if (submittingRef.current || !result.success) return;
  submittingRef.current = true;
  setSubmitting(true);
  try { /* ... */ }
  finally { submittingRef.current = false; setSubmitting(false); }
}
```

Reference flag: defer to Phase 2's Upstash rate-limit design rather than building anything elaborate here.

---

### WR-04: `pre-commit` hook self-test is non-fatal under `set -u` only — `set -e` is intentionally not used

**File:** `scripts/test-pre-commit-hook.sh:5`
**Issue:** The self-test runner sets `set -u` but not `set -e`. That's intentional — the script needs to keep running after each `test_case` invocation to record per-case fail/pass — but the consequence is that bash command failures inside `test_case` (e.g., `git add` failing) won't propagate, and the test will report PASS even though it never actually staged the test fixture.

There's no immediate exploit, but the failure mode is "test reports green when it never ran." That's the worst possible failure mode for a security-relevant test.

Concrete reproducer: if `git add` fails inside `test_case` (e.g., another git operation has an `index.lock`), `bash "$HOOK"` runs against an empty stage, exits 0 (no staged changes), and the test reports `FAIL: hook did NOT block` — which is louder than a false-PASS, so this case is fine. But the `printf` and `git add` commands themselves don't have explicit failure handling.

**Fix:** Add explicit checks for the setup steps in `test_case`:

```bash
test_case() {
  local label="$1"
  local content="$2"
  local f="$WORK/test-$RANDOM.txt"
  if ! printf '%s\n' "$content" > "$f"; then
    echo "ERROR: could not write fixture for '$label'" >&2
    return 1
  fi
  if ! git add "$f"; then
    echo "ERROR: could not stage fixture for '$label'" >&2
    return 1
  fi
  # ... rest as-is
}
```

Same for the `.env.local` test block (line 41-49).

Also: `trap 'rm -rf ... git reset HEAD ...'` on line 15 silently discards errors from the cleanup. That's the right call for a teardown but worth a comment.

---

### WR-05: `pre-commit` hook regex for the JWT pattern triggers on lockfile integrity hashes

**File:** `scripts/install-pre-commit-hook.sh:78`
**Issue:** The JWT-shaped pattern `eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+` is precise, but `package-lock.json` integrity hashes can produce false-positive matches in rare cases. More importantly, the diff-output excludes only `:(exclude).env.example`, `scripts/install-pre-commit-hook.sh`, and `scripts/test-pre-commit-hook.sh`. A future commit that updates `package-lock.json` and happens to land an integrity hash starting with `eyJ` (extremely rare but documented to occur with base64-encoded SHA-512 hashes that begin with `i+B` or related prefixes mapped to the high-entropy region) will be blocked, and the only escape hatch is "rephrase" — which a developer cannot do for a generated lockfile.

Confirmed hit on this exact repo's `package-lock.json` line 7916: `"integrity": "sha512-V7Qr52IhZmdKPVr+Vtw8o+WLsQJYCTd8loIfpDaMRWGUZfBOYEJeyJIkqGIDMZPwPx24pUMfwSxxI8phr/MbOA=="` — contains `eyJIkqGI` which doesn't quite match the three-segment JWT shape, but the next package update could land one that does.

**Fix:** Add `package-lock.json` to the values-scope exclude list:

```bash
diff_output_values="$(git diff --cached -U0 --no-color -- \
  ':(exclude).env.example' \
  ':(exclude)scripts/install-pre-commit-hook.sh' \
  ':(exclude)scripts/test-pre-commit-hook.sh' \
  ':(exclude)package-lock.json' \
  || true)"
```

Risk of doing this: a developer could accidentally paste a real JWT into `package-lock.json` and have it slip through. Mitigation: lockfiles are auto-generated, so this is vanishingly unlikely. Net win.

---

### WR-06: `next/font/google` (Geist) loads from Google's CDN at runtime — privacy-of-recruiter risk

**File:** `src/app/layout.tsx:2-13`
**Issue:** `next/font/google` in Next 16 is supposed to self-host fonts at build time, but the integration still makes a build-time request to Google's API, and depending on Vercel deploy region, the rendered HTML can include preconnect hints to `fonts.gstatic.com`. For a recruiter-facing landing page where part of the value proposition is "Joe engineered this with privacy/cost controls," a third-party preconnect is a footgun.

This isn't a security CVE — it's a brand-consistency issue. The agent disclaimer banner explicitly tells recruiters "I'm an AI agent... if you need a direct reply, email Joe" — which sets the expectation that the page is privacy-respecting. A `connect-src` preconnect to `fonts.gstatic.com` undermines that.

**Fix:** Either accept the trade-off (it's the default Next setup) and move on, or vendor the font locally:

1. Download Geist from `https://github.com/vercel/geist-font` (Vercel's own self-host build) and place under `public/fonts/`.
2. Replace the `next/font/google` import with `next/font/local`:

```tsx
import localFont from 'next/font/local';

const geistSans = localFont({
  src: '../../public/fonts/Geist-Variable.woff2',
  variable: '--font-geist-sans',
});
```

Defer to product judgment on this one.

## Info

### IN-01: `app/layout.tsx` retains placeholder metadata

**File:** `src/app/layout.tsx:15-18`
**Issue:** `title: "Create Next App"`, `description: "Generated by create next app"` — placeholder from `npx create-next-app`. Recruiter-facing landing page should set actual title and meta description for SEO, link-preview cards (LinkedIn unfurl, Slack unfurl), and tab labels.

**Fix:**

```tsx
export const metadata: Metadata = {
  title: "Joe Dollinger's Resume Agent",
  description: "Chat with an AI agent grounded on Joe Dollinger's PM background — case studies, decisions, and tailored pitches.",
  robots: { index: false }, // optional — keeps the page out of search until launch
};
```

---

### IN-02: `kb/profile.yml` is still a placeholder — agent has no name-token allow-list

**File:** `kb/profile.yml:6-20`
**Issue:** `years_experience: 0`, `target_roles: ["TBD"]`, `companies: []`, `tools: []`. The file's own header comment says: *"The agent uses this as a name-token allow-list in Phase 5 eval cat 1 (deterministic fabrication check). Companies/roles/tools Joe has actually worked with are added here by Plan 04."* Plan 04 is reportedly complete (per the git log this review saw), but the profile.yml allow-lists are still empty.

This will fail Phase 5 Cat-1 evals on first run because there's no allow-list to check fabrication against.

**Fix:** Populate `companies` (Under Armour, Gap, current employer if non-confidential), `tools` (Snowflake, Tableau, dbt, Cortex AI, etc. drawn from the case studies), `years_experience` (15 BI + 6 PM = 21 or pick a single number), and `target_roles`. Pulling from the existing case studies is straightforward:

```yaml
companies:
  - "Under Armour"
  - "Gap"
tools:
  - "Snowflake"
  - "Tableau"
  - "dbt"
  - "BusinessObjects"
  - "SAP FMS"
  - "SAP AFS"
  - "Cortex AI"
  - "Control-M"
  - "Jira"
years_experience: 21
target_roles:
  - "Senior Product Manager — Data Platform"
  - "Senior Product Manager — Data Cloud"
```

Confirm whether the current employer (the "fund-services data platform" implied by `cortex-ai-client-win.md`) is OK to name publicly before adding it.

---

### IN-03: `kb/resume.md`, `kb/linkedin.md`, `kb/github.md` still placeholders despite Plan 04 nominal completion

**File:** `kb/resume.md`, `kb/linkedin.md`, `kb/github.md`
**Issue:** All three contain only `TBD` content. `kb/resume.md` has `ssot: true` in frontmatter — meaning it claims to be the single source of truth for Joe's resume — but the body is `Summary: TBD; Experience: TBD; Education: TBD`. The kb-loader concatenates these into the system prompt verbatim, so the agent currently has nothing concrete to draw from for the most-asked recruiter question ("walk me through your background").

Phase 5 evals will fail any "tell me about your career" prompt — there's no source data.

**Fix:** Fill these three files. The hardest of the three is `resume.md` because of the SSOT claim; the other two are short-form supplements. Confirm Plan 04's resume-acquisition step is actually complete; if it's not, this is a planning-tracking discrepancy that the project's CONTENT-STATUS tracker should reflect.

---

### IN-04: `eslint.config.mjs` mixes string-quote styles (single/double) against `.prettierrc`

**File:** `eslint.config.mjs:1-3`
**Issue:** `eslint.config.mjs` uses double quotes (`"eslint/config"`, `"eslint-config-next/core-web-vitals"`); `.prettierrc` declares `"singleQuote": true`. Running `prettier --check` against this file will report a violation. Same situation across `src/components/ui/*.tsx` files (shadcn-vendored code uses double quotes consistently).

**Fix:** Either reformat to single quotes (Prettier will do it: `npx prettier --write .`) or add an `.prettierignore` entry for `src/components/ui/**` to protect the shadcn-vendored style. The shadcn convention is to leave UI files in their authored style so future `npx shadcn add` commands diff cleanly — that's the saner choice. Recommend:

```
# .prettierignore
src/components/ui/**
```

And a one-time format pass on `eslint.config.mjs` and `next.config.ts` to bring them in line with the project Prettier config.

---

### IN-05: `tsconfig.json` `target: "ES2017"` is conservative for Node 22+ deployment

**File:** `tsconfig.json:3`
**Issue:** `package.json` requires Node 22.11+, but `tsconfig.json` targets ES2017. That means async/await are downcompiled to generators, optional chaining stays as polyfilled JS, etc. — wasted bundle bytes for the client bundle (the server bundle is irrelevant since Node 22 supports everything natively).

**Fix:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    ...
  }
}
```

Next 16 + React 19 + Node 22 all support ES2022 natively. This is `npx create-next-app`'s default-from-2017 inertia, not an intentional choice.

---

### IN-06: `vitest.config.ts` `pool: 'vmThreads'` rationale comment will go stale

**File:** `vitest.config.ts:19`
**Issue:** `pool: 'vmThreads', // vitest 4.1.5 default pool is broken on Node 25.x; vmThreads works on 22/24/25` — useful context, but tied to a specific vitest version. When vitest is bumped past 4.1.5 the comment's rationale evaporates and a future maintainer has no signal to revisit. Low impact but worth flagging because the comment has a load-bearing version number.

**Fix:** Either add a `// TODO: revisit when vitest > 4.1.5` marker or a CI check that errors when `vitest` minor version changes without removing this override. Cheaper option: just add the TODO marker.

---

### IN-07: `src/lib/utils.ts` and `src/components/ui/*` use double quotes vs. project's single-quote convention

**File:** `src/lib/utils.ts`, `src/components/ui/button.tsx`, `src/components/ui/card.tsx`, `src/components/ui/input.tsx`, `src/components/ui/label.tsx`
**Issue:** Same as IN-04 — these files originated from the shadcn CLI and ship with double quotes by convention. Listed separately because shadcn vendored components are explicitly meant to be re-runnable via `npx shadcn add <component>`, and forcing a project-specific quote style on them creates noisy diffs every time a component is upgraded.

**Fix:** Resolution lives in IN-04 — add `.prettierignore` for `src/components/ui/**` and accept the inconsistency as a deliberate vendor-code boundary.

---

_Reviewed: 2026-04-29T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
