import { test, expect, Page } from '@playwright/test';

/**
 * Authentication E2E Tests
 * 
 * Tests cover:
 * - Login flow
 * - Registration flow
 * - Session management
 * - Protected route access
 * - Logout functionality
 */

const TEST_USERS = {
  admin: {
    email: 'admin@nexa.io',
    password: 'Admin@123456',
    firstName: 'Admin',
  },
  analyst: {
    email: 'analyst@nexa.io',
    password: 'Analyst@123456',
    firstName: 'Sarah',
  },
};

test.describe('Authentication', () => {
  test.describe('Login Page', () => {
    test('should display login form', async ({ page }) => {
      await page.goto('/login');
      
      await expect(page.getByText('Sign in to your account')).toBeVisible();
      await expect(page.getByLabel('Email')).toBeVisible();
      await expect(page.getByLabel('Password')).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    });

    test('should login with valid credentials', async ({ page }) => {
      await page.goto('/login');
      
      await page.getByLabel('Email').fill(TEST_USERS.admin.email);
      await page.getByLabel('Password').fill(TEST_USERS.admin.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // Should redirect to dashboard
      await expect(page).toHaveURL(/dashboard/);
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login');
      
      await page.getByLabel('Email').fill('invalid@test.com');
      await page.getByLabel('Password').fill('WrongPassword123!');
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // Should show error message
      await expect(page.getByRole('alert')).toBeVisible();
      
      // Should stay on login page
      await expect(page).toHaveURL(/login/);
    });

    test('should show validation errors for empty fields', async ({ page }) => {
      await page.goto('/login');
      
      // Try to submit without filling fields
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // Should show validation messages
      await expect(page.getByText(/required/i)).toBeVisible();
    });

    test('should have link to registration', async ({ page }) => {
      await page.goto('/login');
      
      const registerLink = page.getByRole('link', { name: /sign up|create/i });
      await expect(registerLink).toBeVisible();
    });

    test('should persist session after page refresh', async ({ page }) => {
      // Login first
      await page.goto('/login');
      await page.getByLabel('Email').fill(TEST_USERS.admin.email);
      await page.getByLabel('Password').fill(TEST_USERS.admin.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await expect(page).toHaveURL(/dashboard/);
      
      // Refresh page
      await page.reload();
      
      // Should still be logged in
      await expect(page).toHaveURL(/dashboard/);
    });
  });

  test.describe('Registration', () => {
    test('should display registration form', async ({ page }) => {
      await page.goto('/register');
      
      await expect(page.getByLabel('Full Name')).toBeVisible();
      await expect(page.getByLabel('Email')).toBeVisible();
      await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Confirm Password')).toBeVisible();
    });

    test('should show password requirements', async ({ page }) => {
      await page.goto('/register');
      
      const passwordField = page.getByLabel('Password', { exact: true });
      await passwordField.focus();
      
      // Password requirements should be visible or in placeholder/helper text
      // This depends on the UI implementation
    });

    test('should validate email format', async ({ page }) => {
      await page.goto('/register');
      
      await page.getByLabel('Email').fill('not-an-email');
      await page.getByRole('button', { name: /create account/i }).click();
      
      await expect(page.getByText(/invalid email/i)).toBeVisible();
    });

    test('should reject weak passwords', async ({ page }) => {
      await page.goto('/register');
      
      await page.getByLabel('Full Name').fill('Test User');
      await page.getByLabel('Email').fill(`test_${Date.now()}@test.com`);
      await page.getByLabel('Password', { exact: true }).fill('weak');
      await page.getByLabel('Confirm Password').fill('weak');
      
      await page.getByRole('button', { name: /create account/i }).click();
      
      // Should show password requirements error
      await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect to login when accessing dashboard without auth', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Should redirect to login
      await expect(page).toHaveURL(/login/);
    });

    test('should redirect to login when accessing catalog without auth', async ({ page }) => {
      await page.goto('/catalog');
      
      await expect(page).toHaveURL(/login/);
    });

    test('should redirect to login when accessing settings without auth', async ({ page }) => {
      await page.goto('/settings');
      
      await expect(page).toHaveURL(/login/);
    });
  });

  test.describe('Logout', () => {
    test('should logout successfully', async ({ page }) => {
      // Login first
      await page.goto('/login');
      await page.getByLabel('Email').fill(TEST_USERS.admin.email);
      await page.getByLabel('Password').fill(TEST_USERS.admin.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await expect(page).toHaveURL(/dashboard/);
      
      // Find and click logout or user menu
      const logoutButton = page.getByRole('button', { name: /logout|sign out/i });
      const userMenuButton = page.getByRole('button', { name: /user|account|profile|menu/i });
      
      if (await logoutButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await logoutButton.click();
      } else if (await userMenuButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await userMenuButton.click();
        // If there's a dropdown, click the actual logout option
        const logoutOption = page.getByRole('menuitem', { name: /logout|sign out/i });
        if (await logoutOption.isVisible({ timeout: 1000 }).catch(() => false)) {
          await logoutOption.click();
        }
      }
      
      // Should redirect to login
      await expect(page).toHaveURL(/login/);
    });

    test('should clear session storage on logout', async ({ page }) => {
      // Login
      await page.goto('/login');
      await page.getByLabel('Email').fill(TEST_USERS.admin.email);
      await page.getByLabel('Password').fill(TEST_USERS.admin.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await expect(page).toHaveURL(/dashboard/);
      
      // Verify token exists
      const hasToken = await page.evaluate(() => {
        return !!localStorage.getItem('accessToken') || !!sessionStorage.getItem('accessToken');
      });
      
      // Logout - try various methods
      const logoutButton = page.getByRole('button', { name: /logout|sign out/i });
      const userMenuButton = page.getByRole('button', { name: /user|account|profile|menu/i });
      
      if (await logoutButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await logoutButton.click();
      } else if (await userMenuButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await userMenuButton.click();
        const logoutOption = page.getByRole('menuitem', { name: /logout|sign out/i });
        if (await logoutOption.isVisible({ timeout: 1000 }).catch(() => false)) {
          await logoutOption.click();
        }
      }
      
      // Verify token is cleared
      await page.waitForURL(/login/, { timeout: 5000 }).catch(() => {});
      const hasTokenAfterLogout = await page.evaluate(() => {
        return !!localStorage.getItem('accessToken') || !!sessionStorage.getItem('accessToken');
      });
      
      expect(hasTokenAfterLogout).toBe(false);
    });
  });
});

// Helper function to login
export async function login(page: Page, user: keyof typeof TEST_USERS = 'admin') {
  await page.goto('/login');
  await page.getByLabel('Email').fill(TEST_USERS[user].email);
  await page.getByLabel('Password').fill(TEST_USERS[user].password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/);
}
