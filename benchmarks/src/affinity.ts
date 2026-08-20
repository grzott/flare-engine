/**
 * Reads the CPU affinity the capture process is running under, and refuses a window captured
 * without one on a hybrid (performance + efficiency core) host.
 *
 * **Why this exists.** On 2026-08-20, after the BIOS/microcode fix removed the machine-wide clock
 * instability, the particles suite was still bimodal and `bench:promote` kept refusing windows.
 * Pinning the capture to the 8 P-cores of an i9-13900KF and re-probing separated the states:
 *
 * | `particles.update 500 integrate-only` | band |
 * |---|---|
 * | pinned to P-cores | 1.70-1.80 us (1.06x) |
 * | pinned to E-cores | 3.13-3.14 us (1.00x) |
 * | unpinned | 1.70 **or** ~2.15 us, run to run |
 *
 * Both pinned states are stable; only the unpinned one is bimodal, and its high mode sits *between*
 * the two pinned levels rather than on either — the thread is not settling on one core class for
 * the whole sample window. A scheduler decision that moves a row by 1.75x belongs in the same
 * category as the power plan: recorded on every capture, and refused at promote.
 *
 * **Hybrid detection is a heuristic, and is treated as one.** There is no portable topology API
 * here, so a host counts as hybrid when its logical processor count sits strictly between its
 * physical core count and twice it — true for P+E parts, false for both plain SMT (logical ==
 * 2x physical) and SMT-less parts (logical == physical). A host that is not detected as hybrid is
 * never judged, only recorded.
 *
 * Non-Windows hosts report `null`: reading affinity there needs a different call that has not been
 * validated on this project's hardware, and a fabricated pass is worse than a recorded "unknown".
 */
import { execFileSync } from 'node:child_process';

export type Affinity = {
  /** Process affinity mask as lower-case hex, e.g. `0xffff`. A string, so >53 CPUs stay exact. */
  readonly mask: string;
  /** Logical processors the mask selects. */
  readonly selected: number;
  /** Logical processors the host has. */
  readonly logical: number;
  /** Physical cores the host has. */
  readonly physical: number;
};

function popcount(hexMask: string): number {
  let bits = BigInt(hexMask);
  let n = 0;
  while (bits > 0n) {
    if ((bits & 1n) === 1n) n++;
    bits >>= 1n;
  }
  return n;
}

/** The capture process's affinity, or `null` when the host cannot report one. */
export function readAffinity(): Affinity | null {
  if (process.platform !== 'win32') return null;
  try {
    // One spawn, three numbers. A child process inherits the parent's affinity mask on Windows,
    // so reading $PID inside this child reports the mask the capture itself is running under —
    // `os.availableParallelism()` does not, and returns the full CPU count either way.
    const script =
      '$p=Get-Process -Id $PID;' +
      '$c=Get-CimInstance Win32_Processor;' +
      '"{0} {1} {2}" -f [int64]$p.ProcessorAffinity,' +
      '(($c|Measure-Object NumberOfCores -Sum).Sum),' +
      '(($c|Measure-Object NumberOfLogicalProcessors -Sum).Sum)';
    const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', script], {
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();
    const m = /^(\d+)\s+(\d+)\s+(\d+)$/.exec(out);
    if (m === null) return null;
    const mask = `0x${BigInt(m[1] as string).toString(16)}`;
    return {
      mask,
      selected: popcount(mask),
      physical: Number(m[2]),
      logical: Number(m[3]),
    };
  } catch {
    return null;
  }
}

/**
 * A host with P-cores and E-cores. Heuristic — see the module docstring. Plain SMT reports
 * `logical === physical * 2`; a hybrid part reports fewer, because its E-cores have no sibling.
 */
export function isHybrid(a: Affinity): boolean {
  return a.logical > a.physical && a.logical < a.physical * 2;
}

export type AffinityVerdict =
  | { readonly kind: 'ok' }
  | { readonly kind: 'refuse'; readonly message: string };

/** Judges an affinity. Only "hybrid host, no pinning" is refused, because only it was measured. */
export function judgeAffinity(a: Affinity | null): AffinityVerdict {
  if (a === null) return { kind: 'ok' };
  if (!isHybrid(a)) return { kind: 'ok' };
  if (a.selected < a.logical) return { kind: 'ok' };
  return {
    kind: 'refuse',
    message:
      `the capture ran unpinned on a hybrid CPU (${a.physical} cores / ${a.logical} logical, ` +
      `mask ${a.mask}). Measured on this hardware, the same scenario reads 1.70-1.80 us pinned to ` +
      'P-cores and 3.13-3.14 us pinned to E-cores — both stable — while unpinned it alternates ' +
      'between two states run to run. Capture pinned instead:\n' +
      '  bun run bench:pinned\n' +
      'then re-run the capture.',
  };
}
