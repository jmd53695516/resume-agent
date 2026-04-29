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
import yaml from 'js-yaml';

const CASE_DIR = path.join(process.cwd(), 'kb', 'case_studies');
const PROFILE_YML = path.join(process.cwd(), 'kb', 'profile.yml');
const REQUIRED_FIELDS = ['slug', 'hook', 'role', 'timeframe', 'confidential'] as const;

// Anonymization allow-list pulled from kb/profile.yml at script start.
// When a case study is confidential:true, its role string must not name any
// company from this list. Lets the check stay accurate as Joe's history
// evolves without hardcoding company names in the validator (REVIEW WR-02).
function loadCompanyAllowList(): string[] {
  try {
    const parsed = yaml.load(readFileSync(PROFILE_YML, 'utf-8')) as { companies?: unknown };
    if (Array.isArray(parsed?.companies)) {
      return parsed.companies.filter((c): c is string => typeof c === 'string' && c.length > 0);
    }
  } catch {
    // Missing or unparseable profile.yml: skip the check silently so the
    // validator still runs the rest of its required-field gates.
  }
  return [];
}

const COMPANY_ALLOW_LIST = loadCompanyAllowList();

// Returns the first company name found in `text` (word-boundary, case-insensitive)
// or null if none. Strips leading/trailing non-word chars from each allow-list
// entry so the closing \b boundary fires against names that end in punctuation
// (e.g. "Gap Inc." -> matches "Gap Inc" or "Gap Inc." in role text).
function detectCompanyMention(text: string, companies: string[]): string | null {
  for (const c of companies) {
    const stem = c.replace(/^[^\w]+|[^\w]+$/g, '');
    if (!stem) continue;
    const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(text)) return c;
  }
  return null;
}

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

  // REVIEW WR-02: when confidential:true, role string must not name any company
  // from the profile.yml allow-list. Author-time discipline (per the case-study
  // interview protocol) is not enough — this is the actual gate.
  if (
    data.confidential === true &&
    typeof data.role === 'string' &&
    COMPANY_ALLOW_LIST.length > 0
  ) {
    const hit = detectCompanyMention(data.role, COMPANY_ALLOW_LIST);
    if (hit) {
      issues.push(`role mentions "${hit}" but file is confidential — anonymize role string`);
    }
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
    files = readdirSync(CASE_DIR).filter((f) => f.endsWith('.md') && !f.startsWith('_'));
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
