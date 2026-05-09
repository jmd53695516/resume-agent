// @vitest-environment jsdom
// tests/components/ChatUI-fallback-redirect.test.tsx
// Plan 03-03 Task 3 / B2 (moved from 03-05): on TWO consecutive /api/chat 500s
// ChatUI redirects to /?fallback=1 (the PlainHtmlFallback consumer in
// page.tsx, Plan 03-05). Counter resets on any successful response. The
// router.push target string is the load-bearing assertion.
// W3: per-file jsdom directive; global env stays 'node'.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom does not implement Element.prototype.scrollIntoView. ChatUI calls it
// in a useEffect after mount; stub it as a no-op so the render doesn't throw.
beforeAll(() => {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function () {};
  }
});

// Mock next/navigation so we can spy on router.push.
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

// Capture the onError / onFinish callbacks passed by ChatUI to useChat. Tests
// invoke them directly (one-shot per simulated event). BL-18: onFinish in
// AI SDK v6 receives { isError, isAbort, isDisconnect, ... } and fires after
// EVERY request including errors. The captured signature reflects that.
type FinishArg = {
  isError?: boolean;
  isAbort?: boolean;
  isDisconnect?: boolean;
};
let capturedOnError: ((err: Error) => void) | null = null;
let capturedOnFinish: ((arg?: FinishArg) => void) | null = null;

vi.mock('@ai-sdk/react', () => ({
  useChat: (cfg: {
    onError?: (err: Error) => void;
    onFinish?: (arg?: FinishArg) => void;
  }) => {
    capturedOnError = cfg.onError ?? null;
    capturedOnFinish = cfg.onFinish ?? null;
    return {
      messages: [],
      sendMessage: vi.fn(),
      status: 'ready',
      error: null,
    };
  },
}));

// DefaultChatTransport is invoked via `new DefaultChatTransport(...)` in
// ChatUI — vi.fn() arrow factories are not constructible. Stub a real class.
vi.mock('ai', () => ({
  DefaultChatTransport: class {
    constructor(_cfg: unknown) {}
  },
}));

afterEach(() => {
  cleanup();
});

describe('ChatUI persistent-500 fallback redirect (B2 — moved from 03-05)', () => {
  beforeEach(async () => {
    push.mockReset();
    capturedOnError = null;
    capturedOnFinish = null;
    // Render ChatUI to capture the callbacks. Dynamic import after vi.mock.
    const { render } = await import('@testing-library/react');
    const { ChatUI } = await import('../../src/components/ChatUI');
    render(<ChatUI sessionId="sess_test" />);
  });

  it('does NOT redirect on first /api/chat error', () => {
    expect(capturedOnError).not.toBeNull();
    capturedOnError?.(new Error('500'));
    expect(push).not.toHaveBeenCalled();
  });

  it('redirects to /?fallback=1 after 2 consecutive errors', () => {
    capturedOnError?.(new Error('500'));
    capturedOnError?.(new Error('500'));
    expect(push).toHaveBeenCalledWith('/?fallback=1');
  });

  it('counter resets after a successful onFinish — third error does not redirect', () => {
    capturedOnError?.(new Error('500')); // count = 1
    capturedOnFinish?.({ isError: false, isAbort: false, isDisconnect: false }); // count reset to 0
    capturedOnError?.(new Error('500')); // count = 1, NOT 2
    expect(push).not.toHaveBeenCalled();
  });

  // BL-18: AI SDK v6 fires onFinish in a finally block AFTER onError on every
  // request, including errors. The arg includes isError/isAbort/isDisconnect.
  // ChatUI's onFinish must NOT reset the counter when isError is true,
  // otherwise two consecutive 5xx responses oscillate counter 0→1→0→1 and
  // the redirect never fires. Discovered 2026-05-09 during P3 #8 walk.
  it('counter does NOT reset after onFinish with isError:true — two errors still redirect', () => {
    capturedOnError?.(new Error('503')); // count = 1
    capturedOnFinish?.({ isError: true }); // counter must stay at 1
    capturedOnError?.(new Error('503')); // count = 2 → redirect
    capturedOnFinish?.({ isError: true });
    expect(push).toHaveBeenCalledWith('/?fallback=1');
  });

  it('counter does NOT reset after onFinish with isAbort:true', () => {
    capturedOnError?.(new Error('aborted'));
    capturedOnFinish?.({ isAbort: true });
    capturedOnError?.(new Error('aborted'));
    expect(push).toHaveBeenCalledWith('/?fallback=1');
  });

  it('counter does NOT reset after onFinish with isDisconnect:true', () => {
    capturedOnError?.(new Error('disconnect'));
    capturedOnFinish?.({ isDisconnect: true });
    capturedOnError?.(new Error('disconnect'));
    expect(push).toHaveBeenCalledWith('/?fallback=1');
  });

  it('redirect target is exactly /?fallback=1 (not a different path)', () => {
    capturedOnError?.(new Error('500'));
    capturedOnError?.(new Error('500'));
    // At least one call with the exact target. Implementations may guard
    // against double-dispatch on the 3rd+ error or not — only target matters.
    const calls = push.mock.calls.map((c) => c[0]);
    expect(calls).toContain('/?fallback=1');
  });
});
