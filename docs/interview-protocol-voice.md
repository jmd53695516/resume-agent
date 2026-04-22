# Voice Interview Protocol

**Duration:** ~30 min recorded + ~30 min transcription cleanup
**Output:** A transcript file (Joe's local — NOT committed if it contains confidential material) seeding `kb/voice.md` (8-12 samples) + 2-3 `kb/stances.md` entries
**Facilitator:** Claude (in a fresh chat session with this protocol loaded)
**Covers:** VOICE-04, VOICE-05, seeds VOICE-06

## Why this protocol exists

The single largest quality risk for this project is voice that reads as generic ChatGPT (see `.planning/research/PITFALLS.md` Pitfall 3). The four-layer defense starts with **authentic voice samples from unfiltered sources** — Slack DMs, texts, voice-memo transcripts, unpolished drafts. LinkedIn posts and PRDs are **banned** as voice sources; they're already in corporate register.

The most efficient way to generate unfiltered source material is to record Joe talking extemporaneously, because **speech is already voice-first**. Transcripts of Joe talking are strictly better voice samples than anything Joe will type on LinkedIn.

## Setup (5 min)

1. **Pick a recording tool.** Loom (browser, auto-transcribes), macOS Voice Memos (local, paste into ChatGPT for clean-up), or phone voice memo + Otter.ai free tier. No "right answer" — Joe picks whichever is at hand.
2. **Pick a quiet environment.** Not mission-critical for transcription quality, but matters for Joe's willingness to be unfiltered. Don't do this in a coffee shop.
3. **Open this protocol on a second screen or phone.** Joe reads the prompt, then speaks.
4. **Rules of engagement:**
   - Speak extemporaneously; do not write out an answer first.
   - Use contractions. Say "I don't know" if you don't. Say "I think X" not "one might argue X."
   - Don't self-edit mid-sentence. Let the false starts in — they're part of voice.
   - Take positions. If a prompt asks what annoys you, name the thing.
   - Aim for 2-4 minutes per prompt. Skip any prompt that doesn't have a real answer today.

## The 8 prompts (answer in any order)

These are designed to elicit **five different registers**: casual, decisive, annoyed, curious, teaching. Aim for at least one prompt per register across the session.

### Prompt 1 — Casual register (warm-up)
*"Walk me through what you actually did at work last week. Not the résumé version — what did you type, who did you talk to, what was annoying?"*

(Register target: casual, conversational. Sample harvest: how Joe describes mundane work without polish.)

### Prompt 2 — Decisive register
*"Name one decision you made in the last year where, if someone had pushed back on it at the time, you would've said 'no, I'm doing this anyway' — and tell me why."*

(Register target: decisive, opinion-dense. Sample harvest: how Joe talks when he's sure. Also seeds `stances.md` — that "why" is usually a stance.)

### Prompt 3 — Annoyed register
*"What's a thing teams in your space do wrong over and over that you find genuinely frustrating? Not a safe pet peeve — the real one."*

(Register target: annoyed, honest. Sample harvest: how Joe talks when he's venting. Also seeds `stances.md` — the frustration is a stance.)

### Prompt 4 — Curious register
*"Is there a product or team you've been watching from the outside lately where you can't tell if they're actually doing something interesting or just generating LinkedIn posts? Talk me through the ambiguity."*

(Register target: curious, exploratory. Sample harvest: how Joe reasons out loud when he's uncertain.)

### Prompt 5 — Teaching register
*"If a new PM on your team asked you 'how do you actually measure whether a feature is working,' what would you say — as if you were answering in Slack, not writing a blog post?"*

(Register target: teaching. Sample harvest: how Joe explains without corporate scaffolding. Note the Slack-vs-blog-post framing — it's explicitly designed to prevent LinkedIn register.)

### Prompt 6 — Failure / learning
*"Tell me about a project that didn't work the way you thought it would. What did you actually do about it, and what does that look like in retrospect?"*

(Register target: reflective, candid. Sample harvest: how Joe describes failure without performance-review hedging. Also a candidate case study if the project is concrete.)

### Prompt 7 — Identity / what energizes you
*"When you've had a week that felt great — not in the smile-for-the-camera sense, in the actually-felt-great sense — what did that week usually look like? What were you doing?"*

(Register target: warm, first-person. Sample harvest: about_me.md seed material.)

### Prompt 8 — Disagreement seed
*"Name an opinion you hold about product management that you think most PMs you respect would disagree with — and walk me through why you hold it anyway."*

(Register target: opinionated. Sample harvest: direct seed for `stances.md`. The "PMs you respect would disagree" framing is the Layer 3 test.)

## After the recording (30 min)

1. **Transcribe.** Otter/Loom auto-transcribe; Voice Memos → paste into ChatGPT with prompt: "Clean up this transcript — preserve contractions, preserve false starts where they carry meaning, remove only um/uh filler and repeated words."
2. **Save the transcript** to Joe's local notes (Obsidian, Notes.app, plain .md). **DO NOT commit it to the repo if it contains confidential company or coworker details.** The KB only gets the extracted passages, not the full transcript.
3. **Seed `kb/voice.md`.** Claude (in the same or a new session) reads the transcript + Joe picks 8-12 passages of 2-4 sentences each. For each passage, label the register (casual / decisive / annoyed / curious / teaching / reflective) and the implicit source ("voice interview YYYY-MM-DD, prompt N"). Drop into `kb/voice.md` replacing the placeholder.
4. **Seed 2-3 `kb/stances.md` entries.** Prompts 2, 3, and 8 usually produce 1-3 raw stances each. Pick the 2-3 strongest, polish into short paragraphs that pass the "could a senior PM I respect say 'I disagree'?" test. These are seed entries; Task 4 rounds out to 8-12.

## Done when

- Transcript exists in Joe's local notes
- kb/voice.md has 8-12 sample blocks with register + source labels
- kb/stances.md has 2-3 seed entries (remaining 6-10 written in Task 4)
- Content-status tracker VOICE-04, VOICE-05 rows checked (partial for VOICE-06)
