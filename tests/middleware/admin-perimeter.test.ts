// tests/middleware/admin-perimeter.test.ts
// Phase 4 Plan 04-02 Task 3 — TDD coverage for src/proxy.ts (Next.js 16
// admin perimeter; renamed from middleware.ts in Next.js 16 — RESEARCH §8).
import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() container — same pattern as tests/lib/admin-auth.test.ts.
const mocks = vi.hoisted(() => ({
  getClaimsMock: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getClaims: mocks.getClaimsMock },
  })),
}));

const { getClaimsMock } = mocks;

// process.env knobs (mutated per-test).
beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ['eyJ', 'test'].join('.');
  process.env.ADMIN_GITHUB_LOGINS = 'joedollinger, alice';
  getClaimsMock.mockReset();
});

import { proxy, config } from '@/proxy';
import { NextRequest } from 'next/server';

function makeReq(path: string): NextRequest {
  const url = `https://example.com${path}`;
  return new NextRequest(url);
}

describe('proxy()', () => {
  it('redirects to /admin/login when unauthenticated', async () => {
    getClaimsMock.mockResolvedValue({ data: null });
    const res = await proxy(makeReq('/admin/sessions'));
    // NextResponse.redirect default status is 307 (temporary).
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/admin/login');
  });

  it('redirects when authed but login not in allowlist', async () => {
    getClaimsMock.mockResolvedValue({
      data: { claims: { user_metadata: { user_name: 'mallory' } } },
    });
    const res = await proxy(makeReq('/admin/sessions'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/admin/login');
  });

  it('passes through (next) for allowlisted user', async () => {
    getClaimsMock.mockResolvedValue({
      data: { claims: { user_metadata: { user_name: 'JoeDollinger' } } },
    });
    const res = await proxy(makeReq('/admin/sessions'));
    // NextResponse.next has status 200 (no Location header).
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects /api/admin/* unauth requests too', async () => {
    getClaimsMock.mockResolvedValue({ data: null });
    const res = await proxy(makeReq('/api/admin/sessions'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/admin/login');
  });
});

describe('config.matcher', () => {
  it('matches /admin/sessions but not /admin/login', () => {
    // Light structural check — the matcher is a glob-ish regex string.
    // Next.js evaluates this at build time; here we just verify the
    // exclusion pattern is present.
    expect(config.matcher).toContain('/admin/((?!login(?:/|$)).*)');
    expect(config.matcher).toContain('/api/admin/:path*');
  });
});
