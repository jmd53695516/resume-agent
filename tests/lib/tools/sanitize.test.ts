// tests/lib/tools/sanitize.test.ts
// Plan 03-01 Task 1: prompt-injection defense at the tool boundary.
// Wraps each Exa result's text in <fetched-content>...</fetched-content>
// tags so Sonnet — instructed by FETCHED_CONTENT_RULE — treats the body as
// data, not directives. Failure-copy tests live at the bottom of this file.
import { describe, it, expect } from 'vitest';
import { wrapFetchedContent } from '../../../src/lib/tools/sanitize';
import { TOOL_FAILURE_COPY } from '../../../src/lib/tools/failure-copy';

describe('wrapFetchedContent', () => {
  it('returns input unchanged when no recent results', () => {
    const empty = { recent: false as const, results: [] as [] };
    const r = wrapFetchedContent(empty);
    expect(r).toEqual({ recent: false, results: [] });
  });

  it('wraps text in <fetched-content> tags for each result', () => {
    const r = wrapFetchedContent({
      recent: true,
      results: [
        {
          url: 'https://x.com/post',
          title: 'X',
          published_date: '2026-04-01',
          text: 'hello',
        },
      ],
      cost_dollars: 0,
    });
    if (!r.recent) throw new Error('expected recent: true');
    expect(r.results[0].text).toBe('<fetched-content>\nhello\n</fetched-content>');
  });

  it('passes URL, title, and published_date through unchanged', () => {
    const r = wrapFetchedContent({
      recent: true,
      results: [
        {
          url: 'https://example.com/blog',
          title: 'Some title',
          published_date: '2026-03-15',
          text: 'body content',
        },
      ],
      cost_dollars: 0.01,
    });
    if (!r.recent) throw new Error('expected recent: true');
    expect(r.results[0].url).toBe('https://example.com/blog');
    expect(r.results[0].title).toBe('Some title');
    expect(r.results[0].published_date).toBe('2026-03-15');
    expect(r.cost_dollars).toBe(0.01);
  });

  it('preserves cost_dollars across multiple results', () => {
    const r = wrapFetchedContent({
      recent: true,
      results: [
        { url: 'a', title: 't1', published_date: null, text: 'x' },
        { url: 'b', title: 't2', published_date: null, text: 'y' },
      ],
      cost_dollars: 0.05,
    });
    if (!r.recent) throw new Error('expected recent: true');
    expect(r.results).toHaveLength(2);
    expect(r.results[0].text).toBe('<fetched-content>\nx\n</fetched-content>');
    expect(r.results[1].text).toBe('<fetched-content>\ny\n</fetched-content>');
    expect(r.cost_dollars).toBe(0.05);
  });

  it('handles null published_date', () => {
    const r = wrapFetchedContent({
      recent: true,
      results: [{ url: 'u', title: 't', published_date: null, text: 'b' }],
      cost_dollars: 0,
    });
    if (!r.recent) throw new Error('expected recent: true');
    expect(r.results[0].published_date).toBe(null);
  });
});

describe('TOOL_FAILURE_COPY', () => {
  const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

  it('exposes exactly the three tool keys', () => {
    expect(Object.keys(TOOL_FAILURE_COPY).sort()).toEqual(
      ['design_metric_framework', 'get_case_study', 'research_company'].sort(),
    );
  });

  it('research_company copy is ≤30 words', () => {
    expect(wordCount(TOOL_FAILURE_COPY.research_company)).toBeLessThanOrEqual(30);
  });
  it('get_case_study copy is ≤30 words', () => {
    expect(wordCount(TOOL_FAILURE_COPY.get_case_study)).toBeLessThanOrEqual(30);
  });
  it('design_metric_framework copy is ≤30 words', () => {
    expect(wordCount(TOOL_FAILURE_COPY.design_metric_framework)).toBeLessThanOrEqual(30);
  });

  it('contains no apology vocabulary', () => {
    const banned = /sorry|apologi|unfortunately/i;
    for (const v of Object.values(TOOL_FAILURE_COPY)) {
      expect(v).not.toMatch(banned);
    }
  });

  it('research_company redirects to "background"', () => {
    expect(TOOL_FAILURE_COPY.research_company).toMatch(/background/i);
  });
  it('get_case_study redirects to "PM"', () => {
    expect(TOOL_FAILURE_COPY.get_case_study).toMatch(/PM/);
  });
  it('design_metric_framework redirects to "riff"', () => {
    expect(TOOL_FAILURE_COPY.design_metric_framework).toMatch(/riff/i);
  });
});
