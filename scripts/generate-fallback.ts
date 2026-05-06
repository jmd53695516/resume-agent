// scripts/generate-fallback.ts
// BUILD-TIME ONLY. Reads kb/{about_me,profile,resume}.md → writes
// src/generated/fallback.ts with static constants the plain-HTML fallback page
// imports. D-G-03: NEVER read at request time; build-only is the discipline lock
// (avoids cascading failure where a Supabase outage breaks the fallback).
//
// Run by `npm run prebuild` (tsx scripts/generate-fallback.ts).
//
// W5 fix: extractFirstParagraph + extractLastNRoles are exported pure functions
// at top-level so tests/scripts/generate-fallback.test.ts can unit-test them
// directly (without spawning tsx via execSync). The main() function is guarded
// behind an explicit GENERATE_FALLBACK_RUN env flag so plain `import` from
// tests does not trigger the script body.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import yaml from 'js-yaml';

const REPO_ROOT = process.cwd();
const KB = path.join(REPO_ROOT, 'kb');
const OUT_DIR = path.join(REPO_ROOT, 'src/generated');
const OUT_FILE = path.join(OUT_DIR, 'fallback.ts');

function fail(msg: string): never {
  console.error(`generate-fallback: ${msg}`);
  process.exit(1);
}

function readSafe(p: string): string {
  if (!existsSync(p)) fail(`missing ${path.relative(REPO_ROOT, p)}`);
  return readFileSync(p, 'utf-8').replace(/\r\n/g, '\n');
}

type ProfileShape = {
  links?: { linkedin?: string; github?: string };
  contact?: { email_for_recruiters?: string };
};

export type Role = { title: string; company: string; dates: string };

// W5: exported pure fn — tested directly in tests/scripts/generate-fallback.test.ts.
export function extractFirstParagraph(content: string, minLen = 100): string {
  // Skip frontmatter (already stripped by gray-matter), find first paragraph >minLen chars.
  const paras = content.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const first = paras.find((p) => p.length >= minLen);
  return first ?? paras[0] ?? '';
}

// W5: exported pure fn — tested with at least 2 fixture resume shapes
// (current real format AND a degenerate format) so a regression in resume.md
// format produces a deterministic test failure.
//
// kb/resume.md format (the canonical shape this regex targets):
//   ### Company Name — Location
//
//   **Role Title** — Date Range
//
//   - bullet ...
//
// Degenerate (failure-mode) format documented by fixture B in tests:
//   **Role** at Company (dates)   — no H3 company heading; produces 0 roles.
export function extractLastNRoles(resumeMd: string, n: number): Role[] {
  const lines = resumeMd.split('\n');
  const roles: Role[] = [];

  for (let i = 0; i < lines.length; i++) {
    const headingMatch = lines[i].match(/^###\s+(.+)/);
    if (!headingMatch) continue;

    // Company name is everything before the first em/en/hyphen-dash separator
    // in the H3 line. "Nimbl Digital — Berwyn, PA" → "Nimbl Digital".
    const headingText = headingMatch[1].trim();
    const company = headingText.split(/\s+[—–-]\s+/)[0].trim();
    if (!company) continue;

    // Look ahead 1-5 lines for the role line: **Role** — Dates (or **Role** -- Dates).
    let title = '';
    let dates = '';
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const roleMatch = lines[j].match(/^\*\*([^*]+?)\*\*\s*[—–-]\s*(.+)$/);
      if (roleMatch) {
        title = roleMatch[1].trim();
        dates = roleMatch[2].trim();
        break;
      }
    }

    // Only push roles where we successfully extracted both title and dates.
    // Companies without a recognizable **Role** line are skipped (e.g., the
    // "Earlier Experience" section in kb/resume.md uses a flat list, not H3 + bold).
    if (title && dates) {
      roles.push({ title, company, dates });
    }
  }

  // Resume is reverse-chronological (most recent first). Take the first N.
  return roles.slice(0, n);
}

function main() {
  const aboutRaw = readSafe(path.join(KB, 'about_me.md'));
  const aboutContent = matter(aboutRaw).content.trim();
  // Skip top-level # heading (e.g. "# About Me") so the bio starts with the
  // first real paragraph.
  const bioSource = aboutContent.replace(/^#[^\n]*\n+/, '');
  const bio = extractFirstParagraph(bioSource);

  const profileRaw = readSafe(path.join(KB, 'profile.yml'));
  const profile = (yaml.load(profileRaw) ?? {}) as ProfileShape;
  const linkedin = profile.links?.linkedin ?? '';
  const github = profile.links?.github ?? '';
  const email = profile.contact?.email_for_recruiters ?? 'joe.dollinger@gmail.com';

  const resumeRaw = readSafe(path.join(KB, 'resume.md'));
  const resumeContent = matter(resumeRaw).content;
  const roles = extractLastNRoles(resumeContent, 3);

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const generated = `// AUTO-GENERATED at build time by scripts/generate-fallback.ts. Do not edit.
// Regenerate via: npm run build (prebuild hook) or: tsx scripts/generate-fallback.ts
// Sources: kb/about_me.md, kb/profile.yml, kb/resume.md.

export const FALLBACK_BIO = ${JSON.stringify(bio)};
export const FALLBACK_LINKEDIN = ${JSON.stringify(linkedin)};
export const FALLBACK_GITHUB = ${JSON.stringify(github)};
export const FALLBACK_EMAIL = ${JSON.stringify(email)};
export const FALLBACK_ROLES: ReadonlyArray<{ title: string; company: string; dates: string }> = ${JSON.stringify(roles, null, 2)};
`;

  writeFileSync(OUT_FILE, generated, 'utf-8');
  console.log(`generate-fallback: wrote ${path.relative(REPO_ROOT, OUT_FILE)}`);
}

// Run main() only when invoked as a script. Importing from tests must NOT
// trigger main() (which would crash if cwd lacks kb fixtures or fail-exit
// poisons the test process). The explicit env flag is the simplest, most
// portable guard across tsx ESM and CJS runtimes.
if (process.env.GENERATE_FALLBACK_RUN === '1') {
  main();
} else if (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  /generate-fallback\.ts$/.test(process.argv[1])
) {
  // Direct invocation `tsx scripts/generate-fallback.ts` — argv[1] ends with
  // the script path. This makes manual runs work without setting the env flag.
  main();
}
