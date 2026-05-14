---
phase: 07-add-test-yml-github-actions-workflow-for-determinism
plan: 1A
type: execute
wave: 1
depends_on: [07-01]
files_modified:
  - src/hooks/use-is-client.ts
  - src/app/admin/(authed)/abuse/page.tsx
  - src/app/admin/(authed)/evals/calibrate/page.tsx
  - src/app/admin/components/LocalTime.tsx
  - src/app/admin/components/RelativeTime.tsx
  - src/app/chat/page.tsx
  - src/app/error.tsx
  - src/components/ChatStatusBanner.tsx
  - src/components/ChatUI.tsx
  - src/lib/eval/cats/cat2.ts
  - .planning/ROADMAP.md
autonomous: false
requirements: []
tags: [lint, react-hooks, hydration, useSyncExternalStore, pre-flight, deferred-task-3]

must_haves:
  truths:
    - "`npm run lint` exits 0 from a clean-env shell — all 9 src/ violations resolved (closes the 07-01 Task 3 lint blocker)"
    - "`npm test && npx tsc --noEmit && npm run lint && npm run build` all exit 0 from a zero-secrets shell (07-01 Task 3 absorbed)"
    - "Sentinel env-var list captured for 07-02's test.yml env: block — list documented in this plan's SUMMARY Handoff section"
    - "All existing Playwright cat6 specs (chat-happy-path.spec.ts + cat-06-view-toggle.spec.ts) still pass"
    - "Plan 05.2-03 timestamp-divider rendering remains byte-identical for the same chat session — D-A-04 invariant (timestamp captured for every assistant message, shouldShowTimestampBefore 5-min rule unchanged)"
    - "Hydration boundary timing on /chat and ChatStatusBanner preserved — server renders pre-hydration null, client transitions to hydrated UI exactly once"
    - "LocalTime + RelativeTime preserve suppressHydrationWarning behavior — server emits ISO, client formats locale-correctly"
    - "ROADMAP.md Phase 7 plans block lists 07-1A-PLAN.md between executed 07-01 and pending 07-02"
  artifacts:
    - path: "src/hooks/use-is-client.ts"
      provides: "Shared useIsClient() hook backed by useSyncExternalStore (D-A-02)"
      contains: "useSyncExternalStore"
      min_lines: 8
    - path: "src/app/chat/page.tsx"
      provides: "Hydration boundary now uses useIsClient() — no setState-in-effect"
      contains: "useIsClient"
    - path: "src/components/ChatStatusBanner.tsx"
      provides: "Hydration boundary now uses useIsClient() — no setState-in-effect"
      contains: "useIsClient"
    - path: "src/app/admin/components/LocalTime.tsx"
      provides: "Locale time formatting via useSyncExternalStore — no setState-in-effect"
      contains: "useSyncExternalStore"
    - path: "src/app/admin/components/RelativeTime.tsx"
      provides: "Relative time formatting via useSyncExternalStore — no setState-in-effect"
      contains: "useSyncExternalStore"
    - path: "src/components/ChatUI.tsx"
      provides: "Assistant-message timestamp capture hoisted from post-stream useEffect to useChat onFinish callback (D-A-04)"
      contains: "onFinish"
  key_links:
    - from: "src/app/chat/page.tsx"
      to: "src/hooks/use-is-client.ts"
      via: "useIsClient() import replacing useState+useEffect hydration pattern"
      pattern: "from '@/hooks/use-is-client'|from '\\.\\./.+/use-is-client'"
    - from: "src/components/ChatStatusBanner.tsx"
      to: "src/hooks/use-is-client.ts"
      via: "useIsClient() import replacing useState+useEffect hydration pattern"
      pattern: "from '@/hooks/use-is-client'|from '\\.\\./hooks/use-is-client'"
    - from: "src/components/ChatUI.tsx"
      to: "@ai-sdk/react useChat onFinish callback"
      via: "Assistant timestamps stamped at stream end (onFinish) instead of in post-status useEffect"
      pattern: "onFinish.*setAssistantTimestamps|setAssistantTimestamps.*onFinish"
    - from: "src/app/admin/(authed)/abuse/page.tsx"
      to: "react-hooks/purity rule"
      via: "eslint-disable-next-line + Server Component rationale comment"
      pattern: "eslint-disable-next-line react-hooks/purity"
    - from: "src/app/admin/(authed)/evals/calibrate/page.tsx"
      to: "react-hooks/purity rule"
      via: "eslint-disable-next-line + Server Component rationale comment"
      pattern: "eslint-disable-next-line react-hooks/purity"
---

<objective>
Resolve the 9 pre-existing `eslint-plugin-react-hooks@6` violations in `src/` exposed by Plan 07-01 Task 3's clean-env pre-flight attempt, then execute the deferred Task 3 (`npm test && npx tsc --noEmit && npm run lint && npm run build` from a zero-secrets shell). Capture the empirical sentinel-env-var list as a handoff for Plan 07-02's `test.yml` `env:` block.

Purpose: Unblocks Plan 07-02 — `npm run lint` must exit 0 from a clean-env shell before `test.yml` can run in CI without going RED. Per-violation strategy is fully locked in `07-1A-CONTEXT.md` Decisions D-A-01..05. This plan implements those decisions verbatim with per-task acceptance criteria. Closes the 07-01 deferred Task 3 lint blocker plus the deferred Task 3 verification work.

Output:
- `src/hooks/use-is-client.ts` — new shared hook backed by `useSyncExternalStore` (D-A-02 idiom).
- 5 `set-state-in-effect` violations resolved: 2 hydration sites collapse to `useIsClient()`; 2 time-format components refactored to `useSyncExternalStore`; 1 ChatUI timestamp capture hoisted to `useChat` `onFinish`.
- 2 `purity` violations resolved: targeted `eslint-disable-next-line` with Server-Component rationale comment.
- 2 trivials resolved: `_reset` removed (or disabled with rationale); `let totalCost` → `const totalCost`.
- Clean-env pre-flight gate green: all 4 commands exit 0 from a shell with no real production secrets exported.
- Sentinel-env-var list documented in handoff section for 07-02 consumption.
- ROADMAP.md Phase 7 plans block updated to insert this plan between 07-01 and 07-02 (D-D-02).

Autonomy: This plan is `autonomous: false` because Task 9 includes Joe-driven manual smoke verification (chat send + matrix-mode toggle + admin pages render). Tasks 1-8 + 10 are autonomous-executable.

Requirements: `requirements: []` — this is a decimal-equivalent CI-instrumentation phase closing the 06-06 Task 8 gap. No formal REQ-IDs map here. The plan closes 07-01's deferred Task 3 plus the lint-debt blocker that surfaced during execution.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-add-test-yml-github-actions-workflow-for-determinism/07-1A-CONTEXT.md
@.planning/phases/07-add-test-yml-github-actions-workflow-for-determinism/07-CONTEXT.md
@.planning/phases/07-add-test-yml-github-actions-workflow-for-determinism/07-01-SUMMARY.md
@package.json
@vitest.config.ts

<interfaces>
<!-- Key types and current state — embedded so executor does not need to grep the codebase for shape. -->

### Current shape of `useChat` from @ai-sdk/react v6 (verified from node_modules/ai/dist/index.d.ts:3714-3758)

```typescript
interface ChatInit<UI_MESSAGE extends UIMessage> {
  id?: string;
  transport?: ChatTransport<UI_MESSAGE>;
  onError?: ChatOnErrorCallback;
  onToolCall?: ChatOnToolCallCallback<UI_MESSAGE>;
  onFinish?: ChatOnFinishCallback<UI_MESSAGE>;  // ← USE THIS for D-A-04
  onData?: ChatOnDataCallback<UI_MESSAGE>;
  // ...
}

type ChatOnFinishCallback<UI_MESSAGE extends UIMessage> = (options: {
  message: UI_MESSAGE;
  messages: UI_MESSAGE[];
  isAbort: boolean;
  isDisconnect: boolean;
  isError: boolean;
  finishReason?: FinishReason;
}) => void;
```

CRITICAL FINDING — AI SDK v6's `useChat` does NOT expose `onChunk` at all. CONTEXT.md D-A-04 stated preference was `onChunk` with `onFinish` as acceptable fallback. Since `onChunk` is unavailable, we use `onFinish` — the timestamp shifts from "first chunk arrival" to "stream end" but Plan 05.2-03's timestamp-divider 5-min rule (`shouldShowTimestampBefore`) only needs A timestamp per assistant message; stream-end timing is within acceptable bounds (typically <2s delta from first-chunk for a normal reply). The `onFinish` `message` parameter gives us the completed assistant message including its `id` directly — no need to walk `messages` array. The existing `onFinish` handler (BL-18 error-counter reset) can be extended to also stamp.

### useSyncExternalStore canonical shape

```typescript
const value = useSyncExternalStore<T>(
  subscribe: (callback: () => void) => () => void,  // returns unsubscribe
  getSnapshot: () => T,                              // client snapshot
  getServerSnapshot: () => T,                        // server snapshot (different from client = exactly what we want for hydration)
);
```

### Current state of files being modified (read these in `<read_first>`)

`src/components/ChatUI.tsx` lines 49-86 (current shape, will change in Task 6):

```typescript
const [assistantTimestamps, setAssistantTimestamps] = useState<Record<string, number>>({});

const { messages, sendMessage, status, error } = useChat<ResumeAgentUIMessage>({
  transport: new DefaultChatTransport({ api: '/api/chat', body: { session_id: sessionId } }),
  onError: () => {
    errorCountRef.current += 1;
    if (errorCountRef.current >= 2) router.push('/?fallback=1');
  },
  onFinish: ({ isError, isAbort, isDisconnect }) => {
    if (!isError && !isAbort && !isDisconnect) {
      errorCountRef.current = 0;
    }
  },
});

// THIS IS THE EFFECT TO REMOVE (line 80-86):
useEffect(() => {
  if (status !== 'streaming') return;
  const latest = [...messages].reverse().find((m) => m.role === 'assistant');
  if (!latest) return;
  if (assistantTimestamps[latest.id]) return;
  setAssistantTimestamps((prev) => ({ ...prev, [latest.id]: Date.now() }));
}, [status, messages, assistantTimestamps]);
```

`src/app/chat/page.tsx` lines 38-52 (current shape, will change in Task 3):

```typescript
const [sessionId, setSessionId] = useState<string | null>(null);
const [hydrated, setHydrated] = useState(false);
const [view, setView] = useState<'chat' | 'matrix'>('chat');

useEffect(() => {
  setHydrated(true);  // ← line 45, react-hooks/set-state-in-effect violation #5
  const id = typeof window !== 'undefined' ? sessionStorage.getItem('session_id') : null;
  if (!id) { router.replace('/'); return; }
  setSessionId(id);
}, [router]);
```

`src/components/ChatStatusBanner.tsx` lines 11-31 (current shape, will change in Task 3):

```typescript
const [dismissed, setDismissed] = useState(false);
const [hydrated, setHydrated] = useState(false);

useEffect(() => {
  setHydrated(true);  // ← line 17, react-hooks/set-state-in-effect violation #7
  try {
    if (typeof window !== 'undefined') {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
    }
  } catch { /* swallow */ }
}, []);
```

`src/app/admin/components/LocalTime.tsx` (current, full file — will change in Task 4):

