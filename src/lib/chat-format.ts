/**
 * Phase 05.2: pure helpers for bubble grouping + inter-group timestamp gating.
 *
 * D-A-01: consecutive same-sender messages form a "run". Position is one of:
 *   - 'only'   single-message run
 *   - 'first'  first of a multi-message run
 *   - 'middle' interior of a 3+ message run
 *   - 'last'   last of a multi-message run
 *
 * D-A-02 + AMENDED: iMessage 5-minute rule. Timestamp shown at index 0 and
 * any time the gap between message[i-1] and message[i] exceeds GAP_MS.
 * Returns false when either createdAt is missing (defensive — never render
 * "Invalid Date").
 *
 * Grouping is sender-only — does NOT break across timestamp dividers
 * (UI-SPEC line 496, RESEARCH Open Q2). This matches the bundle's
 * groupMessages in chat.jsx:77-88.
 */
import type { BubblePosition, ResumeAgentUIMessage } from './chat-types';

export function computePositions(
  messages: Pick<ResumeAgentUIMessage, 'id' | 'role'>[],
): Map<string, BubblePosition> {
  const out = new Map<string, BubblePosition>();
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === 'system') continue;
    const prev = i > 0 ? messages[i - 1] : null;
    const next = i < messages.length - 1 ? messages[i + 1] : null;
    const sameAsPrev = prev !== null && prev.role === m.role;
    const sameAsNext = next !== null && next.role === m.role;
    if (!sameAsPrev && !sameAsNext) out.set(m.id, 'only');
    else if (!sameAsPrev && sameAsNext) out.set(m.id, 'first');
    else if (sameAsPrev && sameAsNext) out.set(m.id, 'middle');
    else out.set(m.id, 'last');
  }
  return out;
}

const GAP_MS = 5 * 60 * 1000;

export function shouldShowTimestampBefore(
  messages: Array<{ metadata?: { createdAt?: number } }>,
  i: number,
): boolean {
  if (i === 0) return true;
  const prev = messages[i - 1].metadata?.createdAt;
  const cur = messages[i].metadata?.createdAt;
  if (!prev || !cur) return false; // defensive — historical messages without timestamp
  return cur - prev > GAP_MS;
}
