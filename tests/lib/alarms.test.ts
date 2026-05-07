import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() container so vi.mock() factories (which are hoisted to top of
// file) can reference these. Mirrors Plan 04-02 multi-mock pattern.
const mocks = vi.hoisted(() => ({
  redisSet: vi.fn(),
  getSpendTodayMock: vi.fn(),
  pingAnthropic: vi.fn(),
  pingClassifier: vi.fn(),
  pingSupabase: vi.fn(),
  pingUpstash: vi.fn(),
  pingExa: vi.fn(),
  sendAlarmMock: vi.fn(),
  logMock: vi.fn(),
  fromMock: vi.fn(),
  insertMock: vi.fn(),
  // Mutable per-test return value for the read-side query chain.
  queryReturn: { data: [] as unknown[], error: null as { message: string } | null },
}));

vi.mock('@/lib/env', () => ({
  env: {
    CRON_SECRET: ['x', 'y'].join('').repeat(20),
    RESEND_API_KEY: ['re', '_test', '_key'].join(''),
    RESEND_FROM_EMAIL: 'agent@test.com',
    JOE_NOTIFICATION_EMAIL: 'joe@test.com',
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: { set: mocks.redisSet },
  getSpendToday: mocks.getSpendTodayMock,
}));

vi.mock('@/lib/health', () => ({
  pingAnthropic: mocks.pingAnthropic,
  pingClassifier: mocks.pingClassifier,
  pingSupabase: mocks.pingSupabase,
  pingUpstash: mocks.pingUpstash,
  pingExa: mocks.pingExa,
}));

// Build a thenable chainable that resolves to the current queryReturn at
// any chain depth; matches the supabase-js builder pattern email.test.ts
// established (chainResolve helper, Plan 04-05).
function chain() {
  const c: Record<string, unknown> = {};
  c.select = () => c;
  c.eq = () => c;
  c.gte = () => c;
  c.then = (resolve: (v: unknown) => void) =>
    Promise.resolve(mocks.queryReturn).then(resolve);
  return c;
}

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: mocks.fromMock,
  },
}));

vi.mock('@/lib/email', () => ({ sendAlarm: mocks.sendAlarmMock }));

vi.mock('@/lib/id', () => ({
  newMessageId: () => 'msg_test',
  newAlarmId: () => 'alm_test',
}));

vi.mock('@/lib/logger', () => ({ log: mocks.logMock }));

import {
  claimAlarmSuppression,
  checkSpendCap,
  checkDependencies,
  checkErrorRate,
  checkRateLimitAbuse,
  runAllAlarms,
} from '@/lib/alarms';

beforeEach(() => {
  mocks.redisSet.mockReset();
  mocks.getSpendTodayMock.mockReset();
  mocks.pingAnthropic.mockReset();
  mocks.pingClassifier.mockReset();
  mocks.pingSupabase.mockReset();
  mocks.pingUpstash.mockReset();
  mocks.pingExa.mockReset();
  mocks.sendAlarmMock.mockReset();
  mocks.logMock.mockReset();
  mocks.insertMock.mockReset();
  mocks.fromMock.mockReset();
  mocks.queryReturn = { data: [], error: null };

  // Default supabase.from() implementation: returns a chainable for selects
  // and a mock insert(). Tests can override before re-importing not needed —
  // we just mutate behavior via mocks.queryReturn / mocks.insertMock.
  mocks.insertMock.mockResolvedValue({ data: null, error: null });
  mocks.fromMock.mockImplementation(() => ({
    select: () => chain(),
    insert: mocks.insertMock,
  }));
});

describe('claimAlarmSuppression', () => {
  it("returns true when redis SET returns 'OK'", async () => {
    mocks.redisSet.mockResolvedValue('OK');
    expect(await claimAlarmSuppression('spend-cap')).toBe(true);
    expect(mocks.redisSet).toHaveBeenCalledWith(
      'resume-agent:alarms:fired:spend-cap',
      '1',
      { ex: 3600, nx: true },
    );
  });

  it('returns false when redis SET returns null (already exists)', async () => {
    mocks.redisSet.mockResolvedValue(null);
    expect(await claimAlarmSuppression('dep-down')).toBe(false);
  });

  it('returns true (fail-open) on redis throw', async () => {
    mocks.redisSet.mockRejectedValue(new Error('redis down'));
    expect(await claimAlarmSuppression('dep-down')).toBe(true);
    expect(mocks.logMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'alarm_suppression_redis_failed' }),
      'warn',
    );
  });

  it('uses per-condition keys (independence verified)', async () => {
    mocks.redisSet.mockResolvedValue('OK');
    await claimAlarmSuppression('spend-cap');
    await claimAlarmSuppression('dep-down');
    const calls = mocks.redisSet.mock.calls.map((c) => c[0]);
    expect(calls).toContain('resume-agent:alarms:fired:spend-cap');
    expect(calls).toContain('resume-agent:alarms:fired:dep-down');
  });
});

