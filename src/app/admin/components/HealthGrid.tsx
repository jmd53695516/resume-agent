// src/app/admin/components/HealthGrid.tsx
// Phase 4 D-B-09 + 04-UI-SPEC §7.
// 5 sections: dep grid, heartbeats, last successful turn, last 5 alarms,
// optional BetterStack link.
import type { DepStatus } from '@/lib/health';
import { LocalTime } from './LocalTime';
import { RelativeTime } from './RelativeTime';

export type DepRow = { name: string; status: DepStatus };
export type Heartbeat = { name: string; lastIso: string | null };
export type AlarmRow = { id: string; condition: string; fired_at: string };

const STATUS_CLASS: Record<DepStatus, string> = {
  ok: 'bg-green-100 text-green-800',
  degraded: 'bg-amber-100 text-amber-900',
  down: 'bg-red-100 text-red-800',
};

const ALARM_LABEL: Record<string, string> = {
  'spend-cap': 'Spend cap tripped',
  'error-rate': 'Error rate spike',
  'dep-down': 'Dependency down',
  'rate-limit-abuse': 'Rate limit abuse',
};

export function HealthGrid({
  deps,
  heartbeats,
  lastSuccessfulTurnIso,
  alarms,
  betterstackUrl,
}: {
  deps: DepRow[];
  heartbeats: Heartbeat[];
  lastSuccessfulTurnIso: string | null;
  alarms: AlarmRow[];
  betterstackUrl: string | null;
}) {
  return (
    <div className="space-y-12">
      {/* Section 1 — dep grid */}
      <section>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {deps.map((d) => (
            <div
              key={d.name}
              className="rounded-lg border border-border bg-[var(--panel)] p-4"
              data-testid={`dep-${d.name}`}
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {d.name}
              </div>
              <span
                className={`mt-2 inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[d.status]}`}
              >
                {d.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2 — heartbeat ages */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">Heartbeats</h2>
        <table className="text-sm">
          <tbody>
            {heartbeats.map((h) => (
              <tr key={h.name}>
                <td className="pr-6 text-muted-foreground">{h.name}</td>
                <td>
                  {h.lastIso ? (
                    <RelativeTime iso={h.lastIso} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Section 3 — last successful turn */}
      <section>
        <p className="text-sm text-muted-foreground">
          Last successful chat turn:{' '}
          {lastSuccessfulTurnIso ? (
            <RelativeTime iso={lastSuccessfulTurnIso} />
          ) : (
            'No turns recorded yet.'
          )}
        </p>
      </section>

      {/* Section 4 — last 5 alarms */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">Recent alarms</h2>
        {alarms.length === 0 ? (
          <p className="text-sm text-muted-foreground">No alarms fired.</p>
        ) : (
          <ul>
            {alarms.map((a) => (
              <li key={a.id} className="py-2 text-sm">
                <span className="font-medium text-amber-700">
                  {ALARM_LABEL[a.condition] ?? a.condition}
                </span>
                <span className="text-muted-foreground">
                  {' · '}
                  <LocalTime iso={a.fired_at} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Section 5 — BetterStack link */}
      {betterstackUrl && (
        <section>
          <a
            href={betterstackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--me)] underline underline-offset-2 hover:opacity-80"
          >
            View BetterStack status page
          </a>
        </section>
      )}
    </div>
  );
}
