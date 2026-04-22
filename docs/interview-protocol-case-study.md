# Per-Case-Study Interview Protocol

**Duration:** ~45 min per case study (4-6 sessions total = 3-5 hours)
**Output:** One `kb/case_studies/<slug>.md` file per session, drafted voice-first, ≥300 words, all template sections filled, frontmatter complete
**Facilitator:** Claude (fresh chat session per case study, this protocol + the selected candidate's row from `case-study-candidates.md` loaded)
**Covers:** VOICE-02, VOICE-10

## Why this protocol exists

Case studies are the #1 behavioral-interview question a recruiter will have the agent answer. If these read as LinkedIn-register slide decks, the whole portfolio pitch dies. The protocol is engineered to:
1. Extract enough specifics that the agent can narrate without fabricating
2. Keep Joe in conversational register (voice-first), not performance-review prose
3. Produce a first draft ready for grammar cleanup, not voice-transplant surgery

**Voice-passing at the end never works** (Pitfall 3 execution detail). If the first draft is in LinkedIn register, the story is dead — start over.

## Setup (5 min)

1. Claude loads: this protocol, the candidate's row from `case-study-candidates.md`, `kb/voice.md` (for register reference), `docs/superpowers/specs/2026-04-21-resume-agent-design.md` §4 case-study template.
2. Joe and Claude agree on the slug (kebab-case, content-descriptive) and the file path `kb/case_studies/<slug>.md`.
3. Joe pulls any supporting material out of memory (or local notes): the actual metrics, dates, the names of internal tools, who pushed back, what the deck looked like. These don't go in the file — they ground Joe's recall.

## Interview phase (30 min — the 5 clusters)

Claude asks the questions below, Joe answers extemporaneously. Claude takes notes but does NOT draft yet. **15-20 probing questions total, distributed across the 5 clusters.**

### Cluster 1 — Context (5-7 min, ~4 questions)
1. *"Set the scene. What was the team, what was the business context, what were you supposed to be doing when this started?"*
2. *"Who were the users — and be specific. Not 'enterprise customers,' name the archetype or the actual 2-3 companies if you can."*
3. *"What did everyone on the team believe to be true at the start that turned out to be load-bearing later?"*
4. *"If you'd described this project to a friend the week it started, what would you have said?"* (voice-forcing — conversational register)

### Cluster 2 — Options Considered (5-7 min, ~3 questions)
5. *"Before you landed on what you did, what were the other options on the table? Even the ones that were dismissed fast — what made them attractive to the people who raised them?"*
6. *"Who was pushing for each option? Doesn't have to be names — 'the eng lead' is fine — but who wanted what?"*
7. *"What was the option that was almost chosen? The one that lost by a hair?"*

### Cluster 3 — Decision & Reasoning (5-7 min, ~4 questions)
8. *"What did you actually decide, and what were the 2-3 factors that tipped it?"*
9. *"Was there a moment or a meeting where the decision crystallized, or did it accrete?"*
10. *"What did you know at the time that you wouldn't have bet money on?"* (surfaces the gap between what was known and what was believed)
11. *"What did the skeptics say, and what did you say back?"* (voice-forcing — disagreement)

### Cluster 4 — Outcome (5-7 min, ~3 questions)
12. *"Quantified where possible: what happened? Specific numbers, specific dates."*
13. *"What was the outcome that the skeptics had predicted, and how close did they get?"*
14. *"If there was one moment where you knew this was either working or not working — when was it?"*

### Cluster 5 — Retrospective (5-7 min, ~4 questions) — this is the "senior" tent pole
15. *"What would you do differently if you ran it again today?"*
16. *"What did you learn that you now apply to unrelated projects?"*
17. *"Is there a thing that happened that you haven't fully metabolized — you still think about it, still aren't sure?"* (the ambiguity surfaces seniority)
18. *"What's the critique of this story someone could make that you'd have to take seriously?"*

### Optional follow-up — Recruiter Q&A (3-5 min, 2-3 questions)
19. *"If a recruiter asked 'what was your actual contribution here vs. the team's,' what would you say?"*
20. *"If a recruiter said 'isn't this really a <adjacent discipline> problem, not a PM problem?' — how would you answer?"*

## Drafting phase (10 min)

Claude writes the case-study file in real-time at the end of the interview. **Voice-first rule:** the first draft is in conversational register — use contractions, let sentence length vary, take positions, don't add corporate scaffolding. Grammar cleanup comes later. Target ≥300 words, typically 400-600.

File template (real files use plain three-hyphen YAML delimiters — shown here with leading bullets to avoid confusing YAML parsers that scan this plan file):

```
• frontmatter open (three hyphens on their own line)
slug: <kebab-case-slug>           # must match filename
hook: "<one-line-hook>"
role: "<title-at-company-or-placeholder-if-confidential>"
timeframe: "<YYYY QN – YYYY QM>"
confidential: <false|true>
• frontmatter close (three hyphens on their own line)

## Context
<~80-120 words, first-person conversational>

## Options considered
- <option 1 — why it looked attractive, why it lost>
- <option 2>
- <option 3>

## Decision & reasoning
<~80-120 words — what + 2-3 factors that tipped it>

## Outcome
<quantified where possible; specific where not>

## Retrospective
<the "senior" section — what I'd do differently, what I still don't know>

## Likely recruiter follow-ups (and my answers)
- Q: <common follow-up from Cluster 5 / optional>
  A: <conversational answer>
- Q: <another>
  A: <answer>
```

If `confidential: true`, Claude proactively swaps company/person names for placeholders during drafting ("[large e-commerce platform]", "the eng lead") — do NOT leave real names in the file pending later scrubbing.

## Joe edits (rolling, ~10 min per case study the next day)

1. Read aloud. If any sentence sounds like LinkedIn, rewrite it.
2. Check: does the Retrospective section have real ambiguity, or is it "what I learned was the importance of collaboration"? If the latter, rewrite.
3. Check: are the Options genuinely competing, or is Option 1 obviously the right answer and Options 2-3 strawmen? If strawmen, rewrite or cut.
4. Do NOT add bullets where there's a natural paragraph. Do NOT add markdown headers within sections.
5. Run `npx tsx scripts/validate-kb-frontmatter.ts` — frontmatter must validate.

## Done when (per case study)

- File at `kb/case_studies/<slug>.md` exists with all template sections filled
- Frontmatter has `slug`, `hook`, `role`, `timeframe`, `confidential`
- File is ≥300 words
- Read-aloud passes: first-draft conversational register, not LinkedIn
- `npx tsx scripts/validate-kb-frontmatter.ts` exits 0
- Content-status tracker row for this slug checked
