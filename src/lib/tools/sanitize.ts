// src/lib/tools/sanitize.ts
// TOOL-09 / D-B-06: wrap fetched third-party content in <fetched-content> tags
// before passing back to the model. Defense-in-depth alongside the system-prompt
// FETCHED_CONTENT_RULE (Plan 03-01 Task 5). Sonnet — instructed by that rule —
// treats anything inside the tags as DATA you may quote, never INSTRUCTIONS.
import type { ExaSearchResponse } from '@/lib/exa';

export function wrapFetchedContent(resp: ExaSearchResponse): ExaSearchResponse {
  if (!resp.recent) return resp;
  return {
    recent: true,
    results: resp.results.map((r) => ({
      url: r.url,
      title: r.title,
      published_date: r.published_date,
      text: `<fetched-content>\n${r.text}\n</fetched-content>`,
    })),
    cost_dollars: resp.cost_dollars,
  };
}
