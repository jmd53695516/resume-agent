'use client';

// src/components/MessageBubble.tsx
// Plan 03-03 Task 3: extends Phase 2 MessageBubble to walk AI SDK v6
// message.parts on the assistant role and dispatch per part type:
//   - 'text'           → prose (with stripMarkdownHeaders, D-I-07 preserved)
//   - 'tool-${name}'   → TracePanel (one per call, stacked)
//   - design_metric_framework w/ output-available + valid output → MetricCard
//     above its TracePanel (render order per D-D-04: text → card → trace)
//
// User role behavior is unchanged from Phase 2 — text-only bubble. The
// data-testid contracts (msg-user, msg-assistant) are preserved end-to-end so
// the Phase 2 E2E test (tests/e2e/chat-happy-path.spec.ts) continues to pass.
import type { ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { TracePanel, type ToolPart } from './TracePanel';
import { MetricCard } from './MetricCard';

type TextPart = { type: 'text'; text: string };
type Part = TextPart | ToolPart;

type MessageBubbleProps =
  | { role: 'user'; text: string; parts?: undefined; alwaysExpandTrace?: undefined }
  | { role: 'assistant'; parts: Part[]; text?: undefined; alwaysExpandTrace?: boolean };

// CONTEXT D-I-07: assistant prose has markdown headers (# / ## / ###) stripped —
// belt-and-suspenders since the system prompt also bans them. Kept as a first
// pass even though the ReactMarkdown renderer below also collapses h1-h6 → <p>.
function stripMarkdownHeaders(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^#{1,6}\s+/, ''))
    .join('\n');
}

// BL-10: render assistant prose as Markdown so URLs and links from the pitch
// tool become clickable. remark-gfm auto-links bare URLs (recruiter pitches
// often emit `https://...` lines, not `[label](url)` form). Heading nodes are
// flattened to <p> so a smuggled `# foo` cannot stylize itself even after the
// stripMarkdownHeaders pre-pass (defense-in-depth, D-I-07).
const PROSE_COMPONENTS: ComponentProps<typeof ReactMarkdown>['components'] = {
  a: ({ children, href, ...rest }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 hover:opacity-80"
      {...rest}
    >
      {children}
    </a>
  ),
  h1: ({ children }) => <p>{children}</p>,
  h2: ({ children }) => <p>{children}</p>,
  h3: ({ children }) => <p>{children}</p>,
  h4: ({ children }) => <p>{children}</p>,
  h5: ({ children }) => <p>{children}</p>,
  h6: ({ children }) => <p>{children}</p>,
};

function isToolPart(p: Part): p is ToolPart {
  return p.type.startsWith('tool-');
}

// BL-16b: in-flight chip shown while a tool is running between
// input-available and output-available states. AI SDK v6 doesn't stream
// Sonnet's prose during the tool sub-call, so without this the recruiter
// sees a silent loading state for the whole tool duration (38.7s observed
// for the metric tool during 05-01 walk).
const IN_FLIGHT_LABELS: Record<string, string> = {
  'tool-research_company': 'Researching the company',
  'tool-get_case_study': 'Pulling up the case study',
  'tool-design_metric_framework': 'Drafting the metric framework',
};

// Visual: Chat Stream design (claude.ai/design handoff, 2026-04-30).
// Both roles render as bubbles — user (right, blue --me) and assistant (left,
// dark grey --them). This is a deliberate reversal of Phase 2 D-I-05's
// "assistant as plain prose" lockdown; recorded in 02-CONTEXT.md amendment.
export function MessageBubble(props: MessageBubbleProps) {
  if (props.role === 'user') {
    return (
      <div
        className={cn('bubble-pop flex w-full justify-end px-1 py-px')}
        data-testid="msg-user"
      >
        <div
          className={cn(
            'max-w-[78%] whitespace-pre-wrap break-words rounded-[20px] px-[13px] pt-[8px] pb-[9px] text-[16px] tracking-[-0.01em]',
            'bg-[var(--me)] text-[var(--me-fg)]',
          )}
          style={{ lineHeight: 1.28, overflowWrap: 'anywhere' }}
        >
          {props.text}
        </div>
      </div>
    );
  }

  // Assistant: walk parts. Render order per D-D-04:
  //   1. All text parts concatenated (Sonnet's commentary), header-stripped.
  //   2. MetricCard for any design_metric_framework tool with output-available
  //      AND output shaped like MetricFramework (the type guard inside
  //      MetricCard rejects {error} payloads — TracePanel still renders below).
  //   3. TracePanel for every tool-* part (one per call, stacked).
  const textConcat = props.parts
    .filter((p): p is TextPart => p.type === 'text')
    .map((p) => p.text)
    .join('');
  const toolParts = props.parts.filter(isToolPart);
  const metricFrameworkParts = toolParts.filter(
    (p) =>
      p.type === 'tool-design_metric_framework' &&
      p.state === 'output-available' &&
      p.output !== undefined,
  );
  // BL-16b: first tool whose state is still pre-output. Show an in-flight
  // chip with present-tense label + pulsing dot so the recruiter doesn't
  // perceive the agent as unresponsive during a long tool sub-call.
  const inFlightTool = toolParts.find(
    (p) => p.state === 'input-streaming' || p.state === 'input-available',
  );

  return (
    <div
      className="bubble-pop flex w-full flex-col items-start gap-1 px-1 py-px"
      data-testid="msg-assistant"
    >
      {textConcat && (
        <div
          className={cn(
            'max-w-[78%] break-words rounded-[20px] px-[13px] pt-[8px] pb-[9px] text-[16px] tracking-[-0.01em]',
            'bg-[var(--them)] text-[var(--them-fg)]',
            // ReactMarkdown emits real <p> blocks, so stack them with vertical rhythm.
            '[&>p]:mb-2 [&>p:last-child]:mb-0',
          )}
          style={{ lineHeight: 1.28, overflowWrap: 'anywhere' }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={PROSE_COMPONENTS}>
            {stripMarkdownHeaders(textConcat)}
          </ReactMarkdown>
        </div>
      )}
      {metricFrameworkParts.map((p) => (
        <MetricCard key={`card-${p.toolCallId}`} data={p.output} />
      ))}
      {inFlightTool && (
        <div
          data-testid={`tool-progress-${inFlightTool.toolCallId}`}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--them)] px-3 py-1.5 text-[13px] italic text-[var(--them-fg)]"
        >
          <span className="typing-dot h-[6px] w-[6px] rounded-full bg-white/55" />
          {IN_FLIGHT_LABELS[inFlightTool.type] ?? 'Working'}…
        </div>
      )}
      {toolParts.map((p) => (
        <TracePanel
          key={p.toolCallId}
          part={p}
          alwaysExpanded={props.alwaysExpandTrace ?? false}
        />
      ))}
    </div>
  );
}
