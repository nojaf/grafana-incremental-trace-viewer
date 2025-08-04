import { context as otContext, trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'; // Import directly
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'; // Import directly
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { resourceFromAttributes } from '@opentelemetry/resources';

/* ---------- small helpers ------------------------------------------------- */

const log = (...xs) => console.info(new Date().toISOString(), ...xs);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rndInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/* ---------- parameters ---------------------------------------------------- */

const NUM_SERVICES = 8;
const DEPTH = 6;
const TOTAL_SPANS = 10_000; // children created at (DEPTH-1)
const DURATION_SECONDS = 120;

const computeFanout = (total, depth) => (depth === 1 ? total : Math.round(total ** (1 / depth)));

const FANOUT = computeFanout(TOTAL_SPANS, DEPTH);
const approxTotal = ((NUM_SERVICES * (FANOUT ** DEPTH - 1)) / (FANOUT - 1)) | 0;

log(`Simulating ${NUM_SERVICES} services, depth=${DEPTH}, fanout=${FANOUT}, ` + `≈${approxTotal} spans`);

/* ---------- tracer providers --------------------------------------------- */

const serviceNames = Array.from({ length: NUM_SERVICES }, (_, i) => `service-${i + 1}`);

const providers = [];
const tracers = [];

for (const svc of serviceNames) {
  // build a Resource directly with the new import
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: svc,
  });
  const provider = new NodeTracerProvider({
    resource,
    spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: 'http://localhost:4317' }))],
  });

  provider.register(); // last one wins globally, we keep explicit refs
  providers.push(provider);
  tracers.push(provider.getTracer(svc));
}

// round-robin tracer getter
let tIdx = 0;
const nextTracer = () => {
  const t = tracers[tIdx];
  tIdx = (tIdx + 1) % tracers.length;
  return t;
};

/* ---------- span tree generator ------------------------------------------ */

async function buildTree(parentCtx, currentDepth, maxDepth, spanBudget) {
  const tracer = nextTracer();
  const span = tracer.startSpan(`span-depth-${currentDepth}`, undefined, parentCtx);
  span.setAttribute('depth', currentDepth);
  span.setAttribute('k8s.container.name', `container-depth-${currentDepth}`);

  const ctxWithSpan = trace.setSpan(parentCtx, span);

  // leaf-level: create TOTAL_SPANS direct children
  if (currentDepth === maxDepth - 1) {
    let count = 1;
    for (let i = 0; i < TOTAL_SPANS; i++) {
      const child = tracer.startSpan(`span-depth-${currentDepth + 1}_${count}`, undefined, ctxWithSpan);

      child.setAttribute('depth', currentDepth + 1);
      child.setAttribute('k8s.container.name', `container-depth-${currentDepth + 1}-${count}`);
      child.setAttribute('user_id', `user-${count}`);
      child.setAttribute('order_id', `order-${count}`);
      child.setAttribute('region', ['us-east', 'eu-west', 'ap-south', 'sa-east'][count % 4]);
      child.setAttribute('feature_flag', count % 2 === 0);
      child.setAttribute('latency_ms', count % 1000);
      child.setAttribute('error', count % 500 === 0);
      child.setAttribute('env', ['prod', 'staging', 'dev'][count % 3]);
      child.setAttribute('device_type', ['mobile', 'desktop', 'tablet'][count % 3]);
      child.setAttribute('api_version', `v${(count % 3) + 1}`);
      child.setAttribute('experiment_group', ['A', 'B', 'C'][count % 3]);

      const logs = rndInt(5, 17);
      for (let l = 0; l < logs; l++) {
        child.addEvent(`log message ${l + 1}`, {
          log_index: l + 1,
          log_level: ['DEBUG', 'INFO', 'WARN', 'ERROR'][l % 4],
          message: `This is log ${l + 1} for span ${count}`,
        });
      }

      child.end();
      if (count % 1000 === 0) {
        log(`Created ${count} spans at depth ${currentDepth + 1}`);
      }
      count++;

      // tiny pause to spread traffic
      await sleep(1.2);
    }
    span.end();
    return count;
  }

  // internal node – recurse
  let produced = 1;
  produced += await buildTree(ctxWithSpan, currentDepth + 1, maxDepth, spanBudget - 1);

  span.end();
  return produced;
}

/* ---------- main ---------------------------------------------------------- */

async function main() {
  log(`Starting trace generator: depth=${DEPTH}, TOTAL_SPANS=${TOTAL_SPANS}, ` + `duration≈${DURATION_SECONDS}s`);

  const total = await buildTree(otContext.active(), 1, DEPTH, TOTAL_SPANS);
  log(`Total spans generated: ${total}`);

  // allow exporter to flush & cleanly shut down
  await sleep(2_000);
  await Promise.allSettled(providers.map((p) => p.shutdown()));
}

await main();
