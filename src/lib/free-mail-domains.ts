// src/lib/free-mail-domains.ts
// Phase 4 D-C-03 — free-mail allowlist for the [PRIORITY] subject prefix.
// A recruiter writing from a non-free-mail domain is treated as
// company-domain priority (likely real recruiter context).
//
// The list is deliberately Claude-curated; expand as Joe encounters
// real-world domains during the job search. Strict-match against the
// already-lowercased email_domain stored on sessions row.

export const FREE_MAIL_DOMAINS: ReadonlySet<string> = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'protonmail.com',
  'proton.me',
  'aol.com',
  'mail.com',
  'yandex.com',
  'yandex.ru',
  'gmx.com',
  'gmx.de',
  'fastmail.com',
  'fastmail.fm',
  'pm.me',
  'hey.com',
  'duck.com',
  'qq.com',
  '163.com',
  'naver.com',
]);

export function isFreeMail(domain: string | null | undefined): boolean {
  if (!domain || typeof domain !== 'string') return false;
  return FREE_MAIL_DOMAINS.has(domain.trim().toLowerCase());
}
