# Case-Study Selection Session Protocol

**Duration:** ~30 min live session (Joe + Claude)
**Output:** `kb/brainstorm/case-study-candidates.md` filled to 8-10 candidates, pruned to 4-6 with the coverage rubric satisfied
**Facilitator:** Claude (in a fresh chat session with this protocol + Joe's resume.md loaded)
**Covers:** Groundwork for VOICE-02, VOICE-03

## Why this protocol exists

Joe has 15+ years of BI + 6 years of PM experience. The first brainstorm will surface 15-25 candidate stories. The job of this session is to **converge fast** — 30 minutes, not 3 hours — and land on 4-6 case studies whose combined coverage satisfies the rubric without overlap.

Being too precious about case-study selection is a common failure mode. The 4-6 chosen stories are not "Joe's greatest hits" — they're the stories that span the coverage rubric so a recruiter who asks any behavioral question can get a real answer.

## Setup (5 min)

1. Claude loads `kb/resume.md` (real content, landed from Joe-authored resume), `kb/about_me.md`, any previous voice-interview transcripts, and this protocol.
2. Joe has a blank `kb/brainstorm/case-study-candidates.md` open (scaffold from Plan 02 Task 1).
3. Joe has 30 focused minutes. No laptop-open-in-parallel multitasking — this is the only open task.

## Brainstorm phase (15 min)

Claude asks, Joe answers. **Target: 8-10 candidates.** Better to have 10 and cut than 6 and stretch.

Prompts Claude cycles through:

1. *"Scanning your resume — what's a story from {role at company X} that you tell in interviews that lands?"*
2. *"What's a project where you had to get 5+ people to do something they initially didn't want to do?"* (targets leadership-without-authority)
3. *"When's a time you killed something? Killed a feature, killed a project, killed an initiative. What was the decision mechanism?"* (targets failure / killed project)
4. *"What's a decision you made from data that would've been wrong if you'd gone with intuition — or vice versa?"* (targets data-rooted or intuition-validated)
5. *"When was there a real conflict across teams where you were the person in the middle?"* (targets cross-functional conflict)
6. *"Most recent thing you shipped that you'd want to narrate — even if it's still ongoing?"* (targets recent, <2y)
7. *"What's the longest-arc project you've been involved in — the one that took a year or more to land?"* (targets long-arc, >12mo)
8. *"What's the story that, when you tell it at dinner with non-work people, actually lands as 'oh that's interesting'?"* (fishing for memorable hooks)

For each candidate, Claude captures (in the `case-study-candidates.md` file in realtime), using this row template:

```
## Candidate: <working title>
- **Role / timeframe:**
- **One-line hook:**
- **Why this one? (skill/trait):**
- **Rough outcome:**
- **Confidentiality concerns:**
- **Freshness:**
- **Rubric bucket(s) it could fill:** failure / leadership-without-authority / data-rooted / cross-functional-conflict / recent / long-arc
```

## Pruning phase (10 min)

Coverage rubric (must satisfy with the final 4-6):
- [ ] ≥1 failure or killed project
- [ ] ≥1 leadership-without-authority
- [ ] ≥1 data-rooted decision
- [ ] ≥1 cross-functional conflict
- [ ] ≥1 recent (<2y)
- [ ] ≥1 long-arc (>12mo)

Pruning rules (apply in order):
1. **Remove duplicates of coverage.** If two stories both fill "cross-functional conflict" and nothing else, pick the more memorable and cut the other.
2. **Remove confidentiality-blocked stories** where the anonymization would gut the specifics.
3. **Remove stories where the outcome is unclear or still-unfolding** unless "still unfolding" is the point (recent, ongoing) and Joe can narrate it cleanly.
4. **Aim for 4-6.** If rubric coverage forces 7, keep 7 and note to cut one after drafting (weakest draft loses). If rubric can be satisfied with 4, ship 4.

## Finalization (5 min)

At the bottom of `case-study-candidates.md`, add this block (fill in the slugs):

```
## Final 4-6 (selected YYYY-MM-DD)
1. <slug-one>             — rubric: failure, long-arc
2. <slug-two>             — rubric: leadership-without-authority
3. <slug-three>           — rubric: data-rooted, recent
4. <slug-four>            — rubric: cross-functional-conflict
5. <slug-five>  (optional) — rubric: <bucket>
6. <slug-six>   (optional) — rubric: <bucket>

Rubric coverage verified: ✅ failure ✅ leadership-w/o-authority ✅ data-rooted ✅ cross-functional ✅ recent ✅ long-arc
```

Slugs are kebab-case, content-descriptive, not cute (see CONTEXT.md specifics). Good: `killing-the-feature`, `bi-migration`, `onboarding-ab-test`. Bad: `project-x`, `story-1`, `my-biggest-win`.

## Done when

- `kb/brainstorm/case-study-candidates.md` has 8-10 candidates listed + final 4-6 block with rubric check
- Joe has a time-on-calendar block for each of the 4-6 case-study interviews (Task 6)
- Content-status tracker row "Case-study selection complete" checked
