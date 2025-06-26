#!/usr/bin/env bun

const OS = process.env.OPENSEARCH_URL || 'http://localhost:9200';
const INDEX = process.env.INDEX || 'ss4o_traces-default-namespace';
const PIPE = 'otel-span-enrich';
const TEMPLATE = 'otel-traces';

// Ingest pipeline: copy startTime→@timestamp, compute nanos, flatten serviceName
const ingestPipeline = {
  description: 'Enrich spans for Grafana tracing',
  processors: [
    {
      date: {
        field: 'startTime',
        target_field: '@timestamp',
        formats: ['strict_date_optional_time_nanos'],
      },
    },
    {
      script: {
        lang: 'painless',
        source: `
          def st     = java.time.Instant.parse(ctx.startTime);
          def et     = java.time.Instant.parse(ctx.endTime);
          def stNano = st.toEpochMilli() * 1000000;
          def etNano = et.toEpochMilli() * 1000000;
          ctx.startTimeUnixNano = stNano;
          ctx.endTimeUnixNano   = etNano;
          ctx.durationNano      = etNano - stNano;
          // Grafana wants "duration" in ns
          ctx.duration = ctx.durationNano;
          // flatten service.name & name → serviceName/operationName
          if (ctx.resource != null && ctx.resource['service.name'] != null) {
            ctx.serviceName = ctx.resource['service.name'];
          }
          ctx.operationName = ctx.name;
        `,
      },
    },
  ],
};

// Index‐template: keyword IDs, wire in our pipeline, plus the new fields
const indexTemplate = {
  index_patterns: [`${INDEX}*`],
  priority: 100,
  template: {
    settings: {
      number_of_shards: 1,
      default_pipeline: PIPE,
    },
    mappings: {
      properties: {
        traceId: { type: 'keyword' },
        spanId: { type: 'keyword' },
        parentSpanId: { type: 'keyword' },
        serviceName: { type: 'keyword' },
        operationName: { type: 'keyword' },
        startTimeUnixNano: { type: 'long' },
        endTimeUnixNano: { type: 'long' },
        durationNano: { type: 'long' },
        // the one Grafana actually reads:
        duration: { type: 'long' },
        kind: { type: 'keyword' },
        status: {
          properties: {
            code: { type: 'keyword' },
            message: { type: 'text' },
          },
        },
      },
    },
  },
};

async function put(path, body) {
  const res = await fetch(`${OS}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  if (!res.ok) {
    console.error(`PUT ${path} failed:`, j);
    process.exit(1);
  }
  console.log(`✔ ${path}`, j.acknowledged ?? j);
}

async function ensureIndex() {
  const head = await fetch(`${OS}/${INDEX}`, { method: 'HEAD' });
  if (head.status === 404) {
    console.log(`Index ${INDEX} missing – creating…`);
    await put(`/${INDEX}`, {}); // triggers template + pipeline
  } else if (head.ok) {
    console.log(`Index ${INDEX} exists, skipping creation.`);
  } else {
    console.error(`HEAD /${INDEX} → status ${head.status}`);
    process.exit(1);
  }
}

async function main() {
  console.log('1) Installing ingest pipeline…');
  await put(`/_ingest/pipeline/${PIPE}`, ingestPipeline);

  console.log('2) Installing index template…');
  await put(`/_index_template/${TEMPLATE}`, indexTemplate);

  console.log('3) Ensuring index exists…');
  await ensureIndex();

  console.log('✅ setup complete. Now send OTLP spans through your Collector.');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
