import { test, expect } from '@grafana/plugin-e2e';
import { Page } from '@playwright/test';

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

/*

Assert span name
Open (additional span) accordion and assert mission.phase + value.
Open (resource) accordion and assert 'service.namespace' + value.
Same for events (just check string)
Optional: click and grab to resize panel (if easy).
Search for "apollo" (value, but lowercase, assert finding "Apollo" in results)
Search for key, "mission.target" + assert value "Moon"
Try and assert clipboard copy function. (check if possible in playwright)
Close span detail should work
Click on X.
Click outside of it.
*/

async function gotoTraceViewerDashboard(gotoDashboardPage) {
  const traceId = await getLastTraceId();
  await gotoDashboardPage({
    uid: 'gr-trace-viewer-dashboard',
    queryParams: new URLSearchParams({
      'var-traceId': traceId,
    }),
  });
}

async function openSpanDetailPanel(gotoDashboardPage, page: Page) {
  await gotoTraceViewerDashboard(gotoDashboardPage);

  const rootSpanDuration = page.getByTestId('span-duration-MissionControl');
  await rootSpanDuration.click();

  const spanDetailPanel = page.getByTestId('span-detail-panel');
  await expect(spanDetailPanel).toBeVisible();

  return spanDetailPanel;
}

test('should have root span name', async ({ page, gotoDashboardPage }) => {
  const spanDetailPanel = await openSpanDetailPanel(gotoDashboardPage, page);
  const spanNameValue = spanDetailPanel.getByTestId('span-detail-panel-basic-span-data-Name-value');
  await expect(spanNameValue).toBeVisible();
  await expect(spanNameValue).toContainText('"MissionControl"');
});

test('should have additional span data', async ({ page, gotoDashboardPage }) => {
  const spanDetailPanel = await openSpanDetailPanel(gotoDashboardPage, page);
  const additionalSpanData = spanDetailPanel.getByTestId('accordion-Additional Span Data');
  await expect(additionalSpanData).toBeVisible();
  await additionalSpanData.click();

  const missionPhaseKey = spanDetailPanel.getByTestId('span-detail-panel-additional-span-data-mission.phase-key');
  await expect(missionPhaseKey).toBeVisible();
  await expect(missionPhaseKey).toContainText('mission.phase');

  const missionPhaseValue = spanDetailPanel.getByTestId('span-detail-panel-additional-span-data-mission.phase-value');
  await expect(missionPhaseValue).toBeVisible();
  await expect(missionPhaseValue).toContainText('"pre-launch"');
});

test('should have resource data', async ({ page, gotoDashboardPage }) => {
  const spanDetailPanel = await openSpanDetailPanel(gotoDashboardPage, page);
  const resourceData = spanDetailPanel.getByTestId('accordion-Resource');
  await expect(resourceData).toBeVisible();
  await resourceData.click();

  const serviceNameKey = spanDetailPanel.getByTestId('span-detail-panel-resource-service.name-key');
  await expect(serviceNameKey).toBeVisible();
  await expect(serviceNameKey).toContainText('service.name');

  const serviceNameValue = spanDetailPanel.getByTestId('span-detail-panel-resource-service.name-value');
  await expect(serviceNameValue).toBeVisible();
  await expect(serviceNameValue).toContainText('"MissionControl"');

  const missionTargetKey = spanDetailPanel.getByTestId('span-detail-panel-resource-mission.target-key');
  await expect(missionTargetKey).toBeVisible();
  await expect(missionTargetKey).toContainText('mission.target');

  const missionTargetValue = spanDetailPanel.getByTestId('span-detail-panel-resource-mission.target-value');
  await expect(missionTargetValue).toBeVisible();
  await expect(missionTargetValue).toContainText('"Moon"');

  const missionNameKey = spanDetailPanel.getByTestId('span-detail-panel-resource-mission.name-key');
  await expect(missionNameKey).toBeVisible();
  await expect(missionNameKey).toContainText('mission.name');

  const missionNameValue = spanDetailPanel.getByTestId('span-detail-panel-resource-mission.name-value');
  await expect(missionNameValue).toBeVisible();
  await expect(missionNameValue).toContainText('"Apollo 11"');

  const serviceNamespaceKey = spanDetailPanel.getByTestId('span-detail-panel-resource-service.namespace-key');
  await expect(serviceNamespaceKey).toBeVisible();
  await expect(serviceNamespaceKey).toContainText('service.namespace');

  const serviceNamespaceValue = spanDetailPanel.getByTestId('span-detail-panel-resource-service.namespace-value');
  await expect(serviceNamespaceValue).toBeVisible();
  await expect(serviceNamespaceValue).toContainText('"nasa"');
});
