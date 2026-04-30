---
phase: 02-safe-chat-core
plan: 03
subsystem: ui
tags: [ai-sdk-v6, useChat, react-19, nextjs-app-router, tailwind-v4, shadcn, playwright, streaming]

# Dependency graph
requires:
  - phase: 01-foundation-content
    provides: "Phase 1 stub /chat page reading sessionStorage.session_id; shadcn primitives (Button/Input); cn() helper; landing→/chat redirect contract"
  - phase: 02-safe-chat-core
    provides: "Plan 02-01 verified the v6 createUIMessageStream wire protocol via /api/smoke-ui-stream — same protocol useChat consumes natively in this plan"
provides:
  - "src/components/ChatUI.tsx — AI SDK v6 useChat client with consumer-managed input state, DefaultChatTransport pointing at /api/chat (POST body {session_id})"
  - "src/components/StarterPrompts.tsx — three prefill-only buttons (Pitch / Walk / Design) per CONTEXT D-I-03; data-testid hooks for e2e"
  - "src/components/MessageBubble.tsx — user right-aligned bubble + assistant plain prose with belt-and-suspenders markdown-header strip (D-I-05 / D-I-07)"
  - "src/app/chat/page.tsx — replaces Phase 1 stub; SSR-safe sessionStorage read; redirects to / when missing"
  - "tests/e2e/chat-happy-path.spec.ts — 3 Playwright specs covering CHAT-14 (button count, prefill-not-submit, redirect-when-no-session)"
  - "/test-results/, /playwright-report/, /playwright/.cache/ added to .gitignore for runtime output"
affects: [02-02-api-chat, 03-tooling, 03-trace-panel, 04-admin-dashboard, 05-eval-harness]

# Tech tracking
tech-stack:
  added: []  # No new libraries — composed @ai-sdk/react@3.0.170 (already pinned by Plan 02-01) and ai@6.0.168 DefaultChatTransport.
  patterns:
    - "AI SDK v6 consumer-managed input: useChat returns { messages, sendMessage, status, error } — input state lives in local React useState, sendMessage({ text }) called manually on submit"
    - "Status semantics: 'submitted' | 'streaming' | 'ready' | 'error' — render thinking indicator only on 'submitted' (pre-first-token), disable input bar on 'submitted' OR 'streaming'"
    - "Message rendering: filter UIMessage.parts where p.type === 'text', map to text, join('') — Phase 2 has zero tool parts, but this filter shape is forward-compatible with Phase 3 tool-* parts"
    - "Starter prompts as prefill-not-submit: handleStarterSelect sets input state and exits — recruiter edits placeholder tokens like [my company] before clicking Send"
    - "SSR-safe sessionStorage read pattern: typeof window !== 'undefined' guard inside useEffect, render null until hydrated to avoid hydration mismatch"
    - "Playwright fixture pattern: page.evaluate to set sessionStorage + page.reload() bypasses /api/session GATE flow — keeps UI specs independent of Plan 01-03's gate flow"

key-files:
  created:
    - "src/components/ChatUI.tsx — main chat client component"
    - "src/components/StarterPrompts.tsx — three CHAT-14 starter buttons"
    - "src/components/MessageBubble.tsx — user/assistant message rendering with header strip"
    - "tests/e2e/chat-happy-path.spec.ts — Playwright e2e smoke for empty-state UI"
  modified:
    - "src/app/chat/page.tsx — Phase 1 stub body replaced with <ChatUI sessionId={...} />"
    - ".gitignore — Playwright runtime output dirs ignored"

key-decisions:
  - "Used AI SDK v6 consumer-managed input pattern (local useState) — v6 deliberately decouples useChat from input state (RESEARCH-locked); plan's interface block already specified this pattern"
  - "Render thinking indicator only on status==='submitted' — once streaming begins, the streamed text itself is the indicator; avoids double-display"
  - "Markdown-header strip in MessageBubble despite system-prompt ban — defense-in-depth (D-I-07); cheap regex on render, prevents UI regression if a model checkpoint slips a header through"
  - "Empty-state message-list filter renders ONLY user/assistant roles — system/data roles silently skipped; safe forward-compat for Phase 3 when AI SDK may surface system hints"
  - "Playwright tests bypass /api/session flow via direct sessionStorage write — keeps UI specs independent of GATE e2e (Plan 01-03 owns gate-flow tests)"

patterns-established:
  - "v6 useChat configuration: new DefaultChatTransport({ api, body }) — body fields are sent on every POST, not just the first; ideal place to thread session_id"
  - "Auto-scroll: useRef + useEffect on [messages, status] with bottomRef.current?.scrollIntoView({ behavior: 'smooth' })"
  - "data-testid naming: kebab-cased label (e.g., 'starter-pitch-me-on-my-company') — Playwright getByTestId stays readable in specs"

requirements-completed: [CHAT-14]

# Metrics
duration: 4min
completed: 2026-04-30
---

