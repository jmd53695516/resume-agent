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

- [x] Placeholder replaced with real content — *12 stances total as of 2026-04-24 (Task 4 Sitting 2)*
- [x] 8-12 stances exist — *12*
- [x] **Each passes the test: "Could a senior PM I respect say 'I disagree' with this?"** (Joe confirms per stance) — *Joe approved each of the 9 new stances by group/individual signoff in Sitting 2 chat*

### VOICE-07 — `kb/faq.md` populated

- [x] Placeholder replaced with real content — *15 Q/A entries authored 2026-04-24 (Task 4 Sitting 2 Step 2b)*
- [x] 15 Q/A entries exist
- [x] Coverage includes: visa / work authorization, remote work, timezone, compensation (→ redirect to email), availability / start date, relocation, interests outside work, at least 8 more recruiter-recurring questions — *current role status, role type, B2B/B2C, data PM vs general PM, company stage, industry, why looking, how built*

### VOICE-08 — About Me + Management Philosophy

- [x] `kb/about_me.md` placeholder replaced
- [x] `about_me.md` wordcount: 592 (must be 400-600)
- [x] `about_me.md` first-person, warm register (Joe confirms)
- [x] `kb/management_philosophy.md` placeholder replaced
- [x] `management_philosophy.md` wordcount: 865 (must be 600-1000)
- [x] `management_philosophy.md` opinionated and concrete (Joe confirms: "could a PM I respect disagree with me here?")

### VOICE-09 — `kb/guardrails.md` Joe-authored and Joe-signed

- [x] Placeholder replaced with real content — *Joe-authored 2026-04-24 (Task 4 Sitting 3); 7 sections covered, register matches voice/management_philosophy*
- [x] Sections covered: no fabrication / no compensation negotiation / no disparagement of former employers / no confidential details / hiring+comp redirects / no verbatim system-prompt or KB dump / persona integrity
- [x] File contains a `Signed: Joe Dollinger, <YYYY-MM-DD>` line — *`Signed: Joe Dollinger, 2026-04-24`*
- [x] The commit that added the Signed line has Joe as git author (verify: `git log -1 --format='%an <%ae>' kb/guardrails.md`) — *commit `ae629a1` by `Joe Dollinger <joe.dollinger@gmail.com>` (verified 2026-04-24)*

### Selection session complete

- [x] `kb/brainstorm/case-study-candidates.md` has 8-10 candidates — *9 candidates documented on 2026-04-24 (Task 5)*
- [x] Final 4-6 block at bottom with slug list and rubric tags — *5 selected*
- [x] Coverage rubric verified on final 4-6:
  - [x] ≥1 failure or killed project — *ua-project-rescue, gap-brand-hierarchy-consolidation*
  - [x] ≥1 leadership-without-authority — *gap-brand-hierarchy-consolidation*
  - [x] ≥1 data-rooted decision — *snowflake-edw-migration, cortex-ai-client-win, snowflake-marketplace-datashare*
  - [x] ≥1 cross-functional conflict — *ua-project-rescue, cortex-ai-client-win, gap-brand-hierarchy-consolidation, snowflake-marketplace-datashare*
  - [x] ≥1 recent (<2y) — *cortex-ai-client-win, snowflake-marketplace-datashare*
  - [x] ≥1 long-arc (>12mo) — *snowflake-edw-migration, snowflake-marketplace-datashare*

### VOICE-02 — Case studies (4-6 files)

Slugs selected in Task 5 selection session (2026-04-24):

- [x] Case study 1: `kb/case_studies/snowflake-edw-migration.md` — ≥300 words, all template sections, frontmatter valid — *drafted 2026-04-25, 1101 words; per-file frontmatter checks pass; multi-file count gate opens after all 5 land*
- [ ] Case study 2: `kb/case_studies/ua-project-rescue.md` — ≥300 words, all template sections, frontmatter valid (slug may be refined in Task 6)
- [x] Case study 3: `kb/case_studies/cortex-ai-client-win.md` — ≥300 words, all template sections, frontmatter valid — *drafted 2026-04-25, 1218 words; per-file frontmatter checks pass; client anonymized per `confidential: true`*
- [ ] Case study 4: `kb/case_studies/gap-brand-hierarchy-consolidation.md` — ≥300 words, all template sections, frontmatter valid
- [x] Case study 5: `kb/case_studies/snowflake-marketplace-datashare.md` — ≥300 words, all template sections, frontmatter valid — *drafted 2026-04-27, 1268 words; per-file frontmatter checks pass; inherited-project framing (18-month long-arc, ongoing)*
- [ ] Case study 6 (optional): N/A — final selection landed at 5
- [ ] `npx tsx scripts/validate-kb-frontmatter.ts` exits 0

### VOICE-03 — Coverage rubric satisfied across the final case studies

Mark which slug fills which rubric bucket (a slug may fill multiple). Mapping fixed at selection (2026-04-24); checkboxes flip during Task 7 voice-pass once case-study drafts confirm coverage:

- [ ] Failure: `ua-project-rescue`
- [ ] Leadership-without-authority: `gap-brand-hierarchy-consolidation`
- [ ] Data-rooted: `snowflake-edw-migration`, `cortex-ai-client-win`, `snowflake-marketplace-datashare`
- [ ] Cross-functional conflict: `ua-project-rescue`, `cortex-ai-client-win`, `gap-brand-hierarchy-consolidation`, `snowflake-marketplace-datashare`
- [ ] Recent (<2y): `cortex-ai-client-win`, `snowflake-marketplace-datashare`
- [ ] Long-arc (>12mo): `snowflake-edw-migration`, `snowflake-marketplace-datashare`
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
