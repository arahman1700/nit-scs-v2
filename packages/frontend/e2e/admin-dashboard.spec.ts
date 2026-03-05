import { test, expect } from '@playwright/test';
import { gotoAuth } from './helpers';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuth(page, '/admin');
  });

  test('heading and subtitle visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Executive Dashboard' })).toBeVisible();
    await expect(page.getByText('Real-time logistics and supply chain overview')).toBeVisible();
  });

  test('stat cards are visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Executive Dashboard' })).toBeVisible();
    await expect(page.getByText('Sections')).toBeVisible();
  });

  test('section cards are visible', async ({ page }) => {
    await expect(page.getByLabel('Open Inventory & Warehouses')).toBeVisible();
    await expect(page.getByLabel('Open Receiving & Inbound')).toBeVisible();
    await expect(page.getByLabel('Open Logistics & Jobs')).toBeVisible();
    await expect(page.getByLabel('Open Master Data')).toBeVisible();
  });

  test('charts area renders', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const chartOrEmpty = page.getByText('Inventory Movement').or(page.getByText('No inventory movement data'));
    await expect(chartOrEmpty.first()).toBeVisible({ timeout: 10_000 });
  });

  test('document pipeline section exists', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await expect(page.getByText('Document Pipeline')).toBeVisible({ timeout: 10_000 });
  });

  test('recent activity section exists', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await expect(page.getByText('Recent Activity')).toBeVisible({ timeout: 10_000 });
  });

  test('top projects section exists', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await expect(page.getByText('Top Projects')).toBeVisible({ timeout: 10_000 });
  });

  test('section card navigates correctly', async ({ page }) => {
    await page.getByLabel('Open Inventory & Warehouses').click();
    await page.waitForURL('**/admin/inventory**', { timeout: 15_000 });
  });
});
