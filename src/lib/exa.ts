// src/lib/exa.ts
// Phase 3 D-B-03 closed: use Exa (researcher decision in 03-RESEARCH.md §1).
// Single import boundary — swapping to Brave later touches only this file.
// 90-day freshness filter (D-B-04) baked into startPublishedDate.
//
// NOTE: prompt-injection-defense content wrapping lives at the tool boundary
// (Plan 03-01's research_company tool execute fn), NOT here. This module is a
// thin client + result-shape mapper.
import Exa from 'exa-js';
import { env } from './env';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export type ExaSearchResult = {
  url: string;
  title: string;
  published_date: string | null;
  text: string;
};

export type ExaSearchResponse =
  | { recent: false; results: [] }
  | { recent: true; results: ExaSearchResult[]; cost_dollars: number };

// Lazy singleton — env.ts already validates EXA_API_KEY at module load,
// but the Exa client constructor runs once on first call.
let _exa: Exa | null = null;
function getExa(): Exa {
  if (!_exa) _exa = new Exa(env.EXA_API_KEY);
  return _exa;
}

export async function researchCompany(
  name: string,
  website?: string,
): Promise<ExaSearchResponse> {
  const ninetyDaysAgo = new Date(Date.now() - NINETY_DAYS_MS).toISOString();
  const query = website ? `${name} (${website})` : name;

  const exa = getExa();
  const res = await exa.searchAndContents(query, {
    type: 'auto', // neural+keyword hybrid
    numResults: 5,
    startPublishedDate: ninetyDaysAgo, // D-B-04 freshness filter
    contents: { text: { maxCharacters: 4000 } },
  });

  if (!res.results.length) {
    return { recent: false, results: [] }; // D-B-04 fallback signal
  }

  return {
    recent: true,
    results: res.results.map(
      (r: { url: string; title?: string | null; publishedDate?: string; text?: string }) => ({
        url: r.url,
        title: r.title ?? '',
        published_date: r.publishedDate ?? null,
        text: r.text ?? '',
      }),
    ),
    cost_dollars: (res as { costDollars?: number }).costDollars ?? 0,
  };
}

// Test-only: lets vitest reset the module singleton between mocked-Exa tests.
export function __resetExaForTests(): void {
  _exa = null;
}
