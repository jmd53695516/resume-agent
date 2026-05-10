// src/lib/eval/cats/cat1.ts
// Phase 5 Plan 05-04 Task 3.
//
// Cat 1: factual fidelity (EVAL-02). 15/15 zero-tolerance.
// Hybrid: deterministic name-token allow-list (RESEARCH §15) + LLM judge.
// Both must pass for a case to pass.
//
// Per-case flow:
//   1. callAgent → fetch /api/chat against targetUrl, parse SSE stream
//   2. checkAllowlist → tokenize response, flag any non-allowlisted proper nouns
//   3. judgeFactualFidelity → Gemini grades response against ground_truth_facts
//   4. passed = (deterministic.verdict === 'pass') AND (judge.verdict === 'pass')
//   5. writeCase → persist EvalCaseResult to eval_cases
//
// Network/timeout/judge errors are caught per-case; the whole category does
// NOT abort. Failed-case rows still get written (response: null,
// judge_rationale: 'error: ...', passed: false).
import path from 'node:path';
import { childLogger } from '@/lib/logger';
import { loadCases } from '@/lib/eval/yaml-loader';
import { writeCase } from '@/lib/eval/storage';
import { checkAllowlist, loadAllowlist } from '@/lib/eval/fabrication';
import { judgeFactualFidelity } from '@/lib/eval/judge';
import { callAgent, mintEvalSession } from '@/lib/eval/agent-client';
import type { CategoryResult, EvalCase, EvalCaseResult } from '@/lib/eval/types';

const log = childLogger({ event: 'eval_cat1' });

// callAgent is the shared SSE-stream helper from Plan 05-03 Task 4.
// Single source of truth for the streaming-format parser; calibrated against
// .eval-tmp/sample-stream.txt. If the route's stream format ever changes, fix
// it once in src/lib/eval/agent-client.ts; cat runners require no edits.

export async function runCat1(
  targetUrl: string,
  runId: string,
): Promise<CategoryResult> {
  const yamlPath = path.join(process.cwd(), 'evals', 'cat-01-fabrication.yaml');
  const cases: EvalCase[] = await loadCases(yamlPath);
  const allowlist: string[] = await loadAllowlist();
  // Quick task 260509-q00: mint ONE real session per category. /api/chat
  // (BL-17) validates session_id existence in Supabase; synthetic
  // `eval-cli-cat1-<case_id>` strings now bounce with 404. Mint failure here
  // propagates up — one bad mint should fail the run loud, not produce 15
  // silent per-case error rows.
  const sessionId = await mintEvalSession(targetUrl);
  log.info(
    { runId, caseCount: cases.length, allowlistSize: allowlist.length, sessionId },
    'cat1_started',
  );

  const results: EvalCaseResult[] = [];
  let totalCost = 0;

  for (const c of cases) {
    try {
      const { response, deflection } = await callAgent({
        targetUrl,
        prompt: c.prompt,
        sessionId,
      });

      // Phase 05.1 Item #7: skip deflected cases (rate-limit / spend-cap /
      // turn-cap / borderline / classifier deflections). These are
      // environmental signals, not real model responses — feeding them to
      // the judge produces false-positive fabrication detections (e.g.
      // cat1-fab-014 in runId vstFDlWpoKcyGH29w2KKs hit ipLimiter10m mid-run
      // and the judge flagged the canned ratelimit deflection as a
      // fabrication). passed: false with a recognizable rationale prefix
      // so admin queries can filter deflection-noise out of pass-rate
      // calculations (RESEARCH Open Question 1: rationale-prefix convention
      // chosen over schema widening; defer schema decision to Plan 05-12).
      if (deflection !== null) {
        const result: EvalCaseResult = {
          case_id: c.case_id,
          category: 'cat1',
          prompt: c.prompt,
          response,
          judge_score: null,
          judge_verdict: null,
          judge_rationale: `skipped: ${deflection.reason} deflection`,
          passed: false,
          cost_cents: 0,
        };
        await writeCase({ runId, result });
        results.push(result);
        log.warn(
          { runId, caseId: c.case_id, deflectionReason: deflection.reason },
          'cat1_case_skipped_deflection',
        );
        continue;
      }
      // Sonnet usage isn't surfaced via the streaming body; /api/chat persists
      // it server-side. Cat 1 cost is dominated by the judge call.
      const agentCost = 0;

      // Deterministic check (always runs)
      const detResult = checkAllowlist(response, allowlist);

      // LLM judge (always runs per EVAL-02 hybrid — both signals are needed
      // for the 15/15 zero-tolerance gate; deterministic alone is too coarse).
      const judgeOut = await judgeFactualFidelity({
        prompt: c.prompt,
        response,
        groundedFacts: (c.ground_truth_facts as string[] | undefined) ?? [],
        caseId: c.case_id,
      });

      const judgeCost = judgeOut.cost_cents;
      const judgeVerdict: 'pass' | 'fail' = judgeOut.verdict.verdict;
      const judgeScore: number | null = judgeOut.verdict.score;
      const judgeRationale = JSON.stringify({
        llm_judge: judgeOut.verdict,
        deterministic: detResult,
      });

      // Hybrid pass per RESEARCH §15: deterministic clean OR (deterministic
      // flagged AND judge says pass). 'flag-for-llm-judge' is the "needs
      // second opinion" signal — the judge breaks the tie. Pre-fix code
      // (`det === 'pass' AND judge === 'pass'`) short-circuited the hybrid:
      // any response containing non-allowlist English tokens (e.g. "you've",
      // "give") would auto-fail regardless of the judge's verdict, defeating
      // the EVAL-02 contract. Surfaced by smoke runId BJ-ktbmzmyJYp0vW7vpfa
      // (14/15 cases had judge='pass' but failed because det='flag-for-llm-
      // judge'). Note: det.verdict never emits 'fail' — its only outputs are
      // 'pass' (zero unverified tokens) and 'flag-for-llm-judge'.
      const passed =
        detResult.verdict === 'pass' ||
        (detResult.verdict === 'flag-for-llm-judge' && judgeVerdict === 'pass');

      const caseCost = agentCost + judgeCost;
      totalCost += caseCost;

      const result: EvalCaseResult = {
        case_id: c.case_id,
        category: 'cat1',
        prompt: c.prompt,
        response,
        judge_score: judgeScore,
        judge_verdict: judgeVerdict,
        judge_rationale: judgeRationale,
        passed,
        // Round at persistence boundary; totalCost stays fractional internally
        // so 15 × 0.25¢ aggregates to 4¢ rather than 15 × 0 = 0
        // (deferred-items.md item #5).
        cost_cents: Math.round(caseCost),
      };
      await writeCase({ runId, result });
      results.push(result);
    } catch (e) {
      const result: EvalCaseResult = {
        case_id: c.case_id,
        category: 'cat1',
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
        'cat1_case_error',
      );
    }
  }

  const passed = results.every((r) => r.passed);
  log.info(
    {
      runId,
      total: results.length,
      passed: results.filter((r) => r.passed).length,
      totalCost,
    },
    'cat1_complete',
  );
  return { category: 'cat1', cases: results, passed, cost_cents: Math.round(totalCost) };
}
