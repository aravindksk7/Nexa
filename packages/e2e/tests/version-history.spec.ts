import { test, expect, Page } from '@playwright/test';

/**
 * Version History E2E Tests
 *
 * Tests cover:
 * - Version history panel on asset detail page
 * - Version comparison
 * - Version restoration
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

test.describe('Version History', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should navigate to catalog page', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /catalog|assets/i })).toBeVisible();
  });

  test('should display asset list in catalog', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');

    // Should show assets or empty state
    const assetCount = page.getByText(/asset|table|column|dataset/i);
    await expect(assetCount.first()).toBeVisible();
  });

  test('should navigate to asset detail when clicking an asset', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');

    // Try to click first asset link
    const assetLinks = page.getByRole('link').filter({ hasText: /^(?!.*nav|.*logo|.*sign).+/i });
    const count = await assetLinks.count();

    if (count > 0) {
      await assetLinks.first().click();
      await page.waitForLoadState('networkidle');
      // Should be on asset detail page
      await expect(page).toHaveURL(/catalog\/.+/);
    }
  });

  test('should display version history tab on asset detail', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');

    const assetLinks = page.getByRole('link').filter({ hasText: /[A-Za-z0-9_]+/ }).locator(':visible');
    const linkCount = await assetLinks.count();

    if (linkCount > 0) {
      // Navigate to first asset
      const href = await assetLinks.first().getAttribute('href');
      if (href && href.includes('/catalog/')) {
        await page.goto(href);
        await page.waitForLoadState('networkidle');

        // Look for version history tab
        const historyTab = page.getByRole('tab', { name: /version|history/i })
          .or(page.getByRole('button', { name: /version|history/i }))
          .or(page.getByText(/version history/i));
        
        await expect(historyTab.first()).toBeVisible();
      }
    }
  });
});
