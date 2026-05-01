// tests/lib/tools/get-case-study.test.ts
// Plan 03-01 Task 3: get_case_study AI SDK v6 tool() instance.
// TOOL-03/04/11. Mocks @/lib/kb-loader (getCaseStudy + listCaseStudySlugs)
// and @/lib/logger; no disk reads.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { z } from 'zod';

const getCaseStudy = vi.fn();
const listCaseStudySlugs = vi.fn();
const log = vi.fn();
vi.mock('@/lib/kb-loader', () => ({ getCaseStudy, listCaseStudySlugs }));
vi.mock('@/lib/logger', () => ({ log }));

function asZod(s: unknown): z.ZodTypeAny {
  return s as z.ZodTypeAny;
}

const SLUG_LIST = [
  'cortex-ai-client-win',
  'gap-brand-hierarchy-consolidation',
  'snowflake-edw-migration',
  'snowflake-marketplace-datashare',
  'ua-project-rescue',
];

describe('get_case_study tool', () => {
  let toolModule: typeof import('../../../src/lib/tools/get-case-study');

  beforeEach(async () => {
    vi.clearAllMocks();
    listCaseStudySlugs.mockReturnValue([...SLUG_LIST]);
    // Default mock: every slug in the list resolves to a CaseStudy with frontmatter title.
    getCaseStudy.mockImplementation((slug: string) => {
      if (!SLUG_LIST.includes(slug)) return null;
      return {
        slug,
        frontmatter: { title: slug.replace(/-/g, ' ') },
        content: `# ${slug}\n\nbody`,
      };
    });
    toolModule = await import('../../../src/lib/tools/get-case-study');
  });

  // -- inputSchema --
  it('inputSchema accepts empty object (slug optional)', () => {
    const r = asZod(toolModule.get_case_study.inputSchema).safeParse({});
    expect(r.success).toBe(true);
  });
  it('inputSchema accepts a string slug', () => {
    const r = asZod(toolModule.get_case_study.inputSchema).safeParse({ slug: 'cortex-ai-client-win' });
    expect(r.success).toBe(true);
  });
  it('inputSchema rejects non-string slug', () => {
    const r = asZod(toolModule.get_case_study.inputSchema).safeParse({ slug: 123 });
    expect(r.success).toBe(false);
  });

  // -- execute behaviors --
  it('returns menu when slug is missing', async () => {
    const r = await toolModule.get_case_study.execute!({}, {} as any);
    expect((r as any).kind).toBe('menu');
    expect((r as any).case_studies).toHaveLength(SLUG_LIST.length);
    expect((r as any).case_studies[0]).toHaveProperty('slug');
    expect((r as any).case_studies[0]).toHaveProperty('title');
  });

  it('returns menu when slug is unknown (D-C-02)', async () => {
    const r = await toolModule.get_case_study.execute!({ slug: 'totally-unknown-slug' }, {} as any);
    expect((r as any).kind).toBe('menu');
    expect((r as any).case_studies).toHaveLength(SLUG_LIST.length);
  });

  it('returns case_study record for valid slug', async () => {
    const r = await toolModule.get_case_study.execute!(
      { slug: 'cortex-ai-client-win' },
      {} as any,
    );
    expect((r as any).kind).toBe('case_study');
    expect((r as any).slug).toBe('cortex-ai-client-win');
    expect((r as any).frontmatter).toBeDefined();
    expect((r as any).content).toContain('body');
  });

  it('returns menu when slug is the fixture (_fixture_for_tests, blocked at kb-loader)', async () => {
    // Simulate kb-loader's behavior: fixture slugs are rejected at the SLUG_PATTERN
    // check (underscore not allowed); getCaseStudy returns null.
    getCaseStudy.mockReturnValueOnce(null);
    const r = await toolModule.get_case_study.execute!(
      { slug: '_fixture_for_tests' },
      {} as any,
    );
    expect((r as any).kind).toBe('menu');
  });

  it('returns failure copy when kb-loader throws unexpectedly', async () => {
    // Both calls inside the try block can throw; making either throw triggers
    // the catch and the failure copy.
    listCaseStudySlugs.mockImplementation(() => {
      throw new Error('disk error');
    });
    const r = await toolModule.get_case_study.execute!({}, {} as any);
    expect((r as any).error).toBeDefined();
    expect((r as any).error).toContain("case study");
  });

  it('uses frontmatter title when present, slug-humanized fallback otherwise', async () => {
    // First call: getCaseStudy returns a frontmatter title.
    // We override the per-slug mock so one slug has a title and another doesn't.
    getCaseStudy.mockImplementation((slug: string) => {
      if (slug === 'cortex-ai-client-win') {
        return { slug, frontmatter: { title: 'Cortex AI Client Win' }, content: 'body' };
      }
      return { slug, frontmatter: {}, content: 'body' };
    });
    const r = await toolModule.get_case_study.execute!({}, {} as any);
    const entries = (r as any).case_studies as Array<{ slug: string; title: string }>;
    const cortex = entries.find((e) => e.slug === 'cortex-ai-client-win');
    const gap = entries.find((e) => e.slug === 'gap-brand-hierarchy-consolidation');
    expect(cortex?.title).toBe('Cortex AI Client Win');
    // Slug-humanized: each segment capitalized, joined with spaces.
    expect(gap?.title).toBe('Gap Brand Hierarchy Consolidation');
  });

  // -- logging --
  it('logs tool_call with args_hash, mode, latency_ms on every call', async () => {
    await toolModule.get_case_study.execute!({ slug: 'cortex-ai-client-win' }, {} as any);
    expect(log).toHaveBeenCalled();
    const call = log.mock.calls[0][0] as any;
    expect(call.event).toBe('tool_call');
    expect(call.tool_name).toBe('get_case_study');
    expect(call.args_hash).toMatch(/^[0-9a-f]{16}$/);
    expect(typeof call.latency_ms).toBe('number');
    expect(call.status).toBe('ok');
    expect(['menu', 'menu_fallback', 'case_study']).toContain(call.mode);
  });
});
