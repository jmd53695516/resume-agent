// src/lib/eval/storage.ts
// Plan 05-03 Task 2.
// Service-role Supabase writes for eval_runs + eval_cases. RLS bypassed.
// CI runs use this; ad-hoc local runs use this; weekly cron uses this via Plan 05-13.
import { nanoid } from 'nanoid';
import { supabaseAdmin } from '@/lib/supabase-server';
import { childLogger } from '@/lib/logger';
import type { EvalCaseResult, RunSummary } from './types';

const log = childLogger({ event: 'eval_storage' });

export async function createRun(args: {
  targetUrl: string;
  judgeModel: string;
  gitSha: string | undefined;
  scheduled: boolean;
}): Promise<string> {
  const runId = nanoid();
  const { error } = await supabaseAdmin.from('eval_runs').insert({
    id: runId,
    target_url: args.targetUrl,
    judge_model: args.judgeModel,
    git_sha: args.gitSha,
    scheduled: args.scheduled,
    status: 'running',
  });
  if (error) {
    throw new Error(`createRun failed: ${error.message}`);
  }
  log.info({ runId, targetUrl: args.targetUrl, scheduled: args.scheduled }, 'eval_run_created');
  return runId;
}

export async function writeCase(args: { runId: string; result: EvalCaseResult }): Promise<void> {
  const { error } = await supabaseAdmin.from('eval_cases').insert({
    id: nanoid(),
    run_id: args.runId,
    category: args.result.category,
    case_id: args.result.case_id,
    prompt: args.result.prompt,
    response: args.result.response,
    judge_score: args.result.judge_score,
    judge_verdict: args.result.judge_verdict,
    judge_rationale: args.result.judge_rationale,
    passed: args.result.passed,
    cost_cents: args.result.cost_cents,
  });
  if (error) {
    throw new Error(
      `writeCase failed for runId=${args.runId} case=${args.result.case_id}: ${error.message}`,
    );
  }
  log.info(
    { runId: args.runId, category: args.result.category, caseId: args.result.case_id, passed: args.result.passed },
    'eval_case_written',
  );
}

export async function updateRunStatus(args: {
  runId: string;
  summary: Pick<RunSummary, 'totalCases' | 'passed' | 'failed' | 'totalCostCents' | 'status'>;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from('eval_runs')
    .update({
      finished_at: new Date().toISOString(),
      total_cases: args.summary.totalCases,
      passed: args.summary.passed,
      failed: args.summary.failed,
      total_cost_cents: args.summary.totalCostCents,
      status: args.summary.status,
    })
    .eq('id', args.runId);
  if (error) {
    throw new Error(`updateRunStatus failed for runId=${args.runId}: ${error.message}`);
  }
  log.info(
    { runId: args.runId, status: args.summary.status, totalCostCents: args.summary.totalCostCents },
    'eval_run_finalized',
  );
}
