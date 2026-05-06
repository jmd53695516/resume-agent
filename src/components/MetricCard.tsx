'use client';

// src/components/MetricCard.tsx
// Plan 03-03 Task 2 — TOOL-06 / D-D-04.
// Renders the design_metric_framework tool output as a single inline shadcn
// Card with six section headers (North Star, Input Metrics, Counter-Metrics,
// Guardrails, Proposed Experiment, Open Questions). Defensive type guard:
// returns null for {error}, missing-field, null, and non-object payloads —
// Sonnet's prose still flows above the panel, no broken card render.
// Reads EXCLUSIVELY from message.parts[].output (no fetch, no DB read).
import * as React from 'react';
import { Card } from '@/components/ui/card';

export type MetricFramework = {
  north_star: string;
  input_metrics: string[];
  counter_metrics: string[];
  guardrails: string[];
  proposed_experiment: string;
  open_questions: string[];
};

function isMetricFramework(x: unknown): x is MetricFramework {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.north_star === 'string' &&
    Array.isArray(o.input_metrics) &&
    Array.isArray(o.counter_metrics) &&
    Array.isArray(o.guardrails) &&
    typeof o.proposed_experiment === 'string' &&
    Array.isArray(o.open_questions)
  );
}

type Section = { label: string; render: () => React.ReactNode };

function bulletList(items: string[]): React.ReactNode {
  return (
    <ul className="ml-5 list-disc space-y-0.5">
      {items.map((m, i) => (
        <li key={i}>{m}</li>
      ))}
    </ul>
  );
}

export function MetricCard({ data }: { data: unknown }) {
  if (!isMetricFramework(data)) return null;

  const sections: Section[] = [
    { label: 'North Star', render: () => <p>{data.north_star}</p> },
    { label: 'Input Metrics', render: () => bulletList(data.input_metrics) },
    { label: 'Counter-Metrics', render: () => bulletList(data.counter_metrics) },
    { label: 'Guardrails', render: () => bulletList(data.guardrails) },
    { label: 'Proposed Experiment', render: () => <p>{data.proposed_experiment}</p> },
    { label: 'Open Questions', render: () => bulletList(data.open_questions) },
  ];

  return (
    <Card className="my-3 space-y-3 p-4 text-sm" data-testid="metric-card">
      {sections.map((s) => (
        <div key={s.label}>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {s.label}
          </h4>
          {s.render()}
        </div>
      ))}
    </Card>
  );
}
