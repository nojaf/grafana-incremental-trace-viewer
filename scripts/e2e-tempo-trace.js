import { context as otContext, trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { resourceFromAttributes } from '@opentelemetry/resources';

// ---------- helpers ----------
const log = (...xs) => console.info(new Date().toISOString(), ...xs);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- tracer providers ----------
const missionControlResource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: `MissionControl`,
  'service.namespace': 'nasa',
  'mission.name': 'Apollo 11',
  'mission.target': 'Moon',
});

const rocketLaunchResource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: `RocketLaunchSystem`,
  'service.namespace': 'nasa',
  'rocket.name': 'Saturn V',
  'engine.count': '5',
});

const navigationResource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: `SpacecraftNavigation`,
  'service.namespace': 'nasa',
  'spacecraft.name': 'Apollo CSM',
  'guidance.system': 'Apollo Guidance Computer',
});

const lunarModuleResource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: `LunarModuleOperations`,
  'service.namespace': 'nasa',
  'lm.name': 'Eagle',
  'lm.pilot': 'Neil Armstrong',
  'lm.co_pilot': 'Buzz Aldrin',
});

const lifeSupportResource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: `AstronautLifeSupport`,
  'service.namespace': 'nasa',
  'suit.type': 'A7L',
  'suit.pressure.target': '3.7 psi',
});

const scienceResource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: `LunarSurfaceScience`,
  'service.namespace': 'nasa',
  'activity.type': 'Geological Survey',
  'landing.site': 'Tranquility Base',
});

// Create providers for each service
const missionControlProvider = new NodeTracerProvider({
  resource: missionControlResource,
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: 'http://localhost:4317' }))],
});

const rocketLaunchProvider = new NodeTracerProvider({
  resource: rocketLaunchResource,
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: 'http://localhost:4317' }))],
});

const navigationProvider = new NodeTracerProvider({
  resource: navigationResource,
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: 'http://localhost:4317' }))],
});

const lunarModuleProvider = new NodeTracerProvider({
  resource: lunarModuleResource,
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: 'http://localhost:4317' }))],
});

const lifeSupportProvider = new NodeTracerProvider({
  resource: lifeSupportResource,
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: 'http://localhost:4317' }))],
});

const scienceProvider = new NodeTracerProvider({
  resource: scienceResource,
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: 'http://localhost:4317' }))],
});

// Register all providers
missionControlProvider.register();
rocketLaunchProvider.register();
navigationProvider.register();
lunarModuleProvider.register();
lifeSupportProvider.register();
scienceProvider.register();

// Get tracers for each service
const missionControlTracer = missionControlProvider.getTracer('mission-control');
const rocketLaunchTracer = rocketLaunchProvider.getTracer('rocket-launch');
const navigationTracer = navigationProvider.getTracer('navigation');
const lunarModuleTracer = lunarModuleProvider.getTracer('lunar-module');
const lifeSupportTracer = lifeSupportProvider.getTracer('life-support');
const scienceTracer = scienceProvider.getTracer('science');

function getEventName() {
  return `event.${new Date().getTime()}000000`;
}

