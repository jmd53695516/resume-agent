// tests/e2e/cat-06-email-gate.spec.ts
// Phase 5 Plan 05-07 Task 2 — Cat 6 EVAL-08 sub-clause: email gate validation.
//
// Verifies the landing-page email gate works end-to-end without a live agent:
//   - Email input + disclaimer visible above-fold
//   - Invalid email triggers inline validation (no submit)
//   - Valid email submits to /api/session, redirects to /chat, sessionStorage set
//
// Pitfall 7 mitigation: BASE_URL declared at top with fallback warning. Cat 6
// runner (cat6.ts) sets BASE_URL via spawn env to forward EVAL_TARGET_URL.
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
if (!process.env.BASE_URL) {
  // eslint-disable-next-line no-console
  console.warn('[cat-06] BASE_URL not set; defaulting to http://localhost:3000 — eval CLI should set this');
}

test.describe('cat-06: email gate (EVAL-08 / GATE-02 / GATE-04)', () => {
  test('landing page renders email input + disclaimer above fold', async ({ page }) => {
    await page.goto(BASE_URL + '/');
    // Disclaimer visible
    await expect(page.getByRole('note', { name: /agent disclosure/i })).toBeVisible();
    await expect(page.getByText(/I'm an AI agent/i)).toBeVisible();
    // Email input visible
    await expect(page.locator('input[type="email"]')).toBeVisible();
    // Submit button visible
    await expect(page.getByRole('button', { name: /Let's chat/i })).toBeVisible();
  });

  test('invalid email shows inline validation error', async ({ page }) => {
    await page.goto(BASE_URL + '/');
    const input = page.locator('input[type="email"]');
    await input.fill('abc');
    await input.blur();
    // Inline error appears (look for the zod error message text fragment)
    await expect(page.getByText(/doesn't look like a valid email/i)).toBeVisible();
    // Submit button stays disabled with invalid email
    await expect(page.getByRole('button', { name: /Let's chat/i })).toBeDisabled();
  });

  test('valid email submits and lands on /chat with session_id set', async ({ page }) => {
    await page.goto(BASE_URL + '/');
    const input = page.locator('input[type="email"]');
    await input.fill('cat6-eval@example.com');

    // Click submit and wait for navigation
    await Promise.all([
      page.waitForURL('**/chat', { timeout: 10000 }),
      page.getByRole('button', { name: /Let's chat/i }).click(),
    ]);

    // sessionStorage.session_id was set before redirect
    const sessionId = await page.evaluate(() => sessionStorage.getItem('session_id'));
    expect(sessionId).toBeTruthy();
    expect(sessionId!.length).toBeGreaterThan(0);
  });
});
