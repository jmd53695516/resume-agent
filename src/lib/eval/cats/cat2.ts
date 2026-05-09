// src/lib/eval/cats/cat2.ts
// Phase 5 Plan 05-05 Task 2.
//
// Cat 2: tool-use correctness (EVAL-03) — 9 cases.
// Mostly assertion-based (did the right tool fire? did response shape match?).
// Includes synthetic spend-cap test (EVAL-10) which directly mutates the Redis
// spend counter past threshold (350 cents > 300 trigger) and asserts that
// /api/chat returns DEFLECTIONS.spendcap text without firing a tool. The
// finally block ALWAYS resets the key — original-value-or-delete — so a
// killed process or thrown assertion can't leave the spend-cap stuck on.
//
// **Streaming-format deviation from plan-spec:** the plan's example used
// AI SDK v5 prefix codes (`9:`, `2:`, `a:`) but route.ts uses
// createUIMessageStreamResponse (AI SDK v6) which emits OpenAI-style
// data-prefixed SSE: `data: {"type":"tool-input-available","toolName":"...","input":{...}}`.
// The shared parser in agent-client.ts already handles text-delta extraction;
// this file extends it with a `parseToolCalls` helper that scans for
// tool-input-available events. Calibrated against AI SDK v6 type definitions
// at node_modules/ai/dist/index.d.ts:2056-2064.
import path from 'node:path';
import { childLogger } from '@/lib/logger';
import { redis } from '@/lib/redis';
import { loadCases } from '@/lib/eval/yaml-loader';
import { writeCase } from '@/lib/eval/storage';
import { callAgent, mintEvalSession } from '@/lib/eval/agent-client';
import type { CategoryResult, EvalCase, EvalCaseResult } from '@/lib/eval/types';

const log = childLogger({ event: 'eval_cat2' });

interface ToolCallEvent {
  name: string;
  args: unknown;
}

interface ChatStreamResult {
  responseText: string;
  toolCalls: ToolCallEvent[];
  httpStatus: number;
}

/**
 * Parse tool-input-available events from a raw AI SDK v6 SSE stream body.
 * One ToolCallEvent per tool invocation. Defensive: malformed lines silently
 * skipped; never throws. Calibrated against ai@v6 ToolUIPart type union.
 */
export function parseToolCalls(rawBody: string): ToolCallEvent[] {
  if (!rawBody) return [];
  const calls: ToolCallEvent[] = [];
  for (const line of rawBody.split(/\r?\n/)) {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trimStart();
    if (payload === '' || payload === '[DONE]') continue;
    try {
      const parsed: unknown = JSON.parse(payload);
      if (
        typeof parsed === 'object'
        && parsed !== null
        && (parsed as { type?: unknown }).type === 'tool-input-available'
        && typeof (parsed as { toolName?: unknown }).toolName === 'string'
      ) {
        const tn = (parsed as { toolName: string }).toolName;
        const input = (parsed as { input?: unknown }).input;
        calls.push({ name: tn, args: input });
      }
    } catch {
      // Malformed JSON — skip the line.
    }
  }
  return calls;
}

/**
 * Wrapper around the shared callAgent helper that ALSO returns parsed
 * tool-call events. Cat 2 needs both channels (text for shape assertion,
 * tool-calls for did-the-right-tool-fire assertion).
 */
async function callAgentWithTools(
  targetUrl: string,
  prompt: string,
  sessionId: string,
): Promise<ChatStreamResult> {
  const out = await callAgent({ targetUrl, prompt, sessionId });
  const toolCalls = parseToolCalls(out.rawBody);
  return { responseText: out.response, toolCalls, httpStatus: out.httpStatus };
}

// ---------- Per-tool assertion functions ----------

interface AssertionResult {
  passed: boolean;
  rationale: string;
}

export function assertResearch(_prompt: string, result: ChatStreamResult): AssertionResult {
  const fired = result.toolCalls.some((t) => t.name === 'research_company');
  const paragraphs = result.responseText.split(/\n\n+/).filter((p) => p.trim().length > 30);
  const hasUrls = /https?:\/\/[^\s)]+/.test(result.responseText);
  const passed = fired && paragraphs.length >= 3 && hasUrls;
  return {
    passed,
    rationale: JSON.stringify({ fired, paragraphCount: paragraphs.length, hasUrls }),
  };
}

export function assertCaseStudy(_prompt: string, result: ChatStreamResult): AssertionResult {
  const fired = result.toolCalls.some((t) => t.name === 'get_case_study');
  const wordCount = result.responseText.trim().split(/\s+/).filter(Boolean).length;
  const hasClosingLine = /Want to go deeper, or hear a different story\?/.test(result.responseText);
  const inWordRange = wordCount >= 250 && wordCount <= 600;
  // Edge: unknown slug → tool fires + menu returned (not narration). Heuristic:
  // mentions "case study" / "case-study" / "here are" within a SHORT response (<200 words).
  const isMenuResponse =
    /case stud(y|ies)|here are/i.test(result.responseText) && wordCount < 200;
  const passed = fired && (isMenuResponse || (inWordRange && hasClosingLine));
  return {
    passed,
    rationale: JSON.stringify({ fired, wordCount, hasClosingLine, isMenuResponse }),
  };
}

