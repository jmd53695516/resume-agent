'use client';

import { cn } from '@/lib/utils';

type MessageBubbleProps = {
  role: 'user' | 'assistant';
  text: string;
};

// CONTEXT D-I-05: user messages right-aligned in subtle bubbles, assistant messages
// rendered as plain prose (feels like texting with Joe, not a chatbot).
// CONTEXT D-I-07: assistant prose has markdown headers (# / ## / ###) stripped —
// belt-and-suspenders since the system prompt also bans them.
function stripMarkdownHeaders(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^#{1,6}\s+/, ''))
    .join('\n');
}

export function MessageBubble({ role, text }: MessageBubbleProps) {
  if (role === 'user') {
    return (
      <div className="flex justify-end" data-testid="msg-user">
        <div className="max-w-[75%] whitespace-pre-wrap break-words rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">
          {text}
        </div>
      </div>
    );
  }
  return (
    <div className="w-full" data-testid="msg-assistant">
      <div
        className={cn(
          'whitespace-pre-wrap text-[15px] leading-relaxed text-foreground',
        )}
      >
        {stripMarkdownHeaders(text)}
      </div>
    </div>
  );
}
