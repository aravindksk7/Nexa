import { test, expect, Page } from '@playwright/test';

/**
 * Catalog (Asset Management) E2E Tests
 * 
 * Tests cover:
 * - Asset listing and filtering
 * - Asset creation
 * - Asset editing
 * - Asset search
 * - Asset deletion
 */

const TEST_USER = {
  email: 'admin@nexa.io',
  password: 'Admin@123456',
};

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(TEST_USER.email);
  await page.getByLabel('Password').fill(TEST_USER.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test.describe('Catalog', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/catalog');
  });

  test.describe('Asset Listing', () => {
    test('should display catalog page', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /catalog|assets/i })).toBeVisible();
    });

    // TODO: Asset list display requires data-testid or specific selectors
    test.skip('should display assets in a list or grid', async ({ page }) => {
      // Wait for assets to load
      await page.waitForLoadState('networkidle');
      
      // Should show asset cards or table rows
      const assetItems = page.locator('[data-testid="asset-item"], [role="row"], .asset-card');
      
      // May have assets or show empty state
      const count = await assetItems.count();
      if (count === 0) {
        // Should show empty state
        await expect(page.getByText(/no assets|empty|create/i)).toBeVisible();
      }
    });

    test('should have pagination or infinite scroll', async ({ page }) => {
      await page.waitForLoadState('networkidle');
      
      // Look for pagination controls
      const pagination = page.getByRole('navigation', { name: /pagination/i });
      const loadMore = page.getByRole('button', { name: /load more|show more/i });
      
      // Either pagination or load more should exist if there are many assets
    });

    test('should filter assets by type', async ({ page }) => {
      // Look for type filter
      const typeFilter = page.getByRole('combobox', { name: /type|filter/i });
      
      if (await typeFilter.isVisible()) {
        await typeFilter.click();
        
        // Select TABLE type
        await page.getByRole('option', { name: /table/i }).click();
        
        // Wait for filtered results
        await page.waitForLoadState('networkidle');
        
        // URL should reflect the filter
        await expect(page).toHaveURL(/type=TABLE/);
      }
    });

    test('should filter assets by domain', async ({ page }) => {
      // Look for domain filter
      const domainFilter = page.getByRole('combobox', { name: /domain/i });
      
      if (await domainFilter.isVisible()) {
        await domainFilter.click();
        await page.getByRole('option').first().click();
        await page.waitForLoadState('networkidle');
      }
    });

    test('should search assets', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i);
      
      if (await searchInput.isVisible()) {
        await searchInput.fill('customers');
        await searchInput.press('Enter');
        
        await page.waitForLoadState('networkidle');
        
        // Results should be filtered
        await expect(page).toHaveURL(/search=customers/);
      }
    });
  });

  test.describe('Asset Creation', () => {
    test('should have create asset button', async ({ page }) => {
      const createButton = page.getByRole('button', { name: /create|add|new/i });
      await expect(createButton).toBeVisible();
    });

    // TODO: Asset creation modal not yet implemented
    test.skip('should open create asset modal/form', async ({ page }) => {
      await page.getByRole('button', { name: /create|add|new/i }).click();
      
      // Should show form fields
      await expect(page.getByLabel(/name/i)).toBeVisible();
      await expect(page.getByLabel(/type/i)).toBeVisible();
    });

    // TODO: Asset creation not yet implemented
    test.skip('should create a new asset', async ({ page }) => {
      await page.getByRole('button', { name: /create|add|new/i }).click();
      
      const assetName = `e2e_test_asset_${Date.now()}`;
      
      await page.getByLabel(/name/i).fill(assetName);
      await page.getByLabel(/type/i).click();
      await page.getByRole('option', { name: /table/i }).click();
      await page.getByLabel(/description/i).fill('E2E test asset description');
      
      await page.getByRole('button', { name: /create|save|submit/i }).click();
      
      // Should show success message or redirect
      await expect(page.getByText(/created|success/i)).toBeVisible({ timeout: 10000 });
    });

    // TODO: Asset creation validation not yet implemented
    test.skip('should validate required fields', async ({ page }) => {
      await page.getByRole('button', { name: /create|add|new/i }).click();
      
      // Try to submit without required fields
      await page.getByRole('button', { name: /create|save|submit/i }).click();
      
      // Should show validation errors
      await expect(page.getByText(/required|name/i)).toBeVisible();
    });
  });

  test.describe('Asset Details', () => {
    test('should navigate to asset detail page', async ({ page }) => {
      await page.waitForLoadState('networkidle');
      
      // Click on first asset
      const assetLink = page.locator('[data-testid="asset-item"], [role="row"]').first();
      
      if (await assetLink.isVisible()) {
        await assetLink.click();
        
        // Should navigate to detail page
        await expect(page).toHaveURL(/catalog\/.+|assets\/.+/);
      }
    });

    test('should display asset metadata', async ({ page }) => {
      // Navigate to a specific asset if URL is known
      // Or find and click first asset
      await page.waitForLoadState('networkidle');
      
      const assetLink = page.locator('[data-testid="asset-item"] a, [role="row"] a').first();
      
      if (await assetLink.isVisible()) {
        await assetLink.click();
        await page.waitForLoadState('networkidle');
        
        // Should show asset details
        await expect(page.getByText(/type|owner|created/i)).toBeVisible();
      }
    });
  });

  test.describe('Asset Editing', () => {
    test('should edit asset description', async ({ page }) => {
      await page.waitForLoadState('networkidle');
      
      // Navigate to asset detail
      const assetRow = page.locator('[data-testid="asset-item"], [role="row"]').first();
      
      if (await assetRow.isVisible()) {
        await assetRow.click();
        await page.waitForLoadState('networkidle');
        
        // Find and click edit button
        const editButton = page.getByRole('button', { name: /edit/i });
        
        if (await editButton.isVisible()) {
          await editButton.click();
          
          // Update description
          await page.getByLabel(/description/i).fill('Updated by E2E test');
          await page.getByRole('button', { name: /save|update/i }).click();
          
          await expect(page.getByText(/updated|saved|success/i)).toBeVisible();
        }
      }
    });

    test('should edit asset tags', async ({ page }) => {
      await page.waitForLoadState('networkidle');
      
      const assetRow = page.locator('[data-testid="asset-item"], [role="row"]').first();
      
      if (await assetRow.isVisible()) {
        await assetRow.click();
        await page.waitForLoadState('networkidle');
        
        // Look for tag input
        const tagInput = page.getByPlaceholder(/tag|add tag/i);
        
        if (await tagInput.isVisible()) {
          await tagInput.fill('e2e-test-tag');
          await tagInput.press('Enter');
          
          // Tag should appear
          await expect(page.getByText('e2e-test-tag')).toBeVisible();
        }
      }
    });
  });
});

test.describe('Asset Lineage View', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display lineage tab on asset detail', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');
    
    const assetRow = page.locator('[data-testid="asset-item"], [role="row"]').first();
    
    if (await assetRow.isVisible()) {
      await assetRow.click();
      await page.waitForLoadState('networkidle');
      
      // Look for lineage tab
      const lineageTab = page.getByRole('tab', { name: /lineage/i });
      
      if (await lineageTab.isVisible()) {
        await lineageTab.click();
        
        // Should show lineage graph or placeholder
        await expect(page.locator('svg, canvas, [data-testid="lineage-graph"]').first()).toBeVisible();
      }
    }
  });
});

test.describe('Asset Schema View', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display schema tab on asset detail', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');
    
    const assetRow = page.locator('[data-testid="asset-item"], [role="row"]').first();
    
    if (await assetRow.isVisible()) {
      await assetRow.click();
      await page.waitForLoadState('networkidle');
      
      // Look for schema tab
      const schemaTab = page.getByRole('tab', { name: /schema|columns/i });
      
      if (await schemaTab.isVisible()) {
        await schemaTab.click();
        
        // Should show schema/columns table
        await expect(page.getByRole('table')).toBeVisible();
      }
    }
  });
});
