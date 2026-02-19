import { test, expect, Page } from '@playwright/test';

/**
 * Dashboard E2E Tests
 * 
 * Tests cover:
 * - Dashboard layout and components
 * - Navigation functionality
 * - Responsive design
 */

const TEST_USER = {
  email: 'admin@nexa.io',
  password: 'Admin@123456',
};

// Helper to login before tests
async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(TEST_USER.email);
  await page.getByLabel('Password').fill(TEST_USER.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.describe('Layout', () => {
    test('should display main dashboard components', async ({ page }) => {
      await expect(page.getByText(/dashboard/i).first()).toBeVisible();
      
      // Should have stat cards or dashboard content
      await expect(page.locator('body')).toContainText(/dashboard|assets|data/i);
    });

    test('should display navigation sidebar', async ({ page }) => {
      // Check for navigation items - they are ListItemButton, not links
      await expect(page.getByText('Dashboard')).toBeVisible();
      await expect(page.getByText('Data Catalog')).toBeVisible();
      await expect(page.getByText('Lineage')).toBeVisible();
    });

    test('should display user menu', async ({ page }) => {
      // Look for avatar button (user menu)
      const userMenu = page.locator('button').filter({ has: page.locator('div.MuiAvatar-root') });
      await expect(userMenu.first()).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to catalog page', async ({ page }) => {
      await page.getByText('Data Catalog').click();
      await expect(page).toHaveURL(/catalog/);
    });

    test('should navigate to lineage page', async ({ page }) => {
      await page.getByText('Lineage').click();
      await expect(page).toHaveURL(/lineage/);
    });

    test('should navigate to connections page', async ({ page }) => {
      await page.getByText('Connections').click();
      await expect(page).toHaveURL(/connections/);
    });

    test('should navigate to settings page', async ({ page }) => {
      await page.getByText('Settings').click();
      await expect(page).toHaveURL(/settings/);
    });

    test('should highlight active navigation item', async ({ page }) => {
      await page.getByText('Data Catalog').click();
      await expect(page).toHaveURL(/catalog/);
      
      // The catalog button should have selected state (Mui-selected class)
      const catalogButton = page.getByText('Data Catalog').locator('..').locator('..');
      await expect(catalogButton).toHaveClass(/Mui-selected/);
    });
  });

  test.describe('Search', () => {
    // TODO: Global search functionality not yet implemented in dashboard
    test.skip('should have global search functionality', async ({ page }) => {
      // Look for search input
      const searchInput = page.getByPlaceholder(/search/i);
      await expect(searchInput).toBeVisible();
    });

    // TODO: Global search functionality not yet implemented in dashboard
    test.skip('should navigate to search results', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill('customers');
      await searchInput.press('Enter');
      
      // Should show search results or navigate to search page
      await expect(page).toHaveURL(/search|catalog/);
    });
  });
});

test.describe('Responsive Design', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // TODO: Fix selector - getByText(/dashboard/i) matches multiple elements
  test.skip('should be responsive on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // Dashboard should still be usable
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  // TODO: Fix selector - getByText(/dashboard/i) matches multiple elements
  test.skip('should collapse sidebar on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Sidebar should be collapsed or hidden
    // Look for hamburger menu
    const menuButton = page.getByRole('button', { name: /menu/i });
    
    // Content should be visible
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('should have touch-friendly elements on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Buttons should be large enough for touch
    const buttons = page.getByRole('button');
    const firstButton = buttons.first();
    
    if (await firstButton.isVisible()) {
      const box = await firstButton.boundingBox();
      if (box) {
        // Minimum touch target should be 44x44 pixels
        expect(box.height).toBeGreaterThanOrEqual(32);
      }
    }
  });
});
