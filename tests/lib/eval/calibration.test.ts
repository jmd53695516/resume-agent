// tests/lib/eval/calibration.test.ts
//
// Phase 5 Plan 05-09 Task 1 — TDD coverage for calibration metrics.
// RESEARCH §11 lines 690-733: quadratic-weighted Cohen's kappa as the
// headline drift metric (recalibration trigger at kappa < 0.5); Pearson r
// kept as a secondary linear-correlation display.
//
// Path correction (Rule 3 — execute-plan.md): plan frontmatter listed
// `src/lib/__tests__/eval/calibration.test.ts` but vitest discovers
// `tests/**/*.test.{ts,tsx}` only. Same correction Plans 05-04..05-08
// documented for their test paths.
import { describe, it, expect } from 'vitest';

import {
  pearsonR,
  quadraticWeightedKappa,
  groupKappaByCategory,
} from '@/lib/eval/calibration';

describe('pearsonR', () => {
  it('returns 1.0 for perfectly correlated arrays', () => {
    // Test 1 — perfect linear: identical sequences => r = 1.0
    const r = pearsonR([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]);
    expect(r).toBeCloseTo(1.0, 6);
  });

  it('returns -1.0 for perfectly inverse arrays', () => {
    // Test 2 — perfect inverse: r = -1.0
    const r = pearsonR([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]);
    expect(r).toBeCloseTo(-1.0, 6);
  });

  it('throws on empty arrays', () => {
    // Test 3 — empty input is undefined behavior; throw is the safe default
    expect(() => pearsonR([], [])).toThrow();
  });

  it('throws on length mismatch', () => {
    expect(() => pearsonR([1, 2, 3], [1, 2])).toThrow();
  });

  it('returns 0 when one variable is constant (zero variance)', () => {
    // Constant array: denominator is 0 → return 0 rather than NaN
    const r = pearsonR([3, 3, 3, 3], [1, 2, 3, 4]);
    expect(r).toBe(0);
  });
});

describe('quadraticWeightedKappa', () => {
  it('returns 1.0 for perfect agreement across a varied distribution', () => {
    // Test 4 — all judge scores match human scores AND there is variance
    // across the distribution. The all-same-score case (e.g., [5,5,5,5,5])
    // is degenerate — denominator collapses to 0 — and returns 0 per the
    // "returns 0 when both raters always give the same single score" test
    // below; that's standard sklearn behavior.
    const k = quadraticWeightedKappa([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]);
    expect(k).toBeCloseTo(1.0, 6);
  });

  it('returns < 1.0 under systematic bias even when Pearson is 1.0', () => {
    // Test 5 — judge is systematically harsh by ~1.5; Pearson would still be
    // perfect (linear relationship preserved) but kappa penalizes the offset.
    // Use bias = 2 so all values stay in [1,5].
    // human=[3,4,5,5,5] judge=[1,2,3,3,3] — perfectly +2 offset.
    const human = [3, 4, 5, 5, 5];
    const judge = [1, 2, 3, 3, 3];
    const r = pearsonR(human, judge);
    const k = quadraticWeightedKappa(human, judge);
    expect(r).toBeCloseTo(1.0, 6);
    expect(k).toBeLessThan(1.0);
    // Per RESEARCH §11: "judge has r=1.0 while being systematically harsh"
    // — kappa should be substantively lower than 1.0.
    expect(k).toBeLessThan(0.95);
  });

  it('rejects mismatched array lengths', () => {
    // Test 6 — defensive guard
    expect(() => quadraticWeightedKappa([1, 2, 3], [1, 2])).toThrow();
  });

  it('rejects empty arrays', () => {
    expect(() => quadraticWeightedKappa([], [])).toThrow();
  });

  it('rejects scores outside [1,N]', () => {
    expect(() => quadraticWeightedKappa([0, 1, 2], [1, 2, 3])).toThrow();
    expect(() => quadraticWeightedKappa([1, 2, 6], [1, 2, 3])).toThrow();
  });

  it('handles boundary scores (1 and 5) correctly with N=5', () => {
    // Test 7 — boundary handling: scores that hit both ends of the scale
    // shouldn't throw and should produce a valid kappa in [-1, 1].
    const human = [1, 1, 5, 5, 3];
    const judge = [1, 2, 5, 4, 3];
    const k = quadraticWeightedKappa(human, judge);
    expect(k).toBeGreaterThan(0);
    expect(k).toBeLessThanOrEqual(1.0);
  });

  it('returns 0 when both raters always give the same single score (no disagreement, no variance)', () => {
    // Edge case: degenerate distribution where chance agreement E equals
    // observed agreement O. Numerator and denominator both 0 → return 0.
    const k = quadraticWeightedKappa([3, 3, 3], [3, 3, 3]);
    expect(k).toBe(0);
  });
});

describe('groupKappaByCategory', () => {
  it('groups pairs by category and computes per-category kappa + Pearson', () => {
    // Test 8 — per-category breakdown for the calibrate page display
    // (RESEARCH §11 lines 725-728).
    const pairs = [
      // cat1: perfect agreement
      { category: 'cat1', human: 5, judge: 5 },
      { category: 'cat1', human: 4, judge: 4 },
      { category: 'cat1', human: 3, judge: 3 },
      // cat3: systematic +1 bias by judge
      { category: 'cat3', human: 5, judge: 4 },
      { category: 'cat3', human: 4, judge: 3 },
      { category: 'cat3', human: 3, judge: 2 },
      // cat4-judge: perfect inverse (worst case)
      { category: 'cat4-judge', human: 5, judge: 1 },
      { category: 'cat4-judge', human: 4, judge: 2 },
      { category: 'cat4-judge', human: 3, judge: 3 },
    ];

    const result = groupKappaByCategory(pairs);
    expect(result).toHaveLength(3);

    const byCat = Object.fromEntries(result.map((r) => [r.category, r]));
    expect(byCat.cat1.n).toBe(3);
    expect(byCat.cat3.n).toBe(3);
    expect(byCat['cat4-judge'].n).toBe(3);

    expect(byCat.cat1.kappa).toBeCloseTo(1.0, 6);
    // cat3: judge is 1 point harsh on every case — Pearson stays perfect
    // (linear relationship), kappa should be < 1
    expect(byCat.cat3.pearson).toBeCloseTo(1.0, 6);
    expect(byCat.cat3.kappa).toBeLessThan(1.0);
    // cat4-judge: inverse-ish — Pearson should be negative
    expect(byCat['cat4-judge'].pearson).toBeLessThan(0);
  });

  it('handles single-case categories without crashing', () => {
    // Single-case kappa is undefined (variance is zero); return 0 rather
    // than NaN/throw so the UI can still render the row.
    const pairs = [{ category: 'cat1', human: 4, judge: 5 }];
    const result = groupKappaByCategory(pairs);
    expect(result).toHaveLength(1);
    expect(result[0].n).toBe(1);
    expect(result[0].kappa).toBe(0);
    expect(result[0].pearson).toBe(0);
  });

  it('returns empty array for empty input', () => {
    const result = groupKappaByCategory([]);
    expect(result).toEqual([]);
  });
});