export function assertMetric(_prompt: string, result: ChatStreamResult): AssertionResult {
  const fired = result.toolCalls.some((t) => t.name === 'design_metric_framework');
  const sections = [
    'north_star',
    'input_metrics',
    'counter_metrics',
    'guardrails',
    'experiment',
    'open_questions',
  ];
  // Normalize to underscore form so " - " / "-" / " " variants all match.
  const normalized = result.responseText.toLowerCase().replace(/[ -]+/g, '_');
  const found = sections.filter((s) => normalized.includes(s));
  const responseHasShape = found.length >= 4;
  const passed = fired && responseHasShape;
  return {
    passed,
    rationale: JSON.stringify({ fired, sectionsFound: found }),
  };
}

export function assertSpendCapDeflection(result: ChatStreamResult): AssertionResult {
  // Deflection text from src/app/api/chat/route.ts DEFLECTIONS.spendcap pattern.
  // Match on "taking a breather" / "back tomorrow" / "email Joe directly" tokens.
  const isDeflection = /taking a breather|back tomorrow|email Joe directly|come back|few hours|spend cap|capacity|rate limit/i.test(
    result.responseText,
  );
  const noToolFired = result.toolCalls.length === 0;
  const passed = isDeflection && noToolFired && result.httpStatus === 200;
  return {
    passed,
    rationale: JSON.stringify({
      isDeflection,
      noToolFired,
      httpStatus: result.httpStatus,
      snippet: result.responseText.slice(0, 200),
    }),
  };
}

// ---------- Runner ----------

export async function runCat2(targetUrl: string, runId: string): Promise<CategoryResult> {
  const yamlPath = path.join(process.cwd(), 'evals', 'cat-02-tools.yaml');
  const cases: EvalCase[] = await loadCases(yamlPath);
  // Quick task 260509-q00: mint ONE real session per category (replaces
  // synthetic eval-cli-cat2-<case_id> strings that BL-17 now rejects).
  const sessionId = await mintEvalSession(targetUrl);
  log.info({ runId, caseCount: cases.length, sessionId }, 'cat2_started');

  const results: EvalCaseResult[] = [];
  let totalCost = 0;
  const today = new Date().toISOString().slice(0, 10);
  const spendKey = `resume-agent:spend:${today}`;

  for (const c of cases) {
    const isSpendCapCase = (c.tags ?? []).includes('spend-cap');
    let assertion: AssertionResult;
    let response: string | null = null;
    let originalSpend: number | null = null;

    if (isSpendCapCase) {
      // Capture original BEFORE we mutate, so finally{} can restore exactly.
      try {
        originalSpend = await redis.get<number>(spendKey);
      } catch (e) {
        log.warn(
          { runId, caseId: c.case_id, err: (e as Error).message },
          'cat2_spendcap_originalread_failed',
        );
        originalSpend = null;
      }
    }

    try {
      if (isSpendCapCase) {
        // EVAL-10 synthetic — set spend past 300-cent threshold.
        await redis.set(spendKey, 350);
        log.info({ runId, caseId: c.case_id, spendKey }, 'cat2_spendcap_synthetic_set');
      }

      const out = await callAgentWithTools(targetUrl, c.prompt, sessionId);
      response = out.responseText;

      if (isSpendCapCase) {
        assertion = assertSpendCapDeflection(out);
      } else if (c.tool_expected === 'research_company') {
        assertion = assertResearch(c.prompt, out);
      } else if (c.tool_expected === 'get_case_study') {
        assertion = assertCaseStudy(c.prompt, out);
      } else if (c.tool_expected === 'design_metric_framework') {
        assertion = assertMetric(c.prompt, out);
      } else {
        assertion = {
          passed: false,
          rationale: `unknown tool_expected: ${String(c.tool_expected)}`,
        };
      }
    } catch (e) {
      assertion = { passed: false, rationale: `error: ${(e as Error).message}` };
      log.error({ runId, caseId: c.case_id, err: (e as Error).message }, 'cat2_case_error');
    } finally {
      // ALWAYS reset the spend-cap synthetic — even on assertion failure or
      // mid-loop throw — so subsequent cases aren't all spend-cap-deflected.
      if (isSpendCapCase) {
        try {
          if (originalSpend != null) {
            await redis.set(spendKey, originalSpend);
          } else {
            await redis.del(spendKey);
          }
          log.info({ runId, caseId: c.case_id }, 'cat2_spendcap_synthetic_reset');
        } catch (e) {
          // T-05-05-01: log-and-continue — do not fail the run for a reset glitch
          log.error(
            { runId, caseId: c.case_id, err: (e as Error).message },
            'cat2_spendcap_reset_failed',
          );
        }
      }
    }

    const result: EvalCaseResult = {
      case_id: c.case_id,
      category: 'cat2',
      prompt: c.prompt,
      response,
      judge_score: null, // assertion-based, no LLM judge
      judge_verdict: assertion.passed ? 'pass' : 'fail',
      judge_rationale: assertion.rationale,
      passed: assertion.passed,
      cost_cents: 0, // agent cost not extracted here; tracked server-side
    };
    await writeCase({ runId, result });
    results.push(result);
  }

  const passed = results.every((r) => r.passed);
  log.info(
    {
      runId,
      total: results.length,
      passed: results.filter((r) => r.passed).length,
      totalCost,
    },
    'cat2_complete',
  );
  return { category: 'cat2', cases: results, passed, cost_cents: totalCost };
}
