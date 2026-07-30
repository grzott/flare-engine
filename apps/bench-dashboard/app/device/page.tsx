import { DeviceChart } from '../components/DeviceChart';
import { getDeviceReport } from '../lib/data';

export default function DevicePage() {
  const { devices, generated, stale, staleReason } = getDeviceReport();
  const ageDays = Math.floor((Date.now() - new Date(generated).getTime()) / 86_400_000);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Device Benchmarks</h1>
        <p className="mt-1 text-sm text-slate-500">On-device frame rates from a physical handset</p>
      </div>

      {/*
        This surface has its own staleness story, separate from the microbench:
        the capture pipeline it documents no longer exists, so the data cannot be
        refreshed at all until the device lane is revived (PERF-7). Saying
        "generated <date>" and stopping is what let a stale reading sit here
        unnoticed for months (B22).
      */}
      <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 space-y-1">
        <p className="text-sm font-medium text-red-200">
          {stale === true ? 'Frozen capture' : 'Stale capture'} — {ageDays} days old, and it cannot
          currently be refreshed.
        </p>
        <p className="text-xs text-red-200/80">
          {staleReason ??
            'The capture pipeline these numbers came from no longer exists in any repository. Reviving the device lane is tracked as PERF-7; until then, treat every figure on this page as a historical record of one build on one handset, not as a current measurement.'}
        </p>
        <p className="text-xs text-slate-400 font-mono">captured {generated}</p>
      </div>

      {devices.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-8 text-center space-y-3">
          <p className="text-slate-300 font-medium">No device data recorded yet.</p>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Run the bench-scene capture workflow on a physical device, then regenerate{' '}
            <code className="text-amber-300/80 bg-slate-800 px-1 rounded">
              benchmarks/results/device.json
            </code>{' '}
            to see per-device fps charts here.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {devices.map((run) => (
            <DeviceChart key={`${run.device}-${run.os}`} run={run} />
          ))}
        </div>
      )}
    </div>
  );
}
