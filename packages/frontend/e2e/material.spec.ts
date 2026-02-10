import { test, expect } from '@playwright/test';

test.describe('Material Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /admin/i }).first().click();
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/admin**', { timeout: 10_000 });
    await page.goto('/admin/material');
  });

  test('GRN tab shows data grid', async ({ page }) => {
    await page.getByRole('button', { name: 'GRN' }).click();
    // Should show the document list
    await expect(page.getByText(/goods receipt notes/i)).toBeVisible();
    // Should have data rows (we know there are 3 GRNs)
    await expect(page.getByText('MRRV-2026-0003')).toBeVisible();
  });

  test('Inventory tab shows stock levels', async ({ page }) => {
    await page.getByRole('button', { name: 'Inventory' }).click();
    await expect(page.getByText(/stock levels/i)).toBeVisible();
  });

  test('Item Master tab shows items', async ({ page }) => {
    await page.getByRole('button', { name: 'Item Master' }).click();
    await expect(page.getByText(/item master catalog/i)).toBeVisible();
  });
});
