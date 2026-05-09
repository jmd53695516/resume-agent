// tests/e2e/cat-06-admin-403.spec.ts
// Phase 5 Plan 05-07 Task 2 — Cat 6 EVAL-08 sub-clause: non-admin GitHub login
// → 403 (NotAuthorized) at the page-rendering layer.
//
// Scope: server-side requireAdmin() guard renders <NotAuthorized /> for
// unauthenticated visitors hitting /admin/* pages. There is no /api/admin/*
// route surface yet (Phase 4 used per-page server-component guards; the admin
// API surface lands in Plan 05-08+). This spec asserts the page-layer guard.
//
// Two test paths:
//   1. Direct navigation to /admin/sessions without a session cookie →
//      NotAuthorized renders (the (authed) layout's requireAdmin() returns null
//      and the layout's null-check renders <NotAuthorized />).
//   2. Negative path: /admin/login is publicly accessible (sibling to (authed)
//      group) — its presence confirms the route group isolates auth from public
//      shell.
//
// T-05-07-04 mitigation: assert BOTH the NotAuthorized text AND that the
// admin nav (e.g., a "Sessions" link) is NOT present — guards against a
// regression where guard returns null but content somehow leaks past.
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
if (!process.env.BASE_URL) {
  // eslint-disable-next-line no-console
  console.warn('[cat-06] BASE_URL not set; defaulting to http://localhost:3000 — eval CLI should set this');
}

test.describe('cat-06: admin 403 surface (EVAL-08 / D-A-03)', () => {
  test('unauthenticated /admin/sessions renders NotAuthorized', async ({ page, context }) => {
    // Ensure no session cookies
    await context.clearCookies();
    await page.goto(BASE_URL + '/admin/sessions');
    // NotAuthorized's headline is "Access denied"
    await expect(page.getByRole('heading', { name: /Access denied/i })).toBeVisible();
    // The sub-copy mentions the GitHub allowlist
    await expect(page.getByText(/not on the admin allowlist/i)).toBeVisible();
    // Guard correctness: admin content (e.g., a Sessions table) MUST NOT render.
    // Sessions table uses a heading like "Sessions" — assert it is absent.
    const sessionsHeading = page.getByRole('heading', { name: /^sessions$/i });
    await expect(sessionsHeading).toHaveCount(0);
  });

  test('unauthenticated /admin/cost renders NotAuthorized', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto(BASE_URL + '/admin/cost');
    await expect(page.getByRole('heading', { name: /Access denied/i })).toBeVisible();
  });

  test('unauthenticated /admin/health renders NotAuthorized', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto(BASE_URL + '/admin/health');
    await expect(page.getByRole('heading', { name: /Access denied/i })).toBeVisible();
  });

  test('/admin/login is publicly accessible (route group isolates public shell)', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto(BASE_URL + '/admin/login');
    // Login page should NOT render NotAuthorized — it's the entry to admin auth.
    await expect(page.getByRole('heading', { name: /Access denied/i })).toHaveCount(0);
  });
});
