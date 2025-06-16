import { context as otContext, trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { resourceFromAttributes } from '@opentelemetry/resources';

// ---------- helpers ----------
const log = (...xs) => console.info(new Date().toISOString(), ...xs);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rndFloat = (min, max) => Math.random() * (max - min) + min;

// ---------- parameters ----------
const NUM_SERVICES = 10;
const CHILDREN = 30;

// ---------- tracer provider ----------
const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: 'my-large-trace-provider',
});

const provider = new NodeTracerProvider({
  resource,
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: 'http://localhost:4317' }))],
});
provider.register();
const tracer = provider.getTracer('create-depth-trace');

// ---------- main logic ----------
async function main() {
  log(`Simulating ${NUM_SERVICES} services, ${CHILDREN} children each`);
  const total = NUM_SERVICES * CHILDREN;
  log(`Total spans generated: ${total}`);

  const rootSpan = tracer.startSpan('root');
  const rootCtx = trace.setSpan(otContext.active(), rootSpan);

  for (let i = 0; i < NUM_SERVICES; i++) {
    const serviceSpan = tracer.startSpan(`service_${i}`, undefined, rootCtx);
    const serviceCtx = trace.setSpan(rootCtx, serviceSpan);
    for (let j = 0; j < CHILDREN; j++) {
      const childSpan = tracer.startSpan(`service_${i}_child_${j}`, undefined, serviceCtx);
      await sleep(rndFloat(10, 50));
      childSpan.end();
      log(`Created ${j + 1} spans at depth ${i + 1}`);
    }
    serviceSpan.end();
  }
  rootSpan.end();

  // allow exporter to flush & cleanly shut down
  await sleep(2000);
  await provider.shutdown();
}

await main();
