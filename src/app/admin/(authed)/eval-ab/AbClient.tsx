'use client';

// src/app/admin/(authed)/eval-ab/AbClient.tsx
//
// Phase 5 Plan 05-08 Task 3 — client component for the Cat 4 blind A/B page.
//
// Manages tester state (10 booleans + role select) and submits to
// /api/admin/eval-ab. Receives ONLY {position, snippet} from the server —
// the `kind` field is not exposed (T-05-08-01 mitigation).
//
// Submit flow:
//   - All 10 snippets must have a pick before Submit enables.
//   - testerRole select: pm | non-pm | other (LAUNCH-04 audit trail).
//   - On submit: POST /api/admin/eval-ab with { sessionId, identifications, testerRole }.
//     identifications[i] = true means tester said snippet[i] is AI.
//   - On success: render the result (pct + passed + runId) in place.

import { useState } from 'react';

interface RenderedSnippet {
  position: number;
  snippet: string;
}

type Pick = 'ai' | 'joe' | null;
type TesterRole = 'pm' | 'non-pm' | 'other';

interface SubmitResult {
  pct: number;
  passed: boolean;
  runId: string;
}

interface SubmitErrorBody {
  error?: string;
}

export function AbClient({
  sessionId,
  snippets,
}: {
  sessionId: string;
  snippets: RenderedSnippet[];
}) {
  const [picks, setPicks] = useState<Pick[]>(
    () => Array(snippets.length).fill(null),
  );
  const [testerRole, setTesterRole] = useState<TesterRole | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allPicked = picks.every((p) => p !== null);
  const roleSelected = testerRole !== '';
  const canSubmit = allPicked && roleSelected && !submitting && result === null;

  function setPick(i: number, value: 'ai' | 'joe') {
    if (result !== null) return; // submitted — frozen
    setPicks((prev) => {
      const next = prev.slice();
      next[i] = value;
      return next;
    });
  }

  async function handleSubmit() {
    if (!allPicked || !roleSelected || submitting || result !== null) return;
    // roleSelected narrows testerRole to TesterRole (non-empty).
    const role: TesterRole = testerRole as TesterRole;
    setSubmitting(true);
    setError(null);

    // Translate 'ai' -> true, 'joe' -> false. allPicked guarantees no nulls.
    const identifications = picks.map((p) => p === 'ai');

    try {
      const res = await fetch('/api/admin/eval-ab', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, identifications, testerRole: role }),
      });

      const body = (await res.json()) as SubmitResult | SubmitErrorBody;

      if (!res.ok) {
        const message =
          'error' in body && body.error
            ? body.error
            : `Submit failed (${res.status})`;
        setError(message);
        return;
      }

      setResult(body as SubmitResult);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (result !== null) {
    return (
      <div className="rounded-lg border border-border bg-muted p-4">
        <h2 className="mb-2 text-lg font-semibold">Submitted</h2>
        <ul className="space-y-1 text-sm">
          <li>
            <strong>identification_pct</strong>: {result.pct.toFixed(2)}{' '}
            ({Math.round(result.pct * 5)}/5 AI snippets correctly identified)
          </li>
          <li>
            <strong>passed</strong>:{' '}
            <span
              className={
                result.passed ? 'text-green-700' : 'text-destructive'
              }
            >
              {result.passed ? 'PASS' : 'FAIL'}
            </span>{' '}
            (threshold: pct &lt; 0.70)
          </li>
          <li>
            <strong>runId</strong>:{' '}
            <code className="font-mono text-xs">{result.runId}</code>
          </li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Row written to eval_runs + eval_cases (category=cat4-blind-ab).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <label htmlFor="tester-role" className="text-sm font-medium">
          Tester role:
        </label>
        <select
          id="tester-role"
          value={testerRole}
          onChange={(e) => setTesterRole(e.target.value as TesterRole | '')}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        >
          <option value="">— select —</option>
          <option value="pm">PM</option>
          <option value="non-pm">Non-PM</option>
          <option value="other">Other</option>
        </select>
      </div>

      <ol className="space-y-4">
        {snippets.map((s, i) => (
          <li
            key={s.position}
            className="rounded-lg border border-border p-4"
          >
            <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Snippet {i + 1} of {snippets.length}
            </div>
            <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed">
              {s.snippet}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPick(i, 'ai')}
                aria-pressed={picks[i] === 'ai'}
                className={
                  picks[i] === 'ai'
                    ? 'rounded-md border border-[var(--me)] bg-[var(--me)] px-3 py-1 text-sm font-semibold text-white'
                    : 'rounded-md border border-border bg-background px-3 py-1 text-sm hover:bg-muted'
                }
              >
                AI
              </button>
              <button
                type="button"
                onClick={() => setPick(i, 'joe')}
                aria-pressed={picks[i] === 'joe'}
                className={
                  picks[i] === 'joe'
                    ? 'rounded-md border border-[var(--me)] bg-[var(--me)] px-3 py-1 text-sm font-semibold text-white'
                    : 'rounded-md border border-border bg-background px-3 py-1 text-sm hover:bg-muted'
                }
              >
                Joe
              </button>
            </div>
          </li>
        ))}
      </ol>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="rounded-md border border-[var(--me)] bg-[var(--me)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
        {!allPicked && (
          <span className="text-xs text-muted-foreground">
            {picks.filter((p) => p === null).length} of {snippets.length}{' '}
            still need a pick
          </span>
        )}
        {allPicked && testerRole === '' && (
          <span className="text-xs text-muted-foreground">
            Select a tester role to enable submit
          </span>
        )}
      </div>
    </div>
  );
}
