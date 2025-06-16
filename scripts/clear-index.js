#!/usr/bin/env bun

const OPENSEARCH_URL = process.env.OPENSEARCH_URL || "http://localhost:9200";
const INDEX           = process.env.INDEX           || "ss4o_traces-default-namespace";

async function main() {
  const url = `${OPENSEARCH_URL}/${INDEX}/_delete_by_query?conflicts=proceed`;
  const body = { query: { match_all: {} } };
  const res = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body)
  });
  const json = await res.json();
  if (!res.ok) {
    console.error("Failed to clear index:", json);
    process.exit(1);
  }
  console.log(`Deleted ${json.deleted} docs from '${INDEX}' in ${json.took}ms`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});