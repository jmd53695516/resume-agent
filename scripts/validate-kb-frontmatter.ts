// scripts/validate-kb-frontmatter.ts
// Validates every kb/case_studies/*.md (excluding `_`-prefixed fixtures) has required frontmatter.
// Run: npx tsx scripts/validate-kb-frontmatter.ts
// Exits 0 on success, 1 on any validation failure.
// Required fields per design spec §4 case-study template:
//   slug (string, kebab-case, matches filename), hook (string), role (string),
//   timeframe (string), confidential (boolean)
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const CASE_DIR = path.join(process.cwd(), 'kb', 'case_studies');
const REQUIRED_FIELDS = ['slug', 'hook', 'role', 'timeframe', 'confidential'] as const;

type Failure = { file: string; issues: string[] };

function validateFile(file: string): Failure | null {
  const abs = path.join(CASE_DIR, file);
  const raw = readFileSync(abs, 'utf-8');
  const { data } = matter(raw);
  const issues: string[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (!(field in data)) {
      issues.push(`missing required field: ${field}`);
    }
  }

  if (data.slug !== undefined) {
    const expected = path.basename(file, '.md');
    if (data.slug !== expected) {
      issues.push(`slug "${data.slug}" does not match filename "${expected}"`);
    }
    if (typeof data.slug !== 'string' || !/^[a-z0-9-]+$/.test(data.slug)) {
      issues.push(`slug must be kebab-case lowercase ASCII (got: "${data.slug}")`);
    }
  }

  if (data.confidential !== undefined && typeof data.confidential !== 'boolean') {
    issues.push(`confidential must be a boolean (got: ${typeof data.confidential})`);
  }

  for (const field of ['hook', 'role', 'timeframe']) {
    if (data[field] !== undefined && typeof data[field] !== 'string') {
      issues.push(`${field} must be a string`);
    }
  }

  // Minimum word count (≥300 per pre-launch checklist §4). Strip any leading
  // YAML frontmatter block before counting.
  const body = raw.replace(/^\s*---[\s\S]*?---/, '').trim();
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  if (wordCount < 300) {
    issues.push(`content under 300 words (got: ${wordCount})`);
  }

  return issues.length > 0 ? { file, issues } : null;
}

function main() {
  let files: string[];
  try {
    files = readdirSync(CASE_DIR)
      .filter((f) => f.endsWith('.md') && !f.startsWith('_'));
  } catch (err) {
    console.error(`Could not read ${CASE_DIR}:`, err);
    process.exit(1);
  }

  if (files.length === 0) {
    console.error('No case-study files found (excluding _-prefixed fixtures).');
    console.error('Phase 1 requires 4-6 case studies per VOICE-02.');
    console.error('count: 0 (need 4-6)');
    process.exit(1);
  }

  if (files.length < 4 || files.length > 6) {
    console.error(`Expected 4-6 case studies (excluding fixtures); found ${files.length}.`);
    console.error(`count: ${files.length} (need 4-6)`);
    console.error('See VOICE-02 in .planning/REQUIREMENTS.md');
    process.exit(1);
  }

  const failures: Failure[] = [];
  for (const file of files) {
    const fail = validateFile(file);
    if (fail) failures.push(fail);
  }

  if (failures.length > 0) {
    console.error('Frontmatter validation FAILED:');
    for (const { file, issues } of failures) {
      console.error(`  ${file}:`);
      for (const issue of issues) console.error(`    - ${issue}`);
    }
    process.exit(1);
  }

  console.log(`OK: ${files.length} case studies validated.`);
  for (const f of files) console.log(`  - ${f}`);
}

main();
