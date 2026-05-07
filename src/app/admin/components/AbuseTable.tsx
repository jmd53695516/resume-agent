// src/app/admin/components/AbuseTable.tsx
// Phase 4 OBSV-06 + D-B-08 + 04-UI-SPEC §6.
// Compact one-line list of classifier flags + rate-limit/spend-cap deflections.
import Link from 'next/link';
import { LocalTime } from './LocalTime';

export type AbuseRow = {
  message_id: string;
  session_id: string;
  created_at: string;
  content: string; // user message (truncate to 100 chars in render)
  classifier_verdict: string | null;
  stop_reason: string | null;
  session_email: string;
  session_ip_hash: string;
};

function verdictLabel(
  verdict: string | null,
  stop: string | null,
): { label: string; color: string } {
  if (verdict === 'injection') return { label: 'injection', color: 'text-amber-700' };
  if (verdict === 'offtopic') return { label: 'off-topic', color: 'text-amber-700' };
  if (verdict === 'sensitive') return { label: 'sensitive', color: 'text-amber-700' };
  if (stop === 'deflection:ratelimit') return { label: 'rate limit', color: 'text-red-700' };
  if (stop === 'deflection:spendcap') return { label: 'spend cap', color: 'text-red-700' };
  return { label: verdict ?? stop ?? 'unknown', color: 'text-amber-700' };
}

export function AbuseTable({
  rows,
  totalCount,
}: {
  rows: AbuseRow[];
  totalCount: number;
}) {
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm font-semibold">No flagged activity</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Classifier flags and rate-limit hits appear here.
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y divide-border/30">
        {rows.map((r) => {
          const { label, color } = verdictLabel(r.classifier_verdict, r.stop_reason);
          const preview = r.content.length > 100 ? `${r.content.slice(0, 100)}…` : r.content;
          return (
            <li key={r.message_id} className="py-1 hover:bg-muted/40">
              <Link
                href={`/admin/sessions/${r.session_id}`}
                className="flex flex-wrap items-center gap-2 text-sm"
              >
                <span className="text-muted-foreground">
                  <LocalTime iso={r.created_at} format="datetime" />
                </span>
                <span className="text-muted-foreground">·</span>
                <span>{r.session_email}</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-mono text-xs">{r.session_ip_hash.slice(0, 8)}</span>
                <span className="text-muted-foreground">·</span>
                <span className={`font-medium ${color}`}>{label}</span>
                <span className="text-muted-foreground">·</span>
                <span className="truncate text-muted-foreground">&ldquo;{preview}&rdquo;</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {totalCount > 100 && (
        <p className="mt-4 text-xs text-muted-foreground">
          Showing last 100 of {totalCount} flagged events.
        </p>
      )}
    </>
  );
}
