import { EXPECTED_SCENARIOS } from '@flare-engine/benchmarks/scenario-contract';
import type {
  DeviceReport,
  MicrobenchHeap,
  MicrobenchReport,
  MicrobenchResult,
  WebColdStartResult,
  WebDeviceInfo,
  WebNetworkProfile,
  WebPayloadResult,
  WebProvenance,
  WebRenderOnlyReport,
  WebRenderResult,
  WebReport,
  WebRuntimeLabel,
} from './types';

/**
 * Runtime validation for the result JSONs.
 *
 * The dashboard used to do `JSON.parse(...) as T` and then index into whatever
 * came back. That is not a type check — it is a promise, and when the capture
 * schema moved the promise broke silently: a renamed field rendered `NaN`, and
 * a headline lookup that missed simply returned `null` and dropped the card, so
 * the page came up looking fine with a quarter of it missing. CI stayed green
 * throughout, because nothing here is executed by a test (B25).
 *
 * Everything below therefore THROWS. A dashboard that cannot render the data it
 * was given must fail loudly at build time, not quietly at read time — this is
 * a static export, so a throw here is a failed build rather than a broken page
 * shipped to a reader.
 */

/** Result schema this dashboard understands. Bump only alongside the fields below. */
export const SUPPORTED_SCHEMA_VERSION = 2;

class SchemaError extends Error {
  constructor(message: string) {
    super(
      `${message}\n\nThe dashboard reads benchmarks/results/*.json directly. ` +
        'Re-capture (bun run bench x5 -> bun run bench:promote) or update ' +
        'apps/bench-dashboard/app/lib/{types,schema}.ts to the new shape.',
    );
    this.name = 'SchemaError';
  }
}

function requireObject(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SchemaError(`${where}: expected an object, got ${describe(value)}.`);
  }
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new SchemaError(`${where}: expected an array, got ${describe(value)}.`);
  }
  return value;
}

function requireNumber(value: unknown, where: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new SchemaError(`${where}: expected a finite number, got ${describe(value)}.`);
  }
  return value;
}

function optionalNumber(value: unknown, where: string): number | undefined {
  if (value === undefined) return undefined;
  return requireNumber(value, where);
}

function requireString(value: unknown, where: string): string {
  if (typeof value !== 'string' || value === '') {
    throw new SchemaError(`${where}: expected a non-empty string, got ${describe(value)}.`);
  }
  return value;
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  return typeof value;
}

function parseResult(raw: unknown, where: string): MicrobenchResult {
  const o = requireObject(raw, where);
  const scenario = requireString(o.scenario, `${where}.scenario`);
  const at = `${where} ("${scenario}")`;
  return {
    scenario,
    medianNs: requireNumber(o.medianNs, `${at}.medianNs`),
    meanNs: requireNumber(o.meanNs, `${at}.meanNs`),
    minNs: requireNumber(o.minNs, `${at}.minNs`),
    maxNs: optionalNumber(o.maxNs, `${at}.maxNs`),
    p99Ns: optionalNumber(o.p99Ns, `${at}.p99Ns`),
    opsPerSec: requireNumber(o.opsPerSec, `${at}.opsPerSec`),
    samples: requireNumber(o.samples, `${at}.samples`),
    innerIters: requireNumber(o.innerIters, `${at}.innerIters`),
    bandMinNs: optionalNumber(o.bandMinNs, `${at}.bandMinNs`),
    bandMaxNs: optionalNumber(o.bandMaxNs, `${at}.bandMaxNs`),
  };
}

