// src/app/api/admin/evals/calibrate/route.ts
//
// Phase 5 Plan 05-09 Task 3 — Calibration submission endpoint (EVAL-12).
//
// Flow (RESEARCH §11 lines 690-733):
//   1. requireAdmin() guard (D-A-03 two-layer perimeter — Layer 2 at API).
//   2. Validate request body shape with zod (≥1 rating, scores in [1,5]).
//   3. Fetch the corresponding eval_cases rows by id; cross-check that
//      every rated case_id was found (T-05-09-02 — caller can't smuggle
//      ratings for nonexistent cases).
//   4. Insert eval_calibrations rows (one per rating) with delta column
//      (human_score - judge_score) for at-rest analytics.
//   5. Compute quadratic-weighted Cohen's kappa + Pearson r +
//      mean-absolute-delta + per-category breakdown over the (human, judge)
//      pairs.
//   6. Return JSON with all metrics and a recalibrationTriggered flag
//      (kappa < 0.5 per RESEARCH §11 line 733).
//
// Threat mitigations:
// - T-05-09-02 Tampering: zod enforces score range [1,5]; cases-fetch
//   cross-check rejects ratings for unknown eval_case_ids.
// - T-05-09-03 Elevation: requireAdmin() at top.
// - T-05-09-01 Information Disclosure: the request body never contains the
//   judge_score (we look it up server-side from eval_cases) so a tester
//   can't bias the metric by lying about what the judge said.

import { z } from 'zod';
import { nanoid } from 'nanoid';
import { requireAdmin } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import {
  pearsonR,
  quadraticWeightedKappa,
  groupKappaByCategory,
  type CategoryAgreementResult,
} from '@/lib/eval/calibration';
import { childLogger } from '@/lib/logger';

const log = childLogger({ event: 'eval_calibrate_submit' });

const RatingSchema = z.object({
  eval_case_id: z.string().min(1),
  human_score: z.number().int().min(1).max(5),
  notes: z.string().optional(),
});

const BodySchema = z.object({
  ratings: z.array(RatingSchema).min(1),
});

interface SuccessResponse {
  kappa: number;
  pearson: number;
  meanAbsDelta: number;
  perCategory: CategoryAgreementResult[];
  recalibrationTriggered: boolean;
  rowsWritten: number;
}

const RECALIBRATION_THRESHOLD = 0.5;

export async function POST(req: Request): Promise<Response> {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: `body validation failed: ${parsed.error.message}` },
      { status: 400 },
    );
  }

  const ratings = parsed.data.ratings;
  const ids = ratings.map((r) => r.eval_case_id);

  // Fetch the cases. Service-role; bypasses RLS.
  const { data: caseRows, error: fetchError } = await supabaseAdmin
    .from('eval_cases')
    .select('id, category, judge_score, judge_verdict')
    .in('id', ids);

  if (fetchError) {
    log.error(
      { admin: admin.login, error: fetchError.message },
      'eval_calibrate_fetch_failed',
    );
    return Response.json(
      { error: `case lookup failed: ${fetchError.message}` },
      { status: 500 },
    );
  }

  const caseById = new Map<
    string,
    { id: string; category: string; judge_score: number | null; judge_verdict: string | null }
  >();
  for (const c of (caseRows ?? []) as Array<{
    id: string;
    category: string;
    judge_score: number | null;
    judge_verdict: string | null;
  }>) {
    caseById.set(c.id, c);
  }

  // Reject the entire submission if any case is missing or has no
  // judge_score — calibration requires both halves of the pair.
  const missing: string[] = [];
  const noScore: string[] = [];
  for (const id of ids) {
    const c = caseById.get(id);
    if (!c) {
      missing.push(id);
    } else if (c.judge_score === null || c.judge_score === undefined) {
      noScore.push(id);
    }
  }
  if (missing.length > 0) {
    return Response.json(
      { error: `unknown eval_case_ids: ${missing.join(', ')}` },
      { status: 400 },
    );
  }
  if (noScore.length > 0) {
    return Response.json(
      {
        error: `eval_case rows have no judge_score (cannot calibrate): ${noScore.join(', ')}`,
      },
      { status: 400 },
    );
  }

  // Build (human, judge, category) triples in input order so the kappa
  // computation walks paired arrays.
  const pairs = ratings.map((r) => {
    const c = caseById.get(r.eval_case_id)!;
    const judgeScore = Number(c.judge_score);
    return {
      eval_case_id: r.eval_case_id,
      category: c.category,
      human: r.human_score,
      judge: judgeScore,
      delta: r.human_score - judgeScore,
      notes: r.notes ?? null,
    };
  });

  // Insert eval_calibrations rows. Bulk insert; service-role.
  const insertRows = pairs.map((p) => ({
    id: nanoid(),
    eval_case_id: p.eval_case_id,
    judge_score: p.judge,
    human_score: p.human,
    delta: p.delta,
    notes: p.notes,
  }));

  const { error: insertError } = await supabaseAdmin
    .from('eval_calibrations')
    .insert(insertRows);

  if (insertError) {
    log.error(
      { admin: admin.login, error: insertError.message },
      'eval_calibrate_insert_failed',
    );
    return Response.json(
      { error: `eval_calibrations insert failed: ${insertError.message}` },
      { status: 500 },
    );
  }

  // Compute aggregate + per-category metrics.
  const humanScores = pairs.map((p) => p.human);
  const judgeScores = pairs.map((p) => p.judge);
  const kappa = quadraticWeightedKappa(humanScores, judgeScores);
  const pearson = pearsonR(humanScores, judgeScores);
  const meanAbsDelta =
    pairs.reduce((s, p) => s + Math.abs(p.delta), 0) / pairs.length;
  const perCategory = groupKappaByCategory(
    pairs.map((p) => ({ category: p.category, human: p.human, judge: p.judge })),
  );

  const recalibrationTriggered = kappa < RECALIBRATION_THRESHOLD;

  log.info(
    {
      admin: admin.login,
      rowsWritten: insertRows.length,
      kappa: Number(kappa.toFixed(4)),
      pearson: Number(pearson.toFixed(4)),
      meanAbsDelta: Number(meanAbsDelta.toFixed(4)),
      recalibrationTriggered,
    },
    'eval_calibrate_completed',
  );

  const response: SuccessResponse = {
    kappa: Number(kappa.toFixed(2)),
    pearson: Number(pearson.toFixed(2)),
    meanAbsDelta: Number(meanAbsDelta.toFixed(2)),
    perCategory: perCategory.map((c) => ({
      category: c.category,
      n: c.n,
      kappa: Number(c.kappa.toFixed(2)),
      pearson: Number(c.pearson.toFixed(2)),
    })),
    recalibrationTriggered,
    rowsWritten: insertRows.length,
  };
  return Response.json(response);
}
