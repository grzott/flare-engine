/**
 * Guarded capture wrapper — the entry point every `bench:web*` script goes through.
 *
 * `scripts/run.ts` does the measuring. This file exists because its **exit code cannot be
 * trusted in either direction**, measured on 2026-08-25 across all three lanes:
 *
 *  - *Nonzero after success.* `bench:web:gpu` writes its baseline, appends all 18 records, and
 *    then Bun panics with `integer overflow` during process teardown and exits 3. Two Android
 *    captures did the same. The data was complete and correct every time.
 *  - *Reported as a run after measuring nothing.* Five consecutive Android captures failed at
 *    `connectOverCDP` and appended zero records, each taking long enough to look like real work.
 *    A batch loop that trusts exit codes cannot tell those two apart, and folding the second kind
 *    republishes an older window as current — the PERF-18 hazard, on a different lane.
 *
 * So success is decided from the only thing that matters: **did this capture's records actually
 * land in the lane's history file**. The child's exit code is reported, never obeyed.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { cpus } from 'node:os';
import {
  androidHistoryFilePath,
  androidWebBaselineFilePath,
  gpuHistoryFilePath,
  gpuWebBaselineFilePath,
  historyFilePath,
  type WebRuntimeLabel,
  webBaselineFilePath,
} from './history.js';

type CaptureMode = 'cpu-raster' | 'gpu' | 'android';

/** Verdict of comparing a lane's history file before and after a capture. */
export interface AppendVerdict {
  readonly ok: boolean;
  /** Records appended by this capture. */
  readonly appended: number;
  /** Human-readable reason — always set, including on success. */
  readonly reason: string;
}

/**
 * Decide whether a capture actually recorded anything, from the lane history alone.
 *
 * Three failure shapes are distinguished, because the operator response differs for each:
 * nothing appended (the capture never measured), records that do not parse (a truncated write),
 * and records spanning more than one `capturedAt` (two captures interleaved into one window,
 * which would make the fold average across runs it thinks are one).
 */
export function verifyAppended(beforeLines: number, afterLines: readonly string[]): AppendVerdict {
  const appended = afterLines.length - beforeLines;

  if (appended < 0) {
    return {
      ok: false,
      appended,
      reason:
        `the lane history SHRANK by ${-appended} line(s) during the capture — something ` +
        'truncated or rewrote it; do not fold this window',
    };
  }
  if (appended === 0) {
    return {
      ok: false,
      appended,
      reason:
        'the capture appended NO records — it measured nothing. Treat this as a failed run, not ' +
        'a slow one: folding now would republish the previous window as current',
    };
  }

  const fresh = afterLines.slice(afterLines.length - appended);
  const stamps = new Set<string>();
  for (const [i, line] of fresh.entries()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return {
        ok: false,
        appended,
        reason: `appended record ${i + 1} of ${appended} is not valid JSON — the write was truncated`,
      };
    }
    const stamp = (parsed as { capturedAt?: unknown }).capturedAt;
    if (typeof stamp !== 'string') {
      return {
        ok: false,
        appended,
        reason: `appended record ${i + 1} of ${appended} carries no capturedAt — provenance is incomplete`,
      };
    }
    stamps.add(stamp);
  }

  if (stamps.size !== 1) {
    return {
      ok: false,
      appended,
      reason:
        `the ${appended} appended record(s) span ${stamps.size} distinct capturedAt values — two ` +
        'captures interleaved, so this is not one window',
    };
  }

  return {
    ok: true,
    appended,
    reason: `${appended} record(s) appended under a single capturedAt`,
  };
}

/**
 * Whether the device is publishing Chrome's DevTools socket.
 *
 * The Android driver *attaches* to Chrome rather than launching it, so Chrome must be running
 * **in the foreground** on the phone: backgrounded, it keeps its process but stops publishing
 * `@chrome_devtools_remote`, and every capture then dies at `connectOverCDP` having measured
 * nothing. Checking here turns a five-run silent failure into one refusal before any work starts.
 */
export function devtoolsSocketPublished(procNetUnix: string): boolean {
  return /chrome_devtools_remote/.test(procNetUnix);
}

