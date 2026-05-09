// src/lib/eval-models.ts
// Phase 5 Plan 05-02. Source-of-truth constants for the eval harness.
// RESEARCH §1: Gemini 2.5 Flash chosen over GPT-4.1-mini for reliable
// structured output (response_format: json_schema) via @ai-sdk/google.
//
// RESEARCH Pitfall 4 GAP (2026-05-09 quick task 260509-q00 finding): the
// originally-pinned snapshot `gemini-2.5-flash-preview-09-2025` was a preview
// model that graduated into the stable alias and is no longer in the public
// catalog (Gemini API returns "model not found"). The 2.5-flash family does
// NOT publish numbered snapshots like Sonnet/Haiku do — only the alias. So
// "snapshot pin" reduces to the alias here; Google may rotate underlying
// weights without notice, breaking the deliberate-PR audit trail Pitfall 4
// requested. Plan 05-12 launch checklist must reconsider whether the
// reproducibility gap is acceptable, or swap the judge to Claude Haiku 4.5
// (`claude-haiku-4-5-20251001` — stable, dated, $1/$5 per MTok).
//
// Cost-warn threshold = $1.50 (orchestrator-locked override of CONTEXT D-A-07's
// $1.00; RESEARCH §6 cost model: cold-cache runs hit ~$1.30, $1.00 false-warns).

export const JUDGE_PROVIDER = 'google' as const;
export const JUDGE_MODEL_SNAPSHOT = 'gemini-2.5-flash';
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