function parseHeap(raw: unknown, where: string): MicrobenchHeap {
  const o = requireObject(raw, where);
  const name = requireString(o.name, `${where}.name`);
  const at = `${where} ("${name}")`;
  // `converged` and `resolutionBytesPerFrame` are REQUIRED, not optional: they
  // are what separate "this frame allocated nothing" from "the probe never
  // reached its plateau" and from "the delta is under the instrument's
  // resolution". A heap row without them cannot be rendered honestly, and the
  // previous version of this page rendered exactly that — colouring GC noise
  // red and green (B2, B25).
  return {
    name,
    iterations: requireNumber(o.iterations, `${at}.iterations`),
    deltaBytes: requireNumber(o.deltaBytes, `${at}.deltaBytes`),
    bytesPerFrame: requireNumber(o.bytesPerFrame, `${at}.bytesPerFrame`),
    warmupFrames: requireNumber(o.warmupFrames, `${at}.warmupFrames`),
    converged: (() => {
      if (typeof o.converged !== 'boolean') {
        throw new SchemaError(`${at}.converged: expected a boolean, got ${describe(o.converged)}.`);
      }
      return o.converged;
    })(),
    plateauHeapMB: requireNumber(o.plateauHeapMB, `${at}.plateauHeapMB`),
    resolutionBytesPerFrame: requireNumber(
      o.resolutionBytesPerFrame,
      `${at}.resolutionBytesPerFrame`,
    ),
    bandMinBytesPerFrame: optionalNumber(o.bandMinBytesPerFrame, `${at}.bandMinBytesPerFrame`),
    bandMaxBytesPerFrame: optionalNumber(o.bandMaxBytesPerFrame, `${at}.bandMaxBytesPerFrame`),
  };
}

export function parseMicrobenchReport(raw: unknown): MicrobenchReport {
  const o = requireObject(raw, 'microbench.json');

  const schemaVersion = o.schemaVersion;
  if (schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    throw new SchemaError(
      `microbench.json is schema v${describe(schemaVersion) === 'number' ? schemaVersion : describe(schemaVersion)}; ` +
        `this dashboard renders v${SUPPORTED_SCHEMA_VERSION}. Rendering it anyway would mean ` +
        'guessing which fields still mean what they used to.',
    );
  }

  const suites = requireArray(o.suites, 'microbench.json.suites').map((s, i) => {
    const suite = requireObject(s, `suites[${i}]`);
    const title = requireString(suite.title, `suites[${i}].title`);
    return {
      title,
      results: requireArray(suite.results, `suites[${i}].results`).map((r, j) =>
        parseResult(r, `suites["${title}"].results[${j}]`),
      ),
    };
  });

  if (suites.length === 0) {
    throw new SchemaError('microbench.json contains no suites — there is nothing to render.');
  }

  return {
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    generated: requireString(o.generated, 'microbench.json.generated'),
    runtime: requireString(o.runtime, 'microbench.json.runtime'),
    platform: requireString(o.platform, 'microbench.json.platform'),
    cpuModel: typeof o.cpuModel === 'string' ? o.cpuModel : undefined,
    gitSha: typeof o.gitSha === 'string' ? o.gitSha : undefined,
    devFlag: typeof o.devFlag === 'string' ? o.devFlag : undefined,
    foreignLoadPercent: optionalNumber(o.foreignLoadPercent, 'microbench.json.foreignLoadPercent'),
    runs: optionalNumber(o.runs, 'microbench.json.runs'),
    suites,
    heap: requireArray(o.heap, 'microbench.json.heap').map((h, i) => parseHeap(h, `heap[${i}]`)),
  };
}

