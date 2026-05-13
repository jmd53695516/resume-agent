// scripts/strip-agent-expansion.ts
// Phase 06 Plan 06-02 Task 1 — Haiku 4.5 strip pass over LLM about-me source.
// Per CONTEXT OQ-02: Haiku-assisted draft + Joe review (cost ~5-10¢ saves ~30-45 min Joe-time).
//
// 2026-05-13 (Plan 06-02 execution): script extended per Joe's design review
// before code-write:
//   1. Optional --resume flag includes consolidated-resume.md as additional
//      ground-truth context so Haiku honors its self-flagged caveats
//      ($85M projected not realized; $45M unverified; Master degree verify;
//      don't overstate direct people management).
//   2. stripPreamble() post-processor catches rule-8 drift (Haiku sometimes
//      prefaces output with "Here is the stripped version:" etc despite the
//      explicit instruction; strip anything before the first '#' heading).
//   3. One-shot call (no double-shot diff) — matches plan's locked cost expectation.
//   4. max_tokens bumped 4096 → 8192 since 933-line source stripped at ~50% is
//      borderline at 4096.
//
// Pattern reference: src/lib/classifier.ts (one-shot @anthropic-ai/sdk Haiku call;
// model='claude-haiku-4-5'). Direct-run guard: scripts/generate-fallback.ts (WR-06
// pattern). Argv: scripts/run-evals.ts (node:util.parseArgs strict mode).

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SYSTEM_PROMPT = `You are a fact-checker stripping an LLM-written about-me file down to its verified claims.

INPUT: the LLM-written file + a per-claim disposition matrix (keep / strip / verify-with-joe). If a consolidated-resume file is provided, treat it as additional ground-truth context with self-flagged caveats you MUST honor.

RULES:
1. REMOVE any sentence containing a claim marked "strip" in the matrix.
2. REMOVE adjective stacks. Banned words: transformative, innovative, leveraged, dynamic, robust, seamless, synergy, holistic, passionate, delve, elevate.
3. REMOVE observer-voice projections. Banned openers: "Joe seems", "Joe appears", "Joe likely", "Joe is energized by" (unless transcript explicitly supports).
4. REMOVE filler. Banned phrases: "Great question", "I'd be happy to", "Of course", "At its core", "It's important to note", "Indeed".
5. PRESERVE every claim marked "keep". Do not reword. Do not "improve". Voice rewrite is a later, separate pass.
6. PRESERVE first-person framing only where the source already has it ("I led", "I shipped"); do not flip third-person sentences to first-person — that's voice rewrite's job.
7. PRESERVE structural section headings if present (## About me, ## Recent work, etc.).
8. OUTPUT ONLY the stripped markdown text. No commentary. No preamble. No "Here is the stripped version:".
9. HONOR consolidated-resume caveats if provided: $85M pricing is PROJECTED (5 fiscal years), not realized; $45M product-dev/vendor savings is "visibility into projected or identified cost reductions" unless verified; Master of Supply Chain Management is unverified — strip the credential if it appears in the source; don't overstate direct people management beyond documented examples (mentored 3 senior analysts at Gap; promoted 2 analysts at UA; coordinated 30 global teammates at UA Planning).

You are NOT writing in Joe's voice. You are stripping the LLM's voice. The output should read like rough scaffolding — that's correct.`;

interface CliArgs {
  source: string;
  matrix: string;
  resume: string | undefined;
  out: string;
  dryRun: boolean;
}

export function parseStripArgs(argv: string[]): CliArgs {
  const { values } = parseArgs({
    args: argv,
    options: {
      source: { type: 'string', default: 'docs/transcripts/06-about-me/llm-about-me.md' },
      matrix: { type: 'string', default: '.planning/phases/06-kb-enrichment-about-me-hardening/06-01-CLAIM-MATRIX.md' },
      resume: { type: 'string' },
      out: { type: 'string', default: 'docs/transcripts/06-about-me/llm-about-me.stripped.md' },
      'dry-run': { type: 'boolean', default: false },
    },
    strict: true,
  });
  return {
    source: values.source as string,
    matrix: values.matrix as string,
    resume: values.resume as string | undefined,
    out: values.out as string,
    dryRun: values['dry-run'] as boolean,
  };
}

/**
 * Strip any preamble before the first markdown heading. Defends against rule-8
 * violations where Haiku adds "Here is the stripped version:" or similar
 * commentary before the actual output. Looks for the first line starting with
 * 1-6 `#` followed by whitespace; if found > 0 chars in, slices from there.
 */
export function stripPreamble(haikuOutput: string): string {
  const firstHeadingIdx = haikuOutput.search(/^#{1,6}\s/m);
  if (firstHeadingIdx > 0) {
    return haikuOutput.slice(firstHeadingIdx);
  }
  return haikuOutput;
}

export async function strip(
  source: string,
  matrix: string,
  resume: string | undefined,
  apiKey: string,
): Promise<{ text: string; usage: { input_tokens: number; output_tokens: number } }> {
  const sourceText = readFileSync(source, 'utf-8');
  const matrixText = readFileSync(matrix, 'utf-8');
  const resumeText = resume ? readFileSync(resume, 'utf-8') : '';

  const client = new Anthropic({ apiKey });

  const userPromptParts: string[] = [
    '## Per-claim disposition matrix (authoritative source-of-truth for keep/strip decisions):',
    '',
    matrixText,
    '',
  ];

  if (resumeText) {
    userPromptParts.push(
      '## Consolidated resume (additional ground-truth context; honor its self-flagged caveats per rule 9):',
      '',
      resumeText,
      '',
    );
  }

  userPromptParts.push(
    '## LLM-written source to strip:',
    '',
    sourceText,
  );

  const userPrompt = userPromptParts.join('\n');

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find((c: { type: string }) => c.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Haiku returned no text content');
  }

  const rawText = (textBlock as { type: 'text'; text: string }).text;
  const cleaned = stripPreamble(rawText);

  return {
    text: cleaned,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}

async function main(): Promise<void> {
  const args = parseStripArgs(process.argv.slice(2));
  if (!existsSync(args.source)) {
    console.error(`source not found: ${args.source}`);
    process.exit(2);
  }
  if (!existsSync(args.matrix)) {
    console.error(`matrix not found: ${args.matrix}`);
    process.exit(2);
  }
  if (args.resume && !existsSync(args.resume)) {
    console.error(`resume not found: ${args.resume}`);
    process.exit(2);
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY required');
    process.exit(2);
  }

  const result = await strip(args.source, args.matrix, args.resume, apiKey);

  const inputCents = (result.usage.input_tokens / 1_000_000) * 80;
  const outputCents = (result.usage.output_tokens / 1_000_000) * 400;
  const totalCents = inputCents + outputCents;

  if (args.dryRun) {
    process.stdout.write(result.text);
  } else {
    writeFileSync(args.out, result.text, 'utf-8');
    console.log(`wrote ${args.out} (${result.text.length} chars)`);
  }
  console.log(
    `cost: input=${result.usage.input_tokens}tok output=${result.usage.output_tokens}tok ` +
    `≈ ${totalCents.toFixed(2)}¢`,
  );
}

// Direct-run guard (WR-06 pattern from scripts/generate-fallback.ts).
const __filename = fileURLToPath(import.meta.url);
const __argvScript = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (__filename === __argvScript) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
