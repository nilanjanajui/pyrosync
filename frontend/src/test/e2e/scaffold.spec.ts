import { test, expect } from '@playwright/test';

test.describe('Milestone 0: Scaffold & Data Contract Verification', () => {
  test('boots cleanly on synthetic data and renders persistent red banner', async ({ page }) => {
    await page.goto('/');

    // Check for synthetic banner
    const banner = page.getByRole('alert', { name: 'Synthetic Data Warning' });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('SYNTHETIC DATA');

    // Check Header and Title
    await expect(page.getByRole('heading', { name: 'PyroSync' })).toBeVisible();
    await expect(page.getByText('Coverage: 2000-11 to 2021-12', { exact: true })).toBeVisible();

    // Check study area and temporal coverage metrics
    await expect(page.getByText('California (Synthetic Test Fixture)')).toBeVisible();
    await expect(page.getByText('254 calendar months')).toBeVisible();

    // Capture verification screenshot
    await page.screenshot({
      path: '../docs/screenshots/m0-synthetic-boot.png',
      fullPage: true,
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
      fullPage: true,
    });
  });
});

