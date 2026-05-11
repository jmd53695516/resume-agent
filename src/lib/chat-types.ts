/**
 * Phase 05.2: typed UI message + bubble grouping types.
 *
 * D-A-02-AMENDED: timestamps are FULLY CLIENT-SIDE — captured in React state
 * at sendMessage() (user) or status==='streaming' transition (assistant).
 * createdAt is OPTIONAL because legacy messages predate the metadata.
 */
import type { UIMessage } from 'ai';

export type MessageMetadata = {
  createdAt?: number; // epoch ms
};

export type ResumeAgentUIMessage = UIMessage<MessageMetadata>;

export type BubblePosition = 'only' | 'first' | 'middle' | 'last';
