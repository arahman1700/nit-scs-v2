import { test as setup, expect } from '@playwright/test';

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/');
  await page.getByText('admin@nit.sa').click();
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/admin**', { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Executive Dashboard' })).toBeVisible();

  // Save auth state for reuse
  await page.context().storageState({ path: './e2e/.auth/admin.json' });
});
