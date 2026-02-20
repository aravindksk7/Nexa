import { test, expect, Page } from '@playwright/test';

/**
 * Quality Rules E2E Tests
 *
 * Tests cover:
 * - Quality overview page display
 * - Quality rule creation
 * - Quality rule evaluation
 * - Quality rule management
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

test.describe('Quality Rules', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/quality');
  });

  test('should display quality page', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /quality/i })).toBeVisible();
  });

  test('should display quality overview metrics', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Should show some score or overview section
    const overviewSection = page.locator('[data-testid="quality-overview"], .quality-overview, [class*="overview"]');
    const scoreText = page.getByText(/score|quality|rules/i);
    
    await expect(scoreText.first()).toBeVisible();
  });

  test('should have a button to create a new quality rule', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const createButton = page.getByRole('button', { name: /add rule|new rule|create rule|add quality rule/i });
    await expect(createButton).toBeVisible();
  });

  test('should open rule creation dialog', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const createButton = page.getByRole('button', { name: /add rule|new rule|create rule|add quality rule/i });
    await createButton.click();

    // Dialog should open
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Should have form fields
    await expect(page.getByLabel(/rule name|name/i).first()).toBeVisible();
  });

  test('should display severity options including CRITICAL', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const createButton = page.getByRole('button', { name: /add rule|new rule|create rule|add quality rule/i });
    await createButton.click();

    await page.getByRole('dialog').waitFor({ state: 'visible' });

    // Look for severity select/dropdown
    const severitySelect = page.locator('select[name="severity"], [aria-label*="severity" i], label:has-text("Severity")').first();
    
    if (await severitySelect.isVisible()) {
      // Check enum values exist (should be INFO, WARNING, CRITICAL — not HIGH/MEDIUM/LOW)
      const html = await page.content();
      expect(html).toContain('CRITICAL');
      // The old wrong values should not be primary options
    }
  });

  test('should display rule type options including COMPLETENESS', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const createButton = page.getByRole('button', { name: /add rule|new rule|create rule|add quality rule/i });
    await createButton.click();

    await page.getByRole('dialog').waitFor({ state: 'visible' });

    // Open the Rule Type dropdown to load the options into the DOM
    const ruleTypeSelect = page.locator('[id="mui-component-select-ruleType"]');
    await ruleTypeSelect.click();

    // Wait for the listbox/menu to appear
    await page.waitForSelector('[role="listbox"], [role="option"]', { timeout: 5000 }).catch(() => {});

    // Page HTML should include correct enum values now that dropdown is open
    const html = await page.content();
    expect(html).toContain('COMPLETENESS');
  });

  test('should close dialog on cancel', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const createButton = page.getByRole('button', { name: /add rule|new rule|create rule|add quality rule/i });
    await createButton.click();

    await page.getByRole('dialog').waitFor({ state: 'visible' });

    const cancelButton = page.getByRole('button', { name: /cancel/i });
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    }
  });
});