/** Busy-ness verdict for the host, sampled before a capture starts. */
export interface LoadVerdict {
  readonly level: 'quiet' | 'noisy' | 'busy';
  readonly reason: string;
}

/**
 * Classify host CPU busy-ness.
 *
 * The node lane's fold already refuses a window above 15% foreign load; the web lanes had no
 * equivalent, so a loaded host reached publication unchallenged. `busy` matches that 15% bar so
 * the two lanes agree; `noisy` warns from 8%, which is where this machine's captures started
 * disagreeing with its own quiet-state baseline.
 *
 * **This is a floor, not a ceiling.** CPU percentage did not catch the 2026-08-25 incident: the
 * host sat at 7-11% while the GPU lane read 2.1x its committed baseline, because the contending
 * process was an RGB *visualiser* saturating the GPU, not the CPU. `compareToBaseline` is the
 * check that catches that class; this one catches plain CPU contention cheaply.
 */
export function classifyHostLoad(percentBusy: number): LoadVerdict {
  if (percentBusy >= 15) {
    return {
      level: 'busy',
      reason: `host CPU is ${percentBusy.toFixed(1)}% busy (limit 15%) — this machine's numbers move with load`,
    };
  }
  if (percentBusy >= 8) {
    return {
      level: 'noisy',
      reason: `host CPU is ${percentBusy.toFixed(1)}% busy — above the 8% quiet mark`,
    };
  }
  return { level: 'quiet', reason: `host CPU is ${percentBusy.toFixed(1)}% busy` };
}

/** Fraction of CPU time spent outside idle, across all cores, over `ms`. Portable: no PowerShell. */
async function sampleHostLoad(ms: number): Promise<number> {
  const snapshot = (): { busy: number; total: number } => {
    let busy = 0;
    let total = 0;
    for (const c of cpus()) {
      const t = c.times;
      busy += t.user + t.nice + t.sys + t.irq;
      total += t.user + t.nice + t.sys + t.irq + t.idle;
    }
    return { busy, total };
  };
  const a = snapshot();
  await new Promise((r) => setTimeout(r, ms));
  const b = snapshot();
  const dTotal = b.total - a.total;
  if (dTotal <= 0) return 0;
  return ((b.busy - a.busy) / dTotal) * 100;
}

/** How a fresh capture's rows compare to the lane's committed baseline. */
export interface BaselineDrift {
  readonly compared: number;
  readonly shifted: number;
  readonly worstName: string | null;
  readonly worstPct: number;
}

/**
 * Compare a capture's per-row p50 against the published baseline for the same lane.
 *
 * This is the check that would have caught 2026-08-25 on the FIRST capture instead of after five
 * plus a phone session: the host-side lanes read 1.6x and 2.1x their committed baselines while CPU
 * load looked innocent. A shift this size is either a real engine change — in which case it is the
 * result you are looking for — or the machine is in a different state than when the baseline was
 * taken. The harness cannot tell which, so it reports rather than refuses; what it must not do is
 * stay silent.
 */
export function compareToBaseline(
  fresh: ReadonlyMap<string, number>,
  baseline: ReadonlyMap<string, number>,
  tolerancePct: number,
): BaselineDrift {
  let compared = 0;
  let shifted = 0;
  let worstName: string | null = null;
  let worstPct = 0;

  for (const [name, freshP50] of fresh) {
    const baseP50 = baseline.get(name);
    // Rows too fast to have resolution in the reported millisecond figure carry no signal here:
    // one unit in the last decimal of a 0.004 ms row is a 25% "shift" that means nothing.
    if (baseP50 === undefined || baseP50 < 0.01) continue;
    compared++;
    const deltaPct = (Math.abs(freshP50 - baseP50) / baseP50) * 100;
    if (deltaPct > tolerancePct) shifted++;
    if (deltaPct > worstPct) {
      worstPct = deltaPct;
      worstName = name;
    }
  }
  return { compared, shifted, worstName, worstPct };
}

function parseMode(): CaptureMode {
  const raw = process.env.BENCH_WEB_MODE;
  if (raw === undefined || raw === 'cpu-raster') return 'cpu-raster';
  if (raw === 'gpu') return 'gpu';
  if (raw === 'android') return 'android';
  throw new Error(
    `bench-web: BENCH_WEB_MODE must be "cpu-raster", "gpu" or "android", got ${JSON.stringify(raw)}`,
  );
}

