// src/lib/email.ts
// Phase 4 D-C-01..05 + D-H-02. Resend client + helpers.
//
// Four exports:
//   resend                      — Resend client singleton
//   sendSessionNotification     — render React Email + Resend.send (no idempotency)
//   claimAndSendSessionEmail    — atomic first_email_sent_at claim + send (D-C-05)
//   sendAlarm                   — plain-text alarm email (Plan 04-06 consumes)
//
// All send paths fail-safe: errors logged via Pino, never thrown upward.
// /api/chat must NEVER fail because email sending failed.
import { Resend } from 'resend';
import { env } from './env';
import { supabaseAdmin } from './supabase-server';
import { log } from './logger';
import { isFreeMail } from './free-mail-domains';
import { SessionNotification, type SessionNotificationProps } from '@/emails/SessionNotification';

// Lazy-initialised Resend client. Module load MUST NOT construct the Resend
// instance: /api/chat route.ts imports this module transitively, and several
// chat-route test fixtures stub a minimal env object that omits RESEND_API_KEY.
// Constructing eagerly at top-level would throw on any test that touches the
// route module without explicitly mocking either env or the resend package.
// Lazy-init keeps the production code path identical (first call materialises
// + caches the singleton) while leaving test fixtures free to mock the
// `resend` import (see tests/lib/email.test.ts) without paying for env wiring.
let _resend: Resend | null = null;
function getResend(): Resend {
  if (_resend === null) {
    _resend = new Resend(env.RESEND_API_KEY);
  }
  return _resend;
}
// Export as a getter for callers that prefer the property style; behaves like
// a singleton but only materialises on first access.
export const resend = {
  get emails() {
    return getResend().emails;
  },
};

function priorityFor(email_domain: string): boolean {
  return !isFreeMail(email_domain);
}

function buildAdminUrl(session_id: string): string {
  // VERCEL_URL is set on Vercel deployments; fall back to localhost for dev.
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  return `${base}/admin/sessions/${session_id}`;
}

export async function sendSessionNotification(
  props: SessionNotificationProps,
): Promise<{ id: string | null }> {
  const subject = props.is_priority
    ? `[PRIORITY] new chat: ${props.email}`
    : `new chat: ${props.email}`;

  const startedAt = Date.now();
  try {
    const { data, error } = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: env.JOE_NOTIFICATION_EMAIL,
      subject,
      react: SessionNotification(props),
    });
    if (error) {
      log(
        {
          event: 'session_email_send_failed',
          session_id: props.session_id,
          email_domain: props.email_domain,
          error_message: (error as { message?: string }).message ?? String(error),
        },
        'error',
      );
      return { id: null };
    }
    log({
      event: 'session_email_sent',
      session_id: props.session_id,
      email_domain: props.email_domain,
      is_priority: props.is_priority,
      resend_send_id: data?.id ?? null,
      latency_ms: Date.now() - startedAt,
    });
    return { id: data?.id ?? null };
  } catch (err) {
    log(
      {
        event: 'session_email_send_failed',
        session_id: props.session_id,
        email_domain: props.email_domain,
        error_class: (err as Error).name ?? 'Error',
        error_message: (err as Error).message ?? String(err),
      },
      'error',
    );
    return { id: null };
  }
}

/**
 * Atomic claim + send. The UPDATE ... WHERE first_email_sent_at IS NULL
 * pattern (D-C-05) ensures exactly-once semantics across concurrent
 * /api/chat requests for the same session — only the first wins.
 *
 * Designed to be called inside `after(...)` from /api/chat onFinish; never
 * throws so `after()` callbacks never surface uncaught rejections.
 */
export async function claimAndSendSessionEmail(args: {
  session_id: string;
  last_user_text: string;
  classifier_verdict: string;
  classifier_confidence: number | null;
}): Promise<void> {
  try {
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from('sessions')
      .update({ first_email_sent_at: new Date().toISOString() })
      .eq('id', args.session_id)
      .is('first_email_sent_at', null)
      .select('id, email, email_domain, total_cost_cents')
      .single();

    if (claimErr || !claimed) {
      // Lost the race OR session row not found — either way, nothing to do.
      return;
    }

    const row = claimed as {
      id: string;
      email: string;
      email_domain: string;
      total_cost_cents: number | null;
    };

    await sendSessionNotification({
      session_id: row.id,
      email: row.email,
      email_domain: row.email_domain,
      is_priority: priorityFor(row.email_domain),
      first_message: args.last_user_text,
      classifier_verdict: args.classifier_verdict,
      classifier_confidence: args.classifier_confidence,
      session_cost_cents: row.total_cost_cents ?? 0,
      admin_url: buildAdminUrl(row.id),
    });
  } catch (err) {
    log(
      {
        event: 'session_email_send_failed',
        where: 'claimAndSendSessionEmail',
        session_id: args.session_id,
        error_class: (err as Error).name ?? 'Error',
        error_message: (err as Error).message ?? String(err),
      },
      'error',
    );
  }
}

/**
 * Plain-text alarm email (D-C Specifics — recommend plain text for phone
 * readability and zero formatting friction). Plan 04-06 consumes this
 * after a per-condition Redis NX-suppression key is freshly set.
 */
export async function sendAlarm(args: {
  condition: string;
  summary: string; // free-form text body (max ~2KB)
}): Promise<{ id: string | null }> {
  const subject = `[ALARM] resume-agent: ${args.condition}`;
  const text = [
    `Alarm fired: ${args.condition}`,
    `Time: ${new Date().toISOString()}`,
    '',
    args.summary,
  ].join('\n');

  try {
    const { data, error } = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: env.JOE_NOTIFICATION_EMAIL,
      subject,
      text,
    });
    if (error) {
      log(
        {
          event: 'alarm_email_send_failed',
          condition: args.condition,
          error_message: (error as { message?: string }).message ?? String(error),
        },
        'error',
      );
      return { id: null };
    }
    log({
      event: 'alarm_email_sent',
      condition: args.condition,
      resend_send_id: data?.id ?? null,
    });
    return { id: data?.id ?? null };
  } catch (err) {
    log(
      {
        event: 'alarm_email_send_failed',
        condition: args.condition,
        error_class: (err as Error).name ?? 'Error',
        error_message: (err as Error).message ?? String(err),
      },
      'error',
    );
    return { id: null };
  }
}
