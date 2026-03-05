import { test, expect } from '@playwright/test';
import { gotoAuth } from './helpers';

const sections = [
  { name: 'Warehouses & Stores', path: '/admin/warehouses', heading: 'Warehouses & Stores' },
  { name: 'Equipment & Transport', path: '/admin/equipment', heading: 'Equipment & Transport' },
  { name: 'Scrap & Surplus', path: '/admin/scrap', heading: 'Scrap & Surplus' },
  { name: 'Shipping & Customs', path: '/admin/shipping', heading: 'Shipping & Customs' },
  { name: 'Employees & Org', path: '/admin/employees', heading: 'Employees & Org' },
  { name: 'Master Data', path: '/admin/master', heading: 'Master Data' },
];

for (const section of sections) {
  test.describe(`${section.name} Section`, () => {
    test(`page loads with heading`, async ({ page }) => {
      await gotoAuth(page, section.path);
      await expect(page.getByRole('heading', { name: section.heading, exact: true })).toBeVisible({ timeout: 10_000 });
    });

    test(`no crash errors`, async ({ page }) => {
      await gotoAuth(page, section.path);
      await expect(page.getByText(/Something went wrong|Application error/i)).not.toBeVisible();
    });

    test(`has styled UI elements`, async ({ page }) => {
      await gotoAuth(page, section.path);
      const cards = page.locator('.glass-card:visible, .glass-panel:visible, .glass:visible');
      await expect(cards.first()).toBeVisible({ timeout: 10_000 });
    });
  });
}

test.describe('Warehouses Tab Navigation', () => {
  const tabs = ['grn', 'mi', 'mrn', 'mr', 'qci', 'dr', 'inventory', 'bin-cards', 'non-moving', 'wt', 'imsf'];

  for (const tab of tabs) {
    test(`${tab} tab loads without errors`, async ({ page }) => {
      await gotoAuth(page, `/admin/warehouses?tab=${tab}`);
      await expect(page.getByText(/Something went wrong|Application error/i)).not.toBeVisible();
    });
  }
});