// ---------- main logic ----------
async function main() {
  log(`Simulating Apollo 11 Moon Landing Mission Trace`);

  // ===== THEME 1: ROCKET LAUNCH =====
  const missionControlSpan = missionControlTracer.startSpan('MissionControl');
  missionControlSpan.setAttribute('mission.phase', 'pre-launch');

  await sleep(30);
  missionControlSpan.setAttribute(getEventName(), 'MissionControlStarted');

  const missionControlCtx = trace.setSpan(otContext.active(), missionControlSpan);

  // Pre-launch parallel operations (these complete early)
  const weatherCheckSpan = missionControlTracer.startSpan('WeatherVerification', undefined, missionControlCtx);
  weatherCheckSpan.setAttribute('wind.speed', '8 knots');
  weatherCheckSpan.setAttribute('visibility', '10 miles');
  weatherCheckSpan.setAttribute('temparature in kelvin', 250);

  await sleep(25);
  weatherCheckSpan.setAttribute(getEventName(), 'WeatherGo');
  weatherCheckSpan.end(); // End weather check early

  const crewPrepSpan = missionControlTracer.startSpan('CrewPreparation', undefined, missionControlCtx);
  crewPrepSpan.setAttribute('crew.size', '3');
  crewPrepSpan.setAttribute('suits.checked', 'true');

  await sleep(20);
  crewPrepSpan.setAttribute(getEventName(), 'CrewReady');
  crewPrepSpan.end(); // End crew prep early

  // Countdown sequence
  const countdownSpan = missionControlTracer.startSpan('CountdownSequence', undefined, missionControlCtx);
  countdownSpan.setAttribute('countdown.start', 'T-minus 10');

  await sleep(20);
  countdownSpan.setAttribute(getEventName(), 'T-minus10');

  await sleep(15);
  countdownSpan.setAttribute(getEventName(), 'T-minus5');

  await sleep(10);
  countdownSpan.setAttribute(getEventName(), 'T-minus1');

  const countdownCtx = trace.setSpan(missionControlCtx, countdownSpan);

  // Rocket Launch System - main launch span
  const rocketLaunchSpan = rocketLaunchTracer.startSpan('RocketLaunch', undefined, countdownCtx);
  rocketLaunchSpan.setAttribute('launch.sequence', 'primary');

  await sleep(25);
  rocketLaunchSpan.setAttribute(getEventName(), 'LaunchSequenceInitiated');

  const rocketLaunchCtx = trace.setSpan(countdownCtx, rocketLaunchSpan);

  // Multiple engine systems under rocket launch (these complete early)
  const engineSystemSpan = rocketLaunchTracer.startSpan('EngineSystem', undefined, rocketLaunchCtx);
  engineSystemSpan.setAttribute('engine.type', 'F-1');
  engineSystemSpan.setAttribute('thrust.total', '7.5 million lbs');

  await sleep(20);
  engineSystemSpan.setAttribute(getEventName(), 'EngineIgnition');

  await sleep(15);
  engineSystemSpan.setAttribute(getEventName(), 'FullThrust');
  engineSystemSpan.end(); // Engine system completes early

  const fuelSystemSpan = rocketLaunchTracer.startSpan('FuelSystem', undefined, rocketLaunchCtx);
  fuelSystemSpan.setAttribute('fuel.type', 'RP-1/LOX');
  fuelSystemSpan.setAttribute('fuel.level', '100%');

  await sleep(18);
  fuelSystemSpan.setAttribute(getEventName(), 'FuelFlowNormal');
  fuelSystemSpan.end(); // Fuel system completes early

  const guidanceSystemSpan = rocketLaunchTracer.startSpan('GuidanceSystem', undefined, rocketLaunchCtx);
  guidanceSystemSpan.setAttribute('guidance.type', 'Inertial');
  guidanceSystemSpan.setAttribute('computer.status', 'online');

  await sleep(22);
  guidanceSystemSpan.setAttribute(getEventName(), 'GuidanceActive');
  guidanceSystemSpan.end(); // Guidance system completes early

  // Stage separation sequence
  const stageSeparationSpan = rocketLaunchTracer.startSpan('StageSeparation', undefined, rocketLaunchCtx);
  stageSeparationSpan.setAttribute('stages.total', '3');

  await sleep(30);
  stageSeparationSpan.setAttribute(getEventName(), 'Stage1Separation');

  await sleep(25);
  stageSeparationSpan.setAttribute(getEventName(), 'Stage2Separation');

  await sleep(20);
  stageSeparationSpan.setAttribute(getEventName(), 'Stage3Separation');
  stageSeparationSpan.end(); // Stage separation completes

  rocketLaunchSpan.end(); // Rocket launch completes
  countdownSpan.end(); // Countdown completes

  // ===== THEME 2: LUNAR RIDE =====
  const lunarRideSpan = navigationTracer.startSpan('LunarRide', undefined, rocketLaunchCtx);
  lunarRideSpan.setAttribute('journey.type', 'trans-lunar');
  lunarRideSpan.setAttribute('distance', '238,900 miles');

  await sleep(35);
  lunarRideSpan.setAttribute(getEventName(), 'TransLunarInjection');

  const lunarRideCtx = trace.setSpan(rocketLaunchCtx, lunarRideSpan);

  // Multiple navigation maneuvers during lunar ride - sequential children
  const courseCorrectionSpan = navigationTracer.startSpan('CourseCorrection', undefined, lunarRideCtx);
  courseCorrectionSpan.setAttribute('correction.type', 'mid-course');
  courseCorrectionSpan.setAttribute('delta_v', '20 m/s');

  await sleep(40);
  courseCorrectionSpan.setAttribute(getEventName(), 'CorrectionBurnStart');

  await sleep(30);
  courseCorrectionSpan.setAttribute(getEventName(), 'CorrectionBurnEnd');
  courseCorrectionSpan.end(); // Course correction completes

  // Now start lunar orbit insertion after course correction
  const lunarOrbitSpan = navigationTracer.startSpan('LunarOrbitInsertion', undefined, lunarRideCtx);
  lunarOrbitSpan.setAttribute('orbit.type', 'circular');
  lunarOrbitSpan.setAttribute('altitude', '60 nautical miles');

  await sleep(45);
  lunarOrbitSpan.setAttribute(getEventName(), 'LOIBurnStart');

  await sleep(60);
  lunarOrbitSpan.setAttribute(getEventName(), 'LOIBurnEnd');

  await sleep(20);
  lunarOrbitSpan.setAttribute(getEventName(), 'OrbitAchieved');
  lunarOrbitSpan.end(); // Lunar orbit insertion completes

  lunarRideSpan.end(); // Lunar ride completes

  // Lunar Module operations with multiple activities - sequential children
  const lunarModuleSpan = lunarModuleTracer.startSpan('LunarModuleOperations', undefined, lunarRideCtx);
  lunarModuleSpan.setAttribute('lm.status', 'active');

  await sleep(30);
  lunarModuleSpan.setAttribute(getEventName(), 'LMActivated');

  const lunarModuleCtx = trace.setSpan(lunarRideCtx, lunarModuleSpan);

  // First: Undocking operation
  const undockingSpan = lunarModuleTracer.startSpan('Undocking', undefined, lunarModuleCtx);
  undockingSpan.setAttribute('separation.velocity', '0.5 m/s');

  await sleep(25);
  undockingSpan.setAttribute(getEventName(), 'DockingLatchesReleased');

  await sleep(20);
  undockingSpan.setAttribute(getEventName(), 'LMDriftAway');
  undockingSpan.end(); // Undocking completes

  // Then: Descent operation (sequential, not parallel)
  const descentSpan = lunarModuleTracer.startSpan('PoweredDescent', undefined, lunarModuleCtx);
  descentSpan.setAttribute('descent.engine.thrust', '10,500 lbs');
  descentSpan.setAttribute('landing.site', 'Tranquility Base');

  await sleep(35);
  descentSpan.setAttribute(getEventName(), 'DescentEngineIgnition');

  await sleep(30);
  descentSpan.setAttribute(getEventName(), 'AltitudeCheck');
  descentSpan.setAttribute('altitude', '50,000 ft');

  await sleep(25);
  descentSpan.setAttribute(getEventName(), 'GuidanceAlarm');
  descentSpan.setAttribute('alarm.code', '1202');

  await sleep(20);
  descentSpan.setAttribute(getEventName(), 'Touchdown');
  descentSpan.end(); // Descent completes

  lunarModuleSpan.end(); // Lunar module operations complete

  // Surface activities with multiple science operations - sequential children
  const surfaceActivitiesSpan = scienceTracer.startSpan('SurfaceActivities', undefined, lunarModuleCtx);
  surfaceActivitiesSpan.setAttribute('duration', '2.5 hours');

  await sleep(30);
  surfaceActivitiesSpan.setAttribute(getEventName(), 'SurfaceOperationsBegin');

  const surfaceCtx = trace.setSpan(lunarModuleCtx, surfaceActivitiesSpan);

  // Sequential science activities
  const evaPrepSpan = lifeSupportTracer.startSpan('EVAPreparation', undefined, surfaceCtx);
  evaPrepSpan.setAttribute('suit.pressure', '3.7 psi');

  await sleep(25);
  evaPrepSpan.setAttribute(getEventName(), 'HatchOpen');
  evaPrepSpan.end(); // EVA prep completes

  // Then first steps
  const firstStepsSpan = scienceTracer.startSpan('FirstSteps', undefined, surfaceCtx);
  firstStepsSpan.setAttribute('astronaut', 'Neil Armstrong');
  firstStepsSpan.setAttribute('quote', "That's one small step for man...");

  await sleep(20);
  firstStepsSpan.setAttribute(getEventName(), 'FootOnLadder');

  await sleep(15);
  firstStepsSpan.setAttribute(getEventName(), 'FirstStepTaken');
  firstStepsSpan.end(); // First steps complete

  // Then sample collection
  const sampleCollectionSpan = scienceTracer.startSpan('SampleCollection', undefined, surfaceCtx);
  sampleCollectionSpan.setAttribute('samples.target', '21.6 kg');

  await sleep(35);
  sampleCollectionSpan.setAttribute(getEventName(), 'FlagPlanted');

  await sleep(30);
  sampleCollectionSpan.setAttribute(getEventName(), 'SampleCollected');
  sampleCollectionSpan.setAttribute('sample.id', 'AS11-10001');
  sampleCollectionSpan.end(); // Sample collection completes

  surfaceActivitiesSpan.end(); // Surface activities complete

  // ===== THEME 3: GET BACK TO EARTH =====
  const returnJourneySpan = navigationTracer.startSpan('ReturnJourney', undefined, surfaceCtx);
  returnJourneySpan.setAttribute('journey.type', 'return');

  await sleep(30);
  returnJourneySpan.setAttribute(getEventName(), 'ReturnSequenceInitiated');

  const returnCtx = trace.setSpan(surfaceCtx, returnJourneySpan);

  // Ascent from moon with multiple systems - sequential children
  const ascentSpan = lunarModuleTracer.startSpan('AscentFromMoon', undefined, returnCtx);
  ascentSpan.setAttribute('ascent.engine.thrust', '3,500 lbs');

  await sleep(25);
  ascentSpan.setAttribute(getEventName(), 'AscentEngineIgnition');

  await sleep(30);
  ascentSpan.setAttribute(getEventName(), 'LiftoffFromMoon');

  const ascentCtx = trace.setSpan(returnCtx, ascentSpan);

  // Sequential ascent systems
  const ascentGuidanceSpan = lunarModuleTracer.startSpan('AscentGuidance', undefined, ascentCtx);
  ascentGuidanceSpan.setAttribute('guidance.type', 'ascent');

  await sleep(20);
  ascentGuidanceSpan.setAttribute(getEventName(), 'GuidanceActive');
  ascentGuidanceSpan.end(); // Ascent guidance completes

  // Then rendezvous
  const rendezvousSpan = lunarModuleTracer.startSpan('Rendezvous', undefined, ascentCtx);
  rendezvousSpan.setAttribute('rendezvous.type', 'orbital');

  await sleep(35);
  rendezvousSpan.setAttribute(getEventName(), 'RadarLock');

  await sleep(25);
  rendezvousSpan.setAttribute(getEventName(), 'RendezvousAchieved');
  rendezvousSpan.end(); // Rendezvous completes

  ascentSpan.end(); // Ascent from moon completes

  // Docking operations
  const dockingSpan = navigationTracer.startSpan('DockingOperations', undefined, returnCtx);
  dockingSpan.setAttribute('docking.type', 'hard');

  await sleep(30);
  dockingSpan.setAttribute(getEventName(), 'SoftDock');

  await sleep(25);
  dockingSpan.setAttribute(getEventName(), 'HardDock');

  await sleep(20);
  dockingSpan.setAttribute(getEventName(), 'PressureEqualized');
  dockingSpan.end(); // Docking operations complete

  // Trans-Earth injection
  const transEarthSpan = navigationTracer.startSpan('TransEarthInjection', undefined, returnCtx);
  transEarthSpan.setAttribute('burn.type', 'TEI');
  transEarthSpan.setAttribute('delta_v', '2,500 m/s');

  await sleep(50);
  transEarthSpan.setAttribute(getEventName(), 'TEIBurnStart');

  await sleep(45);
  transEarthSpan.setAttribute(getEventName(), 'TEIBurnEnd');

  await sleep(20);
  transEarthSpan.setAttribute(getEventName(), 'EarthBound');
  transEarthSpan.end(); // Trans-Earth injection completes

  // Re-entry and splashdown
  const reentrySpan = navigationTracer.startSpan('ReentryAndSplashdown', undefined, returnCtx);
  reentrySpan.setAttribute('reentry.angle', '6.5 degrees');

  await sleep(40);
  reentrySpan.setAttribute(getEventName(), 'AtmosphericEntry');

  await sleep(35);
  reentrySpan.setAttribute(getEventName(), 'ParachuteDeployment');

  await sleep(25);
  reentrySpan.setAttribute(getEventName(), 'Splashdown');
  reentrySpan.end(); // Re-entry completes

  // Recovery operations
  const recoverySpan = missionControlTracer.startSpan('RecoveryOperations', undefined, returnCtx);
  recoverySpan.setAttribute('recovery.ship', 'USS Hornet');

  await sleep(30);
  recoverySpan.setAttribute(getEventName(), 'RecoveryTeamDeployed');

  await sleep(25);
  recoverySpan.setAttribute(getEventName(), 'AstronautsRecovered');

  await sleep(20);
  recoverySpan.setAttribute(getEventName(), 'MissionAccomplished');
  recoverySpan.end(); // Recovery operations complete

  returnJourneySpan.end(); // Return journey completes
  missionControlSpan.end(); // Mission control completes

  log(`Moon landing trace simulation completed`);

  // Allow exporter to flush & cleanly shut down
  await sleep(2000);
  await missionControlProvider.shutdown();
  await rocketLaunchProvider.shutdown();
  await navigationProvider.shutdown();
  await lunarModuleProvider.shutdown();
  await lifeSupportProvider.shutdown();
  await scienceProvider.shutdown();
}

await main();
await sleep(30000);
