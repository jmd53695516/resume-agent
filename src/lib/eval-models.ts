// src/lib/eval-models.ts
// Phase 5 Plan 05-02. Source-of-truth constants for the eval harness.
// RESEARCH §1: Gemini 2.5 Flash chosen over GPT-4.1-mini for reliable
// structured output (response_format: json_schema) via @ai-sdk/google.
// RESEARCH Pitfall 4: pin to a snapshot ID, not the alias — bumping
// JUDGE_MODEL_SNAPSHOT requires a deliberate PR (auditable in git history).
// Cost-warn threshold = $1.50 (orchestrator-locked override of CONTEXT D-A-07's
// $1.00; RESEARCH §6 cost model: cold-cache runs hit ~$1.30, $1.00 false-warns).

export const JUDGE_PROVIDER = 'google' as const;
export const JUDGE_MODEL_SNAPSHOT = 'gemini-2.5-flash-preview-09-2025';
// Use || (not ??) so empty-string env values also fall back. CI / dotenv often
// emits empty strings for unset optional vars, and treating '' as "unset" matches
// the EVAL_COST_WARN_USD truthy-check below.
export const JUDGE_MODEL = process.env.EVAL_JUDGE_MODEL || JUDGE_MODEL_SNAPSHOT;

export const EVAL_COST_WARN_USD: number = (() => {
  const override = process.env.EVAL_COST_WARN_USD;
  if (!override) return 1.5;
  const parsed = Number.parseFloat(override);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1.5;
})();