export function parseDeviceReport(raw: unknown): DeviceReport {
  const o = requireObject(raw, 'device.json');
  return {
    generated: requireString(o.generated, 'device.json.generated'),
    stale: typeof o.stale === 'boolean' ? o.stale : undefined,
    staleReason: typeof o.staleReason === 'string' ? o.staleReason : undefined,
    devices: requireArray(o.devices, 'device.json.devices').map((d, i) => {
      const dev = requireObject(d, `devices[${i}]`);
      return {
        device: requireString(dev.device, `devices[${i}].device`),
        os: requireString(dev.os, `devices[${i}].os`),
        notes: typeof dev.notes === 'string' ? dev.notes : undefined,
        loads: requireArray(dev.loads, `devices[${i}].loads`).map((l, j) => {
          const load = requireObject(l, `devices[${i}].loads[${j}]`);
          return {
            label: requireString(load.label, `devices[${i}].loads[${j}].label`),
            entities: optionalNumber(load.entities, `devices[${i}].loads[${j}].entities`),
            particles: optionalNumber(load.particles, `devices[${i}].loads[${j}].particles`),
            fps: requireArray(load.fps, `devices[${i}].loads[${j}].fps`).map((f, k) =>
              requireNumber(f, `devices[${i}].loads[${j}].fps[${k}]`),
            ),
          };
        }),
      };
    }),
  };
}

/**
 * The CPU-raster lane's accepted labels: the current one and its old, factually-wrong predecessor
 * (`'web-swiftshader'` — SwiftShader is a GL implementation; this surface never touches GL), so
 * already-committed records captured before the rename still parse without being silently
 * rewritten. A fresh capture never emits the old label.
 */
const CPU_RASTER_RUNTIMES: readonly WebRuntimeLabel[] = ['web-cpu-raster', 'web-swiftshader'];

/**
 * Asserts a record carries a runtime valid **for the lane being parsed**, not merely one of the
 * known labels. Each lane passes its own set, so a `web-gpu` row cannot be rendered inside the
 * CPU-raster table even though both labels are individually legitimate — mixing incomparable
 * series into one table is the defect this field exists to prevent, and accepting every label
 * everywhere would reintroduce it while looking stricter than before.
 */
function requireWebRuntime(
  value: unknown,
  where: string,
  allowed: readonly WebRuntimeLabel[],
): WebRuntimeLabel {
  if (typeof value !== 'string' || !allowed.includes(value as WebRuntimeLabel)) {
    throw new SchemaError(
      `${where}: expected one of ${allowed.map((a) => `"${a}"`).join(', ')}, got ` +
        `${describe(value)}. This lane's table must contain only its own runtime.`,
    );
  }
  return value as WebRuntimeLabel;
}

function parseWebDeviceInfo(raw: unknown, where: string): WebDeviceInfo {
  const o = requireObject(raw, where);
  return {
    model: requireString(o.model, `${where}.model`),
    codename: requireString(o.codename, `${where}.codename`),
    soc: requireString(o.soc, `${where}.soc`),
    androidRelease: requireString(o.androidRelease, `${where}.androidRelease`),
  };
}

function parseWebProvenance(
  o: Record<string, unknown>,
  where: string,
  allowed: readonly WebRuntimeLabel[],
): WebProvenance {
  return {
    commit: requireString(o.commit, `${where}.commit`),
    host: requireString(o.host, `${where}.host`),
    runtime: requireWebRuntime(o.runtime, `${where}.runtime`, allowed),
    appVersion: requireString(o.appVersion, `${where}.appVersion`),
    browserName: requireString(o.browserName, `${where}.browserName`),
    browserVersion: requireString(o.browserVersion, `${where}.browserVersion`),
    capturedAt: requireString(o.capturedAt, `${where}.capturedAt`),
    ...(o.rendererString === undefined
      ? {}
      : { rendererString: requireString(o.rendererString, `${where}.rendererString`) }),
    ...(o.device === undefined ? {} : { device: parseWebDeviceInfo(o.device, `${where}.device`) }),
  };
}

function requireLiteralUnit<U extends string>(value: unknown, unit: U, where: string): U {
  if (value !== unit) {
    throw new SchemaError(`${where}: expected unit "${unit}", got ${describe(value)}.`);
  }
  return unit;
}

