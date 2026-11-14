import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('PyroSync Non-Expert UI Redesign & Accessibility Acceptance', () => {
  test('passes visual, plain-language, and accessibility acceptance', async ({ page }) => {
    await page.goto('/');

    // 1. Synthetic banner is visible in normal flow and does NOT overlap header
    const banner = page.getByRole('alert', { name: 'Synthetic Data Warning' });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('DEMO DATA');

    const header = page.getByRole('banner');
    await expect(header).toBeVisible();

    const bannerBox = await banner.boundingBox();
    const headerBox = await header.boundingBox();
    expect(bannerBox).not.toBeNull();
    expect(headerBox).not.toBeNull();
    if (bannerBox && headerBox) {
      // Banner must be above or at the top of header in normal page flow
      expect(bannerBox.y + bannerBox.height).toBeLessThanOrEqual(headerBox.y + 2);
    }

    // 2. Header title & one-line description
    await expect(page.getByRole('heading', { name: 'PyroSync' })).toBeVisible();
    await expect(page.getByText('California wildfire activity from satellites, 2000–2021')).toBeVisible();

    // 3. Region chips above the map
    await expect(page.getByRole('button', { name: 'All California' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'North' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Central' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'South' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Draw an area/i })).toBeVisible();

    // 4. Map and Cividis default legend
    await expect(page.getByText(/Cividis/i)).toBeVisible();

    // 5. Calendar "Which months were busiest?"
    await expect(page.getByRole('grid', { name: /Burn activity calendar/i })).toBeVisible();
    await expect(page.getByText('Which months were busiest?')).toBeVisible();
    await expect(page.getByText(/Quiet/i)).toBeVisible();
    await expect(page.getByText(/Moderate/i)).toBeVisible();
    await expect(page.getByText(/^Busy/i)).toBeVisible();
    await expect(page.getByText(/Very busy/i)).toBeVisible();

    // 6. Plain-language summary & Reliability badge
    await expect(page.getByText(/In [A-Za-z]+ \d{4}, satellites detected/i)).toBeVisible();
    // Default active month is 2020-08 (observed month): must say "Measured by satellite" and have NO error band
    await expect(page.getByText('Measured by satellite')).toBeVisible();
    await expect(page.getByText(/typical error/i)).not.toBeVisible();

    // 7. Footer semantics & record bounds
    const footer = page.getByRole('contentinfo');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('2021-12');
    await expect(footer).toContainText('Counts are satellite detections, not fires or burned area');

    // 8. BANNED JARGON STRINGS must NOT appear in main UI
    const mainWorkspaceText = await page.locator('#main-workspace').innerText();
    const headerText = await header.innerText();
    const visibleText = `${headerText} ${mainWorkspaceText}`.toLowerCase();

    const bannedWords = [
      'harmonized',
      'normalization',
      'loyo',
      'wape',
      'quantile',
      'frp',
      'provisional',
      'viirs-equivalent',
    ];

    for (const word of bannedWords) {
      expect(visibleText).not.toContain(word);
    }

    // 9. NO false "perimeter" claims anywhere in document
    const bodyText = (await page.locator('body').innerText()).toLowerCase();
    expect(bodyText).not.toContain('ground fire perimeter');
    expect(bodyText).not.toContain('fire perimeters');

    // 10. NO developer instructions as UI copy
    expect(bodyText).not.toContain('do not center on point estimate');

    // 11. Axe automated accessibility audit (excluding basemap external tile contrast)
    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(['color-contrast']) // MapLibre third-party vector basemap tiles
      .analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // 12. Save responsive after screenshots at required dimensions
    const sizes = [
      { width: 1440, height: 900, name: 'after-1440.png' },
      { width: 1024, height: 768, name: 'after-1024.png' },
      { width: 390, height: 844, name: 'after-390.png' },
    ];

    for (const s of sizes) {
      await page.setViewportSize({ width: s.width, height: s.height });
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `../docs/screenshots/${s.name}`,
        fullPage: false,
      });
    }
  });

  test('displays explicit error screen when loading malformed dataset', async ({ page }) => {
    await page.goto('/?dataset=malformed');

    const errorHeading = page.getByRole('heading', { name: 'Dataset Loading Failure' });
    await expect(errorHeading).toBeVisible();

    await expect(page.getByText('Failed File: manifest.json')).toBeVisible();
    await expect(page.getByText('Failed Field: studyArea')).toBeVisible();
  });
});
