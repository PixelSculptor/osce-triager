import { test, expect } from '@playwright/test';

// Risk anchor: Risk #7 (context/foundation/test-plan.md)
// "Full diagnostic session flow fails in the browser: cookie auth → routing →
//  server action → client state → validator feedback → persistence → history."

test.describe('main session flow — full diagnostic cross-boundary flow works end-to-end', () => {
  test('authenticated user completes diagnostic session and result appears in history as Pozytywny', async ({
    page,
  }) => {
    // 1. Navigate to dashboard (authenticated via project storageState)
    await page.goto('/dashboard');
    await page.waitForURL('/dashboard');

    // 2. Scope to the scenario card and start a session
    const scenarioCard = page.getByRole('listitem').filter({
      hasText: 'Ostry ból w klatce piersiowej',
    });
    await scenarioCard
      .getByRole('button', { name: 'Rozpocznij sesję' })
      .click();

    // 3. Session URL contains a dynamic UUID — wait for it with a regex
    await page.waitForURL(/\/dashboard\/session\//);

    // 4. Session page has loaded when the available tests heading appears
    await expect(
      page.getByRole('heading', { name: /Dostępne badania/ }),
    ).toBeVisible();

    // 5. Order the EKG test — DraggableTestCard renders as a button with
    //    aria-label="Przeciągnij: {name}"; scope to it to avoid ambiguity
    const availableEkgCard = page.getByLabel(
      'Przeciągnij: EKG 12-odprowadzeniowe',
    );
    await availableEkgCard.getByRole('button', { name: 'Zleć' }).click();

    // 6. EKG card moves to the ordered column
    await expect(
      page.getByLabel('Zmień kolejność: EKG 12-odprowadzeniowe'),
    ).toBeVisible();

    // 7. Validator badge on the ordered EKG card shows "Poprawne"
    await expect(
      page
        .getByLabel('Zmień kolejność: EKG 12-odprowadzeniowe')
        .getByText('Poprawne'),
    ).toBeVisible();

    // 7b. Also order Troponiny sercowe — both dt-001 and dt-002 are critical
    //     for Scenario 1; skipping either yields "Negatywny"
    const availableTropCard = page.getByLabel('Przeciągnij: Troponiny sercowe');
    await availableTropCard.getByRole('button', { name: 'Zleć' }).click();

    await expect(
      page.getByLabel('Zmień kolejność: Troponiny sercowe'),
    ).toBeVisible();

    // 8. End the session
    await page.getByRole('button', { name: 'Zakończ sesję' }).click();

    // 9. Session summary page
    await expect(
      page.getByRole('heading', { name: 'Sesja zakończona' }),
    ).toBeVisible();

    // 10. Outcome is positive
    await expect(page.getByText(/Pozytywny/)).toBeVisible();

    // 11. Navigate to history
    await page.goto('/dashboard/history');

    // 12 + 13. A history entry for this scenario with outcome "Pozytywny" exists.
    //          Scoped to a single listitem to avoid strict-mode violations when
    //          prior test runs have left other entries for the same scenario.
    await expect(
      page
        .getByRole('listitem')
        .filter({ hasText: 'Ostry ból w klatce piersiowej' })
        .filter({ hasText: 'Pozytywny' })
        .first(),
    ).toBeVisible();

    // Cleanup: none — session accumulation is acceptable for MVP;
    // assertions are scoped by scenario name so parallel runs do not conflict.
  });
});
