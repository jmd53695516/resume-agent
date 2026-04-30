// src/lib/anthropic.ts
// Two Anthropic surfaces: (1) AI-SDK provider for streaming Sonnet chat,
// (2) direct @anthropic-ai/sdk for the one-shot Haiku classifier.
// MODELS is the single source of truth for model IDs — bump here only.
import { createAnthropic } from '@ai-sdk/anthropic';
import Anthropic from '@anthropic-ai/sdk';
import { env } from './env';

export const MODELS = {
  MAIN: 'claude-sonnet-4-6', // Sonnet 4.6 — main chat loop
  CLASSIFIER: 'claude-haiku-4-5', // Haiku 4.5 — preflight classifier
} as const;

// AI SDK provider — used by /api/chat streamText.
// createAnthropic is a factory; we pre-bind the apiKey so route code stays clean.
export const anthropicProvider = createAnthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

// Direct SDK client — used only by classifier.ts for one-shot JSON calls.
// Lazy-initialized module singleton (no top-level throw if key is absent in Phase 1 tests).
let _anthropicClient: Anthropic | null = null;
export function anthropicClient(): Anthropic {
  if (!_anthropicClient) {
    _anthropicClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return _anthropicClient;
}
