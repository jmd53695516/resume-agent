// src/lib/tools/depth-cap.ts
// TOOL-07 (≤3 tool calls per turn) + SAFE-15 (duplicate-arg stop sequence).
// Implemented as a prepareStep callback. CRITICAL: returns `activeTools: []`
// to disable tools, NOT the toolChoice-none pattern. The latter invalidates Anthropic's
// prompt-cache message blocks (RESEARCH §3, citing platform.claude.com).
// activeTools filters at the SDK layer — cache-friendly.
import type { PrepareStepFunction } from 'ai';
import { log } from '@/lib/logger';

// We deliberately keep the param shape loose — AI SDK v6's PrepareStepFunction
// is generic over the tools record; this callback only reads `steps` so we
// keep the signature minimal and let TypeScript infer at the call site.
export const enforceToolCallDepthCap: PrepareStepFunction<any> = async ({ steps }) => {
  const flatCalls = steps.flatMap((s: any) => s.toolCalls ?? []);
  const totalToolCalls = flatCalls.length;

  // TOOL-07 / D-A-04: cap at 3 tool calls per turn.
  if (totalToolCalls >= 3) {
    log(
      { event: 'tool_depth_cap', total_tool_calls: totalToolCalls },
      'warn',
    );
    return { activeTools: [] };
  }

  // SAFE-15 / D-A-05: refuse duplicate-arg consecutive calls.
  if (flatCalls.length >= 2) {
    const last = flatCalls[flatCalls.length - 1];
    const prev = flatCalls[flatCalls.length - 2];
    if (
      last.toolName === prev.toolName &&
      JSON.stringify(last.input) === JSON.stringify(prev.input)
    ) {
      log({ event: 'safe_15_trip', tool_name: last.toolName }, 'warn');
      return { activeTools: [] };
    }
  }

  return {};
};
