import { describe, it, expect } from 'vitest';
import { isFreeMail, FREE_MAIL_DOMAINS } from '@/lib/free-mail-domains';

describe('isFreeMail', () => {
  it('returns true for gmail.com', () => {
    expect(isFreeMail('gmail.com')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isFreeMail('GMAIL.COM')).toBe(true);
    expect(isFreeMail('Gmail.Com')).toBe(true);
  });

  it('strips leading/trailing whitespace', () => {
    expect(isFreeMail('  yahoo.com ')).toBe(true);
  });

  it('returns false for company domains', () => {
    expect(isFreeMail('acmecorp.com')).toBe(false);
    expect(isFreeMail('stripe.com')).toBe(false);
  });

  it('returns false for empty / nullish input', () => {
    expect(isFreeMail('')).toBe(false);
    expect(isFreeMail(null)).toBe(false);
    expect(isFreeMail(undefined)).toBe(false);
  });

  it('covers the spec list of 25 domains', () => {
    expect(FREE_MAIL_DOMAINS.size).toBe(25);
    // Spot-check a few non-obvious ones from D-C-03
    expect(isFreeMail('proton.me')).toBe(true);
    expect(isFreeMail('hey.com')).toBe(true);
    expect(isFreeMail('163.com')).toBe(true);
    expect(isFreeMail('naver.com')).toBe(true);
  });
});
