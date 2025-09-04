import { SearchResponse, Span, Trace, getTagAttributesForSpan, search } from '../src/utils/utils.api';
import { mkUnixEpochFromNanoSeconds } from '../src/utils/utils.timeline';

async function fetchDirectly(apiPath: string, queryString: string) {
  const url = `http://localhost:3200${apiPath}?${queryString}`;
  const response = await fetch(url);
  const data = await response.json();
  return data;
}

async function getLastTrace() {
  // Current time in seconds
  const end = Math.floor(new Date().getTime() / 1000);
  // Minus one day
  const start = end - 24 * 60 * 60;
  const q = '{}';
  // Update spss if there are more spans.
  const data: SearchResponse = await fetchDirectly(
    '/api/search',
    `q=${encodeURIComponent(q)}&start=${start}&end=${end}&&spss=50`
  );
  const trace = data?.traces?.[0];
  if (trace === undefined) {
    throw new Error('No last trace found in the last 24 hours');
  }
  return trace;
}

async function addAttributesToSpan(trace: Trace, span: Span) {
  if (
    span === undefined ||
    span.spanID === undefined ||
    span.startTimeUnixNano === undefined ||
    span.durationNanos === undefined
  ) {
    throw new Error(`Invalid span for ${JSON.stringify(span)}`);
  }

  if (span.attributes === undefined) {
    span.attributes = [];
  }
  const startTimeUnixNano = parseInt(span.startTimeUnixNano || '0', 10);
  const endTimeUnixNano = startTimeUnixNano + parseInt(span.durationNanos || '0', 10);
  const attributes = await getTagAttributesForSpan(
    fetchDirectly,
    trace.traceID,
    span.spanID,
    startTimeUnixNano,
    endTimeUnixNano
  );
  for (const [key, value] of Object.entries(attributes.spanAttributes)) {
    span.attributes?.push({
      key,
      value,
    });
  }

  for (const [key, value] of Object.entries(attributes.resourceAttributes)) {
    span.attributes?.push({
      key: `resource.${key}`,
      value,
    });
  }

  // Add nestedSetParent
  const q = `{ trace:id = "${trace.traceID}" && span:id = "${span.spanID}" } | select(span:name,nestedSetParent)`;
  const start = mkUnixEpochFromNanoSeconds(startTimeUnixNano);
  const end = mkUnixEpochFromNanoSeconds(endTimeUnixNano);
  const response = await search(fetchDirectly, q, start, end);
  const spanName = response.traces?.[0]?.spanSets?.[0]?.spans?.[0].name;
  if (spanName !== undefined) {
    span.name = spanName;
  }

  const nestedSetParent = response.traces?.[0]?.spanSets?.[0]?.spans?.[0]?.attributes?.find(
    (attr) => attr.key === 'nestedSetParent'
  )?.value?.intValue;
  if (nestedSetParent !== undefined) {
    span.attributes?.push({
      key: 'nestedSetParent',
      value: {
        intValue: nestedSetParent,
      },
    });
  }

  // Add childCount
  const childCount = trace.spanSets?.[0].spans?.filter(
    (s) => s.attributes?.find((attr) => attr.key === 'span:parentID')?.value?.stringValue === span.spanID
  ).length;
  if (childCount !== undefined) {
    span.attributes?.push({
      key: 'childCount',
      value: {
        intValue: childCount.toString(),
      },
    });
  }
}

const trace = await getLastTrace();
for (const ss of trace.spanSets || []) {
  for (const span of ss.spans || []) {
    await addAttributesToSpan(trace, span);
  }
}

const traceJSON = JSON.stringify(trace, undefined, 2);
await Bun.file(new URL('../tests/test-trace.json', import.meta.url).pathname).write(traceJSON + '\n');

export {};

// TODO: Ad resource attributes.
