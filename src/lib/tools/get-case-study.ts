// src/lib/tools/get-case-study.ts
// TOOL-03, TOOL-04, TOOL-11. AI SDK v6 tool() instance.
// Schema: D-C-01 (slug optional). Missing or unknown slug returns the menu
// (D-C-02). Valid slug returns the structured case study record (D-C-04).
// Sonnet does the ~400-word first-person narration from the record;
// the tool returns DATA, not prose.
import { tool } from 'ai';
import { z } from 'zod';
import { getCaseStudy, listCaseStudySlugs } from '@/lib/kb-loader';
import { TOOL_FAILURE_COPY } from './failure-copy';
import { log } from '@/lib/logger';
import { hashArgs } from '@/lib/hash';

type MenuPayload = {
  kind: 'menu';
  case_studies: Array<{ slug: string; title: string }>;
};

type CaseStudyPayload = {
  kind: 'case_study';
  slug: string;
  frontmatter: Record<string, unknown>;
  content: string;
};

type FailurePayload = { error: string };

function buildMenu(): MenuPayload {
  const slugs = listCaseStudySlugs();
  return {
    kind: 'menu',
    case_studies: slugs.map((slug) => {
      const cs = getCaseStudy(slug);
      const titleFromFrontmatter =
        cs && typeof cs.frontmatter.title === 'string'
          ? (cs.frontmatter.title as string)
          : null;
      // Fallback: humanize slug ("cortex-ai-client-win" → "Cortex Ai Client Win").
      const fallback = slug
        .split('-')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ');
      return { slug, title: titleFromFrontmatter ?? fallback };
    }),
  };
}

export const get_case_study = tool({
  description:
    "Return one of Joe's case studies as a structured record, or — if no slug is given or the slug is unknown — return the menu of available case studies. " +
    "Use when the recruiter asks to walk through a project. If you don't know which one they want, call this WITHOUT a slug to get the menu, then ask.",
  inputSchema: z.object({
    slug: z
      .string()
      .optional()
      .describe('Optional case study slug. Omit to get the menu.'),
  }),
  execute: async ({ slug }): Promise<MenuPayload | CaseStudyPayload | FailurePayload> => {
    const started = Date.now();
    const args_hash = hashArgs({ slug });
    try {
      if (!slug) {
        const result = buildMenu();
        log({
          event: 'tool_call',
          tool_name: 'get_case_study',
          args_hash,
          latency_ms: Date.now() - started,
          status: 'ok',
          mode: 'menu',
        });
        return result;
      }
      const cs = getCaseStudy(slug);
      if (!cs) {
        // D-C-02: unknown slug → menu (NOT failure).
        const result = buildMenu();
        log({
          event: 'tool_call',
          tool_name: 'get_case_study',
          args_hash,
          latency_ms: Date.now() - started,
          status: 'ok',
          mode: 'menu_fallback',
        });
        return result;
      }
      log({
        event: 'tool_call',
        tool_name: 'get_case_study',
        args_hash,
        latency_ms: Date.now() - started,
        status: 'ok',
        mode: 'case_study',
      });
      return {
        kind: 'case_study',
        slug: cs.slug,
        frontmatter: cs.frontmatter,
        content: cs.content,
      };
    } catch (err) {
      log(
        {
          event: 'tool_call',
          tool_name: 'get_case_study',
          args_hash,
          latency_ms: Date.now() - started,
          status: 'error',
          error_class: (err as Error).name ?? 'Error',
        },
        'error',
      );
      return { error: TOOL_FAILURE_COPY.get_case_study };
    }
  },
});
