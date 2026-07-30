import deviceJson from '@flare-engine/benchmarks/results/device.json';
import microbenchJson from '@flare-engine/benchmarks/results/microbench.json';
import { parseDeviceReport, parseMicrobenchReport } from './schema';
import type { DeviceReport, MicrobenchReport } from './types';

/**
 * Imported through the package export, not read from a `../../` path.
 *
 * The old loader did `readFileSync(resolve(process.cwd(), '../../benchmarks/...'))`,
 * which silently depended on the build being invoked from this directory and
 * reached outside the app to do it. `@flare-engine/benchmarks` is already a
 * declared dependency and exports exactly these two files, so this makes the
 * dependency real rather than decorative.
 *
 * A static import rather than a runtime read, because it puts the data in the
 * module graph: the bundler now treats a changed capture as a changed input, so
 * a cached build cannot serve yesterday's HTML over today's numbers. (The turbo
 * task declares them as inputs too — belt and braces, since the two caches are
 * independent.)
 *
 * The imported value is typed by TypeScript from the JSON's current contents,
 * which is not the same as being validated — `parse*` below is what actually
 * checks it.
 */
export function getMicrobenchReport(): MicrobenchReport {
  return parseMicrobenchReport(microbenchJson);
}

export function getDeviceReport(): DeviceReport {
  return parseDeviceReport(deviceJson);
}

// --- Staleness ---------------------------------------------------------------

/** Past this, the capture is old enough that the page says so. */
export const STALE_WARN_DAYS = 14;
/** Past this, `bench:md` already refuses to render a doc; the dashboard agrees. */
export const STALE_FAIL_DAYS = 30;

export type Freshness = {
  ageDays: number;
  level: 'fresh' | 'warn' | 'stale';
  capturedAt: string;
};

export function freshnessOf(generated: string, now: Date = new Date()): Freshness {
  const captured = new Date(generated);
  const ageDays = (now.getTime() - captured.getTime()) / 86_400_000;
  const level = ageDays > STALE_FAIL_DAYS ? 'stale' : ageDays > STALE_WARN_DAYS ? 'warn' : 'fresh';
  return { ageDays, level, capturedAt: generated };
}

/**
 * Build-time gate for a real deployment.
 *
 * Called from every page, so it runs during `next build`. With `DEPLOY=1` set it
 * THROWS on stale data, failing the build rather than publishing a page that
 * quietly describes last quarter's engine — the exact failure this arc exists to
 * end. Without `DEPLOY=1` it is inert, so local exploration of an old capture
 * still works.
 *
 * Keyed on an explicit env var rather than `NODE_ENV`: a developer running a
 * production build locally to check bundle output is not publishing anything.
 */
export function assertPublishable(report: MicrobenchReport): void {
  if (process.env.DEPLOY !== '1') return;
  const { level, ageDays } = freshnessOf(report.generated);
  if (level === 'stale') {
    throw new Error(
      `DEPLOY=1 refused: the capture is ${Math.floor(ageDays)} days old (limit ${STALE_FAIL_DAYS}). ` +
        'Re-capture before publishing: bun run bench x5 -> bun run bench:promote -> bun run bench:md.',
    );
  }
}
