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

  it('JUDGE_MODEL_SNAPSHOT is the literal pinned snapshot ID (Pitfall 4)', async () => {
    const mod = await import('@/lib/eval-models');
    expect(mod.JUDGE_MODEL_SNAPSHOT).toBe('gemini-2.5-flash-preview-09-2025');
  });

  it('JUDGE_MODEL falls back to JUDGE_MODEL_SNAPSHOT when EVAL_JUDGE_MODEL is unset', async () => {
    vi.stubEnv('EVAL_JUDGE_MODEL', '');
    const mod = await import('@/lib/eval-models');
    expect(mod.JUDGE_MODEL).toBe(mod.JUDGE_MODEL_SNAPSHOT);
  });

  it('JUDGE_MODEL reads EVAL_JUDGE_MODEL env override at module load', async () => {
    vi.stubEnv('EVAL_JUDGE_MODEL', 'gemini-2.5-pro');
    const mod = await import('@/lib/eval-models');
    expect(mod.JUDGE_MODEL).toBe('gemini-2.5-pro');
  });

  it('JUDGE_PROVIDER is the literal "google"', async () => {
    const mod = await import('@/lib/eval-models');
    expect(mod.JUDGE_PROVIDER).toBe('google');
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
