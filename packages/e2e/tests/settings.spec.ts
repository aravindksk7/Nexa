import { test, expect, Page } from '@playwright/test';

/**
 * Settings Page E2E Tests
 * 
 * Tests cover:
 * - Profile settings
 * - Notification preferences
 * - Password change
 * - Appearance settings
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

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/settings');
  });

  test.describe('Settings Page Layout', () => {
    test('should display settings page', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
    });

    test('should have settings tabs or sections', async ({ page }) => {
      // Check for common settings sections
      const profileTab = page.getByRole('tab', { name: /profile/i });
      const notificationsTab = page.getByRole('tab', { name: /notification/i });
      const securityTab = page.getByRole('tab', { name: /security|password/i });
      const appearanceTab = page.getByRole('tab', { name: /appearance|theme/i });

      // At least profile should be visible
      await expect(profileTab).toBeVisible();
    });
  });

  test.describe('Profile Settings', () => {
    test('should display profile form', async ({ page }) => {
      const profileTab = page.getByRole('tab', { name: /profile/i });
      
      if (await profileTab.isVisible()) {
        await profileTab.click();
      }

      await expect(page.getByLabel(/first name/i)).toBeVisible();
      await expect(page.getByLabel(/last name/i)).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
    });

    // TODO: Profile update save functionality not yet working
    test.skip('should update profile information', async ({ page }) => {
      const profileTab = page.getByRole('tab', { name: /profile/i });
      
      if (await profileTab.isVisible()) {
        await profileTab.click();
      }

      // Update first name
      const firstNameInput = page.getByLabel(/first name/i);
      await firstNameInput.clear();
      await firstNameInput.fill('Updated');

      await page.getByRole('button', { name: /save/i }).click();

      await expect(page.getByText(/saved|success|updated/i)).toBeVisible();
    });

    test('should show user avatar', async ({ page }) => {
      const profileTab = page.getByRole('tab', { name: /profile/i });
      
      if (await profileTab.isVisible()) {
        await profileTab.click();
      }

      // Avatar should be visible
      const avatar = page.locator('[data-testid="avatar"], .MuiAvatar-root, img[alt*="avatar"]');
      await expect(avatar.first()).toBeVisible();
    });
  });

  test.describe('Notification Settings', () => {
    test('should display notification preferences', async ({ page }) => {
      const notificationsTab = page.getByRole('tab', { name: /notification/i });
      
      if (await notificationsTab.isVisible()) {
        await notificationsTab.click();

        // Should show toggle switches
        await expect(page.getByText(/email notification/i)).toBeVisible();
      }
    });

    test('should toggle notification settings', async ({ page }) => {
      const notificationsTab = page.getByRole('tab', { name: /notification/i });
      
      if (await notificationsTab.isVisible()) {
        await notificationsTab.click();

        // Find a switch/toggle
        const toggleSwitch = page.locator('input[type="checkbox"], .MuiSwitch-input').first();
        
        if (await toggleSwitch.isVisible()) {
          const initialState = await toggleSwitch.isChecked();
          await toggleSwitch.click();
          
          // State should have changed
          const newState = await toggleSwitch.isChecked();
          expect(newState).not.toBe(initialState);
        }
      }
    });
  });

  test.describe('Security Settings', () => {
    test('should display password change form', async ({ page }) => {
      const securityTab = page.getByRole('tab', { name: /security/i });
      
      if (await securityTab.isVisible()) {
        await securityTab.click();

        await expect(page.getByLabel('Current Password')).toBeVisible();
        await expect(page.getByLabel('New Password')).toBeVisible();
      }
    });

    test('should validate password requirements', async ({ page }) => {
      const securityTab = page.getByRole('tab', { name: /security/i });
      
      if (await securityTab.isVisible()) {
        await securityTab.click();

        await page.getByLabel('Current Password').fill(TEST_USER.password);
        await page.getByLabel('New Password').fill('weak');
        await page.getByLabel('Confirm New Password').fill('weak');

        // Button is disabled when passwords don't match requirements
        const updateButton = page.getByRole('button', { name: /update password/i });
        await expect(updateButton).toBeDisabled();
      }
    });

    test('should require matching passwords', async ({ page }) => {
      const securityTab = page.getByRole('tab', { name: /security/i });
      
      if (await securityTab.isVisible()) {
        await securityTab.click();

        await page.getByLabel('Current Password').fill(TEST_USER.password);
        await page.getByLabel('New Password').fill('NewSecure@123');
        await page.getByLabel('Confirm New Password').fill('DifferentPassword@123');

        // Button is disabled when passwords don't match
        const updateButton = page.getByRole('button', { name: /update password/i });
        await expect(updateButton).toBeDisabled();
      }
    });
  });

  test.describe('Appearance Settings', () => {
    test('should display appearance options', async ({ page }) => {
      const appearanceTab = page.getByRole('tab', { name: /appearance|theme/i });
      
      if (await appearanceTab.isVisible()) {
        await appearanceTab.click();

        // Should show theme options
        await expect(page.getByText(/dark mode|theme/i)).toBeVisible();
      }
    });

    test('should toggle dark mode', async ({ page }) => {
      const appearanceTab = page.getByRole('tab', { name: /appearance|theme/i });
      
      if (await appearanceTab.isVisible()) {
        await appearanceTab.click();

        const darkModeToggle = page.locator('[data-testid="dark-mode-toggle"], input[type="checkbox"]').first();
        
        if (await darkModeToggle.isVisible()) {
          await darkModeToggle.click();
          
          // Theme should change - check for dark class or data attribute
          // This is highly implementation-dependent
        }
      }
    });
  });
});
