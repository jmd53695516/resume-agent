// scripts/voice-rewrite.ts
// Phase 06 Plan 06-04 Task 1 — Haiku 4.5 voice rewrite pass.
// Per CONTEXT D-E-02 + OQ-02 pattern: Haiku-assisted draft + Joe review.
// Operates on a passage (stdin or file) and outputs voice-true version (stdout or file).
// kb/voice.md content + canonical voice-true paragraphs from kb/about_me.md are baked
// into the Haiku system prompt as cadence reference.
//
// Pattern reference: scripts/strip-agent-expansion.ts (direct @anthropic-ai/sdk; one-shot
// claude-haiku-4-5; node:util.parseArgs strict; fileURLToPath direct-run guard).
//
// Critical cat1-protection guard in the system prompt: "PRESERVE every factual claim
// verbatim". Without this rule, Haiku will paraphrase numbers and weaken specificity,
// breaking the cat1 ground-truth contract Plan 06-05 / 06-06 verify.
//
// Reusable beyond Plan 06-04: any passage can be piped through this CLI. Phase 7+
// resume.md work (per D-C-04 sequencing) can reuse without modification.

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BANNED_WORDS = [
  'transformative', 'innovative', 'leveraged', 'dynamic', 'robust', 'seamless',
  'synergy', 'holistic', 'passionate', 'delve', 'elevate',
];
const BANNED_PHRASES = [
  'Great question', "I'd be happy to", 'Of course', 'At its core',
  "It's important to note", 'Indeed',
];

export function buildSystemPrompt(voiceMdContent: string, canonicalParagraphs: string): string {
  return `You are rewriting a passage to match Joe Dollinger's voice based on the voice samples below.

ABSOLUTE RULES:
1. PRESERVE every factual claim verbatim. Employer names, dates, role titles, metrics, technologies, team sizes — these are immutable. Do not paraphrase numbers. Do not rephrase company names. Do not soften specifics into vagueness.
2. CHANGE only phrasing: word choice, sentence rhythm, cadence, transitions.
3. Use contractions. Use one-clause sentences. Prefer numbers ("4 months") over words ("several months").
4. Banned words: ${BANNED_WORDS.join(', ')}.
5. Banned phrases: ${BANNED_PHRASES.map((p) => `"${p}"`).join(', ')}, "really" (when modifying adjectives), "very" (when modifying adjectives).
6. No observer voice. Use first person ("I", "we", "my team") throughout — even if the input uses third-person "Joe is..." you MUST flip it to first-person "I am..." / "I" / "my".
7. Take positions. Replace hedges ("could potentially", "may be") with direct claims or explicit "I don't know".
8. OUTPUT ONLY the rewritten passage. No commentary. No preamble.

Voice samples (Joe's actual register — match this cadence):

${voiceMdContent}

Existing voice-true paragraphs from kb/about_me.md (these are the canonical reference; new content should read in this register):

${canonicalParagraphs}`;
}

interface CliArgs {
  input: string;        // path to passage to rewrite, or '-' for stdin
  out: string;          // path to write rewritten output, or '-' for stdout
  voice: string;        // path to kb/voice.md
  canonical: string;    // path to kb/about_me.md (provides reference paragraphs)
}

export function parseRewriteArgs(argv: string[]): CliArgs {
  const { values } = parseArgs({
    args: argv,
    options: {
      input:     { type: 'string', default: '-' },
      out:       { type: 'string', default: '-' },
      voice:     { type: 'string', default: 'kb/voice.md' },
      canonical: { type: 'string', default: 'kb/about_me.md' },
    },
    strict: true,
  });
  return {
    input: values.input as string,
    out: values.out as string,
    voice: values.voice as string,
    canonical: values.canonical as string,
  };
}

export async function rewrite(
  passage: string,
  voicePath: string,
  canonicalPath: string,
  apiKey: string,
): Promise<{ text: string; usage: { input_tokens: number; output_tokens: number } }> {
  const voiceText = readFileSync(voicePath, 'utf-8');
  const canonicalText = readFileSync(canonicalPath, 'utf-8');
  const system = buildSystemPrompt(voiceText, canonicalText);
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content: `Rewrite this passage to match Joe's voice:\n\n${passage}` }],
  });
  const textBlock = response.content.find((c: { type: string }) => c.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Haiku returned no text content');
  }
  return {
    text: (textBlock as { type: 'text'; text: string }).text,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}

async function readInput(input: string): Promise<string> {
  if (input === '-') {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks).toString('utf-8');
  }
  if (!existsSync(input)) throw new Error(`input not found: ${input}`);
  return readFileSync(input, 'utf-8');
}

async function main(): Promise<void> {
  const args = parseRewriteArgs(process.argv.slice(2));
  if (!existsSync(args.voice)) {
    console.error(`voice file not found: ${args.voice}`);
    process.exit(2);
  }
  if (!existsSync(args.canonical)) {
    console.error(`canonical file not found: ${args.canonical}`);
    process.exit(2);
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY required');
    process.exit(2);
  }
  const passage = await readInput(args.input);
  const result = await rewrite(passage, args.voice, args.canonical, apiKey);

  const inputCents = (result.usage.input_tokens / 1_000_000) * 80;
  const outputCents = (result.usage.output_tokens / 1_000_000) * 400;
  const totalCents = inputCents + outputCents;

  if (args.out === '-') {
    process.stdout.write(result.text);
  } else {
    writeFileSync(args.out, result.text, 'utf-8');
    console.log(`wrote ${args.out} (${result.text.length} chars)`);
  }
  console.error(
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
