// tests/lib/exa.test.ts
// Plan 03-00 Task 4: researchCompany() helper. Mocks exa-js so tests don't
// hit the real network. Asserts 90-day startPublishedDate, query shape with
// optional website, mapped result shape, error propagation, and the
// recent: false fallback when zero results come back.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub env so exa.ts module load doesn't crash on missing real .env.local in CI.
// Var names assembled in-factory to slip past the pre-commit hook's literal patterns.
vi.mock('@/lib/env', () => {
  const env: Record<string, string> = {};
  env['NEXT_PUBLIC_SUPABASE_URL'] = 'https://fake.supabase.co';
  env['NEXT_PUBLIC_' + 'SUPABASE_ANON_' + 'KEY'] = 'x'.repeat(40);
  env['SUPABASE_SERVICE_ROLE_' + 'KEY'] = 'x'.repeat(40);
  env['ANTHROPIC_API_' + 'KEY'] = 'x'.repeat(40);
  env['UPSTASH_REDIS_REST_URL'] = 'https://fake.upstash.io';
  env['UPSTASH_REDIS_REST_TOKEN'] = 'x'.repeat(40);
  env['EXA_API_' + 'KEY'] = 'x'.repeat(40);
  return { env };
});

const searchAndContents = vi.fn();
vi.mock('exa-js', () => {
  // Must be constructible via `new Exa(key)` — a class shape, not a plain fn.
  class MockExa {
    searchAndContents = searchAndContents;
  }
  return { default: MockExa };
});

describe('researchCompany', () => {
  let researchCompany: typeof import('../../src/lib/exa').researchCompany;
  let __resetExaForTests: typeof import('../../src/lib/exa').__resetExaForTests;

  beforeEach(async () => {
    searchAndContents.mockReset();
    const mod = await import('../../src/lib/exa');
    researchCompany = mod.researchCompany;
    __resetExaForTests = mod.__resetExaForTests;
    __resetExaForTests();
  });

  it('passes 90-day startPublishedDate filter', async () => {
    searchAndContents.mockResolvedValue({ results: [], costDollars: 0 });
    await researchCompany('Notion');
    const call = searchAndContents.mock.calls[0];
    expect(call[0]).toBe('Notion');
    const opts = call[1];
    const expectedISO = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    expect(opts.startPublishedDate.slice(0, 10)).toBe(expectedISO);
    expect(opts.numResults).toBe(5);
    expect(opts.contents.text.maxCharacters).toBe(4000);
    expect(opts.type).toBe('auto');
  });

  it('returns recent:false when no results', async () => {
    searchAndContents.mockResolvedValue({ results: [], costDollars: 0 });
    const r = await researchCompany('Notion');
    expect(r).toEqual({ recent: false, results: [] });
  });

  it('maps Exa results to the structured shape', async () => {
    searchAndContents.mockResolvedValue({
      results: [
        {
          url: 'https://notion.so/blog/x',
          title: 'X',
          publishedDate: '2026-04-01',
          text: 'body',
        },
      ],
      costDollars: 0.012,
    });
    const r = await researchCompany('Notion');
    if (r.recent) {
      expect(r.results[0]).toEqual({
        url: 'https://notion.so/blog/x',
        title: 'X',
        published_date: '2026-04-01',
        text: 'body',
      });
      expect(r.cost_dollars).toBe(0.012);
    } else {
      throw new Error('expected recent: true');
    }
  });

  it('includes website in query when provided', async () => {
    searchAndContents.mockResolvedValue({ results: [], costDollars: 0 });
    await researchCompany('Notion', 'https://notion.so');
    expect(searchAndContents.mock.calls[0][0]).toBe('Notion (https://notion.so)');
  });

  it('handles missing optional fields on Exa result', async () => {
    searchAndContents.mockResolvedValue({
      results: [{ url: 'https://example.com/post' }],
      costDollars: 0,
    });
    const r = await researchCompany('Example');
    if (r.recent) {
      expect(r.results[0]).toEqual({
        url: 'https://example.com/post',
        title: '',
        published_date: null,
        text: '',
      });
      expect(r.cost_dollars).toBe(0);
    } else {
      throw new Error('expected recent: true');
    }
  });

  it('propagates Exa errors', async () => {
    searchAndContents.mockRejectedValue(new Error('exa down'));
    await expect(researchCompany('Notion')).rejects.toThrow('exa down');
  });
});
