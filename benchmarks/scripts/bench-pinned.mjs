/**
 * Runs a capture pinned to the host's performance cores.
 *
 * Windows hands a short-lived CPU-bound thread to whichever core class its scheduler prefers, and
 * on a hybrid part that decision moves a benchmark row by up to 1.75x — measured 2026-08-20, see
 * `src/affinity.ts`. Pinning removes the decision from the measurement.
 *
 * The mask is derived, never hard-coded: P-cores are the logical processors that come in
 * hyper-threaded pairs, and on every Intel hybrid part released to date they enumerate first, so
 * `2 x (logical - physical)` is the count of P-core logical processors. For an i9-13900KF —
 * 24 cores, 32 logical — that is 2 x 8 = 16, mask 0xffff.
 *
 * Child processes inherit the mask, so setting it on the launcher covers the capture, its heap
 * probe subprocesses, and everything else it spawns.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

if (process.platform !== 'win32') {
  console.error(
    'bench:pinned is Windows-only — affinity is set through PowerShell here. On another host run\n' +
      '`bun run bench` and pin it with the platform equivalent (taskset on Linux).',
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const forwarded = args.length > 0 ? args.join(' ') : '';

// Absolute path, never the bare name. Under `turbo` the PowerShell child does not inherit a PATH
// containing bun, so `& bun` raised CommandNotFoundException — and because a command PowerShell
// never launched leaves $LASTEXITCODE unset, the launcher exited 0 and turbo reported the capture
// as successful while nothing had run. A capture harness that can report success without
// measuring anything is the one failure mode worth hard-coding against.
const bun = process.execPath;

// PowerShell sets its own affinity, then launches bun as a child, which inherits it.
// $ErrorActionPreference is deliberately left at its default. Setting it to 'Stop' turns a native
// command's *stderr writes* into terminating errors, and the capture logs its progress to stderr —
// so it killed the run before it recorded anything. The explicit $LASTEXITCODE check below is the
// guard; it catches a launch failure without misreading normal output as one.
const script = `
$c = Get-CimInstance Win32_Processor
$physical = ($c | Measure-Object NumberOfCores -Sum).Sum
$logical  = ($c | Measure-Object NumberOfLogicalProcessors -Sum).Sum
if ($logical -le $physical -or $logical -ge $physical * 2) {
  Write-Error "not a hybrid host ($physical cores / $logical logical) - run 'bun run bench' instead"
  exit 2
}
$pCoreThreads = 2 * ($logical - $physical)
$mask = [int64]([math]::Pow(2, $pCoreThreads) - 1)
$me = Get-Process -Id $PID
$me.ProcessorAffinity = [System.IntPtr]$mask
Write-Host ("pinned to {0} P-core threads of {1} logical (mask 0x{2:x})" -f $pCoreThreads, $logical, $mask)
$global:LASTEXITCODE = $null
& '${bun.replace(/'/g, "''")}' run src/index.ts ${forwarded}
if ($null -eq $LASTEXITCODE) {
  Write-Error "the capture never launched - nothing was measured"
  exit 3
}
exit $LASTEXITCODE
`;

// Written to a file and run with -File rather than passed to -Command. A multi-line script through
// -Command has its own quoting rules, and the quoted absolute path inside it did not survive them:
// the capture never launched and $LASTEXITCODE stayed unset. -File parses the script exactly as
// written.
const dir = mkdtempSync(join(tmpdir(), 'flare-bench-pinned-'));
const file = join(dir, 'pin.ps1');
writeFileSync(file, script, 'utf8');

try {
  const res = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file],
    {
      stdio: 'inherit',
    },
  );
  process.exit(res.status ?? 1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
