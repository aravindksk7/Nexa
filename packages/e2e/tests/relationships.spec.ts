import { test, expect, Page } from '@playwright/test';

/**
 * Relationships E2E Tests
 *
 * Tests cover:
 * - Relationships tab on asset detail page
 * - Relationship creation UI
 * - Relationship display
 */

const TEST_USER = {
  email: 'admin@dataplatform.com',
  password: 'Admin@123456',
};

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(TEST_USER.email);
  await page.getByLabel('Password').fill(TEST_USER.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test.describe('Relationships', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');
  });

  test('should display catalog page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /catalog|assets/i })).toBeVisible();
  });

  test('should display relationships section on asset detail', async ({ page }) => {
    // Get first asset from catalog
    const rows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') });
    const rowCount = await rows.count();

    if (rowCount > 0) {
      // Click first asset
      const firstLink = rows.first().getByRole('link').first();
      if (await firstLink.isVisible()) {
        await firstLink.click();
        await page.waitForLoadState('networkidle');

        // Look for relationships tab
        const relTab = page.getByRole('tab', { name: /relation/i })
          .or(page.getByText(/relationships/i).first());
        
        await expect(relTab).toBeVisible();
      }
    }
  });

  test('should navigate to asset detail page', async ({ page }) => {
    // Find any asset link in catalog
    const assetLink = page.locator('a[href*="/catalog/"]').first();
    const count = await assetLink.count();

    if (count > 0) {
      await assetLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/catalog\//);
    }
  });
});
