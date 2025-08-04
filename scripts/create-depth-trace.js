import crypto from 'crypto';
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
const NUM_SERVICES = 7;
const CHILDREN = 13;

// ---------- tracer provider ----------
const baseResource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: `my-large-trace-provider-${new Date().toISOString()}`,
  'other-resource-attribute': 'other-resource-attribute-value',
  'service.namespace': 'root-service-namespace',
});

const rootProvider = new NodeTracerProvider({
  resource: baseResource,
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: 'http://localhost:4317' }))],
});
rootProvider.register();

// Create separate tracers for each service with different resources
const providers = [];
const tracers = [];

for (let i = 0; i < NUM_SERVICES; i++) {
  const serviceResource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: `service-${i + 1}`,
    'service.namespace': `service_${i + 1}_namespace`,
  });

  const provider = new NodeTracerProvider({
    resource: serviceResource,
    spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: 'http://localhost:4317' }))],
  });
  provider.register();

  providers.push(provider);
  tracers.push(provider.getTracer(`service-${i}`));
}

// ---------- main logic ----------
async function main() {
  log(`Simulating ${NUM_SERVICES} services, ${CHILDREN} children each`);
  const total = NUM_SERVICES * CHILDREN;
  log(`Total spans generated: ${total}`);

  const rootTracer = rootProvider.getTracer('root');
  const rootSpan = rootTracer.startSpan('root');
  rootSpan.setAttribute('root-span-attribute-xyz', 123);
  rootSpan.setAttribute('k8s.container.name', 'root-container');
  const rootCtx = trace.setSpan(otContext.active(), rootSpan);

  for (let i = 0; i < NUM_SERVICES; i++) {
    // Use the service tracer to create service spans with proper namespace
    const serviceSpan = tracers[i].startSpan(`service_${i + 1}`, undefined, rootCtx);
    serviceSpan.setAttribute('k8s.container.name', `service-container-${i + 1}`);
    const serviceCtx = trace.setSpan(rootCtx, serviceSpan);

    for (let j = 0; j < CHILDREN; j++) {
      // Use the same service tracer for child spans to maintain namespace
      const childSpan = tracers[i].startSpan(`service_${i + 1}_child_${j + 1}`, undefined, serviceCtx);
      childSpan.setAttribute('child-span-attribute-xyz', 456);
      childSpan.setAttribute('k8s.container.name', `container-${i + 1}-${j + 1}`);
      await sleep(rndFloat(10, 50));
      childSpan.setAttribute('foo', 'bar');
      childSpan.setAttribute('yozora', crypto.randomUUID());
      childSpan.end();
      log(`Created ${j + 1} spans at depth ${i + 1}`);
    }
    serviceSpan.end();
  }
  rootSpan.end();

  // allow exporter to flush & cleanly shut down
  await sleep(2000);
  await rootProvider.shutdown();
  for (const provider of providers) {
    await provider.shutdown();
  }
}

await main();
