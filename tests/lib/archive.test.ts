import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gunzipSync } from 'zlib';

// vi.hoisted() so vi.mock factories can reference these (Plan 04-06 pattern).
const mocks = vi.hoisted(() => ({
  uploadMock: vi.fn(),
  selectMock: vi.fn(),
  deleteMock: vi.fn(),
  storageFromMock: vi.fn(),
  fromMock: vi.fn(),
  logMock: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: { SUPABASE_STORAGE_ARCHIVE_BUCKET: 'transcripts-archive' },
}));

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    storage: { from: mocks.storageFromMock },
    from: mocks.fromMock,
  },
}));

vi.mock('@/lib/logger', () => ({ log: mocks.logMock }));

import {
  buildJsonlGzip,
  archiveSession,
  deleteClassifierFlags90d,
  findArchiveCandidates,
} from '@/lib/archive';

/**
 * Build a thenable chain for supabase-js builders. Resolves to `value` at any
 * chain depth. Mirrors Plan 04-06 alarms.test.ts chain() helper.
 */
function chain(value: unknown) {
  const c: Record<string, unknown> = {};
  const ret = () => c;
  c.eq = ret;
  c.gte = ret;
  c.lt = ret;
  c.order = ret;
  c.not = ret;
  c.neq = ret;
  c.like = ret;
  c.limit = ret;
  c.then = (resolve: (v: unknown) => void) => Promise.resolve(value).then(resolve);
  return c;
}

beforeEach(() => {
  mocks.uploadMock.mockReset();
  mocks.selectMock.mockReset();
  mocks.deleteMock.mockReset();
  mocks.storageFromMock.mockReset();
  mocks.fromMock.mockReset();
  mocks.logMock.mockReset();

  // Default wiring: storage.from(bucket).upload(...) → uploadMock
  mocks.storageFromMock.mockReturnValue({ upload: mocks.uploadMock });
  // Default wiring: db.from('messages').select(...) / .delete(...)
  mocks.fromMock.mockReturnValue({
    select: mocks.selectMock,
    delete: mocks.deleteMock,
  });
});

describe('buildJsonlGzip', () => {
  it('round-trips JSONL through gzip', () => {
    const rows = [{ a: 1 }, { a: 2 }, { a: 3 }];
    const buf = buildJsonlGzip(rows);
    const decoded = gunzipSync(buf).toString('utf8');
    const lines = decoded.trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0])).toEqual({ a: 1 });
    expect(JSON.parse(lines[1])).toEqual({ a: 2 });
    expect(JSON.parse(lines[2])).toEqual({ a: 3 });
  });

  it('returns valid gzip on empty rows', () => {
    const buf = buildJsonlGzip([]);
    expect(gunzipSync(buf).toString('utf8')).toBe('');
  });
});

describe('findArchiveCandidates', () => {
  it('returns deduped session_ids capped at maxSessions', async () => {
    mocks.selectMock.mockReturnValue(
      chain({
        data: [
          { session_id: 's1' },
          { session_id: 's1' }, // duplicate — must be deduped
          { session_id: 's2' },
          { session_id: 's3' },
        ],
        error: null,
      }),
    );
    const ids = await findArchiveCandidates(2);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe('s1');
    expect(ids[1]).toBe('s2');
  });

  it('returns [] on supabase error and logs', async () => {
    mocks.selectMock.mockReturnValue(chain({ data: null, error: { message: 'db down' } }));
    const ids = await findArchiveCandidates(100);
    expect(ids).toEqual([]);
    expect(mocks.logMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'archive_find_candidates_failed' }),
      'error',
    );
  });
});

