import { test as setup, expect } from '@playwright/test';
import { existsSync } from 'node:fs';

const AUTH_FILE = 'playwright/.auth/user.json';

setup('auth state is valid', async ({ browser }) => {
  if (!existsSync(AUTH_FILE)) {
    throw new Error(
      `Auth file not found: ${AUTH_FILE}\n` +
        `Regenerate with:\n` +
        `  npx playwright codegen http://localhost:3000 --save-storage=${AUTH_FILE}`,
    );
  }

  const context = await browser.newContext({ storageState: AUTH_FILE });
  const page = await context.newPage();
  try {
    await page.goto('/dashboard');
    expect(
      page.url(),
      `Session expired — redirected away from /dashboard.\n` +
        `Regenerate with:\n` +
        `  npx playwright codegen http://localhost:3000 --save-storage=${AUTH_FILE}`,
    ).toMatch(/\/dashboard$/);
  } finally {
    await context.close();
  }
});
