// src/lib/eval/calibration.ts
//
// Phase 5 Plan 05-09 Task 1 — Calibration metrics (EVAL-12).
//
// Per RESEARCH §11 lines 690-733: quadratic-weighted Cohen's kappa is the
// headline drift metric (recalibration trigger at kappa < 0.5); Pearson r is
// kept as a secondary linear-correlation display. Mean-absolute-delta gives
// a third human-legible angle (e.g., "judge runs slightly harsh — 0.7 off
// on average") and is computed by the API route, not here, since it's a
// trivial reduction over the same pairs.
//
// Why kappa over Pearson — RESEARCH §11 cites "Judge's Verdict"
// (arxiv.org/abs/2510.09738): "A judge can have r=1.0 while being
// systematically harsh by 1.5 points on a 5-point scale." Kappa accounts
// for chance agreement and is sensitive to systematic bias; Pearson is not.
//
// Why QUADRATIC weighting — voice-fidelity scores are ordinal (1-5). Plain
// (unweighted) kappa treats "judge gave 4 when human gave 5" the same as
// "judge gave 1 when human gave 5", which is wrong for ordinal data.
// Quadratic weights penalize larger disagreements quadratically:
//   w[i][j] = 1 - ((i - j) / (N - 1))^2
// Zero-distance disagreement weight = 1 (full agreement), maximum-distance
// weight = 0 (no agreement). Standard implementation, no library needed.
//
// All three exports return finite numbers in expected ranges. Edge cases
// (empty input, length mismatch, scores outside [1,N]) throw rather than
// return NaN/sentinel — fail-loud at the call site beats silent garbage in
// the eval_calibrations table.

export interface CategoryAgreementResult {
  category: string;
  n: number;
  kappa: number;
  pearson: number;
}

/**
 * Pearson correlation coefficient. Returns a number in [-1, 1]. Returns 0
 * when either variable has zero variance (denominator-undefined; would be
 * NaN otherwise). Throws on empty input or length mismatch.
 */
export function pearsonR(x: number[], y: number[]): number {
  if (x.length !== y.length) {
    throw new Error(
      `pearsonR: array length mismatch (x=${x.length} vs y=${y.length})`,
    );
  }
  if (x.length === 0) {
    throw new Error('pearsonR: empty arrays');
  }

  const n = x.length;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  // Zero variance in either variable: relationship is undefined; fall back
  // to 0 rather than NaN so the UI/API can still render a finite number.
  if (den === 0) return 0;
  return num / den;
}

/**
 * Cohen's quadratic weighted kappa for ordinal scores in [1, N]. Defaults to
 * N=5 (the voice-fidelity Likert scale used everywhere in this project).
 * Returns a number that is typically in [-1, 1]; can be slightly outside
 * those bounds in pathological distributions but should not be in practice
 * for this project's score domain.
 *
 * Formula (per RESEARCH §11 reference + Wikipedia "Cohen's kappa"):
 *   1. Build observed-agreement matrix O[i][j] (counts).
 *   2. Build expected-agreement matrix E[i][j] = histH[i] * histJ[j] / N
 *      (chance baseline assuming independent marginals).
 *   3. Build quadratic-weight matrix w[i][j] = 1 - ((i-j)/(N-1))^2
 *      (full agreement weight=1; max-disagreement weight=0).
 *   4. kappa = 1 - sum((1-w) * O) / sum((1-w) * E)
 *      Equivalently: 1 - weighted-disagreement / chance-weighted-disagreement.
 *
 * Edge case: when O[i][j] and E[i][j] are both zero across all (i,j) — i.e.,
 * both raters always gave the same single score — denominator is zero. Spec
 * is undefined; return 0 (consistent with the "no information to disagree
 * about" intuition; standard sklearn behavior under this same edge case).
 */
export function quadraticWeightedKappa(
  humanScores: number[],
  judgeScores: number[],
  N = 5,
): number {
  if (humanScores.length !== judgeScores.length) {
    throw new Error(
      `quadraticWeightedKappa: length mismatch (human=${humanScores.length} judge=${judgeScores.length})`,
    );
  }
  if (humanScores.length === 0) {
    throw new Error('quadraticWeightedKappa: empty arrays');
  }

  const total = humanScores.length;

  // Build observed matrix O[i][j] and the marginal histograms.
  const O: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
  const histH = Array(N).fill(0);
  const histJ = Array(N).fill(0);

  for (let k = 0; k < total; k++) {
    const h = humanScores[k] - 1;
    const j = judgeScores[k] - 1;
    if (h < 0 || h >= N || j < 0 || j >= N) {
      throw new Error(
        `quadraticWeightedKappa: score out of [1,${N}] range — humanScores[${k}]=${humanScores[k]}, judgeScores[${k}]=${judgeScores[k]}`,
      );
    }
    O[h][j] += 1;
    histH[h] += 1;
    histJ[j] += 1;
  }

  // Quadratic weight matrix. Note (1 - w[i][j]) is the *disagreement* weight
  // we use in numerator/denominator below.
  const denomDist = (N - 1) * (N - 1);
  const w: number[][] = Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => 1 - ((i - j) * (i - j)) / denomDist),
  );

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const E = (histH[i] * histJ[j]) / total;
      const disagreementW = 1 - w[i][j];
      numerator += disagreementW * O[i][j];
      denominator += disagreementW * E;
    }
  }

  // Degenerate distribution (e.g., both raters always 3): denominator == 0.
  // Return 0 — there is no chance disagreement to compare to.
  if (denominator === 0) return 0;
  return 1 - numerator / denominator;
}

/**
 * Groups (category, human, judge) triples by category and computes per-
 * category kappa + Pearson. Used by the calibrate page and API route to
 * surface the per-category breakdown alongside the aggregate (RESEARCH §11
 * lines 725-728).
 *
 * Single-case categories return n=1 with kappa=0 and pearson=0 since both
 * metrics are undefined for n<2 (variance is zero). UI can still render
 * the row — typically with a "need more samples" caveat label.
 */
export function groupKappaByCategory(
  pairs: Array<{ category: string; human: number; judge: number }>,
): CategoryAgreementResult[] {
  const groups = new Map<string, { human: number[]; judge: number[] }>();
  for (const p of pairs) {
    if (!groups.has(p.category)) {
      groups.set(p.category, { human: [], judge: [] });
    }
    const g = groups.get(p.category)!;
    g.human.push(p.human);
    g.judge.push(p.judge);
  }
  return Array.from(groups.entries()).map(([category, g]) => ({
    category,
    n: g.human.length,
    kappa: g.human.length > 1 ? quadraticWeightedKappa(g.human, g.judge) : 0,
    pearson: g.human.length > 1 ? pearsonR(g.human, g.judge) : 0,
  }));
}
