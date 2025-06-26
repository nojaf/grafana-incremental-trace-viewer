#!/usr/bin/env bun

const OPENSEARCH_URL = process.env.OPENSEARCH_URL || 'http://localhost:9200';
const INDEX_PATTERN = process.env.INDEX_PATTERN || 'ss4o_traces-default-namespace';
const TRACE_ID = process.env.TRACE_ID || '066b7b02b5683fda312df9bc6e328894';

let query = `
{
  "aggs": {
    "unique_trace_ids": {
      "composite": {
        "sources": [
          {
            "traceId": {
              "terms": {
                "field": "traceId.keyword"
              }
            }
          }
        ],
        "size": 10000
      }
    }
  },
  "size": 0
}`;

async function main() {
  const url = `${OPENSEARCH_URL}/${INDEX_PATTERN}/_search`;
  query = `{
  "size": 1000,
  "from": 0,
  "query": {
    "bool": {
      "must": [
        {
          "term": {
            "traceId.keyword": "41613183e54070e0c3d4e18c56322a85"
          }
        }
      ]
    }
  },
  "sort": [
    { "startTime": { "order": "asc" } }
  ]
}`;

  // 705dfa28fc212ebe2dacaa3932a250e5 and span 2b3e34b4df5b5654, skipping 0 and taking 1000"

  const res = await fetch(url, {
    method: 'POST', // GET also works with bodies, but ES docs use POST
    headers: { 'Content-Type': 'application/json' },
    body: query,
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
