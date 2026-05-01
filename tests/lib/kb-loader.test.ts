// tests/lib/kb-loader.test.ts
// CHAT-03 coverage: kb-loader reads all 10 required files + sorted case studies,
// excludes `_`-prefixed fixtures, and is deterministic across readdirSync orderings.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadKB,
  __resetKBCacheForTests,
  __normalizeKBContentForTests,
  listCaseStudySlugs,
  getCaseStudy,
} from '../../src/lib/kb-loader';

describe('loadKB', () => {
  beforeEach(() => {
    __resetKBCacheForTests();
  });

  it('contains a section marker for each of the 10 required top-level files', () => {
    const kb = loadKB();
    const expectedMarkers = [
      '<!-- kb: profile -->',
      '<!-- kb: resume -->',
      '<!-- kb: linkedin -->',
      '<!-- kb: github -->',
      '<!-- kb: about_me -->',
      '<!-- kb: management_philosophy -->',
      '<!-- kb: voice -->',
      '<!-- kb: stances -->',
      '<!-- kb: faq -->',
      '<!-- kb: guardrails -->',
    ];
    for (const marker of expectedMarkers) {
      expect(kb).toContain(marker);
    }
  });

  it('is memoized (second call returns same reference)', () => {
    const a = loadKB();
    const b = loadKB();
    expect(a === b).toBe(true); // identity equality — memoization proof
  });

  it('produces byte-identical output after cache reset', () => {
    const before = loadKB();
    __resetKBCacheForTests();
    const after = loadKB();
    expect(after).toBe(before); // value equality
  });

  it('excludes `_`-prefixed case-study fixtures from KB output', () => {
    const kb = loadKB();
    expect(kb).not.toContain('<!-- kb: case_study/_fixture_for_tests -->');
  });

  it('listCaseStudySlugs excludes `_`-prefixed fixtures', () => {
    const slugs = listCaseStudySlugs();
    expect(slugs).not.toContain('_fixture_for_tests');
    // No real case studies exist in Phase 1 scaffold; Plan 04 populates them.
    // This test stays valid because the filter is what we're asserting.
  });

  it('profile.yml is parsed and emitted as formatted JSON', () => {
    const kb = loadKB();
    // The placeholder has name: "Joe Dollinger"
    expect(kb).toMatch(/<!-- kb: profile -->[\s\S]*"name": "Joe Dollinger"/);
  });
});

describe('normalizeKBContent (REVIEW WR-01)', () => {
  it('strips a leading UTF-8 BOM', () => {
    expect(__normalizeKBContentForTests('﻿# Hello\n')).toBe('# Hello\n');
  });

  it('converts CRLF line endings to LF', () => {
    expect(__normalizeKBContentForTests('a\r\nb\r\nc')).toBe('a\nb\nc');
  });

  it('handles BOM + CRLF together', () => {
    expect(__normalizeKBContentForTests('﻿a\r\nb')).toBe('a\nb');
  });

  it('is a no-op on already-normalized content (LF, no BOM)', () => {
    const lf = '# Hello\nworld\n';
    expect(__normalizeKBContentForTests(lf)).toBe(lf);
  });

  it('does not strip BOM-like characters that appear mid-content', () => {
    // Only a leading BOM should be stripped; a U+FEFF later in the string is left.
    const mid = 'before﻿after';
    expect(__normalizeKBContentForTests(mid)).toBe(mid);
  });
});

describe('getCaseStudy', () => {
  it('returns structured record for a real slug', () => {
    const cs = getCaseStudy('cortex-ai-client-win');
    expect(cs).not.toBeNull();
    expect(cs!.slug).toBe('cortex-ai-client-win');
    expect(cs!.content.length).toBeGreaterThan(100);
    expect(typeof cs!.frontmatter).toBe('object');
    // Frontmatter from cortex-ai-client-win.md has known keys
    expect(cs!.frontmatter.slug).toBe('cortex-ai-client-win');
    expect(typeof cs!.frontmatter.hook).toBe('string');
  });

  it('returns null for unknown slug', () => {
    expect(getCaseStudy('does-not-exist-xyz')).toBeNull();
  });

  it('returns null for fixture-prefixed slug', () => {
    // _fixture_for_tests.md exists on disk but must NOT be returned by
    // getCaseStudy (matches the loadKB exclusion rule for `_`-prefixed files).
    expect(getCaseStudy('_fixture_for_tests')).toBeNull();
  });

  it('returns null for path-traversal attempts', () => {
    expect(getCaseStudy('../../../etc/passwd')).toBeNull();
    expect(getCaseStudy('foo/bar')).toBeNull();
    expect(getCaseStudy('UPPERCASE')).toBeNull();
    expect(getCaseStudy('with spaces')).toBeNull();
    expect(getCaseStudy('../sibling')).toBeNull();
  });

  it('content is CRLF-normalized', () => {
    const cs = getCaseStudy('cortex-ai-client-win');
    expect(cs).not.toBeNull();
    expect(cs!.content).not.toMatch(/\r\n/);
  });
});
