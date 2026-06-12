import { test as setup } from '@playwright/test';

const AUTH_FILE = 'playwright/.auth/user.json';

setup('authenticate via login form', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Adres email').fill(process.env.TEST_USER_EMAIL!);
  await page.getByLabel('Hasło').fill(process.env.TEST_USER_PASSWORD!);
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await page.waitForURL('/dashboard');
  await page.context().storageState({ path: AUTH_FILE });
});
