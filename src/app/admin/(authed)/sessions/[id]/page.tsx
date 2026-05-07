// src/app/admin/(authed)/sessions/[id]/page.tsx
// Phase 4 OBSV-04 + D-B-06 + 04-UI-SPEC §4.
// Full transcript with always-expanded tool traces. Reuses Phase 3
// MessageBubble + TracePanel + MetricCard via the new alwaysExpandTrace
// prop (Task 2).
//
// Lives under (authed) — parent layout requireAdmin() guards; per-page
// requireAdmin() is D-A-03 belt-and-suspenders.
//
// Freshness: `dynamic = 'force-dynamic'` for fresh per-request SSR. Do NOT
// add `revalidate = 60` — dead code under force-dynamic.
import { requireAdmin } from '@/lib/admin-auth';
import NotAuthorized from '../../../components/NotAuthorized';
import { supabaseAdmin } from '@/lib/supabase-server';
import { MessageBubble } from '@/components/MessageBubble';
import { LocalTime } from '../../../components/LocalTime';
import { isFreeMail } from '@/lib/free-mail-domains';
import type { ToolPart } from '@/components/TracePanel';

export const dynamic = 'force-dynamic';

type MessageRow = {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  tool_name: string | null;
  tool_args: unknown;
  tool_result: unknown;
  sdk_message_id: string | null;
  created_at: string;
};

type SessionHeader = {
  id: string;
  email: string;
  email_domain: string;
  ip_hash: string;
  turn_count: number;
  total_cost_cents: number;
  flagged: boolean;
  created_at: string;
};

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Group rows into "turn blocks": one assistant row + the tool rows that
// immediately follow it. The chat view assembles tool parts onto the same
// assistant message via AI SDK message.parts; persistence stores them as
// separate rows. Reconstruct by attaching tool rows (between this assistant
// and the next user/assistant) as parts on the assistant row.
function rowsToBubbles(
  rows: MessageRow[],
): Array<
  | { kind: 'user'; id: string; text: string }
  | {
      kind: 'assistant';
      id: string;
      parts: Array<{ type: 'text'; text: string } | ToolPart>;
    }
> {
  const out: Array<
    | { kind: 'user'; id: string; text: string }
    | {
        kind: 'assistant';
        id: string;
        parts: Array<{ type: 'text'; text: string } | ToolPart>;
      }
  > = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.role === 'user') {
      out.push({ kind: 'user', id: r.id, text: r.content });
    } else if (r.role === 'assistant') {
      const parts: Array<{ type: 'text'; text: string } | ToolPart> = [];
      if (r.content) parts.push({ type: 'text', text: r.content });
      let j = i + 1;
      while (j < rows.length && rows[j].role === 'tool') {
        const t = rows[j];
        const toolPart: ToolPart = {
          type: `tool-${t.tool_name ?? 'unknown'}` as `tool-${string}`,
          toolCallId: t.sdk_message_id ?? t.id,
          state: 'output-available',
          input: t.tool_args ?? undefined,
          output: t.tool_result ?? undefined,
        };
        parts.push(toolPart);
        j++;
      }
      out.push({ kind: 'assistant', id: r.id, parts });
    }
    // 'tool' rows are absorbed into the preceding assistant; 'system' is skipped.
  }
  return out;
}

export default async function SessionTranscriptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) return <NotAuthorized />;

  const { id } = await params;

  const [{ data: session }, { data: msgs }] = await Promise.all([
    supabaseAdmin
      .from('sessions')
      .select(
        'id, email, email_domain, ip_hash, turn_count, total_cost_cents, flagged, created_at',
      )
      .eq('id', id)
      .single(),
    supabaseAdmin
      .from('messages')
      .select(
        'id, session_id, role, content, tool_name, tool_args, tool_result, sdk_message_id, created_at',
      )
      .eq('session_id', id)
      .order('created_at', { ascending: true }),
  ]);

  if (!session) {
    return (
      <div>
        <h1 className="mb-4 text-xl font-semibold">Transcript</h1>
        <p className="text-sm text-destructive">Session not found.</p>
      </div>
    );
  }

  const sessionHeader = session as SessionHeader;
  const rows = (msgs ?? []) as MessageRow[];
  const bubbles = rowsToBubbles(rows);
  const isPriority =
    !!sessionHeader.email_domain && !isFreeMail(sessionHeader.email_domain);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-[var(--panel)] p-4">
        <div className="text-sm">
          <span className="font-medium">{sessionHeader.email}</span>
          <span className="text-muted-foreground"> · {sessionHeader.email_domain}</span>
          <span className="font-mono text-muted-foreground">
            {' '}
            · {sessionHeader.ip_hash.slice(0, 8)}
          </span>
          <span className="text-muted-foreground"> · {sessionHeader.turn_count} turns</span>
          <span className="text-muted-foreground">
            {' '}
            · {dollars(sessionHeader.total_cost_cents)}
          </span>
          {isPriority && <span className="text-blue-700"> · [PRIORITY]</span>}
          {sessionHeader.flagged && <span className="text-amber-800"> · flagged</span>}
          <span className="text-muted-foreground">
            {' '}
            · <LocalTime iso={sessionHeader.created_at} />
          </span>
        </div>
      </div>

      {bubbles.length === 0 ? (
        <p className="text-sm text-muted-foreground">This session has no messages.</p>
      ) : (
        <div className="space-y-4">
          {bubbles.map((b) =>
            b.kind === 'user' ? (
              <MessageBubble key={b.id} role="user" text={b.text} />
            ) : (
              <MessageBubble
                key={b.id}
                role="assistant"
                parts={b.parts}
                alwaysExpandTrace={true}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
