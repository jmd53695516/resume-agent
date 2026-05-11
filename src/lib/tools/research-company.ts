// src/lib/tools/research-company.ts
// TOOL-01, TOOL-02, TOOL-09, TOOL-11. AI SDK v6 tool() instance.
// Schema: D-B-01. Sonnet sees the description and decides to call when a
// recruiter names their company. Tool returns structured Exa data wrapped
// in <fetched-content> for prompt-injection defense. Sonnet generates the
// 3-paragraph pitch from the data — the tool does NOT generate the pitch.
import { tool } from 'ai';
import { z } from 'zod';
import { researchCompany } from '@/lib/exa';
import { wrapFetchedContent } from './sanitize';
import { TOOL_FAILURE_COPY } from './failure-copy';
import { log } from '@/lib/logger';
import { hashArgs } from '@/lib/hash';
import { redis } from '@/lib/redis';

export const research_company = tool({
  description:
    'Research a specific company using fresh web sources from the last 90 days. ' +
    'Use when the recruiter says they are from, work at, or want a pitch tailored to a named company. ' +
    "Do NOT use this for generic questions about Joe's background. " +
    'Returns recent signals, sources, and excerpts. You generate the 3-paragraph pitch from the data; ' +
    'the tool does not write the pitch for you.',
  inputSchema: z.object({
    name: z
      .string()
      .min(1)
      .max(100)
      .describe('The company name, e.g., "Notion" or "Anthropic".'),
    website: z
      .string()
      .url()
      .optional()
      .describe(
        'Optional company website if the recruiter provided one. Do NOT ask for this — Exa figures it out.',
      ),
  }),
  execute: async ({ name, website }) => {
    const started = Date.now();
    const args_hash = hashArgs({ name, website });
    try {
      const raw = await researchCompany(name, website);
      // TOOL-09 / D-B-06: wrap third-party content in <fetched-content> tags
      // BEFORE returning to model. The system-prompt FETCHED_CONTENT_RULE
      // (Task 5 of this plan) tells Sonnet to treat tagged content as data.
      const wrapped = wrapFetchedContent(raw);
      // Plan 05-12 launch fix: refresh heartbeat:exa on real-traffic success
      // (mirrors chat route's heartbeat:anthropic + heartbeat:classifier
      // refreshes in onFinish). Best-effort — banner refresh is non-critical
      // compared to returning the data to Sonnet.
      redis.set('heartbeat:exa', Date.now(), { ex: 120 }).catch(() => {});
      log({
        event: 'tool_call',
        tool_name: 'research_company',
        args_hash,
        latency_ms: Date.now() - started,
        status: 'ok',
      });
      return wrapped;
    } catch (err) {
      log(
        {
          event: 'tool_call',
          tool_name: 'research_company',
          args_hash,
          latency_ms: Date.now() - started,
          status: 'error',
          error_class: (err as Error).name ?? 'Error',
        },
        'error',
      );
      // TOOL-11: structured error payload, NOT thrown. Sonnet sees the
      // in-character copy and weaves it in. RESEARCH §2 explains why
      // structured-return beats throw for this trace-panel-aligned UX.
      return { error: TOOL_FAILURE_COPY.research_company };
    }
  },
});