# Phase 02 Plan 03: Chat UI + Starter Prompts Summary

**Streaming chat UI built on AI SDK v6 useChat with three CHAT-14 starter-prompt buttons, prefill-not-submit semantics, thinking indicator, markdown-header strip, and 3 Playwright specs covering the empty-state contract**

## Performance

- **Duration:** ~4 min (executor wall time)
- **Started:** 2026-04-30T00:33:16Z
- **Completed:** 2026-04-30T00:37:09Z
- **Tasks:** 3 of 4 executed (Task 4 was a `checkpoint:human-verify` — auto-approved with explicit deferral; see Deviations)
- **Files modified:** 6 (3 created components, 1 page replacement, 1 e2e spec, 1 .gitignore)

## Accomplishments

- Replaced Phase 1's "chat coming in Phase 2" stub with a real streaming chat UI using AI SDK v6's consumer-managed-input `useChat` pattern.
- Closed CHAT-14: three starter-prompt buttons render in the empty state with prefill-not-submit semantics — recruiter can edit `[my company]` etc. before sending.
- Defense-in-depth markdown-header strip in `MessageBubble` (D-I-07) — belt-and-suspenders alongside the system prompt's VOICE-11 ban on headers.
- 3 Playwright specs all passing: button count = 3, click-prefills-without-submit, /chat redirects to / when session id missing.
- `.gitignore` updated to swallow Playwright runtime output (`/test-results/`, `/playwright-report/`, `/playwright/.cache/`).

## Task Commits

Each task was committed atomically with normal pre-commit hooks (no `--no-verify`):

1. **Task 1: Build ChatUI, StarterPrompts, MessageBubble** — `8471f0c` (feat)
2. **Task 2: Replace /chat page stub** — `0bd98ad` (feat)
3. **Task 3: Playwright e2e smoke** — `6d91a82` (test)
4. **Task 4: Human verify** — auto-approved in auto-mode (no commit; see Deviations)

**Plan metadata commit:** pending after this SUMMARY is written.

## Files Created/Modified

**Created:**
- `src/components/ChatUI.tsx` — AI SDK v6 useChat client; DefaultChatTransport with `body: { session_id }` threaded on every POST; input state via local useState; thinking indicator on `status === 'submitted'`; auto-scroll via bottomRef; sticky form input bar disabled while `isStreaming` (submitted | streaming).
- `src/components/StarterPrompts.tsx` — three CONTEXT D-I-03 buttons with editable prefill text; `data-testid="starter-prompts"` group + `starter-{kebab-label}` per button.
- `src/components/MessageBubble.tsx` — user right-aligned subtle bubble; assistant left-aligned plain prose; `stripMarkdownHeaders` regex strips `^#{1,6}\s+` from each line.
- `tests/e2e/chat-happy-path.spec.ts` — 3 Playwright specs (CHAT-14 button count, prefill-not-submit, no-session redirect).

**Modified:**
- `src/app/chat/page.tsx` — Phase 1 stub replaced; SSR-safe sessionStorage read inside useEffect; renders `null` until hydrated to avoid hydration mismatch; redirects to `/` when no session_id; renders `<ChatUI sessionId={sessionId} />` once present.
- `.gitignore` — Playwright runtime output directories added.

## Decisions Made

- **v6 useChat consumer-managed input.** Plan-specified; v6 deliberately decouples useChat from input state. Input lives in `useState`, `sendMessage({ text: input })` called manually on submit.
- **Single thinking indicator on `status === 'submitted'` only.** Once streaming starts, the streamed text itself is the indicator — avoids double-display.
- **Defense-in-depth markdown-header strip.** Even though VOICE-11 bans headers, MessageBubble strips `^#{1,6}\s+` on render. Cheap and prevents regression if a future model checkpoint slips a header through.
- **Playwright tests bypass /api/session** via direct sessionStorage write + page.reload(). Keeps these UI specs independent of GATE flow (which Plan 01-03 owns).
- **Form input bar disabled during `isStreaming` (submitted | streaming)**, send button additionally requires `input.trim()` non-empty — matches CONTEXT D-I-02 sticky-input intent.

## Deviations from Plan

### Out-of-scope additions

**1. [Rule 3 — Blocking] Added `/test-results/`, `/playwright-report/`, `/playwright/.cache/` to .gitignore**
- **Found during:** Task 3 (Playwright run created untracked test-results/ dir).
- **Issue:** Playwright leaves runtime output in `test-results/` even on a clean pass; not adding to .gitignore would mean every future run leaves an untracked dir; pre-commit-hook untracked-file scan would surface it.
- **Fix:** Three Playwright runtime dirs added to .gitignore.
- **Files modified:** `.gitignore`
- **Verification:** `git status --short` no longer reports `test-results/` after the change.
- **Committed in:** `6d91a82` (rolled into Task 3 commit; the .gitignore edit is part of test infra setup, not plan scope).

### Task 4 (human-verify) auto-approval & deferral

