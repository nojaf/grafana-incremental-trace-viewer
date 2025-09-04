import { test, expect } from '@grafana/plugin-e2e';

async function getLastTraceId() {
  // Current time in seconds
  const end = Math.floor(new Date().getTime() / 1000);
  // Minus one day
  const start = end - 24 * 60 * 60;
  const q = '{}';
  const url = `http://localhost:3200/api/search?q=${encodeURIComponent(q)}&start=${start}&end=${end}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.traces[0].traceID;
}

async function gotoTraceViewerDashboard(gotoDashboardPage) {
  const traceId = await getLastTraceId();
  await gotoDashboardPage({
    uid: 'gr-trace-viewer-dashboard',
    queryParams: new URLSearchParams({
      'var-traceId': traceId,
    }),
  });
}

test('should collapse all spans', async ({ page, gotoDashboardPage }) => {
  await gotoTraceViewerDashboard(gotoDashboardPage);

  // Wait for the virtual span items to be visible before checking count
  await expect(page.getByTestId('span-virtual-item').first()).toBeVisible();

  // root + 3 children
  let virtualSpanCount = await page.getByTestId('span-virtual-item').count();
  expect(virtualSpanCount).toBe(4);

  const countDownSequenceItem = page.getByTestId('span-list-item-CountdownSequence');
  await expect(countDownSequenceItem).toBeVisible();
  const countDownSequenceItemExpandButton = page.getByTestId('span-collapse-expand-button');
  await expect(countDownSequenceItemExpandButton).toBeVisible();
  await countDownSequenceItemExpandButton.click();

  // Wait for network to be idle to ensure all data is loaded
  await expect(page.getByTestId('span-list-item-RocketLaunch')).toBeVisible();

  virtualSpanCount = await page.getByTestId('span-virtual-item').count();
  expect(virtualSpanCount).toBe(5);

  // This should have opened the children of the CountdownSequence span.
  const rocketLaunchItem = page.getByTestId('span-list-item-RocketLaunch');
  await expect(rocketLaunchItem).toBeVisible();
  const rocketLaunchItemExpandButton = page.getByTestId('span-collapse-expand-button');
  await expect(rocketLaunchItemExpandButton).toBeVisible();
  await rocketLaunchItemExpandButton.click();

  // Wait for the children to be loaded by checking for one of the expected child spans
  await expect(page.getByTestId('span-list-item-EngineSystem')).toBeVisible();

  virtualSpanCount = await page.getByTestId('span-virtual-item').count();
  expect(virtualSpanCount).toBe(10);

  // Do actual collapse
  const collapseAllButton = page.getByTestId('span-collapse-all-button');
  await expect(collapseAllButton).toBeVisible();
  await collapseAllButton.click();

  // Wait for the collapse all button to become disabled (indicates all spans are collapsed)
  await expect(collapseAllButton).toBeDisabled();

  virtualSpanCount = await page.getByTestId('span-virtual-item').count();
  expect(virtualSpanCount).toBe(1);
});
