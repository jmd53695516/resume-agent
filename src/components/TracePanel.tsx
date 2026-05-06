'use client';

// src/components/TracePanel.tsx
// Plan 03-03 Task 1 — CHAT-13 / D-E-01..05.
// Renders one collapsible "See what I did" block per AI SDK v6 tool-call part.
// Reads EXCLUSIVELY from message.parts (no fetch, no DB read, no extra state).
// Default state: collapsed (D-E-02). Streaming-state: label-only line — does
// NOT render args JSON until state === 'input-available' (avoids partial-JSON
// flash per RESEARCH §5).
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

export function TracePanel({ part }: { part: ToolPart }) {
  const [open, setOpen] = useState(false); // D-E-02: default collapsed
  const label = TOOL_LABELS[part.type] ?? part.type;

  // RESEARCH §5: don't render args until input-available — partial JSON flash.
  if (part.state === 'input-streaming') {
    return (
      <div
        className="my-1 text-xs italic text-muted-foreground"
        data-testid={`trace-streaming-${part.toolCallId}`}
      >
        {label}…
      </div>
    );
  }

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="my-2 rounded border border-border/50 bg-muted/30 px-3 py-2 text-xs"
      data-testid={`trace-${part.toolCallId}`}
    >
      <summary className="flex cursor-pointer list-none items-center gap-1 text-muted-foreground">
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span>See what I did — {label}</span>
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
