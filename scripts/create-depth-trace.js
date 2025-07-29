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
const NUM_SERVICES = 2;
const CHILDREN = 2;

// ---------- tracer provider ----------
const baseResource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: `my-large-trace-provider-${new Date().toISOString()}`,
  'other-resource-attribute': 'other-resource-attribute-value',
});

// Create separate providers for each service
const providers = [];
const tracers = [];

for (let i = 0; i < NUM_SERVICES; i++) {
  const serviceResource = resourceFromAttributes({
    ...baseResource.attributes,
    'service.namespace': `service_${i}_namespace`,
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

  const rootSpan = tracers[0].startSpan('root');
  rootSpan.setAttribute('root-span-attribute-xyz', 123);
  const rootCtx = trace.setSpan(otContext.active(), rootSpan);

  for (let i = 0; i < NUM_SERVICES; i++) {
    const serviceSpan = tracers[i].startSpan(`service_${i}`, undefined, rootCtx);
    const serviceCtx = trace.setSpan(rootCtx, serviceSpan);
    for (let j = 0; j < CHILDREN; j++) {
      const childSpan = tracers[i].startSpan(`service_${i}_child_${j}`, undefined, serviceCtx);
      childSpan.setAttribute('child-span-attribute-xyz', 456);
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
  for (const provider of providers) {
    await provider.shutdown();
  }
}

await main();
