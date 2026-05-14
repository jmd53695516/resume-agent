// src/app/admin/(authed)/evals/calibrate/page.tsx
//
// Phase 5 Plan 05-09 Task 3 — Monthly calibration page (EVAL-12).
//
// Joe re-rates 10 random recent LLM-judged cases from the last 30 days
// (cat1, cat3, cat4-judge — the categories where a numeric judge_score is
// recorded). On submit, the API computes quadratic-weighted Cohen's kappa
// + Pearson r + mean-absolute-delta + per-category breakdown and writes
// eval_calibrations rows. RESEARCH §11 lines 717-732 specifies the display
// format; threshold for "judge needs replacement" is kappa < 0.5.
//
// Random selection strategy: fetch a candidate pool of recent judged cases
// (50 max), JS Fisher-Yates shuffle, take 10. Supabase JS client doesn't
// expose `ORDER BY random()` without a custom RPC; the in-memory shuffle
// is fine at this volume and avoids a one-off DB function. Pool size cap
// of 50 keeps the query bounded.
//
// Lives under (authed) — parent layout requireAdmin() guards; per-page
// requireAdmin() is D-A-03 belt-and-suspenders.
//
// Freshness: `dynamic = 'force-dynamic'` for fresh per-request SSR. Each
// page load re-shuffles the candidate pool so successive calibrations
// don't rate the same 10 cases unless the pool is small.

import { requireAdmin } from '@/lib/admin-auth';
import NotAuthorized from '../../../components/NotAuthorized';
import { supabaseAdmin } from '@/lib/supabase-server';
import { CalibrateClient, type CalibrationCase } from './CalibrateClient';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const ELIGIBLE_CATEGORIES = ['cat1', 'cat3', 'cat4-judge'] as const;
const POOL_SIZE = 50;
const SAMPLE_SIZE = 10;
const WINDOW_DAYS = 30;

// In-page Fisher-Yates shuffle. Module-private — exported only via the
// page's render output. Uses Math.random which is fine for non-adversarial
// sampling (calibration is Joe vs himself; no incentive to game).
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default async function CalibratePage() {
  const admin = await requireAdmin();
  if (!admin) return <NotAuthorized />;

  // Server Component — Date.now() in render is correct (runs once per request).
  const sinceISO = new Date(
    // eslint-disable-next-line react-hooks/purity
    Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabaseAdmin
    .from('eval_cases')
    .select(
      'id, run_id, category, case_id, prompt, response, judge_score, judge_verdict, judge_rationale, created_at',
    )
    .in('category', [...ELIGIBLE_CATEGORIES])
    .not('judge_score', 'is', null)
    .gte('created_at', sinceISO)
    .order('created_at', { ascending: false })
    .limit(POOL_SIZE);

  if (error) {
    return (
      <div>
        <h1 className="mb-4 text-xl font-semibold">Calibrate</h1>
        <p className="text-sm text-destructive">
          Failed to load eval_cases pool: {error.message}
        </p>
      </div>
    );
  }

  const pool = (data ?? []) as Array<{
    id: string;
    run_id: string;
    category: string;
    case_id: string;
    prompt: string;
    response: string | null;
    judge_score: number | null;
    judge_verdict: 'pass' | 'fail' | null;
    judge_rationale: string | null;
    created_at: string;
  }>;

  const sample = shuffle(pool).slice(0, SAMPLE_SIZE);

  // Map to the client-component shape; coerce judge_score to number (DB
  // stores it as numeric which the JS client deserializes as number, but
  // be defensive in case any row has a stringy value).
  const cases: CalibrationCase[] = sample.map((c) => ({
    eval_case_id: c.id,
    category: c.category,
    case_id: c.case_id,
    prompt: c.prompt,
    response: c.response ?? '(no response)',
    judge_score: Number(c.judge_score),
    judge_verdict: c.judge_verdict,
    judge_rationale: c.judge_rationale,
  }));

  const insufficientPool = cases.length < SAMPLE_SIZE;

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/admin/evals"
          className="text-sm text-[var(--me)] underline-offset-2 hover:underline"
        >
          ← back to runs
        </Link>
      </div>

      <div>
        <h1 className="mb-2 text-xl font-semibold">Calibrate (EVAL-12)</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Re-rate {cases.length} random recent LLM-judged cases on the same
          1-5 Likert scale the judge uses. Submit to compute quadratic-
          weighted Cohen&apos;s kappa (
          <strong>headline drift metric</strong>; recalibration trigger at
          kappa &lt; 0.5) plus Pearson <em>r</em> and per-category breakdown.
          Cases pulled from <code className="font-mono">eval_cases</code>{' '}
          (categories {ELIGIBLE_CATEGORIES.join(', ')}) within the last{' '}
          {WINDOW_DAYS} days.
        </p>
      </div>

      {insufficientPool && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Pool has only {cases.length} eligible cases (need {SAMPLE_SIZE}).
          Run more evals to widen the pool, then return.
        </div>
      )}

      {cases.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No eligible cases in the last {WINDOW_DAYS} days. Run{' '}
          <code className="font-mono">npm run eval</code> to populate the
          pool.
        </p>
      ) : (
        <CalibrateClient cases={cases} />
      )}
    </div>
  );
}
