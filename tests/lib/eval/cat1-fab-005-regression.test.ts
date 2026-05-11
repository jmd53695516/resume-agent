// tests/lib/eval/cat1-fab-005-regression.test.ts
// Phase 05.1 Item #8 regression guard. Sub-1s prompt-level test that catches
// removal/weakening of the premise-smuggling HALLUCINATION_RULES line OR the
// counter_facts: kb/profile.yml block BEFORE the eval CLI runs cat1.
// Does NOT replace the eval CLI cat1 gate (D-B-01 still mandates 15/15 locally).
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '@/lib/system-prompt';

describe('cat1-fab-005 prompt-level regression guard', () => {
  it('system prompt contains the premise-smuggling rule', () => {
    const p = buildSystemPrompt();
    expect(p).toMatch(/smuggles in a specific quantity/i);
    expect(p).toMatch(/I haven't talked about that specific number/);
  });

  it('system prompt contains the Snowflake-employer counter-fact', () => {
    const p = buildSystemPrompt();
    expect(p).toMatch(/never been employed by Snowflake/i);
  });

  it('system prompt contains the team-size counter-fact', () => {
    const p = buildSystemPrompt();
    // Anchor against the canonical "200" smuggled number + canonical "30" real number.
    expect(p).toMatch(/never managed 200 engineers/i);
    expect(p).toMatch(/30 global teammates/i);
  });
});