```typescript
'use client';
import { useEffect, useState } from 'react';

export function LocalTime({ iso, format = 'datetime' }: {
  iso: string; format?: 'datetime' | 'date' | 'time';
}) {
  const [text, setText] = useState(iso);
  useEffect(() => {  // ← line 17-26, violation #3 on line 20
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) { setText(iso); return; }
    if (format === 'date') setText(d.toLocaleDateString());
    else if (format === 'time') setText(d.toLocaleTimeString());
    else setText(d.toLocaleString());
  }, [iso, format]);
  return <span suppressHydrationWarning>{text}</span>;
}
```

`src/app/admin/components/RelativeTime.tsx` (current, full file — will change in Task 5):

```typescript
'use client';
import { useEffect, useState } from 'react';

function relative(iso: string): string { /* ... uses Date.now() ... */ }

export function RelativeTime({ iso }: { iso: string }) {
  const [text, setText] = useState(iso);
  useEffect(() => {        // ← line 24-26, violation #4 on line 25
    setText(relative(iso));
  }, [iso]);
  return <span suppressHydrationWarning>{text}</span>;
}
```

`src/app/admin/(authed)/abuse/page.tsx` line 25 (Server Component — will change in Task 7):

```typescript
const SINCE = new Date(Date.now() - 90 * 24 * 3600_000).toISOString();  // ← violation #1
```

`src/app/admin/(authed)/evals/calibrate/page.tsx` lines 54-56 (Server Component — will change in Task 7):

```typescript
const sinceISO = new Date(
  Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000,  // ← violation #2 on line 55
).toISOString();
```

`src/app/error.tsx` lines 14-20 (current shape — will change in Task 1):

```typescript
export default function ErrorBoundary({
  error,
  reset: _reset,  // ← line 16, @typescript-eslint/no-unused-vars violation #6
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
```

`src/lib/eval/cats/cat2.ts` line 176 (current shape — will change in Task 1):

```typescript
const results: EvalCaseResult[] = [];
let totalCost = 0;  // ← line 176, prefer-const violation #9 (never reassigned downstream)
```

### tsconfig path alias

`@/hooks/...` should resolve to `src/hooks/...` per project convention (Plan 03-04 established `src/hooks/`). If `tsconfig.json` does NOT already alias `@/hooks`, the existing `@/*` → `src/*` baseUrl alias covers it transparently — `import { useIsClient } from '@/hooks/use-is-client'` resolves correctly without tsconfig changes.

</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Trivials warmup — fix `_reset` unused arg + `prefer-const` on totalCost</name>
  <files>src/app/error.tsx, src/lib/eval/cats/cat2.ts</files>
  <read_first>
    - `src/app/error.tsx` — see current shape in `<interfaces>` block above (lines 14-20)
    - `src/lib/eval/cats/cat2.ts` — see current shape in `<interfaces>` block above (line 176)
    - `.planning/phases/07-add-test-yml-github-actions-workflow-for-determinism/07-1A-CONTEXT.md` — D-A-05 strategy for trivials
    - `.planning/phases/07-add-test-yml-github-actions-workflow-for-determinism/07-CONTEXT.md` — parent context
  </read_first>
  <action>
Two minimal fixes — combined as a warmup task to validate the lint command shape works.

