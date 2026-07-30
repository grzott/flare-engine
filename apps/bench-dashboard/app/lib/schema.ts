import type { DeviceReport, MicrobenchHeap, MicrobenchReport, MicrobenchResult } from './types';

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
