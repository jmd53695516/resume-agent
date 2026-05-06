// src/lib/tools/depth-cap.ts
// TOOL-07 (≤3 tool calls per turn) + SAFE-15 (duplicate-arg stop sequence).
// Implemented as a prepareStep callback. CRITICAL: returns `activeTools: []`
// to disable tools, NOT the toolChoice-none pattern. The latter invalidates Anthropic's
// prompt-cache message blocks (RESEARCH §3, citing platform.claude.com).
// activeTools filters at the SDK layer — cache-friendly.
//
// WR-03 fix: replaced the previous `PrepareStepFunction<any>` + `(s: any) =>`
// pattern with a narrow structural type alias. If a future AI SDK upgrade
// renames `toolCalls` or restructures Step (e.g. wrapping calls inside a
// `result` object), the runtime guard below logs a `depth_cap_shape_warning`
// instead of silently degrading to "no depth cap" — which would be a SAFE-15
// bypass invisible to tests pinned against the old shape.
import { log } from '@/lib/logger';

// Narrow structural alias: we only read `toolCalls` off each step, so a
// minimal shape is enough. Cast at the boundary, not at every property access.
type StepWithToolCalls = {
  toolCalls?: ReadonlyArray<{ toolName: string; input: unknown }>;
};

// Param shape we actually consume — narrower than AI SDK's PrepareStepFunction
// signature. By NOT importing the SDK's generic-over-tools type here we avoid
// fighting the inferred ToolSet at the call site (streamText narrows to the
// specific tool record), while still giving call sites enough structure to
// type-check via duck-typing.
type DepthCapInput = {
  steps: ReadonlyArray<unknown>;
};

export async function enforceToolCallDepthCap(input: DepthCapInput): Promise<{ activeTools?: [] }> {
  const { steps } = input;
  const flatCalls = (steps as ReadonlyArray<StepWithToolCalls>).flatMap(
    (s) => s.toolCalls ?? [],
  );
  const totalToolCalls = flatCalls.length;

  // SDK-shape regression guard: if there are steps but no tool calls extracted,
  // the SDK's Step shape may have changed. Log loudly so this surfaces in
  // Vercel logs rather than silently bypassing the cap.
  if (flatCalls.length === 0 && steps.length > 0) {
    log({ event: 'depth_cap_shape_warning', step_count: steps.length }, 'warn');
  }

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
}
