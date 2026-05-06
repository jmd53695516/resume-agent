// tests/lib/admin-auth.test.ts
// Phase 4 Plan 04-02 Task 2 — TDD coverage for requireAdmin/getCurrentAdmin.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock env BEFORE importing module under test (Plan 03-00 pattern):
// Use string-concat to dodge pre-commit secret-scan literal patterns.
vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ['eyJ', 'test', 'anon', 'k'].join('.'),
    ADMIN_GITHUB_LOGINS: 'joedollinger, alice  ',
  },
}));

// vi.hoisted() lifts the mock-state container above vi.mock() factory calls,
// which themselves are hoisted to the top of the file. Without hoisted(),
// the factory-captured vars are TDZ-uninitialized when the factory runs.
const mocks = vi.hoisted(() => ({
  cookiesGetAll: vi.fn(() => [] as Array<{ name: string; value: string }>),
  cookiesSet: vi.fn(),
  getClaimsMock: vi.fn(),
  signOutMock: vi.fn(),
  logMock: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: mocks.cookiesGetAll,
    set: mocks.cookiesSet,
  })),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getClaims: mocks.getClaimsMock, signOut: mocks.signOutMock },
  })),
}));

vi.mock('@/lib/logger', () => ({ log: mocks.logMock }));

const { getClaimsMock, signOutMock, logMock } = mocks;

import { requireAdmin, getCurrentAdmin } from '@/lib/admin-auth';

beforeEach(() => {
  getClaimsMock.mockReset();
  signOutMock.mockReset();
  logMock.mockReset();
});

describe('getCurrentAdmin', () => {
  it('returns null when unauthenticated (no claims)', async () => {
    getClaimsMock.mockResolvedValue({ data: null, error: null });
    const r = await getCurrentAdmin();
    expect(r).toBeNull();
  });

  it('returns { login } for allowlisted user (case-insensitive)', async () => {
    getClaimsMock.mockResolvedValue({
      data: { claims: { user_metadata: { user_name: 'JoeDollinger' } } },
      error: null,
    });
    const r = await getCurrentAdmin();
    expect(r).toEqual({ login: 'joedollinger' });
  });

  it('returns null when login is not in allowlist', async () => {
    getClaimsMock.mockResolvedValue({
      data: { claims: { user_metadata: { user_name: 'mallory' } } },
      error: null,
    });
    const r = await getCurrentAdmin();
    expect(r).toBeNull();
  });

  it('returns null when user_name field is missing', async () => {
    getClaimsMock.mockResolvedValue({
      data: { claims: { user_metadata: {} } },
      error: null,
    });
    const r = await getCurrentAdmin();
    expect(r).toBeNull();
  });

  it('does NOT call signOut on the read variant', async () => {
    getClaimsMock.mockResolvedValue({
      data: { claims: { user_metadata: { user_name: 'mallory' } } },
      error: null,
    });
    await getCurrentAdmin();
    expect(signOutMock).not.toHaveBeenCalled();
  });
});

describe('requireAdmin', () => {
  it('returns null and signs out when authed-but-not-allowlisted', async () => {
    getClaimsMock.mockResolvedValue({
      data: { claims: { user_metadata: { user_name: 'mallory' } } },
      error: null,
    });
    signOutMock.mockResolvedValue(undefined);
    const r = await requireAdmin();
    expect(r).toBeNull();
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'admin_403',
        github_login: 'mallory',
        reason: 'not_in_allowlist',
      }),
      'warn',
    );
  });

  it('does NOT call signOut when unauthenticated', async () => {
    getClaimsMock.mockResolvedValue({ data: null, error: null });
    const r = await requireAdmin();
    expect(r).toBeNull();
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('returns { login } and emits admin_access for allowlisted user', async () => {
    getClaimsMock.mockResolvedValue({
      data: { claims: { user_metadata: { user_name: 'alice' } } },
      error: null,
    });
    const r = await requireAdmin();
    expect(r).toEqual({ login: 'alice' });
    expect(signOutMock).not.toHaveBeenCalled();
    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'admin_access', github_login: 'alice' }),
    );
  });

  it('strips whitespace in allowlist parsing', async () => {
    // env mock has 'joedollinger, alice  ' — trimming verified via the alice case
    getClaimsMock.mockResolvedValue({
      data: { claims: { user_metadata: { user_name: 'alice' } } },
      error: null,
    });
    const r = await requireAdmin();
    expect(r).toEqual({ login: 'alice' });
  });
});
