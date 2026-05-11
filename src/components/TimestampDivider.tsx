'use client';

/**
 * Phase 05.2 — Inter-group timestamp divider (D-A-02 + AMENDED).
 *
 * Renders a small centered timestamp label between message groups.
 * Source: design-bundle/project/Chat Stream.html:147-153.
 *
 * Defensive null return: if createdAt is missing (legacy/pre-metadata
 * message), render NOTHING rather than 'Invalid Date'. Plan 05.2-02
 * matrix-mode CSS targets [data-testid="timestamp-divider"] for the green
 * uppercase variant — same DOM, no fork (CD-04).
 */
import { format } from 'date-fns';

type Props = {
  createdAt?: number;
};

export function TimestampDivider({ createdAt }: Props) {
  if (!createdAt) return null;
  const label = format(new Date(createdAt), 'h:mm a');
  return (
    <div
      data-testid="timestamp-divider"
      className="self-center pt-4 pb-2.5 first:pt-1.5 text-[11px] font-medium text-muted-foreground tracking-tight"
    >
      {label}
    </div>
  );
}
