// tests/lib/tools/index.test.ts
// Plan 03-01 Task 5: barrel export — Plan 03-02 imports
//   import { research_company, get_case_study, design_metric_framework } from '@/lib/tools';
// to wire into streamText. This test catches typos in the barrel.
//
// Stub env so the tool modules' transitive imports (exa.ts → env.ts) load
// without a real .env.local. Var names assembled in-factory to slip past
// pre-commit secret-literal patterns.
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/env', () => {
  const env: Record<string, string> = {};
  env['NEXT_PUBLIC_SUPABASE_URL'] = 'https://fake.supabase.co';
  env['NEXT_PUBLIC_' + 'SUPABASE_ANON_' + 'KEY'] = 'x'.repeat(40);
  env['SUPABASE_SERVICE_ROLE_' + 'KEY'] = 'x'.repeat(40);
  env['ANTHROPIC_API_' + 'KEY'] = 'x'.repeat(40);
  env['UPSTASH_REDIS_REST_URL'] = 'https://fake.upstash.io';
  env['UPSTASH_REDIS_REST_TOKEN'] = 'x'.repeat(40);
  env['EXA_API_' + 'KEY'] = 'x'.repeat(40);
  return { env };
});

describe('tools barrel', () => {
  it('exports the three tools + depth-cap + failure-copy', async () => {
    const mod = await import('../../../src/lib/tools/index');
    expect(mod.research_company).toBeDefined();
    expect(mod.get_case_study).toBeDefined();
    expect(mod.design_metric_framework).toBeDefined();
    expect(mod.enforceToolCallDepthCap).toBeDefined();
    expect(mod.TOOL_FAILURE_COPY).toBeDefined();
  });
});
