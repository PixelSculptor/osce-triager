import { test, expect } from '@playwright/test';

// Risk anchor: Risk #8 (context/foundation/test-plan.md)
// "auth.setup.ts loads a saved user.json instead of filling the login form.
//  Any change to the login route, Auth.js credentials provider, or cookie
//  configuration is invisible to tests."

test.describe('login form — credentials flow works end-to-end', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('user fills login form and is redirected to dashboard with protected content visible', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByLabel('Adres email').fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel('Hasło').fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: 'Zaloguj się' }).click();

    await page.waitForURL('/dashboard');

    await expect(
      page.getByRole('heading', { name: 'Panel studenta' }),
    ).toBeVisible();

    // Cleanup: none — login flow is stateless from the DB perspective.
  });
});
