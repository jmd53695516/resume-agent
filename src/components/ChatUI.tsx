'use client';

import type * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useRouter } from 'next/navigation';
import { StarterPrompts } from './StarterPrompts';
import { MessageBubble } from './MessageBubble';

type ChatUIProps = {
  sessionId: string;
};

// Visual: Chat Stream design (claude.ai/design handoff, 2026-04-30).
// Layout is full-width per Joe's scope decision (not a 440px panel) but the
// design's chrome — header bar with avatar, backdrop-blurred composer with
// rounded input shell + send button — is preserved.
//
// Plan 03-03 / B2 (moved from 03-05): track consecutive /api/chat 500s. After
// the SECOND consecutive failure, redirect to /?fallback=1 — page.tsx (Plan
// 03-05) consumes that query param and renders <PlainHtmlFallback />. Counter
// resets on any successful onFinish so transient single failures don't kick
// the user out.
export function ChatUI({ sessionId }: ChatUIProps) {
  // Consumer-managed input (v6 pattern: useChat no longer owns input state)
  const [input, setInput] = useState('');

  // B2 — D-G-04 trigger 1: persistent /api/chat 500s → fallback redirect.
  const router = useRouter();
  const errorCountRef = useRef(0);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { session_id: sessionId },
    }),
    onError: () => {
      errorCountRef.current += 1;
      if (errorCountRef.current >= 2) {
        // Two consecutive failures — recruiter is on a broken agent surface.
        // Redirect to the safer plain-HTML fallback (Plan 03-05 / OBSV-12).
        router.push('/?fallback=1');
      }
    },
    onFinish: ({ isError, isAbort, isDisconnect } = {}) => {
      // BL-18: AI SDK v6's Chat.makeRequest fires onFinish in a finally
      // block AFTER onError on every request, including errors. Resetting
      // unconditionally here defeats the 2-consecutive-error redirect
      // protection — counter alternates 0→1→0→1 and never crosses the
      // threshold. Only reset on a genuinely successful response.
      if (!isError && !isAbort && !isDisconnect) {
        errorCountRef.current = 0;
      }
    },
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
    <main className="mx-auto flex h-screen w-full max-w-2xl flex-col bg-[var(--panel)] text-foreground transition-colors duration-300">
      {/* Header — backdrop-blurred bar with avatar + name */}
      <header
        className="flex h-[88px] flex-shrink-0 items-end justify-center border-b border-[var(--hairline)] px-2 pb-2.5 pt-3.5"
        style={{
          background: 'var(--header-bg)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        }}
      >
        <div className="flex flex-col items-center gap-1">
          <div className="grid h-[38px] w-[38px] place-items-center rounded-full bg-gradient-to-br from-[#b8b8be] to-[#6e6e74] text-[13px] font-semibold tracking-wide text-white shadow-sm dark:from-[#5a5a60] dark:to-[#2c2c30]">
            JD
          </div>
          <div className="text-[11px] font-medium tracking-tight text-foreground">
            Joe&apos;s Agent
          </div>
        </div>
      </header>

      {/* Scroll region */}
      <div className="chat-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col gap-0.5 px-3 pt-3.5 pb-[18px]">
          {isEmpty ? (
            <div className="flex flex-col items-start gap-4 px-3 pt-8">
              <StarterPrompts onSelect={handleStarterSelect} disabled={isStreaming} />
            </div>
          ) : (
            messages
              .filter((m) => m.role === 'user' || m.role === 'assistant')
              .map((m) => {
                if (m.role === 'user') {
                  // User messages stay text-only — Phase 2 contract.
                  const text = m.parts
                    .filter(
                      (p): p is { type: 'text'; text: string } =>
                        p.type === 'text',
                    )
                    .map((p) => p.text)
                    .join('');
                  return (
                    <MessageBubble key={m.id} role="user" text={text} />
                  );
                }
                // Assistant: forward full m.parts so MessageBubble can dispatch
                // text → prose, tool-* → TracePanel + (for design_metric_framework)
                // MetricCard. Replaces the Phase 2 text-only filter.
                // The two-step cast (unknown → assistant-parts) is required
                // because AI SDK v6's UIMessage.parts is a wider union than
                // MessageBubble's narrower (TextPart | ToolPart) union.
                type AssistantProps = Extract<
                  React.ComponentProps<typeof MessageBubble>,
                  { role: 'assistant' }
                >;
                return (
                  <MessageBubble
                    key={m.id}
                    role="assistant"
                    parts={m.parts as unknown as AssistantProps['parts']}
                  />
                );
              })
          )}

          {/* Typing indicator: shown when waiting for first token */}
          {status === 'submitted' && (
            <div
              className="bubble-pop flex w-full justify-start px-1 py-px"
              data-testid="thinking-indicator"
            >
              <div className="inline-flex items-center gap-1 rounded-[20px] bg-[var(--them)] px-[14px] py-3 text-[var(--them-fg)]">
                <span className="typing-dot h-[7px] w-[7px] rounded-full bg-white/55" />
                <span
                  className="typing-dot h-[7px] w-[7px] rounded-full bg-white/55"
                  style={{ animationDelay: '0.15s' }}
                />
                <span
                  className="typing-dot h-[7px] w-[7px] rounded-full bg-white/55"
                  style={{ animationDelay: '0.3s' }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="px-2 pt-2 text-sm text-destructive" data-testid="chat-error">
              Something went wrong. Try again, or email Joe directly.
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <form
        className="flex flex-shrink-0 items-center gap-2 border-t border-[var(--hairline)] px-2.5 pb-3.5 pt-2"
        style={{
          background: 'var(--composer-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex h-[34px] flex-1 items-center rounded-full border border-[var(--hairline)] bg-[var(--input-bg)] pl-3.5 pr-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about my background, or edit a starter and send…"
            disabled={isStreaming}
            className="flex-1 bg-transparent text-[15px] tracking-tight text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
            data-testid="chat-input"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="grid h-7 w-7 place-items-center rounded-full bg-[var(--me)] text-[var(--me-fg)] transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
            data-testid="chat-send"
            aria-label="Send"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 11.5V2.5M7 2.5L2.5 7M7 2.5L11.5 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </form>
    </main>
  );
}