describe('archiveSession', () => {
  it('uploads first, then deletes (Pitfall 9 order)', async () => {
    const callOrder: string[] = [];
    mocks.selectMock.mockReturnValue(
      chain({
        data: [
          { id: 'm1', session_id: 's1', content: 'hi', created_at: new Date(0).toISOString() },
        ],
        error: null,
      }),
    );
    mocks.uploadMock.mockImplementation(async () => {
      callOrder.push('upload');
      return { error: null };
    });
    mocks.deleteMock.mockImplementation(() => {
      callOrder.push('delete');
      return chain({ data: null, error: null, count: 1 });
    });

    const result = await archiveSession('s1');
    expect(callOrder).toEqual(['upload', 'delete']);
    expect(result.uploaded).toBe(true);
    expect(result.rows_archived).toBe(1);
  });

  it('does NOT delete when upload fails (Pitfall 9 fail-safe)', async () => {
    mocks.selectMock.mockReturnValue(
      chain({
        data: [
          { id: 'm1', session_id: 's1', content: 'hi', created_at: new Date(0).toISOString() },
        ],
        error: null,
      }),
    );
    mocks.uploadMock.mockResolvedValue({ error: { message: 'storage down' } });

    const result = await archiveSession('s1');
    expect(result.uploaded).toBe(false);
    expect(result.rows_archived).toBe(0);
    expect(mocks.deleteMock).not.toHaveBeenCalled();
    expect(mocks.logMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'archive_upload_failed' }),
      'error',
    );
  });

  it('returns rows_archived=0 when session has no messages (already archived)', async () => {
    mocks.selectMock.mockReturnValue(chain({ data: [], error: null }));
    const result = await archiveSession('s_empty');
    expect(result.rows_archived).toBe(0);
    expect(result.uploaded).toBe(false);
    expect(mocks.uploadMock).not.toHaveBeenCalled();
  });

  it('uploads to archive/<yyyy>/<mm>/<id>.jsonl.gz path with gzip content type', async () => {
    mocks.selectMock.mockReturnValue(
      chain({
        data: [{ id: 'm1', session_id: 's_path', content: 'x', created_at: '2020-01-01T00:00:00Z' }],
        error: null,
      }),
    );
    mocks.uploadMock.mockResolvedValue({ error: null });
    mocks.deleteMock.mockReturnValue(chain({ data: null, error: null, count: 1 }));

    await archiveSession('s_path');

    expect(mocks.storageFromMock).toHaveBeenCalledWith('transcripts-archive');
    const [pathArg, , optsArg] = mocks.uploadMock.mock.calls[0] as [string, Buffer, { contentType: string; upsert: boolean }];
    expect(pathArg).toMatch(/^archive\/\d{4}\/\d{2}\/s_path\.jsonl\.gz$/);
    expect(optsArg).toEqual({ contentType: 'application/gzip', upsert: true });
  });

  it('returns uploaded=true rows_archived=0 on delete error after successful upload', async () => {
    mocks.selectMock.mockReturnValue(
      chain({
        data: [{ id: 'm1', session_id: 's1', content: 'x', created_at: '2020-01-01T00:00:00Z' }],
        error: null,
      }),
    );
    mocks.uploadMock.mockResolvedValue({ error: null });
    mocks.deleteMock.mockReturnValue(chain({ data: null, error: { message: 'delete failed' }, count: null }));

    const result = await archiveSession('s1');
    expect(result.uploaded).toBe(true);
    expect(result.rows_archived).toBe(0);
    expect(mocks.logMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'archive_session_delete_failed' }),
      'error',
    );
  });
});

describe('deleteClassifierFlags90d', () => {
  it('runs two deletes (classifier + deflection) and sums counts', async () => {
    mocks.deleteMock
      .mockReturnValueOnce(chain({ data: null, error: null, count: 3 }))
      .mockReturnValueOnce(chain({ data: null, error: null, count: 5 }));
    const total = await deleteClassifierFlags90d();
    expect(total).toBe(8);
  });

  it('counts only the successful delete when one errors', async () => {
    mocks.deleteMock
      .mockReturnValueOnce(chain({ data: null, error: null, count: 4 }))
      .mockReturnValueOnce(chain({ data: null, error: { message: 'boom' }, count: null }));
    const total = await deleteClassifierFlags90d();
    expect(total).toBe(4);
    expect(mocks.logMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'classifier_purge_failed', kind: 'deflection' }),
      'error',
    );
  });
});