function parseWebRenderResult(
  raw: unknown,
  where: string,
  allowed: readonly WebRuntimeLabel[],
): WebRenderResult {
  const o = requireObject(raw, where);
  const name = requireString(o.name, `${where}.name`);
  const at = `${where} ("${name}")`;
  return {
    ...parseWebProvenance(o, at, allowed),
    kind: 'render',
    name,
    samples: requireNumber(o.samples, `${at}.samples`),
    p50Ms: requireNumber(o.p50Ms, `${at}.p50Ms`),
    p95Ms: requireNumber(o.p95Ms, `${at}.p95Ms`),
    p99Ms: requireNumber(o.p99Ms, `${at}.p99Ms`),
    opsPerBatch: requireNumber(o.opsPerBatch, `${at}.opsPerBatch`),
    batchMs: requireNumber(o.batchMs, `${at}.batchMs`),
    frameDeltaMs: requireNumber(o.frameDeltaMs, `${at}.frameDeltaMs`),
    bandMinMs: requireNumber(o.bandMinMs, `${at}.bandMinMs`),
    bandMaxMs: requireNumber(o.bandMaxMs, `${at}.bandMaxMs`),
    runs: requireNumber(o.runs, `${at}.runs`),
    unit: requireLiteralUnit(o.unit, 'ms', `${at}.unit`),
  };
}

function parseWebPayloadResult(
  raw: unknown,
  where: string,
  allowed: readonly WebRuntimeLabel[],
): WebPayloadResult {
  const o = requireObject(raw, where);
  const name = requireString(o.name, `${where}.name`);
  const at = `${where} ("${name}")`;
  return {
    ...parseWebProvenance(o, at, allowed),
    kind: 'payload',
    name,
    bytes: requireNumber(o.bytes, `${at}.bytes`),
    unit: requireLiteralUnit(o.unit, 'bytes', `${at}.unit`),
  };
}

function parseWebNetworkProfile(raw: unknown, where: string): WebNetworkProfile {
  const o = requireObject(raw, where);
  return {
    downloadThroughputBytesPerSec: requireNumber(
      o.downloadThroughputBytesPerSec,
      `${where}.downloadThroughputBytesPerSec`,
    ),
    uploadThroughputBytesPerSec: requireNumber(
      o.uploadThroughputBytesPerSec,
      `${where}.uploadThroughputBytesPerSec`,
    ),
    latencyMs: requireNumber(o.latencyMs, `${where}.latencyMs`),
  };
}

function parseWebColdStartResult(
  raw: unknown,
  where: string,
  allowed: readonly WebRuntimeLabel[],
): WebColdStartResult {
  const o = requireObject(raw, where);
  const name = requireString(o.name, `${where}.name`);
  const at = `${where} ("${name}")`;
  return {
    ...parseWebProvenance(o, at, allowed),
    kind: 'coldStart',
    name,
    ms: requireNumber(o.ms, `${at}.ms`),
    unit: requireLiteralUnit(o.unit, 'ms', `${at}.unit`),
    network: o.network === null ? null : parseWebNetworkProfile(o.network, `${at}.network`),
  };
}

/**
 * Validates `web.json` — the CPU-raster web lane (an offscreen `CanvasKit.MakeSurface`, CPU-backed
 * by construction, not GPU-backed), kept schema-distinct from `microbench.json`'s node lane by
 * construction (see `WebProvenance.runtime`).
 *
 * Cross-checks the render scenario names against `EXPECTED_SCENARIOS.Render` from
 * `@flare-engine/benchmarks/scenario-contract` — the same frozen registry the node suite and
 * `apps/bench-web`'s own test (`tests/runner.test.ts`) already reconcile against, so a scenario
 * renamed on one side of the render/web split becomes a failed dashboard build rather than a
 * table that silently shows fewer rows than the node lane's.
 */
