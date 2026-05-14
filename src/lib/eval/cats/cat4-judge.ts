// src/lib/eval/cats/cat4-judge.ts
// Phase 5 Plan 05-06 Task 3.
//
// Cat 4 LLM-judge half (EVAL-06). 5 prompts × 5-dim Likert per RESEARCH §14:
//   diction / hedge_density / sentence_rhythm / concreteness / filler_absence.
// judgeVoiceFidelity returns the 5 dims + a precomputed average + rationale.
//
// Pass logic is two-gate (per cat-04-voice.yaml pass_threshold):
//   per-case: judge.verdict.average >= 4.0
//   category: results.every(c => c.passed) AND aggregate-avg >= 4.0
// Either gate failing fails the whole category. The aggregate gate is the one
// that protects against "4 great + 1 dismal" passing on per-case strict-mode
// alone (it can't, because per-case gate already catches it), AND also against
// "5 cases all 4.05 each but tagged pass" — defense-in-depth.
//
// Plan 05-07 implements the blind-A/B half (separate runner, not part of this
// CLI; reuses the same evals/cat-04-prompts.yaml as single source of truth).
//
// Voice-sample loader heuristic: parse kb/voice.md into paragraphs separated
// by blank lines, filter to Joe-voice content (60-600 chars, ≥2 sentences,
// not a header / source-attribution / HTML-comment / hr line). Cap at 8.
// Refined past plan's example to skip `<!--` blocks and `*Source:` lines —
// without that, the seeded voice.md leaks attribution metadata into the judge
// prompt.
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import yaml from 'js-yaml';
import { childLogger } from '@/lib/logger';
import { loadCases } from '@/lib/eval/yaml-loader';
import { writeCase } from '@/lib/eval/storage';
import { judgeVoiceFidelity } from '@/lib/eval/judge';
import { callAgent, mintEvalSession } from '@/lib/eval/agent-client';
import type { CategoryResult, EvalCase, EvalCaseResult } from '@/lib/eval/types';

const log = childLogger({ event: 'eval_cat4_judge' });
const MAX_VOICE_SAMPLES = 8;

/**
 * Load Joe-voice excerpts from kb/voice.md.
 *
 * Splits on blank lines, then filters to blocks that look like voice samples:
 *   - 60-600 chars (long enough to have voice signature; short enough to fit budget)
 *   - >= 2 sentence terminators (.|!|?)
 *   - not headers (#), not horizontal rules (---), not HTML comments (<!--),
 *     not italic source attributions (*Source:)
 * Caps the result at MAX_VOICE_SAMPLES (8).
 */
export async function loadVoiceSamples(): Promise<string[]> {
  const filepath = path.join(process.cwd(), 'kb', 'voice.md');
  const content = await readFile(filepath, 'utf8');
  const blocks = content
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => {
      if (b.length < 60 || b.length > 600) return false;
      if (b.startsWith('#')) return false;
      if (b.startsWith('---')) return false;
      if (b.startsWith('<!--')) return false;
      if (b.startsWith('*Source:')) return false;
      const sentenceTerminators = (b.match(/[.!?]/g) ?? []).length;
      if (sentenceTerminators < 2) return false;
      return true;
    });
  return blocks.slice(0, MAX_VOICE_SAMPLES);
}

/**
 * Read cat4 pass thresholds from `evals/cat-04-voice.yaml`.
 *
 * Per Phase 999.1 D-01c (2026-05-14): the YAML `pass_threshold` block is the
 * single source of truth. The runner previously hardcoded a top-of-file
 * threshold constant AND the YAML also declared `per_case_min_avg: 4.0` —
 * two copies that silently drifted (the runner ignored the YAML). This
 * helper closes the drift class so future calibration adjusts thresholds
 * via YAML only.
 *
 * Throws if the YAML is missing either key — fail loudly, never silently
 * default to 4.0 (which would re-create the original drift). See
 * .planning/phases/999.1-cat4-prompt-003-cold-cache-borderline-ness-fix/999.1-RESEARCH.md
 * §OQ-3.
 */
