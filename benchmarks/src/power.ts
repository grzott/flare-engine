/**
 * Reads the host's active power plan, and refuses a capture taken under one measured to distort
 * results.
 *
 * **Why this exists.** On 2026-08-19 the capture machine was found to be running Windows *Power
 * saver* on an i9-13900KF. Re-capturing the identical commit under *High performance* made **all 38
 * scenarios 2.42x-2.58x faster, median 2.49x** — a band that tight across ECS, physics, particles,
 * render and integration is a clock-rate effect, not a code one. Every node figure this repository
 * had published to that date was therefore ~2.5x too slow, and nothing in the harness could see it:
 * the load guard passed (the machine was quiet), the spread guard passed whenever five runs
 * happened to land in one clock state, and `gitDirty` was false. A capture condition that can move
 * every number by 2.5x belongs in the same category as foreign CPU load.
 *
 * **What is and is not calibrated.** Power saver is *measured* harmful, with the table above.
 * Balanced has never been measured here, so it is warned about rather than refused — inventing a
 * verdict for a state nobody has measured is the mistake this module exists to prevent. High
 * performance and Ultimate performance are the states the published numbers were taken under.
 *
 * Non-Windows hosts report `null`: there is no `powercfg`, and no equivalent has been validated, so
 * the field records "unknown" rather than a fabricated pass.
 */
import { execFileSync } from 'node:child_process';

/** Windows' built-in scheme GUIDs. */
const POWER_SAVER = 'a1841308-3541-4fab-bc81-f71556f20b4a';
const BALANCED = '381b4222-f694-41f0-9685-ff5bb260df2e';
const HIGH_PERFORMANCE = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
const ULTIMATE = 'e9a42b02-d5df-448d-aa00-03f14749eb61';

export type PowerScheme = {
  readonly guid: string;
  /** As `powercfg` prints it — localised, so never matched on. */
  readonly label: string;
};

/** The active scheme, or `null` when the host cannot report one (non-Windows, or powercfg absent). */
export function readPowerScheme(): PowerScheme | null {
  if (process.platform !== 'win32') return null;
  try {
    const out = execFileSync('powercfg', ['/getactivescheme'], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    const m = /GUID:\s*([0-9a-f-]{36})\s*(?:\(([^)]*)\))?/i.exec(out);
    if (m?.[1] === undefined) return null;
    return { guid: m[1].toLowerCase(), label: (m[2] ?? '').trim() };
  } catch {
    return null;
  }
}

export type PowerVerdict =
  | { readonly kind: 'ok' }
  | { readonly kind: 'warn'; readonly message: string }
  | { readonly kind: 'refuse'; readonly message: string };

/** Judges a scheme. Only Power saver is refused, because only Power saver has been measured. */
export function judgePowerScheme(scheme: PowerScheme | null): PowerVerdict {
  if (scheme === null) return { kind: 'ok' };
  const g = scheme.guid;
  if (g === POWER_SAVER) {
    return {
      kind: 'refuse',
      message:
        'the host is on the Windows "Power saver" plan, which was measured on this hardware to ' +
        'make every scenario ~2.5x slower (38 of 38 scenarios, 2.42x-2.58x, at one commit). ' +
        'Numbers captured under it describe the CPU governor, not the engine. Switch with:\n' +
        `  powercfg /setactive ${HIGH_PERFORMANCE}   # High performance\n` +
        'then re-run the capture.',
    };
  }
  if (g === HIGH_PERFORMANCE || g === ULTIMATE) return { kind: 'ok' };
  if (g === BALANCED) {
    return {
      kind: 'warn',
      message:
        'the host is on the Windows "Balanced" plan. Its effect on these benchmarks has never been ' +
        'measured here — it is not refused for that reason, but the published numbers were taken ' +
        'under High performance and this capture may not be comparable to them.',
    };
  }
  return {
    kind: 'warn',
    message: `unrecognised power scheme ${g}${scheme.label === '' ? '' : ` (${scheme.label})`} — recorded, not judged.`,
  };
}
