// src/lib/tools/failure-copy.ts
// D-H-01..02: in-character fallback strings returned by tool.execute() on
// internal failure. Drafted by Claude per voice.md/stances.md register.
// Joe reviews in PR before merge — same flow as Phase 2 deflection copy
// (D-C-01..07). Constraints: ≤30 words each, first-person, no apology tone,
// includes a redirect to what still works.

export const TOOL_FAILURE_COPY = {
  research_company:
    "Research tool's having a moment — couldn't pull fresh signals on them. Ask me about my background instead, or email me directly and I'll come prepared.",
  get_case_study:
    "Couldn't load that case study cleanly. Pick one off the menu, or just ask me anything about how I think about PM — I'd rather riff than read.",
  design_metric_framework:
    "Metric tool tripped. Tell me the goal in one sentence and I'll riff on it the same way I would in an interview — without the formatting.",
} as const;

export type ToolFailureKey = keyof typeof TOOL_FAILURE_COPY;
