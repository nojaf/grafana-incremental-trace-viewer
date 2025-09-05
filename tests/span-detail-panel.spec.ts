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

test('should have events data', async ({ page, gotoDashboardPage }) => {
  const spanDetailPanel = await openSpanDetailPanel(gotoDashboardPage, page);
  const eventsData = spanDetailPanel.getByTestId('accordion-Events');
  await expect(eventsData).toBeVisible();
  await eventsData.click();

  const eventValues = await spanDetailPanel.getByTestId('span-detail-panel-event-value').all();
  expect(eventValues.length).toBe(1);
  expect(eventValues[0]).toContainText('"MissionControlStarted"');
});

test('should have search input', async ({ page, gotoDashboardPage }) => {
  const spanDetailPanel = await openSpanDetailPanel(gotoDashboardPage, page);
  // We use a Grafana Input component, so we need to use a CSS locator to grab the actual input element.
  const searchInput = page.locator('css=input[type="search"]');
  await expect(searchInput).toBeVisible();
  await searchInput.fill('mission');

  const nameValue = spanDetailPanel.getByTestId('span-detail-panel-basic-span-data-Name-value');
  await expect(nameValue).toBeVisible();
  await expect(nameValue).toContainText('"MissionControl"');

  const missionPhaseKey = spanDetailPanel.getByTestId('span-detail-panel-additional-span-data-mission.phase-key');
  await expect(missionPhaseKey).toBeVisible();
  await expect(missionPhaseKey).toContainText('mission.phase');

  const missionTargetKey = spanDetailPanel.getByTestId('span-detail-panel-resource-mission.target-key');
  await expect(missionTargetKey).toBeVisible();
  await expect(missionTargetKey).toContainText('mission.target');

  const serviceNameValue = spanDetailPanel.getByTestId('span-detail-panel-resource-service.name-value');
  await expect(serviceNameValue).toBeVisible();
  await expect(serviceNameValue).toContainText('"MissionControl"');

  const eventValues = await spanDetailPanel.getByTestId('span-detail-panel-event-value').all();
  expect(eventValues.length).toBe(1);
  expect(eventValues[0]).toContainText('"MissionControlStarted"');
});

test('should close span detail panel by clicking the close button', async ({ page, gotoDashboardPage }) => {
  const spanDetailPanel = await openSpanDetailPanel(gotoDashboardPage, page);
  const closeButton = spanDetailPanel.getByRole('button', { name: 'Close' });
  await expect(closeButton).toBeVisible();
  await closeButton.click();
  await expect(spanDetailPanel).not.toBeVisible();
});

test('should close span detail panel by clicking outside of it', async ({ page, gotoDashboardPage }) => {
  const spanDetailPanel = await openSpanDetailPanel(gotoDashboardPage, page);
  const backdrop = page.getByTestId('span-overlay-drawer-backdrop');
  await expect(backdrop).toBeVisible();

  // Click on the left side of the backdrop to avoid the drawer content
  await backdrop.click({ position: { x: 50, y: 50 } });
  await expect(spanDetailPanel).not.toBeVisible();
});

test('button click copies text to clipboard', async ({ page, gotoDashboardPage }) => {
  const spanDetailPanel = await openSpanDetailPanel(gotoDashboardPage, page);

  const nameValue = spanDetailPanel.getByTestId('span-detail-panel-basic-span-data-Name-value');
  expect(nameValue).toBeVisible();
  // Click the button that should copy text
  const copyButton = nameValue.getByTestId('span-detail-panel-copy-button');
  expect(copyButton).toBeVisible();
  await copyButton.click();

  // Read clipboard content inside the browser context
  const clipboardText = await page.evaluate(async () => {
    return await navigator.clipboard.readText();
  });

  expect(clipboardText).toBe('MissionControl');
});
