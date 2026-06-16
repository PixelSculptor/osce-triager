import { test, expect } from '@playwright/test';

// Risk anchor: R-DEL-06, R-DEL-07 (context/changes/delete-session/plan.md)
// R-DEL-06 — cancel preserves session: dialog opens and disappears on cancel,
//             session card remains visible in history.
// R-DEL-07 — confirm deletes session: after confirm, session card is gone from
//             history list (revalidatePath RSC refresh removes it).

const SCENARIO = 'Ostry ból w klatce piersiowej';

async function createCompletedSession(page: import('@playwright/test').Page) {
  await page.goto('/dashboard');
  await page.waitForURL('/dashboard');

  const scenarioCard = page.getByRole('listitem').filter({ hasText: SCENARIO });
  await scenarioCard.getByRole('button', { name: 'Rozpocznij sesję' }).click();

  await page.waitForURL(/\/dashboard\/session\//);
  await expect(
    page.getByRole('heading', { name: /Dostępne badania/ }),
  ).toBeVisible();

  await page
    .getByLabel('Przeciągnij: EKG 12-odprowadzeniowe')
    .getByRole('button', { name: 'Zleć' })
    .click();

  await page
    .getByLabel('Przeciągnij: Troponiny sercowe')
    .getByRole('button', { name: 'Zleć' })
    .click();

  await page.getByRole('button', { name: 'Zakończ sesję' }).click();
  await expect(
    page.getByRole('heading', { name: 'Sesja zakończona' }),
  ).toBeVisible();
}

test.describe('session delete — dialog and history list', () => {
  test('R-DEL-06: cancel closes dialog and preserves session card', async ({
    page,
  }) => {
    // 1. Create a completed session
    await createCompletedSession(page);

    // 2. Navigate to history
    await page.goto('/dashboard/history');

    // 3. Locate the session card
    const card = page
      .getByRole('listitem')
      .filter({ hasText: SCENARIO })
      .first();
    await expect(card).toBeVisible();

    // 4. Click delete button
    await card.getByRole('button', { name: 'Usuń sesję' }).click();

    // 5. Dialog is visible
    await expect(page.getByRole('dialog')).toBeVisible();

    // 6. Click cancel
    await page.getByRole('button', { name: 'Anuluj' }).click();

    // 7. Dialog is gone and card is still visible
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(card).toBeVisible();
  });

  test('R-DEL-07: confirm deletes session and card disappears from history', async ({
    page,
  }) => {
    // 1. Create a completed session (independent fixture)
    await createCompletedSession(page);

    // 2. Navigate to history
    await page.goto('/dashboard/history');

    // 3. Count cards before deletion — parallel tests may have left others
    const cards = page.getByRole('listitem').filter({ hasText: SCENARIO });
    const countBefore = await cards.count();
    expect(countBefore).toBeGreaterThanOrEqual(1);

    // 4. Click delete on the first matching card
    const card = cards.first();
    await card.getByRole('button', { name: 'Usuń sesję' }).click();

    // 5. Dialog is visible
    await expect(page.getByRole('dialog')).toBeVisible();

    // 6. Confirm deletion
    await page.getByRole('button', { name: 'Potwierdź' }).click();

    // 7. Exactly one card was removed (revalidatePath refreshed RSC list)
    await expect(cards).toHaveCount(countBefore - 1);
  });
});
