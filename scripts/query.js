#!/usr/bin/env bun

const OPENSEARCH_URL = process.env.OPENSEARCH_URL || 'http://localhost:9200';
const INDEX_PATTERN = process.env.INDEX_PATTERN || 'ss4o_traces-default-namespace';
const SPAN_ID = process.env.SPAN_ID || 'a994680e93bfdd67';
const TRACE_ID = process.env.TRACE_ID || 'de1830392ffedd1675754617e9249e93';

async function main() {
  const url = `${OPENSEARCH_URL}/${INDEX_PATTERN}/_search`;
  const query = {
    query: {
      bool: {
        must: [
          {
            term: {
              traceId: TRACE_ID,
            },
          },
          {
            term: {
              'parentSpanId.keyword': '',
            },
          },
        ],
      },
    },
  };

  const res = await fetch(url, {
    method: 'POST', // GET also works with bodies, but ES docs use POST
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  });

  const json = await res.json();
  if (!res.ok) {
    console.error('Search failed:', JSON.stringify(json, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify(json, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
