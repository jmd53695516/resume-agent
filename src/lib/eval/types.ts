// src/lib/eval/types.ts
// Shared types for the eval CLI. Plans 05-04..05-09 implement runners against
// these contracts. Single source of truth for the EvalCase shape (loaded from
// YAML, validated by EvalCaseSchema) and the EvalCaseResult shape (persisted
// to eval_cases table — see supabase/migrations/0003_phase5.sql).
import { z } from 'zod';

// CategorySchema enum MUST stay in sync with the eval_cases.category CHECK
// constraint in 0003_phase5.sql. If you add a category here, add it there too.
export const CategorySchema = z.enum([
  'cat1',
  'cat2',
  'cat3',
  'cat4-judge',
  'cat4-blind-ab',
  'cat5',
  'cat6',
]);
export type Category = z.infer<typeof CategorySchema>;

/** A single YAML-defined eval case loaded from evals/cat-NN-*.yaml. */
export const EvalCaseSchema = z
  .object({
    case_id: z.string().min(1), // e.g., 'cat1-fab-001'
    category: CategorySchema,
    prompt: z.string().min(1),
    expected_pass_criteria: z.string().optional(), // free-text rubric for the judge
    expected_refusal: z.boolean().optional(), // cat 5 abuse cases set this
    ground_truth_facts: z.array(z.string()).optional(), // cat 1: tokens/snippets that must NOT be invented
    tool_expected: z.string().optional(), // cat 2: name of tool that must fire
    max_word_count: z.number().int().optional(),
    tags: z.array(z.string()).optional(),
  })
  .passthrough(); // forward-compat: extra keys are ignored, not rejected
export type EvalCase = z.infer<typeof EvalCaseSchema>;

/** Outcome of a single case. Persisted to eval_cases. */
export interface EvalCaseResult {
  case_id: string;
  category: Category;
  prompt: string;
  response: string | null; // null when network error / agent never replied
  judge_score: number | null; // null when no LLM-judge involved (e.g., cat 6, cat 1 deterministic-only fail)
  judge_verdict: 'pass' | 'fail' | null;
  judge_rationale: string | null;
  passed: boolean; // canonical pass/fail; decision combines deterministic + judge
  cost_cents: number;
}

/** Aggregated category result; produced by per-cat runners. */
export interface CategoryResult {
  category: Category;
  cases: EvalCaseResult[];
  passed: boolean; // all cases passed (cat 1 = 15/15; others = case threshold)
  cost_cents: number;
}

/** Final summary written to eval_runs row at end of run. */
export interface RunSummary {
  runId: string;
  gitSha: string | undefined;
  targetUrl: string;
  judgeModel: string;
  startedAt: Date;
  finishedAt: Date;
  totalCases: number;
  passed: number;
  failed: number;
  totalCostCents: number;
  status: 'passed' | 'failed' | 'error';
  scheduled: boolean;
}
