import { test, expect } from '@playwright/test';

// Role tests need fresh context to login as different users
test.use({ storageState: { cookies: [], origins: [] } });

const roles = [
  { name: 'Warehouse', email: 'ahmed@nit.sa', urlPattern: /\/warehouse/ },
  { name: 'Transport', email: 'mohammed@nit.sa', urlPattern: /\/(transport|logistics)/ },
  { name: 'Engineer', email: 'khalid@nit.sa', urlPattern: /\/site-engineer/ },
];

for (const role of roles) {
  test.describe(`${role.name} Role`, () => {
    test(`login redirects to correct dashboard`, async ({ page }) => {
      await page.goto('/');
      await page.getByText(role.email).click();
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForURL(role.urlPattern, { timeout: 30_000 });
    });

    test(`dashboard loads without crash`, async ({ page }) => {
      await page.goto('/');
      await page.getByText(role.email).click();
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForURL(role.urlPattern, { timeout: 30_000 });
      await page.waitForLoadState('networkidle');
      // Should have some visible content
      const hasContent = await page
        .getByRole('heading')
        .first()
        .isVisible()
        .catch(() => false);
      expect(hasContent).toBeTruthy();
    });

    test(`no crash errors on dashboard`, async ({ page }) => {
      await page.goto('/');
      await page.getByText(role.email).click();
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForURL(role.urlPattern, { timeout: 30_000 });
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/Something went wrong|Application error/i)).not.toBeVisible();
    });
  });
}