const LANE_HISTORY: Record<CaptureMode, () => string> = {
  'cpu-raster': historyFilePath,
  gpu: gpuHistoryFilePath,
  android: androidHistoryFilePath,
};

const LANE_LABEL: Record<CaptureMode, WebRuntimeLabel> = {
  'cpu-raster': 'web-cpu-raster',
  gpu: 'web-gpu',
  android: 'web-android-gpu',
};

function readLines(path: string): string[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '');
}

/** Refuse an Android capture that cannot possibly reach Chrome, before the server or tunnel start. */
function preflightAndroid(): void {
  let procNetUnix: string;
  try {
    procNetUnix = execFileSync('adb', ['shell', 'cat', '/proc/net/unix'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    throw new Error(
      'bench-web: could not read /proc/net/unix over adb — is a device attached and authorised? ' +
        'Check `adb devices`.',
    );
  }

  if (!devtoolsSocketPublished(procNetUnix)) {
    throw new Error(
      'bench-web: Chrome is not publishing @chrome_devtools_remote on the device.\n' +
        '  The Android lane ATTACHES to Chrome; it does not launch it, so Chrome must be open and\n' +
        '  IN THE FOREGROUND on the phone, with the screen on, for the whole window.\n' +
        '  Backgrounded Chrome keeps its process but drops the socket, and every capture then\n' +
        '  fails at connectOverCDP having measured nothing.\n' +
        '  Fix: open Chrome on the device, leave it foreground, and re-run.',
    );
  }
}

const LANE_BASELINE: Record<CaptureMode, () => string> = {
  'cpu-raster': webBaselineFilePath,
  gpu: gpuWebBaselineFilePath,
  android: androidWebBaselineFilePath,
};

/** `name -> p50Ms` for the lane's published baseline, or an empty map if it has none yet. */
function readBaselineP50(mode: CaptureMode): Map<string, number> {
  const out = new Map<string, number>();
  const path = LANE_BASELINE[mode]();
  if (!existsSync(path)) return out;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { render?: unknown };
    if (!Array.isArray(parsed.render)) return out;
    for (const row of parsed.render) {
      const { name, p50Ms } = row as { name?: unknown; p50Ms?: unknown };
      if (typeof name === 'string' && typeof p50Ms === 'number') out.set(name, p50Ms);
    }
  } catch {
    // A malformed baseline is not a reason to block a capture — it is a reason not to compare.
  }
  return out;
}

/** `name -> p50Ms` for the records this capture appended. */
function freshP50(appended: readonly string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const line of appended) {
    try {
      const { name, p50Ms } = JSON.parse(line) as { name?: unknown; p50Ms?: unknown };
      if (typeof name === 'string' && typeof p50Ms === 'number') out.set(name, p50Ms);
    } catch {
      // verifyAppended already refused this window; nothing to add here.
    }
  }
  return out;
}

/** Divergence past this is called out. Wide enough that ordinary run-to-run noise stays quiet. */
const BASELINE_TOLERANCE_PCT = 25;

