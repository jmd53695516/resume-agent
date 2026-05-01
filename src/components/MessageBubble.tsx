'use client';

import { cn } from '@/lib/utils';

type MessageBubbleProps = {
  role: 'user' | 'assistant';
  text: string;
};

// CONTEXT D-I-07: assistant prose has markdown headers (# / ## / ###) stripped —
// belt-and-suspenders since the system prompt also bans them.
function stripMarkdownHeaders(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^#{1,6}\s+/, ''))
    .join('\n');
}

// Visual: Chat Stream design (claude.ai/design handoff, 2026-04-30).
// Both roles render as bubbles — user (right, blue --me) and assistant (left,
// dark grey --them). This is a deliberate reversal of Phase 2 D-I-05's
// "assistant as plain prose" lockdown; recorded in 02-CONTEXT.md amendment.
export function MessageBubble({ role, text }: MessageBubbleProps) {
  const isMe = role === 'user';
  const content = isMe ? text : stripMarkdownHeaders(text);
  return (
    <div
      className={cn(
        'bubble-pop flex w-full px-1 py-px',
        isMe ? 'justify-end' : 'justify-start',
      )}
      data-testid={isMe ? 'msg-user' : 'msg-assistant'}
    >
      <div
        className={cn(
          'max-w-[78%] whitespace-pre-wrap break-words rounded-[20px] px-[13px] pt-[8px] pb-[9px] text-[16px] tracking-[-0.01em]',
          isMe
            ? 'bg-[var(--me)] text-[var(--me-fg)]'
            : 'bg-[var(--them)] text-[var(--them-fg)]',
        )}
        style={{ lineHeight: 1.28, overflowWrap: 'anywhere' }}
      >
        {content}
      </div>
    </div>
  );
}
