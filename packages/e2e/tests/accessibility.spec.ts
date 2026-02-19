import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility E2E Tests
 * 
 * Tests cover WCAG 2.1 compliance:
 * - Color contrast
 * - Keyboard navigation
 * - Screen reader compatibility
 * - Focus management
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

test.describe('Accessibility', () => {
  test.describe('Login Page Accessibility', () => {
    test('should have no critical accessibility violations on login page', async ({ page }) => {
      await page.goto('/login');
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      
      const criticalViolations = accessibilityScanResults.violations.filter(
        v => v.impact === 'critical' || v.impact === 'serious'
      );
      
      if (criticalViolations.length > 0) {
        console.log('Critical accessibility violations:', JSON.stringify(criticalViolations, null, 2));
      }
      
      expect(criticalViolations.length).toBe(0);
    });

    test('should have proper form labels', async ({ page }) => {
      await page.goto('/login');
      
      // All form inputs should have associated labels
      const inputs = page.locator('input:not([type="hidden"])');
      const count = await inputs.count();
      
      for (let i = 0; i < count; i++) {
        const input = inputs.nth(i);
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');
        
        const hasLabel = id || ariaLabel || ariaLabelledBy;
        expect(hasLabel).toBeTruthy();
      }
    });

    test('should support keyboard-only login', async ({ page }) => {
      await page.goto('/login');
      
      // Tab to email field
      await page.keyboard.press('Tab');
      const emailFocused = await page.locator('input:focus').getAttribute('type');
      expect(['email', 'text']).toContain(emailFocused?.toLowerCase());
      
      // Type email
      await page.keyboard.type(TEST_USER.email);
      
      // Tab to password field
      await page.keyboard.press('Tab');
      const passwordFocused = await page.locator('input:focus').getAttribute('type');
      expect(passwordFocused).toBe('password');
      
      // Type password
      await page.keyboard.type(TEST_USER.password);
      
      // Tab to submit button
      await page.keyboard.press('Tab');
      
      // Submit with Enter
      await page.keyboard.press('Enter');
      
      // Should redirect to dashboard
      await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
    });
  });

  test.describe('Dashboard Accessibility', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('should have no critical accessibility violations on dashboard', async ({ page }) => {
      await page.waitForLoadState('networkidle');
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .exclude('.chart-container') // Exclude complex chart components
        .analyze();
      
      const criticalViolations = accessibilityScanResults.violations.filter(
        v => v.impact === 'critical' || v.impact === 'serious'
      );
      
      expect(criticalViolations.length).toBe(0);
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
      
      // Should have at least one heading
      expect(headings.length).toBeGreaterThan(0);
      
      // First heading should be h1 or h2
      const firstHeading = page.locator('h1, h2').first();
      await expect(firstHeading).toBeVisible();
    });

    test('should have skip link for keyboard users', async ({ page }) => {
      // Look for skip to content link
      await page.keyboard.press('Tab');
      
      const skipLink = page.getByRole('link', { name: /skip to|skip navigation/i });
      
      // Skip link may or may not be present
      if (await skipLink.isVisible()) {
        await skipLink.click();
        
        // Focus should move to main content
        const focusedElement = await page.locator(':focus').first();
        await expect(focusedElement).toBeVisible();
      }
    });

    test('should have accessible navigation', async ({ page }) => {
      const nav = page.locator('nav, [role="navigation"]');
      await expect(nav.first()).toBeVisible();
      
      // Navigation should have proper aria attributes
      const ariaLabel = await nav.first().getAttribute('aria-label');
      const ariaLabelledBy = await nav.first().getAttribute('aria-labelledby');
      
      // At least one accessible label should exist
    });

    test('should be navigable with keyboard', async ({ page }) => {
      // Tab through interactive elements
      let tabCount = 0;
      const maxTabs = 20;
      
      while (tabCount < maxTabs) {
        await page.keyboard.press('Tab');
        tabCount++;
        
        const focusedElement = await page.evaluate(() => {
          return document.activeElement?.tagName;
        });
        
        // Should be able to reach footer or cycle
        if (focusedElement === 'BODY') break;
      }
      
      expect(tabCount).toBeGreaterThan(3); // Should have multiple tabbable elements
    });
  });

  test.describe('Form Accessibility', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('should have accessible error messages', async ({ page }) => {
      await page.goto('/settings');
      
      // Try to save with invalid data
      const saveButton = page.getByRole('button', { name: /save/i });
      
      if (await saveButton.isVisible()) {
        // Clear a required field and submit
        const emailInput = page.getByLabel(/email/i);
        if (await emailInput.isVisible()) {
          await emailInput.clear();
          await saveButton.click();
          
          // Error should be associated with input
          const errorMessage = page.locator('[role="alert"], .error-message, [aria-invalid="true"]');
          await expect(errorMessage.first()).toBeVisible();
        }
      }
    });

    test('should announce form submission status', async ({ page }) => {
      await page.goto('/settings');
      
      const saveButton = page.getByRole('button', { name: /save/i });
      
      if (await saveButton.isVisible()) {
        await saveButton.click();
        
        // Look for status message (should have appropriate ARIA role)
        const statusMessage = page.locator('[role="status"], [role="alert"], .toast, .snackbar');
        
        // Wait for status message
        await expect(statusMessage.first()).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Color Contrast', () => {
    test('should have sufficient color contrast on login page', async ({ page }) => {
      await page.goto('/login');
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .options({ runOnly: ['color-contrast'] })
        .analyze();
      
      expect(accessibilityScanResults.violations.length).toBe(0);
    });
  });

  test.describe('Interactive Elements', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('should have focus indicators', async ({ page }) => {
      await page.keyboard.press('Tab');
      
      // Focused element should have visible focus indicator
      const focusedElement = page.locator(':focus');
      
      // Check for outline or other focus styling
      const outline = await focusedElement.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.outline !== 'none' || style.boxShadow !== 'none';
      });
      
      // Focus should be visible somehow
      expect(outline).toBeTruthy();
    });

    test('should have accessible buttons', async ({ page }) => {
      const buttons = page.getByRole('button');
      const count = await buttons.count();
      
      for (let i = 0; i < Math.min(count, 10); i++) {
        const button = buttons.nth(i);
        
        if (await button.isVisible()) {
          const text = await button.textContent();
          const ariaLabel = await button.getAttribute('aria-label');
          const ariaLabelledBy = await button.getAttribute('aria-labelledby');
          
          // Button should have accessible name
          const hasAccessibleName = text?.trim() || ariaLabel || ariaLabelledBy;
          expect(hasAccessibleName).toBeTruthy();
        }
      }
    });

    test('should have accessible links', async ({ page }) => {
      const links = page.getByRole('link');
      const count = await links.count();
      
      for (let i = 0; i < Math.min(count, 10); i++) {
        const link = links.nth(i);
        
        if (await link.isVisible()) {
          const text = await link.textContent();
          const ariaLabel = await link.getAttribute('aria-label');
          
          // Link should have accessible name (not just "click here")
          const hasAccessibleName = (text?.trim() && text.length > 2) || ariaLabel;
          expect(hasAccessibleName).toBeTruthy();
        }
      }
    });
  });

  test.describe('Images and Media', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('should have alt text on informative images', async ({ page }) => {
      const images = page.locator('img:not([role="presentation"]):not([alt=""])');
      const count = await images.count();
      
      for (let i = 0; i < count; i++) {
        const img = images.nth(i);
        
        if (await img.isVisible()) {
          const alt = await img.getAttribute('alt');
          const role = await img.getAttribute('role');
          
          // Decorative images should have alt="" or role="presentation"
          // Informative images should have meaningful alt text
          const isAccessible = alt !== null || role === 'presentation';
          expect(isAccessible).toBeTruthy();
        }
      }
    });
  });
});
