/**
 * Phase 05.2-01: unit coverage for bubble grouping + inter-group timestamp
 * gating helpers. Pure-function tests — no DOM, no React, no mocks.
 *
 * Covers every behavior bullet from 05.2-01-PLAN.md `<behavior>` section.
 */
import { describe, it, expect } from 'vitest';
import { computePositions, shouldShowTimestampBefore } from '@/lib/chat-format';
import type { BubblePosition } from '@/lib/chat-types';

type MsgInput = { id: string; role: 'user' | 'assistant' | 'system' };

describe('computePositions', () => {
  it('single user message returns only', () => {
    const msgs: MsgInput[] = [{ id: 'u1', role: 'user' }];
    const out = computePositions(msgs);
    expect(out.get('u1')).toBe<BubblePosition>('only');
    expect(out.size).toBe(1);
  });

  it('single assistant message returns only', () => {
    const msgs: MsgInput[] = [{ id: 'a1', role: 'assistant' }];
    const out = computePositions(msgs);
    expect(out.get('a1')).toBe<BubblePosition>('only');
    expect(out.size).toBe(1);
  });

  it('alternating user→assistant returns only/only', () => {
    const msgs: MsgInput[] = [
      { id: 'u1', role: 'user' },
      { id: 'a1', role: 'assistant' },
    ];
    const out = computePositions(msgs);
    expect(out.get('u1')).toBe<BubblePosition>('only');
    expect(out.get('a1')).toBe<BubblePosition>('only');
  });

  it('two consecutive user returns first/last', () => {
    const msgs: MsgInput[] = [
      { id: 'u1', role: 'user' },
      { id: 'u2', role: 'user' },
    ];
    const out = computePositions(msgs);
    expect(out.get('u1')).toBe<BubblePosition>('first');
    expect(out.get('u2')).toBe<BubblePosition>('last');
  });

  it('three consecutive user returns first/middle/last', () => {
    const msgs: MsgInput[] = [
      { id: 'u1', role: 'user' },
      { id: 'u2', role: 'user' },
      { id: 'u3', role: 'user' },
    ];
    const out = computePositions(msgs);
    expect(out.get('u1')).toBe<BubblePosition>('first');
    expect(out.get('u2')).toBe<BubblePosition>('middle');
    expect(out.get('u3')).toBe<BubblePosition>('last');
  });

  it('mixed run u/u/u/a/a returns first/middle/last/first/last', () => {
    const msgs: MsgInput[] = [
      { id: 'u1', role: 'user' },
      { id: 'u2', role: 'user' },
      { id: 'u3', role: 'user' },
      { id: 'a1', role: 'assistant' },
      { id: 'a2', role: 'assistant' },
    ];
    const out = computePositions(msgs);
    expect(out.get('u1')).toBe<BubblePosition>('first');
    expect(out.get('u2')).toBe<BubblePosition>('middle');
    expect(out.get('u3')).toBe<BubblePosition>('last');
    expect(out.get('a1')).toBe<BubblePosition>('first');
    expect(out.get('a2')).toBe<BubblePosition>('last');
  });

  it('skips system messages from output map', () => {
    // System message in middle of array — does not appear in output, and
    // its presence in the array does affect neighbor inspection (since
    // prev/next refer to messages[i-1]/messages[i+1] on the raw array,
    // not on a system-filtered view). Per RESEARCH §Pattern 2 reference impl.
    const msgs: MsgInput[] = [
      { id: 'u1', role: 'user' },
      { id: 's1', role: 'system' },
      { id: 'u2', role: 'user' },
    ];
    const out = computePositions(msgs);
    expect(out.has('s1')).toBe(false);
    // u1's next is the system message (different role) → 'only'
    expect(out.get('u1')).toBe<BubblePosition>('only');
    // u2's prev is the system message (different role) → 'only'
    expect(out.get('u2')).toBe<BubblePosition>('only');
    expect(out.size).toBe(2);
  });

  it('empty array returns empty Map', () => {
    const out = computePositions([]);
    expect(out.size).toBe(0);
  });
});

describe('shouldShowTimestampBefore', () => {
  // Helper: build messages with explicit metadata.createdAt
  type TMsg = { metadata?: { createdAt?: number } };
  const at = (ms: number): TMsg => ({ metadata: { createdAt: ms } });
  const FIVE_MIN_MS = 5 * 60 * 1000;

  it('index 0 always returns true (with timestamp)', () => {
    const msgs: TMsg[] = [at(1_000_000)];
    expect(shouldShowTimestampBefore(msgs, 0)).toBe(true);
  });

  it('index 0 returns true even without timestamp', () => {
    const msgs: TMsg[] = [{}];
    expect(shouldShowTimestampBefore(msgs, 0)).toBe(true);
  });

  it('returns false for gap less than 5 minutes', () => {
    const t0 = 1_700_000_000_000;
    const msgs: TMsg[] = [at(t0), at(t0 + 1 * 60 * 1000)]; // 1-minute gap
    expect(shouldShowTimestampBefore(msgs, 1)).toBe(false);
  });

  it('returns false for gap exactly 5 minutes (boundary — strict greater-than)', () => {
    const t0 = 1_700_000_000_000;
    const msgs: TMsg[] = [at(t0), at(t0 + FIVE_MIN_MS)]; // exactly 5 minutes
    expect(shouldShowTimestampBefore(msgs, 1)).toBe(false);
  });

  it('returns true for gap greater than 5 minutes (300_001 ms)', () => {
    const t0 = 1_700_000_000_000;
    const msgs: TMsg[] = [at(t0), at(t0 + FIVE_MIN_MS + 1)];
    expect(shouldShowTimestampBefore(msgs, 1)).toBe(true);
  });

  it('returns true for gap of 6 minutes', () => {
    const t0 = 1_700_000_000_000;
    const msgs: TMsg[] = [at(t0), at(t0 + 6 * 60 * 1000)];
    expect(shouldShowTimestampBefore(msgs, 1)).toBe(true);
  });

  it('returns false when previous message missing createdAt', () => {
    const msgs: TMsg[] = [{ metadata: {} }, at(1_700_000_000_000)];
    expect(shouldShowTimestampBefore(msgs, 1)).toBe(false);
  });

  it('returns false when current message missing createdAt', () => {
    const msgs: TMsg[] = [at(1_700_000_000_000), { metadata: {} }];
    expect(shouldShowTimestampBefore(msgs, 1)).toBe(false);
  });

  it('returns false when both messages missing createdAt', () => {
    const msgs: TMsg[] = [{}, {}];
    expect(shouldShowTimestampBefore(msgs, 1)).toBe(false);
  });

  it('returns false when previous message metadata entirely undefined', () => {
    const msgs: TMsg[] = [{}, at(1_700_000_000_000)];
    expect(shouldShowTimestampBefore(msgs, 1)).toBe(false);
  });
});
