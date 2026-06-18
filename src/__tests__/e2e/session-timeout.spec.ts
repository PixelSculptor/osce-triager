import { test, expect } from '@playwright/test';

// Risk anchor: server-side session timeout enforcement (context/changes/check-timer).
// "An expired session must auto-finalize at 0:00 and land in history as Negatywny,
//  independent of any explicit user action."
//
// Requires the short-limit scenario from seed-test.ts (run `npm run seed` then
// `npm run seed:test` against the test DB).

const SCENARIO_TITLE = 'Test timeout — krótki limit';

test.describe('session timeout — expired session auto-finalizes at 0:00', () => {
  test('session reaches the results screen without interaction and appears in history as Negatywny', async ({
    page,
  }) => {
    // 1. Navigate to dashboard (authenticated via project storageState)
    await page.goto('/dashboard');
    await page.waitForURL('/dashboard');

    // 2. Start the short-limit scenario
    const scenarioCard = page.getByRole('listitem').filter({
      hasText: SCENARIO_TITLE,
    });
    await scenarioCard
      .getByRole('button', { name: 'Rozpocznij sesję' })
      .click();

    // 3. Session URL contains a dynamic UUID
    await page.waitForURL(/\/dashboard\/session\//);

    // 4. Session loaded when the available-tests heading appears
    await expect(
      page.getByRole('heading', { name: /Dostępne badania/ }),
    ).toBeVisible();

    // 5. Do NOT interact — let the 5 s timer reach 0:00. The client auto-fires
    //    finalization; wait on the results STATE, never a fixed delay.
    await expect(
      page.getByRole('heading', { name: 'Sesja zakończona' }),
    ).toBeVisible({ timeout: 20_000 });

    // 6. dt-001 is critical and was never ordered → Negatywny
    await expect(page.getByText(/Negatywny/)).toBeVisible();

    // 7. History shows this scenario as Negatywny. Scoped to a single listitem
    //    so prior runs leaving other entries don't trip strict mode.
    await page.goto('/dashboard/history');
    await expect(
      page
        .getByRole('listitem')
        .filter({ hasText: SCENARIO_TITLE })
        .filter({ hasText: 'Negatywny' })
        .first(),
    ).toBeVisible();

    // Cleanup: none — session accumulation is acceptable for MVP; assertions
    // are scoped by scenario name so parallel runs do not conflict.
  });
});