describe('checkSpendCap', () => {
  it('trips at 300c (boundary)', async () => {
    mocks.getSpendTodayMock.mockResolvedValue(300);
    const r = await checkSpendCap();
    expect(r.tripped).toBe(true);
    expect(r.summary).toContain('300c');
  });

  it('does not trip below 300c', async () => {
    mocks.getSpendTodayMock.mockResolvedValue(299);
    const r = await checkSpendCap();
    expect(r.tripped).toBe(false);
  });

  it('trips above 300c', async () => {
    mocks.getSpendTodayMock.mockResolvedValue(450);
    const r = await checkSpendCap();
    expect(r.tripped).toBe(true);
  });
});

describe('checkDependencies', () => {
  function setAllOk() {
    mocks.pingAnthropic.mockResolvedValue('ok');
    mocks.pingClassifier.mockResolvedValue('ok');
    mocks.pingSupabase.mockResolvedValue('ok');
    mocks.pingUpstash.mockResolvedValue('ok');
    mocks.pingExa.mockResolvedValue('ok');
  }

  it('does not trip when all 5 deps return ok', async () => {
    setAllOk();
    const r = await checkDependencies();
    expect(r.tripped).toBe(false);
    expect(r.summary).toBe('All dependencies ok.');
  });

  it('trips when any dep is degraded', async () => {
    setAllOk();
    mocks.pingExa.mockResolvedValue('degraded');
    const r = await checkDependencies();
    expect(r.tripped).toBe(true);
    expect(r.summary).toContain('exa=degraded');
  });

  it('trips when any dep is down', async () => {
    setAllOk();
    mocks.pingAnthropic.mockResolvedValue('down');
    const r = await checkDependencies();
    expect(r.tripped).toBe(true);
    expect(r.summary).toContain('anthropic=down');
  });
});

describe('checkErrorRate', () => {
  it('does not trip when sample < minSample (default 10)', async () => {
    // 5 turns, 5 errors — would be 100% but sample too small.
    const rows = Array.from({ length: 5 }, () => ({
      stop_reason: 'error',
      content: '',
    }));
    mocks.queryReturn = { data: rows, error: null };
    const r = await checkErrorRate();
    expect(r.tripped).toBe(false);
    expect(r.summary).toContain('skipping');
  });

  it('trips when ratio > 2% with sample >= 10', async () => {
    // 10 turns, 1 error = 10% (above threshold)
    const rows: Array<{ stop_reason: string | null; content: string | null }> = [];
    rows.push({ stop_reason: 'error', content: 'oops' });
    for (let i = 0; i < 9; i++) rows.push({ stop_reason: null, content: 'ok response' });
    mocks.queryReturn = { data: rows, error: null };
    const r = await checkErrorRate();
    expect(r.tripped).toBe(true);
    expect(r.summary).toContain('10.0%');
  });

  it('does not trip when ratio is exactly 2% (must be strictly >)', async () => {
    // 50 turns, 1 error = 2%
    const rows: Array<{ stop_reason: string | null; content: string | null }> = [];
    rows.push({ stop_reason: 'error', content: '' });
    for (let i = 0; i < 49; i++) rows.push({ stop_reason: null, content: 'ok' });
    mocks.queryReturn = { data: rows, error: null };
    const r = await checkErrorRate();
    expect(r.tripped).toBe(false);
  });

  it('counts empty non-deflection content as error; ignores deflections', async () => {
    // 10 turns: 1 silent failure (empty + null stop_reason), 1 deflection
    // (empty + 'deflection:ratelimit' — should NOT count), 8 ok = 1/10 = 10%
    const rows: Array<{ stop_reason: string | null; content: string | null }> = [
      { stop_reason: null, content: '' }, // silent failure → counts
      { stop_reason: 'deflection:ratelimit', content: '' }, // deflection → does NOT count
    ];
    for (let i = 0; i < 8; i++) rows.push({ stop_reason: null, content: 'ok' });
    mocks.queryReturn = { data: rows, error: null };
    const r = await checkErrorRate();
    expect(r.tripped).toBe(true);
    expect(r.summary).toContain('1/10');
  });

  it('does not trip on supabase query error (fail-safe)', async () => {
    mocks.queryReturn = { data: [], error: { message: 'db down' } };
    const r = await checkErrorRate();
    expect(r.tripped).toBe(false);
    expect(r.summary).toContain('query failed');
  });
});

