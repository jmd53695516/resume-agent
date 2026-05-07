import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() container — Plan 04-06 multi-mock pattern.
const mocks = vi.hoisted(() => ({
  CRON_SECRET: ['p', 'q'].join('').repeat(20), // 40 chars (>= 32 min)
  findCandidates: vi.fn(),
  archiveSession: vi.fn(),
  deleteClassifierFlags90d: vi.fn(),
  log: vi.fn(),
}));

vi.mock('@/lib/env', () => ({ env: { CRON_SECRET: mocks.CRON_SECRET } }));

vi.mock('@/lib/archive', () => ({
  findArchiveCandidates: mocks.findCandidates,
  archiveSession: mocks.archiveSession,
  deleteClassifierFlags90d: mocks.deleteClassifierFlags90d,
}));

vi.mock('@/lib/logger', () => ({ log: mocks.log }));

import { POST } from '@/app/api/cron/archive/route';

function makeReq(opts: { auth?: string; method?: string }) {
  const headers = new Headers();
  if (opts.auth) headers.set('authorization', opts.auth);
  return new Request('https://x/api/cron/archive', {
    method: opts.method ?? 'POST',
    headers,
  });
}

beforeEach(() => {
  mocks.findCandidates.mockReset();
  mocks.archiveSession.mockReset();
  mocks.deleteClassifierFlags90d.mockReset();
  mocks.log.mockReset();
});

describe('POST /api/cron/archive', () => {
  it('returns 401 without auth', async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(401);
    expect(mocks.findCandidates).not.toHaveBeenCalled();
  });

  it('returns 401 with GET method even with correct token', async () => {
    const res = await POST(makeReq({ method: 'GET', auth: `Bearer ${mocks.CRON_SECRET}` }));
    expect(res.status).toBe(401);
  });

  it('runs archive + classifier purge on happy path', async () => {
    mocks.findCandidates.mockResolvedValue(['s1', 's2']);
    mocks.archiveSession
      .mockResolvedValueOnce({ rows_archived: 12, uploaded: true })
      .mockResolvedValueOnce({ rows_archived: 7, uploaded: true });
    mocks.deleteClassifierFlags90d.mockResolvedValue(3);

    const res = await POST(makeReq({ auth: `Bearer ${mocks.CRON_SECRET}` }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessions_archived).toBe(2);
    expect(body.rows_archived).toBe(19);
    expect(body.rows_deleted_classifier_90d).toBe(3);
    expect(body.errors).toEqual([]);
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'archive_run',
        sessions_archived: 2,
        rows_archived: 19,
        rows_deleted_classifier_90d: 3,
      }),
    );
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'cron_run',
        cron_name: 'archive',
        status: 'ok',
        items_processed: 2,
      }),
    );
  });

  it('continues past per-session errors', async () => {
    mocks.findCandidates.mockResolvedValue(['s1', 's_bad', 's3']);
    mocks.archiveSession
      .mockResolvedValueOnce({ rows_archived: 5, uploaded: true })
      .mockRejectedValueOnce(new Error('storage hiccup'))
      .mockResolvedValueOnce({ rows_archived: 8, uploaded: true });
    mocks.deleteClassifierFlags90d.mockResolvedValue(0);

    const res = await POST(makeReq({ auth: `Bearer ${mocks.CRON_SECRET}` }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessions_archived).toBe(2); // s1 + s3 succeed, s_bad in errors
    expect(body.errors).toEqual(['s_bad: storage hiccup']);
    // status: 'partial' when errors > 0
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'cron_run',
        cron_name: 'archive',
        status: 'partial',
      }),
    );
  });

  it('returns 500 on top-level error (e.g. findArchiveCandidates throws)', async () => {
    mocks.findCandidates.mockRejectedValue(new Error('db down'));

    const res = await POST(makeReq({ auth: `Bearer ${mocks.CRON_SECRET}` }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'internal' });
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'cron_run',
        cron_name: 'archive',
        status: 'error',
        error_message: 'db down',
      }),
      'error',
    );
  });

  it('handles zero candidates cleanly', async () => {
    mocks.findCandidates.mockResolvedValue([]);
    mocks.deleteClassifierFlags90d.mockResolvedValue(0);

    const res = await POST(makeReq({ auth: `Bearer ${mocks.CRON_SECRET}` }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessions_archived).toBe(0);
    expect(body.rows_archived).toBe(0);
    expect(body.rows_deleted_classifier_90d).toBe(0);
    expect(mocks.archiveSession).not.toHaveBeenCalled();
    // Classifier purge ALWAYS runs even with zero archive candidates
    expect(mocks.deleteClassifierFlags90d).toHaveBeenCalledOnce();
  });
});
