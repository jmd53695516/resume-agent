import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() so vi.mock factories below can reference these.
const mocks = vi.hoisted(() => ({
  CRON_SECRET: ['x', 'y', 'z'].join('').repeat(11) + 'a', // 34 chars (>= 32 min)
  runAllAlarmsMock: vi.fn(),
  logMock: vi.fn(),
}));

vi.mock('@/lib/env', () => ({ env: { CRON_SECRET: mocks.CRON_SECRET } }));

vi.mock('@/lib/alarms', () => ({ runAllAlarms: mocks.runAllAlarmsMock }));

vi.mock('@/lib/logger', () => ({ log: mocks.logMock }));

import { POST } from '@/app/api/cron/check-alarms/route';

function makeReq(opts: { method?: string; auth?: string }) {
  const headers = new Headers();
  if (opts.auth) headers.set('authorization', opts.auth);
  return new Request('https://x/api/cron/check-alarms', {
    method: opts.method ?? 'POST',
    headers,
  });
}

beforeEach(() => {
  mocks.runAllAlarmsMock.mockReset();
  mocks.logMock.mockReset();
});

describe('POST /api/cron/check-alarms', () => {
  it('returns 401 with no Authorization header', async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'unauthorized' });
    expect(mocks.runAllAlarmsMock).not.toHaveBeenCalled();
  });

  it('returns 401 with wrong token', async () => {
    const res = await POST(makeReq({ auth: 'Bearer wrong-token-but-long-enough-32ch' }));
    expect(res.status).toBe(401);
    expect(mocks.runAllAlarmsMock).not.toHaveBeenCalled();
  });

  it('returns 401 with GET method even with correct token (belt-and-suspenders)', async () => {
    const res = await POST(
      makeReq({ method: 'GET', auth: `Bearer ${mocks.CRON_SECRET}` }),
    );
    expect(res.status).toBe(401);
    expect(mocks.runAllAlarmsMock).not.toHaveBeenCalled();
  });

  it('returns 200 with results array on happy path', async () => {
    mocks.runAllAlarmsMock.mockResolvedValue([
      { condition: 'spend-cap', tripped: true, fired: true, resend_send_id: 'res_1' },
      { condition: 'error-rate', tripped: false, fired: false, resend_send_id: null },
      { condition: 'dep-down', tripped: false, fired: false, resend_send_id: null },
      {
        condition: 'rate-limit-abuse',
        tripped: false,
        fired: false,
        resend_send_id: null,
      },
    ]);
    const res = await POST(makeReq({ auth: `Bearer ${mocks.CRON_SECRET}` }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.fired_count).toBe(1);
    expect(body.results).toHaveLength(4);
  });

  it('returns 500 on internal error and logs it', async () => {
    mocks.runAllAlarmsMock.mockRejectedValue(new Error('boom'));
    const res = await POST(makeReq({ auth: `Bearer ${mocks.CRON_SECRET}` }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'internal' });
    expect(mocks.logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'cron_run',
        cron_name: 'check-alarms',
        status: 'error',
        error_message: 'boom',
      }),
      'error',
    );
  });

  it('logs cron_run on success with items_processed = fired_count', async () => {
    mocks.runAllAlarmsMock.mockResolvedValue([
      { condition: 'spend-cap', tripped: true, fired: true, resend_send_id: 'r1' },
      { condition: 'dep-down', tripped: true, fired: true, resend_send_id: 'r2' },
      {
        condition: 'rate-limit-abuse',
        tripped: false,
        fired: false,
        resend_send_id: null,
      },
      { condition: 'error-rate', tripped: false, fired: false, resend_send_id: null },
    ]);
    await POST(makeReq({ auth: `Bearer ${mocks.CRON_SECRET}` }));
    expect(mocks.logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'cron_run',
        cron_name: 'check-alarms',
        status: 'ok',
        items_processed: 2,
      }),
    );
  });
});