export async function loadCat4Config(): Promise<{
  passThreshold: number;
  aggregateThreshold: number;
}> {
  const filepath = path.join(process.cwd(), 'evals', 'cat-04-voice.yaml');
  const raw = await readFile(filepath, 'utf8');
  const parsed = yaml.load(raw) as
    | {
        pass_threshold?: {
          per_case_min_avg?: number;
          aggregate_min_avg?: number;
        };
      }
    | null
    | undefined;
  const perCase = parsed?.pass_threshold?.per_case_min_avg;
  const aggregate = parsed?.pass_threshold?.aggregate_min_avg;
  if (typeof perCase !== 'number' || typeof aggregate !== 'number') {
    throw new Error(
      'cat-04-voice.yaml missing pass_threshold.per_case_min_avg or pass_threshold.aggregate_min_avg',
    );
  }
  return { passThreshold: perCase, aggregateThreshold: aggregate };
}

/**
 * Warm the Anthropic prompt-cache for the Sonnet 4.6 main-agent path that
 * cat4 cases exercise. The cat4-prompt-003 cold-cache flake (Phase 6 N=7
 * variance map: 5/7 PASS; today's PR #6 cold-cache fail agg 4.12 vs warm-
 * rerun pass agg 4.40 on identical code 47a6f25) traces to Sonnet 4.6 cold-
 * cache responses on stance-elicitation being ~0.3 less concrete than warm-
 * cache responses on the 5-dim Likert.
 *
 * Strategy: issue ONE throwaway POST to /api/chat against the same
 * targetUrl the cases will hit. The system prompt (~85k tokens) is well
 * above the 1024-token Sonnet 4.6 minimum cache block, so a single
 * completed call writes the cache; the 5 cat4 cases that follow within
 * ~75 seconds will hit a warm cache (default 5-min TTL — well above the
 * cat4 wall-clock of ~75s per Plan 06-06 verification log).
 *
 * COST-REPORTING ISOLATION: this function MUST NOT increment runCat4Judge's
 * local cost accumulator. eval_runs.total_cost_cents is computed by
 * scripts/run-evals.ts:262 as the sum of each runner's returned
 * CategoryResult.cost_cents — which is rounded from that accumulator inside
 * runCat4Judge. Warmup tokens are paid by Anthropic billing but invisible
 * to the eval_runs cost row. This is the desired posture per
 * Phase 999.1 CONTEXT OQ-1 + threat T-999.1-01.
 *
 * PROMPT TEXT: "Tell me one thing about your background." — a benign
 * on-domain prompt the classifier (gate 6 in /api/chat) passes to Sonnet
 * rather than short-circuiting via deflectionResponse(). A shorter string
 * like "warmup ping" risks being classified `offtopic` and skipping
 * Sonnet entirely, in which case the cache would not warm. See
 * .planning/phases/999.1-cat4-prompt-003-cold-cache-borderline-ness-fix/999.1-RESEARCH.md
 * §OQ-2 + Pitfall 1.
 *
 * BEST-EFFORT: a failed warmup MUST NOT fail the cat4 run. We catch all
 * errors, log warn, and proceed. If the warmup silently fails, the 5
 * cases run cold-cache and the threshold relaxation (per_case >= 3.8) is
 * defense-in-depth that should still let the run pass on aggregate.
 */