export function parseWebReport(raw: unknown): WebReport {
  const o = requireObject(raw, 'web.json');

  const render = requireArray(o.render, 'web.json.render').map((r, i) =>
    parseWebRenderResult(r, `web.json.render[${i}]`, CPU_RASTER_RUNTIMES),
  );
  const payload = requireArray(o.payload, 'web.json.payload').map((p, i) =>
    parseWebPayloadResult(p, `web.json.payload[${i}]`, CPU_RASTER_RUNTIMES),
  );
  const coldStart = requireArray(o.coldStart, 'web.json.coldStart').map((c, i) =>
    parseWebColdStartResult(c, `web.json.coldStart[${i}]`, CPU_RASTER_RUNTIMES),
  );

  const expectedRender = EXPECTED_SCENARIOS.Render ?? [];
  const gotNames = render.map((r) => r.name);
  const wantNames = [...expectedRender];
  if (JSON.stringify(gotNames) !== JSON.stringify(wantNames)) {
    throw new SchemaError(
      `web.json.render scenario names do not match the frozen Render contract.\n` +
        `  got:  ${JSON.stringify(gotNames)}\n` +
        `  want: ${JSON.stringify(wantNames)}`,
    );
  }
  if (payload.length === 0) {
    throw new SchemaError('web.json.payload is empty — there are no CanvasKit payload numbers.');
  }
  if (coldStart.length === 0) {
    throw new SchemaError('web.json.coldStart is empty — there are no cold-start numbers.');
  }

  return {
    schemaVersion: requireNumber(o.schemaVersion, 'web.json.schemaVersion'),
    generated: requireString(o.generated, 'web.json.generated'),
    render,
    payload,
    coldStart,
  };
}

/**
 * The render-only lanes (desktop GPU, on-device Android). Same row validation and the same frozen
 * scenario-contract check as `parseWebReport` — a lane that quietly rendered a shorter table than
 * the contract froze would understate coverage exactly where a reader cannot see it.
 *
 * `label` names the source file in every error, so a failure says which lane is malformed rather
 * than which shape.
 */
export function parseWebRenderOnlyReport(
  raw: unknown,
  label: string,
  runtime: WebRuntimeLabel,
): WebRenderOnlyReport {
  const o = requireObject(raw, label);

  const render = requireArray(o.render, `${label}.render`).map((r, i) =>
    parseWebRenderResult(r, `${label}.render[${i}]`, [runtime]),
  );

  const gotNames = render.map((r) => r.name);
  const wantNames = [...(EXPECTED_SCENARIOS.Render ?? [])];
  if (JSON.stringify(gotNames) !== JSON.stringify(wantNames)) {
    throw new SchemaError(
      `${label}.render scenario names do not match the frozen Render contract.\n` +
        `  got:  ${JSON.stringify(gotNames)}
` +
        `  want: ${JSON.stringify(wantNames)}`,
    );
  }

  return {
    schemaVersion: requireNumber(o.schemaVersion, `${label}.schemaVersion`),
    generated: requireString(o.generated, `${label}.generated`),
    render,
  };
}

/**
 * Locates a headline row, throwing when it is missing.
 *
 * The old lookup returned `undefined` and the caller rendered `null`, so a
 * renamed scenario removed a card from the overview page and nothing anywhere
 * said so. A missing headline row is schema drift, and schema drift fails.
 */
export function requireScenario(
  report: MicrobenchReport,
  suiteTitle: string,
  scenarioSubstring: string,
): MicrobenchResult {
  const suite = report.suites.find((s) => s.title === suiteTitle);
  if (!suite) {
    throw new SchemaError(
      `microbench.json has no "${suiteTitle}" suite (found: ${report.suites.map((s) => s.title).join(', ')}).`,
    );
  }
  const hit = suite.results.find((r) => r.scenario.includes(scenarioSubstring));
  if (!hit) {
    throw new SchemaError(
      `no scenario in "${suiteTitle}" matches "${scenarioSubstring}". ` +
        `Available: ${suite.results.map((r) => r.scenario.trim()).join(' | ')}`,
    );
  }
  return hit;
}
