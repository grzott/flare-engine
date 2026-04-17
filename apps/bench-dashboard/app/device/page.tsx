import { DeviceChart } from '../components/DeviceChart';
import { getDeviceReport } from '../lib/data';

export default function DevicePage() {
  const { devices, generated } = getDeviceReport();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Device Benchmarks</h1>
        <p className="mt-1 text-sm text-slate-500">Generated {generated}</p>
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
