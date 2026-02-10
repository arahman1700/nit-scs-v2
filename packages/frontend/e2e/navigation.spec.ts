import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin first
    await page.goto('/login');
    await page.getByRole('button', { name: /admin/i }).first().click();
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/admin**', { timeout: 10_000 });
  });

  test('Material Management page loads', async ({ page }) => {
    await page.getByRole('link', { name: /material management/i }).click();
    await expect(page.getByRole('heading', { name: /material management/i })).toBeVisible();
    // Check tabs exist
    await expect(page.getByRole('button', { name: 'GRN' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'MI' })).toBeVisible();
  });

  test('Logistics & Fleet page loads', async ({ page }) => {
    await page.getByRole('link', { name: /logistics/i }).click();
    await expect(page.getByRole('heading', { name: /logistics/i })).toBeVisible();
  });

  test('Asset Lifecycle page loads', async ({ page }) => {
    await page.getByRole('link', { name: /asset lifecycle/i }).click();
    await expect(page.getByRole('heading', { name: /asset lifecycle/i })).toBeVisible();
  });
});