async function main(): Promise<void> {
  const mode = parseMode();
  if (mode === 'android') preflightAndroid();

  const load = classifyHostLoad(await sampleHostLoad(2000));
  console.log(`bench-web: ${load.reason}`);
  if (load.level === 'busy' && process.env.BENCH_WEB_ALLOW_BUSY !== '1') {
    console.error(
      `\nbench-web: REFUSING to capture — ${load.reason}.\n` +
        '  Close what is running and retry. To measure anyway (knowing the numbers describe a\n' +
        '  loaded machine, not the engine), set BENCH_WEB_ALLOW_BUSY=1.',
    );
    process.exit(1);
  }
  if (load.level === 'noisy') {
    console.warn(
      `bench-web: WARNING — ${load.reason}; treat the resulting numbers with suspicion.`,
    );
  }

  const historyPath = LANE_HISTORY[mode]();
  const before = readLines(historyPath).length;

  // Read the published baseline BEFORE the capture runs. `run.ts` rewrites the lane baseline from
  // the single run it just took (F4), so reading it afterwards compares the capture against itself
  // and the drift check can never fire — which is exactly what happened the first time this was
  // wired up, and it looked like a clean pass.
  const baselineBefore = readBaselineP50(mode);

  const child = spawnSync(process.execPath, ['run', `${import.meta.dir}/run.ts`], {
    stdio: 'inherit',
    env: { ...process.env, BENCH_WEB_MODE: mode },
  });

  const after = readLines(historyPath);
  const verdict = verifyAppended(before, after);
  const exitCode = child.status;

  if (!verdict.ok) {
    console.error(
      `\nbench-web: CAPTURE FAILED (${LANE_LABEL[mode]}) — ${verdict.reason}.` +
        `\n  runner exit code: ${exitCode === null ? 'killed by signal' : exitCode}`,
    );
    process.exit(1);
  }

  if (exitCode === 0) {
    console.log(`\nbench-web: capture OK (${LANE_LABEL[mode]}) — ${verdict.reason}.`);
  } else {
    console.warn(
      `\nbench-web: capture OK (${LANE_LABEL[mode]}) — ${verdict.reason}, but the runner then ` +
        `exited ${exitCode === null ? 'on a signal' : exitCode}.` +
        '\n  The data is complete and was written before the exit; this lane is known to crash Bun' +
        '\n  during teardown (integer overflow). Reporting success on the evidence, not the code.',
    );
  }

  // Deliberately NOT inside the exit-code-zero branch. An early return here meant the drift and
  // unfolded-baseline warnings were skipped on precisely the path that fires most often — the
  // cpu-raster lane exits non-zero on nearly every capture — so the two most useful notices were
  // invisible in normal use.
  reportBaselineDrift(mode, baselineBefore, after.slice(after.length - verdict.appended));
  warnBaselineIsUnfolded(mode);
}

/** Say out loud when a capture disagrees with the published baseline for its lane. */
function reportBaselineDrift(
  mode: CaptureMode,
  baseline: ReadonlyMap<string, number>,
  appended: readonly string[],
): void {
  if (baseline.size === 0) return;

  const drift = compareToBaseline(freshP50(appended), baseline, BASELINE_TOLERANCE_PCT);
  if (drift.compared === 0 || drift.shifted === 0) return;

  console.warn(
    `bench-web: DRIFT — ${drift.shifted} of ${drift.compared} row(s) differ from the published ` +
      `${LANE_LABEL[mode]} baseline by more than ${BASELINE_TOLERANCE_PCT}%` +
      (drift.worstName === null
        ? '.'
        : ` (worst: "${drift.worstName}" at ${drift.worstPct.toFixed(0)}%).`) +
      '\n  Either the engine actually changed — which is the result you came for — or this machine\n' +
      '  is in a different state than when the baseline was taken. Decide which BEFORE folding:\n' +
      '  on 2026-08-25 this shape meant an RGB visualiser was saturating the GPU while CPU load\n' +
      '  looked innocent, and the host-side lanes read 1.6x and 2.1x their true values.',
  );
}

/**
 * Every capture rewrites its lane baseline from that single run, so one capture silently replaces
 * a folded multi-run window with a one-run snapshot — and nothing downstream says so. Measured the
 * hard way on 2026-08-25: a single verification capture clobbered a freshly committed 5-run GPU
 * fold, and the only reason it surfaced was `bench:web:promote` later refusing a window whose
 * commits disagreed. Had the capture been at the same commit, the one-run baseline would have
 * published silently.
 */
function warnBaselineIsUnfolded(mode: CaptureMode): void {
  console.warn(
    `bench-web: NOTE — this run rewrote the ${LANE_LABEL[mode]} baseline from ONE capture.\n` +
      '  It is not a folded window until you run:\n' +
      `    cd benchmarks && bun run bench:web:promote -- --lane ${mode} --runs <N>\n` +
      '  Publishing before then reports a single run as if it were the median of N.',
  );
}

// Only when run as a script. `verifyAppended` / `devtoolsSocketPublished` are imported by the
// tests, and a bare `main()` here would spawn a real capture on import.
if (import.meta.main) await main();
