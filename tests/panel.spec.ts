import { test, expect } from '@grafana/plugin-e2e';

// test('should display "No data" in case panel data is empty', async ({
//   gotoPanelEditPage,
//   readProvisionedDashboard,
// }) => {
//   const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
//   const panelEditPage = await gotoPanelEditPage({ dashboard, id: '2' });
//   await expect(panelEditPage.panel.locator).toContainText('No data');
// });

async function getLastTraceId() {
  // Current time in seconds
  const end = Math.floor(new Date().getTime() / 1000);
  // Minus one day
  const start = end - 24 * 60 * 60;
  console.log(start, end);
  const q = '{}';
  const url = `http://localhost:3200/api/search?q=${encodeURIComponent(q)}&start=${start}&end=${end}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.traces[0].traceID;
}

test('should read our tempo datasource', async ({ page, gotoDashboardPage }) => {
  const traceId = await getLastTraceId();
  await gotoDashboardPage({
    uid: 'gr-trace-viewer-dashboard',
    queryParams: new URLSearchParams({
      'var-traceId': traceId,
    }),
  });

  await expect(page.getByTestId('data-testid Panel header Incremental Trace Viewer')).toBeVisible();
});
