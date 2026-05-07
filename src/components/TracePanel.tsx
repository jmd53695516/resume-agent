'use client';

// src/components/TracePanel.tsx
// Phase 3 (chat) + Phase 4 (admin variant via alwaysExpanded).
//
// Default chat behavior (alwaysExpanded undefined/false): default collapsed,
// chevron toggles, label "See what I did" — preserves Plan 03-03 D-E-01..05
// contract byte-for-byte.
//
// Admin variant (alwaysExpanded=true): forced open, no chevron, label "Tool
// trace". Used by /admin/sessions/[id] for full audit visibility (D-B-06 +
// 04-UI-SPEC §4).
import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

export type ToolPart = {
  type: `tool-${string}`;
  toolCallId: string;
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

const TOOL_LABELS: Record<string, string> = {
  'tool-research_company': 'Researched company',
  'tool-get_case_study': 'Pulled case study',
  'tool-design_metric_framework': 'Designed metric framework',
};

export function TracePanel({
  part,
  alwaysExpanded = false,
}: {
  part: ToolPart;
  alwaysExpanded?: boolean;
}) {
  const [openState, setOpenState] = useState(false); // D-E-02: default collapsed (chat)
  const open = alwaysExpanded ? true : openState;
  const label = TOOL_LABELS[part.type] ?? part.type;
  const summaryPrefix = alwaysExpanded ? 'Tool trace' : 'See what I did';

  // RESEARCH §5: don't render args until input-available — partial JSON flash.
  if (part.state === 'input-streaming') {
    return (
      <div
        className="my-1 text-xs italic text-muted-foreground"
        data-testid={`trace-streaming-${part.toolCallId}`}
        data-variant={alwaysExpanded ? 'admin' : 'chat'}
      >
        {label}…
      </div>
    );
  }

  return (
    <details
      open={open}
      onToggle={
        alwaysExpanded
          ? undefined
          : (e) => setOpenState((e.target as HTMLDetailsElement).open)
      }
      className="my-2 rounded border border-border/50 bg-muted/30 px-3 py-2 text-xs"
      data-testid={`trace-${part.toolCallId}`}
      data-variant={alwaysExpanded ? 'admin' : 'chat'}
    >
      <summary
        className={
          alwaysExpanded
            ? 'flex list-none items-center gap-1 text-muted-foreground'
            : 'flex cursor-pointer list-none items-center gap-1 text-muted-foreground'
        }
        aria-disabled={alwaysExpanded ? true : undefined}
      >
        {!alwaysExpanded && (open ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
        <span>{summaryPrefix} — {label}</span>
      </summary>
      <div className="mt-2 space-y-2 font-mono text-[11px]">
        {part.input !== undefined && (
          <pre
            className="whitespace-pre-wrap rounded bg-background p-2"
            data-testid={`trace-input-${part.toolCallId}`}
          >
            {JSON.stringify(part.input, null, 2)}
          </pre>
        )}
        {part.state === 'output-available' && part.output !== undefined && (
          <pre
            className="whitespace-pre-wrap rounded bg-background p-2"
            data-testid={`trace-output-${part.toolCallId}`}
          >
            {JSON.stringify(part.output, null, 2)}
          </pre>
        )}
        {part.state === 'output-error' && part.errorText && (
          <pre
            className="whitespace-pre-wrap rounded bg-destructive/10 p-2 text-destructive"
            data-testid={`trace-error-${part.toolCallId}`}
          >
            {part.errorText}
          </pre>
        )}
      </div>
    </details>
  );
}
