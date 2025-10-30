import { Page } from '@playwright/test';

async function getLastTraceId(): Promise<string> {
  const end = Math.floor(new Date().getTime() / 1000);
  const start = end - 24 * 60 * 60;
  const q = '{}';
  const url = (s: number, e: number) =>
    `http://localhost:3200/api/search?q=${encodeURIComponent(q)}&start=${s}&end=${e}`;

  const maxAttempts = 10;
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(url(start, end));
    if (!response.ok) {
      await delay(500);
      continue;
    }
    const data = await response.json();
    const traceId = data?.traces?.[0]?.traceID;
    if (typeof traceId === 'string' && traceId.length > 0) {
      return traceId;
    }
    await delay(500);
  }
  throw new Error('No traces found in the last 24h; did you run bun run scripts/e2e-tempo-trace.js?');
}

export async function gotoTraceViewerDashboard(
  gotoDashboardPage: (args: any) => Promise<any>,
  page: Page
): Promise<void> {
  const traceIdToUse = await getLastTraceId();

  await gotoDashboardPage({
    uid: 'gr-trace-viewer-dashboard',
    queryParams: new URLSearchParams({
      'var-traceId': traceIdToUse,
    }),
  });

  // Ensure var-traceId is present in the URL
  const url = new URL(page.url());
  if (!url.searchParams.get('var-traceId')) {
    url.searchParams.set('var-traceId', traceIdToUse);
    await page.goto(url.toString());
  }

  // Also try via textbox in case URL syncing differs
  const varInput = page.locator('input[name="var-traceId"]');
  if (await varInput.count()) {
    await varInput.fill(traceIdToUse);
    await varInput.press('Enter');
  }

  return;
}
