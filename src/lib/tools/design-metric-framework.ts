// src/lib/tools/design-metric-framework.ts
// TOOL-05, TOOL-11. AI SDK v6 tool() instance.
// Schema: D-D-01 (description min 10, max 1000). Tool execute calls Haiku 4.5
// directly via @anthropic-ai/sdk with forced-tool-output for ~100% schema
// conformance (RESEARCH §4 — strict: true + tool_choice: tool).
// Output zod-validated server-side as defense-in-depth.
import type {
  Tool as AnthropicTool,
  ToolUseBlock,
} from '@anthropic-ai/sdk/resources/messages';
import { tool } from 'ai';
import { z } from 'zod';
import { anthropicClient, MODELS } from '@/lib/anthropic';
import { TOOL_FAILURE_COPY } from './failure-copy';
import { log } from '@/lib/logger';
import { hashArgs } from '@/lib/hash';

// D-D-03: output schema. zod validates Haiku's structured response even when
// strict:true is in use — defense-in-depth.
const MetricFrameworkOutput = z.object({
  north_star: z.string().min(1),
  input_metrics: z.array(z.string()).min(1),
  counter_metrics: z.array(z.string()).min(1),
  guardrails: z.array(z.string()),
  proposed_experiment: z.string().min(1),
  open_questions: z.array(z.string()),
});

export type MetricFramework = z.infer<typeof MetricFrameworkOutput>;

const HAIKU_SYSTEM_PROMPT = `You are a senior PM helping Joe Dollinger sketch a metric framework for a feature/product/goal.
Style: opinionated, specific, no jargon. Take positions ("I'd measure X, not Y, because..."). Avoid "leverage", "robust", "comprehensive", "holistic", "various stakeholders", or bullet-list framings of obvious things. Return ONLY the structured tool call. Do not narrate.`;

// @anthropic-ai/sdk@0.90 surfaces `strict?: boolean` directly on the Tool
// interface (see node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts
// line 1075). No extension type needed; no TS suppressions either.
const OUTPUT_METRIC_FRAMEWORK_TOOL: AnthropicTool = {
  name: 'output_metric_framework',
  description:
    'Output the metric framework. ALWAYS call exactly this tool with the structured fields.',
  input_schema: {
    type: 'object',
    properties: {
      north_star: {
        type: 'string',
        description: 'One sentence. The single most important metric and why.',
      },
      input_metrics: { type: 'array', items: { type: 'string' }, minItems: 1 },
      counter_metrics: { type: 'array', items: { type: 'string' }, minItems: 1 },
      guardrails: { type: 'array', items: { type: 'string' } },
      proposed_experiment: {
        type: 'string',
        description: 'One paragraph. Hypothesis, unit, MDE, duration, risk.',
      },
      open_questions: { type: 'array', items: { type: 'string' } },
    },
    required: [
      'north_star',
      'input_metrics',
      'counter_metrics',
      'guardrails',
      'proposed_experiment',
      'open_questions',
    ],
    additionalProperties: false,
  },
  strict: true,
};

export const design_metric_framework = tool({
  description:
    'Design a metric framework for a feature/product/goal the recruiter describes. ' +
    'Returns north star, input metrics, counter-metrics, guardrails, a proposed experiment, ' +
    'and open questions. Use when the recruiter asks "how would you measure X" or describes a product goal.',
  inputSchema: z.object({
    description: z
      .string()
      .min(10)
      .max(1000)
      .describe(
        "The feature, product, or business goal to measure. Recruiter's words.",
      ),
  }),
  execute: async ({ description }) => {
    const started = Date.now();
    const args_hash = hashArgs({ description });
    try {
      const client = anthropicClient();
      const resp = await client.messages.create({
        model: MODELS.CLASSIFIER, // Haiku 4.5
        max_tokens: 1500,
        system: HAIKU_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: description }],
        tools: [OUTPUT_METRIC_FRAMEWORK_TOOL],
        // `as const` narrows the literal so the SDK's discriminated union
        // accepts it without further casting.
        tool_choice: { type: 'tool' as const, name: 'output_metric_framework' },
      });

      // Extract the forced single tool_use block.
      const toolUseBlock = resp.content.find(
        (c): c is ToolUseBlock => c.type === 'tool_use',
      );
      if (!toolUseBlock) {
        throw new Error('Haiku returned no tool_use block');
      }

      // Defense-in-depth: zod-validate even when strict:true is in use.
      const parsed = MetricFrameworkOutput.parse(toolUseBlock.input);

      log({
        event: 'tool_call',
        tool_name: 'design_metric_framework',
        args_hash,
        latency_ms: Date.now() - started,
        status: 'ok',
      });
      return parsed;
    } catch (err) {
      log(
        {
          event: 'tool_call',
          tool_name: 'design_metric_framework',
          args_hash,
          latency_ms: Date.now() - started,
          status: 'error',
          error_class: (err as Error).name ?? 'Error',
          error_message: (err as Error).message ?? String(err),
        },
        'error',
      );
      return { error: TOOL_FAILURE_COPY.design_metric_framework };
    }
  },
});
