import { test, expect } from '@playwright/test';

/**
 * Plan 02-03 smoke test: confirms the empty-state chat UI renders correctly
 * after a recruiter submits an email on the landing page.
 *
 * Scope: UI contracts only. No API call to /api/chat is made — this test
 * validates CHAT-14 (three starter-prompt buttons visible in empty state)
 * and the prefill-not-submit behavior. Full streaming e2e is a manual
 * verification step in Task 4.
 */

test.describe('Chat UI — empty state + starter prompts (CHAT-14)', () => {
  test('landing → email submit → /chat loads with 3 starter buttons', async ({ page }) => {
    // Bypass the /api/session call by setting session_id directly (this test
    // doesn't exercise GATE flow — Plan 01-03's e2e covers that).
    await page.goto('/chat');
    await page.evaluate(() => {
      sessionStorage.setItem('session_id', 'test-session-id-for-chat-ui-spec');
    });
    await page.reload();

    // Empty state shows the starter-prompts group
    const group = page.getByTestId('starter-prompts');
    await expect(group).toBeVisible();

    // Exactly 3 starter buttons visible
    const buttons = group.locator('button');
    await expect(buttons).toHaveCount(3);

    // The three labels are correct per CONTEXT D-I-03
    await expect(page.getByTestId('starter-pitch-me-on-my-company')).toBeVisible();
    await expect(page.getByTestId('starter-walk-me-through-a-project')).toBeVisible();
    await expect(page.getByTestId('starter-design-a-metric')).toBeVisible();

    // Input is empty and enabled
    const input = page.getByTestId('chat-input');
    await expect(input).toHaveValue('');
    await expect(input).toBeEnabled();

    // Send button is disabled when input is empty
    await expect(page.getByTestId('chat-send')).toBeDisabled();
  });

  test('clicking a starter button prefills input WITHOUT submitting', async ({ page }) => {
    await page.goto('/chat');
    await page.evaluate(() => {
      sessionStorage.setItem('session_id', 'test-session-id-for-chat-ui-spec');
    });
    await page.reload();

    // Click "Pitch me on my company" — should prefill, not submit
    await page.getByTestId('starter-pitch-me-on-my-company').click();

    // Input now contains the prefill text starting with "I'm at [my company]"
    const input = page.getByTestId('chat-input');
    await expect(input).toHaveValue(/^I'm at \[my company\]/);

    // No assistant message has appeared (button did NOT auto-submit)
    await expect(page.getByTestId('msg-assistant')).toHaveCount(0);

    // Starter prompts still visible (conversation has not advanced)
    await expect(page.getByTestId('starter-prompts')).toBeVisible();

    // Send button is now enabled because input is non-empty
    await expect(page.getByTestId('chat-send')).toBeEnabled();
  });

  test('/chat redirects to / when session_id missing', async ({ page }) => {
    await page.goto('/chat');
    // No sessionStorage set — should redirect to /
    await page.waitForURL('/', { timeout: 5000 });
  });
});
