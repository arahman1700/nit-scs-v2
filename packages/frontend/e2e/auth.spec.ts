import { test, expect } from '@playwright/test';

// Auth tests need fresh context
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login Page UI', () => {
  test('renders all elements', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
    await expect(page.getByPlaceholder('name@nit.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Forgot Password?' })).toBeVisible();
  });

  test('validation error on empty submit', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText('Please enter email and password')).toBeVisible();
  });

  test('demo buttons fill credentials', async ({ page }) => {
    await page.goto('/');
    await page.getByText('admin@nit.sa').click();
    await expect(page.getByPlaceholder('name@nit.com')).toHaveValue('admin@nit.sa');
    await page.getByText('ahmed@nit.sa').click();
    await expect(page.getByPlaceholder('name@nit.com')).toHaveValue('ahmed@nit.sa');
    await page.getByText('mohammed@nit.sa').click();
    await expect(page.getByPlaceholder('name@nit.com')).toHaveValue('mohammed@nit.sa');
    await page.getByText('khalid@nit.sa').click();
    await expect(page.getByPlaceholder('name@nit.com')).toHaveValue('khalid@nit.sa');
  });

  test('password toggle works', async ({ page }) => {
    await page.goto('/');
    const pwInput = page.getByPlaceholder('••••••••');
    await expect(pwInput).toHaveAttribute('type', 'password');
    await pwInput.locator('..').locator('button').click();
    await expect(pwInput).toHaveAttribute('type', 'text');
  });

  test('forgot password modal opens', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Forgot Password?' }).click();
    await expect(page.getByRole('heading', { name: 'Forgot Password' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send Reset Code' })).toBeVisible();
  });
});

test.describe('Login Flow', () => {
  test('admin login succeeds', async ({ page }) => {
    await page.goto('/');
    await page.getByText('admin@nit.sa').click();
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/admin**', { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Executive Dashboard' })).toBeVisible();
  });

  test('sign out returns to login', async ({ page }) => {
    await page.goto('/');
    await page.getByText('admin@nit.sa').click();
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/admin**', { timeout: 30_000 });
    const signOut = page.getByRole('button', { name: 'Sign Out' });
    await signOut.scrollIntoViewIfNeeded();
    await signOut.click();
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
  });
});
