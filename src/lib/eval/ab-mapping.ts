// src/lib/eval/ab-mapping.ts
//
// Phase 5 Plan 05-08 Task 2 — Cat 4 blind A/B server-side mapping (EVAL-05).
//
// RESEARCH §10 prescribes server-side mapping in eval_ab_sessions keyed by an
// HTTP-only cookie. Mapping NEVER reaches the client DOM (T-05-08-01) — only
// {position, snippet} render. The kind ('ai' | 'joe') field stays server-side.
//
// Pass logic (per plan behavior 4 + 4b):
//   identification_pct = correct_AI_picks / 5
//   passed = (pct < 0.70)   — friend-tester worse than 70% AI-identification
//                              means the agent is voice-indistinguishable enough.
//
// The 10-position-overall `correct` count (where tester's true/false on every
// snippet matches its kind) is computed for diagnostic purposes and embedded
// in judge_rationale JSON, but does NOT drive pass/fail.
//
// Trust boundaries (threat model T-05-08-01..06):
//   - createAbSession: server component → eval_ab_sessions write; renderedSnippets
//     omits kind by construction (T-05-08-01)
//   - validateAndScoreAbSession: enforces expires_at + submitted_at (T-05-08-02)
//   - Cookie name `ra_eval_session` set by caller (page.tsx) — NOT here. Pitfall 6
//     prefix isolation handled at the cookie boundary, not the data boundary.

import { nanoid } from 'nanoid';
import { supabaseAdmin } from '@/lib/supabase-server';
import { childLogger } from '@/lib/logger';
import { createRun, updateRunStatus, writeCase } from '@/lib/eval/storage';
import { JUDGE_MODEL } from '@/lib/eval-models';
import type { EvalCaseResult } from '@/lib/eval/types';

const log = childLogger({ event: 'eval_ab' });

/** Server-side mapping element. `kind` MUST NEVER reach the client. */
export interface Snippet {
  kind: 'ai' | 'joe';
  source_id: string;
  snippet: string;
  position: number;
}

/** Client-safe projection of a snippet — strips `kind` and `source_id`. */
export interface RenderedSnippet {
  position: number;
  snippet: string;
}

/**
 * Fisher-Yates in-place shuffle (cloned input). Math.random() suffices for
 * blind A/B order — the threat model treats the tester as honest-but-curious
 * (Joe-supervised per CONTEXT D-B-01); cryptographic shuffle isn't required.
 */
