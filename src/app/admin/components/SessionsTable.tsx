// src/app/admin/components/SessionsTable.tsx
// Phase 4 D-B-05 + 04-UI-SPEC §3 — last 100 sessions table.
// Server-only; the rows wrap a <Link> for navigation. Sort is URL-driven
// (parent page reads searchParams).
//
// PRIORITY badge: shown when email_domain is NOT in the canonical free-mail
// allowlist. Imports from @/lib/free-mail-domains (Plan 04-05 — single source
// of truth).
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { isFreeMail } from '@/lib/free-mail-domains';
import { RelativeTime } from './RelativeTime';

export type SessionRow = {
  id: string;
  email: string;
  email_domain: string;
  created_at: string;
  flagged: boolean;
  total_cost_cents: number;
  turn_count: number;
};

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function sortHref(currentSort: string, currentDir: string, target: 'date' | 'domain'): string {
  const isActive =
    (target === 'date' && currentSort === 'created_at') ||
    (target === 'domain' && currentSort === 'email_domain');
  const nextDir = isActive && currentDir === 'desc' ? 'asc' : 'desc';
  return `/admin/sessions?sort=${target}&dir=${nextDir}`;
}

export function SessionsTable({
  sessions,
  sort,
  dir,
}: {
  sessions: SessionRow[];
  sort: 'created_at' | 'email_domain';
  dir: 'asc' | 'desc';
}) {
  if (sessions.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm font-semibold">No sessions yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Recruiter sessions will appear here once the first chat begins.
        </p>
      </div>
    );
  }

  const dateActive = sort === 'created_at';
  const domainActive = sort === 'email_domain';

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead className={domainActive ? 'font-semibold' : ''}>
            <Link href={sortHref(sort, dir, 'domain')} className="hover:underline">
              Domain
            </Link>
          </TableHead>
          <TableHead className={dateActive ? 'font-semibold' : ''}>
            <Link href={sortHref(sort, dir, 'date')} className="hover:underline">
              When
            </Link>
          </TableHead>
          <TableHead>Flags</TableHead>
          <TableHead className="text-right">Cost</TableHead>
          <TableHead className="text-right">Turns</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map((s) => {
          const isPriority = !isFreeMail(s.email_domain);
          return (
            <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50">
              <TableCell>
                <Link
                  href={`/admin/sessions/${s.id}`}
                  className="block max-w-[200px] truncate"
                >
                  {s.email}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/admin/sessions/${s.id}`} className="block">
                  {s.email_domain}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/admin/sessions/${s.id}`} className="block">
                  <RelativeTime iso={s.created_at} />
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/admin/sessions/${s.id}`} className="flex flex-wrap gap-1">
                  {isPriority && (
                    <Badge className="border border-blue-200 bg-blue-50 text-blue-700">
                      PRIORITY
                    </Badge>
                  )}
                  {s.flagged && (
                    <Badge className="bg-amber-100 text-amber-800">flagged</Badge>
                  )}
                </Link>
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/admin/sessions/${s.id}`} className="block">
                  {dollars(s.total_cost_cents)}
                </Link>
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/admin/sessions/${s.id}`} className="block">
                  {s.turn_count}
                </Link>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
