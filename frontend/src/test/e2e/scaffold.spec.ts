import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('PyroSync Non-Expert UI Redesign & Accessibility Acceptance', () => {
  test('passes visual, plain-language, and accessibility acceptance', async ({ page }) => {
    await page.goto('/');

    // 1. Demo-data markers are absent for real data (synthetic: false).
    //    When synthetic: true, a Demo badge appears near numbers but NOT in the top nav bar.
    const header = page.getByRole('banner');
    await expect(header).toBeVisible();
    await expect(header).not.toContainText(/demo/i);
    await expect(page.getByRole('alert', { name: 'Synthetic Data Warning' })).toHaveCount(0);

    // 2. Header title & one-line description
    await expect(page.getByRole('heading', { name: 'PyroSync' })).toBeVisible();
    await expect(page.getByText('California · wildfire activity seen from satellites')).toBeVisible();
    await expect(header).toContainText('2000-11 to 2021-12');

    // 3. Region chips above the map
    await expect(page.getByRole('button', { name: 'All California' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'North' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Central' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'South' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Draw an area/i })).toBeVisible();

    // 4. Map and Cividis default legend
    await expect(page.getByText('Hotspot detections').first()).toBeVisible();

    // 5. Calendar "Which months were busiest?"
    await expect(page.getByRole('grid', { name: /Burn activity calendar/i })).toBeVisible();
    await expect(page.getByText('Which months were busiest?')).toBeVisible();
    await expect(page.getByText(/Quiet/i)).toBeVisible();
    await expect(page.getByText(/Moderate/i)).toBeVisible();
    await expect(page.getByText(/^Busy/i)).toBeVisible();
    await expect(page.getByText(/Very busy/i)).toBeVisible();

    // 6. Plain-language summary & Reliability badge
    await expect(page.getByText(/In [A-Za-z]+ \d{4}, satellites detected/i)).toBeVisible();
    // Default month is the latest month of the record (this month vs history), a measured month
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

  test('area outside the loaded dataset explains itself instead of showing zeros', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Enter coordinates instead').click();
    await page.getByLabel('Latitude °').fill('-33.9');
    await page.getByLabel('Longitude °').fill('151.2');
    await page.getByRole('button', { name: 'Show this area' }).click();
    await expect(page.getByText(/No satellite data is loaded for this place/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Download this area as CSV/ })).toBeDisabled();
  });

  test('CSV and calendar image downloads work', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Download CSV' }).first().click();
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('dialog').getByRole('button', { name: 'Download CSV' }).click(),
    ]);
    expect(dl.suggestedFilename()).toMatch(/^pyrosync_california_/);
    const { readFileSync } = await import('node:fs');
    const csv = readFileSync(await dl.path(), 'utf8');
    // Real data: no DEMO DATA header; CSV starts with PyroSync metadata comment
    expect(csv).toContain('# PyroSync fire activity export');
    // Synthetic data would contain: expect(csv).toContain('# DEMO DATA');
    const [img] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Save calendar as image|PNG/ }).click(),
    ]);
    expect(img.suggestedFilename()).toMatch(/\.png$/);
  });

  test('region name, extent and presets come from the dataset manifest (not hard-coded)', async ({ page }) => {
    await page.route('**/datasets/manifest.json*', async (route) => {
      const res = await route.fetch();
      const m = await res.json();
      m.studyArea.name = 'Portugal';
      m.studyArea.presets = [{ id: 'north', name: 'Douro', bbox: [-9, 40, -6, 42] }];
      await route.fulfill({ response: res, json: m });
    });
    await page.goto('/');
    await expect(page.getByText('Portugal · wildfire activity seen from satellites')).toBeVisible();
    await expect(page.getByRole('button', { name: 'All Portugal' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Douro' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Central' })).toHaveCount(0);
    expect(await page.locator('body').innerText()).not.toContain('California');
  });

  test('calendar can switch to the "compared with usual" view', async ({ page }) => {
    await page.goto('/');
    const counts = page.getByRole('button', { name: 'Hotspot counts' });
    const anomaly = page.getByRole('button', { name: 'Compared with usual' });
    await expect(counts).toHaveAttribute('aria-pressed', 'true');
    await anomaly.click();
    await expect(anomaly).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Much higher')).toBeVisible();
  });

  test('displays explicit error screen when loading malformed dataset', async ({ page }) => {
    await page.goto('/?dataset=malformed');

    const errorHeading = page.getByRole('heading', { name: 'Dataset Loading Failure' });
    await expect(errorHeading).toBeVisible();

    await expect(page.getByText('Failed File: manifest.json')).toBeVisible();
    await expect(page.getByText('Failed Field: studyArea')).toBeVisible();
  });

  test('location search finds landmarks and updates map location', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.getByRole('combobox', { name: /Search location/i });
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Yosemite');

    const yosemiteOption = page.getByRole('option', { name: /Yosemite National Park/i });
    await expect(yosemiteOption).toBeVisible();
    await yosemiteOption.click();

    await expect(page.getByText(/Yosemite National Park/i).first()).toBeVisible();
  });

  test('map switches between Satellite and Dark canvas, and Fire glow and Grid view', async ({ page }) => {
    await page.goto('/');

    const darkBtn = page.getByRole('button', { name: /Dark canvas/i });
    const satBtn = page.getByRole('button', { name: /Satellite/i });
    await expect(darkBtn).toHaveAttribute('aria-pressed', 'true');
    await satBtn.click();
    await expect(satBtn).toHaveAttribute('aria-pressed', 'true');

    const glowBtn = page.getByRole('button', { name: /Fire glow & icons/i });
    const gridBtn = page.getByRole('button', { name: /Grid cells/i });
    await expect(glowBtn).toHaveAttribute('aria-pressed', 'true');
    await gridBtn.click();
    await expect(gridBtn).toHaveAttribute('aria-pressed', 'true');
  });
});
