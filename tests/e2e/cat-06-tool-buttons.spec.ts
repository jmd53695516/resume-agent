// tests/e2e/cat-06-tool-buttons.spec.ts
// Phase 5 Plan 05-07 Task 2 — Cat 6 EVAL-08 sub-clause: three starter-prompt
// buttons exist and prefill chat input with tool-related framing.
//
// Scope: button-presence + prefill behavior. Full tool-fire end-to-end (including
// /api/chat tool_call observation) is covered by cat 2 (tool-correctness). Cat 6
// is the *UX-shape* smoke — does the button exist, fire, prefill correctly?
//
// Per CONTEXT D-I-03 (Phase 2): starter buttons prefill, do NOT auto-submit.
// Three labels: 'Pitch me on my company', 'Walk me through a project', 'Design a metric'.
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
if (!process.env.BASE_URL) {
  // eslint-disable-next-line no-console
  console.warn('[cat-06] BASE_URL not set; defaulting to http://localhost:3000 — eval CLI should set this');
}

async function bootstrapChat(page: import('@playwright/test').Page) {
  // Bypass /api/session — establish a synthetic session_id directly so the test
  // doesn't depend on email-gate flow (covered by cat-06-email-gate spec).
  await page.goto(BASE_URL + '/chat');
  await page.evaluate(() => {
    sessionStorage.setItem('session_id', 'cat6-tool-buttons-session');
  });
  await page.reload();
}

test.describe('cat-06: starter prompt tool buttons (EVAL-08 / CHAT-14)', () => {
  test('three starter buttons render in empty state', async ({ page }) => {
    await bootstrapChat(page);
    const group = page.getByTestId('starter-prompts');
    await expect(group).toBeVisible();
    await expect(group.locator('button')).toHaveCount(3);
    await expect(page.getByTestId('starter-pitch-me-on-my-company')).toBeVisible();
    await expect(page.getByTestId('starter-walk-me-through-a-project')).toBeVisible();
    await expect(page.getByTestId('starter-design-a-metric')).toBeVisible();
  });

  test('Pitch button prefills input with research_company-flavored prompt', async ({ page }) => {
    await bootstrapChat(page);
    await page.getByTestId('starter-pitch-me-on-my-company').click();
    const input = page.getByTestId('chat-input');
    // Prefill begins with "I'm at [my company]" per CONTEXT D-I-03
    await expect(input).toHaveValue(/^I'm at \[my company\]/);
    // Send button enabled (input non-empty)
    await expect(page.getByTestId('chat-send')).toBeEnabled();
  });

  test('Walkthrough button prefills with case-study-flavored prompt', async ({ page }) => {
    await bootstrapChat(page);
    await page.getByTestId('starter-walk-me-through-a-project').click();
    const input = page.getByTestId('chat-input');
    await expect(input).toHaveValue(/walk me through|past projects/i);
    await expect(page.getByTestId('chat-send')).toBeEnabled();
  });

  test('Metric button prefills with metric-framework-flavored prompt', async ({ page }) => {
    await bootstrapChat(page);
    await page.getByTestId('starter-design-a-metric').click();
    const input = page.getByTestId('chat-input');
    await expect(input).toHaveValue(/measure|metric framework/i);
    await expect(page.getByTestId('chat-send')).toBeEnabled();
  });
});
