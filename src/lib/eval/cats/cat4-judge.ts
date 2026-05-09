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
import { childLogger } from '@/lib/logger';
import { loadCases } from '@/lib/eval/yaml-loader';
import { writeCase } from '@/lib/eval/storage';
import { judgeVoiceFidelity } from '@/lib/eval/judge';
import { callAgent, mintEvalSession } from '@/lib/eval/agent-client';
import type { CategoryResult, EvalCase, EvalCaseResult } from '@/lib/eval/types';

const log = childLogger({ event: 'eval_cat4_judge' });
const PASS_THRESHOLD = 4.0;
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

export async function runCat4Judge(targetUrl: string, runId: string): Promise<CategoryResult> {
  const yamlPath = path.join(process.cwd(), 'evals', 'cat-04-prompts.yaml');
  const cases: EvalCase[] = await loadCases(yamlPath);
  const voiceSamples = await loadVoiceSamples();
  // Quick task 260509-q00: mint ONE real session per category.
  const sessionId = await mintEvalSession(targetUrl);
  log.info(
    {
      runId,
      caseCount: cases.length,
      voiceSampleCount: voiceSamples.length,
      sessionId,
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
      const passed = avg >= PASS_THRESHOLD;
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
        cost_cents: judge.cost_cents,
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
    aggregateAvg >= PASS_THRESHOLD;

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
  return { category: 'cat4-judge', cases: results, passed, cost_cents: totalCost };
}
