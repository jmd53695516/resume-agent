// src/lib/kb-loader.ts
// Cold-start KB read + module-scope memoization.
// Order is load-bearing — changing it invalidates every session's cache prefix on deploy.
// Source: RESEARCH.md Pattern 1 + CONTEXT.md D-E-05 + CONTEXT.md specifics (fixture exclusion).
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import yaml from 'js-yaml';

const KB_ROOT = path.join(process.cwd(), 'kb');

// Normalize source bytes so Windows checkouts and Linux deploys produce
// byte-identical system prompts (Anthropic prompt-cache requirement):
//   - strip a UTF-8 BOM that some editors prepend
//   - convert CRLF -> LF
// Defense in depth alongside .gitattributes (eol=lf at the working-tree
// boundary). REVIEW WR-01.
function normalizeKBContent(raw: string): string {
  return raw.replace(/^﻿/, '').replace(/\r\n/g, '\n');
}

// Order is load-bearing (determines byte sequence of cached block).
const FILE_ORDER: readonly string[] = [
  'profile.yml',
  'resume.md',
  'linkedin.md',
  'github.md',
  'about_me.md',
  'management_philosophy.md',
  'voice.md',
  'stances.md',
  'faq.md',
  'guardrails.md',
];

let cached: string | null = null;

export function loadKB(): string {
  if (cached !== null) return cached;

  const parts: string[] = [];

  for (const rel of FILE_ORDER) {
    const abs = path.join(KB_ROOT, rel);
    const raw = normalizeKBContent(readFileSync(abs, 'utf-8'));
    if (rel.endsWith('.yml')) {
      const parsed = yaml.load(raw);
      parts.push(`<!-- kb: ${path.basename(rel, '.yml')} -->\n${JSON.stringify(parsed, null, 2)}`);
    } else {
      const { data, content } = matter(raw);
      const slug = path.basename(rel, '.md');
      const meta = Object.keys(data).length ? `<!-- meta: ${JSON.stringify(data)} -->\n` : '';
      parts.push(`<!-- kb: ${slug} -->\n${meta}${content.trim()}`);
    }
  }

  // Case studies: deterministic lexicographic sort; exclude files starting with `_`.
  // (CONTEXT.md specifics: fixture files under `_` are readable via getCaseStudy() for tests
  //  but NOT included in the production KB concatenation.)
  const caseDir = path.join(KB_ROOT, 'case_studies');
  const caseFiles = readdirSync(caseDir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .sort();

  for (const f of caseFiles) {
    const raw = normalizeKBContent(readFileSync(path.join(caseDir, f), 'utf-8'));
    const { data, content } = matter(raw);
    const slug = (typeof data.slug === 'string' && data.slug) || path.basename(f, '.md');
    parts.push(
      `<!-- kb: case_study/${slug} -->\n<!-- meta: ${JSON.stringify(data)} -->\n${content.trim()}`,
    );
  }

  cached = parts.join('\n\n');
  return cached;
}

// Test-only: lets vitest reset the cache between test runs.
export function __resetKBCacheForTests(): void {
  cached = null;
}

// Test-only: expose the normalization logic so determinism behavior
// can be unit-tested without disk fixtures.
export const __normalizeKBContentForTests = normalizeKBContent;

// Also exported for Phase 3's get_case_study tool — lists case studies
// (excluding `_`-prefixed fixtures) WITHOUT re-reading the filesystem.
// Phase 1 scope is just to expose the contract; Phase 3 implements the full tool.
export function listCaseStudySlugs(): string[] {
  const caseDir = path.join(KB_ROOT, 'case_studies');
  return readdirSync(caseDir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .map((f) => path.basename(f, '.md'))
    .sort();
}
