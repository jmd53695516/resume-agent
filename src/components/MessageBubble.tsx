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
import { cn } from '@/lib/utils';
import { TracePanel, type ToolPart } from './TracePanel';
import { MetricCard } from './MetricCard';

type TextPart = { type: 'text'; text: string };
type Part = TextPart | ToolPart;

type MessageBubbleProps =
  | { role: 'user'; text: string; parts?: undefined }
  | { role: 'assistant'; parts: Part[]; text?: undefined };

// CONTEXT D-I-07: assistant prose has markdown headers (# / ## / ###) stripped —
// belt-and-suspenders since the system prompt also bans them.
function stripMarkdownHeaders(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^#{1,6}\s+/, ''))
    .join('\n');
}

function isToolPart(p: Part): p is ToolPart {
  return p.type.startsWith('tool-');
}

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

  return (
    <div
      className="bubble-pop flex w-full flex-col items-start gap-1 px-1 py-px"
      data-testid="msg-assistant"
    >
      {textConcat && (
        <div
          className={cn(
            'max-w-[78%] whitespace-pre-wrap break-words rounded-[20px] px-[13px] pt-[8px] pb-[9px] text-[16px] tracking-[-0.01em]',
            'bg-[var(--them)] text-[var(--them-fg)]',
          )}
          style={{ lineHeight: 1.28, overflowWrap: 'anywhere' }}
        >
          {stripMarkdownHeaders(textConcat)}
        </div>
      )}
      {metricFrameworkParts.map((p) => (
        <MetricCard key={`card-${p.toolCallId}`} data={p.output} />
      ))}
      {toolParts.map((p) => (
        <TracePanel key={p.toolCallId} part={p} />
      ))}
    </div>
  );
}
