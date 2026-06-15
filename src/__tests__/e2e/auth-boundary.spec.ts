import { test, expect } from '@playwright/test';

// Risk anchor: Risk #6 (context/foundation/test-plan.md)
// "Unauthenticated request to /dashboard/* receives content instead of a redirect.
//  Auth middleware silently passes."

test.describe('auth boundary — unauthenticated access is blocked', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('unauthenticated request to /dashboard is redirected and never serves protected content', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await page.waitForURL('/');

    await expect(page.getByRole('link', { name: 'Zaloguj się' })).toBeVisible();

    await expect(
      page.getByRole('heading', { name: 'Panel studenta' }),
    ).not.toBeVisible();
  });

  test('unauthenticated request to /dashboard/session/[id] is redirected and never serves protected content', async ({
    page,
  }) => {
    await page.goto('/dashboard/session/nonexistent-session-id');
    await page.waitForURL('/');

    await expect(page.getByRole('link', { name: 'Zaloguj się' })).toBeVisible();

    await expect(
      page.getByRole('heading', { name: 'Panel studenta' }),
    ).not.toBeVisible();
  });
});

test.describe('auth boundary — authenticated user can access dashboard', () => {
  test('authenticated user reaches dashboard and sees protected content', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await page.waitForURL('/dashboard');

    await expect(
      page.getByRole('heading', { name: 'Panel studenta' }),
    ).toBeVisible();
  });
});
