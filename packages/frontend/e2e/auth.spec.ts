import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('demo account buttons fill credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /admin/i }).first().click();
    const emailInput = page.getByRole('textbox', { name: /email/i });
    await expect(emailInput).toHaveValue('admin@nit.sa');
  });

  test('admin can login and see dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /admin/i }).first().click();
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should redirect to dashboard
    await page.waitForURL('**/admin**', { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /executive dashboard/i })).toBeVisible();
  });
});
