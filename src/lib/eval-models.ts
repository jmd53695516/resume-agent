// src/lib/eval-models.ts
// Phase 5 Plan 05-02. Source-of-truth constants for the eval harness.
//
// Quick task 260509-r39 (2026-05-09): judge swapped from Gemini 2.5 Flash
// (@ai-sdk/google) to Claude Haiku 4.5 (@ai-sdk/anthropic, dated snapshot
// `claude-haiku-4-5-20251001`). Three forces drove the swap, all dissolved
// by Anthropic Haiku:
//   1. Pitfall 4 reproducibility — Gemini 2.5-flash family does not publish
//      numbered snapshots; Haiku 4.5 does (`claude-haiku-4-5-20251001`).
//      Restores the deliberate-PR audit trail.
//   2. Free-tier rate caps — Gemini 5 RPM / 20 RPD made a single 47-case
//      smoke unrunnable; Anthropic tier-1 already provisioned for the main
//      agent.
//   3. Structured-output schema flakiness — ~33% of cat1 cases failed
//      against Gemini 2.5 Flash with "No object generated: response did
//      not match schema"; Anthropic strict tool-use schemas are materially
//      more reliable.
// Pricing: Haiku 4.5 is $1/$5 per MTok (vs Sonnet 4.6 $3/$15 on the chat
// path). Cost extraction uses the dedicated `extractAnthropicJudgeCost`
// in src/lib/eval/cost.ts — distinct from `extractAnthropicCost` (Sonnet).
//
// Cost-warn threshold = $1.50 (orchestrator-locked override of CONTEXT D-A-07's
// $1.00; RESEARCH §6 cost model: cold-cache runs hit ~$1.30, $1.00 false-warns).

export const JUDGE_PROVIDER = 'anthropic' as const;
export const JUDGE_MODEL_SNAPSHOT = 'claude-haiku-4-5-20251001';
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
