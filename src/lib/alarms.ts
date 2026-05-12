// src/lib/alarms.ts
// Phase 4 D-C-06..07 — alarm condition checks + per-condition Redis NX
// suppression + sendAlarm dispatch + alarms_fired INSERT.
//
// The 5 conditions:
//   1. spend-cap            — Redis spend counter >= 300 cents (mirrors SAFE-04 threshold)
//   2. error-rate           — assistant turns in last 10min with stop_reason='error' or empty
//                             non-deflection content; tripped iff sample >= 10 AND ratio > 2%
//   3. dep-down             — any /api/health dep returns degraded or down
//   4. rate-limit-abuse     — >= 5 unique sessions.ip_hash hitting deflection:ratelimit in last 1h
//   5. weekly-eval-failure  — Phase 5 (Plan 05-11). eval_runs row with scheduled=true AND
//                             status='failed' AND finished_at within last hour. Uses 24h NX
//                             (instead of default 1h) so a single failed Monday run produces
//                             one email; the next Monday's recovery is silent (RESEARCH §7
//                             Open Question 2; orchestrator-locked decision).
//
// Per-condition Redis NX suppression makes alarms idempotent: firing 'spend-cap' does NOT
// suppress 'dep-down', and re-firing the same condition within its TTL window is a no-op
// (returns false from claimAlarmSuppression). Default TTL=3600s; weekly-eval-failure
// overrides to 86400s.
import { redis, getSpendToday } from './redis';
import {
  pingAnthropic,
  pingClassifier,
  pingSupabase,
  pingUpstash,
  pingExa,
} from './health';
import { supabaseAdmin } from './supabase-server';
import { sendAlarm } from './email';
import { newAlarmId } from './id';
import { log } from './logger';

export type AlarmCondition =
  | 'spend-cap'
  | 'error-rate'
  | 'dep-down'
  | 'rate-limit-abuse'
  | 'weekly-eval-failure'
  // WR-01 follow-up: heartbeat:exa heartbeat-trust pattern (cron-side
  // unconditional write) means pingExa returns 'ok' even when Exa is down,
  // so the dep-down alarm cannot surface a real Exa outage. This separate
  // condition watches research_company tool error ratio over the last hour
  // and fires when Exa-side failures actually cause deflections.
  | 'research-company-error-rate';

/**
 * Per-condition Redis NX suppression TTL (seconds). Default = 3600 (1h);
 * 'weekly-eval-failure' overrides to 86400 (24h) per RESEARCH §7 Open Q 2 +
 * orchestrator-locked decision (Plan 05-11): a single Monday failure → one
 * email; the following Monday's recovery is silent.
 */
const DEFAULT_SUPPRESSION_TTL_S = 3600;
const SUPPRESSION_TTL_OVERRIDES: Partial<Record<AlarmCondition, number>> = {
  'weekly-eval-failure': 86400,
};

export function getSuppressionTtlSeconds(condition: AlarmCondition): number {
  return SUPPRESSION_TTL_OVERRIDES[condition] ?? DEFAULT_SUPPRESSION_TTL_S;
}

/**
 * Returns true iff the alarm should fire (NX claim succeeded — key was absent).
 * Returns false when blocked by an existing key (already fired within the
 * suppression window for this condition).
 *
 * Fail-open on Redis error: better to over-fire under partial outage than to
 * silently drop alarms (T-04-06-07 disposition: accept).
 */
export async function claimAlarmSuppression(
  condition: AlarmCondition,
): Promise<boolean> {
  const key = `resume-agent:alarms:fired:${condition}`;
  const ttl = getSuppressionTtlSeconds(condition);
  try {
    const result = await redis.set(key, '1', { ex: ttl, nx: true });
    // RESEARCH §6 / Pitfall 6: 'OK' === claim succeeded (key was absent);
    // null === blocked (key existed — NX prevented write).
    return result === 'OK';
  } catch (err) {
    log(
      {
        event: 'alarm_suppression_redis_failed',
        condition,
        error_message: (err as Error).message,
      },
      'warn',
    );
    return true;
  }
}

type CheckResult = { tripped: boolean; summary: string };

export async function checkSpendCap(): Promise<CheckResult> {
  const cents = await getSpendToday();
  return {
    tripped: cents >= 300,
    summary: `Rolling 24h spend = ${cents}c (cap = 300c).`,
  };
}

/**
 * Counts assistant turns in `windowMinutes`; counts those with
 * stop_reason='error' OR empty content + non-deflection stop_reason as errors.
 * Trips iff sample >= minSample AND error ratio > 2%.
 *
 * minSample default = 10 (Claude's discretion per CONTEXT — suppresses false
 * positives on low-traffic periods).
 */
