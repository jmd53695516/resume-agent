// src/app/admin/components/CostCard.tsx
// Phase 4 OBSV-05 + 04-UI-SPEC §5.
// Single window card — total dollars, request count, per-tool breakdown,
// cache hit rate (color-coded green/amber/red).
import { Card } from '@/components/ui/card';

export type CostWindowData = {
  window: '24h' | '7d' | '30d';
  total_cents: number;
  request_count: number;
  per_tool: Array<{ tool_name: string; cost_cents: number }>; // sorted desc
  cache_read_tokens: number;
  input_tokens: number;
};

const WINDOW_LABEL: Record<CostWindowData['window'], string> = {
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
};

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function cacheHitRate(read: number, input: number): { pct: number | null; color: string } {
  const denom = read + input;
  if (denom === 0) return { pct: null, color: 'text-muted-foreground' };
  const pct = (read / denom) * 100;
  const color =
    pct >= 80
      ? 'text-green-700'
      : pct >= 60
        ? 'text-amber-700'
        : 'text-red-700';
  return { pct, color };
}

export function CostCard({ data }: { data: CostWindowData }) {
  const { pct, color } = cacheHitRate(data.cache_read_tokens, data.input_tokens);
  const totalDollars = dollars(data.total_cents);
  const isZero = data.total_cents === 0;

  return (
    <Card className="p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {WINDOW_LABEL[data.window]}
      </div>
      <div
        className={`mt-2 text-2xl font-semibold ${isZero ? 'text-muted-foreground' : ''}`}
        data-testid={`cost-total-${data.window}`}
      >
        {totalDollars}
      </div>
      <div className="text-sm text-muted-foreground">{data.request_count} requests</div>

      {isZero ? (
        <p className="mt-4 text-sm text-muted-foreground">No requests in this window.</p>
      ) : (
        <>
          <div className="mt-4 border-t border-border pt-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Per-tool breakdown
            </div>
            <ul className="space-y-1 text-sm font-mono">
              {data.per_tool.map((row) => {
                const sharePct =
                  data.total_cents > 0
                    ? Math.round((row.cost_cents / data.total_cents) * 100)
                    : 0;
                return (
                  <li key={row.tool_name} className="flex justify-between">
                    <span>{row.tool_name}</span>
                    <span>
                      {dollars(row.cost_cents)} ({sharePct}%)
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="mt-4 border-t border-border pt-3">
            <span
              className={`text-sm font-medium ${color}`}
              data-testid={`cost-cache-${data.window}`}
            >
              Cache hit rate: {pct === null ? '—' : `${pct.toFixed(1)}%`}
            </span>
          </div>
        </>
      )}
    </Card>
  );
}
