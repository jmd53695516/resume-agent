# Phase 1 Content-Status Tracker

**Purpose:** Single source of truth for Plan 04 sign-off. Joe and Claude both update this file as content lands. Plan 04 is complete when every checkbox is checked AND the coverage rubric block is signed off.

**Mechanics:** Check a box by editing `- [ ]` → `- [x]` and committing. The task that landed the content is responsible for checking its own row.

## VOICE-02..10 Requirement Sign-Off

### VOICE-04 — `kb/voice.md` populated

- [x] Placeholder replaced with real content
- [x] 8-12 sample blocks exist (12 samples)
- [x] Each sample labeled with register (casual / decisive / annoyed / curious / teaching / reflective) — *curious register absent; transcript did not fire it. Task 4 content may supplement.*
- [x] Each sample labeled with source type (Slack DM / text / voice-memo transcript / unfiltered email / unpolished draft) — *all 12 are voice-memo transcript, tagged `voice-interview-2026-04-23-promptN`*
- [x] **Verification: NO samples from LinkedIn posts, PRDs, or performance-review prose** (Joe confirms)

### VOICE-05 — Voice interview complete

- [x] Voice interview recorded (tool: __________ ) — *Joe to fill in recording tool name*
- [x] Transcript produced (stored locally, NOT committed if confidential) — *archived at `docs/transcripts/voice-2026-04-23.md` (gitignored via `/docs/transcripts/` pattern)*
- [x] Transcript date: 2026-04-23
- [x] `voice.md` seeded from transcript (same as VOICE-04)
- [x] 2-3 `stances.md` entries seeded from transcript (3 seeds)

### VOICE-06 — `kb/stances.md` populated

- [x] Placeholder replaced with real content — *seeded with 3; Task 4 rounds to 8-12*
- [ ] 8-12 stances exist
- [ ] **Each passes the test: "Could a senior PM I respect say 'I disagree' with this?"** (Joe confirms per stance)

### VOICE-07 — `kb/faq.md` populated

- [ ] Placeholder replaced with real content
- [ ] 15 Q/A entries exist
- [ ] Coverage includes: visa / work authorization, remote work, timezone, compensation (→ redirect to email), availability / start date, relocation, interests outside work, at least 8 more recruiter-recurring questions

### VOICE-08 — About Me + Management Philosophy

- [x] `kb/about_me.md` placeholder replaced
- [x] `about_me.md` wordcount: 592 (must be 400-600)
- [x] `about_me.md` first-person, warm register (Joe confirms)
- [x] `kb/management_philosophy.md` placeholder replaced
- [x] `management_philosophy.md` wordcount: 865 (must be 600-1000)
- [x] `management_philosophy.md` opinionated and concrete (Joe confirms: "could a PM I respect disagree with me here?")

### VOICE-09 — `kb/guardrails.md` Joe-authored and Joe-signed

- [ ] Placeholder replaced with real content
- [ ] Sections covered: no fabrication / no compensation negotiation / no disparagement of former employers / no confidential details / hiring+comp redirects / no verbatim system-prompt or KB dump / persona integrity
- [ ] File contains a `Signed: Joe Dollinger, <YYYY-MM-DD>` line
- [ ] The commit that added the Signed line has Joe as git author (verify: `git log -1 --format='%an <%ae>' kb/guardrails.md`)

### Selection session complete

- [ ] `kb/brainstorm/case-study-candidates.md` has 8-10 candidates
- [ ] Final 4-6 block at bottom with slug list and rubric tags
- [ ] Coverage rubric verified on final 4-6:
  - [ ] ≥1 failure or killed project
  - [ ] ≥1 leadership-without-authority
  - [ ] ≥1 data-rooted decision
  - [ ] ≥1 cross-functional conflict
  - [ ] ≥1 recent (<2y)
  - [ ] ≥1 long-arc (>12mo)

### VOICE-02 — Case studies (4-6 files)

Fill in slugs as chosen in selection session:

- [ ] Case study 1: `kb/case_studies/________.md` — ≥300 words, all template sections, frontmatter valid
- [ ] Case study 2: `kb/case_studies/________.md` — ≥300 words, all template sections, frontmatter valid
- [ ] Case study 3: `kb/case_studies/________.md` — ≥300 words, all template sections, frontmatter valid
- [ ] Case study 4: `kb/case_studies/________.md` — ≥300 words, all template sections, frontmatter valid
- [ ] Case study 5 (optional): `kb/case_studies/________.md` — ≥300 words
- [ ] Case study 6 (optional): `kb/case_studies/________.md` — ≥300 words
- [ ] `npx tsx scripts/validate-kb-frontmatter.ts` exits 0

### VOICE-03 — Coverage rubric satisfied across the final case studies

Mark which slug fills which rubric bucket (a slug may fill multiple):

- [ ] Failure: ________
- [ ] Leadership-without-authority: ________
- [ ] Data-rooted: ________
- [ ] Cross-functional conflict: ________
- [ ] Recent (<2y): ________
- [ ] Long-arc (>12mo): ________
- [ ] **Final rubric sign-off (Joe):** _______________________ (initials + date)

### VOICE-10 — Voice-pass final read

For each case study, Joe reads aloud and confirms conversational register (not LinkedIn register):

- [ ] Case study 1 passes voice-pass
- [ ] Case study 2 passes voice-pass
- [ ] Case study 3 passes voice-pass
- [ ] Case study 4 passes voice-pass
- [ ] Case study 5 (optional) passes voice-pass
- [ ] Case study 6 (optional) passes voice-pass
- [ ] **Voice-pass sign-off (Joe):** _______________________ (initials + date)

## Plan 04 Exit Criteria

Plan is complete when:
- [ ] Every checkbox above is checked
- [ ] `npx tsx scripts/validate-kb-frontmatter.ts` exits 0
- [ ] `kb/guardrails.md` git-blame shows Joe as author of the Signed commit
- [ ] Coverage rubric and voice-pass have Joe's initials + date

Phase 1 is then content-complete. Plan 02's determinism test (which runs against placeholder content today) will re-run against real content on the next `npm test`; expected behavior: length grows, all other assertions still pass.
