import { test, expect } from '@playwright/test';
import { gotoAuth } from './helpers';

test.describe('Sidebar Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuth(page, '/admin');
  });

  test('sidebar shows top-level nav items', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar.getByText('Dashboard')).toBeVisible();
    await expect(sidebar.getByText('Warehouses & Stores')).toBeVisible();
    await expect(sidebar.getByText('Equipment & Transport')).toBeVisible();
    await expect(sidebar.getByText('Scrap & Surplus')).toBeVisible();
    await expect(sidebar.getByText('Shipping & Customs')).toBeVisible();
    await expect(sidebar.getByText('Documents')).toBeVisible();
  });

  test('expanding Warehouses shows child items', async ({ page }) => {
    const sidebar = page.locator('aside');
    await sidebar.getByText('Warehouses & Stores').click();
    await expect(sidebar.getByText('GRN - Goods Receipt')).toBeVisible({ timeout: 5_000 });
    await expect(sidebar.getByText('MI - Material Issuance')).toBeVisible();
    await expect(sidebar.getByText('MRN - Material Return')).toBeVisible();
    await expect(sidebar.getByText('MR - Material Request')).toBeVisible();
    await expect(sidebar.getByText('Inventory')).toBeVisible();
  });

  test('child nav navigates to GRN tab', async ({ page }) => {
    const sidebar = page.locator('aside');
    await sidebar.getByText('Warehouses & Stores').click();
    await sidebar.getByText('GRN - Goods Receipt').click();
    await page.waitForURL(/warehouses.*tab=grn/, { timeout: 15_000 });
  });

  test('child nav navigates to Inventory tab', async ({ page }) => {
    const sidebar = page.locator('aside');
    await sidebar.getByText('Warehouses & Stores').click();
    await sidebar.getByText('Inventory').click();
    await page.waitForURL(/warehouses.*tab=inventory/, { timeout: 15_000 });
  });

  test('Dashboard link navigates back', async ({ page }) => {
    await gotoAuth(page, '/admin/warehouses');
    const sidebar = page.locator('aside');
    await sidebar.getByText('Dashboard').click();
    await expect(page.getByRole('heading', { name: 'Executive Dashboard' })).toBeVisible({ timeout: 10_000 });
  });

  test('sign out button and role selector visible', async ({ page }) => {
    const sidebar = page.locator('aside');
    const signOut = sidebar.getByRole('button', { name: 'Sign Out' });
    await signOut.scrollIntoViewIfNeeded();
    await expect(signOut).toBeVisible();
    await expect(sidebar.getByText(/Current Persona/i)).toBeVisible();
  });
});

test.describe('Header & Breadcrumbs', () => {
  test('header is visible on warehouse page', async ({ page }) => {
    await gotoAuth(page, '/admin/warehouses');
    await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
  });

  test('breadcrumbs visible on sub-page', async ({ page }) => {
    await gotoAuth(page, '/admin/warehouses');
    await expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeVisible({ timeout: 10_000 });
  });
});