**Fix 1.1 — `src/app/error.tsx` line 16 (violation #6, D-A-05):**

Remove the unused `reset` parameter entirely. Next.js error.tsx accepts `error` and `reset` props but Next does not require the component to declare props it doesn't use — declaring it triggers `@typescript-eslint/no-unused-vars` even with the underscore prefix because the default ESLint config treats `_`-prefix as informational, not a suppression token.

Use the Edit tool. Locate the existing block:

```tsx
export default function ErrorBoundary({
  error,
  reset: _reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
```

Replace with:

```tsx
export default function ErrorBoundary({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
```

WHY this shape over alternatives:
- Remove the destructure binding for `reset` (consumes the prop without naming it). The TYPE still declares `reset: () => void` so Next.js's expected shape is preserved — Next passes both `error` and `reset` at runtime; we accept but ignore the latter.
- We do NOT add `// eslint-disable-next-line @typescript-eslint/no-unused-vars` because dropping the binding is structurally cleaner and won't re-fire if the rule definition changes.
- We do NOT rename `_reset` → `reset` and then never call it — that still trips the rule.

**Fix 1.2 — `src/lib/eval/cats/cat2.ts` line 176 (violation #9, D-A-05):**

Use the Edit tool. Locate the line:

```typescript
  let totalCost = 0;
```

Replace with:

```typescript
  const totalCost = 0;
```

Verify by reading surrounding ±20 lines first that `totalCost` is indeed never reassigned (the variable's downstream usage is read-only — it accumulates via passing into other shapes, or it's a placeholder). If executor finds a `totalCost =` or `totalCost +=` reassignment downstream, STOP and surface — the prefer-const rule would not have fired in that case, which means the violation report from 07-01-SUMMARY.md is stale. Proceed only if zero reassignments are confirmed.

Do NOT touch any other line in either file.
Do NOT add new imports.
Do NOT format the entire file (run `prettier --check` if available, do not run `prettier --write`).
  </action>
  <acceptance_criteria>
- `grep -E "reset:\\s*_reset" src/app/error.tsx` returns no matches (the `_reset` binding is gone).
- `grep -E "^\\s*error,\\s*$" src/app/error.tsx` returns exactly one match (`error,` is still the sole destructured prop).
- `grep -n "let totalCost" src/lib/eval/cats/cat2.ts` returns no matches.
- `grep -n "const totalCost = 0" src/lib/eval/cats/cat2.ts` returns exactly one match on line 176.
- `npm run lint 2>&1 | grep -E "error\\.tsx.*no-unused-vars|cat2\\.ts.*prefer-const"` returns no matches (these 2 violations gone).
- `npx tsc --noEmit` exits 0 (no type regression from removing the reset binding).
  </acceptance_criteria>
  <verify>
    <automated>node -e "const fs=require('fs'); const e=fs.readFileSync('src/app/error.tsx','utf8'); const c=fs.readFileSync('src/lib/eval/cats/cat2.ts','utf8'); if(/reset:\s*_reset/.test(e)) { console.error('FAIL error.tsx still has _reset binding'); process.exit(1); } if(/let totalCost\s*=\s*0/.test(c)) { console.error('FAIL cat2.ts still has let totalCost'); process.exit(1); } if(!/const totalCost\s*=\s*0/.test(c)) { console.error('FAIL cat2.ts missing const totalCost'); process.exit(1); } console.log('OK trivials fixed');"</automated>
  </verify>
  <done>
- `src/app/error.tsx` no longer destructures `reset` — only `error` is in the destructure block.
- `src/lib/eval/cats/cat2.ts` line 176 reads `const totalCost = 0;` (was `let`).
- `npm run lint` no longer reports `no-unused-vars` on error.tsx or `prefer-const` on cat2.ts.
- TypeScript compiles clean.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Create `useIsClient()` hook at src/hooks/use-is-client.ts</name>
  <files>src/hooks/use-is-client.ts</files>
  <read_first>
    - `.planning/phases/07-add-test-yml-github-actions-workflow-for-determinism/07-1A-CONTEXT.md` — D-A-02 strategy + `<specifics>` block with the exact hook body
    - `.planning/phases/07-add-test-yml-github-actions-workflow-for-determinism/07-CONTEXT.md` — parent context
    - Verify `src/hooks/` directory does not yet exist (it does not — confirmed in planning) — directory will be created when file is written
  </read_first>
  <action>
Create a new directory and file: `src/hooks/use-is-client.ts`. The file body MUST be exactly:

```typescript
'use client';

import { useSyncExternalStore } from 'react';

/**
 * Client-detection hook. Returns `false` during SSR / first server render,
 * `true` after hydration on the client. Backed by useSyncExternalStore
 * (React 18+ idiomatic; satisfies eslint-plugin-react-hooks@6
 * `react-hooks/set-state-in-effect` rule by avoiding setState in effect
 * entirely).
 *
 * Subscribe is a no-op because there is no external store to subscribe to —
 * the "store" is the synchronous fact of being on the client vs the server.
 * Client snapshot is constant `true`; server snapshot is constant `false`.
 * React's hydration phase reconciles the two automatically (no flicker,
 * no setState-after-mount).
 *
 * Replaces the canonical Next App Router hydration pattern:
 *   const [hydrated, setHydrated] = useState(false);
 *   useEffect(() => setHydrated(true), []);
 *
 * Phase 7 Plan 07-1A — D-A-02. See 07-1A-CONTEXT.md.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},  // subscribe: no-op (returns unsubscribe no-op)
    () => true,       // client snapshot: always true
    () => false,      // server snapshot: always false
  );
}
```

Notes for executor:
- The `'use client';` directive at the top is REQUIRED — `useSyncExternalStore` is a client-only hook (it relies on subscription semantics that don't make sense in Server Components).
- The three-argument form of `useSyncExternalStore` (with `getServerSnapshot`) is what makes this SSR-safe — without the third arg, React errors during hydration on server-rendered trees.
- DO NOT memoize the constant `true` / `false` returns via `useCallback` — they're stable identity primitives already; React's identity check works fine.
- DO NOT export `useIsClient` as a default export — named export only, matches the `useIsClient` convention used by `usehooks-ts` and the React community.
- DO NOT name the file `useIsClient.ts` (camelCase) — repo convention is kebab-case for files containing single hooks (verified in existing layout; consistent with `src/lib/chat-format.ts` etc.). The hook itself is `useIsClient` (camelCase function name) per React naming convention.

The directory `src/hooks/` does not yet exist. Writing the file will create the directory automatically.

No `tsconfig.json` changes are needed — the existing `@/*` → `src/*` baseUrl alias resolves `@/hooks/use-is-client` to `src/hooks/use-is-client.ts` transparently. Verify by running `npx tsc --noEmit` after writing the file (Task 2's verify command does this implicitly via lint pass + TS compile).
  </action>
  <acceptance_criteria>
- File `src/hooks/use-is-client.ts` exists.
- `grep -q "^'use client';" src/hooks/use-is-client.ts` exits 0.
- `grep -q "import { useSyncExternalStore } from 'react';" src/hooks/use-is-client.ts` exits 0.
- `grep -q "export function useIsClient(): boolean" src/hooks/use-is-client.ts` exits 0.
- `grep -cE "() => true|() => false" src/hooks/use-is-client.ts` returns 2 (both snapshots present).
- File contains no `useState` or `useEffect` imports (the whole point is to avoid those).
- `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>node -e "const fs=require('fs'); const p='src/hooks/use-is-client.ts'; if(!fs.existsSync(p)){console.error('FAIL: file not created'); process.exit(1);} const t=fs.readFileSync(p,'utf8'); const checks=[['use client', /^'use client';/m], ['useSyncExternalStore import', /import \{ useSyncExternalStore \} from 'react'/], ['useIsClient export', /export function useIsClient\(\)\s*:\s*boolean/], ['client snapshot true', /=>\s*true/], ['server snapshot false', /=>\s*false/], ['no useState', !/import.*useState.*from 'react'/.test(t)], ['no useEffect', !/import.*useEffect.*from 'react'/.test(t)]]; let f=[]; for(const[n,c] of checks){const ok=typeof c==='boolean'?c:c.test(t); if(!ok)f.push(n);} if(f.length){console.error('FAIL:',f.join(', ')); process.exit(1);} console.log('OK useIsClient hook shape');"</automated>
  </verify>
  <done>
- `src/hooks/use-is-client.ts` exists with the exact shape above.
- TypeScript compiles clean.
- File contains the JSDoc rationale referencing 07-1A-CONTEXT.md D-A-02.
- No transitive imports of `useState` or `useEffect` in this file.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Migrate the 2 hydration-boundary sites to useIsClient()</name>
  <files>src/app/chat/page.tsx, src/components/ChatStatusBanner.tsx</files>
  <read_first>
    - `src/app/chat/page.tsx` — see current shape in `<interfaces>` block above (lines 38-52)
    - `src/components/ChatStatusBanner.tsx` — see current shape in `<interfaces>` block above (lines 11-31)
    - `src/hooks/use-is-client.ts` — created in Task 2, must exist before this task runs
    - `.planning/phases/07-add-test-yml-github-actions-workflow-for-determinism/07-1A-CONTEXT.md` — D-A-02 strategy
  </read_first>
  <action>
Migrate both call sites from `useState(false) + useEffect(() => setHydrated(true), [])` to `const isClient = useIsClient();` from the Task 2 hook.

**Fix 3.1 — `src/app/chat/page.tsx`:**

Use the Edit tool. The file currently imports `useEffect, useState` from React. After this task, it still imports `useEffect` (the body-class effect at lines 57-62 stays — that effect does NOT setState, so it does NOT violate the rule) and `useState` (for `sessionId` and `view` state — still needed).

Step A — update the React import line at line 3:

Current:
```typescript
import { useEffect, useState } from 'react';
```

Stays the same — both hooks are still used by the body-class effect + `sessionId` + `view` state. No change to this line.

Step B — add the new useIsClient import. Insert immediately after the line:
```typescript
import { ViewToggle } from '@/components/ViewToggle';
```

Add the new import:
```typescript
import { useIsClient } from '@/hooks/use-is-client';
```

Step C — replace the hydration state + effect. Locate the existing block (around lines 40-52):

```typescript
export default function ChatPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<'chat' | 'matrix'>('chat');

  useEffect(() => {
    setHydrated(true);
    const id = typeof window !== 'undefined' ? sessionStorage.getItem('session_id') : null;
    if (!id) {
      router.replace('/');
      return;
    }
    setSessionId(id);
  }, [router]);
```

Replace with:

```typescript
export default function ChatPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const isClient = useIsClient();
  const [view, setView] = useState<'chat' | 'matrix'>('chat');

  useEffect(() => {
    const id = typeof window !== 'undefined' ? sessionStorage.getItem('session_id') : null;
    if (!id) {
      router.replace('/');
      return;
    }
    setSessionId(id);
  }, [router]);
```

Step D — update the `if (!hydrated || !sessionId)` guard around line 64:

Current:
```typescript
if (!hydrated || !sessionId) {
  return null;
}
```

Replace with:
```typescript
if (!isClient || !sessionId) {
  return null;
}
```

WHY this preserves semantics:
- `useIsClient()` returns `false` on the server snapshot, `true` once React reconciles the client snapshot during hydration. This is identical timing to `useState(false) + useEffect(setHydrated(true))` from the user's perspective: both render `null` on the server, both render the chat UI after hydration.
- The body-class `useEffect` at lines 57-62 STAYS — it doesn't setState, only DOM-mutates with cleanup. It's not a `react-hooks/set-state-in-effect` violation.
- The OTHER useEffect (sessionStorage lookup → setSessionId) STAYS, just without the `setHydrated(true)` line. The `react-hooks/set-state-in-effect` rule fires on `setHydrated(true)` because it's an unconditional setState in an effect with a fixed dependency array — `setSessionId(id)` is conditional on the id existing, which the rule treats as event-handler-like data flow and does not flag (verified by 07-01-SUMMARY.md: only line 45 = `setHydrated(true)` was flagged, not line 51 = `setSessionId(id)`).

**Fix 3.2 — `src/components/ChatStatusBanner.tsx`:**

Use the Edit tool.

Step A — update the React import line (currently line 7):

Current:
```typescript
import { useState, useEffect } from 'react';
```

After:
```typescript
import { useState, useEffect } from 'react';
import { useIsClient } from '@/hooks/use-is-client';
```

Step B — replace the hydration state + effect block. Locate the existing block (around lines 11-31):

```typescript
export function ChatStatusBanner({ messages }: { messages: string[] }) {
  // Initialize from sessionStorage in an effect to avoid SSR/CSR mismatch.
  const [dismissed, setDismissed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    // WR-04 fix: sessionStorage.getItem() throws SecurityError in Safari
    // Private Browsing, iOS Lockdown Mode, and on quota-exceeded. Without
    // this try/catch, the throw inside an effect trips the nearest error
    // boundary (app/error.tsx → PlainHtmlFallback) on /chat — which means a
    // recruiter on iOS Private Mode would land on the fallback just by
    // visiting /chat while a banner is showing.
    try {
      if (typeof window !== 'undefined') {
        setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
      }
    } catch {
      // sessionStorage unavailable: show banner (no dismiss memory).
    }
  }, []);
```

Replace with:

```typescript
export function ChatStatusBanner({ messages }: { messages: string[] }) {
  // Initialize from sessionStorage in an effect to avoid SSR/CSR mismatch.
  const [dismissed, setDismissed] = useState(false);
  const isClient = useIsClient();

  useEffect(() => {
    // WR-04 fix: sessionStorage.getItem() throws SecurityError in Safari
    // Private Browsing, iOS Lockdown Mode, and on quota-exceeded. Without
    // this try/catch, the throw inside an effect trips the nearest error
    // boundary (app/error.tsx → PlainHtmlFallback) on /chat — which means a
    // recruiter on iOS Private Mode would land on the fallback just by
    // visiting /chat while a banner is showing.
    try {
      if (typeof window !== 'undefined') {
        setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
      }
    } catch {
      // sessionStorage unavailable: show banner (no dismiss memory).
    }
  }, []);
```

Step C — update the `if (!hydrated) return null;` guard at line 34:

Current:
```typescript
if (!hydrated) return null;
```

Replace with:
```typescript
if (!isClient) return null;
```

Notes for executor:
- The remaining `useEffect` in ChatStatusBanner is NOT removed — it's the sessionStorage-read effect. `setDismissed(...)` inside it is conditional on `typeof window !== 'undefined'` AND wrapped in try/catch, so the `react-hooks/set-state-in-effect` rule does not flag it (verified: 07-01-SUMMARY.md only flagged line 17 = `setHydrated(true)`, not line 26 = `setDismissed(sessionStorage.getItem(...))`).
- Preserve the WR-04 comment block verbatim (sessionStorage SecurityError handling rationale).
- DO NOT remove `useState` from the React import — `setDismissed` still needs it.

Do NOT touch `src/app/error.tsx` again in this task (Task 1 already touched it).
Do NOT touch any other file in this task.
  </action>
  <acceptance_criteria>
- `grep -q "setHydrated" src/app/chat/page.tsx` returns no matches.
- `grep -q "const \\[hydrated, setHydrated\\]" src/app/chat/page.tsx` returns no matches.
- `grep -q "import { useIsClient } from '@/hooks/use-is-client'" src/app/chat/page.tsx` exits 0.
- `grep -q "const isClient = useIsClient()" src/app/chat/page.tsx` exits 0.
- `grep -q "if (!isClient || !sessionId)" src/app/chat/page.tsx` exits 0.
- `grep -q "setHydrated" src/components/ChatStatusBanner.tsx` returns no matches.
- `grep -q "const \\[hydrated, setHydrated\\]" src/components/ChatStatusBanner.tsx` returns no matches.
- `grep -q "import { useIsClient } from '@/hooks/use-is-client'" src/components/ChatStatusBanner.tsx` exits 0.
- `grep -q "const isClient = useIsClient()" src/components/ChatStatusBanner.tsx` exits 0.
- `grep -q "if (!isClient) return null" src/components/ChatStatusBanner.tsx` exits 0.
- `npm run lint 2>&1 | grep -E "(chat/page|ChatStatusBanner).*set-state-in-effect"` returns no matches.
- `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>node -e "const fs=require('fs'); const cp=fs.readFileSync('src/app/chat/page.tsx','utf8'); const csb=fs.readFileSync('src/components/ChatStatusBanner.tsx','utf8'); const checks=[['chat/page no setHydrated', !/setHydrated/.test(cp)], ['chat/page imports useIsClient', /import { useIsClient } from '@\\/hooks\\/use-is-client'/.test(cp)], ['chat/page uses isClient', /const isClient = useIsClient\\(\\)/.test(cp)], ['chat/page guard', /if \\(!isClient \\|\\| !sessionId\\)/.test(cp)], ['CSB no setHydrated', !/setHydrated/.test(csb)], ['CSB imports useIsClient', /import { useIsClient } from '@\\/hooks\\/use-is-client'/.test(csb)], ['CSB uses isClient', /const isClient = useIsClient\\(\\)/.test(csb)], ['CSB guard', /if \\(!isClient\\) return null/.test(csb)]]; let f=[]; for(const[n,c] of checks){if(!c)f.push(n);} if(f.length){console.error('FAIL:',f.join(', ')); process.exit(1);} console.log('OK both call sites migrated');"</automated>
  </verify>
  <done>
- Both files import `useIsClient` from `@/hooks/use-is-client`.
- Both files no longer declare `hydrated` state or `setHydrated(true)` inside any effect.
- Both files use `isClient` (instead of `hydrated`) in their conditional render guards.
- Body-class useEffect in chat/page.tsx (lines 57-62 area) is UNTOUCHED.
- WR-04 sessionStorage comment block in ChatStatusBanner is UNTOUCHED.
- Lint reports no `set-state-in-effect` for these two files.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: Refactor LocalTime.tsx to useSyncExternalStore</name>
  <files>src/app/admin/components/LocalTime.tsx</files>
  <read_first>
    - `src/app/admin/components/LocalTime.tsx` — see current shape in `<interfaces>` block above (full file)
    - `.planning/phases/07-add-test-yml-github-actions-workflow-for-determinism/07-1A-CONTEXT.md` — D-A-03 strategy
  </read_first>
  <action>
Replace the `useState + useEffect` pattern with `useSyncExternalStore` where the snapshot function IS the formatter.

Use the Write tool (or Edit to fully replace the file body). The new full file content:

```typescript
'use client';

// src/app/admin/components/LocalTime.tsx
// Renders an ISO timestamp as a localized string in Joe's browser timezone.
// SSR-safe via useSyncExternalStore: server snapshot returns the raw ISO,
// client snapshot returns the formatted localized string. React's hydration
// phase reconciles the two without a setState-in-effect cycle (Phase 7
// Plan 07-1A D-A-03; eslint-plugin-react-hooks@6 conformant).
//
// suppressHydrationWarning on the <span> preserves the existing UX: the
// server-emitted ISO is briefly visible until client hydration replaces it
// with the locale-formatted string. Without suppressHydrationWarning, React
// would log a hydration mismatch warning even though the mismatch is
// deliberate (different snapshots is exactly what we want).
import { useSyncExternalStore } from 'react';

function formatIso(iso: string, format: 'datetime' | 'date' | 'time'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (format === 'date') return d.toLocaleDateString();
  if (format === 'time') return d.toLocaleTimeString();
  return d.toLocaleString();
}

export function LocalTime({
  iso,
  format = 'datetime',
}: {
  iso: string;
  format?: 'datetime' | 'date' | 'time';
}) {
  const text = useSyncExternalStore(
    () => () => {}, // subscribe: no-op (no external store; value is derived from props)
    () => formatIso(iso, format), // client snapshot: locale-formatted string
    () => iso, // server snapshot: raw ISO (matches pre-hydration server render)
  );
  return <span suppressHydrationWarning>{text}</span>;
}
```

Notes for executor:
- The `formatIso` helper is extracted (was inline in the effect) — pure function, easier to test if we ever add coverage. NOT exported (file-private).
- `useSyncExternalStore` re-runs the snapshot functions when React's scheduler decides; for prop-derived values it effectively recomputes per render — which is the desired semantics (the original `useEffect([iso, format])` also recomputed on prop change).
- The subscribe function `() => () => {}` returns an unsubscribe no-op. We have no external store to subscribe to.
- Server snapshot returning raw `iso` matches the previous behavior of `useState(iso)` initial value being shown on the server render.
- The `'use client';` directive STAYS at the top (file is a Client Component).
- DO NOT remove `suppressHydrationWarning` — the snapshot intentionally differs between server and client (that's the whole point).
- DO NOT memoize `formatIso(iso, format)` with `useMemo` — useSyncExternalStore handles snapshot stability via reference equality of the returned string; same input → same output.

Do NOT export `formatIso`.
Do NOT change the props signature `{ iso, format }`.
Do NOT touch any other file.
  </action>
  <acceptance_criteria>
- `grep -q "useSyncExternalStore" src/app/admin/components/LocalTime.tsx` exits 0.
- `grep -q "useState\\|useEffect" src/app/admin/components/LocalTime.tsx` returns no matches.
- `grep -q "function formatIso" src/app/admin/components/LocalTime.tsx` exits 0.
- `grep -q "suppressHydrationWarning" src/app/admin/components/LocalTime.tsx` exits 0.
- `grep -q "^export function LocalTime" src/app/admin/components/LocalTime.tsx` exits 0.
- `grep -q "^'use client';" src/app/admin/components/LocalTime.tsx` exits 0.
- `npm run lint 2>&1 | grep -E "LocalTime.*set-state-in-effect"` returns no matches.
- `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>node -e "const fs=require('fs'); const t=fs.readFileSync('src/app/admin/components/LocalTime.tsx','utf8'); const checks=[['useSyncExternalStore present', /useSyncExternalStore/.test(t)], ['no useState', !/useState/.test(t)], ['no useEffect', !/useEffect/.test(t)], ['formatIso helper', /function formatIso/.test(t)], ['suppressHydrationWarning preserved', /suppressHydrationWarning/.test(t)], ['LocalTime export', /export function LocalTime/.test(t)], ['use client', /^'use client';/m.test(t)]]; let f=[]; for(const[n,c] of checks){if(!c)f.push(n);} if(f.length){console.error('FAIL:',f.join(', ')); process.exit(1);} console.log('OK LocalTime refactored');"</automated>
  </verify>
  <done>
- LocalTime.tsx no longer imports or uses `useState` or `useEffect`.
- File uses `useSyncExternalStore` with all three arguments (subscribe + client snapshot + server snapshot).
- `formatIso(iso, format)` helper is file-private (not exported).
- `<span suppressHydrationWarning>{text}</span>` render output preserved.
- Component props signature unchanged: `{ iso, format = 'datetime' }`.
- Lint reports no `set-state-in-effect` for this file.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 5: Refactor RelativeTime.tsx to useSyncExternalStore</name>
  <files>src/app/admin/components/RelativeTime.tsx</files>
  <read_first>
    - `src/app/admin/components/RelativeTime.tsx` — see current shape in `<interfaces>` block above (full file)
    - `.planning/phases/07-add-test-yml-github-actions-workflow-for-determinism/07-1A-CONTEXT.md` — D-A-03 strategy
  </read_first>
  <action>
Replace the `useState + useEffect` pattern with `useSyncExternalStore` where the snapshot function returns the relative-formatted string.

Use the Write tool (or Edit to fully replace). The new full file content:

```typescript
'use client';

// src/app/admin/components/RelativeTime.tsx
// Renders an ISO timestamp as a relative string ("5 min ago", "2 hours ago",
// "yesterday"). SSR-safe via useSyncExternalStore: server snapshot returns
// the raw ISO; client snapshot returns the relative-formatted string.
// React's hydration phase reconciles the two without a setState-in-effect
// cycle (Phase 7 Plan 07-1A D-A-03; eslint-plugin-react-hooks@6 conformant).
//
// Note: `relative()` reads Date.now() — that's correct in Client Component
// context because the snapshot fires per render, not at module init. Server
// snapshot returns raw ISO so this Date.now() call is structurally avoided
// during SSR.
import { useSyncExternalStore } from 'react';

function relative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diffSec = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (abs < 60) return rtf.format(diffSec, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 30 * 86400) return rtf.format(Math.round(diffSec / 86400), 'day');
  if (abs < 365 * 86400) return rtf.format(Math.round(diffSec / (30 * 86400)), 'month');
  return rtf.format(Math.round(diffSec / (365 * 86400)), 'year');
}

export function RelativeTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    () => () => {}, // subscribe: no-op (no external store; value is derived from props + Date.now())
    () => relative(iso), // client snapshot: relative-formatted string
    () => iso, // server snapshot: raw ISO (matches pre-hydration server render)
  );
  return <span suppressHydrationWarning>{text}</span>;
}
```

Notes for executor:
- The `relative()` helper is preserved verbatim — same buckets (second / minute / hour / day / month / year), same `Intl.RelativeTimeFormat` config (`numeric: 'auto'`).
- `relative()` stays NOT-exported (file-private).
- The subscribe function `() => () => {}` returns an unsubscribe no-op — same shape as Task 2 and Task 4.
- Server snapshot is `() => iso` — the raw ISO matches the previous `useState(iso)` initial value visible on server render.
- The `'use client';` directive STAYS.
- DO NOT remove `suppressHydrationWarning`.
- DO NOT add a re-tick mechanism (e.g., setInterval to refresh "5 min ago" → "6 min ago" after a minute passes). The original component does not have one; adding one is scope creep.

Do NOT export `relative`.
Do NOT change props signature `{ iso }`.
Do NOT touch any other file.
  </action>
  <acceptance_criteria>
- `grep -q "useSyncExternalStore" src/app/admin/components/RelativeTime.tsx` exits 0.
- `grep -q "useState\\|useEffect" src/app/admin/components/RelativeTime.tsx` returns no matches.
- `grep -q "function relative" src/app/admin/components/RelativeTime.tsx` exits 0.
- `grep -q "Intl.RelativeTimeFormat" src/app/admin/components/RelativeTime.tsx` exits 0.
- `grep -q "suppressHydrationWarning" src/app/admin/components/RelativeTime.tsx` exits 0.
- `grep -q "^export function RelativeTime" src/app/admin/components/RelativeTime.tsx` exits 0.
- `grep -q "^'use client';" src/app/admin/components/RelativeTime.tsx` exits 0.
- `npm run lint 2>&1 | grep -E "RelativeTime.*set-state-in-effect"` returns no matches.
- `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>node -e "const fs=require('fs'); const t=fs.readFileSync('src/app/admin/components/RelativeTime.tsx','utf8'); const checks=[['useSyncExternalStore present', /useSyncExternalStore/.test(t)], ['no useState', !/useState/.test(t)], ['no useEffect', !/useEffect/.test(t)], ['relative helper', /function relative\\(iso/.test(t)], ['Intl preserved', /Intl\\.RelativeTimeFormat/.test(t)], ['suppressHydrationWarning preserved', /suppressHydrationWarning/.test(t)], ['RelativeTime export', /export function RelativeTime/.test(t)], ['use client', /^'use client';/m.test(t)]]; let f=[]; for(const[n,c] of checks){if(!c)f.push(n);} if(f.length){console.error('FAIL:',f.join(', ')); process.exit(1);} console.log('OK RelativeTime refactored');"</automated>
  </verify>
  <done>
- RelativeTime.tsx no longer imports or uses `useState` or `useEffect`.
- File uses `useSyncExternalStore` with all three arguments.
- `relative(iso)` helper is file-private with all 6 time-bucket branches preserved.
- `<span suppressHydrationWarning>{text}</span>` render output preserved.
- Component props signature unchanged: `{ iso }`.
- Lint reports no `set-state-in-effect` for this file.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 6: Hoist ChatUI timestamp capture from useEffect to useChat onFinish</name>
  <files>src/components/ChatUI.tsx</files>
  <read_first>
    - `src/components/ChatUI.tsx` — see current shape in `<interfaces>` block above (lines 49-86 critical region)
    - `node_modules/ai/dist/index.d.ts` lines 3680-3758 (ChatInit + ChatOnFinishCallback shapes — verified in `<interfaces>` block)
    - `.planning/phases/05.2-implement-chat-stream-design-from-anthropic-design-system/05.2-03-PLAN.md` — D-A-02-AMENDED design intent (timestamp on status==='streaming' transition; onFinish is the closest available v6 hook since onChunk is not exposed by useChat)
    - `.planning/phases/07-add-test-yml-github-actions-workflow-for-determinism/07-1A-CONTEXT.md` — D-A-04 strategy
  </read_first>
  <action>
**Critical context (re-stated from `<interfaces>`):** AI SDK v6's `useChat` ChatInit interface exposes these callbacks: `onError`, `onToolCall`, `onFinish`, `onData`. It does NOT expose `onChunk` despite 07-1A-CONTEXT.md D-A-04's stated preference. Per CONTEXT D-A-04 explicit fallback ("acceptable: `onFinish`"), this task wires the timestamp capture into `onFinish`. The timing shifts from "first-chunk arrival" (the original 05.2-03 intent) to "stream end" — but `shouldShowTimestampBefore`'s 5-minute rule only needs A timestamp per message; sub-second precision is not required for the divider behavior.

Use the Edit tool. Multiple edits in this file.

**Step 6.1 — Remove `useEffect` import if it is no longer needed.** Read current imports:

```typescript
import { useEffect, useRef, useState } from 'react';
```

`useEffect` is still used by the auto-scroll effect at lines 93-95:
```typescript
useEffect(() => {
  bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages, status]);
```

So `useEffect` STAYS in the imports. No change to the import line.

**Step 6.2 — Extend the existing `onFinish` callback to stamp the assistant timestamp.**

Locate the existing `onFinish` (around lines 64-73):

```typescript
    onFinish: ({ isError, isAbort, isDisconnect }) => {
      // BL-18: AI SDK v6's Chat.makeRequest fires onFinish in a finally
      // block AFTER onError on every request, including errors. Resetting
      // unconditionally here defeats the 2-consecutive-error redirect
      // protection — counter alternates 0→1→0→1 and never crosses the
      // threshold. Only reset on a genuinely successful response.
      if (!isError && !isAbort && !isDisconnect) {
        errorCountRef.current = 0;
      }
    },
```

Replace with the extended callback that ALSO stamps the assistant message timestamp on successful completion:

```typescript
    onFinish: ({ message, isError, isAbort, isDisconnect }) => {
      // BL-18: AI SDK v6's Chat.makeRequest fires onFinish in a finally
      // block AFTER onError on every request, including errors. Resetting
      // unconditionally here defeats the 2-consecutive-error redirect
      // protection — counter alternates 0→1→0→1 and never crosses the
      // threshold. Only reset on a genuinely successful response.
      if (!isError && !isAbort && !isDisconnect) {
        errorCountRef.current = 0;
      }

      // Plan 07-1A D-A-04: stamp assistant message timestamp here (event-
      // driven) instead of in a post-stream useEffect (effect-driven).
      // Eliminates the react-hooks/set-state-in-effect violation that
      // eslint-plugin-react-hooks@6 flagged on the previous pattern. The
      // 05.2-03 D-A-02-AMENDED design intent was "stamped on first-chunk
      // transition" — AI SDK v6's useChat does NOT surface onChunk, so we
      // stamp on stream end instead. shouldShowTimestampBefore's 5-min
      // rule is unaffected (sub-second precision irrelevant). Always
      // stamp message.role === 'assistant'; user messages have their own
      // metadata.createdAt set at sendMessage time.
      if (message.role === 'assistant') {
        setAssistantTimestamps((prev) =>
          prev[message.id] ? prev : { ...prev, [message.id]: Date.now() },
        );
      }
    },
```

Notes for executor:
- Destructure `message` alongside the existing `isError, isAbort, isDisconnect` — the `ChatOnFinishCallback<UI_MESSAGE>` type provides it (verified in `<interfaces>` block).
- The `prev[message.id] ? prev : ...` guard preserves the existing idempotency check that the old effect had (line 84: `if (assistantTimestamps[latest.id]) return;`). Without it, a regenerate/retry would overwrite the original stamp.
- The stamp fires on BOTH success AND error cases per spec — but the BL-18 guard (`if (!isError && !isAbort && !isDisconnect)`) wraps ONLY the `errorCountRef.current = 0` reset, NOT the timestamp stamping. Rationale: even error/aborted streams produced visible assistant content (the user saw partial output); the divider should still show a timestamp for that visible message. Confirmed by Plan 05.2-03 design: timestamps are about visual grouping, not stream-success state.

**Step 6.3 — Remove the obsolete useEffect that stamped on `status === 'streaming'`.**

Locate the block at lines 80-86:

```typescript
  // D-A-02-AMENDED: capture assistant message timestamp on first chunk.
  // status === 'streaming' fires when AI SDK transitions from waiting-for-
  // first-token to actively streaming. The current latest assistant message
  // is the one being streamed; if it doesn't yet have a timestamp, stamp it.
  useEffect(() => {
    if (status !== 'streaming') return;
    const latest = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!latest) return;
    if (assistantTimestamps[latest.id]) return; // already stamped
    setAssistantTimestamps((prev) => ({ ...prev, [latest.id]: Date.now() }));
  }, [status, messages, assistantTimestamps]);
```

REMOVE this entire block including the preamble comment (5 comment lines + 7 code lines = 12 total lines including the trailing blank).

**Step 6.4 — Update the high-level comment block at the top of ChatUI describing the timestamp strategy.**

Locate the comment block at lines 29-36:

```typescript
// Phase 05.2 (D-A-01, D-A-02-AMENDED, CD-06): bubble grouping via
// computePositions; inter-group timestamps via shouldShowTimestampBefore
// + TimestampDivider; assistant timestamps captured CLIENT-SIDE on
// status==='streaming' transition (NO /api/chat changes — Phase 02 D-G
// byte-identical contract preserved). Header now has chev (CD-06) and
// matrix-mode selector-hook data-testids (chat-main, chat-header,
// chat-avatar, chat-contact-name, chat-contact-chev, chat-composer)
// for Plan 05.2-02 CSS to bind to.
```

Update the third comment line to reflect the new firing-edge:

Replace with:

```typescript
// Phase 05.2 (D-A-01, D-A-02-AMENDED, CD-06): bubble grouping via
// computePositions; inter-group timestamps via shouldShowTimestampBefore
// + TimestampDivider; assistant timestamps captured CLIENT-SIDE on
// useChat onFinish callback (Phase 7 Plan 07-1A D-A-04 — was a
// status==='streaming' useEffect, hoisted to event-driven onFinish to
// resolve react-hooks/set-state-in-effect violation; NO /api/chat
// changes — Phase 02 D-G byte-identical contract preserved). Header
// now has chev (CD-06) and matrix-mode selector-hook data-testids
// (chat-main, chat-header, chat-avatar, chat-contact-name,
// chat-contact-chev, chat-composer) for Plan 05.2-02 CSS to bind to.
```

Notes for executor:
- DO NOT change ANY OTHER part of ChatUI.tsx. The `metaView` adapter (lines 176-183), `assistantTimestamps[m.id]` lookup, MessageBubble props, TimestampDivider rendering — all unchanged.
- DO NOT remove the `assistantTimestamps` state declaration (line 49). It's still the source of truth for the divider — only the firing edge changes.
- DO NOT change `onError` (line 56-63).
- DO NOT remove `useEffect` from React imports — auto-scroll effect (line 93) still uses it.
- DO NOT add `'message'` to any dependency array — we're removing the effect, not adding new ones.

After Steps 6.1-6.4 are done, the file should have:
- `useEffect` imported (still used by auto-scroll).
- `assistantTimestamps` state still declared.
- `onFinish` callback extended to stamp on `message.role === 'assistant'`.
- The standalone "status === 'streaming'" useEffect REMOVED.
- The header comment block updated to reflect the new firing edge.
- Auto-scroll useEffect (lines 93-95) UNTOUCHED.
- Everything else byte-identical.
  </action>
  <acceptance_criteria>
- `grep -q "if (status !== 'streaming') return;" src/components/ChatUI.tsx` returns no matches (the old effect is gone).
- `grep -c "setAssistantTimestamps" src/components/ChatUI.tsx` returns exactly 1 (only inside onFinish; the old effect's call is gone).
- `grep -q "if (message.role === 'assistant')" src/components/ChatUI.tsx` exits 0 (new onFinish branch present).
- `grep -q "onFinish: ({ message," src/components/ChatUI.tsx` exits 0 (message destructured).
- `grep -q "useChat onFinish callback" src/components/ChatUI.tsx` exits 0 (header comment updated).
- `grep -c "useEffect" src/components/ChatUI.tsx` returns exactly 2 (one import, one auto-scroll usage — the timestamp effect is gone).
- `grep -q "bottomRef.current\\?.scrollIntoView" src/components/ChatUI.tsx` exits 0 (auto-scroll effect preserved).
- `npm run lint 2>&1 | grep -E "ChatUI.*set-state-in-effect"` returns no matches.
- `npx tsc --noEmit` exits 0.
- `npm test 2>&1 | grep -E "(ChatUI|chat-format)"` reports test results (existing 562-test suite still picks up ChatUI tests).
  </acceptance_criteria>
  <verify>
    <automated>node -e "const fs=require('fs'); const t=fs.readFileSync('src/components/ChatUI.tsx','utf8'); const setStampCount=(t.match(/setAssistantTimestamps/g)||[]).length; const useEffectCount=(t.match(/useEffect/g)||[]).length; const checks=[['old streaming-effect gone', !/if \\(status !== 'streaming'\\) return;/.test(t)], ['setAssistantTimestamps appears once', setStampCount===1], ['onFinish destructures message', /onFinish: \\(\\{ message,/.test(t)], ['new assistant-role branch', /if \\(message\\.role === 'assistant'\\)/.test(t)], ['header comment updated', /useChat onFinish callback/.test(t)], ['useEffect count = 2', useEffectCount===2], ['auto-scroll preserved', /bottomRef\\.current\\?\\.scrollIntoView/.test(t)]]; let f=[]; for(const[n,c] of checks){if(!c)f.push(n+(typeof c==='number'?' (got '+c+')':''));} if(f.length){console.error('FAIL:',f.join(', ')); process.exit(1);} console.log('OK ChatUI hoisted (setStamp='+setStampCount+', useEffect='+useEffectCount+')');"</automated>
  </verify>
  <done>
- The `useEffect(() => { if (status !== 'streaming') return; ... })` block is removed entirely.
- `onFinish` now destructures `message` and contains `if (message.role === 'assistant') setAssistantTimestamps(...)` with idempotency guard.
- Header comment reflects the new firing edge (onFinish, not status === 'streaming').
- Auto-scroll useEffect remains.
- BL-18 error-counter reset logic remains, with timestamp stamping added AFTER it (so the reset's guard does not gate the stamp).
- Lint reports no `set-state-in-effect` for ChatUI.
- TypeScript compiles clean.
- Existing test suite still passes (no behavior regression observable at the test layer).
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 7: Add eslint-disable for 2 Server-Component Date.now() purity sites</name>
  <files>src/app/admin/(authed)/abuse/page.tsx, src/app/admin/(authed)/evals/calibrate/page.tsx</files>
  <read_first>
    - `src/app/admin/(authed)/abuse/page.tsx` — see current shape in `<interfaces>` block above (line 25)
    - `src/app/admin/(authed)/evals/calibrate/page.tsx` — see current shape in `<interfaces>` block above (lines 54-56)
    - `.planning/phases/07-add-test-yml-github-actions-workflow-for-determinism/07-1A-CONTEXT.md` — D-A-01 strategy + `<specifics>` block with exact comment text
  </read_first>
  <action>
Both files are Server Components (no `'use client';` directive — confirmed by file headers). `Date.now()` in render is correct in Server Components: it runs once per request, not on every re-render (Server Components don't re-render in the React sense). The `react-hooks/purity` rule fires regardless because the rule is shape-blind to Server-vs-Client context. Targeted suppression with rationale is the honest fix.

**Fix 7.1 — `src/app/admin/(authed)/abuse/page.tsx` line 25:**

Use the Edit tool. Locate the existing line 25:

```typescript
  const SINCE = new Date(Date.now() - 90 * 24 * 3600_000).toISOString(); // 90d retention window
```

Replace with the disable-comment + rationale immediately preceding it:

```typescript
  // eslint-disable-next-line react-hooks/purity
  // Server Component — Date.now() in render is correct (runs once per request).
  const SINCE = new Date(Date.now() - 90 * 24 * 3600_000).toISOString(); // 90d retention window
```

Note on indentation: match the existing 2-space indentation of `const SINCE`. The disable comment and rationale comment go at the same 2-space indent.

**Fix 7.2 — `src/app/admin/(authed)/evals/calibrate/page.tsx` line 54-56:**

Use the Edit tool. Locate the existing block at lines 54-56:

```typescript
  const sinceISO = new Date(
    Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
```

Replace with the disable-comment + rationale immediately preceding it:

```typescript
  // eslint-disable-next-line react-hooks/purity
  // Server Component — Date.now() in render is correct (runs once per request).
  const sinceISO = new Date(
    Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
```

Note on indentation: 2-space indent matches surrounding code.

CRITICAL — The `eslint-disable-next-line react-hooks/purity` comment must be on the IMMEDIATELY-PRECEDING line of the violating `Date.now()` call. ESLint's `eslint-disable-next-line` only affects the SINGLE line directly following it. In Fix 7.2, the disable applies to line `const sinceISO = new Date(` — but the `Date.now()` is on the NEXT physical line. This works because ESLint's react-hooks/purity rule attaches the diagnostic to the START of the const expression, not the inner Date.now() — verified by 07-01-SUMMARY.md violation #2 reporting line 55:5 (= start of `Date.now()`, but the diagnostic source span starts at the const).

If after Task 8's lint run the disable does NOT silence the violation on the calibrate page (because the diagnostic line span doesn't align with the disable scope), the alternative is to inline the Date.now() onto the same line:

```typescript
  // eslint-disable-next-line react-hooks/purity
  const sinceISO = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  // Server Component — Date.now() in render is correct (runs once per request).
```

Try the immediately-preceding form first; only fall back to the single-line form if Task 8 reports the violation still firing.

Do NOT use a block-level `/* eslint-disable react-hooks/purity */ ... /* eslint-enable */` pair. Targeted single-line suppression is what 07-1A-CONTEXT.md D-A-01 specifies.
Do NOT add `// eslint-disable-next-line` without the trailing rule name. Without the rule name, the disable silences ALL rules on that line (over-broad).
Do NOT touch any other lines in either file.
  </action>
  <acceptance_criteria>
- `grep -c "eslint-disable-next-line react-hooks/purity" src/app/admin/\\(authed\\)/abuse/page.tsx` returns exactly 1.
- `grep -c "eslint-disable-next-line react-hooks/purity" src/app/admin/\\(authed\\)/evals/calibrate/page.tsx` returns exactly 1.
- `grep -q "Server Component — Date.now() in render is correct" src/app/admin/\\(authed\\)/abuse/page.tsx` exits 0.
- `grep -q "Server Component — Date.now() in render is correct" src/app/admin/\\(authed\\)/evals/calibrate/page.tsx` exits 0.
- `grep -q "const SINCE = new Date(Date.now()" src/app/admin/\\(authed\\)/abuse/page.tsx` exits 0 (logic preserved).
- `grep -q "WINDOW_DAYS \\* 24 \\* 60 \\* 60 \\* 1000" src/app/admin/\\(authed\\)/evals/calibrate/page.tsx` exits 0 (logic preserved).
- `npm run lint 2>&1 | grep -E "(abuse|calibrate).*react-hooks/purity"` returns no matches.
- `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>node -e "const fs=require('fs'); const a=fs.readFileSync('src/app/admin/(authed)/abuse/page.tsx','utf8'); const c=fs.readFileSync('src/app/admin/(authed)/evals/calibrate/page.tsx','utf8'); const checks=[['abuse has disable', /eslint-disable-next-line react-hooks\\/purity/.test(a)], ['abuse has rationale', /Server Component — Date\\.now\\(\\) in render is correct/.test(a)], ['abuse preserves SINCE', /const SINCE = new Date\\(Date\\.now\\(\\)/.test(a)], ['calibrate has disable', /eslint-disable-next-line react-hooks\\/purity/.test(c)], ['calibrate has rationale', /Server Component — Date\\.now\\(\\) in render is correct/.test(c)], ['calibrate preserves WINDOW_DAYS', /WINDOW_DAYS \\* 24 \\* 60 \\* 60 \\* 1000/.test(c)]]; let f=[]; for(const[n,ch] of checks){if(!ch)f.push(n);} if(f.length){console.error('FAIL:',f.join(', ')); process.exit(1);} console.log('OK both server-purity sites suppressed with rationale');"</automated>
  </verify>
  <done>
- Both files have exactly one `eslint-disable-next-line react-hooks/purity` comment preceding the violating Date.now() expression.
- Both files have the rationale comment "Server Component — Date.now() in render is correct (runs once per request)." present.
- Underlying logic (SINCE / sinceISO calculation) is byte-identical to pre-task state.
- Lint reports no `react-hooks/purity` for either file.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 8: Clean-env pre-flight verification (07-01 Task 3 absorbed)</name>
  <files>(verification only — no file changes)</files>
  <read_first>
    - `.planning/phases/07-add-test-yml-github-actions-workflow-for-determinism/07-01-SUMMARY.md` — the "Explicit Handoff" section spelling out exactly what Task 3 was deferred for
    - `.planning/phases/07-add-test-yml-github-actions-workflow-for-determinism/07-1A-CONTEXT.md` — D-C-01..03 (this task absorbs Task 3)
    - `package.json` — to confirm `prebuild` hook still runs `tsx scripts/generate-fallback.ts`
    - `vitest.config.ts` — to confirm CI-gated exclude from Plan 07-01 is in place
  </read_first>
  <action>
Run the full 4-command pre-flight gate from a clean-env shell (no real production secrets). Capture exit codes, wall-clock times, and the empirical list of sentinel env vars required for `npm run build` to succeed.

**Step 8.1 — Set up the clean shell**

Open a new PowerShell or bash session. Do NOT inherit Joe's existing shell env (which may have real keys cached). The required-to-be-empty / sentinel variables include (informational checklist):

- `ANTHROPIC_API_KEY` (empty or sentinel)
- `EXA_API_KEY` (empty or sentinel)
- `GOOGLE_GENERATIVE_AI_API_KEY` (empty or sentinel)
- `SUPABASE_SERVICE_ROLE_KEY` (empty or sentinel)
- `NEXT_PUBLIC_SUPABASE_URL` (empty or sentinel)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (empty or sentinel)
- `UPSTASH_REDIS_REST_URL` (empty or sentinel)
- `UPSTASH_REDIS_REST_TOKEN` (empty or sentinel)
- `RESEND_API_KEY` (empty or sentinel)
- `CRON_SECRET` (empty or sentinel)
- `ADMIN_GITHUB_LOGINS` (empty or sentinel)
- `NEXT_PUBLIC_TURNSTILE_*` (empty or sentinel)

If a command crashes on a module-init `process.env.X` undefined check, set X=sentinel-value and record it. The empirical list is the deliverable.

**Step 8.2 — Run the 4 commands sequentially, capturing exit code + wall-clock**

```bash
# 1. vitest
time npm test
echo "Exit: $?"

# 2. tsc
time npx tsc --noEmit
echo "Exit: $?"

# 3. lint (the key acceptance — must exit 0 now that Tasks 1-7 are done)
time npm run lint
echo "Exit: $?"

# 4. next build (the most env-var-sensitive — capture sentinels here)
time npm run build
echo "Exit: $?"
```

PowerShell equivalent (if running on Windows):

```powershell
Measure-Command { npm test } ; "Exit: $LASTEXITCODE"
Measure-Command { npx tsc --noEmit } ; "Exit: $LASTEXITCODE"
Measure-Command { npm run lint } ; "Exit: $LASTEXITCODE"
Measure-Command { npm run build } ; "Exit: $LASTEXITCODE"
```

**Step 8.3 — If `npm run lint` does NOT exit 0**

This indicates Tasks 1-7 did not fully resolve all 9 violations. Inspect the lint output:

```bash
npm run lint 2>&1 | grep -E "error|warning"
```

For each remaining violation:
- If it's one of the 9 from 07-01-SUMMARY.md: a previous task did not fully apply its strategy — re-check that task's acceptance criteria and re-fix.
- If it's a NEW violation surfaced (e.g., a Task introduced a regression): STOP, surface, do not proceed.

Re-run `npm run lint` after each fix until it exits 0.

**Step 8.4 — If `npm run build` fails on missing env vars**

For each `process.env.X is required` or similar crash:
- Add `X=sentinel-do-not-use` to the shell environment (literal placeholder, NOT a real value).
- Record the env-var name in the empirical sentinel list (write to a scratch file or note).
- Re-run `npm run build`.

The empirical sentinel list is the handoff to Plan 07-02. Do NOT add real values. Do NOT modify `.env.local` (this is a SHELL-only operation; persisting sentinels into committed config is a security regression).

**Step 8.5 — Document results**

Capture for the Plan 07-1A SUMMARY:
- For each of the 4 commands: exit code (must be 0), wall-clock time (seconds).
- Empirical sentinel env-var list (which vars needed dummy values for `npm run build` to succeed, and any that `npm test` needed too).
- Whether `tests/api/chat-six-gate-order.test.ts` ran (under non-CI shell it should; the executor can confirm with `npm test -- --reporter=verbose 2>&1 | grep chat-six-gate-order`).

Do NOT proceed to Task 9 until all 4 commands exit 0.
Do NOT commit any `.env*` changes (the sentinels are shell-only).
Do NOT set CI=1 in this shell for the run — the local-run posture (no CI=1) is the test. Plan 07-02 will validate the CI=1 posture once test.yml lands.
  </action>
  <acceptance_criteria>
- `npm test` exits 0 (562+ tests pass; chat-six-gate-order may pass or fail with known flake — does not block plan close-out per 07-01 D-C-02/03).
- `npx tsc --noEmit` exits 0 (TypeScript compiles clean across the 9 modified production files plus the 1 new hook file).
- `npm run lint` exits 0 (THIS IS THE KEY ACCEPTANCE — proves the 9 violations are gone).
- `npm run build` exits 0 (next build completes; prebuild hook generates fallback artifact).
- Empirical sentinel env-var list captured (could be empty — if `npm run build` works with zero env vars, that's the ideal case).
- Wall-clock for each command recorded (informs Plan 07-02's `timeout-minutes: 10` calibration).
  </acceptance_criteria>
  <verify>
    <automated>npm test 2>&1 | tail -3 ; npx tsc --noEmit 2>&1 | tail -3 ; npm run lint 2>&1 | tail -3 ; npm run build 2>&1 | tail -10</automated>
  </verify>
  <done>
- All 4 pre-flight commands exit 0 from a clean-env shell.
- The list of sentinel env vars (if any) required by `npm run build` is captured in a scratch note for the Plan 07-1A SUMMARY.
- Wall-clock times captured per command.
- No `.env*` files modified by this task.
- No commits made during this task (it's verification-only).
- Joe (or executor) is ready to proceed to Task 9 (manual smoke).
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 9: Joe-driven manual smoke verification</name>
  <files>(no file changes — runtime verification only)</files>
  <read_first>
    - `.planning/phases/07-add-test-yml-github-actions-workflow-for-determinism/07-1A-CONTEXT.md` — D-B-01 verification posture
    - `tests/e2e/chat-happy-path.spec.ts` — existing Playwright spec coverage area
    - `tests/e2e/cat-06-view-toggle.spec.ts` — view-toggle + matrix-mode coverage area
  </read_first>
  <action>
**Step 9.1 — Run existing Playwright cat6 specs (optional automated half)**

```bash
npx playwright test tests/e2e/chat-happy-path.spec.ts tests/e2e/cat-06-view-toggle.spec.ts
```

Expected: both specs pass. If a spec fails:
- chat-happy-path: investigate whether Task 6's onFinish hoist broke the timestamp-divider rendering for the same chat session (D-A-04 invariant). Compare against pre-task screenshot if available; if not, manually compare divider behavior to a freshly-deployed pre-Plan-07-1A build.
- cat-06-view-toggle: investigate whether Task 3's chat/page.tsx changes broke the body-class lifecycle (Pitfall 2 in RESEARCH). The body-class useEffect at lines 57-62 was NOT touched by Task 3, but if isClient timing differs subtly from hydrated timing, the test may flake on the cleanup-after-navigation assertion.

If either spec fails, surface the failure to Joe and do not proceed with Task 10 until resolved.

**Step 9.2 — Joe-driven manual smoke (the blocking half)**

Joe runs `npm run dev` and walks through:

1. **/chat page loads** — open `http://localhost:3000` → enter email → click into chat. Expected: chat UI renders normally (header with "Joe's Agent" + chevron, composer at bottom, empty-state starter prompts).
2. **Chat send works** — type "hi" → press send. Expected: typing indicator appears → assistant reply streams in → message bubble appears in the chat list. Verify: a timestamp divider may appear above (or not — depends on prior message timing per the 5-min rule); if a divider DOES appear above the assistant reply, it should show a localized "Today at HH:MM AM/PM"-ish string, NOT the raw ISO.
3. **View toggle works** — click "Dark Mode" pill. Expected: page transitions to matrix mode (green-monospace styling + canvas rain backdrop). Click "Light Mode" pill → page returns to default chat styling.
4. **Navigation cleanup** — while in matrix mode, navigate to `/admin` (or any non-chat URL). Expected: the admin page does NOT paint itself green (Pitfall 2 — body-class cleanup must fire on unmount).
5. **Admin abuse page renders** — visit `/admin/abuse` (assuming GitHub OAuth is configured). Expected: page loads, AbuseTable renders rows (if any abuse data exists) with LocalTime + RelativeTime visible in the rows. Verify: timestamps render as localized strings, NOT raw ISO.
6. **Admin evals/calibrate renders** — visit `/admin/evals/calibrate`. Expected: page loads, calibration UI renders without crashing on the Date.now() Server-Component call (the disable comment in Task 7 doesn't change runtime behavior; this confirms no regression).

If ANY step shows visible regression vs. pre-Plan-07-1A behavior, surface to Joe and pause before Task 10.

Resume signal: "smoke green — Tasks 9.1 + 9.2 confirmed" to advance to Task 10.

Do NOT skip Step 9.1 even if Step 9.2 passes — the Playwright specs are the regression net that catches what the eye misses.
Do NOT modify `.env.local` to make admin pages accessible (Joe drives auth; if his local setup doesn't have GitHub OAuth working, that's an unrelated pre-existing setup issue).
Do NOT add new tests during this task (D-B-02: pre-emptive regression tests are deferred unless a real regression surfaces).
  </action>
  <acceptance_criteria>
- `npx playwright test tests/e2e/chat-happy-path.spec.ts tests/e2e/cat-06-view-toggle.spec.ts` exits 0 (Step 9.1).
- Joe confirms via resume-signal that all 6 manual smoke steps pass (Step 9.2).
- No new regressions visible vs pre-Plan-07-1A behavior.
- If any failure surfaced, it is captured in a deviation note for the SUMMARY (do not silently fix in-task; surface to Joe per D-B-02 posture).
  </acceptance_criteria>
  <verify>
    <automated>echo "Checkpoint — Joe drives. Verification captured manually via resume-signal. Playwright runs as part of executor's automated half; manual smoke as Joe's half."</automated>
  </verify>
  <done>
- Playwright cat6 specs pass.
- Joe confirms manual smoke via resume-signal: "smoke green — Tasks 9.1 + 9.2 confirmed".
- Any deviations noted are surfaced before Task 10 begins.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 10: Update ROADMAP.md Phase 7 plans block to list 07-1A</name>
  <files>.planning/ROADMAP.md</files>
  <read_first>
    - `.planning/ROADMAP.md` lines 183-198 (Phase 7 section)
    - `.planning/phases/07-add-test-yml-github-actions-workflow-for-determinism/07-1A-CONTEXT.md` — D-D-02 (no renumbering of 07-02)
  </read_first>
  <action>
Update the Phase 7 plans block to insert 07-1A between the executed 07-01 and the pending 07-02.

Use the Edit tool. Locate the existing block (around lines 193-196 in ROADMAP.md):

```markdown
**Plans:** 2 plans
Plans:
- [ ] 07-01-PLAN.md — Pre-CI prep: narrow lint to `eslint src/` (Option B+E) + CI-gated `exclude` for chat-six-gate flake (D-C-02/03) + verify 4-command pre-flight gate exits 0 from zero-secrets shell
- [ ] 07-02-PLAN.md — Write `.github/workflows/test.yml` (zero `secrets.*`, pinned actions, commit-SHA ref, least-privilege perms) + induced-break demo (RED→GREEN) + lock new check as required on `main` branch protection (D-C-04 sequence; Joe-driven)
```

Replace with:

```markdown
**Plans:** 3 plans
Plans:
- [x] 07-01-PLAN.md — Pre-CI prep PARTIAL: narrow lint to `eslint src/` (Option B+E) + CI-gated `exclude` for chat-six-gate flake (D-C-02/03); Task 3 pre-flight verification deferred to 07-1A after eslint-plugin-react-hooks@6 exposed 9 pre-existing violations (Option F)
- [ ] 07-1A-PLAN.md — React-hooks lint debt resolution: useIsClient hook (D-A-02), useSyncExternalStore refactor of LocalTime + RelativeTime (D-A-03), onFinish-driven ChatUI timestamp capture (D-A-04), Server-Component purity disables (D-A-01), trivials (D-A-05); absorbs 07-01 Task 3 clean-env pre-flight (D-C-01..03); captures sentinel-env-var list for 07-02 handoff
- [ ] 07-02-PLAN.md — Write `.github/workflows/test.yml` (zero `secrets.*`, pinned actions, commit-SHA ref, least-privilege perms) + induced-break demo (RED→GREEN) + lock new check as required on `main` branch protection (D-C-04 sequence; Joe-driven)
```

Notes for executor:
- Plan count changes from `2 plans` → `3 plans`.
- 07-01-PLAN.md entry changes from `- [ ]` to `- [x]` (executed PARTIAL — Tasks 1+2 done per 07-01-SUMMARY.md).
- 07-01 entry text updates to reflect PARTIAL status + Task 3 deferral.
- 07-1A entry is NEW; uses `- [ ]` (this plan is still being executed when the planner runs; the executor will check it off when this plan completes).
- 07-02 entry text is UNCHANGED verbatim.
- Numbering convention: 07-1A (NOT 07-1, NOT 07.5, NOT 07-01.5) — matches the 05.1 / 05.2 decimal-phase precedent applied at the plan level per D-D-01.

After this task, the ROADMAP reflects the new sequence: 07-01 (done PARTIAL) → 07-1A (in flight) → 07-02 (pending).

Do NOT modify any other section of ROADMAP.md.
Do NOT modify the Phase 7 Goal, Depends on, Requirements, or Success Criteria fields.
Do NOT add a separate "deferred plan" note section — the Plan list updates capture the change.
  </action>
  <acceptance_criteria>
- `grep -q "\\*\\*Plans:\\*\\* 3 plans" .planning/ROADMAP.md` exits 0 (count updated).
- `grep -q "07-1A-PLAN.md" .planning/ROADMAP.md` exits 0 (new entry present).
- `grep -q "- \\[x\\] 07-01-PLAN.md" .planning/ROADMAP.md` exits 0 (07-01 marked executed).
- `grep -q "- \\[ \\] 07-02-PLAN.md" .planning/ROADMAP.md` exits 0 (07-02 still pending, unchanged).
- `grep -B1 "07-1A-PLAN.md" .planning/ROADMAP.md | head -1 | grep -q "07-01-PLAN.md"` exits 0 (07-1A is immediately after 07-01).
- `grep -A1 "07-1A-PLAN.md" .planning/ROADMAP.md | tail -1 | grep -q "07-02-PLAN.md"` exits 0 (07-02 is immediately after 07-1A).
- Lines mentioning Phase 7 Goal / Depends on / Requirements / Success Criteria are UNCHANGED (verifiable by diff).
  </acceptance_criteria>
  <verify>
    <automated>node -e "const fs=require('fs'); const r=fs.readFileSync('.planning/ROADMAP.md','utf8'); const checks=[['count is 3', /\\*\\*Plans:\\*\\* 3 plans/.test(r)], ['07-1A entry present', /07-1A-PLAN\\.md/.test(r)], ['07-01 marked done', /- \\[x\\] 07-01-PLAN\\.md/.test(r)], ['07-02 still pending', /- \\[ \\] 07-02-PLAN\\.md/.test(r)], ['ordering 01 → 1A → 02', /07-01-PLAN\\.md[\\s\\S]*?07-1A-PLAN\\.md[\\s\\S]*?07-02-PLAN\\.md/.test(r)]]; let f=[]; for(const[n,c] of checks){if(!c)f.push(n);} if(f.length){console.error('FAIL:',f.join(', ')); process.exit(1);} console.log('OK ROADMAP updated');"</automated>
  </verify>
  <done>
- ROADMAP.md Phase 7 plans block lists 3 plans in order: 07-01 (done), 07-1A (in flight), 07-02 (pending).
- 07-01 entry text reflects PARTIAL status + Task 3 deferral.
- 07-1A entry briefly describes the per-violation strategy + Task 3 absorption.
- 07-02 entry text unchanged.
- No other ROADMAP.md sections modified.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client-side hydration boundary | useIsClient hook + useSyncExternalStore refactor changes the timing of when "client" state is observable, but no new attack surface — both server snapshot and client snapshot are file-local constants. |
| Server-Component eslint disable | Targeted single-line suppression of a STYLE rule (not a SECURITY rule); no runtime behavior change. The Date.now() in render is execution-once-per-request, identical pre- and post-fix. |
| useChat onFinish event handler | New code path inside onFinish stamps assistant timestamps. No new network calls, no new persisted state — only React state mutation observable to the same Client Component that owned the previous useEffect. |
| Sentinel env vars in shell | Task 8 may set placeholder values in the executor's shell environment. These are not committed; not written to .env.local; not exposed to running processes outside the verification commands. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-07-1A-01 | Tampering | useIsClient hook returns wrong value (e.g., always true) breaking SSR hydration on /chat or /admin | mitigate (informational) | Three-arg useSyncExternalStore with explicit `() => false` server snapshot guarantees server-side render shows the "not hydrated" branch. Task 2 acceptance grep enforces all three snapshot args present. Task 9 manual smoke confirms /chat renders correctly post-hydration. |
| T-07-1A-02 | Information Disclosure | Sentinel env vars accidentally committed to .env.local or pushed | mitigate (informational) | Task 8 explicit instruction: shell-only, no .env modifications. Pre-commit secret-scan hook (Phase 01 SAFE-14) catches secret-shaped strings on commit. Sentinels are intentionally NOT secret-shaped (e.g., `sentinel-do-not-use`). |
| T-07-1A-03 | Tampering | Task 7's eslint-disable comment silences future real violations of react-hooks/purity (over-broad suppression) | mitigate (informational) | `eslint-disable-next-line react-hooks/purity` is scoped to exactly ONE following line; cannot silence violations elsewhere in the file. Pairing it with a rationale comment ensures future diff reviewers see the intent. |
| T-07-1A-04 | Repudiation | Future contributor removes the rationale comment but keeps the eslint-disable, losing the "Server Component" context | accept (informational) | Repo convention is rationale-with-disable (Plan 02 D-I-07 precedent). Removal would be visible in diff review. No automated enforcement beyond convention. |
| T-07-1A-05 | Spoofing | Task 6's onFinish timestamp capture fires twice (once on success, once on race condition) producing inconsistent dividers | mitigate (informational) | The `prev[message.id] ? prev : ...` idempotency guard ensures setAssistantTimestamps only writes on FIRST stamp per message id; subsequent calls return the previous state unchanged. Same guard as the old effect's `if (assistantTimestamps[latest.id]) return;` check. |
| T-07-1A-06 | Denial of Service | Removing the streaming-status useEffect causes a delayed-stamp visual regression — divider doesn't appear until stream completes (several seconds for long replies) | accept (informational) | shouldShowTimestampBefore's 5-minute rule means dividers only appear at conversation-level boundaries, not per-message. Delaying a divider's render from "start of stream" to "end of stream" shifts visibility by at most a few seconds inside a single conversation turn — recruiter UX impact is sub-perceptual. D-A-04's explicit fallback ("acceptable: onFinish") accepts this. |
| T-07-1A-07 | Information Disclosure | Task 7 disable-comment misalignment on the calibrate page (multi-line const expression) leaves the violation firing in CI | mitigate (informational) | Task 7 action explicitly anticipates this with a fallback single-line form. Task 8's `npm run lint` exit-0 acceptance catches alignment failure structurally. |
| T-07-1A-08 | Tampering | LocalTime / RelativeTime useSyncExternalStore refactor changes server-snapshot from "initial useState value" to "raw ISO" — visually identical at runtime, but JSX hydration markup differs subtly | accept (informational) | Both old (`useState(iso)`) and new (`getServerSnapshot: () => iso`) initial values are the raw ISO. The visible markup is byte-identical because both return the same string. Hydration diff is zero. |
| T-07-1A-09 | Elevation of Privilege | None — this plan touches Client/Server Component code with no auth or new endpoint surface | accept | N/A — no new attack surface. |
| T-07-1A-10 | Repudiation | Task 10 ROADMAP edit could be misinterpreted as cancelling 07-02 (e.g., if executor accidentally removes 07-02 entry) | mitigate (informational) | Task 10 acceptance grep enforces 07-02 entry presence (`- [ ] 07-02-PLAN.md`); failure to preserve it fails the task. Diff review is the final guard. |

Severity Note: All threats above are rated informational because this plan modifies Client/Server-Component refactor surface only — no new endpoints, no new auth boundaries, no new external API calls, no new persisted state, no new secrets, no new dependencies. The threat model documents diligence rather than active risk. `security_enforcement` is honored by enumeration; mitigations are mostly structural (grep checks, acceptance criteria) rather than runtime defenses because there is no new runtime attack surface.
</threat_model>

<verification>
Plan-level acceptance (grep + exit-code verifiable):

```bash
# Task 1: trivials
grep -q "reset: _reset" src/app/error.tsx && echo FAIL-task1-reset || echo PASS-task1-reset
grep -q "let totalCost" src/lib/eval/cats/cat2.ts && echo FAIL-task1-letconst || echo PASS-task1-letconst

# Task 2: useIsClient hook
test -f src/hooks/use-is-client.ts || echo FAIL-task2-file
grep -q "useSyncExternalStore" src/hooks/use-is-client.ts || echo FAIL-task2-hook-body
grep -q "export function useIsClient" src/hooks/use-is-client.ts || echo FAIL-task2-export

# Task 3: hydration migration
grep -q "setHydrated" src/app/chat/page.tsx && echo FAIL-task3-chatpage || echo PASS-task3-chatpage
grep -q "setHydrated" src/components/ChatStatusBanner.tsx && echo FAIL-task3-csb || echo PASS-task3-csb
grep -q "useIsClient" src/app/chat/page.tsx || echo FAIL-task3-import-chat
grep -q "useIsClient" src/components/ChatStatusBanner.tsx || echo FAIL-task3-import-csb

# Task 4: LocalTime
grep -q "useState\|useEffect" src/app/admin/components/LocalTime.tsx && echo FAIL-task4-legacy-hooks || echo PASS-task4-legacy-hooks
grep -q "useSyncExternalStore" src/app/admin/components/LocalTime.tsx || echo FAIL-task4-new-hook

# Task 5: RelativeTime
grep -q "useState\|useEffect" src/app/admin/components/RelativeTime.tsx && echo FAIL-task5-legacy-hooks || echo PASS-task5-legacy-hooks
grep -q "useSyncExternalStore" src/app/admin/components/RelativeTime.tsx || echo FAIL-task5-new-hook

# Task 6: ChatUI hoist
grep -q "if (status !== 'streaming') return;" src/components/ChatUI.tsx && echo FAIL-task6-old-effect-survives || echo PASS-task6-old-effect-gone
grep -q "onFinish: ({ message," src/components/ChatUI.tsx || echo FAIL-task6-message-destructured
grep -q "if (message.role === 'assistant')" src/components/ChatUI.tsx || echo FAIL-task6-new-branch

# Task 7: Server-Component disables
grep -q "eslint-disable-next-line react-hooks/purity" "src/app/admin/(authed)/abuse/page.tsx" || echo FAIL-task7-abuse
grep -q "eslint-disable-next-line react-hooks/purity" "src/app/admin/(authed)/evals/calibrate/page.tsx" || echo FAIL-task7-calibrate

# Task 8: pre-flight gate
npm test && npx tsc --noEmit && npm run lint && npm run build && echo PASS-task8 || echo FAIL-task8

# Task 9: smoke (manual; verified by Joe via resume-signal)

# Task 10: ROADMAP
grep -q "07-1A-PLAN.md" .planning/ROADMAP.md || echo FAIL-task10-entry
grep -q "- \[x\] 07-01-PLAN.md" .planning/ROADMAP.md || echo FAIL-task10-01-checkbox
```
</verification>

<success_criteria>
1. All 9 src/ eslint-plugin-react-hooks@6 violations resolved per their CONTEXT.md D-A category strategy (no `react-hooks/set-state-in-effect`, no `react-hooks/purity`, no `prefer-const`, no `no-unused-vars` from 07-01-SUMMARY.md's list).
2. `src/hooks/use-is-client.ts` exists with the exact three-arg useSyncExternalStore body (Task 2 verified).
3. `src/app/chat/page.tsx` and `src/components/ChatStatusBanner.tsx` use `useIsClient()` instead of useState+useEffect hydration pattern (Task 3 verified).
4. `src/app/admin/components/LocalTime.tsx` and `src/app/admin/components/RelativeTime.tsx` use useSyncExternalStore instead of useState+useEffect (Tasks 4 + 5 verified).
5. `src/components/ChatUI.tsx` stamps assistant message timestamps from the useChat `onFinish` callback (event-driven) instead of a status-watching useEffect (effect-driven) (Task 6 verified).
6. Both Server-Component Date.now() sites in `src/app/admin/(authed)/abuse/page.tsx` and `src/app/admin/(authed)/evals/calibrate/page.tsx` have targeted eslint-disable-next-line + rationale comment (Task 7 verified).
7. Trivials resolved: `_reset` unused arg gone, `let totalCost` → `const totalCost` (Task 1 verified).
8. Clean-env pre-flight gate exits 0: `npm test && npx tsc --noEmit && npm run lint && npm run build` (Task 8 verified — absorbs 07-01 Task 3).
9. Sentinel env-var list captured in plan SUMMARY for Plan 07-02 handoff (Task 8 deliverable).
10. Existing Playwright cat6 specs pass (Task 9 Step 9.1 verified).
11. Joe-driven manual smoke green: chat send + view toggle + admin pages render correctly (Task 9 Step 9.2 verified).
12. ROADMAP.md Phase 7 plans block updated to list 07-1A between 07-01 (done) and 07-02 (pending), plan count = 3 (Task 10 verified).
</success_criteria>

<output>
After completion, create `.planning/phases/07-add-test-yml-github-actions-workflow-for-determinism/07-1A-SUMMARY.md` documenting:

- Per-violation outcome table: for each of the 9 violations, list the file:line + the strategy applied (D-A-01..05) + the commit SHA of the fix.
- Clean-env pre-flight gate results: exit code + wall-clock for each of the 4 commands.
- **Empirical sentinel env-var list** (THE handoff to Plan 07-02): exact list of `process.env.*` vars that needed a sentinel value for `npm run build` to succeed in a zero-secrets shell, formatted as a copy-pasteable env block for 07-02's test.yml authoring. If the list is empty (best case — `npm run build` works with zero env vars), document that explicitly so Plan 07-02 knows it can omit the env block.
- Playwright cat6 results (chat-happy-path + cat-06-view-toggle exit codes).
- Joe-driven manual smoke confirmation (resume-signal text).
- Any deviations encountered (e.g., a violation that needed a different strategy than CONTEXT.md predicted, or a sentinel env-var pattern that broke unexpectedly).
- Confirmation that ROADMAP.md was updated and 07-02 is now unblocked.
</output>

## Handoff to Plan 07-02

This section is required by 07-1A's planning directive (mirror the 07-01-SUMMARY.md handoff shape so 07-02 has explicit consumer-side inputs).

### Sentinel env-var contract (captured during Task 8)

**To be filled in by Task 8's clean-env pre-flight run.** Plan 07-02 must read this section of the eventual 07-1A-SUMMARY.md before authoring `test.yml`'s `env:` block.

Format expected (illustrative — actual list depends on Task 8 results):

```yaml
# Sentinel env vars empirically required for `npm run build` from a zero-secrets shell.
# These are LITERAL placeholder strings, NOT secrets.* references. Do NOT inject real values.
# Plan 07-1A Task 8 captured this list on YYYY-MM-DD via clean-env shell run.

env:
  CI: 'true'  # explicit (vitest exclude branch from Plan 07-01)
  # NEXT_PUBLIC_SUPABASE_URL: 'https://sentinel.local'        # if Task 8 needed this
  # NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sentinel-anon-key'        # if Task 8 needed this
  # ...
```

If Task 8 finds `npm run build` works with ZERO env vars (the ideal case), this section documents that explicitly: "Plan 07-02 can omit the env: block entirely (or include only `CI: 'true'`)."

### Lint command shape parity with 07-02

The clean-env Task 8 runs `npm run lint`. After Task 1 of 07-01, the package.json `lint` script is literally `eslint src/`. Plan 07-02's test.yml `Lint (src/ only)` step must invoke `npm run lint` (or `npx eslint src/`) — both shapes work identically because of the script alias. Plan 07-02 should NOT re-invent the lint command; reuse the npm script.

### Expected delta between local Task 8 and CI Ubuntu runners

Informational only (D-B-03 defers live verification). Possible deltas:

- `npm ci` on Ubuntu may resolve to slightly different transitive dep versions vs Joe's local lockfile state (unlikely with a checked-in `package-lock.json`, but possible if a `~` or `^` resolves differently). Mitigation: Plan 07-02 uses `npm ci` not `npm install`.
- Wall-clock for `npm run build` will likely be 1.5-3x slower on GH Actions Ubuntu runner vs Joe's local machine. If local Task 8 records >5min build, Plan 07-02 should bump `timeout-minutes` from 10 → 15.
- Tailwind v4 + Next 16 generate-fallback prebuild hook may behave differently if a dependency has Windows-specific behavior (unlikely — but capture in Task 8 if any platform-specific warning appears).

### Tasks 9 + 10 informational notes for 07-02

- Task 9 (manual smoke) is plan-1A-specific; Plan 07-02 does NOT need to re-run the manual smoke unless its workflow file accidentally changes runtime behavior (it shouldn't — workflows are CI-only).
- Task 10 updates ROADMAP. Plan 07-02 will further update ROADMAP at its own close-out to mark 07-1A `- [x]` (executed) and adjust language if needed.

---

*Phase: 07-add-test-yml-github-actions-workflow-for-determinism*
*Plan: 1A (lint debt resolution + 07-01 Task 3 absorption, inserted between executed 07-01 and pending 07-02)*
*Planner: Claude Opus 4.7 (1M context)*
*Mode: standard (single-plan addition; not phase replan)*
