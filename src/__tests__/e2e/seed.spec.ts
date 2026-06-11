// seed.spec.ts
//
// E2E pattern reference for OSCE Triager.
// Every generated test must mirror these four patterns:
//   1. Role-based locators   getByRole / getByLabel / getByText — never CSS or XPath
//   2. Test independence     full setup → action → assertion → cleanup in one test
//   3. Wait for state        waitForURL / toBeVisible — never waitForTimeout
//   4. Risk-tied name        test title names the business outcome from test-plan.md
//
// Risk anchor: Risk #6 (context/foundation/test-plan.md)
//   "Unauthenticated request to /dashboard/* receives content instead of a redirect
//    to /login. Auth middleware silently passes."

import { test, expect } from '@playwright/test';

// ─── Pattern 2: Test independence ────────────────────────────────────────────
// test.use() scoped inside describe applies ONLY to this block.
// It overrides the project-level storageState so this test runs without a session,
// which is exactly the condition Risk #6 requires.
// Authenticated tests in other describes/files still use their own storageState.
test.describe('auth boundary — unauthenticated access is blocked', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  // ─── Pattern 4: Risk-tied name ─────────────────────────────────────────────
  // The test title names the observable business outcome, not an implementation
  // detail. "Auth middleware redirects" is an implementation detail.
  // "Unauthenticated request to /dashboard is redirected to /login" is the risk.
  // ─── Pattern 4: Risk-tied name ─────────────────────────────────────────────
  // The title names the observable business outcome from test-plan.md Risk #6.
  // "Middleware redirects" is an implementation detail. What matters to the user:
  // they are never served protected content when unauthenticated.
  test('unauthenticated request to /dashboard is redirected and never serves protected content', async ({
    page,
  }) => {
    // Setup: navigate directly to a protected route with no session.
    // Pattern 2: this test owns its full setup — it does not rely on any previous
    // test having navigated anywhere or created state.
    await page.goto('/dashboard');

    // ─── Pattern 3: Wait for state, not time ─────────────────────────────────
    // The middleware redirects to / (not /login) — verified in middleware.ts.
    // waitForURL resolves the moment the browser URL matches.
    // NEVER use page.waitForTimeout(2000) — time-based waits are inherently flaky.
    await page.waitForURL('/');

    // ─── Pattern 1: Role-based locators ──────────────────────────────────────
    // getByRole survives CSS renames, DOM restructuring, component refactors.
    // Selector priority: getByRole → getByLabel → getByText → getByTestId (last resort).
    // NEVER: page.locator('.some-class') or page.locator('#id').
    //
    // There are two "Zaloguj się" links on this page (nav + CTA).
    // Scope to the navigation landmark to avoid a strict-mode violation.
    // The aria-label="Nawigacja główna" on <nav> makes this unambiguous.
    await expect(
      page
        .getByRole('navigation', { name: 'Nawigacja główna' })
        .getByRole('link', { name: 'Zaloguj się' }),
    ).toBeVisible();

    // Negative assertion: the dashboard heading must be absent.
    // This is the core Risk #6 protection — if middleware silently passes,
    // "Panel studenta" would appear and this line would catch the regression.
    await expect(
      page.getByRole('heading', { name: 'Panel studenta' }),
    ).not.toBeVisible();

    // Cleanup: this flow is stateless — the redirect created no server-side data.
    // When a test DOES create data, undo it here before the test exits:
    //   await page.getByRole('button', { name: 'Zakończ sesję' }).click();
    //   await page.waitForURL('/dashboard');
    // Use role-based locators for cleanup actions too (Pattern 1).
  });
});
