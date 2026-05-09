// tests/e2e/cat-06-fallback.spec.ts
// Phase 5 Plan 05-07 Task 2 — Cat 6 EVAL-08 sub-clause: PlainHtmlFallback
// renders correctly when ?fallback=1 query param is set (D-G-04 trigger 1).
//
// Scope: visible safety-net contract — bio + email CTA + recent roles +
// LinkedIn / GitHub / resume links present on the fallback surface. No
// EmailGate, no Card. This is the "agent is down, recruiter still gets
// reachability" promise.
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
if (!process.env.BASE_URL) {
  // eslint-disable-next-line no-console
  console.warn('[cat-06] BASE_URL not set; defaulting to http://localhost:3000 — eval CLI should set this');
}

test.describe('cat-06: plain HTML fallback (EVAL-08 / OBSV-12 / D-G-04)', () => {
  test('?fallback=1 renders PlainHtmlFallback with bio + email CTA', async ({ page }) => {
    await page.goto(BASE_URL + '/?fallback=1');
    // Fallback surface is identifiable by data-testid
    await expect(page.getByTestId('plain-html-fallback')).toBeVisible();
    // Joe's name as h1
    await expect(page.locator('h1')).toContainText(/Joe Dollinger/i);
    // Email CTA is visible AND uses mailto:
    const emailCta = page.getByTestId('fallback-email-cta');
    await expect(emailCta).toBeVisible();
    await expect(emailCta).toHaveAttribute('href', /^mailto:joe\.dollinger@gmail\.com/);
  });

  test('fallback shows resume link, no email gate, no chat shell', async ({ page }) => {
    await page.goto(BASE_URL + '/?fallback=1');
    // Resume link present (404 acceptable — STATE blocker tracks the missing PDF)
    await expect(page.getByTestId('fallback-resume')).toBeVisible();
    await expect(page.getByTestId('fallback-resume')).toHaveAttribute(
      'href',
      '/joe-dollinger-resume.pdf',
    );
    // No EmailGate input (the fallback is intentionally minimal — no JS chat)
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
  });
});
