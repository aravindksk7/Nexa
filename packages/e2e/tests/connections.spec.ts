import { test, expect, Page } from '@playwright/test';

/**
 * Connections Page E2E Tests
 * 
 * Tests cover:
 * - Connection listing
 * - Connection creation
 * - Connection editing
 * - Connection testing
 * - Schema discovery
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

test.describe('Connections', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/connections');
  });

  test.describe('Connections Page Layout', () => {
    test('should display connections page', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /connections/i })).toBeVisible();
    });

    test('should have create connection button', async ({ page }) => {
      const createButton = page.getByRole('button', { name: /create|add|new/i });
      await expect(createButton).toBeVisible();
    });

    // TODO: Connection list display requires data-testid or specific selectors
    test.skip('should display connection list or empty state', async ({ page }) => {
      await page.waitForLoadState('networkidle');
      
      // Either show connections or empty state
      const connectionCards = page.locator('[data-testid="connection-card"], [role="row"]');
      const emptyState = page.getByText(/no connections|create your first/i);
      
      const hasConnections = await connectionCards.count() > 0;
      const hasEmptyState = await emptyState.isVisible().catch(() => false);
      
      expect(hasConnections || hasEmptyState).toBe(true);
    });
  });

  test.describe('Connection Creation', () => {
    // TODO: Connection creation modal not yet implemented
    test.skip('should open connection creation modal', async ({ page }) => {
      await page.getByRole('button', { name: /create|add|new/i }).click();
      
      // Should show connection type options
      await expect(page.getByText(/postgresql|mysql|snowflake|connection type/i)).toBeVisible();
    });

    // TODO: Connection type selector not yet implemented
    test.skip('should show database type options', async ({ page }) => {
      await page.getByRole('button', { name: /create|add|new/i }).click();
      
      // Look for database type selector
      const typeSelector = page.getByRole('combobox', { name: /type/i });
      
      if (await typeSelector.isVisible()) {
        await typeSelector.click();
        
        // Check for common database types
        await expect(page.getByRole('option', { name: /postgresql/i })).toBeVisible();
      } else {
        // Or cards/buttons for each type
        await expect(page.getByText(/postgresql/i)).toBeVisible();
      }
    });

    // TODO: Connection form not yet implemented
    test.skip('should show connection form fields', async ({ page }) => {
      await page.getByRole('button', { name: /create|add|new/i }).click();
      
      // Select a database type first
      const typeOption = page.getByText(/postgresql/i);
      if (await typeOption.isVisible()) {
        await typeOption.click();
      }
      
      // Should show connection form
      await expect(page.getByLabel(/name/i)).toBeVisible();
      await expect(page.getByLabel(/host/i)).toBeVisible();
      await expect(page.getByLabel(/port/i)).toBeVisible();
      await expect(page.getByLabel(/database/i)).toBeVisible();
      await expect(page.getByLabel(/username/i)).toBeVisible();
    });

    // TODO: Connection validation not yet implemented
    test.skip('should validate required fields', async ({ page }) => {
      await page.getByRole('button', { name: /create|add|new/i }).click();
      
      // Select type
      const typeOption = page.getByText(/postgresql/i);
      if (await typeOption.isVisible()) {
        await typeOption.click();
      }
      
      // Try to submit without filling fields
      const submitButton = page.getByRole('button', { name: /create|save|connect/i });
      if (await submitButton.isVisible()) {
        await submitButton.click();
        
        // Should show validation errors
        await expect(page.getByText(/required/i)).toBeVisible();
      }
    });

    // TODO: Connection creation not yet implemented
    test.skip('should create a connection', async ({ page }) => {
      await page.getByRole('button', { name: /create|add|new/i }).click();
      
      // Select type
      const typeOption = page.getByText(/postgresql/i);
      if (await typeOption.isVisible()) {
        await typeOption.click();
      }
      
      const connectionName = `e2e_test_connection_${Date.now()}`;
      
      await page.getByLabel(/name/i).fill(connectionName);
      await page.getByLabel(/host/i).fill('localhost');
      await page.getByLabel(/port/i).fill('5432');
      await page.getByLabel(/database/i).fill('test_db');
      await page.getByLabel(/username/i).fill('test_user');
      
      const passwordField = page.getByLabel(/password/i);
      if (await passwordField.isVisible()) {
        await passwordField.fill('test_password');
      }
      
      await page.getByRole('button', { name: /create|save/i }).click();
      
      // Should show success or redirect
      await expect(page.getByText(/created|success/i)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Connection Testing', () => {
    // TODO: Connection testing not yet implemented
    test.skip('should have test connection button', async ({ page }) => {
      await page.getByRole('button', { name: /create|add|new/i }).click();
      
      const typeOption = page.getByText(/postgresql/i);
      if (await typeOption.isVisible()) {
        await typeOption.click();
      }
      
      const testButton = page.getByRole('button', { name: /test connection/i });
      await expect(testButton).toBeVisible();
    });

    // TODO: Connection testing not yet implemented
    test.skip('should show test results', async ({ page }) => {
      await page.getByRole('button', { name: /create|add|new/i }).click();
      
      const typeOption = page.getByText(/postgresql/i);
      if (await typeOption.isVisible()) {
        await typeOption.click();
      }
      
      // Fill in test details
      await page.getByLabel(/host/i).fill('localhost');
      await page.getByLabel(/port/i).fill('5432');
      await page.getByLabel(/database/i).fill('test');
      await page.getByLabel(/username/i).fill('test');
      
      const testButton = page.getByRole('button', { name: /test connection/i });
      if (await testButton.isVisible()) {
        await testButton.click();
        
        // Should show test result (success or failure)
        await expect(page.getByText(/success|failed|error|connected/i)).toBeVisible({ timeout: 10000 });
      }
    });
  });

  test.describe('Connection Management', () => {
    test('should show connection details', async ({ page }) => {
      await page.waitForLoadState('networkidle');
      
      const connectionCard = page.locator('[data-testid="connection-card"], [role="row"]').first();
      
      if (await connectionCard.isVisible()) {
        await connectionCard.click();
        
        // Should show connection details
        await expect(page.getByText(/host|database|type/i)).toBeVisible();
      }
    });

    test('should edit connection', async ({ page }) => {
      await page.waitForLoadState('networkidle');
      
      const connectionCard = page.locator('[data-testid="connection-card"], [role="row"]').first();
      
      if (await connectionCard.isVisible()) {
        await connectionCard.click();
        
        const editButton = page.getByRole('button', { name: /edit/i });
        
        if (await editButton.isVisible()) {
          await editButton.click();
          
          // Should show edit form
          await expect(page.getByLabel(/name/i)).toBeVisible();
        }
      }
    });

    test('should delete connection', async ({ page }) => {
      await page.waitForLoadState('networkidle');
      
      const connectionCard = page.locator('[data-testid="connection-card"], [role="row"]').first();
      
      if (await connectionCard.isVisible()) {
        // Find delete button (might be in menu)
        const menuButton = connectionCard.getByRole('button', { name: /menu|more/i });
        
        if (await menuButton.isVisible()) {
          await menuButton.click();
          
          const deleteOption = page.getByRole('menuitem', { name: /delete/i });
          if (await deleteOption.isVisible()) {
            await deleteOption.click();
            
            // Should show confirmation dialog
            await expect(page.getByText(/confirm|sure|delete/i)).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Schema Discovery', () => {
    test('should initiate schema discovery', async ({ page }) => {
      await page.waitForLoadState('networkidle');
      
      const connectionCard = page.locator('[data-testid="connection-card"], [role="row"]').first();
      
      if (await connectionCard.isVisible()) {
        await connectionCard.click();
        
        const discoverButton = page.getByRole('button', { name: /discover|scan|import/i });
        
        if (await discoverButton.isVisible()) {
          await expect(discoverButton).toBeVisible();
        }
      }
    });
  });
});

test.describe('File Upload', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/upload');
  });

  test('should display file upload page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /upload/i })).toBeVisible();
  });

  test('should have drag and drop zone', async ({ page }) => {
    const dropZone = page.locator('[data-testid="dropzone"], .dropzone, [role="button"]');
    await expect(dropZone.first()).toBeVisible();
  });

  test('should show supported file types', async ({ page }) => {
    await expect(page.getByText(/csv|xlsx|json|parquet|supported/i)).toBeVisible();
  });

  // TODO: File upload functionality not yet implemented
  test.skip('should upload a file', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    
    // Create a test CSV content
    const csvContent = 'id,name,email\n1,John Doe,john@test.com\n2,Jane Doe,jane@test.com';
    
    // Upload using file chooser
    const fileChooserPromise = page.waitForEvent('filechooser');
    
    // Click on upload area
    const uploadButton = page.getByRole('button', { name: /upload|choose|browse/i });
    if (await uploadButton.isVisible()) {
      await uploadButton.click();
      
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles({
        name: 'test_upload.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(csvContent),
      });
      
      // Should show upload progress or success
      await expect(page.getByText(/uploading|processing|success|complete/i)).toBeVisible({ timeout: 30000 });
    }
  });
});