describe('checkRateLimitAbuse', () => {
  it('counts DISTINCT ip_hash via Set', async () => {
    // 5 rows, but 2 share the same ip_hash → 4 unique
    const rows = [
      { session_id: 's1', sessions: { ip_hash: 'a' } },
      { session_id: 's2', sessions: { ip_hash: 'a' } }, // duplicate
      { session_id: 's3', sessions: { ip_hash: 'b' } },
      { session_id: 's4', sessions: { ip_hash: 'c' } },
      { session_id: 's5', sessions: { ip_hash: 'd' } },
    ];
    mocks.queryReturn = { data: rows, error: null };
    const r = await checkRateLimitAbuse();
    expect(r.tripped).toBe(false); // 4 < threshold(5)
    expect(r.summary).toContain('= 4');
  });

  it('trips at threshold (5 unique IPs)', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      session_id: `s${i}`,
      sessions: { ip_hash: `ip_${i}` },
    }));
    mocks.queryReturn = { data: rows, error: null };
    const r = await checkRateLimitAbuse();
    expect(r.tripped).toBe(true);
  });

  it('handles supabase array-shape join (sessions returned as array)', async () => {
    const rows = [
      { session_id: 's1', sessions: [{ ip_hash: 'ipA' }] },
      { session_id: 's2', sessions: [{ ip_hash: 'ipB' }] },
    ];
    mocks.queryReturn = { data: rows, error: null };
    const r = await checkRateLimitAbuse();
    expect(r.tripped).toBe(false);
    expect(r.summary).toContain('= 2');
  });
});

describe('runAllAlarms', () => {
  function setAllOk() {
    mocks.pingAnthropic.mockResolvedValue('ok');
    mocks.pingClassifier.mockResolvedValue('ok');
    mocks.pingSupabase.mockResolvedValue('ok');
    mocks.pingUpstash.mockResolvedValue('ok');
    mocks.pingExa.mockResolvedValue('ok');
  }

  it('does NOT call sendAlarm when no condition is tripped', async () => {
    mocks.getSpendTodayMock.mockResolvedValue(0);
    setAllOk();
    mocks.queryReturn = { data: [], error: null };

    const results = await runAllAlarms();
    expect(mocks.sendAlarmMock).not.toHaveBeenCalled();
    expect(results.every((r) => !r.fired)).toBe(true);
    expect(results).toHaveLength(4);
    expect(results.map((r) => r.condition)).toEqual([
      'spend-cap',
      'error-rate',
      'dep-down',
      'rate-limit-abuse',
    ]);
  });

  it('fires sendAlarm + INSERT alarms_fired when condition trips and claim succeeds', async () => {
    mocks.getSpendTodayMock.mockResolvedValue(350); // tripped
    setAllOk();
    mocks.queryReturn = { data: [], error: null };
    mocks.redisSet.mockResolvedValue('OK'); // claim succeeds
    mocks.sendAlarmMock.mockResolvedValue({ id: 'res_alarm_1' });

    const results = await runAllAlarms();
    const spendResult = results.find((r) => r.condition === 'spend-cap');
    expect(spendResult?.fired).toBe(true);
    expect(spendResult?.resend_send_id).toBe('res_alarm_1');
    expect(mocks.sendAlarmMock).toHaveBeenCalledWith(
      expect.objectContaining({ condition: 'spend-cap' }),
    );
    // Insert audit row written
    expect(mocks.insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'alm_test',
        condition: 'spend-cap',
        resend_send_id: 'res_alarm_1',
      }),
    );
    // alarm_fired log emitted
    expect(mocks.logMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'alarm_fired', condition: 'spend-cap' }),
    );
  });

  it('does NOT fire when condition trips but Redis claim is blocked (suppressed)', async () => {
    mocks.getSpendTodayMock.mockResolvedValue(350);
    setAllOk();
    mocks.queryReturn = { data: [], error: null };
    mocks.redisSet.mockResolvedValue(null); // claim blocked

    const results = await runAllAlarms();
    const spendResult = results.find((r) => r.condition === 'spend-cap');
    expect(spendResult?.tripped).toBe(true);
    expect(spendResult?.fired).toBe(false);
    expect(mocks.sendAlarmMock).not.toHaveBeenCalled();
    expect(mocks.insertMock).not.toHaveBeenCalled();
    expect(mocks.logMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'alarm_suppressed', condition: 'spend-cap' }),
    );
  });
});
