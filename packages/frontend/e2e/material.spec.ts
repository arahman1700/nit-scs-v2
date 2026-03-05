import { test, expect } from '@playwright/test';
import { gotoAuth } from './helpers';

test.describe('Material Management - Tab Navigation', () => {
  const tabs = ['grn', 'mi', 'mrn', 'mr', 'qci', 'dr', 'inventory', 'bin-cards', 'non-moving', 'wt', 'imsf'];

  for (const tab of tabs) {
    test(`${tab.toUpperCase()} tab loads and renders content`, async ({ page }) => {
      await gotoAuth(page, `/admin/warehouses?tab=${tab}`);

      // Page must not show error boundary crash
      const crashed = await page
        .getByText('Something went wrong')
        .isVisible()
        .catch(() => false);
      expect(crashed).toBe(false);

      // Must have visible content (heading, cards, table, or empty state)
      const hasHeading = await page
        .getByRole('heading')
        .first()
        .isVisible()
        .catch(() => false);
      const hasCards = await page
        .locator('.glass-card')
        .first()
        .isVisible()
        .catch(() => false);
      const hasGrid = await page
        .locator('[class*="ag-root"], table, [role="grid"]')
        .first()
        .isVisible()
        .catch(() => false);
      expect(hasHeading || hasCards || hasGrid).toBeTruthy();
    });
  }
});
