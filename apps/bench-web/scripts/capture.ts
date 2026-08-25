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
import {
  androidHistoryFilePath,
  gpuHistoryFilePath,
  historyFilePath,
  type WebRuntimeLabel,
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

function main(): void {
  const mode = parseMode();
  if (mode === 'android') preflightAndroid();

  const historyPath = LANE_HISTORY[mode]();
  const before = readLines(historyPath).length;

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

  if (exitCode !== 0) {
    console.warn(
      `\nbench-web: capture OK (${LANE_LABEL[mode]}) — ${verdict.reason}, but the runner then ` +
        `exited ${exitCode === null ? 'on a signal' : exitCode}.` +
        '\n  The data is complete and was written before the exit; this lane is known to crash Bun' +
        '\n  during teardown (integer overflow). Reporting success on the evidence, not the code.',
    );
    return;
  }

  console.log(`\nbench-web: capture OK (${LANE_LABEL[mode]}) — ${verdict.reason}.`);
  warnBaselineIsUnfolded(mode);
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
if (import.meta.main) main();
