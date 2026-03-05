import { test, expect } from '@playwright/test';
import { gotoAuth } from './helpers';

const forms = [
  { name: 'GRN', path: '/admin/forms/grn' },
  { name: 'MI', path: '/admin/forms/mi' },
  { name: 'MRN', path: '/admin/forms/mrn' },
  { name: 'QCI', path: '/admin/forms/qci' },
  { name: 'DR', path: '/admin/forms/dr' },
  { name: 'MR', path: '/admin/forms/mr' },
  { name: 'WT', path: '/admin/forms/wt' },
  { name: 'Shipment', path: '/admin/forms/shipment' },
  { name: 'Gate Pass', path: '/admin/forms/gatepass' },
  { name: 'Scrap', path: '/admin/forms/scrap' },
  { name: 'Surplus', path: '/admin/forms/surplus' },
  { name: 'IMSF', path: '/admin/forms/imsf' },
  { name: 'Tool', path: '/admin/forms/tool' },
  { name: 'Tool Issue', path: '/admin/forms/tool-issue' },
  { name: 'Handover', path: '/admin/forms/handover' },
  { name: 'Rental Contract', path: '/admin/forms/rental-contract' },
  { name: 'Generator Fuel', path: '/admin/forms/generator-fuel' },
  { name: 'Generator Maintenance', path: '/admin/forms/generator-maintenance' },
];

test.describe('Document Forms - All 18', () => {
  for (const form of forms) {
    test(`${form.name} form loads with inputs`, async ({ page }) => {
      await gotoAuth(page, form.path);

      const crashed = await page
        .getByText('Something went wrong')
        .isVisible()
        .catch(() => false);
      expect(crashed).toBe(false);

      const inputs = await page.locator('input, select, textarea').count();
      expect(inputs).toBeGreaterThan(0);
    });
  }
});

test.describe('GRN Form Details', () => {
  test('has save/submit button', async ({ page }) => {
    await gotoAuth(page, '/admin/forms/grn');
    const btn = page.getByRole('button', { name: /save|submit/i }).first();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await expect(btn).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('MR Form Details', () => {
  test('has form fields and save button', async ({ page }) => {
    await gotoAuth(page, '/admin/forms/mr');
    const inputs = await page.locator('input, select, textarea').count();
    expect(inputs).toBeGreaterThan(0);
    const btn = page.getByRole('button', { name: /save|submit/i }).first();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await expect(btn).toBeVisible({ timeout: 10_000 });
  });
});
