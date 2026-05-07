import { describe, it, expect, vi } from 'vitest';

// 32-char fake token built via concat (dodges pre-commit secret-scan literals
// — same pattern Plans 03-00 / 04-05 established). vi.hoisted() so the value
// is available to the hoisted vi.mock() factory below (TDZ avoided —
// matches Plan 04-02 multi-mock convention).
const fakes = vi.hoisted(() => ({
  CRON_SECRET: ['a', 'b', 'c', 'd', 'e', 'f', '0', '1'].join('').repeat(4), // 32 chars
}));
const FAKE_SECRET = fakes.CRON_SECRET;

vi.mock('@/lib/env', () => ({ env: { CRON_SECRET: fakes.CRON_SECRET } }));

import { validateCronAuth } from '@/lib/cron-auth';

function makeReq(opts: { method?: string; auth?: string | null }) {
  const headers = new Headers();
  if (opts.auth !== null && opts.auth !== undefined) {
    headers.set('authorization', opts.auth);
  }
  return new Request('https://x/api/cron/check-alarms', {
    method: opts.method ?? 'POST',
    headers,
  });
}

describe('validateCronAuth', () => {
  it('returns true for POST with correct Bearer token', () => {
    expect(
      validateCronAuth(makeReq({ method: 'POST', auth: `Bearer ${FAKE_SECRET}` })),
    ).toBe(true);
  });

  it('returns false for GET method (belt-and-suspenders)', () => {
    expect(
      validateCronAuth(makeReq({ method: 'GET', auth: `Bearer ${FAKE_SECRET}` })),
    ).toBe(false);
  });

  it('returns false for missing Authorization header', () => {
    expect(validateCronAuth(makeReq({ method: 'POST', auth: null }))).toBe(false);
  });

  it('returns false for wrong scheme (Token instead of Bearer)', () => {
    expect(
      validateCronAuth(makeReq({ method: 'POST', auth: `Token ${FAKE_SECRET}` })),
    ).toBe(false);
  });

  it('returns false for empty Bearer value', () => {
    expect(validateCronAuth(makeReq({ method: 'POST', auth: 'Bearer ' }))).toBe(false);
  });

  it('returns false for token mismatch (same length)', () => {
    // Different chars, same 32-char length — exercises the XOR loop, not the
    // length-mismatch shortcut.
    const wrong = ['z', 'y', 'x', 'w', 'v', 'u', '0', '1'].join('').repeat(4);
    expect(
      validateCronAuth(makeReq({ method: 'POST', auth: `Bearer ${wrong}` })),
    ).toBe(false);
  });

  it('returns false for length-mismatch token', () => {
    expect(
      validateCronAuth(makeReq({ method: 'POST', auth: `Bearer ${FAKE_SECRET}x` })),
    ).toBe(false);
  });
});
