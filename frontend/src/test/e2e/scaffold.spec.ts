import { test, expect } from '@playwright/test';

test.describe('Milestone 0+1+2+3: Scaffold, Contract & UI Verification', () => {
  test('boots cleanly on synthetic data and renders persistent red banner', async ({ page }) => {
    await page.goto('/');

    // Check for synthetic banner
    const banner = page.getByRole('alert', { name: 'Synthetic Data Warning' });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('SYNTHETIC DATA');

    // Check Header and Title
    await expect(page.getByRole('heading', { name: 'PyroSync' })).toBeVisible();
    await expect(page.getByText('Coverage: 2000-11 to 2021-12', { exact: true })).toBeVisible();

    // Check map section heading is present
    await expect(page.getByRole('heading', { name: /California 10 km Grid/i })).toBeVisible();

    // Check calendar section is present
    await expect(page.getByRole('grid', { name: /Burn activity calendar/i })).toBeVisible();

    // Check footer says data ends 2021-12
    await expect(page.getByRole('contentinfo').getByText('2021-12')).toBeVisible();

    // Capture verification screenshot
    await page.screenshot({
      path: '../docs/screenshots/m1-app-boot.png',
      fullPage: false,
    });
  });

  test('displays explicit error screen when loading malformed dataset', async ({ page }) => {
    await page.goto('/?dataset=malformed');

    // Check for ErrorScreen
    const errorHeading = page.getByRole('heading', { name: 'Dataset Loading Failure' });
    await expect(errorHeading).toBeVisible();

    // Verify named file and failed field
    await expect(page.getByText('Failed File: manifest.json')).toBeVisible();
    await expect(page.getByText('Failed Field: studyArea')).toBeVisible();

    // Capture verification screenshot
    await page.screenshot({
      path: '../docs/screenshots/m0-malformed-error.png',
      fullPage: false,
    });
  });
});
