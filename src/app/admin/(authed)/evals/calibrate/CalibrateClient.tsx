'use client';

// src/app/admin/(authed)/evals/calibrate/CalibrateClient.tsx
//
// Phase 5 Plan 05-09 Task 3 — client form for calibration page.
//
// Renders one card per case showing the prompt + agent response + the
// judge's verdict/score/rationale. Joe selects his own 1-5 score per case;
// optional notes field surfaces qualitative reasoning that gets persisted
// in eval_calibrations.notes.
//
// On submit, POSTs to /api/admin/evals/calibrate. Result panel displays
// kappa + Pearson + meanAbsDelta + per-category breakdown matching the
// RESEARCH §11 lines 717-732 display format.

import { useState } from 'react';

export interface CalibrationCase {
  eval_case_id: string;
  category: string;
  case_id: string;
  prompt: string;
  response: string;
  judge_score: number;
  judge_verdict: 'pass' | 'fail' | null;
  judge_rationale: string | null;
}

interface PerCategoryResult {
  category: string;
  n: number;
  kappa: number;
  pearson: number;
}

interface CalibrationResult {
  kappa: number;
  pearson: number;
  meanAbsDelta: number;
  perCategory: PerCategoryResult[];
  recalibrationTriggered: boolean;
  rowsWritten: number;
}

interface ApiError {
  error: string;
}

const SCORES = [1, 2, 3, 4, 5] as const;

function kappaInterpretation(k: number): string {
  // Per RESEARCH §11 line 733: poor < 0.4; moderate 0.4-0.6;
  // substantial 0.6-0.8; near-perfect > 0.8.
  if (k < 0.4) return 'poor — recalibrate now';
  if (k < 0.5) return 'recalibration trigger (RESEARCH §11)';
  if (k < 0.6) return 'moderate';
  if (k < 0.8) return 'substantial';
  return 'near-perfect';
}

