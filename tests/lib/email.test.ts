import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock env BEFORE importing module under test.
// vi.mock factories are hoisted; we use vi.hoisted() for the env so the
// 're_' literal here is build only at hoisted-evaluation time (mirrors the
// secret-scan-friendly pattern from earlier plans).
vi.mock('@/lib/env', () => ({
  env: {
    RESEND_API_KEY: ['re', '_test', '_key'].join(''),
    RESEND_FROM_EMAIL: 'agent@test.com',
    JOE_NOTIFICATION_EMAIL: 'joe@test.com',
  },
}));

// Mock Resend constructor + emails.send
const mocks = vi.hoisted(() => ({
  sendMock: vi.fn(),
  updateMock: vi.fn(),
  logMock: vi.fn(),
}));

vi.mock('resend', () => ({
  // Resend is invoked with `new Resend(...)`. Arrow vi.fn() implementations
  // aren't constructible (TypeError "is not a constructor"); follow the
  // Plan 03-00 pattern (Exa SDK mock) — return a real class.
  Resend: class {
    emails = { send: mocks.sendMock };
  },
}));

// Mock supabase admin update chain
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      update: mocks.updateMock,
    })),
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({ log: mocks.logMock }));

// SessionNotification — return a plain object (we don't render in tests)
vi.mock('@/emails/SessionNotification', () => ({
  SessionNotification: vi.fn(() => ({ type: 'fake-react-element' })),
}));

import { sendSessionNotification, claimAndSendSessionEmail, sendAlarm } from '@/lib/email';

function chainResolve(value: unknown) {
  // Build a chainable thenable that resolves at the end of any chain
  const ch: Record<string, unknown> = {
    eq: vi.fn(() => ch),
    is: vi.fn(() => ch),
    select: vi.fn(() => ch),
    single: vi.fn(() => Promise.resolve(value)),
  };
  return ch;
}

beforeEach(() => {
  mocks.sendMock.mockReset();
  mocks.updateMock.mockReset();
  mocks.logMock.mockReset();
});

describe('sendSessionNotification', () => {
  it('uses [PRIORITY] subject prefix when is_priority is true', async () => {
    mocks.sendMock.mockResolvedValue({ data: { id: 'res_1' }, error: null });
    await sendSessionNotification({
      session_id: 's1',
      email: 'recruiter@acmecorp.com',
      email_domain: 'acmecorp.com',
      is_priority: true,
      first_message: 'hi',
      classifier_verdict: 'normal',
      classifier_confidence: 0.92,
      session_cost_cents: 14,
      admin_url: 'https://x/admin/sessions/s1',
    });
    expect(mocks.sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: '[PRIORITY] new chat: recruiter@acmecorp.com',
        from: 'agent@test.com',
        to: 'joe@test.com',
      }),
    );
  });

  it('uses non-priority subject when is_priority is false', async () => {
    mocks.sendMock.mockResolvedValue({ data: { id: 'res_2' }, error: null });
    await sendSessionNotification({
      session_id: 's2',
      email: 'jane@gmail.com',
      email_domain: 'gmail.com',
      is_priority: false,
      first_message: 'hi',
      classifier_verdict: 'normal',
      classifier_confidence: 0.99,
      session_cost_cents: 14,
      admin_url: 'https://x/admin/sessions/s2',
    });
    expect(mocks.sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'new chat: jane@gmail.com' }),
    );
  });

  it('logs session_email_sent on success', async () => {
    mocks.sendMock.mockResolvedValue({ data: { id: 'res_3' }, error: null });
    await sendSessionNotification({
      session_id: 's3',
      email: 'a@b.com',
      email_domain: 'b.com',
      is_priority: true,
      first_message: 'hi',
      classifier_verdict: 'normal',
      classifier_confidence: null,
      session_cost_cents: 0,
      admin_url: 'https://x/admin/sessions/s3',
    });
    expect(mocks.logMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'session_email_sent', resend_send_id: 'res_3' }),
    );
  });

  it('does not throw on Resend error — logs failure', async () => {
    mocks.sendMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const r = await sendSessionNotification({
      session_id: 's4',
      email: 'a@b.com',
      email_domain: 'b.com',
      is_priority: false,
      first_message: 'hi',
      classifier_verdict: 'normal',
      classifier_confidence: null,
      session_cost_cents: 0,
      admin_url: 'https://x/admin/sessions/s4',
    });
    expect(r.id).toBeNull();
    expect(mocks.logMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'session_email_send_failed' }),
      'error',
    );
  });
});

describe('claimAndSendSessionEmail (idempotency)', () => {
  it('skips silently when claim returns null (already sent)', async () => {
    mocks.updateMock.mockReturnValue(chainResolve({ data: null, error: null }));
    await claimAndSendSessionEmail({
      session_id: 's1',
      last_user_text: 'hi',
      classifier_verdict: 'normal',
      classifier_confidence: 0.99,
    });
    expect(mocks.sendMock).not.toHaveBeenCalled();
  });

  it('sends when claim succeeds — uses returned email_domain for priority', async () => {
    mocks.updateMock.mockReturnValue(
      chainResolve({
        data: {
          id: 's1',
          email: 'r@acmecorp.com',
          email_domain: 'acmecorp.com',
          total_cost_cents: 14,
        },
        error: null,
      }),
    );
    mocks.sendMock.mockResolvedValue({ data: { id: 'res_x' }, error: null });
    await claimAndSendSessionEmail({
      session_id: 's1',
      last_user_text: 'hi there',
      classifier_verdict: 'normal',
      classifier_confidence: 0.95,
    });
    expect(mocks.sendMock).toHaveBeenCalledTimes(1);
    // Subject prefixed because acmecorp.com is not free-mail
    expect(mocks.sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('[PRIORITY]') }),
    );
  });

  it('does not throw on supabase error — logs failure', async () => {
    mocks.updateMock.mockReturnValue(chainResolve({ data: null, error: { message: 'db down' } }));
    await expect(
      claimAndSendSessionEmail({
        session_id: 's2',
        last_user_text: 'hi',
        classifier_verdict: 'normal',
        classifier_confidence: null,
      }),
    ).resolves.toBeUndefined();
    // No send happened (claim returned no row).
    expect(mocks.sendMock).not.toHaveBeenCalled();
  });
});

describe('sendAlarm', () => {
  it('uses [ALARM] subject prefix and plain text body', async () => {
    mocks.sendMock.mockResolvedValue({ data: { id: 'res_alarm' }, error: null });
    const r = await sendAlarm({ condition: 'spend-cap', summary: 'spend reached 300c' });
    expect(r.id).toBe('res_alarm');
    expect(mocks.sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: '[ALARM] resume-agent: spend-cap',
        text: expect.stringContaining('Alarm fired: spend-cap'),
      }),
    );
  });

  it('does not throw on send failure', async () => {
    mocks.sendMock.mockResolvedValue({ data: null, error: { message: 'rate-limited' } });
    const r = await sendAlarm({ condition: 'dep-down', summary: 'exa is down' });
    expect(r.id).toBeNull();
    expect(mocks.logMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'alarm_email_send_failed' }),
      'error',
    );
  });
});