export async function checkErrorRate(
  windowMinutes = 10,
  minSample = 10,
): Promise<CheckResult> {
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('id, stop_reason, content')
    .eq('role', 'assistant')
    .gte('created_at', since);

  if (error || !data) {
    return {
      tripped: false,
      summary: `Error-rate check: query failed (${error?.message ?? 'no data'}).`,
    };
  }

  const rows = data as Array<{ stop_reason: string | null; content: string | null }>;
  const total = rows.length;
  const errors = rows.filter((r) => {
    if (r.stop_reason === 'error') return true;
    // Empty content + non-deflection stop reason — silent failure.
    if (
      (r.content ?? '').length === 0 &&
      !(r.stop_reason ?? '').startsWith('deflection:')
    ) {
      return true;
    }
    return false;
  }).length;

  if (total < minSample) {
    return {
      tripped: false,
      summary: `Error-rate window has ${total} turns (<${minSample}); skipping.`,
    };
  }

  const ratio = errors / total;
  return {
    tripped: ratio > 0.02,
    summary: `Error-rate ${(ratio * 100).toFixed(1)}% (${errors}/${total} turns in last ${windowMinutes}m; threshold 2%).`,
  };
}

export async function checkDependencies(): Promise<CheckResult> {
  const [anthropic, classifier, supabase, upstash, exa] = await Promise.all([
    pingAnthropic(),
    pingClassifier(),
    pingSupabase(),
    pingUpstash(),
    pingExa(),
  ]);
  const statuses = { anthropic, classifier, supabase, upstash, exa };
  const non_ok = Object.entries(statuses).filter(([, s]) => s !== 'ok');
  const tripped = non_ok.length > 0;
  const summary = tripped
    ? `Dependencies non-ok: ${non_ok.map(([k, v]) => `${k}=${v}`).join(', ')}.`
    : 'All dependencies ok.';
  return { tripped, summary };
}

/**
 * Counts DISTINCT sessions.ip_hash rows for messages with
 * stop_reason='deflection:ratelimit' in the last `windowHours`.
 * Trips iff distinct count >= threshold.
 */
