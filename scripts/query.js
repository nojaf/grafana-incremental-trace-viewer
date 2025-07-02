#!/usr/bin/env bun

const OPENSEARCH_URL = process.env.OPENSEARCH_URL || 'http://localhost:9200';
const INDEX_PATTERN = process.env.INDEX_PATTERN || 'ss4o_traces-default-namespace';
const SPAN_ID = process.env.SPAN_ID || '15a06c67a9c2de5e';
const TRACE_ID = process.env.TRACE_ID || '88995d119f2e0efc8fdb04c77293317a';

async function main() {
  const url = `${OPENSEARCH_URL}/${INDEX_PATTERN}/_search`;

  // First query: Get the spans that match our criteria
  const initialQuery = `{
	"query": {
		"bool": {
			"must": [
				{ "term": { "traceId": "${TRACE_ID}" } },
				{ "term": { "parentSpanId": "${SPAN_ID}" } }
			]
		}
	},
	"sort": [ { "@timestamp": { "order": "asc" } }]
}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: initialQuery,
  });

  const json = await res.json();
  if (!res.ok) {
    console.error('Initial search failed:', JSON.stringify(json, null, 2));
    process.exit(1);
  }

  console.log('Initial query results:');
  console.log(JSON.stringify(json, null, 2));

  // Extract spanIds from the results
  const spanIds = json.hits.hits.map((hit) => hit._source.spanId);

  if (spanIds.length === 0) {
    console.log('No spans found in initial query');
    return;
  }

  console.log(`\nFound ${spanIds.length} spans, now counting children for each...`);

  // Second query: Count children for each spanId using targeted aggregation
  const childCountQuery = `{
	"size": 0,
	"query": {
		"bool": {
			"must": [
				{ "term": { "traceId": "${TRACE_ID}" } },
				{ "terms": { "parentSpanId": ${JSON.stringify(spanIds)} } }
			]
		}
	},
	"aggs": {
		"child_counts_by_parent": {
			"terms": {
				"field": "parentSpanId",
				"size": ${spanIds.length}
			}
		}
	}
}`;

  console.log(childCountQuery);

  const childRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: childCountQuery,
  });

  const childJson = await childRes.json();
  if (!childRes.ok) {
    console.error('Child count search failed:', JSON.stringify(childJson, null, 2));
    process.exit(1);
  }

  console.log('\nChild count results:');
  console.log(JSON.stringify(childJson, null, 2));

  // Create a summary
  const childCounts = new Map();
  if (childJson.aggregations && childJson.aggregations.child_counts_by_parent) {
    childJson.aggregations.child_counts_by_parent.buckets.forEach((bucket) => {
      childCounts.set(bucket.key, bucket.doc_count);
    });
  }

  console.log('\nSummary:');
  spanIds.forEach((spanId) => {
    const childCount = childCounts.get(spanId) || 0;
    console.log(`Span ${spanId}: ${childCount} children`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
