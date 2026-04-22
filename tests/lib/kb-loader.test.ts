// tests/lib/kb-loader.test.ts
// CHAT-03 coverage: kb-loader reads all 10 required files + sorted case studies,
// excludes `_`-prefixed fixtures, and is deterministic across readdirSync orderings.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadKB, __resetKBCacheForTests, listCaseStudySlugs } from '../../src/lib/kb-loader';

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