export async function checkRateLimitAbuse(
  windowHours = 1,
  threshold = 5,
): Promise<CheckResult> {
  const since = new Date(Date.now() - windowHours * 3600_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('session_id, sessions(ip_hash)')
    .eq('stop_reason', 'deflection:ratelimit')
    .gte('created_at', since);

  if (error || !data) {
    return {
      tripped: false,
      summary: `Rate-limit-abuse check: query failed (${error?.message ?? 'no data'}).`,
    };
  }

  const ipSet = new Set<string>();
  type SessionRow = { ip_hash: string } | { ip_hash: string }[] | null;
  for (const row of data as Array<{ sessions: SessionRow }>) {
    const sess = Array.isArray(row.sessions) ? row.sessions[0] : row.sessions;
    if (sess && 'ip_hash' in sess && sess.ip_hash) ipSet.add(sess.ip_hash);
  }
  return {
    tripped: ipSet.size >= threshold,
    summary: `Unique IP-hashes hitting rate-limit in last ${windowHours}h = ${ipSet.size} (threshold ${threshold}).`,
  };
}

/**
 * 5th condition (Plan 05-11). Queries eval_runs for any scheduled run that
 * failed in the last hour (matches the weekly cron-job.org cadence). The
 * actual eval body runs in GH Actions (Plan 05-10 workflow); rows are written
 * by the eval CLI via supabaseAdmin. Tripped iff at least one such row exists.
 *
 * 24h NX suppression (getSuppressionTtlSeconds) ensures one email per failed
 * Monday — see header comment.
 */
export async function checkWeeklyEvalFailure(): Promise<CheckResult> {
  const since = new Date(Date.now() - 60 * 60_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('eval_runs')
    .select('id, finished_at, status')
    .eq('scheduled', true)
    .eq('status', 'failed')
    .gte('finished_at', since);

  if (error || !data) {
    return {
      tripped: false,
      summary: `Weekly-eval-failure check: query failed (${error?.message ?? 'no data'}).`,
    };
  }
  const recentFailures = data.length;
  return {
    tripped: recentFailures > 0,
    summary: `Scheduled eval failures in last 1h = ${recentFailures}.`,
  };
}

/**
 * WR-01 follow-up. Watches research_company tool error ratio in the last
 * `windowHours`. Fires when the tool's deflect rate is high — the real
 * failure mode when Exa is down (the tool catches errors and returns
 * `{ error: TOOL_FAILURE_COPY.research_company }` so the recruiter sees an
 * in-character apology, but Joe gets no alarm signal from the dep-down path
 * because heartbeat:exa is unconditionally written by the cron).
 *
 * Tripped iff sample >= `minSample` AND error ratio > `threshold`.
 * Defaults (windowHours=1, minSample=3, threshold=0.5) match the realistic
 * volume of tool calls — research_company fires only when a recruiter
 * actively pitches a company, so even 3 calls in an hour is meaningful.
 *
 * Reads `messages` table rows where role='tool', tool_name='research_company'
 * (`persistToolCallTurn` schema). Errors are detected by inspecting
 * `tool_result.error` (the structured return from research-company.ts:74).
 */
export async function checkResearchCompanyErrorRate(
  windowHours = 1,
  minSample = 3,
  threshold = 0.5,
): Promise<CheckResult> {
  const since = new Date(Date.now() - windowHours * 3600_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('tool_result')
    .eq('role', 'tool')
    .eq('tool_name', 'research_company')
    .gte('created_at', since);

  if (error || !data) {
    return {
      tripped: false,
      summary: `Research-company-error-rate check: query failed (${error?.message ?? 'no data'}).`,
    };
  }

  const rows = data as Array<{ tool_result: Record<string, unknown> | null }>;
  const total = rows.length;
  const errors = rows.filter((r) => r.tool_result != null && 'error' in r.tool_result).length;

  if (total < minSample) {
    return {
      tripped: false,
      summary: `Research-company error-rate window has ${total} calls (<${minSample}); skipping.`,
    };
  }

  const ratio = errors / total;
  return {
    tripped: ratio > threshold,
    summary: `Research-company error-rate ${(ratio * 100).toFixed(1)}% (${errors}/${total} calls in last ${windowHours}h; threshold ${(threshold * 100).toFixed(0)}%).`,
  };
}

export type AlarmDispatchResult = {
  condition: AlarmCondition;
  tripped: boolean;
  fired: boolean; // true = claim succeeded AND email send attempted
  resend_send_id: string | null;
};

/**
 * Run all 5 alarm checks; for each tripped condition, attempt the
 * per-condition Redis NX claim; on successful claim, send the alarm email
 * and INSERT a row into public.alarms_fired (audit log for /admin/health
 * "Recent alarms" widget — Plan 04-04).
 */
export async function runAllAlarms(): Promise<AlarmDispatchResult[]> {
  // Run the 6 checks in parallel — they share no state, and serialising would
  // add ~6x latency for no benefit. WR-01 follow-up added the 6th check
  // (research-company-error-rate) so Exa outages surface even though the
  // dep-down path is now heartbeat-trust-only for Exa.
  const [spend, errorRate, deps, rateLimit, weeklyEvalFailure, researchCompanyErr] =
    await Promise.all([
      checkSpendCap(),
      checkErrorRate(),
      checkDependencies(),
      checkRateLimitAbuse(),
      checkWeeklyEvalFailure(),
      checkResearchCompanyErrorRate(),
    ]);

  const checks: Array<[AlarmCondition, CheckResult]> = [
    ['spend-cap', spend],
    ['error-rate', errorRate],
    ['dep-down', deps],
    ['rate-limit-abuse', rateLimit],
    ['weekly-eval-failure', weeklyEvalFailure],
    ['research-company-error-rate', researchCompanyErr],
  ];

  const results: AlarmDispatchResult[] = [];
  for (const [condition, check] of checks) {
    if (!check.tripped) {
      results.push({ condition, tripped: false, fired: false, resend_send_id: null });
      continue;
    }
    const claimed = await claimAlarmSuppression(condition);
    if (!claimed) {
      // Suppressed — already fired within the last hour
      results.push({ condition, tripped: true, fired: false, resend_send_id: null });
      log({ event: 'alarm_suppressed', condition, summary: check.summary });
      continue;
    }
    const { id: resend_send_id } = await sendAlarm({
      condition,
      summary: check.summary,
    });
    // Insert audit row (non-fatal if it fails — alarm email is the primary
    // signal; the row is for the /admin/health Last 5 widget).
    try {
      const { error: insertErr } = await supabaseAdmin.from('alarms_fired').insert({
        id: newAlarmId(),
        condition,
        resend_send_id,
        body_summary: check.summary.slice(0, 1000), // bound length — T-04-06-03
      });
      if (insertErr) {
        log(
          {
            event: 'alarm_fired_insert_failed',
            condition,
            error_message: insertErr.message,
          },
          'error',
        );
      }
    } catch (err) {
      log(
        {
          event: 'alarm_fired_insert_failed',
          condition,
          error_message: (err as Error).message,
        },
        'error',
      );
    }
    log({
      event: 'alarm_fired',
      condition,
      resend_send_id,
      suppression_until_ts: new Date(
        Date.now() + getSuppressionTtlSeconds(condition) * 1000,
      ).toISOString(),
    });
    results.push({ condition, tripped: true, fired: true, resend_send_id });
  }
  return results;
}
