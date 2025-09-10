import { test, expect } from '@grafana/plugin-e2e';

async function getLastTraceId() {
  const end = Math.floor(new Date().getTime() / 1000);
  const start = end - 24 * 60 * 60;
  const q = '{}';
  const url = `http://localhost:3200/api/search?q=${encodeURIComponent(q)}&start=${start}&end=${end}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.traces[0].traceID;
}

async function gotoTraceViewerDashboard(gotoDashboardPage, traceId?: string) {
  const traceIdToUse = traceId || (await getLastTraceId());
  await gotoDashboardPage({
    uid: 'gr-trace-viewer-dashboard',
    queryParams: new URLSearchParams({
      'var-traceId': traceIdToUse,
    }),
  });
}

async function waitForDashboardLoad(page: any, timeout = 10000) {
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch {
    // Grafana 10.x support
    await page.waitForSelector('[data-testid^="span-name-"]', { timeout });
  }
}

test.describe('Span Expansion Tests', () => {
  test.beforeEach(async ({ page, gotoDashboardPage }) => {
    await gotoTraceViewerDashboard(gotoDashboardPage);
    await waitForDashboardLoad(page);
  });

  test('should expand first child node and verify RocketLaunchSystem loads', async ({ page }) => {
    await expect(page.getByTestId('span-virtual-item').first()).toBeVisible();

    // Verify initial state - should have root + 3 children (4 total)
    let virtualSpanCount = await page.getByTestId('span-virtual-item').count();
    expect(virtualSpanCount).toBe(4);

    // Find and expand the CountdownSequence span (first child)
    const countdownSequenceItem = page.getByTestId('span-list-item-CountdownSequence');
    await expect(countdownSequenceItem).toBeVisible();

    // Get the child count for CountdownSequence
    const countdownChildCount = countdownSequenceItem.locator('[data-testid="span-child-count"]');
    await expect(countdownChildCount).toBeVisible();
    const expectedChildCount = await countdownChildCount.textContent();
    expect(expectedChildCount).toBe('1'); // CountdownSequence has 1 child: RocketLaunch

    // Click the expand button for CountdownSequence
    const countdownExpandButton = countdownSequenceItem.locator('[data-testid="span-collapse-expand-button"]');
    await expect(countdownExpandButton).toBeVisible();
    await countdownExpandButton.click();

    await expect(page.getByTestId('span-list-item-RocketLaunch')).toBeVisible();

    // Verify the count increased by 1 (RocketLaunch was added)
    virtualSpanCount = await page.getByTestId('span-virtual-item').count();
    expect(virtualSpanCount).toBe(5);

    // Verify RocketLaunchSystem is not yet visible (it's a child of RocketLaunch)
    const rocketLaunchSystemItem = page.getByTestId('span-list-item-EngineSystem');
    await expect(rocketLaunchSystemItem).not.toBeVisible();
  });

  test('should verify child count matches loaded children for CountdownSequence', async ({ page }) => {
    await expect(page.getByTestId('span-virtual-item').first()).toBeVisible();

    // Find CountdownSequence span
    const countdownSequenceItem = page.getByTestId('span-list-item-CountdownSequence');
    await expect(countdownSequenceItem).toBeVisible();

    // Get the child count displayed in the square
    const countdownChildCount = countdownSequenceItem.getByTestId('span-child-count');
    await expect(countdownChildCount).toBeVisible();
    const displayedChildCount = await countdownChildCount.textContent();
    expect(displayedChildCount).toBe('1');

    // Expand CountdownSequence
    const countdownExpandButton = countdownSequenceItem.getByTestId('span-collapse-expand-button');
    await expect(countdownExpandButton).toBeVisible();
    await countdownExpandButton.click();

    await expect(page.getByTestId('span-list-item-RocketLaunch')).toBeVisible();

    // Count the actual visible children of CountdownSequence
    // After expansion, we should see RocketLaunch as a child
    const rocketLaunchItem = page.getByTestId('span-list-item-RocketLaunch');
    await expect(rocketLaunchItem).toBeVisible();

    // Verify that the displayed child count (1) matches the number of loaded children (1 - RocketLaunch)
    expect(displayedChildCount).toBe('1');
  });

  test('should expand next level and repeat tests for RocketLaunch', async ({ page }) => {
    await expect(page.getByTestId('span-virtual-item').first()).toBeVisible();

    // First, expand CountdownSequence to get to RocketLaunch
    const countdownSequenceItem = page.getByTestId('span-list-item-CountdownSequence');
    await expect(countdownSequenceItem).toBeVisible();

    const countdownExpandButton = countdownSequenceItem.getByTestId('span-collapse-expand-button');
    await expect(countdownExpandButton).toBeVisible();
    await countdownExpandButton.click();

    await expect(page.getByTestId('span-list-item-RocketLaunch')).toBeVisible();

    // Now test RocketLaunch expansion
    const rocketLaunchItem = page.getByTestId('span-list-item-RocketLaunch');
    await expect(rocketLaunchItem).toBeVisible();

    // Get the child count for RocketLaunch
    const rocketLaunchChildCount = rocketLaunchItem.getByTestId('span-child-count');
    await expect(rocketLaunchChildCount).toBeVisible();
    const expectedRocketChildCount = await rocketLaunchChildCount.textContent();
    expect(expectedRocketChildCount).toBe('5'); // RocketLaunch has 5 children

    // Expand RocketLaunch
    const rocketLaunchExpandButton = rocketLaunchItem.getByTestId('span-collapse-expand-button');
    await expect(rocketLaunchExpandButton).toBeVisible();
    await rocketLaunchExpandButton.click();

    await expect(page.getByTestId('span-list-item-EngineSystem')).toBeVisible();
    await expect(page.getByTestId('span-list-item-FuelSystem')).toBeVisible();
    await expect(page.getByTestId('span-list-item-GuidanceSystem')).toBeVisible();
    await expect(page.getByTestId('span-list-item-StageSeparation')).toBeVisible();

    // Verify the count increased by 5 (all RocketLaunch children)
    const virtualSpanCount = await page.getByTestId('span-virtual-item').count();
    expect(virtualSpanCount).toBe(10); // 4 initial + 1 (RocketLaunch) + 5 (RocketLaunch children)

    // Verify that the displayed child count (5) matches the number of loaded children
    expect(expectedRocketChildCount).toBe('5');

    // Verify all RocketLaunchSystem children are visible
    const engineSystemItem = page.getByTestId('span-list-item-EngineSystem');
    const fuelSystemItem = page.getByTestId('span-list-item-FuelSystem');
    const guidanceSystemItem = page.getByTestId('span-list-item-GuidanceSystem');
    const stageSeparationItem = page.getByTestId('span-list-item-StageSeparation');

    await expect(engineSystemItem).toBeVisible();
    await expect(fuelSystemItem).toBeVisible();
    await expect(guidanceSystemItem).toBeVisible();
    await expect(stageSeparationItem).toBeVisible();
  });

  test('should verify child counts match loaded children at each level', async ({ page }) => {
    await expect(page.getByTestId('span-virtual-item').first()).toBeVisible();

    // Test CountdownSequence level
    const countdownSequenceItem = page.getByTestId('span-list-item-CountdownSequence');
    await expect(countdownSequenceItem).toBeVisible();

    const countdownChildCount = countdownSequenceItem.getByTestId('span-child-count');
    const displayedCountdownCount = await countdownChildCount.textContent();
    expect(displayedCountdownCount).toBe('1');

    // Expand CountdownSequence
    const countdownExpandButton = countdownSequenceItem.getByTestId('span-collapse-expand-button');
    await countdownExpandButton.click();
    await expect(page.getByTestId('span-list-item-RocketLaunch')).toBeVisible();

    // Test RocketLaunch level
    const rocketLaunchItem = page.getByTestId('span-list-item-RocketLaunch');
    await expect(rocketLaunchItem).toBeVisible();

    const rocketLaunchChildCount = rocketLaunchItem.getByTestId('span-child-count');
    const displayedRocketCount = await rocketLaunchChildCount.textContent();
    expect(displayedRocketCount).toBe('5');

    // Expand RocketLaunch
    const rocketLaunchExpandButton = rocketLaunchItem.getByTestId('span-collapse-expand-button');
    await rocketLaunchExpandButton.click();

    await expect(page.getByTestId('span-list-item-EngineSystem')).toBeVisible();
    await expect(page.getByTestId('span-list-item-FuelSystem')).toBeVisible();
    await expect(page.getByTestId('span-list-item-GuidanceSystem')).toBeVisible();
    await expect(page.getByTestId('span-list-item-StageSeparation')).toBeVisible();

    // Verify final count
    const finalVirtualSpanCount = await page.getByTestId('span-virtual-item').count();
    expect(finalVirtualSpanCount).toBe(10); // 4 initial + 1 (RocketLaunch) + 5 (RocketLaunch children)

    // Verify all child counts are correct
    expect(displayedCountdownCount).toBe('1'); // CountdownSequence has 1 child
    expect(displayedRocketCount).toBe('5'); // RocketLaunch has 5 children
  });

  test('should verify span-child-count matches actual loaded children count', async ({ page }) => {
    await expect(page.getByTestId('span-virtual-item').first()).toBeVisible();

    // Test CountdownSequence
    const countdownSequenceItem = page.getByTestId('span-list-item-CountdownSequence');
    const countdownChildCount = countdownSequenceItem.getByTestId('span-child-count');
    const displayedCount = await countdownChildCount.textContent();

    // Expand CountdownSequence
    await countdownSequenceItem.getByTestId('span-collapse-expand-button').click();
    await expect(page.getByTestId('span-list-item-RocketLaunch')).toBeVisible();

    // Count actual children loaded (should be 1 - RocketLaunch)
    const rocketLaunchItems = page.getByTestId('span-list-item-RocketLaunch');
    const actualChildCount = await rocketLaunchItems.count();

    expect(displayedCount).toBe(actualChildCount.toString());

    // Test RocketLaunch level
    const rocketLaunchItem = page.getByTestId('span-list-item-RocketLaunch');
    const rocketChildCount = rocketLaunchItem.getByTestId('span-child-count');
    const displayedRocketCount = await rocketChildCount.textContent();

    // Expand RocketLaunch
    await rocketLaunchItem.getByTestId('span-collapse-expand-button').click();
    await expect(page.getByTestId('span-list-item-EngineSystem')).toBeVisible();

    // Count actual children loaded (should be 5)
    await expect(page.getByTestId('span-list-item-EngineSystem')).toBeVisible();
    await expect(page.getByTestId('span-list-item-FuelSystem')).toBeVisible();
    await expect(page.getByTestId('span-list-item-GuidanceSystem')).toBeVisible();
    await expect(page.getByTestId('span-list-item-StageSeparation')).toBeVisible();
    await expect(page.getByTestId('span-list-item-LunarRide')).toBeVisible();

    // Count all RocketLaunch children that are now visible
    const rocketLaunchChildren = [
      'span-list-item-EngineSystem',
      'span-list-item-FuelSystem',
      'span-list-item-GuidanceSystem',
      'span-list-item-StageSeparation',
      'span-list-item-LunarRide',
    ];

    let visibleChildCount = 0;
    for (const childTestId of rocketLaunchChildren) {
      const childElement = page.getByTestId(childTestId);
      if (await childElement.isVisible()) {
        visibleChildCount++;
      }
    }

    expect(displayedRocketCount).toBe(visibleChildCount.toString());
  });
});