async function warmupSonnetCache(
  targetUrl: string,
  sessionId: string,
): Promise<void> {
  try {
    const res = await fetch(`${targetUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        messages: [
          {
            id: 'eval-warmup-1',
            role: 'user',
            parts: [
              {
                type: 'text',
                text: 'Tell me one thing about your background.',
              },
            ],
          },
        ],
      }),
    });
    // Drain the response body so the underlying fetch promise resolves and
    // the connection can be released. We don't care about the content.
    await res.text();
    log.info(
      { sessionId, status: res.status },
      'cat4_warmup_complete',
    );
  } catch (err) {
    // Best-effort. Log and proceed; the case loop will run (possibly
    // cold-cache) and the relaxed per_case threshold (3.8) is the safety
    // net.
    log.warn(
      { err: (err as Error).message },
      'cat4_warmup_failed_proceeding_anyway',
    );
  }
}

export async function runCat4Judge(targetUrl: string, runId: string): Promise<CategoryResult> {
  const yamlPath = path.join(process.cwd(), 'evals', 'cat-04-prompts.yaml');
  const cases: EvalCase[] = await loadCases(yamlPath);
  const voiceSamples = await loadVoiceSamples();
  // Phase 999.1 D-01c: YAML-driven thresholds (per_case 3.8 / aggregate 4.0).
  const { passThreshold, aggregateThreshold } = await loadCat4Config();
  // Quick task 260509-q00: mint ONE real session per category.
  const sessionId = await mintEvalSession(targetUrl);
  // Phase 999.1 D-01d: warm Sonnet prompt-cache once before the case loop so
  // cat4-prompt-003 cold-cache borderline-ness stops flaking CI. Best-effort
  // — failure logs and proceeds. Cost-isolated by construction
  // (warmupSonnetCache never touches the local cost accumulator).
  await warmupSonnetCache(targetUrl, sessionId);
  log.info(
    {
      runId,
      caseCount: cases.length,
      voiceSampleCount: voiceSamples.length,
      sessionId,
      thresholds: { passThreshold, aggregateThreshold },
    },
    'cat4_judge_started',
  );

  const results: EvalCaseResult[] = [];
  let totalCost = 0;
  let aggregateSum = 0;
  let aggregateCount = 0;

  for (const c of cases) {
    try {
      const { response } = await callAgent({
        targetUrl,
        prompt: c.prompt,
        sessionId,
      });
      const judge = await judgeVoiceFidelity({
        response,
        voiceSamples,
        caseId: c.case_id,
      });
      const avg = judge.verdict.average;
      const passed = avg >= passThreshold;
      totalCost += judge.cost_cents;
      aggregateSum += avg;
      aggregateCount += 1;

      const result: EvalCaseResult = {
        case_id: c.case_id,
        category: 'cat4-judge',
        prompt: c.prompt,
        response,
        judge_score: avg,
        judge_verdict: passed ? 'pass' : 'fail',
        judge_rationale: JSON.stringify(judge.verdict),
        passed,
        // Round at persistence boundary (deferred-items.md item #5).
        cost_cents: Math.round(judge.cost_cents),
      };
      await writeCase({ runId, result });
      results.push(result);
    } catch (e) {
      const result: EvalCaseResult = {
        case_id: c.case_id,
        category: 'cat4-judge',
        prompt: c.prompt,
        response: null,
        judge_score: null,
        judge_verdict: null,
        judge_rationale: `error: ${(e as Error).message}`,
        passed: false,
        cost_cents: 0,
      };
      await writeCase({ runId, result });
      results.push(result);
      log.error(
        { runId, caseId: c.case_id, err: (e as Error).message },
        'cat4_judge_case_error',
      );
    }
  }

  // Two-gate pass: every per-case pass AND aggregate-avg >= threshold.
  // Aggregate computed only over cases that produced a verdict (not errors).
  const aggregateAvg = aggregateCount > 0 ? aggregateSum / aggregateCount : 0;
  const passed =
    results.length > 0 &&
    results.every((r) => r.passed) &&
    aggregateAvg >= aggregateThreshold;

  log.info(
    {
      runId,
      total: results.length,
      per_case_passed: results.filter((r) => r.passed).length,
      aggregate_avg: aggregateAvg.toFixed(2),
      category_passed: passed,
      totalCost,
    },
    'cat4_judge_complete',
  );
  return { category: 'cat4-judge', cases: results, passed, cost_cents: Math.round(totalCost) };
}
