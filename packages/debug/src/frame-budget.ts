export type FrameBudgetLimits = Record<string, number>;
export type FrameBudgetSnapshot = Record<string, number>;

export type FrameBudgetHandle = {
  recordFrame(dtSec: number): void;
  recordCounters(snapshot: FrameBudgetSnapshot): void;
  getSnapshot(): Readonly<FrameBudgetSnapshot>;
  getAvgFps(): number;
  resetFpsRing(): void;
};

type FrameBudgetOpts = {
  limits: FrameBudgetLimits;
  fpsThreshold?: number;
  ringSize?: number;
  onWatchdog?: () => void;
  debug?: boolean;
};

export function createFrameBudget(opts: FrameBudgetOpts): FrameBudgetHandle {
  const { limits, onWatchdog, debug = false } = opts;
  const fpsThreshold = opts.fpsThreshold ?? 55;
  const ringSize = opts.ringSize ?? 180;

  const ring = new Float32Array(ringSize);
  const limitKeys = Object.keys(limits);
  const _lastSnapshot: Record<string, number> = {};
  for (const k of limitKeys) {
    _lastSnapshot[k] = 0;
  }

  let head = 0;
  let filled = 0;
  let watchdogFired = false;

  function recordFrame(dtSec: number): void {
    ring[head] = dtSec;
    head = (head + 1) % ringSize;
    if (filled < ringSize) filled += 1;

    if (filled === ringSize && !watchdogFired) {
      if (getAvgFps() < fpsThreshold) {
        watchdogFired = true;
        onWatchdog?.();
      }
    }
  }

  function recordCounters(snapshot: FrameBudgetSnapshot): void {
    for (let i = 0; i < limitKeys.length; i++) {
      const k = limitKeys[i] as string;
      const v = snapshot[k] ?? 0;
      _lastSnapshot[k] = v;
      if (debug && v > (limits[k] as number)) {
        console.warn(`[frame-budget] ${k} over limit: ${v} > ${limits[k]}`);
      }
    }
  }

  function getSnapshot(): Readonly<FrameBudgetSnapshot> {
    return _lastSnapshot;
  }

  function getAvgFps(): number {
    if (filled < ringSize) return 0;
    let sum = 0;
    for (let i = 0; i < ringSize; i++) {
      sum += ring[i] as number;
    }
    const avgDt = sum / ringSize;
    return avgDt > 0 ? 1 / avgDt : 0;
  }

  function resetFpsRing(): void {
    ring.fill(0);
    head = 0;
    filled = 0;
    watchdogFired = false;
  }

  return { recordFrame, recordCounters, getSnapshot, getAvgFps, resetFpsRing };
}
