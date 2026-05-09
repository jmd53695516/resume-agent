// src/lib/eval-models.test.ts
// Phase 5 Plan 05-02 Task 3 — pinned-constant + env-override coverage.
// Module-load constants require vi.stubEnv + dynamic import after vi.resetModules
// to re-read process.env on each test (Phase 3 pattern from STATE.md).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('eval-models constants', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('JUDGE_MODEL_SNAPSHOT is the pinned dated Anthropic Haiku 4.5 snapshot', async () => {
    // Quick task 260509-r39: judge swapped from Gemini 2.5 Flash to Claude
    // Haiku 4.5. Anthropic publishes numbered dated snapshots — restoring
    // Pitfall 4 reproducibility (Gemini 2.5-flash family does not).
    const mod = await import('@/lib/eval-models');
    expect(mod.JUDGE_MODEL_SNAPSHOT).toBe('claude-haiku-4-5-20251001');
  });

  it('JUDGE_MODEL falls back to JUDGE_MODEL_SNAPSHOT when EVAL_JUDGE_MODEL is unset', async () => {
    vi.stubEnv('EVAL_JUDGE_MODEL', '');
    const mod = await import('@/lib/eval-models');
    expect(mod.JUDGE_MODEL).toBe(mod.JUDGE_MODEL_SNAPSHOT);
  });

  it('JUDGE_MODEL reads EVAL_JUDGE_MODEL env override at module load', async () => {
    // Stub a plausible alternate Anthropic model id (alias) — keeps the
    // override-mechanism test honest after the quick task 260509-r39 swap.
    vi.stubEnv('EVAL_JUDGE_MODEL', 'claude-haiku-4-5');
    const mod = await import('@/lib/eval-models');
    expect(mod.JUDGE_MODEL).toBe('claude-haiku-4-5');
  });

  it('JUDGE_PROVIDER is the literal "anthropic"', async () => {
    const mod = await import('@/lib/eval-models');
    expect(mod.JUDGE_PROVIDER).toBe('anthropic');
  });

  it('EVAL_COST_WARN_USD defaults to 1.50 (orchestrator-locked)', async () => {
    vi.stubEnv('EVAL_COST_WARN_USD', '');
    const mod = await import('@/lib/eval-models');
    expect(mod.EVAL_COST_WARN_USD).toBe(1.5);
  });

  it('EVAL_COST_WARN_USD parses EVAL_COST_WARN_USD env override as float', async () => {
    vi.stubEnv('EVAL_COST_WARN_USD', '2.00');
    const mod = await import('@/lib/eval-models');
    expect(mod.EVAL_COST_WARN_USD).toBe(2.0);
  });

  it('EVAL_COST_WARN_USD ignores non-numeric override and falls back to 1.50', async () => {
    vi.stubEnv('EVAL_COST_WARN_USD', 'not-a-number');
    const mod = await import('@/lib/eval-models');
    expect(mod.EVAL_COST_WARN_USD).toBe(1.5);
  });

  it('EVAL_COST_WARN_USD ignores zero/negative override and falls back to 1.50', async () => {
    vi.stubEnv('EVAL_COST_WARN_USD', '0');
    const mod = await import('@/lib/eval-models');
    expect(mod.EVAL_COST_WARN_USD).toBe(1.5);
  });
});