Task 4 of the plan describes a manual browser verification of live Sonnet streaming + Supabase message persistence + injection deflection — all of which require **`/api/chat` to be live, which is built by Plan 02-02, NOT yet executed**.

The orchestrator explicitly noted: *"This plan should target the route name that 02-02 will produce, but verify the chat UI compiles and renders without requiring `/api/chat` to be live"*, and: *"OR just skip the live-backend test and note it as 'verified in Plan 02-02'."*

**Auto-mode policy** (`workflow.auto_advance: true`) auto-approves `checkpoint:human-verify`. Combined with the orchestrator's explicit deferral instruction, Task 4's **structural** acceptance criteria were validated automatically:

| Task 4 acceptance | Verified here | Verified in 02-02 |
|---|---|---|
| `/chat` shows three starter buttons in empty state | YES — Playwright spec 1 | — |
| Clicking starter prefills without submitting | YES — Playwright spec 2 | — |
| `/chat` redirects to `/` when no session | YES — Playwright spec 3 | — |
| `npx tsc --noEmit` clean (page + components compile) | YES | — |
| `useChat` configured with v6 wire protocol via DefaultChatTransport at `/api/chat` (route shell present) | YES — code review | — |
| Live token-by-token Sonnet streaming with thinking indicator | DEFERRED — `/api/chat` not yet built | YES (Plan 02-02 Task 4) |
| VOICE-11 obedience (no "Great question", no markdown headers, <120 words) | DEFERRED | YES |
| Supabase `messages` row inserts in onFinish | DEFERRED | YES |
| Injection deflection via Haiku classifier preflight | DEFERRED | YES |

**No new commit was created for Task 4.** The plan's `<done>` for Task 4 said "Plan 02-03 complete on Joe's `verified` reply. Write `02-03-SUMMARY.md`." — auto-mode satisfies the policy equivalent of that reply, with the SUMMARY explicitly flagging what is and isn't verified.

---

**Total deviations:** 1 minor (.gitignore augmentation, rolled into Task 3 commit) + 1 documented deferral (Task 4 live-backend checks moved to Plan 02-02 verifier scope).

**Impact on plan:** Zero scope creep. The .gitignore add is test-infrastructure hygiene. Task 4's deferral was pre-blessed by the orchestrator due to the wave ordering (02-03 ships UI before 02-02 ships /api/chat).

## Issues Encountered

None during planned work. All three component files compiled clean on first pass; all three Playwright specs passed on first run.

## User Setup Required

None — no external service configuration required for this plan.

The Phase 2 user-setup requirement (Anthropic org-level $20/month spend cap, recorded in STATE.md blockers from Plan 02-01) remains pending and is **not** unblocked by this plan; it gates Phase 5 deploy.

## Known Stubs

The chat UI is fully wired client-side, but the network target `/api/chat` does not yet exist (Plan 02-02). Functionally the UI will:
- Render correctly in empty state (verified).
- Allow input typing and starter-prompt prefill (verified).
- On submit: `useChat` POSTs to `/api/chat` and will receive a 404 until Plan 02-02 lands. The `error` branch in ChatUI renders a generic "Something went wrong" message — graceful failure, not a crash.

This is **expected by orchestrator design** (wave ordering puts UI in Wave 1 of Phase 2, /api/chat in Wave 2). Not a stub to fix in this plan.

## Self-Check: PASSED

All claimed files exist on disk:
- `src/components/ChatUI.tsx`
- `src/components/StarterPrompts.tsx`
- `src/components/MessageBubble.tsx`
- `src/app/chat/page.tsx` (replaced)
- `tests/e2e/chat-happy-path.spec.ts`
- `.planning/phases/02-safe-chat-core/02-03-SUMMARY.md`

All claimed commits exist in git history:
- `8471f0c` (Task 1)
- `0bd98ad` (Task 2)
- `6d91a82` (Task 3)

## Next Phase Readiness

**Ready for Plan 02-02:** The chat UI client is fully built and pointed at `POST /api/chat` with body shape `{ session_id, messages }` (the `messages` field is supplied automatically by AI SDK v6). When Plan 02-02 implements the route per its plan spec, the UI will start working without further frontend changes.

**Phase 2 readiness post-02-02:** Plan 02-02's Task 4 should perform the live verification originally scoped to this plan's Task 4 (real Sonnet streaming, VOICE-11 obedience, Supabase persistence, injection deflection). All Playwright e2e in `tests/e2e/chat-happy-path.spec.ts` will continue to pass without modification.

**Phase 3 readiness:** The `MessageBubble` filter pattern (`p.type === 'text'`) is forward-compatible with Phase 3 tool-call parts — the trace panel will subscribe to a different filter (`p.type.startsWith('tool-')`) without disturbing assistant prose rendering. Starter buttons remain pure UX stubs in this plan; Phase 3 will rewire `handleStarterSelect` to invoke specific tools instead of prefilling text.

---
*Phase: 02-safe-chat-core*
*Completed: 2026-04-30*
