import { test, expect } from '@playwright/test';

/**
 * Phase 05.2 cat6 spec: ViewToggle round-trip + body-class side effect.
 *
 * Covers:
 * - Both pill buttons visible with correct labels (D-B-02 LOCKED)
 * - Initial state: Light Mode active per D-B-03 (literal initial 'chat')
 * - Click Dark Mode → body has matrix-mode class → MatrixRain canvas in DOM
 * - Click Light Mode → body class removed → MatrixRain canvas removed
 * - Pill NOT visible on framing page / (D-C-01 — out of scope)
 * - Body class cleanup on navigation away from /chat (Pitfall 2)
 *
 * Bypass-sessionId pattern (matches chat-happy-path.spec.ts):
 *   await page.goto('/chat');
 *   await page.evaluate(() => sessionStorage.setItem('session_id', '...'));
 *   await page.reload();
 */

const TEST_SESSION_ID = 'test-session-id-for-view-toggle-spec';

async function bypassEmailGate(page: import('@playwright/test').Page) {
  await page.goto('/chat');
  await page.evaluate((sid) => {
    sessionStorage.setItem('session_id', sid);
  }, TEST_SESSION_ID);
  await page.reload();
}

test.describe('Chat — view toggle (D-A-04, D-B-01..03)', () => {
  test('pill renders on /chat with Light Mode active by default', async ({ page }) => {
    await bypassEmailGate(page);

    const toggle = page.getByTestId('view-toggle');
    await expect(toggle).toBeVisible();

    const lightBtn = page.getByTestId('view-toggle-light');
    const darkBtn = page.getByTestId('view-toggle-dark');

    await expect(lightBtn).toBeVisible();
    await expect(darkBtn).toBeVisible();

    // Cheeky labels per D-B-02 — DO NOT flatten to "Chat"/"Matrix"
    await expect(lightBtn).toContainText('Light Mode');
    await expect(darkBtn).toContainText('Dark Mode');

    // Initial state: Light Mode active (D-B-03 literal 'chat' initial)
    await expect(lightBtn).toHaveAttribute('aria-selected', 'true');
    await expect(darkBtn).toHaveAttribute('aria-selected', 'false');

    // Body has NO matrix-mode class initially
    const initialClass = await page.evaluate(() =>
      document.body.classList.contains('matrix-mode'),
    );
    expect(initialClass).toBe(false);

    // MatrixRain canvas is NOT in DOM (conditionally mounted per Plan 05)
    await expect(page.getByTestId('matrix-canvas')).toHaveCount(0);
  });

  test('clicking Dark Mode adds body.matrix-mode and mounts MatrixRain canvas', async ({ page }) => {
    await bypassEmailGate(page);

    const lightBtn = page.getByTestId('view-toggle-light');
    const darkBtn = page.getByTestId('view-toggle-dark');

    await darkBtn.click();

    // aria-selected flips
    await expect(darkBtn).toHaveAttribute('aria-selected', 'true');
    await expect(lightBtn).toHaveAttribute('aria-selected', 'false');

    // Body class added (Plan 05.2-04 useEffect side effect)
    await expect.poll(async () =>
      page.evaluate(() => document.body.classList.contains('matrix-mode')),
    ).toBe(true);

    // MatrixRain canvas mounted (Plan 05.2-05 conditional mount).
    // Use locator + waitFor because next/dynamic loads the chunk async.
    await expect(page.getByTestId('matrix-rain-stage')).toBeVisible();
    await expect(page.getByTestId('matrix-canvas')).toBeAttached();
  });

  test('clicking back to Light Mode removes body.matrix-mode and unmounts MatrixRain', async ({ page }) => {
    await bypassEmailGate(page);

    const lightBtn = page.getByTestId('view-toggle-light');
    const darkBtn = page.getByTestId('view-toggle-dark');

    // First go to dark
    await darkBtn.click();
    await expect.poll(async () =>
      page.evaluate(() => document.body.classList.contains('matrix-mode')),
    ).toBe(true);
    await expect(page.getByTestId('matrix-canvas')).toBeAttached();

    // Then back to light
    await lightBtn.click();

    await expect(lightBtn).toHaveAttribute('aria-selected', 'true');
    await expect(darkBtn).toHaveAttribute('aria-selected', 'false');

    // Body class removed
    await expect.poll(async () =>
      page.evaluate(() => document.body.classList.contains('matrix-mode')),
    ).toBe(false);

    // Canvas unmounted (conditional render)
    await expect(page.getByTestId('matrix-canvas')).toHaveCount(0);
  });

  test('pill is NOT visible on framing page / (D-C-01 out of scope)', async ({ page }) => {
    await page.goto('/');
    // ViewToggle is mounted only at /chat. Framing page should NOT have it.
    await expect(page.getByTestId('view-toggle')).toHaveCount(0);
  });

  test('navigating away from /chat in matrix mode strips body.matrix-mode (Pitfall 2)', async ({ page }) => {
    await bypassEmailGate(page);

    const darkBtn = page.getByTestId('view-toggle-dark');
    await darkBtn.click();
    await expect.poll(async () =>
      page.evaluate(() => document.body.classList.contains('matrix-mode')),
    ).toBe(true);

    // Navigate away (use the framing page; admin requires auth)
    await page.goto('/');

    // Cleanup function in chat/page.tsx useEffect should have stripped the class
    const stillMatrix = await page.evaluate(() =>
      document.body.classList.contains('matrix-mode'),
    );
    expect(stillMatrix).toBe(false);
  });
});
