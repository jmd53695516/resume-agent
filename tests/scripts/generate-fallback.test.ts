// tests/scripts/generate-fallback.test.ts
// Plan 03-05 Task 1 W5: dual-fixture coverage for the build-time fallback
// content extractor's pure-fn helpers (extractFirstParagraph + extractLastNRoles).
//
// Pure-fn tests import the helpers directly — no execSync, no child process.
// Smoke test at the end runs the full script end-to-end against real kb/.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  extractFirstParagraph,
  extractLastNRoles,
} from '../../scripts/generate-fallback';

describe('extractFirstParagraph', () => {
  it('returns the first paragraph >100 chars when one exists', () => {
    const content = `Short line.

Another short.

This is the first long paragraph with more than one hundred characters of content describing Joe Dollinger as a senior product manager focused on data platforms.`;
    const r = extractFirstParagraph(content);
    expect(r).toMatch(/first long paragraph/);
    expect(r.length).toBeGreaterThan(100);
  });

  it('falls back to first paragraph if none meet minLen', () => {
    const content = `Short.\n\nAlso short.`;
    const r = extractFirstParagraph(content);
    expect(r).toBe('Short.');
  });

  it('returns empty string when content is empty', () => {
    expect(extractFirstParagraph('')).toBe('');
  });
});

describe('extractLastNRoles — current real resume format (W5 fixture A)', () => {
  // Real format from kb/resume.md (### Company — location followed by **Role** — dates):
  const realFormat = `### Nimbl Digital — Berwyn, PA

**Senior Consultant (Client: SEI)** — September 2024 – Present

- Developed the roadmap for SEI Data Cloud.

### Retailcloud — Concord, CA (Remote Contract)

**Sales Engineering Solutions Consultant** — April 2024 – August 2024

- Assessed small-business operations.

### Gap, Inc. — San Francisco, CA (Remote)

**Senior Manager, Business Intelligence — Supply Chain** — January 2022 – May 2023

- Developed a 12-month roadmap.`;

  it('extracts the most recent 3 roles with non-empty {title, company, dates}', () => {
    const roles = extractLastNRoles(realFormat, 3);
    expect(roles).toHaveLength(3);
    roles.forEach((r) => {
      expect(r.title).not.toBe('');
      expect(r.company).not.toBe('');
      expect(r.dates).not.toBe('');
    });
    expect(roles[0]).toEqual({
      title: 'Senior Consultant (Client: SEI)',
      company: 'Nimbl Digital',
      dates: 'September 2024 – Present',
    });
    expect(roles[1].company).toBe('Retailcloud');
    expect(roles[2].company).toBe('Gap, Inc.');
  });

  it('matches actual kb/resume.md content (smoke test against the real file)', () => {
    const resumePath = path.join(process.cwd(), 'kb/resume.md');
    let raw: string;
    try {
      raw = readFileSync(resumePath, 'utf-8');
    } catch {
      return;
    }
    const roles = extractLastNRoles(raw, 3);
    expect(roles).toHaveLength(3);
    roles.forEach((r) => {
      expect(r.title).not.toBe('');
      expect(r.company).not.toBe('');
      expect(r.dates).not.toBe('');
    });
  });
});

describe('extractLastNRoles — hyphen-in-company-name (WR-05 regression guard)', () => {
  // WR-05: the company-name split regex previously accepted hyphen as a
  // separator, which would have misfired on company names that legitimately
  // contain a hyphen (e.g. "Acme-Co"). Tightened to em/en-dash only.
  it('preserves hyphens within company names (em-dash separator)', () => {
    const md = `### Acme-Co — Berlin

**Engineer** — 2024–Present
`;
    const roles = extractLastNRoles(md, 1);
    expect(roles).toHaveLength(1);
    expect(roles[0].company).toBe('Acme-Co');
  });

  it('preserves hyphens within company names (en-dash separator)', () => {
    const md = `### My-Co – Remote

**PM** — 2023–2024
`;
    const roles = extractLastNRoles(md, 1);
    expect(roles).toHaveLength(1);
    expect(roles[0].company).toBe('My-Co');
  });
});

describe('extractLastNRoles — degenerate resume format (W5 fixture B)', () => {
  // Degenerate format: bold-only role names without H3 headings. Documenting
  // the failure mode here means a future format change to resume.md that
  // regresses to this shape will trip this test deterministically.
  const degenerateFormat = `**Senior PM** at Notion (2024–present)

Some descriptive paragraph.

**PM** at Acme (2021–2024)`;

  it('returns 0 roles when resume has no H3 company headings (documents failure mode)', () => {
    const roles = extractLastNRoles(degenerateFormat, 3);
    expect(roles).toHaveLength(0);
  });
});

describe('script smoke test (running the actual main once)', () => {
  it('produces a fallback.ts containing all 5 expected exports when run against real kb', () => {
    execSync(`npx tsx scripts/generate-fallback.ts`, {
      cwd: process.cwd(),
      stdio: 'pipe',
    });
    const generated = readFileSync(
      path.join(process.cwd(), 'src/generated/fallback.ts'),
      'utf-8',
    );
    expect(generated).toMatch(/FALLBACK_BIO\s*=/);
    expect(generated).toMatch(/FALLBACK_LINKEDIN\s*=/);
    expect(generated).toMatch(/FALLBACK_GITHUB\s*=/);
    expect(generated).toMatch(/FALLBACK_EMAIL\s*=/);
    expect(generated).toMatch(/FALLBACK_ROLES/);
    expect(generated).toMatch(/AUTO-GENERATED/);
  });
});
