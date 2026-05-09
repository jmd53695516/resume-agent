// src/lib/eval/fabrication.ts
// Phase 5 Plan 05-04 Task 1.
//
// Cat 1 deterministic name-token check (RESEARCH §15). Hybrid with LLM judge:
// both must pass for a cat 1 case to pass (15/15 zero-tolerance).
//
// Algorithm:
//   1. Tokenize response (preserve intra-word apostrophes + hyphens; strip periods)
//   2. Filter to "proper-noun-shape" candidates (capitalized + ≥3 chars + not a stopword)
//   3. Strip trailing 's (possessive — Pitfall 5)
//   4. Membership check against allow-list (lowercased)
//   5. Output unverifiedTokens + verdict
import { readFile } from 'node:fs/promises';
import yaml from 'js-yaml';
import path from 'node:path';

/** English-only stopword set; LOCKED v1 (RESEARCH Open Question 3). */
export const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where', 'how',
  'why', 'what', 'who', 'whom', 'which', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'doing', 'will', 'would', 'shall',
  'should', 'may', 'might', 'must', 'can', 'could', 'i', 'you', 'he', 'she', 'it',
  'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our',
  'their', 'this', 'that', 'these', 'those', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'about', 'as', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'over', 'under', 'again', 'further', 'once', 'because', 'just',
  'so', 'than', 'too', 'very', 'also', 'even', 'still', 'now', 'here', 'there',
  'always', 'never', 'sometimes', 'often', 'all', 'any', 'both', 'each', 'few', 'more',
  'most', 'some', 'no', 'not', 'only', 'own', 'same', 'such', 'one', 'two', 'first',
  'last', 'next', 'good', 'bad', 'great', 'new', 'old', 'big', 'small',
]);

/** Tokenize text per RESEARCH §15 — preserves intra-word ' and - and Latin-1 chars. */
export function tokenizeNames(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\-À-ſ\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && /[a-z]/.test(t));
}

/** Strip trailing possessive 's (Pitfall 5). */
function stripPossessive(token: string): string {
  return token.endsWith("'s") ? token.slice(0, -2) : token;
}

/** Filter to "proper-noun-shape" candidates: capitalized in original casing + NOT a stopword. */
function isProperNounShape(originalToken: string): boolean {
  if (originalToken.length < 3) return false;
  const lower = originalToken.toLowerCase();
  const stripped = stripPossessive(lower);
  if (STOPWORDS.has(stripped)) return false;
  // Original casing must start with uppercase letter (Latin-1 supplement included)
  return /^[A-ZÀ-Þ]/.test(originalToken);
}

export interface AllowlistResult {
  unverifiedTokens: string[];
  verdict: 'pass' | 'flag-for-llm-judge';
}

/**
 * Check a response's proper-noun-shape tokens against the allow-list.
 * Returns 'pass' iff every flagged candidate is in the allow-list (case-insensitive).
 */
export function checkAllowlist(response: string, allowlist: string[]): AllowlistResult {
  // Tokenize from original (case-preserving) for shape detection.
  const originalTokens = response
    .replace(/[^A-Za-z0-9'\-À-ſ\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  const allowSet = new Set(allowlist.map((t) => t.toLowerCase()));
  const unverified: string[] = [];

  for (const orig of originalTokens) {
    if (!isProperNounShape(orig)) continue;
    const stripped = stripPossessive(orig.toLowerCase());
    if (!allowSet.has(stripped)) {
      unverified.push(stripped);
    }
  }

  return {
    unverifiedTokens: Array.from(new Set(unverified)),
    verdict: unverified.length === 0 ? 'pass' : 'flag-for-llm-judge',
  };
}

/** Load `name_token_allowlist` array from kb/profile.yml. */
export async function loadAllowlist(): Promise<string[]> {
  const filepath = path.join(process.cwd(), 'kb', 'profile.yml');
  const raw = await readFile(filepath, 'utf8');
  const parsed = yaml.load(raw) as { name_token_allowlist?: string[] } | null;
  if (!parsed || !parsed.name_token_allowlist || !Array.isArray(parsed.name_token_allowlist)) {
    throw new Error('kb/profile.yml: name_token_allowlist key missing or not an array');
  }
  return parsed.name_token_allowlist;
}