function fisherYatesShuffle<T>(items: T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Create a new blind A/B session. INSERTs the shuffled mapping into
 * eval_ab_sessions and returns:
 *   - sessionId: nanoid PK; the caller MUST set this as the `ra_eval_session`
 *     cookie value (HTTP-only, sameSite=strict, 1h maxAge). The cookie name
 *     uses the `ra_eval_` prefix to avoid collision with `@supabase/ssr`'s
 *     auth cookies (Pitfall 6).
 *   - renderedSnippets: `kind` and `source_id` REMOVED by construction. This
 *     is the array passed to the client component for tester clicks.
 *     T-05-08-01 mitigation: kind stays server-side.
 *
 * Throws on:
 *   - wrong-length inputs (must be exactly 5 + 5)
 *   - supabase insert error
 */
export async function createAbSession(args: {
  agentParagraphs: Array<{ source_id: string; snippet: string }>;
  realJoeExcerpts: Array<{ source_id: string; snippet: string }>;
}): Promise<{ sessionId: string; renderedSnippets: RenderedSnippet[] }> {
  if (args.agentParagraphs.length !== 5 || args.realJoeExcerpts.length !== 5) {
    throw new Error(
      `createAbSession requires exactly 5 agent + 5 real-Joe entries (got ${args.agentParagraphs.length} + ${args.realJoeExcerpts.length})`,
    );
  }

  const all: Snippet[] = [
    ...args.agentParagraphs.map((a) => ({
      kind: 'ai' as const,
      source_id: a.source_id,
      snippet: a.snippet,
      position: 0,
    })),
    ...args.realJoeExcerpts.map((j) => ({
      kind: 'joe' as const,
      source_id: j.source_id,
      snippet: j.snippet,
      position: 0,
    })),
  ];
  const shuffled = fisherYatesShuffle(all).map((s, i) => ({ ...s, position: i }));

  const sessionId = nanoid();
  const { error } = await supabaseAdmin.from('eval_ab_sessions').insert({
    id: sessionId,
    shuffled_snippets: shuffled,
  });
  if (error) {
    throw new Error(`createAbSession failed: ${error.message}`);
  }

  log.info({ sessionId }, 'eval_ab_session_created');

  // Strip `kind` and `source_id` — only {position, snippet} crosses the
  // server/client boundary. T-05-08-01 mitigation enforced by construction.
  const renderedSnippets: RenderedSnippet[] = shuffled.map((s) => ({
    position: s.position,
    snippet: s.snippet,
  }));

  return { sessionId, renderedSnippets };
}

/**
 * Validate the cookie-bound session, score the tester's identifications, and
 * persist a new eval_runs row tagged 'cat4-blind-ab'.
 *
 * Pass logic:
 *   correctAi = count of positions i where mapping[i].kind === 'ai'
 *               AND identifications[i] === true
 *   pct       = correctAi / 5
 *   passed    = pct < 0.70
 *
 * Diagnostic only (NOT pass-affecting):
 *   correct   = count of positions i where identifications[i] === (mapping[i].kind === 'ai')
 *               i.e., overall 10-position correctness. Embedded in judge_rationale JSON.
 *
 * Throws on:
 *   - identifications.length !== 10
 *   - session not found
 *   - session expired (expires_at < now())
 *   - session already submitted
 */
export async function validateAndScoreAbSession(args: {
  sessionId: string;
  identifications: boolean[]; // length 10; true = "I think this is AI"
  testerRole: 'pm' | 'non-pm' | 'other';
  targetUrl: string;
}): Promise<{ pct: number; passed: boolean; runId: string }> {
  if (args.identifications.length !== 10) {
    throw new Error(
      `validateAndScoreAbSession: identifications must have length 10 (got ${args.identifications.length})`,
    );
  }

  const { data, error } = await supabaseAdmin
    .from('eval_ab_sessions')
    .select('shuffled_snippets, expires_at, submitted_at')
    .eq('id', args.sessionId)
    .single();

  if (error || !data) {
    throw new Error(
      `validateAndScoreAbSession: session not found: ${args.sessionId}${
        error ? ` (${error.message})` : ''
      }`,
    );
  }

  const session = data as {
    shuffled_snippets: unknown;
    expires_at: string;
    submitted_at: string | null;
  };

  if (new Date(session.expires_at) < new Date()) {
    throw new Error(`validateAndScoreAbSession: session expired (${args.sessionId})`);
  }
  if (session.submitted_at) {
    throw new Error(
      `validateAndScoreAbSession: session already submitted (${args.sessionId})`,
    );
  }

  const mapping = session.shuffled_snippets as Snippet[];
  if (!Array.isArray(mapping) || mapping.length !== 10) {
    throw new Error(
      `validateAndScoreAbSession: malformed mapping (${args.sessionId})`,
    );
  }

  // Overall 10-position correctness — diagnostic only.
  let correct = 0;
  for (let i = 0; i < 10; i++) {
    if (args.identifications[i] === (mapping[i].kind === 'ai')) {
      correct++;
    }
  }

  // Pass driver: AI-identification rate over 5 AI snippets only.
  let correctAi = 0;
  for (let i = 0; i < 10; i++) {
    if (mapping[i].kind === 'ai' && args.identifications[i] === true) {
      correctAi++;
    }
  }
  const pct = correctAi / 5;
  const passed = pct < 0.70;

  // WR-06 fix: atomically claim the AB session as submitted BEFORE writing
  // the eval_runs row. Previously the order was reversed (createRun →
  // writeCase → updateRunStatus → THEN mark session submitted), so a crash
  // between createRun and the session-marked-submitted UPDATE produced an
  // orphan eval_runs row AND left submitted_at=NULL, allowing the next
  // submission with the same sessionId to re-score and write a duplicate
  // run. Mirrors the claimAndSendSessionEmail pattern (atomic
  // UPDATE...WHERE first_email_sent_at IS NULL).
  //
  // The eval_run_id link is populated in a second update AFTER createRun;
  // a crash between the two leaves a submitted session with a NULL
  // eval_run_id, which is safe to replay (writeCase is idempotent on
  // case_id derived from sessionId).
  const submittedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('eval_ab_sessions')
    .update({
      identifications: args.identifications,
      submitted_at: submittedAt,
      tester_role: args.testerRole,
    })
    .eq('id', args.sessionId)
    .is('submitted_at', null)
    .select('id')
    .single();
  if (claimError || !claimed) {
    // Lost the race or session already submitted. The .single() above will
    // return PGRST116 ("no rows") when the WHERE submitted_at IS NULL
    // condition matches zero rows.
    throw new Error(
      `validateAndScoreAbSession: session already submitted (${args.sessionId})`,
    );
  }

  // Now that we've atomically claimed the session, write the eval_runs row
  // tagged cat4-blind-ab. judge_model is recorded for run-table consistency
  // even though no judge actually fires here — the identification_pct is
  // deterministic.
  const runId = await createRun({
    targetUrl: args.targetUrl,
    judgeModel: JUDGE_MODEL,
    gitSha: undefined,
    scheduled: false,
  });

  const result: EvalCaseResult = {
    case_id: `cat4-blind-ab-${args.sessionId}`,
    category: 'cat4-blind-ab',
    prompt: `(blind A/B; tester_role=${args.testerRole})`,
    response: JSON.stringify({
      identification_pct: pct,
      correct_picks_overall: correct,
    }),
    judge_score: pct,
    judge_verdict: passed ? 'pass' : 'fail',
    judge_rationale: JSON.stringify({
      pct,
      passed,
      correctAi,
      correct,
      testerRole: args.testerRole,
    }),
    passed,
    cost_cents: 0,
  };
  await writeCase({ runId, result });

  await updateRunStatus({
    runId,
    summary: {
      totalCases: 1,
      passed: passed ? 1 : 0,
      failed: passed ? 0 : 1,
      totalCostCents: 0,
      status: passed ? 'passed' : 'failed',
    },
  });

  // Backfill the eval_run_id link on the (already-claimed) session row so the
  // /admin/evals trace can navigate from the session to the run. A crash
  // between the run-write and this update leaves eval_run_id=NULL, which is
  // a documented soft-fail — the run row is still discoverable by
  // case_id=`cat4-blind-ab-${sessionId}`.
  const { error: linkError } = await supabaseAdmin
    .from('eval_ab_sessions')
    .update({ eval_run_id: runId })
    .eq('id', args.sessionId);
  if (linkError) {
    log.warn(
      { sessionId: args.sessionId, runId, error: linkError.message },
      'eval_ab_session_run_link_failed',
    );
  }

  log.info(
    { sessionId: args.sessionId, runId, pct, passed, testerRole: args.testerRole },
    'eval_ab_scored',
  );
  return { pct, passed, runId };
}
