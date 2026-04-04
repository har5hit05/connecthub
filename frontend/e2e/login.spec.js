import { test, expect } from '@playwright/test';

test('has title and login redirect', async ({ page }) => {
  // Going to the root dashboard should redirect unauthenticated users to /login
  await page.goto('/');
  
  // Verify title matches our new Meta tag
  await expect(page).toHaveTitle(/ConnectHub/);
  
  // Verify we are correctly redirected to the login screen
  await expect(page).toHaveURL(/.*login/);
  
  // Check that the Sign In form is visible
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
});