export function CalibrateClient({ cases }: { cases: CalibrationCase[] }) {
  // Each case's human score; null until selected. Notes are optional.
  const [scores, setScores] = useState<Array<number | null>>(
    () => cases.map(() => null),
  );
  const [notes, setNotes] = useState<string[]>(
    () => cases.map(() => ''),
  );
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CalibrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allScored = scores.every((s) => s !== null);

  async function handleSubmit() {
    if (!allScored || submitting) return;
    setSubmitting(true);
    setError(null);

    const ratings = cases.map((c, i) => ({
      eval_case_id: c.eval_case_id,
      human_score: scores[i] as number,
      notes: notes[i].trim() || undefined,
    }));

    try {
      const resp = await fetch('/api/admin/evals/calibrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ratings }),
      });
      if (!resp.ok) {
        const json = (await resp.json().catch(() => ({}))) as ApiError;
        setError(json.error ?? `HTTP ${resp.status}`);
        setSubmitting(false);
        return;
      }
      const json = (await resp.json()) as CalibrationResult;
      setResult(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  // Result rendered: form is frozen, only the result panel + reload-link
  // is shown.
  if (result) {
    return (
      <div className="space-y-4">
        <div
          className={`rounded-lg border p-4 ${
            result.recalibrationTriggered
              ? 'border-red-300 bg-red-50'
              : 'border-green-300 bg-green-50'
          }`}
        >
          <h2 className="mb-3 text-lg font-semibold">
            {result.recalibrationTriggered
              ? 'Recalibration triggered (kappa < 0.5)'
              : 'Calibration complete'}
          </h2>
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Quadratic kappa:</span>{' '}
              <span className="font-mono font-semibold">
                {result.kappa.toFixed(2)}
              </span>{' '}
              <span className="text-xs text-muted-foreground">
                ({kappaInterpretation(result.kappa)})
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Pearson r:</span>{' '}
              <span className="font-mono">{result.pearson.toFixed(2)}</span>{' '}
              <span className="text-xs text-muted-foreground">
                (linear relationship)
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">
                Mean absolute delta:
              </span>{' '}
              <span className="font-mono">
                {result.meanAbsDelta.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Rows written:</span>{' '}
              <span className="font-mono">{result.rowsWritten}</span>
            </div>
          </div>

          {result.perCategory.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold">
                Per-category breakdown
              </h3>
              <ul className="space-y-1 font-mono text-xs">
                {result.perCategory.map((c) => (
                  <li key={c.category}>
                    <span className="inline-block w-32">{c.category}:</span>{' '}
                    kappa={c.kappa.toFixed(2)} ({c.n} cases) — pearson=
                    {c.pearson.toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-sm text-[var(--me)] underline-offset-2 hover:underline"
        >
          Run another calibration (re-shuffle pool)
        </button>
      </div>
    );
  }

  // Form: cases + scores + submit
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
      className="space-y-4"
    >
      {cases.map((c, i) => (
        <fieldset
          key={c.eval_case_id}
          className="rounded-lg border border-border bg-[var(--panel)] p-4"
        >
          <legend className="px-2 text-xs font-semibold text-muted-foreground">
            <span className="font-mono">{c.category}</span> · {c.case_id} ·
            judge_score={c.judge_score}
            {c.judge_verdict && ` · verdict=${c.judge_verdict}`}
          </legend>

          <div className="space-y-3 text-xs">
            <div>
              <div className="mb-1 font-semibold text-muted-foreground">
                Prompt
              </div>
              <pre className="whitespace-pre-wrap break-words rounded bg-muted/50 p-2 font-mono">
                {c.prompt}
              </pre>
            </div>
            <div>
              <div className="mb-1 font-semibold text-muted-foreground">
                Agent response
              </div>
              <pre className="whitespace-pre-wrap break-words rounded bg-muted/50 p-2 font-mono">
                {c.response}
              </pre>
            </div>
            {c.judge_rationale && (
              <details>
                <summary className="cursor-pointer text-muted-foreground">
                  Judge rationale
                </summary>
                <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-muted/50 p-2 font-mono">
                  {c.judge_rationale}
                </pre>
              </details>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Your score (1-5):</span>
            {SCORES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={scores[i] === s}
                onClick={() => {
                  setScores((cur) => {
                    const next = cur.slice();
                    next[i] = s;
                    return next;
                  });
                }}
                className={
                  scores[i] === s
                    ? 'rounded border border-[var(--me)] bg-[var(--me)] px-3 py-1 text-sm font-semibold text-white'
                    : 'rounded border border-border bg-background px-3 py-1 text-sm hover:border-[var(--me)]'
                }
              >
                {s}
              </button>
            ))}
            {scores[i] !== null && (
              <span className="text-xs text-muted-foreground">
                delta = {(scores[i] as number) - c.judge_score}
              </span>
            )}
          </div>

          <div className="mt-3">
            <label className="block text-xs font-semibold text-muted-foreground">
              Notes (optional)
              <textarea
                value={notes[i]}
                onChange={(e) => {
                  const v = e.target.value;
                  setNotes((cur) => {
                    const next = cur.slice();
                    next[i] = v;
                    return next;
                  });
                }}
                rows={2}
                className="mt-1 w-full rounded border border-border bg-background p-2 text-xs font-normal"
                placeholder="e.g., judge over-counted creative liberties as fabrication"
              />
            </label>
          </div>
        </fieldset>
      ))}

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          Submit failed: {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!allScored || submitting}
          className="rounded bg-[var(--me)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting
            ? 'Computing kappa…'
            : `Submit ${cases.length} ratings`}
        </button>
        {!allScored && (
          <span className="text-xs text-muted-foreground">
            Score every case to enable submit (
            {scores.filter((s) => s !== null).length}/{cases.length} done)
          </span>
        )}
      </div>
    </form>
  );
}
