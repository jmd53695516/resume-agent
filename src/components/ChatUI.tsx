'use client';

import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StarterPrompts } from './StarterPrompts';
import { MessageBubble } from './MessageBubble';

type ChatUIProps = {
  sessionId: string;
};

export function ChatUI({ sessionId }: ChatUIProps) {
  // Consumer-managed input (v6 pattern: useChat no longer owns input state)
  const [input, setInput] = useState('');

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { session_id: sessionId },
    }),
  });

  const isStreaming = status === 'submitted' || status === 'streaming';
  const isEmpty = messages.length === 0;

  // Auto-scroll to latest message on new content
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  function submit() {
    if (!input.trim() || isStreaming) return;
    sendMessage({ text: input });
    setInput('');
  }

  function handleStarterSelect(prefill: string) {
    setInput(prefill);
    // DO NOT call submit() here — CONTEXT D-I-03: prefill, don't auto-submit.
  }

  return (
    <main className="mx-auto flex h-screen max-w-2xl flex-col px-4 pt-6">
      {/* Message list */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto pb-4">
        {isEmpty ? (
          <div className="flex flex-col items-start gap-4 pt-8">
            <StarterPrompts onSelect={handleStarterSelect} disabled={isStreaming} />
          </div>
        ) : (
          messages
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .map((m) => {
              const text = m.parts
                .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
                .map((p) => p.text)
                .join('');
              return (
                <MessageBubble
                  key={m.id}
                  role={m.role as 'user' | 'assistant'}
                  text={text}
                />
              );
            })
        )}

        {/* Thinking indicator: shown when waiting for first token */}
        {status === 'submitted' && (
          <div
            className="text-sm italic text-muted-foreground"
            data-testid="thinking-indicator"
          >
            thinking…
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive" data-testid="chat-error">
            Something went wrong. Try again, or email Joe directly.
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar (sticky bottom) */}
      <form
        className="sticky bottom-0 flex gap-2 border-t border-border bg-background py-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about my background, or edit a starter and send…"
          disabled={isStreaming}
          className="flex-1"
          data-testid="chat-input"
        />
        <Button
          type="submit"
          disabled={isStreaming || !input.trim()}
          data-testid="chat-send"
        >
          Send
        </Button>
      </form>
    </main>
  );
}
